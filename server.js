const express=require('express');
const path=require('path');
const {createAccounts}=require('./accounts');
const {openStore,close}=require('./database');
const {createWhatsAppSessions}=require('./whatsapp-sessions');
const {installAuth}=require('./auth-routes');

async function createApp(options={}) {
    const app=express();
    app.disable('x-powered-by');
    if(process.env.TRUST_PROXY==='1')app.set('trust proxy',1);
    const dataDir=options.dataDir||process.env.DATA_DIR||path.join(__dirname,'data');
    const legacyDbPath=options.legacyDbPath||path.join(__dirname,'brucecell.db');
    const accounts=await createAccounts(path.join(dataDir,'accounts.sqlite'));
    const whatsapp=createWhatsAppSessions({authDir:path.join(dataDir,'whatsapp'),legacyAuthDir:path.join(__dirname,'.wwebjs_auth'),clientFactory:options.clientFactory});
    const databases=new Map();
    const writeQueues=new Map();
    app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'DENY'});next();});
    const publicAssets=['index.html','style.css','dashboard.css','oficina.css','dashboard.js','api-config.js','auth-client.js','login.html','login.js','account.css','admin.html','admin.js','account.html','account.js','publicidade.json'];
    const publicFile=(file)=>(req,res)=>{res.set('Cache-Control','no-store');res.sendFile(path.join(__dirname,file));};
    app.get('/',publicFile('index.html'));
    for(const asset of publicAssets)app.get('/'+asset,publicFile(asset));
    app.use(express.json({limit:'128kb'}));
    installAuth(app,{accounts,whatsapp,production:process.env.NODE_ENV==='production',allowedOrigins:(process.env.ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean)});
    app.use(async(req,res,next)=>{
        const storeId=req.user.storeId;
        if(!databases.has(storeId))databases.set(storeId,openStore(storeId==='legacy'?legacyDbPath:path.join(dataDir,'stores',storeId,'store.sqlite')));
        req.db=await databases.get(storeId);
        req.wa=whatsapp.state(storeId);
        // Serialize writes inside each store, including OS numbering and stock changes.
        if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
            const previous=writeQueues.get(storeId)||Promise.resolve();
            let release;const current=new Promise(resolve=>{release=resolve;});
            writeQueues.set(storeId,current);
            await previous;
            let done=false;const finish=()=>{if(done)return;done=true;release();if(writeQueues.get(storeId)===current)writeQueues.delete(storeId);};
            res.once('finish',finish);res.once('close',finish);
            if(res.destroyed){finish();return;}
        }
        next();
    });
    function obterDataAtual(){return new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});}
    const validText=(value,max=200)=>typeof value==='string' && value.trim().length>0 && value.length<=max;
    const validMoney=value=>['number','string'].includes(typeof value) && String(value).trim()!=='' && Number.isFinite(Number(value)) && Number(value)>=0 && Number(value)<=10000000;
    app.use((req,res,next)=>{
        const body=req.body||{};
        let valid=true;
        if((req.method==='POST'&&req.path==='/clientes')||(req.method==='PUT'&&/^\/clientes\/\d+$/.test(req.path)))valid=validText(body.nome)&&validText(body.telefone,30)&&validText(body.aparelho);
        if(req.method==='POST'&&req.path==='/produtos')valid=validText(body.nome)&&validMoney(body.preco)&&Number.isSafeInteger(Number(body.estoque))&&Number(body.estoque)>=0;
        if(req.method==='PUT'&&/^\/produtos\/\d+\/estoque$/.test(req.path))valid=Number.isSafeInteger(Number(body.adicionarEstoque))&&(body.preco===undefined||validMoney(body.preco));
        if(req.method==='POST'&&req.path==='/os')valid=Array.isArray(body.itens)&&body.itens.length>0&&body.itens.length<=100&&body.itens.every(item=>item&&validText(item.descricao,500)&&validMoney(item.valor))&&(!body.clienteId||(Number.isSafeInteger(Number(body.clienteId))&&Number(body.clienteId)>0));
        if(req.method==='PUT'&&/^\/os\/\d+\/status$/.test(req.path))valid=['EM ANÁLISE','EM REPARO','PRONTO','ENTREGUE'].includes(body.status)&&(!body.pagamento||validText(body.pagamento,100));
        if(req.method==='POST'&&req.path==='/caixa/abrir')valid=validMoney(body.valorInicial);
        if(req.method==='POST'&&req.path==='/caixa/movimentar')valid=['SUPRIMENTO','SANGRIA','VENDA'].includes(body.tipo)&&validMoney(body.valor)&&Number(body.valor)>0&&validText(body.descricao,500);
        if(req.method==='POST'&&req.path==='/caixa/fechar')valid=validMoney(body.valorFechamento);
        if(req.method==='POST'&&req.path==='/enviar-mensagem')valid=validText(body.telefone,30)&&validText(body.mensagem,10000);
        if(!valid)return res.status(400).json({success:false,error:'Confira os campos e os valores informados.'});
        next();
    });
// --- ROTAS DA API ---

app.get('/whatsapp/status', (req,res) => {const {status,qr,qrImage}=req.wa;res.json({status,qr,qrImage});});
app.post('/whatsapp/connect', (req,res) => {try {const {status}=whatsapp.connect(req.user.storeId);res.json({success:true,status});}catch(error){res.status(503).json({error:'Não foi possível iniciar a conexão desta loja.'});}});
app.post('/whatsapp/disconnect', async(req,res) => {await whatsapp.disconnect(req.user.storeId);res.json({success:true});});

app.get('/clientes', (req, res) => {
    req.db.all(`SELECT * FROM clientes`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/clientes', (req, res) => {
    const { nome, telefone, aparelho } = req.body;
    if (!nome || !telefone || !aparelho) {
        return res.status(400).json({ success: false, error: 'Preencha todos os campos do cliente.' });
    }

    const query = `INSERT INTO clientes (nome, telefone, aparelho) VALUES (?, ?, ?)`;
    req.db.run(query, [nome, telefone, aparelho], function(err) {
        if (err) {
            console.error('Erro ao cadastrar cliente:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/clientes/:id', (req, res) => {
    const { id } = req.params;
    const { nome, telefone, aparelho } = req.body;

    const query = `UPDATE clientes SET nome = ?, telefone = ?, aparelho = ? WHERE id = ?`;
    req.db.run(query, [nome, telefone, aparelho, id], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!this.changes) return res.status(404).json({error:'Cliente não encontrado nesta loja.'});
        res.json({ success: true });
    });
});

app.get('/produtos', (req, res) => {
    req.db.all(`SELECT * FROM produtos`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/produtos', (req, res) => {
    const { nome, preco, estoque, ncm } = req.body;
    if (!nome || preco === undefined || estoque === undefined) {
        return res.status(400).json({ success: false, error: 'Preencha os campos obrigatórios.' });
    }
    const query = `INSERT INTO produtos (nome, preco, estoque, ncm) VALUES (?, ?, ?, ?)`;
    req.db.run(query, [nome, preco, estoque, ncm || ''], function(err) {
        if (err) {
            console.error('Erro ao cadastrar produto:', err.message);
            return res.status(500).json({ success: false, error: err.message });
        }
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/produtos/:id/estoque', (req, res) => {
    const { id } = req.params;
    const { adicionarEstoque, ncm, preco } = req.body;

    req.db.get(`SELECT * FROM produtos WHERE id = ?`, [id], (err, prod) => {
        if (err || !prod) return res.status(404).json({ success: false, error: 'Produto não encontrado.' });

        const novoEstoque = prod.estoque + (parseInt(adicionarEstoque) || 0);
        if (novoEstoque < 0) return res.status(400).json({success:false,error:'Estoque insuficiente nesta loja.'});
        const novoNcm = ncm !== undefined ? ncm : prod.ncm;
        const novoPreco = preco !== undefined ? parseFloat(preco) : prod.preco;

        const updateQuery = `UPDATE produtos SET estoque = ?, ncm = ?, preco = ? WHERE id = ?`;
        req.db.run(updateQuery, [novoEstoque, novoNcm, novoPreco, id], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    });
});

app.get('/os', (req, res) => {
    req.db.all(`SELECT * FROM ordens_servico`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const osFormatadas = rows.map(os => ({
            ...os,
            itens: JSON.parse(os.itens)
        }));
        res.json(osFormatadas);
    });
});

app.post('/os', (req, res) => {
    const { clienteId, itens, pagamentoPDV } = req.body;
    if (!itens || !Array.isArray(itens) || itens.length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum item informado.' });
    }

    let clienteNome = req.body.clienteNome || "BALCÃO / ACESSÓRIOS";
    let telefone = req.body.telefone || "";
    let aparelho = req.body.aparelho || "VENDA DE ACESSÓRIOS";
    let formaPagamento = pagamentoPDV || 'NÃO DEFINIDO';
    let statusInicial = clienteId ? 'EM ANÁLISE' : 'PRONTO';

    const calcularESalvarOS = () => {
        let valorTotal = itens.reduce((acc, item) => acc + parseFloat(item.valor), 0);
        const itensJson = JSON.stringify(itens);
        const dataAbertura = obterDataAtual();

        req.db.get(`SELECT MAX(numeroOS) as maxNum FROM ordens_servico`, [], (err, row) => {
            const numeroOS = (row && row.maxNum) ? row.maxNum + 1 : 1001;

            const insertQuery = `INSERT INTO ordens_servico (numeroOS, clienteId, clienteNome, telefone, aparelho, itens, valor, status, pagamento, dataAbertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            req.db.run(insertQuery, [numeroOS, clienteId || null, clienteNome, telefone, aparelho, itensJson, valorTotal.toFixed(2), statusInicial, formaPagamento, dataAbertura], function(err) {
                if (err) {
                    console.error('Erro ao inserir OS no banco:', err.message);
                    return res.status(500).json({ success: false, error: err.message });
                }

                res.json({ success: true, numeroOS });

                if (telefone && telefone.length >= 8 && req.wa.status === 'CONECTADO' && clienteId) {
                    let itensTexto = itens.map(i => `• ${i.descricao}: R$ ${i.valor}`).join('\n');
                    let mensagem = `*${req.user.name}*\n\nOlá *${clienteNome}*, sua Ordem de Serviço *#${numeroOS}* foi aberta!\n\n*Aparelho:* ${aparelho}\n*Itens/Serviços:*\n${itensTexto}\n\n*TOTAL: R$ ${valorTotal.toFixed(2)}*\n\nAcompanhe o andamento conosco!`;
                    
                    whatsapp.send(req.user.storeId, telefone, mensagem).catch(e => console.log('Erro WhatsApp OS (Background):', e.message));
                }
            });
        });
    };

    if (clienteId) {
        req.db.get(`SELECT * FROM clientes WHERE id = ?`, [clienteId], (err, cliente) => {
            if (err || !cliente) return res.status(404).json({error:"Cliente não encontrado nesta loja."});
            if (cliente) {
                clienteNome = cliente.nome;
                telefone = cliente.telefone;
                aparelho = cliente.aparelho;
            }
            calcularESalvarOS();
        });
    } else {
        calcularESalvarOS();
    }
});

app.put('/os/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, pagamento } = req.body;

    let query = `UPDATE ordens_servico SET status = ?`;
    let params = [status];

    if (pagamento) {
        query += `, pagamento = ?`;
        params.push(pagamento);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    req.db.run(query, params, function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });

        if (!this.changes) return res.status(404).json({error:'Ordem não encontrada.'});
        if (status === 'PRONTO' && req.wa.status === 'CONECTADO') {
            req.db.get(`SELECT * FROM ordens_servico WHERE id = ?`, [id], (err, os) => {
                if (os && os.telefone) {
                    let mensagem = `*${req.user.name}*\n\nOlá *${os.clienteNome}*, seu *${os.aparelho}* está *PRONTO*! 🚀\n\n*Valor Total:* R$ ${os.valor}\n*Forma de Pagto:* ${os.pagamento || 'NÃO DEFINIDO'}\n\nPode vir retirar na loja!`;
                    whatsapp.send(req.user.storeId, os.telefone, mensagem).catch(e => console.log('Erro WhatsApp:', e.message));
                }
            });
        }

        res.json({ success: true });
    });
});

// --- ROTAS DE FLUXO DE CAIXA ---

app.get('/caixa/status', (req, res) => {
    req.db.get(`SELECT * FROM caixa_movimentos WHERE tipo = 'ABERTURA' ORDER BY id DESC LIMIT 1`, [], (err, abertura) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!abertura) {
            return res.json({ aberto: false, saldoInicial: 0 });
        }

        req.db.get(`SELECT * FROM caixa_movimentos WHERE tipo = 'FECHAMENTO' AND id > ? ORDER BY id DESC LIMIT 1`, [abertura.id], (err, fechamento) => {
            if (err) return res.status(500).json({ error: err.message });

            if (fechamento) {
                res.json({ aberto: false, saldoInicial: 0 });
            } else {
                req.db.all(`SELECT tipo, valor FROM caixa_movimentos WHERE id >= ?`, [abertura.id], (err, movimentos) => {
                    if (err) return res.status(500).json({ error: err.message });

                    let saldoCalculado = 0;
                    movimentos.forEach(m => {
                        if (m.tipo === 'ABERTURA' || m.tipo === 'SUPRIMENTO' || m.tipo === 'VENDA') {
                            saldoCalculado += m.valor;
                        } else if (m.tipo === 'SANGRIA') {
                            saldoCalculado -= m.valor;
                        }
                    });

                    res.json({
                        aberto: true,
                        aberturaId: abertura.id,
                        dataAbertura: abertura.dataHora,
                        saldoInicial: abertura.valor,
                        saldoAtual: saldoCalculado.toFixed(2)
                    });
                });
            }
        });
    });
});

app.post('/caixa/abrir', (req, res) => {
    const { valorInicial } = req.body;
    if (valorInicial === undefined) {
        return res.status(400).json({ success: false, error: 'Informe o valor inicial do caixa.' });
    }

    const dataHora = obterDataAtual();
    const query = `INSERT INTO caixa_movimentos (tipo, valor, descricao, dataHora) VALUES ('ABERTURA', ?, 'Abertura de Caixa', ?)`;
    
    req.db.run(query, [parseFloat(valorInicial), dataHora], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.post('/caixa/movimentar', (req, res) => {
    const { tipo, valor, descricao } = req.body;
    if (!tipo || !valor || !descricao) {
        return res.status(400).json({ success: false, error: 'Preencha todos os campos da movimentação.' });
    }

    const dataHora = obterDataAtual();
    const query = `INSERT INTO caixa_movimentos (tipo, valor, descricao, dataHora) VALUES (?, ?, ?, ?)`;

    req.db.run(query, [tipo.toUpperCase(), parseFloat(valor), descricao.toUpperCase(), dataHora], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.post('/caixa/fechar', (req, res) => {
    const { valorFechamento, observacao } = req.body;
    const dataHora = obterDataAtual();

    const query = `INSERT INTO caixa_movimentos (tipo, valor, descricao, dataHora) VALUES ('FECHAMENTO', ?, ?, ?)`;
    req.db.run(query, [parseFloat(valorFechamento) || 0, `FECHAMENTO: ${observacao || 'NENHUMA'}`, dataHora], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.get('/caixa/extrato', (req, res) => {
    req.db.get(`SELECT * FROM caixa_movimentos WHERE tipo = 'ABERTURA' ORDER BY id DESC LIMIT 1`, [], (err, abertura) => {
        if (err || !abertura) return res.json([]);

        req.db.all(`SELECT * FROM caixa_movimentos WHERE id >= ? ORDER BY id DESC`, [abertura.id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });
});

app.post('/enviar-mensagem', async (req, res) => {
    const { telefone, mensagem } = req.body;
    if (!telefone || !mensagem) {
        return res.status(400).json({ success: false, error: 'Informe o telefone e a mensagem.' });
    }

    try {
        await whatsapp.send(req.user.storeId, telefone, mensagem);
        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao enviar mensagem livre:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/faturamento', (req, res) => {
    req.db.all(`SELECT valor, dataAbertura FROM ordens_servico WHERE status IN ('PRONTO', 'ENTREGUE')`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        let hojeTotal = 0;
        let semanaTotal = 0;
        let mesTotal = 0;

        const agora = new Date();
        const diaAtual = agora.getDate();
        const mesAtual = agora.getMonth();
        const anoAtual = agora.getFullYear();

        rows.forEach(row => {
            if (!row.dataAbertura) return;
            const partesDataHora = row.dataAbertura.split(',');
            const partesData = partesDataHora[0].trim().split('/');
            
            if (partesData.length === 3) {
                const d = parseInt(partesData[0]);
                const m = parseInt(partesData[1]) - 1;
                const a = parseInt(partesData[2]);
                const val = parseFloat(row.valor) || 0;

                if (m === mesAtual && a === anoAtual) {
                    mesTotal += val;
                    if (d === diaAtual) hojeTotal += val;
                    if (d >= diaAtual - 7 && d <= diaAtual) semanaTotal += val;
                }
            }
        });

        res.json({
            hoje: hojeTotal.toFixed(2),
            semana: semanaTotal.toFixed(2),
            mes: mesTotal.toFixed(2)
        });
    });
});


    app.use((error,req,res,next)=>{console.error('Falha na API:',error.message);if(!res.headersSent)res.status(error.status||500).json({error:'Não foi possível concluir a operação.'});});
    return {app,accounts,whatsapp,async close(){await whatsapp.close();await Promise.all([...databases.values()].map(async value=>close(await value)));await accounts.close();}};
}
if(require.main===module)createApp().then(async service=>{
    if(!await service.accounts.initialized())console.log('Execute npm run setup para criar o administrador antes do primeiro acesso.');
    const port=Number(process.env.PORT)||3000;
    const server=service.app.listen(port,()=>console.log('Servidor disponível na porta '+port));
    async function shutdown(){server.close();try{await service.close();}finally{process.exit(0);}}
    process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}).catch(error=>{console.error('Não foi possível iniciar o servidor:',error.message);process.exitCode=1;});
module.exports={createApp};
