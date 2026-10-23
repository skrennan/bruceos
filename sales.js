const {run,get}=require('./database');
const {failure}=require('./commerce');

function installSales(app){
    app.post('/vendas',async(req,res)=>{
        const {itens,pagamento,requestId}=req.body||{};
        if(!Array.isArray(itens)||!itens.length||itens.length>100||!itens.every(i=>i&&Number.isSafeInteger(i.id)&&i.id>0&&Number.isSafeInteger(i.quantidade)&&i.quantidade>0&&i.quantidade<=10000)||typeof pagamento!=='string'||!['DINHEIRO','PIX','CARTÃO DE CRÉDITO','CARTÃO DE DÉBITO','CREDITO','DEBITO','CRÉDITO','DÉBITO'].includes(pagamento)||typeof requestId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(requestId))
            throw failure(400,'INVALID_SALE','Confira os produtos, as quantidades e o pagamento da venda.');
        const payload=JSON.stringify({itens,pagamento});
        const existing=await get(req.db,'SELECT payload,response FROM vendas_requisicoes WHERE id=?',[requestId]);
        if(existing){if(existing.payload!==payload)throw failure(409,'SALE_CONFLICT','Esta identificação pertence a outra venda.');return res.json(JSON.parse(existing.response));}
        req.holdWrite=true;
        let response,began=false;
        try{
            await run(req.db,'BEGIN IMMEDIATE');began=true;
            const quantities=new Map();for(const item of itens)quantities.set(item.id,(quantities.get(item.id)||0)+item.quantidade);
            const saleItems=[];let totalCents=0;
            for(const [id,quantity] of quantities){
                const product=await get(req.db,'SELECT * FROM produtos WHERE id=?',[id]);
                if(!product)throw failure(404,'PRODUCT_NOT_FOUND','Produto não encontrado nesta empresa.');
                if(product.estoque<quantity)throw failure(409,'INSUFFICIENT_STOCK','Estoque insuficiente: '+product.nome+'. Atualize o carrinho.');
                const cents=Math.round(Number(product.preco)*100);
                if(!Number.isSafeInteger(cents)||cents<0)throw failure(409,'INVALID_PRICE','Corrija o preço do produto '+product.nome+'.');
                totalCents+=cents*quantity;
                saleItems.push({id,nome:product.nome,preco:cents/100,quantidade:quantity,descricao:quantity+'x '+product.nome,valor:(cents*quantity/100).toFixed(2)});
                await run(req.db,'UPDATE produtos SET estoque=estoque-? WHERE id=?',[quantity,id]);
            }
            if(!Number.isSafeInteger(totalCents)||totalCents<=0||totalCents>1000000000)throw failure(400,'INVALID_TOTAL','O total da venda deve ser maior que zero e até R$ 10.000.000.');
            const row=await get(req.db,'SELECT MAX(numeroOS) AS max FROM ordens_servico'),numeroOS=(row.max||1000)+1;
            const date=new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),total=totalCents/100;
            await run(req.db,`INSERT INTO ordens_servico(numeroOS,clienteNome,telefone,aparelho,itens,valor,status,pagamento,dataAbertura)
                VALUES(?,'BALCÃO / ACESSÓRIOS','','VENDA DE ACESSÓRIOS',?,?,'ENTREGUE',?,?)`,[numeroOS,JSON.stringify(saleItems),total,pagamento,date]);
            const last=await get(req.db,'SELECT tipo FROM caixa_movimentos WHERE tipo IN (\'ABERTURA\',\'FECHAMENTO\') ORDER BY id DESC LIMIT 1');
            const caixaRegistrado=last?.tipo==='ABERTURA';
            if(caixaRegistrado)await run(req.db,"INSERT INTO caixa_movimentos(tipo,valor,formaPagamento,descricao,dataHora) VALUES('VENDA',?,?,?,?)",[total,pagamento,'VENDA #'+numeroOS,date]);
            response={success:true,numeroOS,total,itens:saleItems,pagamento,caixaRegistrado};
            await run(req.db,'INSERT INTO vendas_requisicoes(id,payload,response) VALUES(?,?,?)',[requestId,payload,JSON.stringify(response)]);
            await run(req.db,'COMMIT');
        }catch(error){if(began)await run(req.db,'ROLLBACK');throw error;}
        finally{req.holdWrite=false;if(res.destroyed)req.finishWrite();}
        res.status(201).json(response);
    });
}
module.exports={installSales};
