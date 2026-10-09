const assert=require('assert/strict');
const fs=require('fs/promises');
const os=require('os');
const path=require('path');
const puppeteer=require('puppeteer');
const {EventEmitter}=require('events');
const {createApp}=require('./server');

(async()=>{
    const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'bruce-auth-ui-'));
    let browser,service,server;
    try{
        class FakeClient extends EventEmitter{async initialize(){this.emit('qr','fake-session-for-ui');}async logout(){}async destroy(){}}
        service=await createApp({dataDir:path.join(temporary,'data'),legacyDbPath:path.join(temporary,'legacy.db'),clientFactory:()=>new FakeClient()});
        const password='Test-only-password-2026';
        await service.accounts.createStore({name:'Loja Administradora',email:'admin@example.com',password,initial:true});
        server=service.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
        const base='http://127.0.0.1:'+server.address().port;
        browser=await puppeteer.launch({headless:true});
        const makeContext=()=>browser.createBrowserContext?browser.createBrowserContext():browser.createIncognitoBrowserContext();
        const adminContext=await makeContext(),ownerContext=await makeContext();
        const admin=await adminContext.newPage(),owner=await ownerContext.newPage();
        const errors=[];for(const page of [admin,owner]){page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());}
        await owner.goto(base,{waitUntil:'domcontentloaded'});
        await owner.waitForFunction(()=>location.pathname.endsWith('/login.html'));
        console.log('Verified unauthenticated redirect.');
        assert(owner.url().endsWith('/login.html'));
        async function signIn(page,email){await page.goto(base+'/login.html');await page.type('#email',email);await page.type('#password',password);await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.click('#loginButton')]);await page.waitForFunction(()=>!document.documentElement.classList.contains('auth-pending'));}
        await signIn(admin,'admin@example.com');
        console.log('Verified administrator login.');
        assert(await admin.$eval('.brand',el=>el.textContent.includes('Loja Administradora')));
        await admin.goto(base+'/admin.html',{waitUntil:'networkidle0'});
        await admin.type('#storeName','Loja Compradora');await admin.type('#storeEmail','owner@example.com');await admin.type('#storePassword',password);await admin.click('#storeForm button');
        await admin.waitForFunction(()=>document.getElementById('storeList').textContent.includes('Loja Compradora'));
        console.log('Verified store creation.');
        await signIn(owner,'owner@example.com');
        console.log('Verified store-owner login.');
        assert(await owner.$eval('.brand',el=>el.textContent.includes('Loja Compradora')));
        assert(!await owner.$('a[href="admin.html"]'));
        await owner.click('#newCustomer');
        await owner.type('#nome','<img src=x onerror="window.injected=true">');await owner.type('#telefone','11999999999');await owner.type('#aparelho','TEST PHONE');await owner.click('#btnSalvarCliente');
        await owner.waitForFunction(()=>document.getElementById('selectCliente').options.length===2);
        assert.equal(await owner.evaluate(()=>!!window.injected),false);
        assert.equal(await owner.$eval('#selectCliente',el=>el.querySelectorAll('img').length),0);
        await owner.click('#customerEditor .editor-close');await owner.click('#primaryAction');await owner.select('#selectCliente','1');await owner.type('.item-desc','REPARO');await owner.type('.item-valor','25');await owner.click('#formOS button[type="submit"]');
        await owner.waitForFunction(()=>document.getElementById('tabelaOS').textContent.includes('TEST PHONE'));
        assert.equal(await owner.$eval('#tabelaOS',el=>el.querySelectorAll('img').length),0);
        await admin.goto(base+'/index.html',{waitUntil:'networkidle0'});
        assert((await admin.$eval('#tabelaOS',el=>el.textContent)).includes('Nenhuma OS'));
        await owner.evaluate(()=>abrirModalQR());await owner.waitForFunction(()=>document.querySelector('#qrcode-container img')?.naturalWidth>0);
        assert.equal(service.whatsapp.state('legacy').qr,'');
        await owner.keyboard.press('Escape');
        const logout=await owner.$('button.account-link');await logout.click();await owner.waitForFunction(()=>location.pathname.endsWith('/login.html'));assert(owner.url().endsWith('/login.html'));
        await owner.goto(base+'/index.html',{waitUntil:'domcontentloaded'});await owner.waitForFunction(()=>location.pathname.endsWith('/login.html'));assert(owner.url().endsWith('/login.html'));
        assert.deepEqual(errors,[]);
        await owner.screenshot({path:path.join(__dirname,'preview-login.png'),fullPage:true});
        console.log('PASS: real login redirects/cookies, admin creates store, owner login/branding, isolated UI records, escaped stored HTML, per-store QR, logout; no browser script errors.');
    }finally{
        if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));if(service)await service.close();
        const absolute=path.resolve(temporary),parent=path.resolve(os.tmpdir())+path.sep;if(!absolute.startsWith(parent)||!path.basename(absolute).startsWith('bruce-auth-ui-'))throw Error('Unsafe cleanup path');await fs.rm(absolute,{recursive:true,force:true});
    }
})().catch(error=>{console.error(error);process.exitCode=1;});
