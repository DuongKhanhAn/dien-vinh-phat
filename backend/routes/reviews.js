// routes/reviews.js
const express = require('express');
const router = express.Router();
const { Review, Order } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.get('/:productId', async (req, res) => {
  const reviews = await Review.find({ product: req.params.productId }).populate('user', 'name').sort('-createdAt').limit(20).lean();
  const stats = await Review.aggregate([{ $match: { product: require('mongoose').Types.ObjectId.createFromHexString(req.params.productId) } }, { $group: { _id: null, avg: { $avg: '$rating' }, total: { $sum: 1 } } }]);
  res.json({ reviews: reviews.map(r => ({ ...r, id: r._id, user_name: r.user?.name })), avg_rating: Math.round((stats[0]?.avg || 0) * 10) / 10, total: stats[0]?.total || 0 });
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { product_id, order_id, rating, comment, image_url } = req.body;
    const bought = await Order.findOne({ _id: order_id, user: req.user.id, status: 'delivered', 'items.product': product_id });
    if (!bought) return res.status(403).json({ error: 'Chỉ đánh giá được sản phẩm đã mua và nhận hàng' });
    await Review.create({ product: product_id, user: req.user.id, order: order_id, rating, comment, image_url });
    res.status(201).json({ message: 'Cảm ơn đánh giá!' });
  } catch (err) { res.status(err.code === 11000 ? 409 : 500).json({ error: err.code === 11000 ? 'Đã đánh giá rồi' : err.message }); }
});

module.exports = router;
