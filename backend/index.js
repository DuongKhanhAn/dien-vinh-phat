// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connect = require('./db/connect');

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173']
  : ['http://localhost:5173'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/reviews',  require('./routes/reviews'));
app.use('/api/coupons',  require('./routes/coupons'));
app.use('/api/warranty', require('./routes/warranty'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));
app.use((req, res) => res.status(404).json({ error: 'API không tồn tại' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Lỗi server' }); });

connect().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
});
