export function paymentSummary(order, {esc,money,language}) {
  const ar=language==='ar';
  const paid=order.payment_status==='PAID';
  const label=paid ? (ar?'تم الدفع':'Paid') : order.payment_status==='UNPAID' ? (ar?'لم يتم الدفع':'Unpaid') : (ar?'لم يتم تسجيل الدفع':'Payment not recorded');
  return `<div class="order-payment-summary"><strong>${esc(label)}</strong>${paid ? `<span>${ar?'المبلغ المستلم':'Received'}: ${esc(money(order.amount_received_egp))} · ${ar?'الباقي':'Change'}: ${esc(money(order.change_due_egp))}</span><small>${esc(new Date(order.paid_at).toLocaleString(ar?'ar-EG':'en-GB',{timeZone:'Africa/Cairo'}))}</small>`:''}</div>`;
}
