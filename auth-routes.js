const cors = require('cors');

function installAuth(app,{accounts,whatsapp,allowedOrigins=[],production=false}) {
    const cookieName=production?'__Host-bruce_session':'bruce_session';
    function allowed(origin,req) {
        if (!origin) return true;
        if (allowedOrigins.includes(origin)) return true;
        if (origin===`${req.protocol}://${req.get('host')}`) return true;
        if (!production) {try {const url=new URL(origin);return url.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname) && (url.port==='3000'||(+url.port>=5500&&+url.port<=5599));}catch{}}
        return false;
    }
    app.use((req,res,next)=>{
        res.set('Cache-Control','no-store');
        if(!allowed(req.get('origin'),req))return res.status(403).json({error:'Origem não autorizada.'});
        next();
    });
    app.use(cors({origin:true,credentials:true,allowedHeaders:['Content-Type','X-CSRF-Token','Authorization','Idempotency-Key'],methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS']}));
    const attempts=new Map();
    const tokenOf=req=>{
        const cookies=String(req.headers.cookie||'').split(';').map(value=>value.trim());
        return cookies.find(value=>value.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
    };
    const cookie=(res,token,clear=false)=>res.cookie(cookieName,token,{httpOnly:true,secure:production,sameSite:'lax',path:'/',maxAge:clear?0:12*60*60*1000});
    const userInfo=user=>({id:user.id,email:user.email,role:user.role,store:{id:user.storeId,name:user.name}});
    app.post('/auth/login',async(req,res)=>{
        const now=Date.now(),key=req.ip;
        for(const [id,value] of attempts)if(value.until<=now)attempts.delete(id);
        const record=attempts.get(key)||{count:0,until:now+15*60*1000};
        if(record.count>=10)return res.status(429).json({error:'Muitas tentativas. Aguarde 15 minutos.'});
        record.count++;attempts.set(key,record);
        const session=await accounts.login(req.body.email,req.body.password);
        if(!session)return res.status(401).json({error:'E-mail ou senha incorretos, ou loja desativada.'});
        attempts.delete(key);cookie(res,session.token);
        res.json({success:true});
    });
    app.get('/auth/setup-status',async(req,res)=>res.json({initialized:!!await accounts.initialized()}));
    require('./integration-routes').installIntegration(app,{accounts,whatsapp});
    app.use(async(req,res,next)=>{
        const user=await accounts.authenticate(tokenOf(req));
        if(!user)return res.status(401).json({error:'Entre na sua conta para continuar.'});
        req.user=user;
        if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('X-CSRF-Token')!==user.csrf)return res.status(403).json({error:'Sessão inválida. Atualize a página.'});
        next();
    });
    app.get('/auth/me',(req,res)=>res.json({user:userInfo(req.user),csrf:req.user.csrf}));
    app.post('/auth/logout',async(req,res)=>{await accounts.logout(tokenOf(req));cookie(res,'',true);res.json({success:true});});
    app.post('/auth/password',async(req,res)=>{try {await accounts.changePassword(req.user.id,req.body.currentPassword,req.body.password);cookie(res,'',true);res.json({success:true});}catch(error){res.status(400).json({error:error.message});}});
    app.use('/admin',(req,res,next)=>req.user.role==='admin'?next():res.status(403).json({error:'Acesso exclusivo do administrador.'}));
    app.get('/admin/stores',async(req,res)=>res.json(await accounts.list()));
    app.post('/admin/stores',async(req,res)=>{try {const store=await accounts.createStore(req.body);res.status(201).json({success:true,store});}catch(error){res.status(400).json({error:error.message});}});
    app.patch('/admin/stores/:id',async(req,res)=>{
        if(typeof req.body.active!=='boolean')return res.status(400).json({error:'Informe o estado da loja.'});
        const changed=await accounts.setActive(req.params.id,req.body.active);
        if(!changed)return res.status(404).json({error:'Loja não encontrada ou loja do administrador.'});
        if(!req.body.active)await whatsapp.disconnect(req.params.id,false).catch(()=>{});
        res.json({success:true});
    });
}
module.exports={installAuth};
