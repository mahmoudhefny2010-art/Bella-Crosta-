const { z } = require('zod');
const db = require('../db');
const { fail } = require('./workflow');
const statuses = ['PLACED','ACCEPTED','PREPARING','READY','OUT_FOR_DELIVERY','DELIVERED','CANCELLED'];
const active = statuses.slice(0, 5);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date());
const filterSchema = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional(), status: z.enum(['ALL','ACTIVE',...statuses]).default('ALL'), search: z.string().trim().max(160).default(''), page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(100).default(25) }).strict();
function filters(input, defaults = false) {
  const values = filterSchema.parse(input);
  if (values.from || values.to || defaults) { values.from ||= values.to || today(); values.to ||= values.from; }
  if (values.from && values.from > values.to) fail('The start date must be before the end date.');
  return values;
}
function query(values) {
  const result = db('orders').leftJoin('users as driver', 'driver.id', 'orders.assigned_driver_id');
  if (values.from) result.whereRaw("orders.created_at >= CONVERT(datetime2, (CONVERT(datetime2, ?) AT TIME ZONE 'Egypt Standard Time') AT TIME ZONE 'UTC') AND orders.created_at < CONVERT(datetime2, (DATEADD(day, 1, CONVERT(datetime2, ?)) AT TIME ZONE 'Egypt Standard Time') AT TIME ZONE 'UTC')", [values.from, values.to]);
  if (values.status === 'ACTIVE') result.whereIn('orders.status', active);
  else if (values.status !== 'ALL') result.where('orders.status', values.status);
  // Treat search as a literal substring, including SQL Server's LIKE metacharacters.
  if (values.search) {
    const term = '%' + values.search.replace(/[\[\]%_]/g, c => '[' + c + ']') + '%';
    result.where(function () { this.where('orders.order_number', 'like', term).orWhere('orders.customer_name', 'like', term).orWhere('orders.customer_phone', 'like', term); const receipt = values.search.match(/^(?:#|WEB-)?0*([1-9][0-9]*)$/i); if (receipt && receipt[1].length <= 18) this.orWhere('orders.receipt_number',receipt[1]); });
  }
  return result;
}
const columns = ['orders.id','orders.receipt_number','orders.order_number','orders.created_at','orders.customer_name','orders.customer_phone','orders.status','orders.fulfillment_type','orders.payment_method','orders.payment_status','orders.amount_received_egp','orders.change_due_egp','orders.paid_at','orders.paid_by','orders.subtotal_egp','orders.delivery_fee_egp','orders.total_egp','orders.notes','orders.assigned_driver_id','orders.address_snapshot','driver.name as driver_name'];
async function list(input) {
  const values = filters(input), base = query(values);
  const [count, orders] = await Promise.all([base.clone().count('* as total').first(), base.clone().select(columns).orderBy('orders.created_at', 'desc').orderBy('orders.id').offset((values.page - 1) * values.limit).limit(values.limit)]);
  return { orders, total: Number(count.total), page: values.page, limit: values.limit, filters: values };
}
async function report(input, defaultDates = true) {
  const values = filters(input, defaultDates), base = query(values);
  const count = Number((await base.clone().count('* as total').first()).total);
  if (count > 10000) fail('This report has more than 10,000 orders. Choose a shorter date range.');
  const orders = await base.select(columns).orderBy('orders.created_at', 'desc').orderBy('orders.id');
  return { from: values.from || 'all-dates', to: values.to || 'present', status: values.status, orders, summary: { orders: orders.length, revenue: orders.reduce((sum, order) => sum + (order.status === 'DELIVERED' ? Number(order.total_egp) : 0), 0), cancelled: orders.filter(order => order.status === 'CANCELLED').length } };
}
async function analytics(input) {
  const values = filters(input, true), base = query(values);
  const dateExpression = "CONVERT(varchar(10), orders.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Egypt Standard Time', 23)";
  const [summary, byStatus, daily, topProducts] = await Promise.all([
    base.clone().select(db.raw("COUNT(*) as orders, COALESCE(SUM(CASE WHEN orders.status='DELIVERED' THEN orders.total_egp ELSE 0 END),0) as revenue, COALESCE(SUM(CASE WHEN orders.status='CANCELLED' THEN 1 ELSE 0 END),0) as cancelled, COALESCE(SUM(CASE WHEN orders.status NOT IN ('DELIVERED','CANCELLED') THEN 1 ELSE 0 END),0) as active, COALESCE(SUM(CASE WHEN orders.status='DELIVERED' THEN 1 ELSE 0 END),0) as delivered")).first(),
    base.clone().select('orders.status').count('* as count').groupBy('orders.status'),
    base.clone().select(db.raw(`${dateExpression} as day`)).count('* as orders').sum({ total: 'orders.total_egp' }).groupByRaw(dateExpression).orderBy('day'),
    db('order_items').whereIn('order_id', base.clone().select('orders.id').where('orders.status','DELIVERED')).select('product_name').sum({ quantity:'quantity', revenue:'line_total_egp' }).groupBy('product_name').orderBy('quantity','desc').limit(10)
  ]);
  return { from: values.from, to: values.to, summary: { orders: Number(summary.orders), revenue: Number(summary.revenue), cancelled: Number(summary.cancelled), active: Number(summary.active), delivered: Number(summary.delivered), averageOrder: summary.delivered ? Number(summary.revenue) / Number(summary.delivered) : 0 }, byStatus, daily, topProducts };
}
module.exports = { statuses, active, today, filters, query, list, report, analytics };
