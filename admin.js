let companyData=[];
const adminBase=window.BRUCE_API_URL;
const brl=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const companyDate=value=>value?new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem vencimento';
const companyDateInput=value=>value?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):'';
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
async function adminRequest(route,options={}){const response=await fetch(adminBase+route,options),data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível concluir. Atualize e tente novamente.');return data;}
function renderCompanies(){
    const query=document.getElementById('companySearch').value.toLocaleLowerCase('pt-BR'),filter=document.getElementById('companyFilter').value,list=document.getElementById('storeList');list.replaceChildren();
    const stores=companyData.filter(store=>{
        const matches=(store.name+' '+store.email).toLocaleLowerCase('pt-BR').includes(query),sub=store.subscription;
        return matches&&(filter==='all'||filter==='active'&&sub.access||filter==='expired'&&store.active&&!sub.access||filter==='suspended'&&!store.active);
    });
    if(!stores.length)list.append(node('li','Nenhuma empresa corresponde à busca.','directory-empty'));
    for(const store of stores){
        const sub=store.subscription,row=node('li',undefined,'store-item'),head=node('div',undefined,'company-row'),identity=node('div',undefined,'company-identity');
        identity.append(node('strong',store.name),node('small',store.email));const label=store.id==='legacy'?'Administrador':!store.active?'Suspenso':!sub.access?'Vencido':sub.billingStatus==='trial'?'Em avaliação':'Liberado';
        head.append(identity,node('span',label,'company-state'+(!sub.access?' is-expired':'')));row.append(head);
        const facts=node('div',undefined,'company-facts');facts.append(node('span',sub.plan),node('span',brl(sub.monthlyPriceCents)+'/mês'),node('span',sub.used.toLocaleString('pt-BR')+' / '+sub.messageLimit.toLocaleString('pt-BR')+' mensagens'),node('span',sub.expiresAt?'Até '+companyDate(sub.expiresAt):'Sem vencimento'),node('span',store.whatsapp==='CONECTADO'?'WhatsApp conectado':'WhatsApp desconectado'));row.append(facts);
        if(store.id!=='legacy'){
            const actions=node('div',undefined,'company-actions'),details=node('details'),summary=node('summary','Editar mensalidade');details.append(summary);
            const form=node('form',undefined,'subscription-form');form.setAttribute('aria-label','Mensalidade de '+store.name);
            const addField=(name,label,type,value,attrs={})=>{const wrapper=node('div'),input=document.createElement('input'),id=store.id+'-'+name;input.id=id;input.name=name;input.type=type;input.value=value;input.required=true;for(const [key,val] of Object.entries(attrs))input.setAttribute(key,val);const title=node('label',label);title.htmlFor=id;wrapper.append(title,input);form.append(wrapper);return input;};
            addField('plan','Nome do plano','text',sub.plan,{minlength:2,maxlength:80});addField('price','Mensalidade (R$)','number',(sub.monthlyPriceCents/100).toFixed(2),{min:0,max:1000000,step:'0.01'});addField('limit','Mensagens por mês','number',sub.messageLimit,{min:1,max:1000000,step:1});addField('expires','Último dia de acesso','date',companyDateInput(sub.expiresAt));
            const billingWrapper=node('div'),billing=node('select'),billingLabel=node('label','Situação do contrato');billing.id=store.id+'-billing';billing.name='billing';billingLabel.htmlFor=billing.id;
            for(const [value,label] of [['trial','Em avaliação'],['active','Mensalidade confirmada']]){const option=node('option',label);option.value=value;billing.append(option);}billing.value=sub.billingStatus;billingWrapper.append(billingLabel,billing);form.append(billingWrapper);
            const end=node('div',undefined,'form-end'),save=node('button','Salvar mensalidade'),feedback=node('span',undefined,'form-feedback');save.type='submit';feedback.setAttribute('role','status');end.append(save,feedback);form.append(end);
            form.addEventListener('submit',async event=>{event.preventDefault();save.disabled=true;feedback.textContent='Salvando…';const values=new FormData(form);
                try{await adminRequest('/admin/stores/'+store.id+'/subscription',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({plan:values.get('plan'),monthlyPriceCents:Math.round(Number(values.get('price'))*100),messageLimit:Number(values.get('limit')),expiresAt:values.get('expires')+'T23:59:59.999-03:00',billingStatus:values.get('billing')})});await loadStores();document.getElementById('adminFeedback').textContent='Mensalidade de '+store.name+' atualizada.';}catch(error){feedback.textContent=error.message;save.disabled=false;}
            });details.append(form);actions.append(details);
            const toggle=node('button',store.active?'Suspender':'Reativar','secondary');toggle.type='button';toggle.setAttribute('aria-label',toggle.textContent+' empresa '+store.name);
            toggle.addEventListener('click',async()=>{if(store.active&&!confirm('Suspender '+store.name+' e encerrar seus acessos? Os dados serão preservados.'))return;toggle.disabled=true;try{await adminRequest('/admin/stores/'+store.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!store.active})});await loadStores();}catch(error){document.getElementById('adminFeedback').textContent=error.message;toggle.disabled=false;}});actions.append(toggle);row.append(actions);
        }
        list.append(row);
    }
}
async function loadStores(){
    companyData=await adminRequest('/admin/commercial');const tenants=companyData.filter(store=>store.id!=='legacy');
    document.getElementById('totalCompanies').textContent=tenants.length;
    document.getElementById('activeCompanies').textContent=tenants.filter(store=>store.subscription.access).length;
    document.getElementById('connectedCompanies').textContent=tenants.filter(store=>store.whatsapp==='CONECTADO').length;
    document.getElementById('monthlyRevenue').textContent=brl(tenants.filter(store=>store.subscription.access&&store.subscription.billingStatus==='active').reduce((sum,store)=>sum+store.subscription.monthlyPriceCents,0));renderCompanies();renderAdminCharts(tenants);
}

function renderAdminCharts(tenants){
    const target=document.getElementById('contractChart');target.replaceChildren();
    const groups=[
        ['Mensalidade ativa',tenants.filter(s=>s.active&&s.subscription.access&&s.subscription.billingStatus==='active').length,'blue'],
        ['Em avaliação',tenants.filter(s=>s.active&&s.subscription.access&&s.subscription.billingStatus!=='active').length,'green'],
        ['Acesso vencido',tenants.filter(s=>s.active&&!s.subscription.access).length,'amber'],
        ['Suspensas',tenants.filter(s=>!s.active).length,'muted']
    ];
    const total=tenants.length;
    const strip=node('div',undefined,'contract-strip');strip.setAttribute('aria-hidden','true');
    for(const [label,count,color] of groups){const segment=node('span',undefined,color);segment.style.width=(total?count/total*100:0)+'%';segment.title=label+': '+count;strip.append(segment);}target.append(strip);
    for(const [label,count,color] of groups){const row=node('div',undefined,'contract-legend');const title=node('span',label);title.prepend(node('i',undefined,color));row.append(title,node('strong',String(count)));target.append(row);}
    const foot=node('p',total?`${total} empresas na carteira. Valores contratados não representam pagamentos recebidos.`:'Nenhuma empresa contratante. Cadastre o primeiro acesso abaixo.','chart-footnote');target.append(foot);
    const usage=document.getElementById('usageChart');usage.replaceChildren();
    const ranked=[...tenants].sort((a,b)=>b.subscription.used-a.subscription.used).slice(0,4);
    if(!ranked.length)usage.append(node('p','O consumo aparecerá aqui quando houver empresas cadastradas.','chart-empty'));
    for(const store of ranked){const sub=store.subscription,row=node('div',undefined,'usage-item'),head=node('div',undefined,'usage-heading');
        head.append(node('strong',store.name),node('span',`${sub.used.toLocaleString('pt-BR')} / ${sub.messageLimit.toLocaleString('pt-BR')}`));
        const progress=node('progress');progress.max=sub.messageLimit||1;progress.value=sub.used;progress.setAttribute('aria-label',`Mensagens de ${store.name}: ${sub.used} de ${sub.messageLimit}`);
        if(sub.used>=sub.messageLimit*.8)progress.className='near-limit';row.append(head,progress);usage.append(row);
    }
    if(ranked.length)usage.append(node('p','Mensagens utilizadas / limite do plano.','chart-footnote'));
}
document.addEventListener('DOMContentLoaded',async()=>{const small=matchMedia('(max-width:760px)');const resizeForm=()=>{document.getElementById('createCompany').open=!small.matches;};resizeForm();small.addEventListener('change',resizeForm);try{const user=await window.authReady;if(user.role!=='admin'){location.replace('index.html');return;}await loadStores();}catch(error){document.getElementById('adminFeedback').textContent=error.message;}});
document.getElementById('companySearch').addEventListener('input',renderCompanies);document.getElementById('companyFilter').addEventListener('change',renderCompanies);
document.getElementById('refreshCompanies').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await loadStores();}catch(error){document.getElementById('adminFeedback').textContent=error.message;}finally{document.getElementById('refreshCompanies').disabled=false;}});
document.getElementById('storeForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button'),feedback=document.getElementById('adminFeedback');button.disabled=true;feedback.textContent='Criando empresa…';
    try{await adminRequest('/admin/stores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('storeName').value,email:document.getElementById('storeEmail').value,password:document.getElementById('storePassword').value})});event.target.reset();feedback.textContent='Empresa criada. Entregue o e-mail e a senha inicial ao responsável e ajuste a mensalidade.';await loadStores();}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
});
