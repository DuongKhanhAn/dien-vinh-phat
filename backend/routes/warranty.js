// routes/warranty.js
const express = require('express');
const router = express.Router();
const { Warranty } = require('../models');

// GET /api/warranty/lookup?phone=xxx hoặc ?serial=xxx
router.get('/lookup', async (req, res) => {
  try {
    const { phone, serial } = req.query;
    if (!phone && !serial)
      return res.status(400).json({ error: 'Nhập số điện thoại hoặc số serial' });

    const filter = phone
      ? { customer_phone: phone }
      : { $or: [{ serial_number: serial }, { imei: serial }] };

    const warranties = await Warranty.find(filter)
      .populate('product', 'name image_url brand')
      .sort('-createdAt').lean();

    if (!warranties.length)
      return res.status(404).json({ error: 'Không tìm thấy thông tin bảo hành' });

    const now = new Date().toISOString().slice(0, 10);
    res.json(warranties.map(w => ({
      ...w, id: w._id,
      product_name: w.product?.name,
      image_url:    w.product?.image_url,
      brand:        w.product?.brand,
      is_valid:  w.expires_at > now,
      days_left: Math.max(0, Math.ceil((new Date(w.expires_at) - new Date(now)) / 86400000))
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
