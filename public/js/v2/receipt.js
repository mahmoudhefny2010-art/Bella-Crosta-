export function receiptNumber(order) {
  return order.receipt_number == null ? order.order_number : '#' + String(order.receipt_number);
}
