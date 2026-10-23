SELECT TOP (100)
    order_number AS [رقم الطلب],
    created_at AS [وقت الطلب UTC],
    customer_name AS [العميل],
    customer_phone AS [الهاتف],
    status AS [الحالة],
    fulfillment_type AS [نوع الطلب],
    payment_method AS [طريقة الدفع],
    subtotal_egp AS [المجموع],
    delivery_fee_egp AS [التوصيل],
    total_egp AS [الإجمالي],
    notes AS [ملاحظات]
FROM dbo.orders
ORDER BY created_at DESC;