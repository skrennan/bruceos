const crypto=require('crypto');
const {run,get,all,exec}=require('./database');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const failure=(status,code,message)=>Object.assign(new Error(message),{status,code,expose:true});
const period=()=>new Date().toISOString().slice(0,7);
const live=sub=>sub && (!sub.expiresAt || Date.parse(sub.expiresAt)>Date.now());

async function createCommerce(db,serialize){
    await exec(db,`CREATE TABLE IF NOT EXISTS subscriptions (
        storeId TEXT PRIMARY KEY REFERENCES stores(id),plan TEXT NOT NULL,monthlyPriceCents INTEGER NOT NULL DEFAULT 0,
        messageLimit INTEGER NOT NULL DEFAULT 1000,expiresAt TEXT,billingStatus TEXT NOT NULL DEFAULT 'trial');
        CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY,storeId TEXT NOT NULL REFERENCES stores(id),
        name TEXT NOT NULL,prefix TEXT NOT NULL,hash TEXT UNIQUE NOT NULL,createdAt TEXT NOT NULL,revokedAt TEXT,lastUsedAt TEXT);
        CREATE INDEX IF NOT EXISTS api_keys_store ON api_keys(storeId);
        CREATE TABLE IF NOT EXISTS api_messages (id TEXT PRIMARY KEY,storeId TEXT NOT NULL REFERENCES stores(id),
        requestKey TEXT,fingerprint TEXT NOT NULL,status TEXT NOT NULL,period TEXT NOT NULL,createdAt TEXT NOT NULL,
        UNIQUE(storeId,requestKey));
        CREATE INDEX IF NOT EXISTS api_messages_usage ON api_messages(storeId,period,status);`);
    // An interrupted process cannot assert that an in-flight provider call was not sent.
    await run(db,"UPDATE api_messages SET status='unknown' WHERE status='sending'");
    async function provision(storeId,initial=false){
        return run(db,'INSERT OR IGNORE INTO subscriptions(storeId,plan,messageLimit,expiresAt,billingStatus) VALUES(?,?,?,?,?)',
            [storeId,initial?'Administrador':'Avaliação',initial?100000:1000,initial?null:new Date(Date.now()+30*86400000).toISOString(),initial?'active':'trial']);
    }
    for(const store of await all(db,'SELECT id FROM stores'))await provision(store.id,store.id==='legacy');
    async function subscription(storeId){
        const sub=await get(db,'SELECT s.*,st.active FROM subscriptions s JOIN stores st ON st.id=s.storeId WHERE storeId=?',[storeId]);
        const usage=await get(db,"SELECT COUNT(*) AS used FROM api_messages WHERE storeId=? AND period=? AND status IN ('sending','sent','unknown')",[storeId,period()]);
        return {...sub,used:usage.used,period:period(),access:!!sub?.active&&live(sub)};
    }
    async function ensureAccess(storeId){
        const sub=await subscription(storeId);
        if(!sub.active)throw failure(403,'STORE_SUSPENDED','O acesso desta empresa está suspenso.');
        if(!sub.access)throw failure(402,'SUBSCRIPTION_EXPIRED','Mensalidade vencida. Entre em contato com o administrador para renovar.');
        return sub;
    }
    async function setSubscription(storeId,body){
        const {plan,monthlyPriceCents,messageLimit,expiresAt,billingStatus}=body;
        if(typeof plan!=='string'||plan.trim().length<2||plan.length>80||!Number.isSafeInteger(monthlyPriceCents)||monthlyPriceCents<0||monthlyPriceCents>100000000||!Number.isSafeInteger(messageLimit)||messageLimit<1||messageLimit>1000000||!['trial','active'].includes(billingStatus)||typeof expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(expiresAt)||!Number.isFinite(Date.parse(expiresAt)))
            throw failure(400,'INVALID_SUBSCRIPTION','Confira o plano, o valor, a franquia e o vencimento.');
        return serialize(async()=>{
            const result=await run(db,"UPDATE subscriptions SET plan=?,monthlyPriceCents=?,messageLimit=?,expiresAt=?,billingStatus=? WHERE storeId=? AND storeId<>'legacy'",[plan.trim(),monthlyPriceCents,messageLimit,new Date(expiresAt).toISOString(),billingStatus,storeId]);
            if(!result.changes)throw failure(404,'STORE_NOT_FOUND','Empresa não encontrada ou conta do administrador.');
            return subscription(storeId);
        });
    }
    const keys=storeId=>all(db,'SELECT id,name,prefix,createdAt,revokedAt,lastUsedAt FROM api_keys WHERE storeId=? ORDER BY createdAt DESC',[storeId]);
    async function createKey(storeId,name){
        if(typeof name!=='string'||name.trim().length<2||name.length>80)throw failure(400,'INVALID_NAME','Informe um nome para a integração (2 a 80 caracteres).');
        return serialize(async()=>{
            await ensureAccess(storeId);
            const count=await get(db,'SELECT COUNT(*) AS total FROM api_keys WHERE storeId=? AND revokedAt IS NULL',[storeId]);
            if(count.total>=5)throw failure(409,'KEY_LIMIT','Revogue uma chave antes de criar outra. Limite: 5 chaves ativas.');
            const token='wa_live_'+crypto.randomBytes(32).toString('hex'),id=crypto.randomUUID(),createdAt=new Date().toISOString();
            await run(db,'INSERT INTO api_keys(id,storeId,name,prefix,hash,createdAt) VALUES(?,?,?,?,?,?)',[id,storeId,name.trim(),token.slice(0,16),digest(token),createdAt]);
            return {id,name:name.trim(),token,createdAt};
        });
    }
    async function authenticate(token){
        if(!/^wa_live_[a-f0-9]{64}$/.test(token||''))return null;
        const key=await get(db,`SELECT k.id AS keyId,u.id,u.storeId,u.email,s.name,'integration' AS role FROM api_keys k
            JOIN stores s ON s.id=k.storeId JOIN users u ON u.storeId=s.id WHERE k.hash=? AND k.revokedAt IS NULL AND s.active=1`,[digest(token)]);
        if(key)await serialize(()=>run(db,'UPDATE api_keys SET lastUsedAt=? WHERE id=?',[new Date().toISOString(),key.keyId]));
        return key;
    }
    async function revoke(storeId,id){return serialize(()=>run(db,'UPDATE api_keys SET revokedAt=? WHERE id=? AND storeId=? AND revokedAt IS NULL',[new Date().toISOString(),id,storeId]));}
    async function send(storeId,phone,message,options,transport){
        const digits=String(phone||'').replace(/\D/g,'');
        if(typeof phone!=='string'||digits.length<10||digits.length>15||typeof message!=='string'||!message.trim()||message.length>10000)
            throw failure(400,'INVALID_MESSAGE','Informe um telefone com DDI/DDD e uma mensagem de até 10.000 caracteres.');
        const requestKey=options?.idempotencyKey??null;
        if(requestKey && (typeof requestKey!=='string'||!/^[a-zA-Z0-9_.:-]{8,128}$/.test(requestKey)))throw failure(400,'INVALID_IDEMPOTENCY_KEY','Idempotency-Key deve ter entre 8 e 128 caracteres: letras, números, ponto, hífen, dois-pontos ou sublinhado.');
        const fingerprint=digest(JSON.stringify([digits,message]));
        const reservation=await serialize(async()=>{
            const sub=await ensureAccess(storeId);
            if(requestKey){
                const previous=await get(db,'SELECT id,status,fingerprint FROM api_messages WHERE storeId=? AND requestKey=?',[storeId,requestKey]);
                if(previous){
                    if(previous.fingerprint!==fingerprint)throw failure(409,'IDEMPOTENCY_CONFLICT','Esta chave já foi usada com outra mensagem.');
                    if(previous.status==='sent')return {id:previous.id,replayed:true};
                    throw failure(409,'MESSAGE_UNCERTAIN','Mensagem em processamento ou sem confirmação. Confira no WhatsApp antes de tentar novamente.');
                }
            }
            options?.ready?.();
            if(sub.used>=sub.messageLimit)throw failure(429,'MONTHLY_LIMIT','A franquia mensal de mensagens desta empresa foi atingida.');
            const id=crypto.randomUUID();
            await run(db,"INSERT INTO api_messages(id,storeId,requestKey,fingerprint,status,period,createdAt) VALUES(?,?,?,?,'sending',?,?)",[id,storeId,requestKey,fingerprint,period(),new Date().toISOString()]);
            return {id,replayed:false};
        });
        if(reservation.replayed)return {...reservation,status:'sent'};
        try{
            await transport(storeId,phone,message);
        }catch(error){
            await serialize(()=>run(db,"UPDATE api_messages SET status='unknown' WHERE id=?",[reservation.id]));
            throw failure(502,'DELIVERY_UNCERTAIN','Envio sem confirmação. Confira o WhatsApp antes de repetir a mensagem.');
        }
        await serialize(()=>run(db,"UPDATE api_messages SET status='sent' WHERE id=?",[reservation.id]));
        return {...reservation,status:'sent'};
    }
    const messages=storeId=>all(db,'SELECT id,status,createdAt FROM api_messages WHERE storeId=? ORDER BY createdAt DESC LIMIT 30',[storeId]);
    return {provision,subscription,ensureAccess,setSubscription,keys,createKey,authenticate,revoke,send,messages};
}
module.exports={createCommerce,failure};
