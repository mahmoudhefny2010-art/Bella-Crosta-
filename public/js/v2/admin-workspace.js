// Feather icons are distributed under the MIT license; see /assets/admin-icons-LICENSE.txt.
export const workspaceIcon = name => `<span class="workspace-icon" style="--workspace-icon:url('/assets/admin/${name}.svg')" aria-hidden="true"></span>`;

export function workspaceShell({ tab, tools, user, language, esc, kind = 'admin' }) {
  const ar = language === 'ar';
  const owner = kind === 'owner', base = owner ? '/owner' : '/admin';
  const text = (en, arabic) => esc(ar ? arabic : en);
  const label = tool => esc(ar ? tool.ar : tool.title);
  const navItems = owner ? tools.map(tool => [tool.id, {orders:'shopping-bag',kitchen:'package',delivery:'users',analytics:'bar-chart-2'}[tool.id],tool.title,tool.ar]) : [
    ['overview', 'grid', 'Overview', 'نظرة عامة'],
    ['content', 'globe', 'Website content', 'محتوى الموقع'],
    ['products', 'package', 'Menu management', 'إدارة المنيو'],
    ['staff', 'users', 'Staff & access', 'الموظفين والصلاحيات'],
    ['orders', 'shopping-bag', 'Orders & delivery', 'الطلبات والتوصيل'],
    ['sales', 'bar-chart-2', 'Sales & reports', 'المبيعات والتقارير']
  ];
  const nav = items => items.map(([id, icon, en, arabic]) => `<button type="button" data-tab="${id}" class="${tab === id ? 'active' : ''}" ${tab === id ? 'aria-current="page"' : ''}>${workspaceIcon(icon)}<span>${text(en, arabic)}</span></button>`).join('');
  const tool = tools.find(item => item.id === tab);
  return `<div class="admin-workspace">
    <header class="workspace-header">
      <a class="workspace-brand" href="${base}"><img src="/assets/logo.png" alt="Bella Crosta" width="58" height="58"><span><strong>${owner ? text('Owner Workspace','مساحة المالك') : text('Admin Workspace', 'مساحة الإدارة')}</strong><small>${owner ? text('Restaurant operations','تشغيل المطعم') : text('Restaurant administration', 'إدارة المطعم')}</small></span></a>
      <nav class="workspace-topnav" aria-label="${text('Admin navigation', 'تنقل الإدارة')}">${nav(navItems.filter(item => item[0] !== 'staff'))}</nav>
      <label class="workspace-header-search">${workspaceIcon('search')}<input id="workspace-find" type="search" placeholder="${text('Find tools', 'ابحث عن أداة')}" aria-label="${text('Find tools', 'ابحث عن أداة')}"></label>
      <div class="workspace-actions"><button type="button" data-workspace-action="theme" aria-label="${text('Toggle theme', 'تغيير المظهر')}">${workspaceIcon('moon')}</button><button type="button" data-workspace-action="language" aria-label="${text('Switch language', 'تغيير اللغة')}">${workspaceIcon('globe')}</button><a href="/" aria-label="${text('View website', 'عرض الموقع')}">${workspaceIcon('external-link')}</a><button type="button" data-workspace-action="logout" aria-label="${text('Sign out', 'تسجيل الخروج')}">${workspaceIcon('log-out')}</button></div>
    </header>
    <aside class="workspace-sidebar" aria-label="${text('Workspace', 'مساحة العمل')}">
      <div class="workspace-profile"><span class="workspace-avatar">${esc((user?.name || user?.email || 'A').trim().charAt(0).toUpperCase())}</span><div><strong>${owner ? text('Shop owner','مالك المطعم') : text('Administrator', 'مدير النظام')}</strong><small>${esc(user?.name || '')}</small></div></div>
      <p class="workspace-nav-label">${text('WORKSPACE', 'مساحة العمل')}</p><nav>${nav(navItems)}</nav>
      <a class="workspace-site-link" href="/">${workspaceIcon('external-link')}${text('View website', 'عرض الموقع')}</a>
    </aside>
    <section class="workspace-main"><div class="workspace-titlebar"><div><h1 tabindex="-1">${tab === 'overview' ? text('Admin Dashboard', 'لوحة الإدارة') : label(tool)}</h1><p>${tab === 'overview' ? text('Everything you need to manage your restaurant, in one place.', 'كل ما تحتاجه لإدارة مطعمك في مكان واحد.') : esc(ar ? tool.descriptionAr : tool.description)}</p></div>${owner ? `<button type="button" class="workspace-refresh" id="owner-refresh">${workspaceIcon('refresh-cw')}${text('Refresh','?????')}</button>` : tab === 'overview' ? `<button type="button" class="workspace-refresh" id="workspace-refresh">${workspaceIcon('refresh-cw')}${text('Refresh overview', 'تحديث الملخص')}</button>` : `<button type="button" class="workspace-refresh" data-tab="overview">${workspaceIcon(ar ? 'arrow-right' : 'arrow-left')}${text('All tools', 'كل الأدوات')}</button>`}</div><div id="admin-view" class="admin-page"></div></section>
  </div>`;
}

export function overviewMarkup({ tools, language, esc }) {
  const ar = language === 'ar', text = (en, arabic) => esc(ar ? arabic : en);
  const groupNames = { content: text('Website','الموقع'), products: text('Menu', 'المنيو'), staff: text('Team & access', 'الفريق والصلاحيات'), orders: text('Operations', 'التشغيل'), sales: text('Insights', 'التقارير') };
  const icons = { content:'globe', products: 'package', staff: 'users', orders: 'shopping-bag', sales: 'bar-chart-2' };
  return `<div id="workspace-summary" class="workspace-stats" aria-live="polite" aria-busy="true"></div><p id="workspace-summary-error" class="error" hidden></p>
    <div class="workspace-tools-heading"><div><h2>${text('Management tools', 'أدوات الإدارة')}</h2><p>${text(tools.length + ' tools · Choose a tool to open its workspace.', tools.length + ' أدوات · اختار أداة لفتح مساحة العمل الخاصة بها.')}</p></div><label class="workspace-tool-search">${workspaceIcon('search')}<input id="workspace-search" type="search" placeholder="${text('Search tools…', 'ابحث في الأدوات…')}" aria-label="${text('Search tools', 'ابحث في الأدوات')}"></label></div>
    <div class="workspace-tool-controls"><button type="button" id="workspace-arrange" aria-pressed="false">${workspaceIcon('sliders')}${text('Arrange cards', 'ترتيب الكروت')}</button><span id="workspace-arrange-hint" hidden>${text('Use the arrows to change the order. Your layout is saved on this device.', 'استخدم الأسهم لتغيير الترتيب. يتم حفظ الترتيب على جهازك.')}</span></div>
    <div class="workspace-filters" aria-label="${text('Tool categories', 'تصنيفات الأدوات')}"><button type="button" data-filter="all" class="active" aria-pressed="true">${text('All tools', 'كل الأدوات')}</button>${tools.map(tool => `<button type="button" data-filter="${tool.id}" aria-pressed="false">${groupNames[tool.id]}</button>`).join('')}</div>
    <nav class="admin-widgets" aria-label="${text('Management tools', 'أدوات الإدارة')}">${tools.map(tool => `<article class="workspace-tool-card" data-tool-card="${tool.id}"><button type="button" data-tab="${tool.id}" class="admin-widget"><span class="admin-widget-top"><span class="admin-widget-icon tone-${tool.id}">${workspaceIcon(icons[tool.id])}</span>${workspaceIcon(ar ? 'arrow-left' : 'arrow-right')}</span><strong>${esc(ar ? tool.ar : tool.title)}</strong><span class="admin-widget-description">${esc(ar ? tool.descriptionAr : tool.description)}</span><span class="admin-widget-action">${groupNames[tool.id]}</span></button><div class="workspace-reorder" hidden><button type="button" data-move="-1" data-tool="${tool.id}" aria-label="${text('Move earlier', 'تحريك للأمام')}">${workspaceIcon(ar ? 'arrow-right' : 'arrow-left')}</button><button type="button" data-move="1" data-tool="${tool.id}" aria-label="${text('Move later', 'تحريك للخلف')}">${workspaceIcon(ar ? 'arrow-left' : 'arrow-right')}</button></div></article>`).join('')}</nav><p id="workspace-no-results" class="empty" hidden>${text('No tools match your search.', 'لا توجد أدوات تطابق بحثك.')}</p>`;
}

export async function bindWorkspace(root, { tab, tools, language, esc, user, api, money, toast, navigate }) {
  const ar = language === 'ar';
  let filter = 'all', arranging = false;
  const cards = () => [...root.querySelectorAll('[data-tool-card]')];
  const applySearch = query => {
    const value = query.trim().toLocaleLowerCase();
    cards().forEach(card => { card.hidden = (filter !== 'all' && card.dataset.toolCard !== filter) || !card.textContent.toLocaleLowerCase().includes(value); });
    const empty = root.querySelector('#workspace-no-results');
    if (empty) empty.hidden = cards().some(card => !card.hidden);
  };
  const updateSummary = async () => {
    const container = root.querySelector('#workspace-summary');
    if (!container) return;
    const refresh = root.querySelector('#workspace-refresh');
    refresh.disabled = true; container.setAttribute('aria-busy', 'true');
    const labels = [
      ['products', 'package', 'Available products', 'منتجات متاحة'],
      ['activeOrders', 'shopping-bag', 'Active orders', 'طلبات جارية'],
      ['staff', 'users', 'Active staff', 'موظفين نشطين'],
      ['revenue', 'bar-chart-2', 'Delivered revenue today', 'إيراد التوصيلات اليوم']
    ];
    const draw = data => { container.innerHTML = labels.map(([key, icon, en, arabic], index) => `<article class="workspace-stat"><span class="admin-widget-icon tone-${['products','orders','staff','sales'][index]}">${workspaceIcon(icon)}</span><div><span>${esc(ar ? arabic : en)}</span><strong>${data ? esc(key === 'revenue' ? money(data[key]) : data[key]) : '—'}</strong></div></article>`).join(''); };
    if (!container.children.length) draw(null);
    const error = root.querySelector('#workspace-summary-error'); error.hidden = true;
    try { const data = await api('/api/admin/overview'); draw(data); }
    catch (failure) { error.textContent = ar ? 'تعذر تحميل الملخص. اضغط تحديث للمحاولة مرة أخرى.' : 'Could not load the overview. Use Refresh overview to try again.'; error.hidden = false; }
    finally { container.setAttribute('aria-busy', 'false'); refresh.disabled = false; }
  };
  const grid = root.querySelector('.admin-widgets');
  if (grid) {
    try { const saved = JSON.parse(localStorage.getItem('bella_admin_card_order') || '[]'); if (Array.isArray(saved)) saved.forEach(id => { const card = cards().find(card => card.dataset.toolCard === id); if (card) grid.append(card); }); } catch {}
  }
  root.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button) return;
    try {
      if (button.dataset.tab) { await navigate(button.dataset.tab); document.querySelector('.workspace-titlebar h1')?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
      else if (button.dataset.workspaceAction) {
        const ids = { theme: 'theme-toggle', language: 'language', logout: 'logout' };
        document.getElementById(ids[button.dataset.workspaceAction])?.click();
      } else if (button.id === 'workspace-refresh') await updateSummary();
      else if (button.dataset.filter) {
        filter = button.dataset.filter;
        root.querySelectorAll('[data-filter]').forEach(item => { const active = item.dataset.filter === filter; item.classList.toggle('active', active); item.setAttribute('aria-pressed', String(active)); });
        applySearch(root.querySelector('#workspace-search').value);
      } else if (button.id === 'workspace-arrange') {
        arranging = !arranging; button.setAttribute('aria-pressed', String(arranging));
        root.querySelectorAll('.workspace-reorder, #workspace-arrange-hint').forEach(item => { item.hidden = !arranging; });
      } else if (button.dataset.move) {
        const list = cards(), index = list.findIndex(card => card.dataset.toolCard === button.dataset.tool), next = index + Number(button.dataset.move);
        if (next < 0 || next >= list.length) return;
        if (next < index) grid.insertBefore(list[index], list[next]); else grid.insertBefore(list[next], list[index]);
        try { localStorage.setItem('bella_admin_card_order', JSON.stringify(cards().map(card => card.dataset.toolCard))); } catch {}
        button.focus({ preventScroll: true });
      }
    } catch (error) { toast(error.message); }
  });
  root.querySelector('#workspace-search')?.addEventListener('input', event => {
    root.querySelector('#workspace-find').value = event.target.value; applySearch(event.target.value);
  });
  root.querySelector('#workspace-find')?.addEventListener('input', async event => {
    const query = event.target.value;
    if (tab !== 'overview') {
      try { await navigate('overview'); const search = document.querySelector('#workspace-find'); search.value = query; document.querySelector('#workspace-search').value = query; search.dispatchEvent(new Event('input')); search.focus(); } catch (error) { toast(error.message); }
    } else { root.querySelector('#workspace-search').value = query; applySearch(query); }
  });
  if (tab === 'overview') await updateSummary();
}
