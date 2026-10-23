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
            document.body.classList.toggle('dark-mode',localStorage.getItem('brucecell_tema')==='escuro');
            const user=await window.authReady;
            const brand=document.querySelector('.brand>span:last-child');
            if(brand){brand.innerHTML='bruce<span class="brand-word">cell</span>';const small=document.createElement('small');small.textContent=user.store.name;brand.append(small);brand.title=user.store.name;}
            const name=document.querySelector('.sidebar-footer strong');if(name)name.textContent=user.store.name;
            const footer=document.querySelector('.sidebar-footer small');if(footer)footer.textContent=user.email;
            const avatar=document.querySelector('.sidebar-footer .avatar');if(avatar)avatar.textContent=user.store.name.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase();
            document.title=user.store.name+' | Gestão e WhatsApp';
            let target=document.querySelector('.topbar-actions')||document.querySelector('.account-navigation');
            if(target?.classList.contains('topbar-actions')){
                const menu=document.createElement('details');menu.className='account-menu';const summary=document.createElement('summary');summary.textContent='Minha loja';const content=document.createElement('div');content.className='account-menu-content';menu.append(summary,content);target.append(menu);target=content;
                document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
                document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus();}});
            }
            if(target){
                if(user.role==='admin'){const link=document.createElement('a');link.className='account-link';link.href='admin.html';link.textContent='Lojas';target.append(link);}
                const integration=document.createElement('a');integration.className='account-link';integration.href='integrations.html';integration.textContent='API e plano';target.append(integration);
                const account=document.createElement('a');account.className='account-link';account.href='account.html';account.textContent='Minha conta';target.append(account);
                const logout=document.createElement('button');logout.type='button';logout.className='account-link';logout.textContent='Sair';logout.addEventListener('click',async()=>{logout.disabled=true;try {const response=await window.fetch(base+'/auth/logout',{method:'POST'});if(!response.ok)throw Error('Falha ao sair.');location.replace('login.html');}catch{logout.disabled=false;alert('Não foi possível sair. Verifique sua conexão.');}});target.append(logout);
            }
            document.documentElement.classList.remove('auth-pending');
        }catch{}
    });
})();
