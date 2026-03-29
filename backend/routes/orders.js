// routes/orders.js
const express = require('express');
const router = express.Router();
const { Order, Product, Coupon, Warranty } = require('../models');
const { authMiddleware } = require('../middleware/auth');

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { customer_name, customer_phone, shipping_address, payment_method = 'cod',
      note, items, coupon_code, install_date, install_slot } = req.body;

    if (!customer_name || !customer_phone || !shipping_address || !items?.length)
      return res.status(400).json({ error: 'Thiếu thông tin đặt hàng' });

    let total_amount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product_id);
      if (!product || !product.is_active) return res.status(400).json({ error: `Sản phẩm không tồn tại` });
      if (product.stock < item.quantity) return res.status(400).json({ error: `"${product.name}" chỉ còn ${product.stock} cái` });
      total_amount += product.price * item.quantity;
      orderItems.push({ product: product._id, name: product.name, image_url: product.image_url, slug: product.slug, quantity: item.quantity, unit_price: product.price });
    }

    let discount_amount = 0;
    let validCoupon = null;
    if (coupon_code) {
      validCoupon = await Coupon.findOne({ code: coupon_code.toUpperCase(), is_active: true, used_count: { $lt: mongoose.model ? 999 : 999 } });
      if (validCoupon && (!validCoupon.expires_at || validCoupon.expires_at > new Date()) && total_amount >= validCoupon.min_order) {
        if (validCoupon.type === 'percent') discount_amount = Math.round(total_amount * validCoupon.value / 100);
        else if (validCoupon.type === 'fixed') discount_amount = Math.min(validCoupon.value, total_amount);
      }
    }

    const order = await Order.create({
      user: req.user.id, customer_name, customer_phone, shipping_address,
      payment_method, note, items: orderItems,
      total_amount, discount_amount,
      coupon_code: coupon_code?.toUpperCase() || null,
      install_date: install_date || null, install_slot: install_slot || null
    });

    // Giảm tồn kho + tăng used_count
    await Promise.all([
      ...orderItems.map(i => Product.findByIdAndUpdate(i.product, { $inc: { stock: -i.quantity } })),
      ...(validCoupon && discount_amount > 0 ? [Coupon.findByIdAndUpdate(validCoupon._id, { $inc: { used_count: 1 } })] : [])
    ]);

    res.status(201).json({ message: 'Đặt hàng thành công!', order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/my', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id }).sort('-createdAt').lean();
    res.json(orders.map(o => ({ ...o, id: o._id, created_at: o.createdAt })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ error: 'Không tìm thấy' });
    if (req.user.role !== 'admin' && order.user.toString() !== req.user.id)
      return res.status(403).json({ error: 'Không có quyền' });

    const warranties = await Warranty.find({ order: order._id }).populate('product', 'name brand').lean();
    const now = new Date().toISOString().slice(0, 10);

    res.json({
      order: { ...order, id: order._id, created_at: order.createdAt },
      items: order.items.map(i => ({ ...i, id: i._id })),
      warranties: warranties.map(w => ({
        ...w, id: w._id, product_name: w.product?.name, brand: w.product?.brand,
        is_valid: w.expires_at > now,
        days_left: Math.max(0, Math.ceil((new Date(w.expires_at) - new Date(now)) / 86400000))
      }))
    });
  } catch { res.status(404).json({ error: 'Không tìm thấy' }); }
});

router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy' });
    if (order.user.toString() !== req.user.id) return res.status(403).json({ error: 'Không có quyền' });
    if (!['pending', 'confirmed'].includes(order.status))
      return res.status(400).json({ error: 'Chỉ huỷ được khi chưa vận chuyển' });

    await Promise.all([
      ...order.items.map(i => Product.findByIdAndUpdate(i.product, { $inc: { stock: i.quantity } })),
      ...(order.coupon_code && order.discount_amount > 0
        ? [Coupon.findOneAndUpdate({ code: order.coupon_code }, { $inc: { used_count: -1 } })]
        : [])
    ]);

    order.status = 'cancelled';
    await order.save();
    res.json({ message: 'Đã huỷ đơn hàng' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
