(function(){
    document.documentElement.classList.add('auth-pending');
    const rawFetch=window.fetch.bind(window);
    const base=window.BRUCE_API_URL;
    window.authReady=(async()=>{
        try {
            const response=await rawFetch(base+'/auth/me',{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(10000)});
            if(!response.ok){location.replace('login.html');throw new Error('Login necessário.');}
            const data=await response.json();window.currentAccount=data.user;window.csrfToken=data.csrf;return data.user;
        } catch(error) {if(!window.currentAccount)location.replace('login.html');throw error;}
    })();
    window.authReady.catch(()=>{});
    window.fetch=async function(input,options={}) {
        const url=new URL(typeof input==='string'?input:input.url,location.href);
        if(url.origin!==base)return rawFetch(input,options);
        await window.authReady;
        const headers=new Headers(options.headers);
        if(!['GET','HEAD','OPTIONS'].includes(String(options.method||'GET').toUpperCase()))headers.set('X-CSRF-Token',window.csrfToken);
        const response=await rawFetch(input,{...options,headers,credentials:'include'});
        if(response.status===401){location.replace('login.html');throw new Error('Sua sessão expirou.');}
        return response;
    };
    document.addEventListener('DOMContentLoaded',async()=>{
        try {
            const user=await window.authReady;
            const brand=document.querySelector('.brand>span:last-child');
            if(brand){brand.replaceChildren(document.createTextNode(user.store.name));const small=document.createElement('small');small.textContent='ASSISTÊNCIA & VENDAS';brand.append(small);brand.title=user.store.name;}
            const name=document.querySelector('.sidebar-footer strong');if(name)name.textContent=user.store.name;
            const footer=document.querySelector('.sidebar-footer small');if(footer)footer.textContent=user.email;
            const target=document.querySelector('.topbar-actions')||document.querySelector('.account-navigation');
            if(target){
                if(user.role==='admin'){const link=document.createElement('a');link.className='account-link';link.href='admin.html';link.textContent='Lojas';target.append(link);}
                const account=document.createElement('a');account.className='account-link';account.href='account.html';account.textContent='Minha conta';target.append(account);
                const logout=document.createElement('button');logout.type='button';logout.className='account-link';logout.textContent='Sair';logout.addEventListener('click',async()=>{logout.disabled=true;try {const response=await window.fetch(base+'/auth/logout',{method:'POST'});if(!response.ok)throw Error('Falha ao sair.');location.replace('login.html');}catch{logout.disabled=false;alert('Não foi possível sair. Verifique sua conexão.');}});target.append(logout);
            }
            document.documentElement.classList.remove('auth-pending');
        }catch{}
    });
})();
