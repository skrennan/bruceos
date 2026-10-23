const assert=require('assert/strict');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const puppeteer=require('puppeteer');
const {EventEmitter}=require('events');
const {createApp}=require('./server');

(async()=>{
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'whatsapp-commercial-ui-'));
    let service,server,browser;const password='Commercial-ui-test-password';
    try{
        class FakeClient extends EventEmitter{async initialize(){this.emit('ready');}async logout(){}async destroy(){}}
        service=await createApp({dataDir:path.join(temporary,'data'),legacyDbPath:path.join(temporary,'legacy.db'),clientFactory:()=>new FakeClient()});
        await service.accounts.createStore({name:'Administração de teste',email:'admin@example.com',password,initial:true});
        const company=await service.accounts.createStore({name:'Empresa de teste A',email:'a@example.com',password});
        await service.accounts.createStore({name:'Empresa de teste B',email:'b@example.com',password});
        await service.accounts.commerce.setSubscription(company.id,{plan:'Profissional (teste)',monthlyPriceCents:19990,messageLimit:1500,expiresAt:new Date(Date.now()+30*86400000).toISOString(),billingStatus:'active'});
        service.whatsapp.connect(company.id);
        server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
        browser=await puppeteer.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
        async function login(email){await page.goto(base+'/login.html');await page.type('#email',email);await page.type('#password',password);await Promise.all([page.waitForNavigation({waitUntil:'networkidle0'}),page.click('#loginButton')]);}
        await login('admin@example.com');await page.goto(base+'/admin.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.getElementById('totalCompanies').textContent==='2');
        await page.type('#companySearch','sem resultado');assert.equal(await page.$eval('#storeList',el=>el.children.length),1);assert(await page.$eval('#storeList',el=>el.textContent.includes('Nenhuma empresa')));
        await page.$eval('#companySearch',el=>{el.value='';el.dispatchEvent(new Event('input'));});
        await page.click('.company-list details summary');await page.waitForSelector('details[open] .subscription-form');
        const edit=await page.evaluate(async()=>{const form=document.querySelector('.company-list details[open] form');form.querySelector('[name=plan]').value='Plano editado';form.querySelector('[name=price]').value='249.90';form.requestSubmit();return true;});assert(edit);
        await page.waitForFunction(()=>document.getElementById('storeList').textContent.includes('Plano editado'));
        assert(await page.$eval('#monthlyRevenue',el=>el.textContent.includes('249,90')));
        await page.select('#companyFilter','expired');assert(await page.$eval('#storeList',el=>el.textContent.includes('Nenhuma empresa')));await page.select('#companyFilter','all');
        const captures=path.join(__dirname,'previews');await fs.mkdir(captures,{recursive:true});
        async function screenshot(name,width,height){await page.setViewport({width,height});await page.evaluate(()=>window.scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow: '+name);await page.screenshot({path:path.join(captures,name+'.png'),fullPage:true});}
        await screenshot('admin-desktop',1440,1000);await screenshot('admin-mobile',390,844);await screenshot('admin-small',375,812);
        await page.goto(base+'/index.html');await page.evaluate(async()=>fetch(window.BRUCE_API_URL+'/auth/logout',{method:'POST'}));
        await login('a@example.com');await page.goto(base+'/integrations.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>document.getElementById('planName').textContent==='Plano editado');
        assert(await page.$eval('#keyList',el=>el.textContent.includes('Nenhuma integração')));assert(!await page.$('a[href="admin.html"]'));
        await page.type('#keyName','ERP de teste');await page.click('#keyForm button');await page.waitForFunction(()=>!document.getElementById('secretBox').hidden);
        assert(await page.$eval('#newSecret',el=>/^wa_live_[a-f0-9]{64}$/.test(el.value)));
        await page.click('#dismissSecret');assert.equal(await page.$eval('#newSecret',el=>el.value),'');
        assert(await page.$eval('#keyList',el=>el.textContent.includes('ERP de teste')));
        assert.equal(await page.$eval('#apiExample',el=>el.textContent.includes('\n+')),false);
        assert.equal(await page.$eval('#messageList',el=>el.textContent.includes('Conecte o WhatsApp')),false);
        await screenshot('portal-desktop',1440,1000);await screenshot('portal-mobile',390,844);await screenshot('portal-small',375,812);await screenshot('portal-landscape',844,390);
        await page.click('#keyList button');await page.waitForFunction(()=>document.getElementById('keyList').textContent.includes('Revogada'));
        await page.evaluate(()=>{document.querySelector('.api-guide details').open=true;});assert(await page.$eval('.endpoint-list',el=>el.textContent.includes('/v1/messages')));
        const productId=await page.evaluate(async()=>{const r=await fetch(window.BRUCE_API_URL+'/produtos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nome:'Produto de teste PDV',preco:12.50,estoque:2})});return (await r.json()).id;});
        await page.goto(base+'/index.html#pdv',{waitUntil:'networkidle0'});
        await page.waitForFunction(id=>produtosPDV.some(item=>item.id===id),{},productId);
        await page.evaluate(()=>{window.print=()=>{window.receiptPrinted=true;};});
        await page.select('#selectProdutoPDV',String(productId));await page.click('#finalizeSale');
        await page.waitForFunction(()=>window.receiptPrinted&&carrinhoPDV.length===0&&!document.getElementById('finalizeSale').disabled);
        assert.equal(await page.evaluate(async id=>{const products=await (await fetch(window.BRUCE_API_URL+'/produtos')).json();return products.find(p=>p.id===id).estoque;},productId),1);
        // A competitor can consume the last unit after this customer added it to the cart.
        await page.select('#selectProdutoPDV',String(productId));
        await page.evaluate(async id=>{window.receiptPrinted=false;await fetch(window.BRUCE_API_URL+'/produtos/'+id+'/estoque',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({adicionarEstoque:-1})});},productId);
        await page.click('#finalizeSale');await page.waitForFunction(()=>!document.getElementById('finalizeSale').disabled);
        assert.equal(await page.evaluate(()=>window.receiptPrinted),false);assert.equal(await page.evaluate(()=>carrinhoPDV.length),1);
        await page.goto(base+'/integrations.html',{waitUntil:'networkidle0'});
        await page.setRequestInterception(true);page.on('request',req=>req.url().endsWith('/integrations/overview')?req.respond({status:503,contentType:'application/json',body:'{"error":"Serviço indisponível. Tente atualizar."}'}):req.continue());
        await page.click('#refreshOverview');await page.waitForFunction(()=>document.getElementById('portalFeedback').textContent.includes('Serviço indisponível'));
        assert.equal(await page.$eval('#refreshOverview',el=>el.disabled),false);
        assert.deepEqual(errors,[]);console.log('PASS: administrator edits monthly plan, revenue/search/filters; owner creates and revokes API key, one-time secret, docs and retry feedback; checkout prints only on committed sale and keeps cart on stock conflict; 375/390/844/1440px without horizontal overflow; no browser script errors.');
    }finally{
        if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));if(service)await service.close();
        const absolute=path.resolve(temporary);if(!absolute.startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(absolute).startsWith('whatsapp-commercial-ui-'))throw Error('Unsafe cleanup');await fs.rm(absolute,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
