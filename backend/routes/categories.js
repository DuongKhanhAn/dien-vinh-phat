// routes/categories.js
const express = require('express');
const router = express.Router();
const { Category, Product } = require('../models');

router.get('/', async (req, res) => {
  try {
    const cats = await Category.find().lean();
    const counts = await Product.aggregate([
      { $match: { is_active: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    const countMap = Object.fromEntries(counts.map(c => [c._id.toString(), c.count]));
    res.json(cats.map(c => ({ ...c, id: c._id, product_count: countMap[c._id.toString()] || 0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
