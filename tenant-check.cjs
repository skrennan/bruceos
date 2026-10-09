const assert=require('assert/strict');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const {EventEmitter}=require('events');
const {createApp}=require('./server');
const {openStore,run,close}=require('./database');

(async()=>{
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'bruce-tenants-'));
    const legacy=path.join(temporary,'legacy.db');
    const oldDb=await openStore(legacy);
    await run(oldDb,'INSERT INTO clientes(nome,telefone,aparelho) VALUES(?,?,?)',['LEGACY CLIENT','11999999999','LEGACY PHONE']);await close(oldDb);
    const clients=new Map();const sent=[];
    class FakeClient extends EventEmitter{
        constructor(options){super();this.options=options;this.initializations=0;this.destroyed=0;this.loggedOut=0;clients.set(options.storeId,this);}
        async initialize(){this.initializations++;this.emit('qr','qr-'+this.options.storeId);}
        async getNumberId(id){return {_serialized:id};}
        async sendMessage(id,message){sent.push({storeId:this.options.storeId,id,message});}
        async logout(){this.loggedOut++;}
        async destroy(){this.destroyed++;}
    }
    let service,server;
    const password='A-long-test-password!';
    try{
        service=await createApp({dataDir:path.join(temporary,'data'),legacyDbPath:legacy,clientFactory:options=>new FakeClient(options)});
        await service.accounts.createStore({name:'Legacy Store',email:'admin@example.com',password,initial:true});
        await assert.rejects(()=>service.accounts.createStore({name:'Again',email:'other@example.com',password,initial:true}));
        server=service.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
        const base='http://127.0.0.1:'+server.address().port;
        async function request(route,{session,method='GET',body,csrf=true,origin}={}){
            const headers={};if(session){headers.Cookie=session.cookie;if(csrf)headers['X-CSRF-Token']=session.csrf;}if(body!==undefined)headers['Content-Type']='application/json';if(origin)headers.Origin=origin;
            const response=await fetch(base+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
            const data=await response.json().catch(()=>null);return {status:response.status,data,headers:response.headers};
        }
        async function login(email){const result=await request('/auth/login',{method:'POST',body:{email,password}});assert.equal(result.status,200);assert.match(result.headers.get('set-cookie'),/HttpOnly/i);const session={cookie:result.headers.get('set-cookie').split(';')[0]};const me=await request('/auth/me',{session});session.csrf=me.data.csrf;session.user=me.data.user;return session;}
        for(const route of ['/clientes','/produtos','/os','/caixa/status','/caixa/extrato','/faturamento','/whatsapp/status','/admin/stores'])assert.equal((await request(route)).status,401,route+' exposed');
        assert.equal((await request('/auth/login',{method:'POST',origin:'https://evil.example',body:{email:'admin@example.com',password}})).status,403);
        const admin=await login('admin@example.com');
        const preserved=await request('/clientes',{session:admin});assert.equal(preserved.data[0].nome,'LEGACY CLIENT');
        assert.equal((await request('/admin/stores',{session:admin,method:'POST',csrf:false,body:{name:'Unsafe',email:'unsafe@example.com',password}})).status,403);
        const a=await request('/admin/stores',{session:admin,method:'POST',body:{name:'Loja A',email:'a@example.com',password}});
        const b=await request('/admin/stores',{session:admin,method:'POST',body:{name:'Loja B',email:'b@example.com',password}});assert.equal(a.status,201);assert.equal(b.status,201);
        const alice=await login('a@example.com'),bob=await login('b@example.com');
        assert.equal((await request('/admin/stores',{session:bob})).status,403);
        const cors=await request('/auth/me',{session:alice,origin:'http://localhost:5500'});assert.equal(cors.headers.get('access-control-allow-origin'),'http://localhost:5500');assert.equal(cors.headers.get('access-control-allow-credentials'),'true');
        assert.deepEqual((await request('/clientes',{session:alice})).data,[]);
        async function addCustomer(session,nome){return request('/clientes',{session,method:'POST',body:{nome,telefone:'11999999999',aparelho:'PHONE'}});}
        await Promise.all([addCustomer(alice,'ALICE'),addCustomer(bob,'BOB')]);
        const extra=await addCustomer(alice,'ALICE PRIVATE');
        assert.equal((await request('/clientes/'+extra.data.id,{session:bob,method:'PUT',body:{nome:'ATTACK',telefone:'11999999999',aparelho:'X'}})).status,404);
        assert.equal((await request('/clientes',{session:bob})).data[0].nome,'BOB');
        const productBody={nome:'CASE',preco:10,estoque:5};
        const pa=await request('/produtos',{session:alice,method:'POST',body:productBody});await request('/produtos',{session:bob,method:'POST',body:{...productBody,nome:'BOB CASE'}});
        await request('/produtos/'+pa.data.id+'/estoque',{session:alice,method:'PUT',body:{adicionarEstoque:2}});
        assert.equal((await request('/produtos',{session:bob})).data[0].estoque,5);
        const foreign=await request('/os',{session:bob,method:'POST',body:{clienteId:extra.data.id,itens:[{descricao:'SERVICE',valor:20}]}});assert.equal(foreign.status,404);
        const osa=await request('/os',{session:alice,method:'POST',body:{clienteId:1,itens:[{descricao:'SERVICE A',valor:20}]}});
        const osb=await request('/os',{session:bob,method:'POST',body:{clienteId:1,itens:[{descricao:'SERVICE B',valor:30}]}});assert.equal(osa.data.numeroOS,1001);assert.equal(osb.data.numeroOS,1001);
        await request('/os/1/status',{session:alice,method:'PUT',body:{status:'PRONTO',pagamento:'PIX'}});
        assert.equal((await request('/os',{session:bob})).data[0].status,'EM ANÁLISE');
        assert.equal((await request('/faturamento',{session:bob})).data.hoje,'0.00');
        await request('/caixa/abrir',{session:alice,method:'POST',body:{valorInicial:100}});assert.equal((await request('/caixa/status',{session:bob})).data.aberto,false);
        assert.equal((await request('/caixa/extrato',{session:bob})).data.length,0);
        await request('/whatsapp/connect',{session:alice,method:'POST'});await request('/whatsapp/connect',{session:alice,method:'POST'});
        assert.equal(clients.get(alice.user.store.id).initializations,1);
        const qrA=await request('/whatsapp/status',{session:alice});assert.match(qrA.data.qr,/qr-/);assert.equal((await request('/whatsapp/status',{session:bob})).data.qr,'');
        await request('/whatsapp/connect',{session:bob,method:'POST'});
        assert.notEqual(clients.get(alice.user.store.id).options.clientId,clients.get(bob.user.store.id).options.clientId);
        assert.notEqual((await request('/whatsapp/status',{session:bob})).data.qr,qrA.data.qr);
        clients.get(alice.user.store.id).emit('ready');clients.get(bob.user.store.id).emit('ready');
        await request('/enviar-mensagem',{session:alice,method:'POST',body:{telefone:'11999999999',mensagem:'Only Alice'}});assert.equal(sent.at(-1).storeId,alice.user.store.id);
        const oldAlice=clients.get(alice.user.store.id);
        await request('/whatsapp/disconnect',{session:alice,method:'POST'});assert.equal(oldAlice.loggedOut,1);assert.equal((await request('/whatsapp/status',{session:bob})).data.status,'CONECTADO');
        oldAlice.emit('qr','stale');assert.equal((await request('/whatsapp/status',{session:alice})).data.qr,'');
        await request('/admin/stores/'+b.data.store.id,{session:admin,method:'PATCH',body:{active:false}});assert.equal((await request('/clientes',{session:bob})).status,401);assert.equal(service.whatsapp.state(bob.user.store.id).status,'DESCONECTADO');
        assert.equal((await request('/auth/login',{method:'POST',body:{email:'b@example.com',password}})).status,401);
        await request('/admin/stores/'+b.data.store.id,{session:admin,method:'PATCH',body:{active:true}});
        const bobAgain=await login('b@example.com');assert.equal((await request('/clientes',{session:bobAgain})).data[0].nome,'BOB');
        assert.equal((await request('/auth/password',{session:alice,method:'POST',body:{currentPassword:'wrong',password:'New-long-test-password'}})).status,400);
        await request('/auth/logout',{session:alice,method:'POST'});assert.equal((await request('/clientes',{session:alice})).status,401);
        const newAlice=await login('a@example.com');await request('/auth/password',{session:newAlice,method:'POST',body:{currentPassword:password,password:'New-long-test-password'}});assert.equal((await request('/clientes',{session:newAlice})).status,401);
        assert.equal((await request('/brucecell.db',{session:admin})).status,404);
        console.log('PASS: preserved legacy data; independent stores, IDs, OS, stock, cash and revenue; cookie login, CSRF, CORS, admin permissions, suspension, password/logout revocation; isolated WhatsApp QR/send/disconnect and stale events.');
    }finally{
        if(server)await new Promise(resolve=>server.close(resolve));if(service)await service.close();
        const absolute=path.resolve(temporary);const parent=path.resolve(os.tmpdir())+path.sep;
        if(!absolute.startsWith(parent)||!path.basename(absolute).startsWith('bruce-tenants-'))throw Error('Unsafe cleanup path');
        await fs.rm(absolute,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
