// routes/reviews.js
const express = require('express');
const router = express.Router();
const { Review, Order } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const mongoose = require('mongoose');

router.get('/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate('user', 'name').sort('-createdAt').limit(20).lean();
    let stats = { avg_rating: 0, total: 0 };
    try {
      const agg = await Review.aggregate([
        { $match: { product: new mongoose.Types.ObjectId(req.params.productId) } },
        { $group: { _id: null, avg: { $avg: '$rating' }, total: { $sum: 1 } } }
      ]);
      if (agg[0]) stats = { avg_rating: Math.round(agg[0].avg * 10) / 10, total: agg[0].total };
    } catch {}
    res.json({ reviews: reviews.map(r => ({ ...r, id: r._id, user_name: r.user?.name })), ...stats });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_id, order_id, rating, comment, image_url } = req.body;
    const bought = await Order.findOne({ _id: order_id, user: req.user.id, status: 'delivered', 'items.product': product_id });
    if (!bought) return res.status(403).json({ error: 'Chỉ đánh giá được sản phẩm đã mua và nhận hàng' });
    await Review.create({ product: product_id, user: req.user.id, order: order_id, rating, comment, image_url });
    res.status(201).json({ message: 'Cảm ơn đánh giá!' });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Đã đánh giá rồi' });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
