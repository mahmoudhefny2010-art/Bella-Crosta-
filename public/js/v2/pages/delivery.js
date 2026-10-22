import { receiptNumber } from '../receipt.js';
export default function createPage(ctx) {
  const { esc, api, language, money, status, page, busy, requireUser, locate, loadScript, toast, user } = ctx;
  const ar = language === 'ar', text = (en, arabic) => esc(ar ? arabic : en);
  let scope = new URLSearchParams(location.search).get('scope') || 'all';
  if (!['all','mine','history'].includes(scope)) scope = 'all';
  let currentPage = 1;
  const drafts = ctx.deliveryPaymentDrafts ||= new Map();
  async function stopScanner() { if (ctx.scanner) { await ctx.scanner.stop(); ctx.scanner = null; } }
  async function delivery() {
    if (!requireUser()) return;
    const requestVersion = ctx.deliveryRequest = (ctx.deliveryRequest || 0) + 1;
    const data = await api('/api/delivery/orders?' + new URLSearchParams({scope,page:currentPage}));
    if (requestVersion !== ctx.deliveryRequest) return;
    const root = page(ar ? 'التوصيل' : 'Delivery');
    root.innerHTML = `<div class="delivery-dashboard"><nav class="delivery-tabs" aria-label="${text('Delivery queues','قوائم التوصيل')}">${[['all','All orders','كل الطلبات'],['mine','My deliveries','طلباتي'],['history','My completed deliveries','التوصيلات السابقة']].map(([key,en,arabic]) => `<button type="button" data-scope="${key}" class="${scope === key ? 'primary' : ''}" aria-pressed="${scope === key}">${text(en,arabic)}</button>`).join('')}<button type="button" data-refresh>${text('Refresh','تحديث')}</button></nav><p>${text('Active orders are shown oldest first. Only the assigned driver can collect payment and confirm delivery.','الطلبات الجارية مرتبة من الأقدم. المندوب المعيّن فقط يقدر يسجل الدفع ويأكد التسليم.')}</p><div class="delivery-cards">${data.orders.map(order => {
      const mine = order.assigned_driver_id === user.id, address = order.address_snapshot || {}, draft = drafts.get(order.id) || {};
      const cash = order.payment_method === 'CASH_ON_DELIVERY';
      return `<article class="panel delivery-order" data-delivery-order="${order.id}"><div class="line"><h3>${esc(receiptNumber(order))}</h3><span class="badge">${esc(status(order.status))}</span></div><p><strong>${esc(order.customer_name)}</strong> · <a href="tel:${esc(order.customer_phone)}" dir="ltr">${esc(order.customer_phone)}</a></p><p>${esc([address.address_line,address.landmark,address.floor,address.apartment].filter(Boolean).join(' · '))}</p><p>${text('Placed','وقت الطلب')}: ${esc(new Date(order.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB',{timeZone:'Africa/Cairo'}))}</p><p>${text('Driver','المندوب')}: <strong>${esc(order.driver_name || (ar ? 'لم يتم التعيين' : 'Unassigned'))}</strong>${mine ? ` · ${text('Assigned to you','معيّن لك')}` : ''}</p><a class="button small" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${Number(address.latitude)},${Number(address.longitude)}&travelmode=driving">${text('Open map','افتح الخريطة')} ↗</a><div class="line"><span>${cash ? text('Cash on delivery','الدفع كاش') : text('InstaPay on delivery','الدفع InstaPay')}</span><strong>${esc(money(order.total_egp))}</strong></div><p class="delivery-payment-status ${order.payment_status === 'PAID' ? 'is-paid' : ''}">${order.payment_status === 'PAID' ? text('Paid','تم الدفع') : order.payment_status === 'UNCONFIRMED' ? text('Payment not recorded','لم يتم تسجيل الدفع') : text('Unpaid','لم يتم الدفع')}${order.paid_at ? ` · ${esc(new Date(order.paid_at).toLocaleString())}` : ''}</p>${order.payment_status === 'PAID' ? `<p>${text('Received','المبلغ المستلم')}: ${esc(money(order.amount_received_egp))} · ${text('Change','الباقي')}: ${esc(money(order.change_due_egp))}</p>` : ''}${!order.assigned_driver_id && ['PLACED','ACCEPTED','PREPARING','READY'].includes(order.status) ? `<button type="button" class="primary" data-accept="${order.id}">${text('Accept delivery','قبول التوصيل')}</button>` : ''}${mine && order.status === 'READY' ? `<button class="primary" data-pickup="${order.id}">${text('Picked up','استلمت الطلب')}</button>` : ''}${mine && order.status === 'OUT_FOR_DELIVERY' ? `<form class="delivery-confirm" data-confirm="${order.id}" data-total="${Number(order.total_egp)}" data-cash="${cash}"><h4>${text('Payment & delivery','الدفع والتسليم')}</h4>${cash ? `<label>${text('Amount received (EGP)','المبلغ المستلم (جنيه)')}<input name="amountReceived" type="number" inputmode="decimal" step="0.01" min="${Number(order.total_egp)}" max="10000000" value="${esc(draft.amount || '')}" required></label><p class="delivery-change" data-change aria-live="polite"></p>` : `<p>${text('Check that the InstaPay transfer has arrived before confirming payment.','اتأكد إن تحويل InstaPay وصل قبل تأكيد الدفع.')}</p>`}<label class="delivery-paid"><input name="paid" type="checkbox" ${draft.paid ? 'checked' : ''} required>${text('Paid — I received the full payment','تم الدفع — استلمت المبلغ بالكامل')}</label><label>${text('Customer 6-digit code','كود العميل المكون من ٦ أرقام')}<input name="secret" pattern="[0-9]{6}" inputmode="numeric" maxlength="6"></label><div class="actions"><button type="submit" class="primary">${text('Confirm payment & delivery','تأكيد الدفع والتسليم')}</button><button type="button" data-scan="${order.id}">${text('Scan customer QR','مسح QR العميل')}</button><button type="button" data-stop-scan>${text('Stop scanner','إيقاف الماسح')}</button></div><div id="scanner-${order.id}"></div><div class="actions"><button type="button" data-gps="${order.id}">${text('Share GPS','مشاركة الموقع')}</button><button type="button" data-stop-gps>${text('Stop GPS','إيقاف الموقع')}</button></div></form>` : ''}</article>`;
    }).join('') || `<p>${text('No orders in this queue.','لا توجد طلبات في القائمة.')}</p>`}</div><div class="delivery-pagination"><button data-page="${currentPage-1}" ${currentPage <= 1 ? 'disabled' : ''}>${text('Previous','السابق')}</button><span>${currentPage} / ${Math.max(1,Math.ceil(data.total/data.limit))}</span><button data-page="${currentPage+1}" ${currentPage*data.limit >= data.total ? 'disabled' : ''}>${text('Next','التالي')}</button></div></div>`;
    root.querySelectorAll('[data-confirm]').forEach(form => {
      const update = () => {
        const amount = form.elements.amountReceived?.value || '';
        drafts.set(form.dataset.confirm,{amount,paid:form.elements.paid.checked});
        const output = form.querySelector('[data-change]');
        if (output) {
          const difference = Math.round((Number(amount)-Number(form.dataset.total))*100)/100;
          output.textContent = amount === '' ? (ar ? 'ادخل المبلغ المستلم لحساب الباقي.' : 'Enter the amount received to calculate change.') : difference < 0 ? (ar ? 'المبلغ المتبقي: ' : 'Still due: ') + money(-difference) : (ar ? 'الباقي للعميل: ' : 'Change for customer: ') + money(difference);
        }
      };
      form.addEventListener('input',update); update();
      form.addEventListener('submit',async event => {
        event.preventDefault();
        if (!/^\d{6}$/.test(form.elements.secret.value)) { toast(ar ? 'ادخل كود العميل أو امسح QR.' : 'Enter the customer code or scan their QR.'); return; }
        try { await busy(form.querySelector('[type=submit]'),()=>complete(form,form.elements.secret.value)); } catch(error) { toast(error.message); }
      });
    });
    root.addEventListener('click',async event => {
      const button = event.target.closest('button'); if (!button) return;
      try {
        if (button.dataset.scope) { await stopScanner();scope=button.dataset.scope;currentPage=1;history.replaceState(null,'','/delivery?scope='+scope);await delivery(); }
        else if (button.dataset.page) { await stopScanner();currentPage=Number(button.dataset.page);await delivery(); }
        else if (button.hasAttribute('data-refresh')) { await stopScanner();await delivery(); }
        else if (button.dataset.accept) await busy(button,async()=>{
          await api('/api/delivery/orders/'+button.dataset.accept+'/accept',{method:'PATCH'});
          toast(ar ? 'تم قبول الطلب وتعيينه لك' : 'Delivery accepted and assigned to you');
          await delivery();
        });
        else if (button.dataset.pickup) await busy(button,async()=>{ await api('/api/delivery/orders/'+button.dataset.pickup+'/pickup',{method:'PATCH'});await delivery(); });
        else if (button.dataset.gps) {
          clearInterval(ctx.gpsTimer);
          const send = async()=>{const position=await locate();await api('/api/delivery/location',{method:'POST',body:{orderId:button.dataset.gps,latitude:position.latitude,longitude:position.longitude}});};
          await send();toast('GPS sharing active');ctx.gpsTimer=setInterval(()=>send().catch(error=>{clearInterval(ctx.gpsTimer);toast(error.message);}),8000);
        } else if (button.hasAttribute('data-stop-gps')) clearInterval(ctx.gpsTimer);
        else if (button.hasAttribute('data-stop-scan')) await stopScanner();
        else if (button.dataset.scan) {
          const form=button.closest('form');
          // Payment must be entered before a QR can consume the delivery credential.
          if (!form.reportValidity()) return;
          if (!window.Html5Qrcode) await loadScript('/vendor/html5-qrcode.js');
          await stopScanner();ctx.scanner=new window.Html5Qrcode('scanner-'+button.dataset.scan);
          let processing=false;
          await ctx.scanner.start({facingMode:'environment'},{fps:10,qrbox:220},async raw=>{
            if(processing)return;processing=true;
            try { const code=JSON.parse(raw);if(code.orderId!==form.dataset.confirm)throw Error(ar ? 'QR تابع لطلب آخر.' : 'QR belongs to another order.');await stopScanner();await complete(form,code.token); }
            catch(error){toast(error.message);}finally{processing=false;}
          },()=>{});
        }
      } catch(error){toast(error.message);}
    },{once:false});
  }
  async function complete(form,secret) {
    if(!form.reportValidity())return;
    const position=await locate();
    await api('/api/delivery/confirm',{method:'POST',body:{orderId:form.dataset.confirm,secret,latitude:position.latitude,longitude:position.longitude,paid:form.elements.paid.checked,...(form.dataset.cash==='true'?{amountReceived:Number(form.elements.amountReceived.value)}:{})}});
    clearInterval(ctx.gpsTimer);drafts.delete(form.dataset.confirm);await stopScanner();toast(ar?'تم تسجيل الدفع والتسليم':'Payment and delivery recorded');await delivery();
  }
  return delivery();
}
