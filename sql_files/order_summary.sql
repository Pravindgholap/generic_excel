SELECT 
    o.order_id,
    u.name as customer_name,
    p.product_name,
    o.quantity,
    p.price as unit_price,
    o.total_amount,
    o.discount_pct as discount_percentage,
    (o.total_amount * o.discount_pct) as discount_amount,
    o.order_date
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN products p ON o.product_id = p.product_id;