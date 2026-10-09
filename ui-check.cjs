const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const puppeteer = require('puppeteer');
const vm = require('vm');
const apiConfig = fs.readFileSync(path.join(__dirname,'api-config.js'),'utf8');
for (const [address,expected] of [
    ['http://127.0.0.1:5500/whatsapp-api/index.html','http://127.0.0.1:3000'],
    ['http://localhost:5501/index.html','http://localhost:3000'],
    ['http://192.168.1.10:5500/index.html','http://192.168.1.10:3000'],
    ['http://localhost:3000/','http://localhost:3000'],
    ['https://loja.example/','https://loja.example'],
    ['file:///C:/app/index.html','http://localhost:3000']
]) {
    const context={window:{location:{href:address}},URL};
    vm.runInNewContext(apiConfig,context);
    assert.equal(context.window.BRUCE_API_URL,expected);
}
const order = {id:1,numeroOS:1001,clienteNome:'CLIENTE TESTE',aparelho:'IPHONE',status:'EM ANÁLISE',itens:[],valor:'120.00',dataAbertura:'09/10/2026, 10:00',pagamento:'PIX'};
const createQRImage = require('./whatsapp-qr');
const fixtures = {'/auth/me':{user:{id:'test',email:'owner@example.com',role:'owner',store:{id:'test',name:'Loja de teste'}},csrf:'mock-csrf'},'/whatsapp/connect':{success:true},'/clientes':[], '/os':[order], '/produtos':[], '/faturamento':{hoje:'120.00',semana:'240.00',mes:'900.00'},'/whatsapp/status':{status:'AGUARDANDO_LEITURA',qr:'simulated-whatsapp-session',qrImage:createQRImage('simulated-whatsapp-session')},'/caixa/status':{aberto:false},'/caixa/extrato':[]};
const server = http.createServer((req,res) => {
    if (fixtures[req.url]) {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(fixtures[req.url]));return;}
    const pathname = new URL(req.url,'http://localhost').pathname;
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!['index.html','style.css','dashboard.css','oficina.css','dashboard.js','api-config.js','auth-client.js','account.css','publicidade.json'].includes(file)) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(__dirname,file)));
});
(async()=>{
    let browser;
    try {
        await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
        browser=await puppeteer.launch({headless:true});
        const page=await browser.newPage();const errors=[];
        page.on('pageerror',err=>errors.push(err.message));
        await page.setRequestInterception(true);
        page.on('request',req=>req.url().includes('cdnjs.cloudflare.com')?req.respond({status:200,contentType:'text/javascript',body:'window.QRCode=function(){};'}):req.continue());
        await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'networkidle0'});
        await page.waitForFunction(()=>document.getElementById('fatHoje').textContent.includes('120'));
        await page.evaluate(()=>abrirModalQR());
        await page.waitForFunction(()=>{const img=document.querySelector('#qrcode-container img');return img && img.complete && img.naturalWidth>0;});
        await page.evaluate(()=>fecharModal('modalQR'));
        for(const width of [375,768,1024,1440]){
            await page.setViewport({width,height:900});
            assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);
            for(const tab of ['os','pdv','caixa','relatorios','zap']){
                await page.evaluate(tab=>mudarAba(tab),tab);
                assert(await page.$eval(`#aba-${tab}`,el=>el.classList.contains('ativo')));
            }
        }
        await page.evaluate(()=>mudarAba('os'));
        await page.setViewport({width:1440,height:1000});
        await page.waitForSelector('.print-menu summary');
        await page.click('.print-menu summary');
        assert(await page.$eval('.print-menu',el=>el.open));
        await page.keyboard.press('Escape');
        assert(await page.$eval('.print-menu',el=>!el.open));
        assert(await page.evaluate(()=>{const select=document.querySelector('.order-actions select').getBoundingClientRect();const print=document.querySelector('.print-menu summary').getBoundingClientRect();return Math.abs(select.top-print.top)<3;}));
        await page.setViewport({width:375,height:900});
        assert.equal(await page.$eval('#tabelaOS tr',el=>getComputedStyle(el).display),'grid');
        await page.setViewport({width:1440,height:1000});
        assert(await page.$eval('#orderEditor',el=>el.hidden));
        await page.click('#primaryAction');
        assert(await page.$eval('#orderEditor',el=>!el.hidden));
        assert.equal(await page.evaluate(()=>document.activeElement.id),'selectCliente');
        await page.click('#orderEditor .editor-close');
        await page.click('#newCustomer');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'nome');
        await page.click('#customerEditor .editor-close');
        assert(await page.$eval('#sponsorSlot',el=>el.hidden));
        await page.evaluate(()=>renderizarPublicidade({enabled:true,sponsor:'Parceiro de teste',title:'Oferta de teste',description:'Anúncio simulado',url:'javascript:alert(1)'}));
        assert(await page.$eval('#sponsorSlot',el=>el.hidden));
        await page.evaluate(()=>renderizarPublicidade({enabled:true,sponsor:'Parceiro de teste',title:'Oferta de teste',description:'Anúncio simulado',url:'https://example.com'}));
        assert(await page.$eval('#sponsorSlot',el=>!el.hidden));
        await page.evaluate(()=>renderizarPublicidade({enabled:false}));
        await page.click('.summary-chip[data-filter="0"]');
        assert((await page.$eval('#tabelaOS',el=>el.textContent)).includes('CLIENTE TESTE'));
        await page.click('.summary-chip[data-filter="1"]');
        assert((await page.$eval('#tabelaOS',el=>el.textContent)).includes('Nenhuma OS'));
        await page.evaluate(()=>{mudarAba('pdv');abrirModalProduto();});
        await page.waitForFunction(()=>document.activeElement.getAttribute('role')==='dialog');
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'prodNome');
        await page.keyboard.press('Escape');
        assert.equal(await page.$eval('#modalProduto',el=>el.style.display),'none');
        await page.evaluate(()=>alternarTema());
        assert(await page.$eval('body',el=>el.classList.contains('dark-mode')));
        await page.setViewport({width:1440,height:1000});
        await page.evaluate(()=>{alternarTema();mudarAba('os');document.getElementById('filtroStatus').value='todas_ativas';filtrarOS();document.activeElement.blur();window.scrollTo(0,0);});
        await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
        await page.screenshot({path:path.join(__dirname,'preview-desktop.png'),fullPage:true});
        await page.setViewport({width:375,height:900});
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:path.join(__dirname,'preview-mobile.png'),fullPage:true});
        await page.setOfflineMode(true);
        await page.click('#refreshData');
        await page.waitForFunction(()=>!document.getElementById('connectionNotice').hidden);
        assert.deepEqual(errors,[]);
        console.log('PASS: 4 viewports, 5 tabs, status filters, modal keyboard, themes, API failure; no JavaScript errors.');
    } finally {if(browser)await browser.close();server.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
