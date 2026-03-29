// models/index.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── Category ─────────────────────────────────────────────────────────────────
const categorySchema = new Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  icon: { type: String, default: '⚡' }
});
const Category = mongoose.model('Category', categorySchema);

// ─── Product ──────────────────────────────────────────────────────────────────
const productSchema = new Schema({
  category:    { type: Schema.Types.ObjectId, ref: 'Category' },
  name:        { type: String, required: true },
  slug:        { type: String, required: true, unique: true },
  brand:       String,
  price:       { type: Number, required: true },
  stock:       { type: Number, default: 0 },
  min_stock:   { type: Number, default: 5 },
  weight_kg:   { type: Number, default: 1 },
  image_url:   String,
  description: String,
  specs:       { type: Map, of: String, default: {} },
  upsell_ids:  [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  is_active:   { type: Boolean, default: true }
}, { timestamps: true });
const Product = mongoose.model('Product', productSchema);

// ─── User ─────────────────────────────────────────────────────────────────────
const userSchema = new Schema({
  name:          { type: String, required: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  password_hash: { type: String, required: true },
  phone:         String,
  address:       String,
  role:          { type: String, enum: ['customer', 'admin'], default: 'customer' }
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// ─── Order ────────────────────────────────────────────────────────────────────
const orderItemSchema = new Schema({
  product:    { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name:       String,
  image_url:  String,
  slug:       String,
  quantity:   { type: Number, required: true },
  unit_price: { type: Number, required: true }
});

const orderSchema = new Schema({
  user:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
  customer_name:    { type: String, required: true },
  customer_phone:   { type: String, required: true },
  shipping_address: { type: String, required: true },
  payment_method:   { type: String, enum: ['cod', 'bank_transfer', 'momo'], default: 'cod' },
  status:           { type: String, enum: ['pending','confirmed','shipping','delivered','cancelled'], default: 'pending' },
  items:            [orderItemSchema],
  total_amount:     { type: Number, required: true },
  discount_amount:  { type: Number, default: 0 },
  coupon_code:      String,
  install_date:     String,
  install_slot:     String,
  note:             String
}, { timestamps: true });
const Order = mongoose.model('Order', orderSchema);

// ─── Coupon ───────────────────────────────────────────────────────────────────
const couponSchema = new Schema({
  code:       { type: String, required: true, unique: true, uppercase: true },
  type:       { type: String, enum: ['percent', 'fixed', 'free_ship'], required: true },
  value:      { type: Number, default: 0 },
  min_order:  { type: Number, default: 0 },
  max_uses:   { type: Number, default: 100 },
  used_count: { type: Number, default: 0 },
  expires_at: Date,
  is_active:  { type: Boolean, default: true }
}, { timestamps: true });
const Coupon = mongoose.model('Coupon', couponSchema);

// ─── Review ───────────────────────────────────────────────────────────────────
const reviewSchema = new Schema({
  product:   { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  order:     { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  rating:    { type: Number, min: 1, max: 5, required: true },
  comment:   String,
  image_url: String
}, { timestamps: true });
reviewSchema.index({ product: 1, user: 1, order: 1 }, { unique: true });
const Review = mongoose.model('Review', reviewSchema);

// ─── Warranty ─────────────────────────────────────────────────────────────────
const warrantySchema = new Schema({
  order:          { type: Schema.Types.ObjectId, ref: 'Order', required: true },
  product:        { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  customer_phone: { type: String, required: true },
  serial_number:  String,
  imei:           String,
  purchase_date:  { type: String, required: true },
  expires_at:     { type: String, required: true },
  notes:          String
}, { timestamps: true });
const Warranty = mongoose.model('Warranty', warrantySchema);

module.exports = { Category, Product, User, Order, Coupon, Review, Warranty };
