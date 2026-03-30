// routes/coupons.js
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// POST /api/coupons/validate — khách dùng
router.post('/validate', authMiddleware, (req, res) => {
  const { code, order_total } = req.body;
  if (!code) return res.status(400).json({ error: 'Nhập mã giảm giá' });

  const coupon = db.prepare(`
    SELECT * FROM coupons
    WHERE code = ? AND is_active = 1
      AND (expires_at IS NULL OR expires_at > datetime('now'))
      AND used_count < max_uses
  `).get(code.toUpperCase().trim());

  if (!coupon) return res.status(404).json({ error: 'Mã không hợp lệ hoặc đã hết hạn' });
  if ((order_total || 0) < coupon.min_order) {
    return res.status(400).json({ error: `Đơn tối thiểu ${coupon.min_order.toLocaleString('vi-VN')}₫` });
  }

  let discount = 0, message = '';
  if (coupon.type === 'percent') {
    discount = Math.round((order_total || 0) * coupon.value / 100);
    message = `Giảm ${coupon.value}% — tiết kiệm ${discount.toLocaleString('vi-VN')}₫`;
  } else if (coupon.type === 'fixed') {
    discount = Math.min(coupon.value, order_total || 0);
    message = `Giảm ${discount.toLocaleString('vi-VN')}₫`;
  } else if (coupon.type === 'free_ship') {
    message = 'Miễn phí vận chuyển!';
  }

  res.json({ coupon, discount, message: `Áp dụng thành công! ${message}` });
});

// ─── Admin routes — dùng middleware riêng từng route, KHÔNG dùng router.use ──
// Lý do: router.use('/admin', mw) sẽ match tất cả /admin/* nhưng không
// forward đúng sang router.get('/admin'), gây ra 404.

router.get('/admin', authMiddleware, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all());
});

router.post('/admin', authMiddleware, adminOnly, (req, res) => {
  const { code, type, value, min_order = 0, max_uses = 100, expires_at } = req.body;
  if (!code || !type) return res.status(400).json({ error: 'Thiếu mã hoặc loại' });
  if (type !== 'free_ship' && (value === undefined || value === '' || parseFloat(value) <= 0)) {
    return res.status(400).json({ error: 'Vui lòng nhập giá trị giảm giá' });
  }
  const finalValue = type === 'free_ship' ? 0 : parseFloat(value);
  try {
    db.prepare('INSERT INTO coupons (code, type, value, min_order, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(code.toUpperCase().trim(), type, finalValue,
        parseFloat(min_order) || 0, parseInt(max_uses) || 100, expires_at || null);
    res.status(201).json({ message: 'Tạo mã thành công' });
  } catch {
    res.status(409).json({ error: 'Mã đã tồn tại' });
  }
});

router.patch('/admin/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('UPDATE coupons SET is_active = ? WHERE id = ?').run(req.body.is_active, req.params.id);
  res.json({ message: 'Cập nhật thành công' });
});

router.delete('/admin/:id', authMiddleware, adminOnly, (req, res) => {
  db.prepare('DELETE FROM coupons WHERE id = ?').run(req.params.id);
  res.json({ message: 'Đã xoá' });
});

module.exports = router;
