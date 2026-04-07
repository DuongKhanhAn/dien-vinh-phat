// routes/coupons.js
const express = require('express');
const router = express.Router();
const { Coupon } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { code, order_total } = req.body;
    if (!code) return res.status(400).json({ error: 'Nhập mã giảm giá' });

    const coupon = await Coupon.findOne({
      code: code.toUpperCase().trim(), is_active: true,
      $expr: { $lt: ['$used_count', '$max_uses'] }
    });

    if (!coupon) return res.status(404).json({ error: 'Mã không hợp lệ hoặc đã hết' });
    if (coupon.expires_at && coupon.expires_at < new Date())
      return res.status(400).json({ error: 'Mã đã hết hạn' });
    if ((order_total || 0) < coupon.min_order)
      return res.status(400).json({ error: `Đơn tối thiểu ${coupon.min_order.toLocaleString('vi-VN')}₫` });

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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
