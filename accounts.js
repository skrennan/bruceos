const crypto = require('crypto');
const {promisify} = require('util');
const {open,run,get,all,exec,close} = require('./database');
const scrypt = promisify(crypto.scrypt);
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const emailAddress = value => String(value || '').trim().toLowerCase();
const passwordValid = value => typeof value==='string' && value.length>=12 && value.length<=128;

async function passwordHash(password) {
    if (!passwordValid(password)) throw new Error('A senha precisa ter entre 12 e 128 caracteres.');
    const salt=crypto.randomBytes(16).toString('hex');
    const key=await scrypt(password,salt,64);
    return salt+':'+key.toString('hex');
}
async function passwordMatches(password,stored) {
    if (typeof password!=='string' || password.length>128) return false;
    const [salt,key]=stored.split(':');
    const candidate=await scrypt(password,salt,64);
    return crypto.timingSafeEqual(Buffer.from(key,'hex'),candidate);
}
async function createAccounts(file) {
    const db=open(file);
    await exec(db,`PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,storeId TEXT NOT NULL REFERENCES stores(id),email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','owner')));
        CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY,userId TEXT NOT NULL REFERENCES users(id),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS sessions_user ON sessions(userId);`);
    let writeQueue=Promise.resolve();
    function serialize(job) {const next=writeQueue.then(job,job);writeQueue=next.catch(()=>{});return next;}
    async function createStore({name,email,password,initial=false}) {
        name=String(name||'').trim();email=emailAddress(email);
        if (name.length<2 || name.length>100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>200) throw new Error('Informe o nome da loja e um e-mail válido.');
        const encoded=await passwordHash(password);
        return serialize(async()=>{
            if (initial && await get(db,'SELECT id FROM users LIMIT 1')) throw new Error('O administrador inicial já foi criado.');
            const storeId=initial?'legacy':crypto.randomUUID();
            const userId=crypto.randomUUID();
            await run(db,'BEGIN IMMEDIATE');
            try {
                await run(db,'INSERT INTO stores(id,name,createdAt) VALUES(?,?,?)',[storeId,name,new Date().toISOString()]);
                await run(db,'INSERT INTO users(id,storeId,email,password,role) VALUES(?,?,?,?,?)',[userId,storeId,email,encoded,initial?'admin':'owner']);
                await run(db,'COMMIT');
                return {id:storeId,name,email,active:true};
            } catch(error) {await run(db,'ROLLBACK');if(error.code==='SQLITE_CONSTRAINT') throw new Error('Este e-mail já possui uma conta.');throw error;}
        });
    }
    async function login(email,password) {
      return serialize(async()=>{
        const user=await get(db,'SELECT u.*,s.name,s.active FROM users u JOIN stores s ON s.id=u.storeId WHERE email=?',[emailAddress(email)]);
        // Perform comparable password work for unknown accounts.
        const encoded=user?.password || '00000000000000000000000000000000:'+ '00'.repeat(64);
        if (!await passwordMatches(password,encoded) || !user || !user.active) return null;
        const token=crypto.randomBytes(32).toString('hex');
        const csrf=crypto.randomBytes(32).toString('hex');
        await run(db,'DELETE FROM sessions WHERE expires<=?',[Date.now()]);
        await run(db,'INSERT INTO sessions VALUES(?,?,?,?)',[hashToken(token),user.id,csrf,Date.now()+12*60*60*1000]);
        return {token,csrf};
      });
    }
    async function authenticate(token) {
        if (!/^[a-f0-9]{64}$/.test(token||'')) return null;
        return get(db,`SELECT u.id,u.storeId,u.email,u.role,s.name,s.active,se.csrf FROM sessions se JOIN users u ON u.id=se.userId JOIN stores s ON s.id=u.storeId WHERE se.token=? AND se.expires>? AND s.active=1`,[hashToken(token),Date.now()]);
    }
    return {
        createStore,login,authenticate,
        initialized:()=>get(db,'SELECT id FROM users LIMIT 1'),
        logout:token=>serialize(()=>run(db,'DELETE FROM sessions WHERE token=?',[hashToken(token)])),
        list:()=>all(db,'SELECT s.id,s.name,s.active,s.createdAt,u.email FROM stores s JOIN users u ON u.storeId=s.id ORDER BY s.createdAt'),
        async setActive(id,active) {return serialize(async()=>{await run(db,'BEGIN IMMEDIATE');try {const result=await run(db,"UPDATE stores SET active=? WHERE id=? AND id<>'legacy'",[active?1:0,id]);if(!active)await run(db,'DELETE FROM sessions WHERE userId IN (SELECT id FROM users WHERE storeId=?)',[id]);await run(db,'COMMIT');return result.changes;}catch(error){await run(db,'ROLLBACK');throw error;}});},
        async changePassword(userId,current,next) {const encoded=await passwordHash(next);return serialize(async()=>{const user=await get(db,'SELECT password FROM users WHERE id=?',[userId]);if(!user || !await passwordMatches(current,user.password))throw new Error('Senha atual incorreta.');await run(db,'BEGIN IMMEDIATE');try{await run(db,'UPDATE users SET password=? WHERE id=?',[encoded,userId]);await run(db,'DELETE FROM sessions WHERE userId=?',[userId]);await run(db,'COMMIT');}catch(error){await run(db,'ROLLBACK');throw error;}});},
        close:()=>close(db)
    };
}
module.exports={createAccounts};
