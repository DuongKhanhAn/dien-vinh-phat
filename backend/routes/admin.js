// routes/admin.js
const express = require('express');
const router = express.Router();
const { Order, Product, Category, Coupon, Warranty } = require('../models');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// Áp middleware cho toàn bộ admin router
router.use(authMiddleware, adminOnly);

// ─── Upload ảnh ───────────────────────────────────────────────────────────────
// Dùng multer memory storage + cloudinary v2 stream (tránh lỗi multer-storage-cloudinary)
router.post('/upload', (req, res) => {
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

  upload.single('image')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Không có file' });

    try {
      const cloudinary = require('../db/cloudinary');
      const streamifier = require('streamifier');

      const stream = cloudinary.uploader.upload_stream(
        { folder: 'dien-vinh-phat', transformation: [{ width: 800, height: 600, crop: 'limit', quality: 'auto' }] },
        (error, result) => {
          if (error) return res.status(500).json({ error: error.message });
          res.json({ url: result.secure_url, public_id: result.public_id });
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
});

// ─── Orders ───────────────────────────────────────────────────────────────────
router.get('/orders', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status && status !== 'all' ? { status } : {};
    const orders = await Order.find(filter).sort('-createdAt').limit(200).lean();
    res.json(orders.map(o => ({ ...o, id: o._id, created_at: o.createdAt })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending','confirmed','shipping','delivered','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Không tìm thấy' });
    if (status === 'cancelled' && order.status !== 'cancelled') {
      await Promise.all(order.items.map(i => Product.findByIdAndUpdate(i.product, { $inc: { stock: i.quantity } })));
    }
    order.status = status;
    await order.save();
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Products ─────────────────────────────────────────────────────────────────
router.get('/products/all', async (req, res) => {
  try {
    const products = await Product.find().populate('category', 'name').sort('-createdAt').lean();
    res.json(products.map(p => ({ ...p, id: p._id, category_name: p.category?.name })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/products/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).populate('category', 'name').lean();
    if (!p) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json({ ...p, id: p._id, category_name: p.category?.name,
      specs: p.specs instanceof Map ? Object.fromEntries(p.specs) : (p.specs || {}) });
  } catch { res.status(404).json({ error: 'Không tìm thấy' }); }
});

router.post('/products', async (req, res) => {
  try {
    const { name, slug, brand, price, stock=0, min_stock=5, weight_kg=1,
      description, image_url, category_id, is_active=true } = req.body;
    if (!name || !slug || !price || !category_id)
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });

    let specs = {};
    const rawSpecs = req.body.specs;
    if (rawSpecs && typeof rawSpecs === 'string') { try { specs = JSON.parse(rawSpecs); } catch { specs = {}; } }
    else if (rawSpecs && typeof rawSpecs === 'object') { specs = rawSpecs; }

    let upsell_ids = [];
    const rawUids = req.body.upsell_ids;
    if (Array.isArray(rawUids)) upsell_ids = rawUids.filter(x => x && x !== '' && x !== '0');
    else if (typeof rawUids === 'string') { try { upsell_ids = JSON.parse(rawUids).filter(x => x && x !== ''); } catch { upsell_ids = []; } }

    const p = await Product.create({
      name, slug, brand: brand || undefined, price, stock, min_stock, weight_kg,
      description: description || undefined, image_url: image_url || undefined,
      category: category_id, specs, upsell_ids,
      is_active: is_active === true || is_active === 1 || is_active === 'true'
    });
    res.status(201).json({ message: 'Thêm thành công', id: p._id });
  } catch (err) {
    res.status(err.code === 11000 ? 409 : 500).json({ error: err.code === 11000 ? 'Slug đã tồn tại' : err.message });
  }
});

router.patch('/products/:id', async (req, res) => {
  try {
    const { category_id, is_active, ...rest } = req.body;
    const update = { ...rest };
    if (category_id) update.category = category_id;
    if (is_active !== undefined) update.is_active = is_active === true || is_active === 1 || is_active === 'true';
    if (update.specs !== undefined && typeof update.specs === 'string') {
      try { update.specs = JSON.parse(update.specs); } catch { delete update.specs; }
    }
    if (update.upsell_ids !== undefined) {
      if (!Array.isArray(update.upsell_ids)) {
        try { update.upsell_ids = JSON.parse(update.upsell_ids || '[]').filter(Boolean); } catch { delete update.upsell_ids; }
      } else { update.upsell_ids = update.upsell_ids.filter(x => x && x !== ''); }
    }
    await Product.findByIdAndUpdate(req.params.id, update);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { is_active: false });
    res.json({ message: 'Đã xoá' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Reports ──────────────────────────────────────────────────────────────────
router.get('/reports/summary', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const [today_orders, pending_orders, month_rev, total_orders, low_stock] = await Promise.all([
      Order.countDocuments({ createdAt: { $gte: today }, status: { $ne: 'cancelled' } }),
      Order.countDocuments({ status: { $in: ['pending','confirmed'] } }),
      Order.aggregate([{ $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: { $subtract: ['$total_amount', '$discount_amount'] } } } }]),
      Order.countDocuments({ status: { $ne: 'cancelled' } }),
      Product.countDocuments({ $expr: { $lte: ['$stock', '$min_stock'] }, is_active: true })
    ]);
    res.json({ today_orders, pending_orders, month_revenue: month_rev[0]?.total || 0, total_orders, low_stock });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/revenue', async (req, res) => {
  try {
    const months = Math.min(parseInt(req.query.months) || 6, 24);
    const from = new Date(); from.setMonth(from.getMonth() - months);
    const data = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' }, createdAt: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: { $subtract: ['$total_amount', '$discount_amount'] } }, orders: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json(data.map(d => ({ month: d._id, revenue: d.revenue, orders: d.orders })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/top-products', async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.product', name: { $first: '$items.name' }, image_url: { $first: '$items.image_url' }, total_sold: { $sum: '$items.quantity' }, total_revenue: { $sum: { $multiply: ['$items.quantity', '$items.unit_price'] } } } },
      { $sort: { total_sold: -1 } }, { $limit: parseInt(req.query.limit) || 10 }
    ]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/reports/low-stock', async (req, res) => {
  try {
    const products = await Product.find({ $expr: { $lte: ['$stock', '$min_stock'] }, is_active: true })
      .populate('category', 'name').sort('stock').lean();
    res.json(products.map(p => ({ ...p, id: p._id, category_name: p.category?.name })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Warranty ─────────────────────────────────────────────────────────────────
router.post('/warranty', async (req, res) => {
  try {
    const { order_id, product_id, customer_phone, serial_number, imei, purchase_date, warranty_months, notes } = req.body;
    const d = new Date(purchase_date);
    d.setMonth(d.getMonth() + parseInt(warranty_months));
    const expires_at = d.toISOString().slice(0, 10);
    const w = await Warranty.create({ order: order_id, product: product_id, customer_phone, serial_number, imei, purchase_date, expires_at, notes });
    res.status(201).json({ message: 'Cấp bảo hành thành công', expires_at, id: w._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/warranty', async (req, res) => {
  try {
    const filter = req.query.order_id ? { order: req.query.order_id } : {};
    const list = await Warranty.find(filter).populate('product', 'name brand').sort('-createdAt').limit(100).lean();
    res.json(list);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Coupons ──────────────────────────────────────────────────────────────────
router.get('/coupons', async (req, res) => {
  try {
    const coupons = await Coupon.find().sort('-createdAt').lean();
    res.json(coupons.map(c => ({ ...c, id: c._id })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/coupons', async (req, res) => {
  try {
    const { code, type, value, min_order = 0, max_uses = 100, expires_at } = req.body;
    if (!code || !type) return res.status(400).json({ error: 'Thiếu mã hoặc loại' });
    if (type !== 'free_ship' && (!value || parseFloat(value) <= 0))
      return res.status(400).json({ error: 'Vui lòng nhập giá trị giảm giá' });
    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(), type,
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

router.patch('/coupons/:id', async (req, res) => {
  try {
    await Coupon.findByIdAndUpdate(req.params.id, { is_active: req.body.is_active });
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/coupons/:id', async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xoá' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
