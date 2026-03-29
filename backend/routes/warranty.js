// routes/warranty.js
const express = require('express');
const router = express.Router();
const { Warranty } = require('../models');

router.get('/lookup', async (req, res) => {
  const { phone, serial } = req.query;
  if (!phone && !serial) return res.status(400).json({ error: 'Nhập SĐT hoặc serial' });

  const filter = phone ? { customer_phone: phone } : { $or: [{ serial_number: serial }, { imei: serial }] };
  const list = await Warranty.find(filter).populate('product', 'name brand image_url').lean();
  if (!list.length) return res.status(404).json({ error: 'Không tìm thấy thông tin bảo hành' });

  const now = new Date().toISOString().slice(0, 10);
  res.json(list.map(w => ({ ...w, id: w._id, product_name: w.product?.name, brand: w.product?.brand, image_url: w.product?.image_url, is_valid: w.expires_at > now, days_left: Math.max(0, Math.ceil((new Date(w.expires_at) - new Date(now)) / 86400000)) })));
});

module.exports = router;
