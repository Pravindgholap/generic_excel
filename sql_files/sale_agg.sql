SELECT 
    p.category,
    COUNT(o.order_id) as total_orders,
    SUM(o.quantity) as total_quantity,
    SUM(o.total_amount) as total_revenue,
    AVG(o.total_amount) as avg_order_value,
    MAX(o.total_amount) as max_order_value
FROM orders o
JOIN products p ON o.product_id = p.product_id
GROUP BY p.category;