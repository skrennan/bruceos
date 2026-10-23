const assert=require('assert/strict');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {EventEmitter}=require('events');
const {createApp}=require('./server');
const {open,get,close}=require('./database');

(async()=>{
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'whatsapp-commercial-'));
    let service,server,base;const clients=new Map(),sent=[];const password='Commercial-test-password-2026';
    class FakeClient extends EventEmitter{
        constructor(options){super();this.storeId=options.storeId;clients.set(this.storeId,this);}
        async initialize(){this.emit('ready');}async getNumberId(id){return {_serialized:id};}
        async sendMessage(id,text){sent.push({storeId:this.storeId,id,text});if(text==='SIMULATE_UNCERTAIN')throw Error('provider interrupted');}
        async logout(){}async destroy(){}
    }
    async function start(){service=await createApp({dataDir:path.join(temporary,'data'),legacyDbPath:path.join(temporary,'legacy.db'),clientFactory:o=>new FakeClient(o)});server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;}
    async function stop(){await new Promise(r=>server.close(r));server=null;await service.close();service=null;}
    async function request(route,{session,key,method='GET',body,idem,origin,csrf=true}={}){
        const headers={};if(session){headers.Cookie=session.cookie;if(csrf)headers['X-CSRF-Token']=session.csrf;}if(key)headers.Authorization='Bearer '+key;if(idem)headers['Idempotency-Key']=idem;if(origin)headers.Origin=origin;if(body!==undefined)headers['Content-Type']='application/json';
        const response=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json(),headers:response.headers};
    }
    async function login(email){const response=await request('/auth/login',{method:'POST',body:{email,password}});assert.equal(response.status,200);const session={cookie:response.headers.get('set-cookie').split(';')[0]};session.csrf=(await request('/auth/me',{session})).data.csrf;return session;}
    const future=new Date(Date.now()+60*86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();
    try{
        await start();await service.accounts.createStore({name:'Administrador',email:'admin@example.com',password,initial:true});const admin=await login('admin@example.com');
        const a=(await request('/admin/stores',{session:admin,method:'POST',body:{name:'Empresa A',email:'a@example.com',password}})).data.store;
        const b=(await request('/admin/stores',{session:admin,method:'POST',body:{name:'Empresa B',email:'b@example.com',password}})).data.store;
        const alice=await login('a@example.com'),bob=await login('b@example.com');
        const updateSub=(id,extra={})=>request('/admin/stores/'+id+'/subscription',{session:admin,method:'PUT',body:{plan:'Profissional',monthlyPriceCents:19990,messageLimit:3,expiresAt:future,billingStatus:'active',...extra}});
        assert.equal((await updateSub(a.id)).status,200);assert.equal((await updateSub(b.id)).status,200);
        assert.equal((await request('/admin/commercial',{session:alice})).status,403);
        assert.equal((await request('/admin/stores/'+a.id+'/subscription',{session:bob,method:'PUT',body:{}})).status,403);
        assert.equal((await request('/integrations/keys',{session:alice,method:'POST',csrf:false,body:{name:'Unsafe'}})).status,403);
        const ka=await request('/integrations/keys',{session:alice,method:'POST',body:{name:'ERP A'}}),kb=await request('/integrations/keys',{session:bob,method:'POST',body:{name:'ERP B'}});assert.equal(ka.status,201);const key=ka.data.token,keyB=kb.data.token;
        const list=await request('/integrations/overview',{session:alice});assert(!JSON.stringify(list.data).includes(key));assert.equal(list.data.keys.length,1);
        const accountDb=open(path.join(temporary,'data','accounts.sqlite'));const stored=await get(accountDb,'SELECT * FROM api_keys WHERE id=?',[ka.data.id]);assert.notEqual(stored.hash,key);assert.equal(stored.hash.length,64);await close(accountDb);
        assert.equal((await request('/v1/account')).status,401);assert.equal((await request('/v1/account',{key})).data.company.id,a.id);
        assert.equal((await request('/clientes',{key})).status,401);assert.equal((await request('/v1/admin/stores',{key})).status,404);
        assert.equal((await request('/v1/account',{key,origin:'https://evil.example'})).status,403);
        assert.equal((await request('/integrations/keys/'+ka.data.id,{session:bob,method:'DELETE'})).status,404);
        const message={to:'5511999999999',text:'Mensagem privada A'};
        assert.equal((await request('/v1/messages',{key,method:'POST',body:message,idem:'first-send-001'})).status,409);
        assert.equal((await request('/v1/account',{key})).data.subscription.used,0);
        await request('/whatsapp/connect',{session:alice,method:'POST'});await request('/whatsapp/connect',{session:bob,method:'POST'});
        assert.equal((await request('/v1/messages',{key,method:'POST',body:message})).status,400);
        assert.equal((await request('/v1/messages',{key,method:'POST',body:message,idem:'first-send-001'})).status,201);
        assert.equal((await request('/v1/messages',{key,method:'POST',body:message,idem:'first-send-001'})).status,200);assert.equal(sent.length,1);
        assert.equal((await request('/v1/messages',{key,method:'POST',body:{...message,text:'changed'},idem:'first-send-001'})).status,409);
        assert.equal((await request('/v1/messages',{key:keyB,method:'POST',body:message,idem:'first-send-001'})).status,201);assert.equal(sent[1].storeId,b.id);
        assert.equal((await request('/v1/messages',{key:keyB})).data.length,1);
        const attempts=await Promise.all(['send-second-001','send-third-001','send-fourth-001'].map(idem=>request('/v1/messages',{key,method:'POST',body:message,idem})));
        assert.deepEqual(attempts.map(r=>r.status).sort(),[201,201,429]);assert.equal((await request('/v1/account',{key})).data.subscription.used,3);
        assert.equal((await request('/enviar-mensagem',{session:alice,method:'POST',body:{telefone:message.to,mensagem:'No bypass'}})).status,429);
        assert.equal((await request('/v1/messages',{key})).data.some(item=>item.text||item.to||item.fingerprint),false);
        await updateSub(a.id,{expiresAt:past});assert.equal((await request('/v1/account',{key})).status,402);assert.equal((await request('/whatsapp/connect',{session:alice,method:'POST'})).status,402);assert.equal((await request('/integrations/overview',{session:alice})).status,200);
        await updateSub(a.id,{messageLimit:5});await request('/whatsapp/connect',{session:alice,method:'POST'});
        assert.equal((await request('/v1/account',{key})).data.subscription.used,3);
        const uncertain={...message,text:'SIMULATE_UNCERTAIN'};assert.equal((await request('/v1/messages',{key,method:'POST',body:uncertain,idem:'uncertain-send-001'})).status,502);const count=sent.length;
        assert.equal((await request('/v1/messages',{key,method:'POST',body:uncertain,idem:'uncertain-send-001'})).status,409);assert.equal(sent.length,count);
        await request('/admin/stores/'+a.id,{session:admin,method:'PATCH',body:{active:false}});assert.equal((await request('/v1/account',{key})).status,401);assert.equal((await request('/integrations/overview',{session:alice})).status,401);
        await request('/admin/stores/'+a.id,{session:admin,method:'PATCH',body:{active:true}});
        const aliceAgain=await login('a@example.com');assert.equal((await request('/integrations/keys/'+ka.data.id,{session:aliceAgain,method:'DELETE'})).status,200);assert.equal((await request('/v1/account',{key})).status,401);
        console.log('PASS: tenant API keys hashed/revoked, scopes, CSRF/CORS, per-company connection, quota races, idempotency, uncertain delivery, monthly expiry, renewal and suspension.');
        // Atomic checkout: total from server prices, all-or-nothing stock and one receipt per request.
        const product=async(nome,estoque,preco=10.10)=>{const r=await request('/produtos',{session:aliceAgain,method:'POST',body:{nome,estoque,preco}});assert.equal(r.status,200);return r.data.id;};
        const p1=await product('Cabo',3),p2=await product('Película',0);
        const sale=(requestId,itens)=>request('/vendas',{session:aliceAgain,method:'POST',body:{requestId,itens,pagamento:'PIX',total:0.01}});
        assert.equal((await sale('rollback-sale-0001',[{id:p1,quantidade:1},{id:p2,quantidade:1}])).status,409);
        assert.equal((await request('/produtos',{session:aliceAgain})).data.find(p=>p.id===p1).estoque,3);
        assert.equal((await request('/os',{session:aliceAgain})).data.length,0);
        await request('/caixa/abrir',{session:aliceAgain,method:'POST',body:{valorInicial:0}});
        const cart=[{id:p1,quantidade:1,preco:0.01}],first=await sale('confirmed-sale-0001',cart);assert.equal(first.status,201);assert.equal(first.data.total,10.10);assert.equal(first.data.caixaRegistrado,true);
        assert.equal((await sale('confirmed-sale-0001',cart)).status,200);assert.equal((await sale('confirmed-sale-0001',[{id:p1,quantidade:2}])).status,409);
        assert.equal((await request('/caixa/extrato',{session:aliceAgain})).data.filter(m=>m.tipo==='VENDA').length,1);
        const race=await Promise.all([sale('race-sale-0000001',[{id:p1,quantidade:2}]),sale('race-sale-0000002',[{id:p1,quantidade:2}])]);assert.deepEqual(race.map(r=>r.status).sort(),[201,409]);
        assert.equal((await request('/produtos',{session:aliceAgain})).data[0].estoque,0);assert.equal((await request('/os',{session:bob})).data.length,0);
        console.log('PASS: checkout rollback, authoritative prices, cash ledger, replay protection and concurrent stock isolation.');
        await stop();await start();
        assert.equal((await request('/v1/account',{key:keyB})).data.subscription.used,1);
        const before=sent.length;assert.equal((await request('/v1/messages',{key:keyB,method:'POST',body:message,idem:'first-send-001'})).status,200);assert.equal(sent.length,before);
        const rate=await Promise.all(Array.from({length:61},()=>request('/v1/whatsapp/status',{key:keyB})));assert(rate.some(r=>r.status===429));assert(rate.find(r=>r.status===429).headers.has('retry-after'));
        console.log('PASS: persistent keys/usage/idempotency after restart and per-company API rate limiting.');
    }finally{
        if(server)await new Promise(r=>server.close(r));if(service)await service.close();
        const absolute=path.resolve(temporary);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(absolute).startsWith('whatsapp-commercial-'))throw Error('Unsafe cleanup');await fs.rm(absolute,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
