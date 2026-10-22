import { receiptNumber } from '../receipt.js';
import { paymentSummary } from '../payment-summary.js';
import { workspaceShell, workspaceIcon } from '../admin-workspace.js';

export default async function ownerPage(ctx) {
  const { app, $, user, api, esc, status, money, language, requireUser, toast } = ctx;
  if (!requireUser()) return;
  const assignedRoles = user?.roles || [user?.role];
  if (!assignedRoles.includes('owner')) { app.innerHTML = '<div class="container page"><h1>Access denied</h1></div>'; return; }
  const ar = language === 'ar', text = (en, arabic) => esc(ar ? arabic : en);
  const tools = [
    {id:'orders',title:'Orders',ar:'الطلبات',description:'Manage orders and follow every stage.',descriptionAr:'إدارة الطلبات ومتابعة مراحلها.'},
    {id:'kitchen',title:'Kitchen status',ar:'حالة المطبخ',description:'Live preparation and ready-for-pickup queues.',descriptionAr:'متابعة التحضير والطلبات الجاهزة للاستلام.'},
    {id:'delivery',title:'Delivery assignment',ar:'توزيع التوصيل',description:'Assign active delivery drivers to orders.',descriptionAr:'تعيين مندوبي التوصيل النشطين للطلبات.'},
    {id:'analytics',title:'Analytics & reports',ar:'التحليلات والتقارير',description:'Filter business results by order date and export to Excel.',descriptionAr:'تصفية النتائج حسب تاريخ الطلب وتنزيل تقارير Excel.'}
  ];
  const states = ['PLACED','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
  const url = new URLSearchParams(location.search), today = new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo'}).format(new Date());
  const tab = tools.some(tool => tool.id === url.get('tab')) ? url.get('tab') : 'orders';
  let filters = { from:url.get('from') || today, to:url.get('to') || today, status:url.get('status') || (tab === 'delivery' ? 'ACTIVE' : 'ALL'), search:url.get('search') || '',page:Number(url.get('page')) || 1,limit:25 };
  let version = 0;
  document.body.classList.add('admin-mode');
  app.innerHTML = workspaceShell({tab,tools,user,language,esc,kind:'owner'});
  const root = $('.admin-workspace'), view = $('#admin-view');
  const filterForm = () => `<form id="owner-filters" class="owner-filters panel"><label>${text('From','من')}<input type="date" name="from" value="${esc(filters.from)}" required></label><label>${text('To','إلى')}<input type="date" name="to" value="${esc(filters.to)}" required></label><label>${text('Status','الحالة')}<select name="status">${['ALL','ACTIVE',...states].map(value => `<option value="${value}" ${value === filters.status ? 'selected' : ''}>${value === 'ALL' ? text('All statuses','كل الحالات') : value === 'ACTIVE' ? text('Active orders','الطلبات الجارية') : esc(status(value))}</option>`).join('')}</select></label><label>${text('Find order or customer','ابحث برقم الطلب أو العميل')}<input name="search" type="search" maxlength="160" value="${esc(filters.search)}"></label><button type="submit" class="primary">${text('Apply filters','تطبيق')}</button><button type="button" id="owner-export">${workspaceIcon('bar-chart-2')}${text('Export filtered orders to Excel','تنزيل الطلبات المصفاة في Excel')}</button></form><p class="owner-period-note">${text('Dates use order placement time in Cairo. Delivered revenue includes delivered orders placed in the selected period. Excel exports all matching orders, including other result pages.','التواريخ حسب وقت إنشاء الطلب بتوقيت القاهرة. الإيرادات تخص الطلبات المكتملة المنشأة خلال الفترة. تقرير Excel يشمل كل النتائج المصفاة بما فيها الصفحات الأخرى.')}</p>`;
  view.innerHTML = `${tab !== 'kitchen' ? filterForm() : `<p class="notice">${text('Live kitchen queue across all dates. Showing up to 100 active kitchen orders; use Orders to search the full history.','طابور المطبخ المباشر لكل التواريخ. يتم عرض أول ١٠٠ طلب نشط. استخدم الطلبات للبحث في السجل الكامل.')}</p>`}<div id="owner-results" aria-live="polite"></div><dialog id="owner-detail" class="report-dialog"><div class="report-dialog-panel"><div class="report-dialog-header"><h3>${text('Order details','تفاصيل الطلب')}</h3><button type="button" id="owner-close-detail" aria-label="${text('Close','إغلاق')}">${workspaceIcon('x')}</button></div><div id="owner-detail-body"></div></div></dialog>`;
  const results = $('#owner-results');
  const requestParams = () => new URLSearchParams(Object.entries(filters).map(([key,value]) => [key,String(value)]));
  const saveUrl = () => { const params = requestParams(); params.set('tab',tab); history.replaceState(null,'','/owner?' + params); };
  saveUrl();
  const navigate = next => { const params = requestParams(); params.set('tab',next); params.delete('page'); if (next === 'delivery') params.set('status','ACTIVE'); location.href = '/owner?' + params; };
  const card = (order, drivers = []) => {
    const next = {PLACED:'ACCEPTED',ACCEPTED:'PREPARING',PREPARING:'READY'}[order.status];
    const address = order.address_snapshot || {};
    const driverFallback = order.assigned_driver_id ? (ar ? 'تم التعيين' : 'Assigned') : (ar ? 'غير معين' : 'Unassigned');
    return `<article class="panel owner-order" data-owner-order="${order.id}"><div class="line"><strong>${esc(receiptNumber(order))}</strong><span class="badge">${esc(status(order.status))}</span></div><p><strong>${esc(order.customer_name)}</strong> · <a href="tel:${esc(order.customer_phone)}" dir="ltr">${esc(order.customer_phone)}</a></p><p>${esc(address.address_line || '')}</p><div class="line"><span>${esc(new Date(order.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB',{timeZone:'Africa/Cairo'}))}</span><strong>${esc(money(order.total_egp))}</strong></div>${order.items ? `<ul>${order.items.map(item => `<li>${item.quantity} × ${esc(ar ? item.product_name_ar || item.product_name : item.product_name)}${item.options?.length ? `<small> ${esc(item.options.map(option => ar ? option.name_ar || option.name : option.name).join(', '))}</small>` : ''}</li>`).join('')}</ul>` : ''}${order.notes ? `<p class="notice">${esc(order.notes)}</p>` : ''}${paymentSummary(order,{esc,money,language})}<p>${text('Driver','المندوب')}: ${esc(order.driver_name || (drivers.find(driver => driver.id === order.assigned_driver_id)?.name) || driverFallback)}</p><div class="actions"><button type="button" data-order-detail="${order.id}">${text('Details & history','التفاصيل والسجل')}</button>${next ? `<button type="button" class="primary" data-owner-status="${next}" data-order-id="${order.id}">${esc(status(next))}</button>` : ''}${['PLACED','ACCEPTED'].includes(order.status) ? `<button type="button" class="danger" data-owner-status="CANCELLED" data-order-id="${order.id}">${text('Cancel','إلغاء')}</button>` : ''}</div>${tab === 'delivery' && ['PLACED','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY'].includes(order.status) ? `<form data-owner-assign="${order.id}" class="owner-assign"><label>${text('Assign driver','تعيين مندوب')}<select name="driverId" required><option value="">${text('Choose an active driver','اختر مندوبًا نشطًا')}</option>${drivers.map(driver => `<option value="${driver.id}" ${driver.id === order.assigned_driver_id ? 'selected' : ''}>${esc(driver.name)}</option>`).join('')}</select></label><button type="submit">${text('Save assignment','حفظ التعيين')}</button></form>` : ''}</article>`;
  };
  const table = (headers, rows) => `<div class="table-wrap panel"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">${text('No data in this period.','لا توجد بيانات في الفترة.')}</td></tr>`}</tbody></table></div>`;
  async function load() {
    const run = ++version; results.setAttribute('aria-busy','true');
    if (!results.children.length) results.innerHTML = `<p>${text('Loading…','جاري التحميل…')}</p>`;
    try {
      if (tab === 'analytics') {
        const data = await api('/api/owner/analytics?' + requestParams()); if (run !== version || !root.isConnected) return;
        const metrics = [['orders',text('Orders','الطلبات')],['revenue',text('Delivered revenue','إيرادات الطلبات المكتملة')],['active',text('Active orders','طلبات جارية')],['cancelled',text('Cancelled','ملغية')],['averageOrder',text('Average delivered order','متوسط الطلب المكتمل')]];
        results.innerHTML = `<div class="owner-metrics">${metrics.map(([key,label]) => `<article class="panel"><span>${label}</span><strong>${esc(['revenue','averageOrder'].includes(key) ? money(data.summary[key]) : data.summary[key])}</strong></article>`).join('')}</div><h3>${text('Daily orders','الطلبات اليومية')}</h3>${table([text('Date','التاريخ'),text('Orders','الطلبات'),text('Order value','قيمة الطلبات')],data.daily.map(day => [esc(day.day),Number(day.orders),esc(money(day.total))]))}<div class="owner-analytics-grid"><section><h3>${text('Order status','حالات الطلبات')}</h3>${table([text('Status','الحالة'),text('Count','العدد')],data.byStatus.map(row => [esc(status(row.status)),Number(row.count)]))}</section><section><h3>${text('Best sellers (delivered)','الأكثر مبيعًا في الطلبات المكتملة')}</h3>${table([text('Product','المنتج'),text('Quantity','الكمية'),text('Revenue','الإيراد')],data.topProducts.map(row => [esc(row.product_name),Number(row.quantity),esc(money(row.revenue))]))}</section></div>`;
      } else if (tab === 'kitchen') {
        const {orders} = await api('/api/owner/kitchen'); if (run !== version || !root.isConnected) return;
        results.innerHTML = `<div class="kanban">${['PLACED','ACCEPTED','PREPARING','READY'].map(state => `<section class="column"><h3>${esc(status(state))} · ${orders.filter(order => order.status === state).length}</h3>${orders.filter(order => order.status === state).map(order => card(order)).join('') || `<p>${text('No orders.','لا توجد طلبات.')}</p>`}</section>`).join('')}</div>`;
      } else {
        const [data, roster] = await Promise.all([api('/api/owner/orders?' + requestParams()), tab === 'delivery' ? api('/api/owner/drivers') : Promise.resolve({drivers:[]})]);
        if (run !== version || !root.isConnected) return;
        results.innerHTML = `${tab === 'delivery' && !roster.drivers.length ? `<p class="notice">${text('No active drivers. Ask the website administrator to assign driver roles.','لا يوجد مندوبون نشطون. اطلب من مدير الموقع تعيين صلاحيات المندوبين.')}</p>` : ''}<p>${data.total} ${text('matching orders','طلب مطابق')}</p><div class="owner-orders-grid">${data.orders.map(order => card(order,roster.drivers)).join('') || `<p class="empty">${text('No orders match these filters.','لا توجد طلبات مطابقة للفلاتر.')}</p>`}</div><div class="actions owner-pagination"><button type="button" data-owner-page="${filters.page - 1}" ${filters.page <= 1 ? 'disabled' : ''}>${text('Previous','السابق')}</button><span>${filters.page} / ${Math.max(1,Math.ceil(data.total / filters.limit))}</span><button type="button" data-owner-page="${filters.page + 1}" ${filters.page * filters.limit >= data.total ? 'disabled' : ''}>${text('Next','التالي')}</button></div>`;
      }
    } catch(error) { if (run === version && root.isConnected) { results.innerHTML = `<p class="error" role="alert">${esc(error.message)}</p>`; } }
    finally { if (run === version) results.setAttribute('aria-busy','false'); }
  }
  root.addEventListener('submit',async event => {
    const form = event.target; event.preventDefault();
    if (form.id === 'owner-filters') { const values = Object.fromEntries(new FormData(form)); if (values.from > values.to) { toast(ar ? 'تاريخ البداية يجب أن يسبق النهاية.' : 'The start date must be before the end date.'); return; } filters = {...filters,...values,page:1}; saveUrl(); await load(); }
    if (form.dataset.ownerAssign) {
      const button = form.querySelector('[type="submit"]'); button.disabled = true;
      try { await api('/api/owner/orders/' + form.dataset.ownerAssign + '/assign',{method:'PATCH',body:{driverId:new FormData(form).get('driverId')}}); await load(); toast(ar ? 'تم تعيين المندوب.' : 'Driver assigned.'); } catch(error) { toast(error.message); } finally { button.disabled = false; }
    }
  });
  root.addEventListener('click',async event => {
    const button = event.target.closest('button'); if (!button) return;
    try {
      if (button.dataset.tab) navigate(button.dataset.tab);
      else if (button.dataset.workspaceAction) document.getElementById({theme:'theme-toggle',language:'language',logout:'logout'}[button.dataset.workspaceAction])?.click();
      else if (button.id === 'owner-refresh') await load();
      else if (button.id === 'owner-close-detail') $('#owner-detail').close();
      else if (button.dataset.ownerPage) { filters.page = Number(button.dataset.ownerPage); saveUrl(); await load(); }
      else if (button.dataset.ownerStatus) {
        if (button.dataset.ownerStatus === 'CANCELLED' && !confirm(ar ? 'إلغاء هذا الطلب؟' : 'Cancel this order?')) return;
        button.disabled = true;
        try { await api('/api/owner/orders/' + button.dataset.orderId + '/status',{method:'PATCH',body:{status:button.dataset.ownerStatus}}); await load(); } finally { button.disabled = false; }
      } else if (button.dataset.orderDetail) {
        button.disabled = true;
        try {
          const {order} = await api('/api/owner/orders/' + button.dataset.orderDetail);
          $('#owner-detail-body').innerHTML = `${card(order)}<h3>${text('History','السجل')}</h3><ol class="timeline">${order.events.map(event => `<li class="done">${esc(status(event.status))}<small>${esc(new Date(event.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB',{timeZone:'Africa/Cairo'}))}</small>${esc(event.note || '')}</li>`).join('')}</ol>`;
          // The detail view is read-only; actions remain on the live list.
          $('#owner-detail-body').querySelectorAll('button,form').forEach(element => element.remove()); $('#owner-detail').showModal();
        } finally { button.disabled = false; }
      } else if (button.id === 'owner-export') {
        button.disabled = true;
        try {
          const response = await fetch('/api/owner/export?' + requestParams(),{credentials:'same-origin'});
          if (!response.ok) { const error = await response.json().catch(()=>({})); throw Error(error.message || 'Export failed.'); }
          const blob = await response.blob(), href = URL.createObjectURL(blob), link = document.createElement('a');
          link.href = href; link.download = response.headers.get('content-disposition')?.match(/filename="([\w.-]+)"/)?.[1] || 'bella-crosta-orders.xlsx'; link.click(); setTimeout(()=>URL.revokeObjectURL(href),1000);
        } finally { button.disabled = false; }
      }
    } catch(error) { toast(error.message); }
  });
  const find = $('#workspace-find'); find.placeholder = ar ? 'ابحث عن طلب' : 'Search orders'; find.setAttribute('aria-label',find.placeholder); find.value = filters.search;
  let searchTimer;
  find.addEventListener('input',() => { clearTimeout(searchTimer); searchTimer = setTimeout(()=> { if (!root.isConnected) return; filters.search = find.value; filters.page = 1; if (tab === 'kitchen') navigate('orders'); else { const input = root.querySelector('#owner-filters [name="search"]'); input.value = filters.search; saveUrl(); load(); } },300); });
  if (ctx.socket) {
    if (ctx.socket.__ownerRefresh) ctx.socket.off('order',ctx.socket.__ownerRefresh);
    ctx.socket.__ownerRefresh = () => { clearTimeout(ctx.socket.__ownerTimer); ctx.socket.__ownerTimer = setTimeout(()=>{ if (root.isConnected) load(); },300); };
    ctx.socket.on('order',ctx.socket.__ownerRefresh);
  }
  await load();
}
