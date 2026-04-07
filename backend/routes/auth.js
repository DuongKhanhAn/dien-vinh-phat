// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Thiếu thông tin' });
    if (password.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
    if (await User.findOne({ email })) return res.status(409).json({ error: 'Email đã tồn tại' });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password_hash, phone });
    const token = jwt.sign({ id: user._id, name, email, role: 'customer' }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user._id, name, email, role: 'customer' } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password_hash))
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    const token = jwt.sign({ id: user._id, name: user.name, email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email, role: user.role } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password_hash');
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
