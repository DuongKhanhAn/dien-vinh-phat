// routes/products.js
const express = require('express');
const router = express.Router();
const { Product, Category } = require('../models');

// GET /api/products/id/:id — theo ObjectId
router.get('/id/:id', async (req, res) => {
  try {
    const p = await Product.findById(req.params.id).populate('category', 'name slug').lean();
    if (!p || !p.is_active) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(formatProduct(p));
  } catch { res.status(404).json({ error: 'Không tìm thấy' }); }
});

// GET /api/products — danh sách + filter
router.get('/', async (req, res) => {
  try {
    const { category, search, page = 1, limit = 12, sort = 'newest', brand, pmin, pmax } = req.query;
    const filter = { is_active: true };

    if (category) {
      const cat = await Category.findOne({ slug: category });
      if (cat) filter.category = cat._id;
    }
    if (search)  filter.name = { $regex: search, $options: 'i' };
    if (brand)   filter.brand = brand;
    if (pmin || pmax) {
      filter.price = {};
      if (pmin) filter.price.$gte = parseFloat(pmin);
      if (pmax) filter.price.$lte = parseFloat(pmax);
    }

    const sortMap = { newest: '-createdAt', price_asc: 'price', price_desc: '-price', name: 'name' };
    const sortOpt = sortMap[sort] || '-createdAt';

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortOpt)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    res.json({
      products: products.map(formatProduct),
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const product = await Product.findOne({ slug: req.params.slug, is_active: true })
      .populate('category', 'name slug').lean();
    if (!product) return res.status(404).json({ error: 'Không tìm thấy' });

    const related = await Product.find({
      category: product.category._id, _id: { $ne: product._id }, is_active: true
    }).limit(4).select('name slug price image_url').lean();

    res.json({ product: formatProduct(product), related });
  } catch { res.status(404).json({ error: 'Không tìm thấy' }); }
});

function formatProduct(p) {
  return {
    ...p,
    id: p._id,
    category_name: p.category?.name,
    category_slug: p.category?.slug,
    specs: p.specs instanceof Map ? Object.fromEntries(p.specs) : (p.specs || {}),
    upsell_ids: (p.upsell_ids || []).map(id => id.toString())
  };
}

module.exports = router;
