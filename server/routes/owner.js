const express = require('express');
const { z } = require('zod');
const db = require('../db');
const orders = require('../services/orders');
const reports = require('../services/business-reports');
const router = express.Router();
const uuid = z.string().uuid();
router.param('id', (req,res,next,id) => { uuid.parse(id); next(); });
router.get('/orders', async (req,res) => res.json(await reports.list(req.query)));
router.get('/orders/:id', async (req,res) => res.json({ order: await orders.detail(req.params.id) }));
router.patch('/orders/:id/status', async (req,res) => {
  const { status } = z.object({ status: z.enum(['ACCEPTED','PREPARING','READY','CANCELLED']) }).strict().parse(req.body);
  res.json({ order: await orders.transition(req.params.id, status, req.currentUser) });
});
router.patch('/orders/:id/assign', async (req,res) => {
  const { driverId } = z.object({ driverId: uuid }).strict().parse(req.body);
  res.json({ order: await orders.assign(req.params.id, driverId) });
});
router.get('/drivers', async (req,res) => res.json({ drivers: await orders.drivers() }));
router.get('/kitchen', async (req,res) => {
  const raw = await db('orders').whereIn('status', ['PLACED','ACCEPTED','PREPARING','READY']).orderBy('created_at').limit(100);
  res.json({ orders: await orders.queueDetails(raw) });
});
router.get('/analytics', async (req,res) => res.json(await reports.analytics(req.query)));
router.get('/report', async (req,res) => res.json(await reports.report(req.query)));
router.get('/export', async (req,res) => {
  const data = await reports.report(req.query, false);
  const { buildSalesWorkbook } = await import('../../public/js/v2/excel.js');
  const columns = [['receipt_number','Website receipt number'],['order_number','Order number'],['created_at','Date and time (Cairo)'],['customer_name','Customer'],['customer_phone','Phone'],['status','Status'],['driver_name','Delivery driver'],['payment_method','Payment method'],['payment_status','Payment status'],['amount_received_egp','Amount received (EGP)'],['change_due_egp','Change (EGP)'],['subtotal_egp','Subtotal (EGP)'],['delivery_fee_egp','Delivery fee (EGP)'],['total_egp','Total (EGP)'],['notes','Order notes']].map(([key,label]) => ({key,label}));
  const blob = buildSalesWorkbook({ ...data, columns, statusLabel: data.status, labels: { title:'Bella Crosta orders report',period:'Period (order date in Cairo)',status:'Status',metric:'Metric',value:'Value',orders:'Orders',revenue:'Delivered revenue',cancelled:'Cancelled',exportedRows:'Exported rows' } });
  res.set({ 'Content-Type': blob.type, 'Content-Disposition': `attachment; filename="bella-crosta-orders-${data.from}-to-${data.to}.xlsx"`, 'Cache-Control':'no-store' }).send(Buffer.from(await blob.arrayBuffer()));
});
module.exports = router;
