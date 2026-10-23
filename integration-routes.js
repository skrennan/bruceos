const express=require('express');
const {failure}=require('./commerce');

function installIntegration(app,{accounts,whatsapp}){
    const router=express.Router(),limits=new Map();
    router.use(async(req,res,next)=>{
        const user=await accounts.commerce.authenticate(req.get('Authorization')?.replace(/^Bearer /,''));
        if(!user)return res.status(401).json({error:'Chave de API inválida ou revogada.',code:'INVALID_API_KEY'});
        const now=Date.now();for(const [id,entry] of limits)if(entry.until<=now)limits.delete(id);
        const bucket=limits.get(user.storeId)||{count:0,until:now+60000};
        if(bucket.count>=60){res.set('Retry-After',String(Math.ceil((bucket.until-now)/1000)));throw failure(429,'RATE_LIMIT','Limite de 60 requisições por minuto por empresa.');}
        bucket.count++;limits.set(user.storeId,bucket);
        await accounts.commerce.ensureAccess(user.storeId);req.user=user;next();
    });
    router.get('/account',async(req,res)=>res.json({company:{id:req.user.storeId,name:req.user.name},subscription:await accounts.commerce.subscription(req.user.storeId)}));
    // QR and connection management stay in the authenticated company portal.
    router.get('/whatsapp/status',(req,res)=>res.json({status:whatsapp.state(req.user.storeId).status}));
    router.get('/messages',async(req,res)=>res.json(await accounts.commerce.messages(req.user.storeId)));
    router.post('/messages',async(req,res)=>{
        const key=req.get('Idempotency-Key');
        if(!key)throw failure(400,'IDEMPOTENCY_REQUIRED','Informe Idempotency-Key para evitar envios duplicados.');
        const result=await whatsapp.send(req.user.storeId,req.body?.to,req.body?.text,{idempotencyKey:key});
        res.status(result.replayed?200:201).json({success:true,...result});
    });
    router.use((req,res)=>res.status(404).json({error:'Endpoint não encontrado.',code:'NOT_FOUND'}));
    app.use('/v1',router);
}
function installPortal(app,{accounts,whatsapp}){
    const commerce=accounts.commerce;
    app.get('/integrations/overview',async(req,res)=>res.json({subscription:await commerce.subscription(req.user.storeId),keys:await commerce.keys(req.user.storeId),messages:await commerce.messages(req.user.storeId),whatsapp:{status:whatsapp.state(req.user.storeId).status}}));
    app.post('/integrations/keys',async(req,res)=>res.status(201).json(await commerce.createKey(req.user.storeId,req.body?.name)));
    app.delete('/integrations/keys/:id',async(req,res)=>{
        const result=await commerce.revoke(req.user.storeId,req.params.id);
        if(!result.changes)throw failure(404,'KEY_NOT_FOUND','Chave não encontrada ou já revogada.');
        res.json({success:true});
    });
    app.get('/admin/commercial',async(req,res)=>{
        const stores=await accounts.list();
        res.json(await Promise.all(stores.map(async store=>({...store,subscription:await commerce.subscription(store.id),whatsapp:whatsapp.state(store.id).status}))));
    });
    app.put('/admin/stores/:id/subscription',async(req,res)=>{
        const subscription=await commerce.setSubscription(req.params.id,req.body||{});
        if(!subscription.access)await whatsapp.disconnect(req.params.id,false).catch(()=>{});
        res.json({success:true,subscription});
    });
}
module.exports={installIntegration,installPortal};
