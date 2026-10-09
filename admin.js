async function loadStores(){
    const response=await fetch(window.BRUCE_API_URL+'/admin/stores');if(!response.ok)throw new Error('Não foi possível consultar as lojas.');
    const stores=await response.json();const list=document.getElementById('storeList');list.replaceChildren();
    for(const store of stores){
        const row=document.createElement('li');row.className='store-item';const details=document.createElement('div');
        const name=document.createElement('strong');name.textContent=store.name;const email=document.createElement('small');email.textContent=store.email;const status=document.createElement('small');status.textContent=store.active?'Ativa':'Desativada';status.className=store.active?'active-label':'inactive-label';details.append(name,email,status);row.append(details);
        if(store.id!=='legacy'){
            const button=document.createElement('button');button.type='button';button.textContent=store.active?'Desativar':'Ativar';button.setAttribute('aria-label',button.textContent+' loja '+store.name);
            button.addEventListener('click',async()=>{if(store.active&&!confirm('Desativar a loja '+store.name+' e encerrar seus acessos?'))return;button.disabled=true;try{const result=await fetch(window.BRUCE_API_URL+'/admin/stores/'+store.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!store.active})});if(!result.ok)throw Error('Não foi possível alterar o acesso.');await loadStores();}catch(error){document.getElementById('adminFeedback').textContent=error.message;button.disabled=false;}});row.append(button);
        }
        list.append(row);
    }
}
document.addEventListener('DOMContentLoaded',async()=>{try{const user=await window.authReady;if(user.role!=='admin'){location.replace('index.html');return;}await loadStores();}catch(error){document.getElementById('adminFeedback').textContent=error.message;}});
document.getElementById('storeForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.currentTarget.querySelector('button');const feedback=document.getElementById('adminFeedback');button.disabled=true;feedback.textContent='';
    try{const response=await fetch(window.BRUCE_API_URL+'/admin/stores',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.getElementById('storeName').value,email:document.getElementById('storeEmail').value,password:document.getElementById('storePassword').value})});const data=await response.json();if(!response.ok)throw Error(data.error);event.target.reset();feedback.textContent='Loja criada. Forneça o e-mail e a senha inicial ao responsável.';await loadStores();}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}
});
