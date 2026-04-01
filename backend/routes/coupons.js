// routes/coupons.js
const express = require('express');
const router = express.Router();
const { Coupon } = require('../models');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// ─── Khách dùng ───────────────────────────────────────────────────────────────

router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { code, order_total } = req.body;
    if (!code) return res.status(400).json({ error: 'Nhập mã giảm giá' });

    const coupon = await Coupon.findOne({
      code: code.toUpperCase().trim(),
      is_active: true,
      $expr: { $lt: ['$used_count', '$max_uses'] }
    });

    if (!coupon) return res.status(404).json({ error: 'Mã không hợp lệ hoặc đã hết' });
    if (coupon.expires_at && coupon.expires_at < new Date())
      return res.status(400).json({ error: 'Mã đã hết hạn' });
    if ((order_total || 0) < coupon.min_order)
      return res.status(400).json({ error: `Đơn tối thiểu ${coupon.min_order.toLocaleString('vi-VN')}đ` });

    let discount = 0, message = '';
    if (coupon.type === 'percent') {
      discount = Math.round((order_total || 0) * coupon.value / 100);
      message = `Giảm ${coupon.value}% — tiết kiệm ${discount.toLocaleString('vi-VN')}đ`;
    } else if (coupon.type === 'fixed') {
      discount = Math.min(coupon.value, order_total || 0);
      message = `Giảm ${discount.toLocaleString('vi-VN')}đ`;
    } else if (coupon.type === 'free_ship') {
      message = 'Miễn phí vận chuyển!';
    }

    res.json({ coupon, discount, message: `Áp dụng thành công! ${message}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin — mỗi route gắn middleware trực tiếp (không dùng router.use) ───────

router.get('/admin', authMiddleware, adminOnly, async (req, res) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt').lean();
    res.json(coupons.map(c => ({ ...c, id: c._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { code, type, value, min_order = 0, max_uses = 100, expires_at } = req.body;
    if (!code || !type) return res.status(400).json({ error: 'Thiếu mã hoặc loại' });
    if (type !== 'free_ship' && (!value || parseFloat(value) <= 0))
      return res.status(400).json({ error: 'Vui lòng nhập giá trị giảm giá' });

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      type,
      value: type === 'free_ship' ? 0 : parseFloat(value),
      min_order: parseFloat(min_order) || 0,
      max_uses: parseInt(max_uses) || 100,
      expires_at: expires_at || undefined,
    });
    res.status(201).json({ message: 'Tạo mã thành công', id: coupon._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Mã đã tồn tại' });
    res.status(500).json({ error: err.message });
  }
});

router.patch('/admin/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Coupon.findByIdAndUpdate(req.params.id, { is_active: req.body.is_active });
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xoá' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;