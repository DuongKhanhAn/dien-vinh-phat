// routes/warranty.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/warranty/lookup — Tra cứu công khai
router.get('/lookup', (req, res) => {
  const { phone, serial } = req.query;
  if (!phone && !serial) return res.status(400).json({ error: 'Nhập số điện thoại hoặc số serial' });

  const where = phone ? 'w.customer_phone = ?' : '(w.serial_number = ? OR w.imei = ?)';
  const params = phone ? [phone] : [serial, serial];

  const warranties = db.prepare(`
    SELECT w.*, p.name as product_name, p.image_url, p.brand
    FROM warranties w
    JOIN products p ON p.id = w.product_id
    WHERE ${where}
    ORDER BY w.created_at DESC
  `).all(...params);

  if (!warranties.length) return res.status(404).json({ error: 'Không tìm thấy thông tin bảo hành' });

  const now = new Date().toISOString().slice(0, 10);
  res.json(warranties.map(w => ({
    ...w,
    is_valid: w.expires_at > now,
    days_left: Math.max(0, Math.ceil((new Date(w.expires_at) - new Date(now)) / 86400000))
  })));
});

// POST /api/warranty/admin — Cấp phiếu bảo hành (admin)
// Giữ lại để tương thích ngược
router.post('/admin', authMiddleware, adminOnly, handleCreateWarranty);

module.exports = router;

function handleCreateWarranty(req, res) {
  const { order_id, product_id, customer_phone, serial_number, imei, purchase_date, warranty_months, notes } = req.body;
  if (!order_id || !product_id || !customer_phone || !purchase_date || !warranty_months) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }
  const d = new Date(purchase_date);
  d.setMonth(d.getMonth() + parseInt(warranty_months));
  const expires_at = d.toISOString().slice(0, 10);

  try {
    db.prepare(`
      INSERT INTO warranties (order_id, product_id, customer_phone, serial_number, imei, purchase_date, expires_at, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(order_id, product_id, customer_phone, serial_number || null, imei || null, purchase_date, expires_at, notes || null);
    res.status(201).json({ message: 'Tạo phiếu bảo hành thành công', expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
