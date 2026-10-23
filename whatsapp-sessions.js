const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const createQRImage = require('./whatsapp-qr');

function connectionError(error) {
    const message=String(error?.message||error||'');
    if(/could not find chrome|browser was not found|executable.*not found|executable.*doesn.t exist|ENOENT/i.test(message))return {code:'BROWSER_NOT_INSTALLED',message:'O navegador do WhatsApp não foi encontrado. Na pasta whatsapp-api, execute npx puppeteer browsers install chrome e reinicie o servidor.'};
    if(/already running|ProcessSingleton|SingletonLock|user data directory.*in use|profile.*in use/i.test(message))return {code:'PROFILE_IN_USE',message:'A sessão está sendo usada por outro processo. Feche a outra execução desta API e tente novamente. Não apague a sessão com o navegador aberto.'};
    if(/ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION|ERR_PROXY|ERR_CERT|net::/i.test(message))return {code:'NETWORK_ERROR',message:'O navegador não conseguiu acessar o WhatsApp Web. Confira a internet, o proxy e o antivírus deste computador e tente novamente.'};
    if(/timeout|timed out/i.test(message))return {code:'START_TIMEOUT',message:'O WhatsApp demorou para iniciar. Tente conectar novamente; se persistir, use Gerar novo QR para criar um perfil limpo.'};
    if(/EACCES|EPERM|access.*denied|permission denied/i.test(message))return {code:'BROWSER_PERMISSION',message:'O navegador não conseguiu acessar seus arquivos. Confira as permissões da pasta e se o antivírus bloqueou o Chromium.'};
    return {code:'START_FAILED',message:'Não foi possível carregar a sessão do WhatsApp. Tente novamente ou use Gerar novo QR. O terminal do servidor mostra o erro técnico.'};
}

function createWhatsAppSessions({authDir,legacyAuthDir,clientFactory}) {
    const sessions=new Map();
    const locks=new Map();
    const resets=new Map();
    function state(storeId) {
        if (!sessions.has(storeId)) sessions.set(storeId,{status:'DESCONECTADO',qr:'',qrImage:'',lastError:null,client:null,initializing:null,generation:0});
        return sessions.get(storeId);
    }
    function clientFor(storeId) {
        const options={storeId,clientId:storeId==='legacy'?undefined:'store-'+storeId,dataPath:storeId==='legacy'?legacyAuthDir:authDir};
        if (clientFactory) return clientFactory(options);
        const {Client,LocalAuth}=require('whatsapp-web.js');
        return new Client({authStrategy:new LocalAuth({clientId:options.clientId,dataPath:options.dataPath}),authTimeoutMs:60000,puppeteer:{headless:true,timeout:30000,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']},webVersionCache:{type:'none'}});
    }
    function connect(storeId) {
        const current=state(storeId);
        if (locks.has(storeId) || resets.has(storeId) || current.client) return current;
        current.status='INICIALIZANDO';current.qr='';current.qrImage='';current.lastError=null;
        let client;
        try{client=clientFor(storeId);}catch(error){current.status='ERRO_INICIALIZACAO';current.lastError=connectionError(error);console.error('Falha ao criar WhatsApp ['+storeId+']:',error?.message||error);throw Object.assign(new Error(current.lastError.message),{status:503,code:current.lastError.code,expose:true});}
        current.client=client;
        const generation=++current.generation;
        const valid=()=>current.client===client && current.generation===generation;
        client.on('qr',qr=>{if(!valid())return;current.qr=qr;current.qrImage=createQRImage(qr);current.status='AGUARDANDO_LEITURA';current.lastError=null;});
        client.on('authenticated',()=>{if(!valid())return;current.status='AUTENTICADO';current.qr='';current.qrImage='';});
        client.on('ready',()=>{if(!valid())return;current.status='CONECTADO';current.qr='';current.qrImage='';});
        client.on('disconnected',()=>{if(!valid())return;current.status='DESCONECTADO';current.qr='';current.qrImage='';disconnect(storeId,false).catch(()=>{});});
        async function failed(error,status='ERRO_INICIALIZACAO'){
            if(!valid())return;
            console.error('Falha ao iniciar WhatsApp ['+storeId+']:',error?.message||error);
            const detail=status==='ERRO_AUTENTICACAO'?{code:'AUTH_FAILED',message:'A sessão salva não foi aceita pelo WhatsApp. Use Gerar novo QR e conecte novamente o telefone da empresa.'}:connectionError(error);
            current.initializing=null;
            const cleanup=disconnect(storeId,false),generation=current.generation;
            await cleanup.catch(error=>console.error('Falha ao encerrar navegador ['+storeId+']:',error?.message||error));
            if(current.generation===generation&&!current.client){current.status=status;current.lastError=detail;}
        }
        client.on('auth_failure',()=>{failed(new Error('Authentication failed'),'ERRO_AUTENTICACAO').catch(()=>{});});
        const initialize=Promise.resolve().then(()=>client.initialize());current.initializing=initialize;
        initialize.catch(error=>failed(error)).finally(()=>{if(current.initializing===initialize)current.initializing=null;}).catch(()=>{});
        return current;
    }
    async function disconnect(storeId,logout=true) {
        if (locks.has(storeId)) return locks.get(storeId);
        const current=state(storeId),client=current.client,initialize=current.initializing;
        const authenticated=['CONECTADO','AUTENTICADO'].includes(current.status);
        current.generation++;current.client=null;current.status='DESCONECTADO';current.qr='';current.qrImage='';current.lastError=null;
        current.initializing=null;
        const task=(async()=>{if(client){if(initialize)await initialize.catch(()=>{});try {if(logout&&authenticated)await client.logout();}finally{await client.destroy();}if(logout&&!authenticated&&client.authStrategy?.logout)await client.authStrategy.logout();}})();
        locks.set(storeId,task);try{await task;}finally{locks.delete(storeId);}
    }
    async function reset(storeId){
        if(resets.has(storeId))return resets.get(storeId);
        if(!/^[A-Za-z0-9_-]+$/.test(storeId))throw new Error('Identificação de empresa inválida.');
        const task=(async()=>{
            await disconnect(storeId,false);
            const root=path.resolve(storeId==='legacy'?legacyAuthDir:authDir);
            const name=storeId==='legacy'?'session':'session-store-'+storeId;
            const source=path.resolve(root,name),backup=path.resolve(root,name+'.backup-'+Date.now()+'-'+crypto.randomBytes(4).toString('hex'));
            if(!source.startsWith(root+path.sep)||!backup.startsWith(root+path.sep))throw new Error('Diretório de sessão inválido.');
            try{await fs.rename(source,backup);}catch(error){if(error.code!=='ENOENT')throw Object.assign(new Error('Não foi possível guardar o perfil anterior. Feche outras execuções desta API e tente novamente.'),{status:409,code:'PROFILE_BACKUP_FAILED',expose:true});}
            resets.delete(storeId);
            return connect(storeId);
        })();
        resets.set(storeId,task);
        try{return await task;}finally{if(resets.get(storeId)===task)resets.delete(storeId);}
    }
    async function send(storeId,telefone,mensagem) {
        const current=state(storeId);
        if (current.status!=='CONECTADO'||!current.client) throw new Error('Conecte o WhatsApp desta loja antes de enviar mensagens.');
        const digits=String(telefone).replace(/\D/g,'');
        if(digits.length<10||digits.length>15)throw new Error('Número de WhatsApp inválido.');
        const full=(digits.length===10||digits.length===11)?'55'+digits:digits;
        const id=await current.client.getNumberId(full+'@c.us');
        if(!id?._serialized)throw new Error('Número de WhatsApp não encontrado.');
        await current.client.sendMessage(id._serialized,String(mensagem));
    }
    return {state,connect,disconnect,reset,send,async close(){await Promise.allSettled([...resets.values()]);await Promise.all([...sessions.keys()].map(id=>disconnect(id,false)));}};
}
module.exports={createWhatsAppSessions,connectionError};
