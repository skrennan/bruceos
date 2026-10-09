/* Presentation and accessibility layer. Business operations remain in index.html. */
const pageInfo = {
    os: ['Ordens de serviço', 'Consulte os reparos e registre novos atendimentos.', '+ Nova OS'],
    pdv: ['Ponto de venda', 'Venda de acessórios e movimentação de estoque.', '+ Novo produto'],
    caixa: ['Controle de caixa', 'Abertura, movimentações e conferência do dia.', 'Atualizar caixa'],
    relatorios: ['Relatórios', 'Faturamento e histórico de serviços e vendas.', 'Atualizar relatório'],
    zap: ['WhatsApp', 'Conexão da loja e envio de mensagens ao cliente.', 'Conectar WhatsApp']
};
const paths = ['M9 3h6v4H9z M7 5H5v16h14V5h-2 M8 12h8 M8 16h5', 'M3 3h2l3 12h10l3-8H6 M9 20h.01 M18 20h.01', 'M3 6h18v14H3z M3 10h18 M15 15h3', 'M4 20h16 M7 16V9 M12 16V4 M17 16v-5', 'M21 11a9 9 0 0 1-9 9H4l-2 2v-8a9 9 0 1 1 19-3 M7 10h10 M7 14h6'];
const formatarMoeda = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(String(value).replace(',', '.')) || 0);
let activePage = 'os';
let previousFocus = null;

function atualizarResumoOperacional() {
    const counts = ['EM ANÁLISE', 'EM REPARO', 'PRONTO'].map(status => osGlobalData.filter(item => item.status === status).length);
    document.querySelectorAll('.summary-count').forEach((el, i) => { el.textContent = counts[i]; });
}

function toast(message) { document.getElementById('feedbackToast').textContent = message; clearTimeout(toast.timer); toast.timer = setTimeout(() => { document.getElementById('feedbackToast').textContent = ''; }, 4000); }

const originalChangePage = mudarAba;
mudarAba = function (page) {
    if (!pageInfo[page]) return;
    activePage = page;
    originalChangePage(page);
    const [title, description, action] = pageInfo[page];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('breadcrumbTitle').textContent = title;
    document.getElementById('pageDescription').textContent = description;
    document.getElementById('primaryAction').textContent = action;
    document.getElementById('newCustomer').hidden = page !== 'os';
    document.querySelector('.eyebrow').textContent = ({os:'ATENDIMENTO',pdv:'BALCÃO',caixa:'FINANCEIRO',relatorios:'RESULTADOS',zap:'COMUNICAÇÃO'})[page];
    document.querySelector('.operational-summary').hidden = page !== 'os';
    const actions = document.querySelector('.heading-actions');
    (page === 'os' ? document.getElementById('ordersActionBar') : document.querySelector('.page-heading')).append(actions);
    const primary = document.getElementById('primaryAction');
    if (page === 'os') { primary.setAttribute('aria-controls','orderEditor'); primary.setAttribute('aria-expanded',String(!document.getElementById('orderEditor').hidden)); }
    else { primary.removeAttribute('aria-controls'); primary.removeAttribute('aria-expanded'); }
    document.querySelectorAll('.btn-aba').forEach(button => button.setAttribute('aria-current', button.classList.contains('ativo') ? 'page' : 'false'));
    history.replaceState(null, '', '#' + page);
};

function abrirEditor(kind) {
    const panel = document.getElementById(kind === 'customer' ? 'customerEditor' : 'orderEditor');
    panel.hidden = false;
    document.getElementById(kind === 'customer' ? 'newCustomer' : 'primaryAction').setAttribute('aria-expanded', 'true');
    panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    panel.querySelector(kind === 'customer' ? '#nome' : '#selectCliente').focus({ preventScroll:true });
}

function renderizarPublicidade(config) {
    const slot = document.getElementById('sponsorSlot');
    slot.hidden = true;
    if (!config?.enabled || !config.sponsor || !config.title || !config.url) return;
    let target;
    try { target = new URL(config.url); } catch { return; }
    if (target.protocol !== 'https:' || target.username || target.password) return;
    slot.querySelector('.sponsor-name').textContent = config.sponsor;
    slot.querySelector('h3').textContent = config.title;
    slot.querySelector('p').textContent = config.description || '';
    const link = slot.querySelector('a');
    link.textContent = config.cta || 'Conhecer parceiro';
    link.href = target.href;
    slot.hidden = false;
}

// Display connection failures without leaving misleading loading placeholders.
const nativeFetch = window.fetch.bind(window);
let lastRequest = 0;
window.fetch = async function (...args) {
    const requestId = ++lastRequest;
    const options = { ...args[1] };
    if (!options.signal && typeof AbortSignal.timeout === 'function') options.signal = AbortSignal.timeout(15000);
    try {
        const response = await nativeFetch(args[0], options);
        if (requestId === lastRequest) document.getElementById('connectionNotice').hidden = true;
        if (!response.ok && options.method && options.method !== 'GET') toast('Não foi possível concluir a operação. Confira a mensagem do formulário.');
        return response;
    } catch (error) {
        document.getElementById('connectionNotice').hidden = false;
        document.querySelectorAll('tbody').forEach(body => {
            if (body.textContent.includes('Carregando')) body.innerHTML = `<tr><td colspan="6">Não foi possível carregar os dados. Use o botão de atualizar para tentar novamente.</td></tr>`;
        });
        ['fatHoje', 'fatSemana', 'fatMes'].forEach(id => { document.getElementById(id).textContent = '—'; });
        throw error;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('mainNavigation').append(document.querySelector('.abas-container'));
    document.querySelectorAll('.btn-aba').forEach((button, i) => {
        button.insertAdjacentHTML('afterbegin', `<svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[i]}"/></svg>`);
        button.type = 'button';
    });
    document.querySelector('.topbar-actions').prepend(document.querySelector('.btn-tema'));
    const whatsappBar = document.querySelector('.whatsapp-status-bar');
    const whatsappActions = document.createElement('div');whatsappActions.className='whatsapp-actions';
    const connectButton = whatsappBar.querySelector('button');connectButton.textContent='Conectar WhatsApp';whatsappActions.append(connectButton);
    const disconnect = document.createElement('button');disconnect.type='button';disconnect.id='disconnectWhatsApp';disconnect.textContent='Desconectar';disconnect.disabled=true;
    disconnect.addEventListener('click',async()=>{if(!confirm('Desconectar o WhatsApp desta loja? Será necessário escanear um novo QR Code.'))return;disconnect.disabled=true;try {const response=await fetch(API_URL+'/whatsapp/disconnect',{method:'POST'});if(!response.ok)throw Error('Não foi possível desconectar.');qrGeradoAnterior='';await verificarStatusWhatsApp();}catch(error){toast(error.message);disconnect.disabled=false;}});
    whatsappActions.append(disconnect);whatsappBar.append(whatsappActions);
    document.getElementById('todayLabel').textContent = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());
    document.querySelectorAll('.fat-card').forEach((card, i) => {
        card.querySelector('h3').textContent = ['Hoje', 'Nesta semana', 'Neste mês'][i];
        card.insertAdjacentHTML('beforeend', '<div class="metric-caption">OS e vendas concluídas</div>');
    });
    document.querySelector('.faturamento-grid').insertAdjacentHTML('afterend', `<div class="operational-summary nao-imprimir" aria-label="Resumo das ordens">${['Em análise', 'Em reparo', 'Prontas para entrega'].map((label, i) => `<button type="button" class="summary-chip" data-filter="${i}"><strong class="summary-count">—</strong> ${label}</button>`).join('')}</div>`);
    document.querySelectorAll('.summary-chip').forEach(button => button.addEventListener('click', () => {
        mudarAba('os');
        document.getElementById('filtroStatus').value = ['EM ANÁLISE', 'EM REPARO', 'Pronto'][Number(button.dataset.filter)];
        filtrarOS();
        document.querySelector('.orders-history').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    }));
    const statusFilter = document.getElementById('filtroStatus');
    ['EM ANÁLISE', 'EM REPARO'].forEach(status => statusFilter.add(new Option(status === 'EM ANÁLISE' ? 'Em análise' : 'Em reparo', status)));
    const originalFilter = filtrarOS;
    filtrarOS = function () {
        const value = statusFilter.value;
        if (value === 'EM ANÁLISE' || value === 'EM REPARO') {
            const all = osGlobalData;
            try { osGlobalData = all.filter(order => order.status === value); originalFilter(); }
            finally { osGlobalData = all; }
        } else originalFilter();
        const rows = document.querySelectorAll('#tabelaOS tr');
        const count = rows.length === 1 && rows[0].querySelector('[colspan]') ? 0 : rows.length;
        document.getElementById('visibleOrderCount').textContent = count;
        document.getElementById('orderCountLabel').textContent = count === 1 ? 'ordem nesta consulta' : 'ordens nesta consulta';
        document.querySelectorAll('.summary-chip').forEach((button,i) => button.setAttribute('aria-pressed', String(value === ['EM ANÁLISE','EM REPARO','Pronto'][i])));
    };
    document.body.insertAdjacentHTML('beforeend', '<div id="feedbackToast" class="toast nao-imprimir" role="status" aria-live="polite"></div>');
    document.querySelectorAll('label').forEach(label => {
        const input = label.nextElementSibling;
        if (input?.matches('input,select,textarea') && input.id) label.htmlFor = input.id;
    });
    document.querySelectorAll('.msg').forEach(el => { el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); });
    document.querySelectorAll('input[type="number"]').forEach(input => { input.min = '0'; input.step = '1'; });
    ['telefone', 'zapNumero'].forEach(id => { const input = document.getElementById(id); input.type = 'tel'; input.inputMode = 'tel'; input.autocomplete = 'tel'; });
    document.getElementById('inputBusca').setAttribute('aria-label', 'Buscar por cliente, aparelho ou número da ordem');
    statusFilter.setAttribute('aria-label', 'Filtrar ordens por status');
    document.getElementById('primaryAction').addEventListener('click', () => {
        if (activePage === 'os') abrirEditor('order');
        if (activePage === 'pdv') abrirModalProduto();
        if (activePage === 'caixa') carregarStatusCaixa();
        if (activePage === 'relatorios') carregarRelatorios();
        if (activePage === 'zap') abrirModalQR();
    });
    document.getElementById('refreshData').addEventListener('click', async event => {
        const button = event.currentTarget;
        button.disabled = true;
        try { await Promise.all([carregarFaturamento(), carregarOS(), carregarClientes(), carregarProdutosServidor(), verificarStatusWhatsApp()]); if (activePage === 'caixa') await carregarStatusCaixa(); if (activePage === 'relatorios') await carregarRelatorios(); if (document.getElementById('connectionNotice').hidden) toast('Dados atualizados.'); }
        finally { button.disabled = false; }
    });
    document.querySelectorAll('.modal-fundo').forEach(modal => {
        const content = modal.querySelector('.modal-conteudo');
        content.setAttribute('role', 'dialog'); content.setAttribute('aria-modal', 'true'); content.tabIndex = -1;
        const heading = content.querySelector('h3'); if (!heading.id) heading.id = modal.id + 'Title'; content.setAttribute('aria-labelledby', heading.id);
        const observer = new MutationObserver(() => {
            const open = modal.style.display === 'flex';
            if (open) { previousFocus = document.activeElement; content.focus(); }
            document.body.classList.toggle('modal-open', Array.from(document.querySelectorAll('.modal-fundo')).some(m => m.style.display === 'flex'));
            if (!open && previousFocus?.isConnected) previousFocus.focus();
        });
        observer.observe(modal, { attributes: true, attributeFilter: ['style'] });
        modal.addEventListener('click', event => { if (event.target === modal) fecharModal(modal.id); });
        modal.addEventListener('keydown', event => {
            if (event.key === 'Escape') fecharModal(modal.id);
            if (event.key !== 'Tab') return;
            const controls = [...content.querySelectorAll('button,input:not([type="hidden"]),select,textarea,a[href]')].filter(el => !el.disabled && el.getClientRects().length);
            const first = controls[0], last = controls.at(-1);
            if (!first) { event.preventDefault(); return; }
            if (event.shiftKey && (document.activeElement === first || document.activeElement === content)) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && (document.activeElement === last || document.activeElement === content)) { event.preventDefault(); first.focus(); }
        });
    });
    const cards = document.querySelectorAll('#aba-os > .card');
    [cards[0], cards[1]].forEach((card,i) => {
        card.id = i === 0 ? 'customerEditor' : 'orderEditor';
        card.classList.add('editor-panel'); card.hidden = true;
        const close = document.createElement('button'); close.type = 'button'; close.className = 'editor-close'; close.textContent = '×'; close.setAttribute('aria-label', i === 0 ? 'Fechar cadastro de cliente' : 'Fechar nova ordem');
        close.addEventListener('click', () => {card.hidden=true; const trigger=document.getElementById(i===0?'newCustomer':'primaryAction'); trigger.setAttribute('aria-expanded','false'); trigger.focus();});
        card.prepend(close);
    });
    const historyCard = cards[2]; historyCard.classList.add('orders-history');
    const sectionHeading = document.createElement('div'); sectionHeading.className = 'section-heading';
    sectionHeading.append(historyCard.querySelector('h2'));
    sectionHeading.insertAdjacentHTML('beforeend','<span class="section-meta"><strong id="visibleOrderCount">—</strong> <span id="orderCountLabel">ordens nesta consulta</span></span>');
    historyCard.prepend(sectionHeading);
    sectionHeading.insertAdjacentHTML('beforeend','<div id="ordersActionBar" class="orders-action-bar"></div>');
    const newCustomer = document.getElementById('newCustomer');
    newCustomer.setAttribute('aria-controls','customerEditor'); newCustomer.setAttribute('aria-expanded','false');
    newCustomer.addEventListener('click',()=>abrirEditor('customer'));
    const primaryAction = document.getElementById('primaryAction'); primaryAction.setAttribute('aria-controls','orderEditor'); primaryAction.setAttribute('aria-expanded','false');
    document.getElementById('workspace').insertAdjacentHTML('beforeend','<aside id="sponsorSlot" class="sponsor-strip nao-imprimir" aria-label="Publicidade de parceiro" hidden><div><div class="sponsor-label">Publicidade <span class="sponsor-name"></span></div><h3></h3><p></p></div><a class="sponsor-link" target="_blank" rel="sponsored noopener noreferrer"></a></aside><footer class="workspace-footer nao-imprimir"><span>Bruce Cell · Gestão de assistência técnica</span><span>Ordens, vendas e estoque</span></footer>');
    nativeFetch(API_URL + '/publicidade.json').then(response => response.ok ? response.json() : null).then(renderizarPublicidade).catch(()=>{});
    atualizarResumoOperacional();
    filtrarOS();
    carregarFaturamento();
    const requested = location.hash.slice(1); mudarAba(pageInfo[requested] ? requested : 'os');
});
window.addEventListener('hashchange', () => { const page = location.hash.slice(1); if (pageInfo[page]) mudarAba(page); });
document.addEventListener('click', event => {
    document.querySelectorAll('.print-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
});
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.print-menu[open]').forEach(menu => { menu.open=false; menu.querySelector('summary').focus(); });
});
