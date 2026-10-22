import { receiptNumber } from '../receipt.js';
import { paymentSummary } from '../payment-summary.js';
import { buildSalesWorkbook } from '../excel.js';
import { workspaceShell, overviewMarkup, bindWorkspace } from '../admin-workspace.js';
import { renderContentEditor } from './content-editor.js';

export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

  const productPhotoLabel = language === 'ar' ? '\u0635\u0648\u0631\u0629 \u0627\u0644\u0645\u0646\u062a\u062c' : t('Product photo');
  const currentPhotoLabel = language === 'ar' ? '\u0627\u0644\u0635\u0648\u0631\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629' : t('Current photo');
  const uploadedPhotoLabel = language === 'ar' ? '\u062a\u0645 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629' : t('Photo uploaded');

  const dashboardTools = [
    { id: 'content', title: 'Website content', ar: 'محتوى الموقع', description: 'Edit the header, hero, footer, pages, images and website settings.', descriptionAr: 'تعديل الهيدر والفوتر والصفحات والصور وإعدادات الموقع.' },
    { id: 'products', title: 'Products', ar: 'المنتجات', description: 'Manage your menu, photos, prices and offers.', descriptionAr: 'إدارة المنيو والصور والأسعار والعروض.' },
    { id: 'staff', title: 'Staff', ar: 'الموظفين', description: 'Manage accounts, access and team roles.', descriptionAr: 'إدارة الحسابات والصلاحيات وأدوار الفريق.' },
    { id: 'orders', title: 'Orders', ar: 'الطلبات', description: 'Follow orders and assign delivery drivers.', descriptionAr: 'متابعة الطلبات وتعيين مندوبي التوصيل.' },
    { id: 'sales', title: 'Sales', ar: 'المبيعات', description: 'Review sales and download custom reports.', descriptionAr: 'مراجعة المبيعات وتنزيل تقارير مخصصة.' }
  ];

async function admin(tab, editId) {
  const requestedTab = tab || new URLSearchParams(location.search).get('tab') || 'overview';
  tab = ['overview', 'content', 'products', 'staff', 'orders', 'sales'].includes(requestedTab) ? requestedTab : 'overview';
  if (location.pathname === '/admin') history.replaceState(null, '', tab === 'overview' ? '/admin' : `/admin?tab=${tab}`);
  if (!requireUser()) return;
  document.body.classList.add('admin-mode');
  app.innerHTML = workspaceShell({ tab, tools: dashboardTools, user, language, esc });
  const view = $('#admin-view');
  view.innerHTML = tab === 'overview' ? overviewMarkup({ tools: dashboardTools, language, esc }) : '<div id="admin-content"></div>';
  await bindWorkspace($('.admin-workspace'), { tab, tools: dashboardTools, user, language, esc, api, money, toast, navigate: next => admin(next) });
  if (tab === 'overview') return;
  const content = $('#admin-content');
  if (tab === 'content') { await renderContentEditor(context, content); return; }
  if (tab === 'products') {
    const { products: list, categories } = await api('/api/admin/products');
    const edit = list.find(p => p.id === editId);
    content.innerHTML = `<div class="split"><div class="table-wrap"><table><thead><tr><th>${tr('Name')}</th><th>${tr('Price')}</th><th>${tr('Available')}</th><th></th></tr></thead><tbody>${list.map(p => `<tr><td>${esc(local(p, 'name'))}</td><td>${p.sale_price_egp != null ? `<span class="admin-offer-price"><del>${esc(money(p.price_egp))}</del><strong>${esc(money(p.sale_price_egp))}</strong></span>` : esc(money(p.price_egp))}</td><td>${p.is_available ? '✓' : '—'}</td><td><button class="small" data-edit-product="${p.id}">${tr('Edit')}</button><button class="small danger" data-delete-product="${p.id}">${tr('Delete')}</button></td></tr>`).join('')}</tbody></table></div><form class="panel" id="product-form"><h3>${tr(edit ? 'Edit' : 'Add product')}</h3>${field('name', 'Name', edit?.name)}${field('name_ar', 'Arabic name', edit?.name_ar)}${field('slug', 'Slug', edit?.slug)}${field('description', 'Description', edit?.description, 'text', false)}${field('description_ar', 'Arabic description', edit?.description_ar, 'text', false)}${field('price_egp', 'Price', edit?.price_egp, 'number')}${field('sale_price_egp', 'Offer price (EGP)', edit?.sale_price_egp ?? '', 'number', false)}<small class="upload-hint">${tr('Leave empty if this product has no offer. Offer price must be lower than the regular price.')}</small><label class="offer-notify-option"><input name="send_offer_notification" type="checkbox" checked>${tr('Notify subscribed customers when this offer is saved')}</label><label>${tr('Category')}</label><select name="category_id">${categories.map(c => `<option value="${c.id}" ${edit?.category_id === c.id ? 'selected' : ''}>${esc(local(c, 'name'))}</option>`).join('')}</select><label for="product-image-file">${esc(productPhotoLabel)}</label><input id="product-image-file" type="file" accept="image/jpeg,image/png,image/webp"><small class="upload-hint">${language === 'ar' ? '\u0627\u062e\u062a\u0631 \u0635\u0648\u0631\u0629 JPG \u0623\u0648 PNG \u0623\u0648 WebP\u060c \u0628\u062d\u062f \u0623\u0642\u0635\u0649 5 \u0645\u064a\u062c\u0627\u0628\u0627\u064a\u062a.' : 'JPG, PNG or WebP, up to 5 MB.'}</small><div class="product-image-preview" id="product-image-preview" hidden></div><input type="hidden" name="image_url" id="product-image-url" value="${esc(edit?.image_url || '')}"><label><input name="is_available" type="checkbox" ${!edit || edit.is_available ? 'checked' : ''}>${tr('Available')}</label><button type="submit" class="primary">${tr('Save product')}</button></form></div>`;
    const imagePreview = $('#product-image-preview');
    if (edit?.image_url) { const img = document.createElement('img'); img.src = edit.image_url; img.alt = productPhotoLabel; img.loading = 'lazy'; const caption = document.createElement('span'); caption.textContent = currentPhotoLabel; imagePreview.replaceChildren(img, caption); imagePreview.hidden = false; }
    $('#product-image-file').addEventListener('change', async e => {
      const input = e.currentTarget, file = input.files?.[0];
      if (!file) return;
      input.disabled = true;
      try {
        const response = await fetch('/api/admin/uploads', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': file.type }, body: file });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || `Upload failed (${response.status})`);
        $('#product-image-url').value = data.image_url;
        const img = document.createElement('img'); img.src = data.image_url; img.alt = productPhotoLabel; img.loading = 'lazy'; const caption = document.createElement('span'); caption.textContent = file.name; imagePreview.replaceChildren(img, caption); imagePreview.hidden = false;
        toast(uploadedPhotoLabel);
      } catch (error) { toast(error.message); }
      finally { input.disabled = false; input.value = ''; }
    });
    document.querySelectorAll('[data-edit-product]').forEach(b => b.addEventListener('click', () => admin('products', b.dataset.editProduct).catch(e => toast(e.message))));
    document.querySelectorAll('[data-delete-product]').forEach(b => b.addEventListener('click', async () => { if (!confirm(t('Delete this product?'))) return; try { await api('/api/admin/products/' + b.dataset.deleteProduct, { method: 'DELETE' }); await admin(); } catch (e) { toast(e.message); } }));
    bind('#product-form', 'submit', async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const button = form.querySelector('[type="submit"]');
      const f = Object.fromEntries(new FormData(form));
      const salePrice = f.sale_price_egp === '' ? null : Number(f.sale_price_egp);
      if (salePrice !== null && (!Number.isInteger(salePrice) || salePrice <= 0 || salePrice >= Number(f.price_egp))) {
        toast('Offer price must be a whole number, greater than zero, and lower than the regular price.');
        return;
      }
      button.disabled = true;
      try {
        const result = await api('/api/admin/products' + (edit ? '/' + edit.id : ''), { method: edit ? 'PUT' : 'POST', body: { ...f, price_egp: Number(f.price_egp), sale_price_egp: salePrice, send_offer_notification: new FormData(form).has('send_offer_notification'), is_available: Boolean(f.is_available), is_featured: edit?.is_featured || false, ingredients: edit?.ingredients || [], prep_minutes: edit?.prep_minutes || 20 } });
        toast(result.notification?.sent ? (result.notification.recipients ? 'Offer saved and notification sent.' : 'Offer saved, but no customers are subscribed to notifications.') : result.notification ? 'Offer saved, but notifications are not configured.' : 'Saved');
        await admin();
      } catch (error) {
        toast(error.message || 'Could not save product. Check the database connection and try again.');
      } finally {
        button.disabled = false;
      }
    });
  } else if (tab === 'staff') {
    const { users } = await api('/api/admin/users');
    const allRoles = ['customer', 'admin', 'owner', 'kitchen', 'driver'];
    const roleOptions = selected => `<fieldset class="role-options"><legend>${tr('Roles')}</legend>${allRoles.map(role => `<label><input name="roles" type="checkbox" value="${role}" ${(selected || []).includes(role) ? 'checked' : ''}>${tr(role[0].toUpperCase() + role.slice(1))}</label>`).join('')}</fieldset>`;
    content.innerHTML = `<div class="split"><section><label class="staff-search-label" for="staff-search">${tr('Find account')}</label><input id="staff-search" type="search" placeholder="${tr('Search by name or email')}" autocomplete="off"><p class="muted">${tr('Roles are assigned by email. When this person signs in with Google using the same email, they receive the selected roles.')}</p><div id="staff-users">${users.map(u => `<form class="panel" data-user="${u.id}" data-search="${esc(`${u.name} ${u.email}`.toLowerCase())}"><h3>${esc(u.name)}</h3><p>${esc(u.email)}</p>${roleOptions(u.roles || [u.role])}<label><input name="is_active" type="checkbox" ${u.is_active ? 'checked' : ''}>${tr('Active')}</label><button type="submit">${tr('Save roles')}</button></form>`).join('') || `<p class="muted">${tr('No accounts found.')}</p>`}</div></section><form id="staff-form" class="panel"><h3>${tr('Add staff')}</h3><p class="muted">${tr('Enter the email they will use with Google. Their selected roles will be ready when they sign in.')}</p>${field('email', 'Email', '', 'email')}${field('name', 'Name')}${roleOptions(['kitchen'])}<button class="primary" type="submit">${tr('Add staff')}</button></form></div>`;
    bind('#staff-search', 'input', e => {
      const query = e.currentTarget.value.trim().toLowerCase();
      document.querySelectorAll('[data-user]').forEach(form => { form.hidden = !form.dataset.search.includes(query); });
    });
    bind('#staff-form', 'submit', async e => { e.preventDefault(); const button = e.currentTarget.querySelector('[type="submit"]'); button.disabled = true; try { const data = new FormData(e.currentTarget); const result = await api('/api/admin/users', { method: 'POST', body: { email: data.get('email'), name: data.get('name'), roles: data.getAll('roles') } }); if (result.user.id === user?.id) { ctx.user = result.user; renderNav(); } toast(result.created ? 'Staff account added' : 'Roles updated for existing account'); await admin('staff'); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
    document.querySelectorAll('[data-user]').forEach(f => f.addEventListener('submit', async e => { e.preventDefault(); const button = f.querySelector('[type="submit"]'); button.disabled = true; try { const data = new FormData(f); const result = await api('/api/admin/users/' + f.dataset.user, { method: 'PATCH', body: { roles: data.getAll('roles'), is_active: data.has('is_active') } }); if (result.user.id === user?.id) { ctx.user = result.user; renderNav(); } toast('Roles updated'); await admin('staff'); } catch (error) { toast(error.message); button.disabled = false; } }));
  } else if (tab === 'orders') {
    const { orders, drivers } = await api('/api/admin/orders');
    content.innerHTML = orders.map(o => `<article class="panel"><div class="line"><h3>${esc(receiptNumber(o))}</h3><span class="badge">${esc(status(o.status))}</span></div><p>${esc(o.customer_name)} · ${esc(money(o.total_egp))}</p>${paymentSummary(o,{esc,money,language})}${['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'].includes(o.status) ? `<form data-assign="${o.id}"><label>${tr('Assign driver')}</label><select name="driver"><option value="">${tr('Choose a driver')}</option>${drivers.map(d => `<option value="${d.id}" ${d.id === o.assigned_driver_id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select><button type="submit">${tr('Assign')}</button></form>` : ''}</article>`).join('');
    document.querySelectorAll('[data-assign]').forEach(f => f.addEventListener('submit', async e => { e.preventDefault(); try { await api('/api/admin/orders/' + f.dataset.assign + '/assign', { method: 'PATCH', body: { driverId: new FormData(f).get('driver') } }); toast('Saved'); } catch (e) { toast(e.message); } }));
  } else {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
    const columns = [['receipt_number', 'Website receipt number'], ['order_number', 'Order number'], ['created_at', 'Date and time'], ['customer_name', 'Customer'], ['customer_phone', 'Phone'], ['status', 'Status'], ['fulfillment_type', 'Order type'], ['payment_method', 'Payment method'], ['payment_status','Payment status'], ['amount_received_egp','Amount received (EGP)'], ['change_due_egp','Change (EGP)'], ['subtotal_egp', 'Subtotal (EGP)'], ['delivery_fee_egp', 'Delivery fee (EGP)'], ['total_egp', 'Total (EGP)'], ['notes', 'Order notes']];
    content.innerHTML = `<div class="actions report-actions"><button id="report-config-open">${tr('Customize report')}</button><button id="sales-refresh">${tr('Refresh')}</button><button id="report-download" class="primary">${tr('Download Excel sheet (.xlsx)')}</button></div><div id="sales"></div><dialog id="report-config-dialog" class="report-dialog"><section class="report-dialog-panel"><div class="report-dialog-header"><h3>${tr('Customize report')}</h3><button id="report-config-close" type="button" aria-label="Close">×</button></div><div class="report-filters"><label>${tr('Date from')}<input type="date" id="report-from" value="${today}"></label><label>${tr('Date to')}<input type="date" id="report-to" value="${today}"></label><label>${tr('Status')}<select id="report-status"><option value="ALL">${tr('All statuses')}</option>${['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'].map(value => `<option value="${value}">${esc(status(value))}</option>`).join('')}</select></label></div><div class="report-columns">${columns.map(([key, title]) => `<label><input type="checkbox" name="report-column" value="${key}" checked>${tr(title)}</label>`).join('')}</div><div class="actions report-dialog-actions"><button id="report-config-apply" type="button" class="primary">${tr('Apply')}</button></div></section></dialog>`;
    const refresh = async () => {
      const params = new URLSearchParams({ from: $('#report-from').value, to: $('#report-to').value, status: $('#report-status').value });
      const data = await api('/api/admin/report?' + params);
      $('#sales').innerHTML = `<div class="grid"><div class="panel"><h3>${tr('Orders')}</h3><span class="price">${data.summary.orders}</span></div><div class="panel"><h3>${tr('Delivered revenue')}</h3><span class="price">${esc(money(data.summary.revenue))}</span></div><div class="panel"><h3>${tr('Cancelled')}</h3><span class="price">${data.summary.cancelled}</span></div></div><p class="report-row-count">${data.orders.length} ${tr('orders in this report')}</p>`;
      return data;
    };
    bind('#report-config-open', 'click', () => $('#report-config-dialog').showModal());
    bind('#report-config-close', 'click', () => $('#report-config-dialog').close());
    bind('#report-config-apply', 'click', async () => { $('#report-config-dialog').close(); await refresh(); });
    bind('#sales-refresh', 'click', refresh);
    bind('#report-download', 'click', async e => {
      const selected = [...document.querySelectorAll('[name="report-column"]:checked')].map(input => columns.find(column => column[0] === input.value)).filter(Boolean);
      if (!selected.length) throw new Error(t('Choose at least one report column.'));
      const button = e.currentTarget;
      await busy(button, async () => {
        const data = await refresh();
        const blob = buildSalesWorkbook({
          orders: data.orders.map(order => ({ ...order, status: status(order.status) })),
          columns: selected.map(([key, label]) => ({ key, label: tr(label) })),
          from: data.from,
          to: data.to,
          statusLabel: $('#report-status').selectedOptions[0].textContent,
          summary: data.summary,
          labels: {
            title: tr('Bella Crosta sales report'), period: tr('Period'), status: tr('Status'), metric: tr('Metric'), value: tr('Value'),
            orders: tr('Orders'), revenue: tr('Delivered revenue'), cancelled: tr('Cancelled'), exportedRows: tr('Exported rows'), includedColumns: tr('Included columns')
          }
        });
        const url = URL.createObjectURL(blob), link = document.createElement('a');
        link.href = url; link.download = `bella-crosta-report-${data.from}-to-${data.to}.xlsx`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
    });
    await refresh();
  }
}

  return admin();
}
