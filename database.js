const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

function open(file) {
    fs.mkdirSync(path.dirname(file), { recursive:true });
    const db = new sqlite3.Database(file);
    db.configure('busyTimeout', 5000);
    return db;
}
const run = (db, sql, params=[]) => new Promise((resolve,reject) => db.run(sql,params,function(error) { error ? reject(error) : resolve({id:this.lastID,changes:this.changes}); }));
const get = (db, sql, params=[]) => new Promise((resolve,reject) => db.get(sql,params,(error,row) => error ? reject(error) : resolve(row)));
const all = (db, sql, params=[]) => new Promise((resolve,reject) => db.all(sql,params,(error,rows) => error ? reject(error) : resolve(rows)));
const exec = (db, sql) => new Promise((resolve,reject) => db.exec(sql,error => error ? reject(error) : resolve()));
const close = db => new Promise((resolve,reject) => db.close(error => error ? reject(error) : resolve()));

async function openStore(file) {
    const db = open(file);
    await exec(db, `PRAGMA foreign_keys=ON;
        CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,telefone TEXT NOT NULL,aparelho TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS ordens_servico (id INTEGER PRIMARY KEY AUTOINCREMENT,numeroOS INTEGER UNIQUE NOT NULL,clienteId INTEGER,clienteNome TEXT NOT NULL,telefone TEXT NOT NULL,aparelho TEXT NOT NULL,itens TEXT NOT NULL,valor REAL NOT NULL,status TEXT DEFAULT 'EM ANÁLISE',pagamento TEXT DEFAULT 'NÃO DEFINIDO',dataAbertura TEXT NOT NULL,FOREIGN KEY(clienteId) REFERENCES clientes(id));
        CREATE TABLE IF NOT EXISTS produtos (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,preco REAL NOT NULL,estoque INTEGER NOT NULL,ncm TEXT DEFAULT '');
        CREATE TABLE IF NOT EXISTS caixa_movimentos (id INTEGER PRIMARY KEY AUTOINCREMENT,tipo TEXT NOT NULL,valor REAL NOT NULL,formaPagamento TEXT DEFAULT 'DINHEIRO',descricao TEXT NOT NULL,dataHora TEXT NOT NULL,statusCaixa TEXT DEFAULT 'ABERTO');`);
    const columns = await all(db,'PRAGMA table_info(produtos)');
    if (!columns.some(column=>column.name==='ncm')) await run(db,"ALTER TABLE produtos ADD COLUMN ncm TEXT DEFAULT ''");
    return db;
}
module.exports = {open,run,get,all,exec,close,openStore};
