const assert=require('assert/strict');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {EventEmitter}=require('events');
const {createWhatsAppSessions,connectionError}=require('./whatsapp-sessions');

(async()=>{
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'whatsapp-recovery-'));
    const authDir=path.join(temporary,'auth'),legacyAuthDir=path.join(temporary,'legacy');let sessions;
    const failures=new Map(),clients=new Map();
    class FakeClient extends EventEmitter{
        constructor(options){super();this.options=options;this.destroyed=0;clients.set(options.storeId,this);}
        async initialize(){if(failures.has(this.options.storeId))throw failures.get(this.options.storeId);this.emit('qr','temporary-qr-for-'+this.options.storeId);}
        async destroy(){this.destroyed++;}async logout(){throw Error('Recovery must preserve old authentication.');}
    }
    async function eventually(predicate){for(let n=0;n<100;n++){if(predicate())return;await new Promise(r=>setTimeout(r,5));}throw Error('State did not settle.');}
    try{
        sessions=createWhatsAppSessions({authDir,legacyAuthDir,clientFactory:o=>new FakeClient(o)});
        failures.set('alpha',Error('Could not find Chrome (ver. 123)'));
        sessions.connect('alpha');await eventually(()=>sessions.state('alpha').status==='ERRO_INICIALIZACAO');
        assert.equal(sessions.state('alpha').lastError.code,'BROWSER_NOT_INSTALLED');assert.equal(sessions.state('alpha').client,null);
        failures.delete('alpha');sessions.connect('alpha');await eventually(()=>sessions.state('alpha').status==='AGUARDANDO_LEITURA');assert.equal(sessions.state('alpha').lastError,null);
        const alpha=clients.get('alpha');alpha.emit('auth_failure');await eventually(()=>sessions.state('alpha').status==='ERRO_AUTENTICACAO');assert.equal(sessions.state('alpha').lastError.code,'AUTH_FAILED');
        for(const name of ['session-store-alpha','session-store-beta']){await fs.mkdir(path.join(authDir,name),{recursive:true});await fs.writeFile(path.join(authDir,name,'preserve.txt'),name);}
        await fs.mkdir(path.join(legacyAuthDir,'session'),{recursive:true});await fs.writeFile(path.join(legacyAuthDir,'session','preserve.txt'),'legacy');
        sessions.connect('beta');await eventually(()=>sessions.state('beta').status==='AGUARDANDO_LEITURA');const beta=clients.get('beta');
        const resetResults=await Promise.all([sessions.reset('alpha'),sessions.reset('alpha')]);assert(resetResults.every(result=>result===sessions.state('alpha')));
        await eventually(()=>sessions.state('alpha').status==='AGUARDANDO_LEITURA');
        const backups=(await fs.readdir(authDir)).filter(name=>name.startsWith('session-store-alpha.backup-'));assert.equal(backups.length,1);assert.equal(await fs.readFile(path.join(authDir,backups[0],'preserve.txt'),'utf8'),'session-store-alpha');
        assert.equal(clients.get('beta'),beta);assert.equal(beta.destroyed,0);assert.equal(await fs.readFile(path.join(authDir,'session-store-beta','preserve.txt'),'utf8'),'session-store-beta');
        await sessions.reset('legacy');const legacyBackup=(await fs.readdir(legacyAuthDir)).find(name=>name.startsWith('session.backup-'));assert(legacyBackup);assert.equal(await fs.readFile(path.join(legacyAuthDir,legacyBackup,'preserve.txt'),'utf8'),'legacy');
        await assert.rejects(()=>sessions.reset('../escape'));
        assert.equal(connectionError(Error('net::ERR_NAME_NOT_RESOLVED')).code,'NETWORK_ERROR');assert.equal(connectionError(Error('The browser is already running for this profile')).code,'PROFILE_IN_USE');assert.equal(connectionError(Error('Navigation timeout')).code,'START_TIMEOUT');
        console.log('PASS: initialization errors exposed safely; authentication failure state retained; concurrent recovery preserves backup; no other company or legacy data touched; path traversal rejected.');
    }finally{
        if(sessions)await sessions.close();const target=path.resolve(temporary);if(!target.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(target).startsWith('whatsapp-recovery-'))throw Error('Unsafe cleanup');await fs.rm(target,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
