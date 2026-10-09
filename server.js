const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const createQRImage = require('./whatsapp-qr');

const path = require('path');
const app = express();
// Serve only public assets; never expose the database or WhatsApp sessions.
const sendPublicFile = (res, file) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, file));
};
app.get('/', (req, res) => sendPublicFile(res, 'index.html'));
app.get('/index.html', (req, res) => sendPublicFile(res, 'index.html'));
for (const asset of ['style.css', 'dashboard.css', 'oficina.css', 'dashboard.js', 'api-config.js', 'publicidade.json']) {
    app.get('/' + asset, (req, res) => sendPublicFile(res, asset));
}
app.use(express.json());
app.use(cors());

let qrCodeAtual = '';
let qrImagemAtual = '';
let statusConexaoWhatsApp = 'DESCONECTADO';

// --- CONFIGURAÇÃO DO BANCO DE DADOS SQLITE ---
const db = new sqlite3.Database(path.join(__dirname, 'brucecell.db'), (err) => {
    if (err) {
        console.error('Erro ao abrir o banco de dados SQLite:', err.message);
    } else {
        console.log('📦 Conectado ao banco de dados SQLite com sucesso!');
        criarTabelas();
    }
});

function criarTabelas() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            telefone TEXT NOT NULL,
            aparelho TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS ordens_servico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numeroOS INTEGER UNIQUE NOT NULL,
            clienteId INTEGER,
            clienteNome TEXT NOT NULL,
            telefone TEXT NOT NULL,
            aparelho TEXT NOT NULL,
            itens TEXT NOT NULL,
            valor REAL NOT NULL,
            status TEXT DEFAULT 'EM ANÁLISE',
            pagamento TEXT DEFAULT 'NÃO DEFINIDO',
            dataAbertura TEXT NOT NULL,
            FOREIGN KEY (clienteId) REFERENCES clientes (id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            preco REAL NOT NULL,
            estoque INTEGER NOT NULL,
            ncm TEXT DEFAULT ''
        )`, (err) => {
            if (!err) {
                db.run(`ALTER TABLE produtos ADD COLUMN ncm TEXT DEFAULT ''`, () => {});
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS caixa_movimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL, 
            valor REAL NOT NULL,
            formaPagamento TEXT DEFAULT 'DINHEIRO',
            descricao TEXT NOT NULL,
            dataHora TEXT NOT NULL,
            statusCaixa TEXT DEFAULT 'ABERTO'
        )`);
    });
}

// --- CONFIGURAÇÃO ESTÁVEL DO WHATSAPP ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('📱 QR CODE GERADO COM SUCESSO! Pronto para leitura no painel.');
    qrCodeAtual = qr;
    qrImagemAtual = createQRImage(qr);
    statusConexaoWhatsApp = 'AGUARDANDO_LEITURA';
});

client.on('ready', () => {
    console.log('✅ WhatsApp conectado com sucesso!');
    qrCodeAtual = '';
    statusConexaoWhatsApp = 'CONECTADO';
});

client.on('authenticated', () => {
    console.log('🔑 WhatsApp autenticado com sucesso!');
    statusConexaoWhatsApp = 'AUTENTICADO';
});

client.on('disconnected', (reason) => {
    console.log('⚠️ WhatsApp desconectado:', reason);
    statusConexaoWhatsApp = 'DESCONECTADO';
    qrCodeAtual = '';
});

client.initialize().catch(err => {
    console.log('❌ Erro na inicialização do WhatsApp:', err.message);
    statusConexaoWhatsApp = 'ERRO_INICIALIZACAO';
});

function obterDataAtual() {
    const agora = new Date();
    return agora.toLocaleString('pt-BR');
}

async function enviarMensagemSegura(telefone, mensagem) {
    if (statusConexaoWhatsApp !== 'CONECTADO') {
        throw new Error('WhatsApp não está conectado.');
    }
    let numeroLimpo = telefone.replace(/\D/g, '');
    let chatId = `55${numeroLimpo}@c.us`;

    try {
        await client.sendMessage(chatId, mensagem);
    } catch (e) {
        let contactId = await client.getNumberId(chatId);
        if (contactId && contactId._serialized) {
            await client.sendMessage(contactId._serialized, mensagem);
        } else {
            throw new Error('Número de WhatsApp inválido ou não encontrado.');
        }
    }
}

// --- ROTAS DA API ---

app.get('/whatsapp/status', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        status: statusConexaoWhatsApp,
        qr: qrCodeAtual,
        qrImage: qrCodeAtual ? qrImagemAtual : ''
    });
});

app.get('/clientes', (req, res) => {
    db.all(`SELECT * FROM clientes`, [], (err, rows) => {
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
    db.run(query, [nome, telefone, aparelho], function(err) {
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
    db.run(query, [nome, telefone, aparelho, id], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.get('/produtos', (req, res) => {
    db.all(`SELECT * FROM produtos`, [], (err, rows) => {
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
    db.run(query, [nome, preco, estoque, ncm || ''], function(err) {
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

    db.get(`SELECT * FROM produtos WHERE id = ?`, [id], (err, prod) => {
        if (err || !prod) return res.status(404).json({ success: false, error: 'Produto não encontrado.' });

        const novoEstoque = prod.estoque + (parseInt(adicionarEstoque) || 0);
        const novoNcm = ncm !== undefined ? ncm : prod.ncm;
        const novoPreco = preco !== undefined ? parseFloat(preco) : prod.preco;

        const updateQuery = `UPDATE produtos SET estoque = ?, ncm = ?, preco = ? WHERE id = ?`;
        db.run(updateQuery, [novoEstoque, novoNcm, novoPreco, id], function(err) {
            if (err) return res.status(500).json({ success: false, error: err.message });
            res.json({ success: true });
        });
    });
});

app.get('/os', (req, res) => {
    db.all(`SELECT * FROM ordens_servico`, [], (err, rows) => {
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

        db.get(`SELECT MAX(numeroOS) as maxNum FROM ordens_servico`, [], (err, row) => {
            const numeroOS = (row && row.maxNum) ? row.maxNum + 1 : 1001;

            const insertQuery = `INSERT INTO ordens_servico (numeroOS, clienteId, clienteNome, telefone, aparelho, itens, valor, status, pagamento, dataAbertura) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(insertQuery, [numeroOS, clienteId || null, clienteNome, telefone, aparelho, itensJson, valorTotal.toFixed(2), statusInicial, formaPagamento, dataAbertura], function(err) {
                if (err) {
                    console.error('Erro ao inserir OS no banco:', err.message);
                    return res.status(500).json({ success: false, error: err.message });
                }

                res.json({ success: true, numeroOS });

                if (telefone && telefone.length >= 8 && statusConexaoWhatsApp === 'CONECTADO' && clienteId) {
                    let itensTexto = itens.map(i => `• ${i.descricao}: R$ ${i.valor}`).join('\n');
                    let mensagem = `*BRUCE CELL 🦇*\n\nOlá *${clienteNome}*, sua Ordem de Serviço *#${numeroOS}* foi aberta!\n\n*Aparelho:* ${aparelho}\n*Itens/Serviços:*\n${itensTexto}\n\n*TOTAL: R$ ${valorTotal.toFixed(2)}*\n\nAcompanhe o andamento conosco!`;
                    
                    enviarMensagemSegura(telefone, mensagem).catch(e => console.log('Erro WhatsApp OS (Background):', e.message));
                }
            });
        });
    };

    if (clienteId) {
        db.get(`SELECT * FROM clientes WHERE id = ?`, [clienteId], (err, cliente) => {
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

    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });

        if (status === 'PRONTO' && statusConexaoWhatsApp === 'CONECTADO') {
            db.get(`SELECT * FROM ordens_servico WHERE id = ?`, [id], (err, os) => {
                if (os && os.telefone) {
                    let mensagem = `*BRUCE CELL 🦇*\n\nOlá *${os.clienteNome}*, seu *${os.aparelho}* está *PRONTO*! 🚀\n\n*Valor Total:* R$ ${os.valor}\n*Forma de Pagto:* ${os.pagamento || 'NÃO DEFINIDO'}\n\nPode vir retirar na loja!`;
                    enviarMensagemSegura(os.telefone, mensagem).catch(e => console.log('Erro WhatsApp:', e.message));
                }
            });
        }

        res.json({ success: true });
    });
});

// --- ROTAS DE FLUXO DE CAIXA ---

app.get('/caixa/status', (req, res) => {
    db.get(`SELECT * FROM caixa_movimentos WHERE tipo = 'ABERTURA' ORDER BY id DESC LIMIT 1`, [], (err, abertura) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (!abertura) {
            return res.json({ aberto: false, saldoInicial: 0 });
        }

        db.get(`SELECT * FROM caixa_movimentos WHERE tipo = 'FECHAMENTO' AND id > ? ORDER BY id DESC LIMIT 1`, [abertura.id], (err, fechamento) => {
            if (err) return res.status(500).json({ error: err.message });

            if (fechamento) {
                res.json({ aberto: false, saldoInicial: 0 });
            } else {
                db.all(`SELECT tipo, valor FROM caixa_movimentos WHERE id >= ?`, [abertura.id], (err, movimentos) => {
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
    
    db.run(query, [parseFloat(valorInicial), dataHora], function(err) {
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

    db.run(query, [tipo.toUpperCase(), parseFloat(valor), descricao.toUpperCase(), dataHora], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.post('/caixa/fechar', (req, res) => {
    const { valorFechamento, observacao } = req.body;
    const dataHora = obterDataAtual();

    const query = `INSERT INTO caixa_movimentos (tipo, valor, descricao, dataHora) VALUES ('FECHAMENTO', ?, ?, ?)`;
    db.run(query, [parseFloat(valorFechamento) || 0, `FECHAMENTO: ${observacao || 'NENHUMA'}`, dataHora], function(err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
    });
});

app.get('/caixa/extrato', (req, res) => {
    db.get(`SELECT * FROM caixa_movimentos WHERE tipo = 'ABERTURA' ORDER BY id DESC LIMIT 1`, [], (err, abertura) => {
        if (err || !abertura) return res.json([]);

        db.all(`SELECT * FROM caixa_movimentos WHERE id >= ? ORDER BY id DESC`, [abertura.id], (err, rows) => {
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
        await enviarMensagemSegura(telefone, mensagem);
        res.json({ success: true });
    } catch (e) {
        console.error('Erro ao enviar mensagem livre:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/faturamento', (req, res) => {
    db.all(`SELECT valor, dataAbertura FROM ordens_servico WHERE status IN ('PRONTO', 'ENTREGUE')`, [], (err, rows) => {
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando localmente na porta ${PORT}`);
});
