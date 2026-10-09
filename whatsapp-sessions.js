const path = require('path');
const createQRImage = require('./whatsapp-qr');

function createWhatsAppSessions({authDir,legacyAuthDir,clientFactory}) {
    const sessions=new Map();
    const locks=new Map();
    function state(storeId) {
        if (!sessions.has(storeId)) sessions.set(storeId,{status:'DESCONECTADO',qr:'',qrImage:'',client:null,initializing:null,generation:0});
        return sessions.get(storeId);
    }
    function clientFor(storeId) {
        const options={storeId,clientId:storeId==='legacy'?undefined:'store-'+storeId,dataPath:storeId==='legacy'?legacyAuthDir:authDir};
        if (clientFactory) return clientFactory(options);
        const {Client,LocalAuth}=require('whatsapp-web.js');
        return new Client({authStrategy:new LocalAuth({clientId:options.clientId,dataPath:options.dataPath}),puppeteer:{headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']},webVersionCache:{type:'local',path:path.join(authDir,'cache')}});
    }
    function connect(storeId) {
        const current=state(storeId);
        if (locks.has(storeId) || current.client) return current;
        current.status='INICIALIZANDO';current.qr='';current.qrImage='';
        const client=clientFor(storeId);current.client=client;
        const generation=++current.generation;
        const valid=()=>current.client===client && current.generation===generation;
        client.on('qr',qr=>{if(!valid())return;current.qr=qr;current.qrImage=createQRImage(qr);current.status='AGUARDANDO_LEITURA';});
        client.on('authenticated',()=>{if(!valid())return;current.status='AUTENTICADO';current.qr='';current.qrImage='';});
        client.on('ready',()=>{if(!valid())return;current.status='CONECTADO';current.qr='';current.qrImage='';});
        client.on('disconnected',()=>{if(!valid())return;current.status='DESCONECTADO';current.qr='';current.qrImage='';disconnect(storeId,false).catch(()=>{});});
        client.on('auth_failure',()=>{if(!valid())return;current.status='ERRO_AUTENTICACAO';disconnect(storeId,false).catch(()=>{});});
        const initialize=Promise.resolve().then(()=>client.initialize());current.initializing=initialize;
        initialize.catch(async()=>{if(!valid())return;current.initializing=null;await disconnect(storeId,false).catch(()=>{});current.status='ERRO_INICIALIZACAO';}).finally(()=>{if(current.initializing===initialize)current.initializing=null;});
        return current;
    }
    async function disconnect(storeId,logout=true) {
        if (locks.has(storeId)) return locks.get(storeId);
        const current=state(storeId),client=current.client,initialize=current.initializing;
        const authenticated=['CONECTADO','AUTENTICADO'].includes(current.status);
        current.generation++;current.client=null;current.status='DESCONECTADO';current.qr='';current.qrImage='';
        current.initializing=null;
        const task=(async()=>{if(client){if(initialize)await initialize.catch(()=>{});try {if(logout&&authenticated)await client.logout();}finally{await client.destroy();}if(logout&&!authenticated&&client.authStrategy?.logout)await client.authStrategy.logout();}})();
        locks.set(storeId,task);try{await task;}finally{locks.delete(storeId);}
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
    return {state,connect,disconnect,send,async close(){await Promise.all([...sessions.keys()].map(id=>disconnect(id,false)));}};
}
module.exports={createWhatsAppSessions};
