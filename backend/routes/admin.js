// routes/admin.js  (thay thế toàn bộ file cũ)
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware, adminOnly);

// ─── ORDERS ───────────────────────────────────────────────────────────────────

router.get('/orders', (req, res) => {
  const { status } = req.query;
  const where = (status && status !== 'all') ? 'WHERE o.status = ?' : '';
  const params = (status && status !== 'all') ? [status] : [];
  const orders = db.prepare(`SELECT o.* FROM orders o ${where} ORDER BY o.created_at DESC LIMIT 200`).all(...params);
  res.json(orders);
});

router.patch('/orders/:id', (req, res) => {
  const { status } = req.body;
  const allowed = ['pending','confirmed','shipping','delivered','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  if (status === 'cancelled' && order.status !== 'cancelled') {
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    db.transaction(() => items.forEach(i =>
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(i.quantity, i.product_id)
    ))();
  }

  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Cập nhật thành công' });
});

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

router.get('/products/all', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  res.json(products);
});

router.get('/products/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  res.json(p);
});

router.post('/products', (req, res) => {
  const { name, slug, brand, price, stock=0, min_stock=5, weight_kg=1, description, image_url, category_id, specs='{}', upsell_ids='[]', is_active=1 } = req.body;
  if (!name || !slug || !price || !category_id) return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

  if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug))
    return res.status(409).json({ error: 'Slug đã tồn tại' });

  const { lastInsertRowid: id } = db.prepare(`
    INSERT INTO products (name, slug, brand, price, stock, min_stock, weight_kg, description, image_url, category_id, specs, upsell_ids, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, slug, brand||null, price, stock, min_stock, weight_kg, description||null, image_url||null, category_id,
         typeof specs==='string'?specs:JSON.stringify(specs),
         typeof upsell_ids==='string'?upsell_ids:JSON.stringify(upsell_ids), is_active);
  res.status(201).json({ message: 'Thêm sản phẩm thành công', id });
});

router.patch('/products/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  const { name, slug, brand, price, stock, min_stock, weight_kg, description, image_url, category_id, specs, upsell_ids, is_active } = req.body;

  if (slug && slug !== p.slug && db.prepare('SELECT id FROM products WHERE slug = ? AND id != ?').get(slug, req.params.id))
    return res.status(409).json({ error: 'Slug đã tồn tại' });

  db.prepare(`
    UPDATE products SET
      name=COALESCE(?,name), slug=COALESCE(?,slug), brand=COALESCE(?,brand),
      price=COALESCE(?,price), stock=COALESCE(?,stock), min_stock=COALESCE(?,min_stock),
      weight_kg=COALESCE(?,weight_kg), description=COALESCE(?,description),
      image_url=COALESCE(?,image_url), category_id=COALESCE(?,category_id),
      specs=COALESCE(?,specs), upsell_ids=COALESCE(?,upsell_ids), is_active=COALESCE(?,is_active)
    WHERE id = ?
  `).run(
    name??null, slug??null, brand??null, price??null, stock??null, min_stock??null,
    weight_kg??null, description??null, image_url??null, category_id??null,
    specs ? (typeof specs==='string'?specs:JSON.stringify(specs)) : null,
    upsell_ids ? (typeof upsell_ids==='string'?upsell_ids:JSON.stringify(upsell_ids)) : null,
    is_active??null, req.params.id
  );
  res.json({ message: 'Cập nhật thành công' });
});

router.delete('/products/:id', (req, res) => {
  if (!db.prepare('SELECT id FROM products WHERE id = ?').get(req.params.id))
    return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xoá sản phẩm' });
});

// ─── REPORTS ──────────────────────────────────────────────────────────────────

// GET /api/admin/reports/summary — Tổng quan nhanh
router.get('/reports/summary', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  const total_orders   = db.prepare("SELECT COUNT(*) c FROM orders WHERE status != 'cancelled'").get().c;
  const today_orders   = db.prepare("SELECT COUNT(*) c FROM orders WHERE DATE(created_at) = ?").get(today).c;
  const month_revenue  = db.prepare("SELECT SUM(total_amount - COALESCE(discount_amount,0)) s FROM orders WHERE strftime('%Y-%m',created_at) = ? AND status != 'cancelled'").get(thisMonth).s || 0;
  const pending_orders = db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('pending','confirmed')").get().c;
  const low_stock      = db.prepare("SELECT COUNT(*) c FROM products WHERE stock <= min_stock AND is_active = 1").get().c;

  res.json({ total_orders, today_orders, month_revenue, pending_orders, low_stock });
});

// GET /api/admin/reports/revenue?months=6 — Doanh thu theo tháng
router.get('/reports/revenue', (req, res) => {
  const months = Math.min(parseInt(req.query.months) || 6, 24);
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
           SUM(total_amount - COALESCE(discount_amount,0)) as revenue,
           COUNT(*) as orders
    FROM orders
    WHERE status != 'cancelled'
      AND created_at >= date('now', ?)
    GROUP BY month ORDER BY month
  `).all(`-${months} months`);
  res.json(rows);
});

// GET /api/admin/reports/top-products?limit=10 — Sản phẩm bán chạy
router.get('/reports/top-products', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const rows = db.prepare(`
    SELECT p.name, p.brand, p.image_url, p.price,
           SUM(oi.quantity) as total_sold,
           SUM(oi.quantity * oi.unit_price) as total_revenue
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status != 'cancelled'
    GROUP BY p.id
    ORDER BY total_sold DESC
    LIMIT ?
  `).all(limit);
  res.json(rows);
});

// GET /api/admin/reports/low-stock — Cảnh báo tồn kho
router.get('/reports/low-stock', (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name
    FROM products p LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.stock <= p.min_stock AND p.is_active = 1
    ORDER BY p.stock ASC
  `).all();
  res.json(products);
});

// ─── WARRANTY (admin) ─────────────────────────────────────────────────────────

// POST /api/admin/warranty — Cấp phiếu bảo hành
router.post('/warranty', (req, res) => {
  const { order_id, product_id, customer_phone, serial_number, imei, purchase_date, warranty_months, notes } = req.body;
  if (!order_id || !product_id || !customer_phone || !purchase_date || !warranty_months) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  // Kiểm tra đơn hàng và sản phẩm tồn tại
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id);
  if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });

  const d = new Date(purchase_date);
  d.setMonth(d.getMonth() + parseInt(warranty_months));
  const expires_at = d.toISOString().slice(0, 10);

  try {
    const { lastInsertRowid: id } = db.prepare(`
      INSERT INTO warranties (order_id, product_id, customer_phone, serial_number, imei, purchase_date, expires_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(order_id, product_id, customer_phone, serial_number || null, imei || null, purchase_date, expires_at, notes || null);
    res.status(201).json({ message: 'Tạo phiếu bảo hành thành công', expires_at, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/warranty?order_id=xxx — Danh sách bảo hành
router.get('/warranty', (req, res) => {
  const { order_id } = req.query;
  const list = order_id
    ? db.prepare(`SELECT w.*, p.name as product_name, p.brand FROM warranties w
        JOIN products p ON p.id = w.product_id WHERE w.order_id = ?`).all(order_id)
    : db.prepare(`SELECT w.*, p.name as product_name, p.brand FROM warranties w
        JOIN products p ON p.id = w.product_id ORDER BY w.created_at DESC LIMIT 100`).all();
  res.json(list);
});

module.exports = router;
