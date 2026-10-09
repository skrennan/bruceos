document.addEventListener('DOMContentLoaded',async()=>{try{const user=await window.authReady;document.getElementById('accountIdentity').textContent=user.store.name+' · '+user.email;}catch{}});
document.getElementById('passwordForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=event.target.querySelector('button');const feedback=document.getElementById('passwordFeedback');const next=document.getElementById('newPassword').value;
    if(next!==document.getElementById('repeatPassword').value){feedback.textContent='As novas senhas não coincidem.';return;}
    button.disabled=true;feedback.textContent='';try{const response=await fetch(window.BRUCE_API_URL+'/auth/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:document.getElementById('currentPassword').value,password:next})});const data=await response.json();if(!response.ok)throw Error(data.error);location.replace('login.html');}catch(error){feedback.textContent=error.message;button.disabled=false;}
});
