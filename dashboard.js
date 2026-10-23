/* Presentation and accessibility layer. Business operations remain in index.html. */
const pageInfo = {
    gestao: ['Gestão da loja', 'O que acontece no balcão e na oficina, em um só lugar.', 'Nova venda'],
    os: ['Ordens de serviço', 'Consulte os reparos e registre novos atendimentos.', '+ Nova OS'],
    pdv: ['Ponto de venda', 'Venda de acessórios e movimentação de estoque.', '+ Novo produto'],
    caixa: ['Controle de caixa', 'Abertura, movimentações e conferência do dia.', 'Atualizar caixa'],
    relatorios: ['Relatórios', 'Faturamento e histórico de serviços e vendas.', 'Atualizar relatório'],
    zap: ['WhatsApp', 'Conexão da loja e envio de mensagens ao cliente.', 'Conectar WhatsApp']
};
const paths = ['M9 3h6v4H9z M7 5H5v16h14V5h-2 M8 12h8 M8 16h5', 'M3 3h2l3 12h10l3-8H6 M9 20h.01 M18 20h.01', 'M3 6h18v14H3z M3 10h18 M15 15h3', 'M4 20h16 M7 16V9 M12 16V4 M17 16v-5', 'M21 11a9 9 0 0 1-9 9H4l-2 2v-8a9 9 0 1 1 19-3 M7 10h10 M7 14h6'];
const formatarMoeda = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(String(value).replace(',', '.')) || 0);
let activePage = 'gestao';
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
    document.body.dataset.page = page;
    document.body.classList.remove('sale-view');
    originalChangePage(page);
    const [title, description, action] = pageInfo[page];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('breadcrumbTitle').textContent = title;
    document.getElementById('pageDescription').textContent = description;
    document.getElementById('primaryAction').textContent = action;
    document.getElementById('newCustomer').hidden = page !== 'os';
    document.querySelector('.eyebrow').textContent = '';
    document.querySelector('.operational-summary').hidden = page !== 'os';
    const actions = document.querySelector('.heading-actions');
    (page === 'os' ? document.getElementById('ordersActionBar') : document.querySelector('.page-heading')).append(actions);
    const primary = document.getElementById('primaryAction');
    if (page === 'os') { primary.setAttribute('aria-controls','orderEditor'); primary.setAttribute('aria-expanded',String(!document.getElementById('orderEditor').hidden)); }
    else { primary.removeAttribute('aria-controls'); primary.removeAttribute('aria-expanded'); }
    document.querySelectorAll('.btn-aba').forEach(button => button.setAttribute('aria-current', button.classList.contains('ativo') ? 'page' : 'false'));
    renderManagementOverview();
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
        button.insertAdjacentHTML('afterbegin', `<svg class="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[i] || 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'}"/></svg>`);
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
        if (activePage === 'gestao') mudarAba('pdv');
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
    const requested = location.hash.slice(1); mudarAba(pageInfo[requested] ? requested : 'gestao');
});
window.addEventListener('hashchange', () => { const page = location.hash.slice(1); if (pageInfo[page]) mudarAba(page); });

/* The catalogue uses the same stock and sale operations as the original selector. */
let catalogueCategory = 'Todos';
function productCategory(name) {
    if (/capa|case/i.test(name)) return 'Capas';
    if (/pel[ií]cula/i.test(name)) return 'Películas';
    if (/carregador|fonte/i.test(name)) return 'Carregadores';
    if (/cabo/i.test(name)) return 'Cabos';
    if (/fone|headphone|caixa.*som/i.test(name)) return 'Áudio';
    return 'Outros';
}
function productDrawing(category) {
    const paths = {
        Capas: '<rect x="23" y="9" width="34" height="62" rx="9"/><rect x="28" y="15" width="13" height="17" rx="4"/><circle cx="32" cy="20" r="1.5"/><circle cx="37" cy="26" r="1.5"/><path d="M34 65h12"/>',
        Películas: '<rect x="23" y="9" width="34" height="62" rx="6"/><path d="M33 15h14M28 57l24-32M28 44l13-18M29 65h22"/>',
        Carregadores: '<rect x="20" y="31" width="40" height="35" rx="8"/><path d="M31 31V15h5v16M45 31V15h5v16M34 51h12M36 47v8M43 47v8"/>',
        Cabos: '<path d="M24 31v13a17 17 0 0 0 34 0v-8a12 12 0 0 0-24 0v8a7 7 0 0 0 14 0v-7"/><rect x="18" y="13" width="12" height="18" rx="3"/><path d="M22 9v4M26 9v4"/><rect x="44" y="24" width="8" height="13" rx="2"/>',
        Áudio: '<path d="M17 44v-9a23 23 0 0 1 46 0v9M17 37h8v24h-8a5 5 0 0 1-5-5V42a5 5 0 0 1 5-5ZM63 37h-8v24h8a5 5 0 0 0 5-5V42a5 5 0 0 0-5-5Z"/>',
        Outros: '<path d="m40 12 25 14v29L40 69 15 55V26zM15 26l25 15 25-15M40 41v28M28 19l25 15"/>'
    };
    return `<svg aria-hidden="true" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${paths[category] || paths.Outros}</svg>`;
}

function renderManagementOverview() {
    const queue = document.getElementById('readyQueue'), stock = document.getElementById('stockWatch');
    if (!queue || !stock) return;
    const orders = osGlobalData.filter(order => order.status === 'PRONTO');
    queue.replaceChildren(); stock.replaceChildren();
    const row = (title, detail, value, className = '') => {
        const item = document.createElement('div'); item.className = `management-row ${className}`;
        const description = document.createElement('div'), heading = document.createElement('strong'), sub = document.createElement('small'), amount = document.createElement('span');
        heading.textContent = title; sub.textContent = detail; amount.textContent = value;
        description.append(heading,sub); item.append(description,amount); return item;
    };
    orders.slice(0,4).forEach(order => queue.append(row(order.clienteNome,`#${order.numeroOS} · ${order.aparelho || 'Ordem de serviço'}`,formatarMoeda(order.valor))));
    const low = produtosPDV.filter(p=>p.estoque<=3).sort((a,b)=>a.estoque-b.estoque);
    low.slice(0,4).forEach(product=>stock.append(row(product.nome,product.estoque===0?'Reposição necessária':'Estoque baixo',`${product.estoque} un.`,product.estoque===0?'out-of-stock':'')));
    if (!orders.length) { const empty=document.createElement('p');empty.className='empty-state';empty.textContent='Nenhum aparelho aguardando entrega. Os reparos prontos aparecerão aqui.';queue.append(empty); }
    if (!low.length) { const empty=document.createElement('p');empty.className='empty-state';empty.textContent=produtosPDV.length?'Seus produtos estão com mais de 3 unidades em estoque.':'Cadastre os produtos da loja para acompanhar o estoque.';stock.append(empty); }
}

function renderProductCatalogue() {
    const target = document.getElementById('productCatalogue');
    if (!target) return;
    const term = document.getElementById('catalogueSearch').value.toLocaleLowerCase('pt-BR');
    const availableOnly = document.getElementById('availableOnly').checked;
    const products = produtosPDV.filter(p => (p.nome.toLocaleLowerCase('pt-BR').includes(term) || String(p.id) === term) && (!availableOnly || p.estoque > 0) && (catalogueCategory === 'Todos' || productCategory(p.nome) === catalogueCategory));
    document.getElementById('catalogueCount').textContent = `${products.length} produto${products.length === 1 ? '' : 's'}`;
    target.replaceChildren();
    for (const product of products) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'product-tile'; button.disabled = product.estoque <= 0;
        const name = document.createElement('strong'); name.textContent = product.nome;
        const stock = document.createElement('small'); stock.textContent = product.estoque > 0 ? `${product.estoque} un. em estoque` : 'Sem estoque';
        const price = document.createElement('span'); price.className = 'product-price'; price.textContent = formatarMoeda(product.preco);
        const category = productCategory(product.nome); button.dataset.category = category;
        button.innerHTML = `<span class="product-visual">${productDrawing(category)}</span>`;
        button.append(name, stock, price);
        const plus = document.createElement('span'); plus.className = 'product-add'; plus.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>'; button.append(plus);
        button.setAttribute('aria-label', `Adicionar ${product.nome}, ${formatarMoeda(product.preco)}`);
        button.addEventListener('click', () => {
            if (vendaEmAndamento) return;
            const before = carrinhoPDV.reduce((n,item)=>n+item.quantidade,0);
            document.getElementById('selectProdutoPDV').value = product.id; adicionarAoCarrinhoPDV();
            if (carrinhoPDV.reduce((n,item)=>n+item.quantidade,0) > before) toast(`${product.nome}: carrinho atualizado.`);
        });
        target.append(button);
    }
    if (!products.length) {
        const empty = document.createElement('p'); empty.className = 'catalogue-empty';
        empty.textContent = produtosPDV.length ? 'Nenhum produto corresponde aos filtros. Tente outra busca.' : 'Seu catálogo começa aqui. Cadastre um produto para iniciar as vendas.';
        target.append(empty);
    }
    renderManagementOverview();
}

function enhanceSaleReceipt() {
    document.getElementById('saleItemCount').textContent = `${carrinhoPDV.reduce((n, item) => n + item.quantidade, 0)} itens`;
    const total = carrinhoPDV.reduce((sum, item) => sum + Math.round(item.preco * 100) * item.quantidade, 0) / 100;
    document.getElementById('spanTotalPDV').textContent = formatarMoeda(total);
    const amount = document.getElementById('spanTotalPDV');
    if (amount.dataset.amount !== undefined && amount.dataset.amount !== String(total) && !matchMedia('(prefers-reduced-motion: reduce)').matches) amount.animate([{transform:'scale(.96)'},{transform:'scale(1)'}],{duration:220,easing:'cubic-bezier(.16,1,.3,1)'});
    amount.dataset.amount = String(total);
    const shortcut = document.getElementById('mobileSaleShortcut');
    if (shortcut) { shortcut.hidden = carrinhoPDV.length === 0; shortcut.textContent = `Ver venda (${carrinhoPDV.reduce((n,item)=>n+item.quantidade,0)}) · ${formatarMoeda(total)}`; }
    const empty = document.querySelector('#tabelaCarrinhoPDV td[colspan]');
    if (empty) empty.innerHTML = '<div class="cart-empty"><svg aria-hidden="true" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 12h6l7 28h24l6-21H20M27 51a2 2 0 1 0 0 .1M47 51a2 2 0 1 0 0 .1M32 27h12M38 21v12"/></svg><strong>Sua próxima venda começa aqui</strong><span>Adicione produtos pelo catálogo ao lado.</span></div>';
    document.querySelectorAll('#tabelaCarrinhoPDV tr').forEach((row, index) => {
        const item = carrinhoPDV[index]; if (!item) return;
        row.children[2].textContent = formatarMoeda(Math.round(item.preco * 100) * item.quantidade / 100);
        const cell = row.children[1]; cell.replaceChildren();
        const group = document.createElement('div'); group.className = 'quantity-control';
        for (const delta of [-1, 1]) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = delta < 0 ? '−' : '+';
            button.setAttribute('aria-label', `${delta < 0 ? 'Diminuir' : 'Aumentar'} quantidade de ${item.nome}`);
            const product = produtosPDV.find(p => p.id == item.id);
            button.disabled = delta > 0 && (!product || item.quantidade >= product.estoque);
            button.addEventListener('click', () => {
                if (vendaEmAndamento) return;
                if (delta > 0 && (!product || item.quantidade >= product.estoque)) return;
                item.quantidade += delta;
                if (item.quantidade === 0) carrinhoPDV.splice(index, 1);
                atualizarCarrinhoPDV();
            });
            if (delta > 0) { const amount = document.createElement('span'); amount.textContent = item.quantidade; group.append(amount); }
            group.append(button);
        }
        cell.append(group);
    });
}

function renderRepairChart() {
    const target = document.getElementById('repairChart'); if (!target) return;
    const states = [['EM ANÁLISE','Em análise','amber'],['EM REPARO','Em reparo','blue'],['PRONTO','Prontas','green']];
    const counts = states.map(([status]) => osGlobalData.filter(order => order.status === status).length);
    const max = Math.max(1, ...counts);
    target.innerHTML = states.map(([, label, color], i) => `<div class="chart-row"><span>${label}</span><div class="bar-track"><div class="bar-fill ${color}" style="width:${counts[i] / max * 100}%"></div></div><strong>${counts[i]}</strong></div>`).join('');
    const count = counts.reduce((a,b)=>a+b,0);
    document.getElementById('repairChartNote').textContent = `${count} ${count === 1 ? 'ordem em andamento' : 'ordens em andamento'}. Da análise à entrega, acompanhe as etapas da oficina.`;
    renderManagementOverview();
}

function renderRevenueBreakdown(orders) {
    const target = document.getElementById('revenueBreakdown'); if (!target) return;
    target.replaceChildren();
    const groups = new Map();
    for (const order of orders) {
        const payment = order.pagamento || 'Não informado';
        const cents = Math.round((Number(String(order.valor).replace(',', '.')) || 0) * 100);
        groups.set(payment, (groups.get(payment) || 0) + cents);
    }
    const max = Math.max(1, ...groups.values());
    for (const [label, cents] of [...groups].sort((a,b)=>b[1]-a[1])) {
        const row = document.createElement('div'); row.className = 'revenue-chart-row';
        const name = document.createElement('span'); name.textContent = label;
        const track = document.createElement('div'); track.className = 'bar-track';
        const bar = document.createElement('div'); bar.className = 'bar-fill blue'; bar.style.width = `${cents/max*100}%`; track.append(bar);
        const amount = document.createElement('strong'); amount.textContent = formatarMoeda(cents/100);
        row.append(name, track, amount); target.append(row);
    }
    if (!orders.length) { const empty = document.createElement('p'); empty.textContent = 'Conclua uma venda ou serviço para visualizar a distribuição por pagamento.'; target.append(empty); }
    document.getElementById('revenueBreakdownNote').textContent = `${orders.length} registros concluídos no histórico completo. Total: ${formatarMoeda([...groups.values()].reduce((a,b)=>a+b,0)/100)}.`;
}

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.querySelector('.pdv-grid');
    const [receipt, inventory] = grid.children; receipt.classList.add('sale-receipt'); inventory.classList.add('inventory-panel');
    receipt.querySelector('h2').innerHTML = 'Venda atual <span id="saleItemCount">0 itens</span>';
    const saleBack = document.createElement('button'); saleBack.type='button';saleBack.className='sale-back';saleBack.textContent='Voltar ao catálogo';saleBack.addEventListener('click',()=>{document.body.classList.remove('sale-view');document.getElementById('catalogueSearch').focus();});receipt.prepend(saleBack);
    const legacySelect = document.getElementById('selectProdutoPDV'); legacySelect.hidden=true;legacySelect.previousElementSibling.hidden=true;
    const total = document.getElementById('spanTotalPDV').parentElement; total.classList.add('receipt-total');
    const catalogue = document.createElement('section'); catalogue.className = 'catalogue-panel';
    catalogue.innerHTML = '<header class="catalogue-heading"><div><h2>Produtos da loja</h2><p>Encontre, adicione e venda.</p></div><span id="catalogueCount">Carregando…</span></header><div class="catalogue-search"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><label for="catalogueSearch" class="sr-only">Buscar no catálogo</label><input id="catalogueSearch" type="search" placeholder="Buscar produto pelo nome ou código…" autocomplete="off"><kbd>/</kbd></div><div class="category-tabs" role="group" aria-label="Tipos de acessório"></div><div class="catalogue-filters"><label><input id="availableOnly" type="checkbox"> Apenas em estoque</label><span>Selecione para adicionar</span></div><div id="productCatalogue" class="product-catalogue"></div>';
    for (const category of ['Todos','Capas','Películas','Carregadores','Cabos','Áudio','Outros']) {
        const filter=document.createElement('button');filter.type='button';filter.textContent=category;filter.setAttribute('aria-pressed',String(category==='Todos'));
        filter.addEventListener('click',()=>{catalogueCategory=category;catalogue.querySelectorAll('.category-tabs button').forEach(button=>button.setAttribute('aria-pressed',String(button===filter)));renderProductCatalogue();});catalogue.querySelector('.category-tabs').append(filter);
    }
    const stockDetails = document.createElement('details'); stockDetails.className = 'stock-details';
    const summary = document.createElement('summary'); summary.textContent = 'Gerenciar estoque e entradas'; stockDetails.append(summary, inventory);
    catalogue.append(stockDetails); grid.replaceChildren(catalogue, receipt);
    const shortcut = document.createElement('button'); shortcut.id = 'mobileSaleShortcut'; shortcut.className = 'mobile-sale-shortcut nao-imprimir'; shortcut.type = 'button'; shortcut.hidden = true;
    shortcut.addEventListener('click', () => { document.body.classList.add('sale-view');receipt.scrollIntoView({behavior:'instant',block:'start'});document.getElementById('pagamentoPDV').focus({preventScroll:true}); });
    document.body.append(shortcut);
    document.addEventListener('keydown',event=>{if(event.key==='/'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)&&activePage==='pdv'){event.preventDefault();document.body.classList.remove('sale-view');document.getElementById('catalogueSearch').focus();}});
    document.getElementById('catalogueSearch').addEventListener('input', renderProductCatalogue);
    document.getElementById('availableOnly').addEventListener('change', renderProductCatalogue);
    const originalProducts = atualizarSelectProdutosPDV;
    atualizarSelectProdutosPDV = function () { originalProducts(); renderProductCatalogue(); };
    const originalCart = atualizarCarrinhoPDV;
    atualizarCarrinhoPDV = function () { originalCart(); enhanceSaleReceipt(); };
    const chart = document.createElement('section'); chart.className = 'repair-insight nao-imprimir';
    chart.innerHTML = '<div><h2>Ritmo da oficina</h2><p id="repairChartNote">Carregando ordens…</p></div><div id="repairChart" aria-label="Ordens por etapa"></div>';
    document.querySelector('.operational-summary').after(chart);
    const revenueChart = document.createElement('section'); revenueChart.className = 'revenue-insight';
    revenueChart.innerHTML = '<h2>Faturamento por pagamento</h2><p id="revenueBreakdownNote">Carregando histórico…</p><div id="revenueBreakdown" aria-label="Valores por forma de pagamento"></div>';
    document.querySelector('#aba-relatorios .table-responsive').before(revenueChart);
    const originalSummary = atualizarResumoOperacional;
    atualizarResumoOperacional = function () { originalSummary(); renderRepairChart(); };
    renderProductCatalogue(); enhanceSaleReceipt(); renderRepairChart();
    document.body.dataset.page = activePage;
    const menu = document.createElement('button'); menu.type = 'button'; menu.className = 'mobile-menu'; menu.textContent = 'Menu'; menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-controls','mainNavigation');
    menu.addEventListener('click', () => { const open = document.querySelector('.sidebar').classList.toggle('menu-open'); menu.setAttribute('aria-expanded', String(open)); });
    document.querySelector('.sidebar').prepend(menu);
    document.querySelector('#mainNavigation').addEventListener('click', event => { if (event.target.closest('.btn-aba')) { document.querySelector('.sidebar').classList.remove('menu-open'); menu.setAttribute('aria-expanded','false'); } });
    document.querySelector('.nav-caption').textContent='Sua operação';
    document.querySelector('.brand').setAttribute('aria-label','Bruce Cell · Gestão da loja');
    document.querySelector('.sidebar-note').innerHTML='<span class="note-dot"></span><strong>Balcão & oficina</strong><p>Da entrada do aparelho à próxima venda.</p>';
    document.querySelector('.brand').href='#gestao';
    const iconButton=document.getElementById('refreshData');iconButton.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1"/></svg>';
});
document.addEventListener('click', event => {
    document.querySelectorAll('.print-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
});
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.print-menu[open]').forEach(menu => { menu.open=false; menu.querySelector('summary').focus(); });
});
