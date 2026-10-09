const loginBase=window.BRUCE_API_URL;
const loginFeedback=document.getElementById('loginFeedback');
fetch(loginBase+'/auth/setup-status',{credentials:'include'}).then(response=>response.json()).then(data=>{document.getElementById('setupHint').hidden=data.initialized;}).catch(()=>{loginFeedback.textContent='Servidor indisponível. Verifique se o serviço está rodando.';});
fetch(loginBase+'/auth/me',{credentials:'include'}).then(response=>{if(response.ok)location.replace('index.html');}).catch(()=>{});
document.getElementById('loginForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=document.getElementById('loginButton');button.disabled=true;button.textContent='Entrando…';loginFeedback.textContent='';
    try {
        const response=await fetch(loginBase+'/auth/login',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value}),signal:AbortSignal.timeout(15000)});
        const data=await response.json();if(!response.ok)throw new Error(data.error||'Não foi possível entrar.');
        document.getElementById('password').value='';location.replace('index.html');
    }catch(error){loginFeedback.textContent=error.name==='TypeError'||error.name==='TimeoutError'?'Servidor indisponível. Tente novamente.':error.message;}
    finally{button.disabled=false;button.textContent='Entrar';}
});
