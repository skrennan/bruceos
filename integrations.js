const portalBase=window.BRUCE_API_URL;
const dateLabel=value=>value?new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Sem vencimento';
const moneyLabel=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const put=(id,text)=>document.getElementById(id).textContent=text;
async function portalRequest(route,options={}){const response=await fetch(portalBase+route,options),data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível concluir. Atualize e tente novamente.');return data;}
async function loadOverview(){
    const data=await portalRequest('/integrations/overview'),sub=data.subscription;
    put('companyName',window.currentAccount.store.name);
    put('planName',sub.plan);put('planPrice',sub.billingStatus==='trial'?'Período de avaliação':moneyLabel(sub.monthlyPriceCents)+'/mês');
    put('usageValue',sub.used.toLocaleString('pt-BR')+' / '+sub.messageLimit.toLocaleString('pt-BR'));
    const progress=document.getElementById('usageProgress');progress.max=sub.messageLimit;progress.value=Math.min(sub.used,sub.messageLimit);
    put('planExpiry',dateLabel(sub.expiresAt));put('planState',sub.access?'Acesso liberado':'Vencido — solicite renovação');
    const states={CONECTADO:'WhatsApp conectado',DESCONECTADO:'WhatsApp desconectado',INICIALIZANDO:'Iniciando WhatsApp',AGUARDANDO_LEITURA:'Aguardando leitura do QR Code',AUTENTICADO:'Finalizando conexão'};
    put('connectionStatus',states[data.whatsapp.status]||'WhatsApp precisa de atenção');
    put('connectionHint',data.whatsapp.status==='CONECTADO'?'O telefone da empresa está pronto para enviar pela API.':'Conecte o telefone da empresa para começar a enviar.');
    document.querySelector('.connection-strip').classList.toggle('is-connected',data.whatsapp.status==='CONECTADO');
    const feedback=document.getElementById('portalFeedback');feedback.textContent=sub.access?'':'Seu acesso ao WhatsApp venceu. Fale com o administrador para renovar a mensalidade. Seus registros continuam disponíveis.';
    const list=document.getElementById('keyList');list.replaceChildren();
    if(!data.keys.length){const empty=document.createElement('li');empty.className='empty-state';empty.textContent='Nenhuma integração criada. Gere a primeira chave acima.';list.append(empty);}
    for(const key of data.keys){
        const row=document.createElement('li'),details=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('small');
        name.textContent=key.name;meta.textContent=key.prefix+'… · '+(key.revokedAt?'Revogada':key.lastUsedAt?'Último uso: '+dateLabel(key.lastUsedAt):'Ainda não utilizada');details.append(name,meta);row.append(details);
        if(!key.revokedAt){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Revogar';button.setAttribute('aria-label','Revogar chave '+key.name);button.addEventListener('click',async()=>{
            if(!confirm('Revogar a chave '+key.name+'? A integração deixará de funcionar.'))return;
            button.disabled=true;try{await portalRequest('/integrations/keys/'+key.id,{method:'DELETE'});await loadOverview();feedback.textContent='Chave revogada.';}catch(error){feedback.textContent=error.message;button.disabled=false;}
        });row.append(button);}list.append(row);
    }
    const history=document.getElementById('messageList');history.replaceChildren();
    if(!data.messages.length){const empty=document.createElement('li');empty.className='empty-state';empty.textContent=data.whatsapp.status==='CONECTADO'?'Nenhum envio registrado. Use sua chave de integração para enviar a primeira mensagem.':'Nenhum envio registrado. Conecte o WhatsApp e faça seu primeiro envio.';history.append(empty);}
    for(const message of data.messages){const row=document.createElement('li'),details=document.createElement('div'),id=document.createElement('code'),date=document.createElement('small'),status=document.createElement('span');id.textContent=message.id;date.textContent=new Date(message.createdAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'});status.textContent=({sent:'Enviado ao WhatsApp',sending:'Em processamento',unknown:'Sem confirmação'})[message.status]||message.status;details.append(id,date);row.append(details,status);history.append(row);}
}
document.getElementById('keyForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;
    try{
        const key=await portalRequest('/integrations/keys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('keyName').value})});
        document.getElementById('newSecret').value=key.token;document.getElementById('secretBox').hidden=false;event.target.reset();await loadOverview();document.getElementById('newSecret').focus();
    }catch(error){put('portalFeedback',error.message);}finally{button.disabled=false;}
});
document.getElementById('copySecret').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(document.getElementById('newSecret').value);put('portalFeedback','Chave copiada.');}catch{document.getElementById('newSecret').select();put('portalFeedback','Selecione a chave e use Copiar no seu dispositivo.');}});
document.getElementById('dismissSecret').addEventListener('click',()=>{document.getElementById('newSecret').value='';document.getElementById('secretBox').hidden=true;document.getElementById('keyName').focus();});
document.getElementById('refreshOverview').addEventListener('click',async event=>{event.currentTarget.disabled=true;try{await loadOverview();}catch(error){put('portalFeedback',error.message);}finally{document.getElementById('refreshOverview').disabled=false;}});
document.addEventListener('DOMContentLoaded',async()=>{try{
    await window.authReady;document.getElementById('apiBase').value=portalBase+'/v1';
    const slash=String.fromCharCode(92);
    put('apiExample',[
        `curl -X POST '${portalBase}/v1/messages' ${slash}`,
        `  -H 'Authorization: Bearer SUA_CHAVE' ${slash}`,
        `  -H 'Content-Type: application/json' ${slash}`,
        `  -H 'Idempotency-Key: pedido-123-mensagem-1' ${slash}`,
        `  -d '{"to":"5511999999999","text":"Olá!"}'`
    ].join('\n'));
    await loadOverview();
}catch(error){put('portalFeedback',error.message);}});
