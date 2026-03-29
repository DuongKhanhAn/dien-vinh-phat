// src/App.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import api from './api';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SHOP = {
  name: 'Điện Vĩnh Phát',
  phone: '0918058495',
  email: 'dienvinhphat75ks@gmail.com',
  address: 'Kế Sách, Sóc Trăng',
};

// ─── CONTEXTS ────────────────────────────────────────────────────────────────

const CartContext = createContext(null);
const AuthContext = createContext(null);
const ToastContext = createContext(null);

export const useCart = () => useContext(CartContext);
export const useAuth = () => useContext(AuthContext);
export const useToast = () => useContext(ToastContext);

// ─── TOAST PROVIDER ──────────────────────────────────────────────────────────

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, type = 'default') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'} {t.msg}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── AUTH PROVIDER ───────────────────────────────────────────────────────────

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── CART PROVIDER ───────────────────────────────────────────────────────────

function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cart')) || []; } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('cart', JSON.stringify(items)); }, [items]);

  const addItem = (product, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i => i.id === product.id
          ? { ...i, quantity: Math.min(i.quantity + quantity, product.stock) }
          : i
        );
      }
      return [...prev, { ...product, quantity }];
    });
  };

  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  const updateQty = (id, qty) => {
    if (qty < 1) return removeItem(id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  };

  const clearCart = () => setItems([]);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

// ─── REQUIRE LOGIN (wrapper) ──────────────────────────────────────────────────

function RequireLogin({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (!user) {
      toast('Vui lòng đăng nhập để tiếp tục!', 'error');
      navigate('/login');
    }
  }, [user]);

  if (!user) return null;
  return children;
}

// ─── REQUIRE ADMIN (wrapper) ──────────────────────────────────────────────────

function RequireAdmin({ children }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !isAdmin) navigate('/');
  }, [user, isAdmin]);

  if (!user || !isAdmin) return null;
  return children;
}

// ─── HEADER ──────────────────────────────────────────────────────────────────

function Header() {
  const { count } = useCart();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/products?search=${encodeURIComponent(search.trim())}`);
      setSearch('');
    }
  };

  return (
    <header style={styles.header}>
      <div className="container" style={styles.headerInner}>
        <Link to="/" style={styles.logo}>
          <span style={styles.logoIcon}>⚡</span>
          <span>
            <span style={{ color: '#fff', fontWeight: 700 }}>Điện </span>
            <span style={{ color: '#ffcc02', fontWeight: 700 }}>Vĩnh Phát</span>
          </span>
        </Link>

        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm sản phẩm..." style={styles.searchInput} />
          <button type="submit" style={styles.searchBtn}>🔍</button>
        </form>

        <div style={styles.headerActions}>
          {/* Giỏ hàng chỉ hiện với customer hoặc chưa đăng nhập */}
          {(!user || user.role === 'customer') && (
            <Link to="/cart" style={styles.cartBtn}>
              🛒
              {count > 0 && <span style={styles.cartBadge}>{count}</span>}
              <span style={{ fontSize: 13 }}>Giỏ hàng</span>
            </Link>
          )}

          {user ? (
            <div style={{ position: 'relative' }}>
              <button onClick={() => setMenuOpen(o => !o)} style={styles.userBtn}>
                {isAdmin ? '🔧' : '👤'} {user.name.split(' ').pop()}
              </button>
              {menuOpen && (
                <div style={styles.dropdown}>
                  {isAdmin ? (
                    <>
                      <Link to="/admin/orders" style={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                        📦 Đơn hàng cần giao
                      </Link>
                      <Link to="/admin/products" style={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                        🛍️ Quản lý sản phẩm
                      </Link>
                      <Link to="/admin/coupons" style={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                        🏷️ Mã giảm giá
                      </Link>
                      <Link to="/admin/reports" style={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                        📊 Báo cáo doanh thu
                      </Link>
                    </>
                  ) : (
                    <Link to="/orders/my" style={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                      📦 Đơn hàng của tôi
                    </Link>
                  )}
                  <button onClick={() => { logout(); setMenuOpen(false); navigate('/'); }} style={styles.dropdownItem}>
                    🚪 Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" style={styles.loginBtn}>Đăng nhập</Link>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={styles.footer}>
      <div className="container">
        <div style={styles.footerGrid}>
          <div>
            <div style={styles.footerLogo}>⚡ {SHOP.name}</div>
            <p style={styles.footerText}>Chuyên cung cấp thiết bị điện gia dụng chính hãng, giá tốt.</p>
          </div>
          <div>
            <p style={styles.footerHeading}>Danh mục</p>
            {['Dây & Phụ kiện điện', 'Đun nấu', 'Chiếu sáng', 'Nhà bếp'].map(c => (
              <p key={c} style={styles.footerText}>{c}</p>
            ))}
          </div>
          <div>
            <p style={styles.footerHeading}>Liên hệ</p>
            <p style={styles.footerText}>📞 {SHOP.phone}</p>
            <p style={styles.footerText}>📧 {SHOP.email}</p>
            <p style={styles.footerText}>📍 {SHOP.address}</p>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <p>© 2024 {SHOP.name}. Bảo lưu mọi quyền.</p>
        </div>
      </div>
    </footer>
  );
}


// ─── STAR RATING ──────────────────────────────────────────────────────────────

function StarRating({ value = 0, onChange, size = 20 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span key={s}
          onClick={() => onChange?.(s)}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          style={{ fontSize: size, cursor: onChange ? 'pointer' : 'default',
            color: s <= (hover || value) ? '#ff9800' : '#ddd', lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
}

// ─── COMPARE BAR (sticky bottom) ─────────────────────────────────────────────

function CompareBar({ items, onRemove, onClear, onCompare }) {
  if (!items.length) return null;
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
      borderTop: '2px solid var(--primary)', padding: '10px 20px',
      display: 'flex', alignItems: 'center', gap: 12, zIndex: 500,
      boxShadow: '0 -4px 16px rgba(0,0,0,0.1)' }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
        ⚖️ So sánh ({items.length}/3)
      </span>
      <div style={{ display: 'flex', gap: 8, flex: 1, overflowX: 'auto' }}>
        {items.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bg)', borderRadius: 8, padding: '4px 10px', fontSize: 13, whiteSpace: 'nowrap' }}>
            <img src={p.image_url} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} alt="" />
            <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
            <button onClick={() => onRemove(p.id)}
              style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>✕</button>
          </div>
        ))}
      </div>
      <button onClick={onCompare} disabled={items.length < 2} className="btn btn-primary"
        style={{ padding: '8px 18px', fontSize: 13, whiteSpace: 'nowrap' }}>
        So sánh ngay
      </button>
      <button onClick={onClear}
        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
        Xoá tất cả
      </button>
    </div>
  );
}

// ─── PRODUCT CARD (updated with compare + brand) ──────────────────────────────

export function ProductCard({ product, onCompare, compareIds = [] }) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const inCompare = compareIds.includes(product.id);

  const handleAdd = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast('Vui lòng đăng nhập để mua hàng!', 'error'); navigate('/login'); return; }
    addItem(product);
    toast('Đã thêm vào giỏ hàng!', 'success');
  };

  const handleCompare = (e) => {
    e.preventDefault(); e.stopPropagation();
    onCompare?.(product);
  };

  return (
    <Link to={`/products/${product.slug}`} style={styles.card}>
      <div style={styles.cardImgWrap}>
        <img src={product.image_url} alt={product.name} style={styles.cardImg} />
        {product.stock === 0 && <div style={styles.outOfStock}>Hết hàng</div>}
        {onCompare && (
          <button onClick={handleCompare} style={{
            position: 'absolute', top: 8, right: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: inCompare ? 'var(--primary)' : 'rgba(255,255,255,0.92)',
            color: inCompare ? '#fff' : 'var(--text)',
            border: 'none', borderRadius: 6, padding: '3px 8px' }}>
            {inCompare ? '✓ So sánh' : '+ So sánh'}
          </button>
        )}
      </div>
      <div style={styles.cardBody}>
        {product.brand && <p style={{ fontSize: 11, color: '#e53935', fontWeight: 600, marginBottom: 2 }}>{product.brand}</p>}
        <p style={styles.cardCat}>{product.category_name}</p>
        <p style={styles.cardName}>{product.name}</p>
        <div style={styles.cardFooter}>
          <span style={styles.cardPrice}>{product.price.toLocaleString('vi-VN')}₫</span>
          {!isAdmin && (
            <button onClick={handleAdd} disabled={product.stock === 0}
              style={product.stock === 0 ? styles.addBtnDisabled : styles.addBtn}>+</button>
          )}
        </div>
      </div>
    </Link>
  );
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────

function HomePage() {
  const [categories, setCategories] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareItems, setCompareItems] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/products?limit=8&sort=newest')])
      .then(([cats, prods]) => { setCategories(cats); setFeatured(prods.products); })
      .finally(() => setLoading(false));
  }, []);

  const banners = [
    { bg: 'linear-gradient(135deg,#b71c1c,#e53935)', emoji: '⚡', title: 'Dây & Phụ kiện Điện', sub: 'Cadivi chính hãng, đủ tiết diện', cat: 'day-phu-kien-dien' },
    { bg: 'linear-gradient(135deg,#e65100,#ff9800)', emoji: '💡', title: 'Đèn LED tiết kiệm', sub: 'Rạng Đông · Điện Quang · Philips', cat: 'chieu-sang' },
    { bg: 'linear-gradient(135deg,#1565c0,#42a5f5)', emoji: '🍵', title: 'Ấm & Nồi điện', sub: 'Giá rẻ, bảo hành chính hãng', cat: 'dun-nau' },
  ];
  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setBannerIdx(i => (i + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, []);
  const b = banners[bannerIdx];

  const handleCompare = (p) => {
    setCompareItems(prev => {
      if (prev.find(x => x.id === p.id)) return prev.filter(x => x.id !== p.id);
      if (prev.length >= 3) { return prev; }
      return [...prev, p];
    });
  };

  return (
    <div>
      <div style={{ ...styles.banner, background: b.bg }}>
        <div className="container" style={styles.bannerInner}>
          <div>
            <p style={styles.bannerSub}>⚡ {SHOP.name} — Chính hãng, giá tốt</p>
            <h1 style={styles.bannerTitle}>{b.emoji} {b.title}</h1>
            <p style={styles.bannerDesc}>{b.sub}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-accent" onClick={() => navigate(`/products?category=${b.cat}`)}>Xem ngay →</button>
              <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                onClick={() => navigate('/quiz')}>🎯 Tư vấn chọn đồ</button>
            </div>
          </div>
          <div style={styles.bannerEmoji}>{b.emoji}</div>
        </div>
        <div style={styles.bannerDots}>
          {banners.map((_, i) => (
            <button key={i} onClick={() => setBannerIdx(i)}
              style={{ ...styles.dot, ...(i === bannerIdx ? styles.dotActive : {}) }} />
          ))}
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, paddingBottom: compareItems.length ? 80 : 48 }}>
        {/* Quick links */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
          {[
            { icon: '⚖️', label: 'So sánh sản phẩm', to: '/compare' },
            { icon: '🛡️', label: 'Tra cứu bảo hành', to: '/warranty' },
            { icon: '🎯', label: 'Tư vấn chọn đồ', to: '/quiz' },
          ].map(x => (
            <Link key={x.to} to={x.to} style={{ display: 'flex', alignItems: 'center', gap: 8,
              background: '#fff', borderRadius: 10, padding: '10px 16px', boxShadow: 'var(--shadow)',
              fontSize: 14, fontWeight: 600, color: 'var(--primary)', transition: 'transform .2s' }}>
              {x.icon} {x.label}
            </Link>
          ))}
        </div>

        <h2 style={styles.sectionTitle}>📂 Danh mục sản phẩm</h2>
        <div style={styles.catGrid}>
          {categories.map(c => (
            <Link key={c.id} to={`/products?category=${c.slug}`} style={styles.catCard}>
              <span style={styles.catIcon}>{c.icon}</span>
              <span style={styles.catName}>{c.name}</span>
              <span style={styles.catCount}>{c.product_count} SP</span>
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 40 }}>
          <h2 style={styles.sectionTitle}>🔥 Sản phẩm nổi bật</h2>
          <Link to="/products" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>Xem tất cả →</Link>
        </div>

        {loading ? <div className="spinner" /> : (
          <div className="product-grid">
            {featured.map(p => (
              <ProductCard key={p.id} product={p}
                onCompare={handleCompare}
                compareIds={compareItems.map(x => x.id)} />
            ))}
          </div>
        )}

        <div style={styles.trustRow}>
          {[
            { icon: '🚚', t: 'Giao hàng toàn quốc', s: 'Nhanh chóng, an toàn' },
            { icon: '✅', t: 'Hàng chính hãng 100%', s: 'Bảo hành đầy đủ' },
            { icon: '🔄', t: 'Đổi trả 7 ngày', s: 'Nếu lỗi từ nhà sản xuất' },
            { icon: '📞', t: 'Hỗ trợ 24/7', s: SHOP.phone },
          ].map(x => (
            <div key={x.t} style={styles.trustItem}>
              <span style={{ fontSize: 28 }}>{x.icon}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{x.t}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{x.s}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CompareBar items={compareItems} onRemove={id => setCompareItems(p => p.filter(x => x.id !== id))}
        onClear={() => setCompareItems([])}
        onCompare={() => navigate(`/compare?ids=${compareItems.map(x => x.id).join(',')}`)} />
    </div>
  );
}

// ─── PRODUCTS PAGE (lọc nâng cao) ────────────────────────────────────────────

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({});
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [compareItems, setCompareItems] = useState([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const category = params.get('category') || '';
  const search   = params.get('search') || '';
  const page     = parseInt(params.get('page') || '1');
  const sort     = params.get('sort') || 'newest';
  const brand    = params.get('brand') || '';
  const pmin     = params.get('pmin') || '';
  const pmax     = params.get('pmax') || '';

  useEffect(() => { api.get('/categories').then(setCategories); }, []);

  useEffect(() => {
    setLoading(true);
    const q = new URLSearchParams({ category, search, page, sort, limit: 12 });
    if (brand) q.set('brand', brand);
    if (pmin)  q.set('pmin', pmin);
    if (pmax)  q.set('pmax', pmax);
    api.get(`/products?${q}`).then(data => {
      setProducts(data.products);
      setPagination(data.pagination);
      const bs = [...new Set(data.products.map(p => p.brand).filter(Boolean))];
      if (bs.length) setBrands(bs);
    }).finally(() => setLoading(false));
  }, [category, search, page, sort, brand, pmin, pmax]);

  const setParam = (key, val) => {
    const p = new URLSearchParams(location.search);
    if (val) p.set(key, val); else p.delete(key);
    if (key !== 'page') p.delete('page');
    navigate(`/products?${p}`);
  };

  const applyPrice = () => {
    const p = new URLSearchParams(location.search);
    if (priceMin) p.set('pmin', priceMin); else p.delete('pmin');
    if (priceMax) p.set('pmax', priceMax); else p.delete('pmax');
    p.delete('page');
    navigate(`/products?${p}`);
  };

  const clearFilters = () => {
    setPriceMin(''); setPriceMax('');
    navigate(`/products${category ? `?category=${category}` : ''}`);
  };

  const hasFilter = brand || pmin || pmax;

  const handleCompare = (p) => {
    setCompareItems(prev => {
      if (prev.find(x => x.id === p.id)) return prev.filter(x => x.id !== p.id);
      if (prev.length >= 3) return prev;
      return [...prev, p];
    });
  };

  return (
    <div className="container" style={{ padding: '24px 16px', paddingBottom: compareItems.length ? 80 : 48 }}>
      <div style={styles.productsLayout}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <h3 style={styles.sidebarTitle}>Danh mục</h3>
          <button onClick={() => setParam('category', '')}
            style={{ ...styles.catItem, ...(category === '' ? styles.catItemActive : {}) }}>
            🏷️ Tất cả sản phẩm
          </button>
          {categories.map(c => (
            <button key={c.id} onClick={() => setParam('category', c.slug)}
              style={{ ...styles.catItem, ...(category === c.slug ? styles.catItemActive : {}) }}>
              {c.icon} {c.name}
              <span style={styles.catItemCount}>{c.product_count}</span>
            </button>
          ))}

          {/* Thương hiệu */}
          {brands.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0 10px' }} />
              <h3 style={styles.sidebarTitle}>Thương hiệu</h3>
              <button onClick={() => setParam('brand', '')}
                style={{ ...styles.catItem, ...(brand === '' ? styles.catItemActive : {}) }}>
                Tất cả
              </button>
              {brands.map(b => (
                <button key={b} onClick={() => setParam('brand', b)}
                  style={{ ...styles.catItem, ...(brand === b ? styles.catItemActive : {}) }}>
                  {b}
                </button>
              ))}
            </>
          )}

          {/* Khoảng giá */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0 10px' }} />
          <h3 style={styles.sidebarTitle}>Khoảng giá</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input value={priceMin} onChange={e => setPriceMin(e.target.value)} type="number"
              placeholder="Từ (₫)" style={{ ...styles.input, fontSize: 12, padding: '7px 10px' }} />
            <input value={priceMax} onChange={e => setPriceMax(e.target.value)} type="number"
              placeholder="Đến (₫)" style={{ ...styles.input, fontSize: 12, padding: '7px 10px' }} />
            <button onClick={applyPrice} className="btn btn-primary" style={{ padding: '7px', fontSize: 12, justifyContent: 'center' }}>
              Áp dụng
            </button>
            {(pmin || pmax) && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                {pmin ? `${parseInt(pmin).toLocaleString('vi-VN')}₫` : '0'} —{' '}
                {pmax ? `${parseInt(pmax).toLocaleString('vi-VN')}₫` : '∞'}
              </p>
            )}
          </div>

          {hasFilter && (
            <button onClick={clearFilters}
              style={{ marginTop: 8, width: '100%', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px', fontSize: 12, cursor: 'pointer', color: 'var(--text-muted)' }}>
              ✕ Xoá bộ lọc
            </button>
          )}
        </aside>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.toolbar}>
            <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
              {search ? `Kết quả: "${search}"` : 'Tất cả sản phẩm'}
              {pagination.total ? ` (${pagination.total} sản phẩm)` : ''}
              {hasFilter && <span style={{ color: 'var(--primary)', marginLeft: 6 }}>● Đang lọc</span>}
            </p>
            <select value={sort} onChange={e => setParam('sort', e.target.value)} style={styles.sortSelect}>
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
              <option value="name">Tên A-Z</option>
            </select>
          </div>

          {loading ? <div className="spinner" /> : products.length === 0 ? (
            <div style={styles.empty}>😕 Không tìm thấy sản phẩm nào</div>
          ) : (
            <>
              <div className="product-grid">
                {products.map(p => (
                  <ProductCard key={p.id} product={p}
                    onCompare={handleCompare}
                    compareIds={compareItems.map(x => x.id)} />
                ))}
              </div>
              {pagination.totalPages > 1 && (
                <div style={styles.pagination}>
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(p => (
                    <button key={p} onClick={() => setParam('page', p)}
                      style={{ ...styles.pageBtn, ...(p === page ? styles.pageBtnActive : {}) }}>{p}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CompareBar items={compareItems} onRemove={id => setCompareItems(p => p.filter(x => x.id !== id))}
        onClear={() => setCompareItems([])}
        onCompare={() => navigate(`/compare?ids=${compareItems.map(x => x.id).join(',')}`)} />
    </div>
  );
}

// ─── PRODUCT DETAIL PAGE ──────────────────────────────────────────────────────

function ProductDetailPage() {
  const slug = window.location.pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [qty, setQty] = useState(1);
  const [reviews, setReviews] = useState(null);
  const [upsells, setUpsells] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', image_url: '', order_id: '' });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [myOrders, setMyOrders] = useState([]);
  const { addItem } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/products/${slug}`).then(d => {
      setData(d);
      api.get(`/reviews/${d.product.id}`).then(setReviews);
      const ids = JSON.parse(d.product.upsell_ids || '[]');
      if (ids.length) {
        Promise.all(ids.map(id => api.get(`/products/id/${id}`).catch(() => null)))
          .then(list => setUpsells(list.filter(Boolean)));
      }
    }).catch(() => navigate('/products'));
    if (user) api.get('/orders/my').then(o => setMyOrders(o)).catch(() => {});
    window.scrollTo(0, 0);
  }, [slug]);

  if (!data) return <div className="spinner" />;
  const { product, related } = data;
  const specs = JSON.parse(product.specs || '{}');
  const hasSpecs = Object.keys(specs).length > 0;
  const isAdmin = user?.role === 'admin';

  const handleAdd = () => {
    if (!user) { toast('Vui lòng đăng nhập để mua hàng!', 'error'); navigate('/login'); return; }
    addItem(product, qty);
    toast('Đã thêm vào giỏ hàng!', 'success');
  };

  const submitReview = async () => {
    if (!reviewForm.order_id) return toast('Chọn đơn hàng của bạn', 'error');
    try {
      await api.post('/reviews', { product_id: product.id, ...reviewForm });
      toast('Cảm ơn đánh giá của bạn!', 'success');
      setShowReviewForm(false);
      api.get(`/reviews/${product.id}`).then(setReviews);
    } catch (err) {
      toast(err.error || 'Không thể gửi đánh giá', 'error');
    }
  };

  const deliveredOrders = myOrders.filter(o => o.status === 'delivered');

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <p style={styles.breadcrumb}>
        <Link to="/">Trang chủ</Link> / <Link to="/products">Sản phẩm</Link> / {product.name}
      </p>

      <div style={styles.detailLayout}>
        <div style={styles.detailImgWrap}>
          <img src={product.image_url} alt={product.name} style={styles.detailImg} />
        </div>

        <div style={styles.detailInfo}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="badge badge-red">{product.category_name}</span>
            {product.brand && <span className="badge badge-orange">{product.brand}</span>}
          </div>
          <h1 style={styles.detailTitle}>{product.name}</h1>
          <p style={styles.detailPrice}>{product.price.toLocaleString('vi-VN')}₫</p>

          {reviews && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StarRating value={Math.round(reviews.avg_rating)} size={16} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {reviews.avg_rating} ({reviews.total} đánh giá)
              </span>
            </div>
          )}

          <div style={styles.stockRow}>
            <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>Tình trạng:</span>
            {product.stock > 0
              ? <span className="badge badge-green">Còn hàng ({product.stock})</span>
              : <span className="badge badge-red">Hết hàng</span>}
          </div>

          {!isAdmin && product.stock > 0 && (
            <div style={styles.qtyRow}>
              <span style={{ fontSize: 14 }}>Số lượng:</span>
              <div style={styles.qtyCtrl}>
                <button onClick={() => setQty(q => Math.max(1, q-1))} style={styles.qtyBtn}>−</button>
                <span style={styles.qtyVal}>{qty}</span>
                <button onClick={() => setQty(q => Math.min(product.stock, q+1))} style={styles.qtyBtn}>+</button>
              </div>
            </div>
          )}

          {!isAdmin && (
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={handleAdd} disabled={product.stock === 0} className="btn btn-primary" style={{ flex: 1 }}>
                🛒 Thêm vào giỏ
              </button>
              <button onClick={() => { handleAdd(); if (user) navigate('/cart'); }}
                disabled={product.stock === 0} className="btn btn-accent" style={{ flex: 1 }}>
                ⚡ Mua ngay
              </button>
            </div>
          )}

          {isAdmin && (
            <Link to={`/admin/products/edit/${product.id}`} className="btn btn-outline" style={{ marginTop: 12, justifyContent: 'center' }}>
              ✏️ Chỉnh sửa sản phẩm
            </Link>
          )}

          {/* Thông số kỹ thuật */}
          {hasSpecs && (
            <div style={styles.descBox}>
              <h3 style={{ marginBottom: 10, fontSize: 15 }}>⚙️ Thông số kỹ thuật</h3>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {Object.entries(specs).map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 0', color: 'var(--text-muted)', width: '45%' }}>{k}</td>
                      <td style={{ padding: '6px 0', fontWeight: 600 }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.descBox}>
            <h3 style={{ marginBottom: 8, fontSize: 15 }}>Mô tả sản phẩm</h3>
            <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-muted)' }}>{product.description}</p>
          </div>
        </div>
      </div>

      {/* Mua kèm giá hời (Upselling) */}
      {upsells.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={styles.sectionTitle}>🎁 Mua kèm giá hời</h2>
          <div style={{ background: '#fff9f0', border: '1px solid #ffe0b2', borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Khách hàng thường mua kèm sản phẩm này với:
            </p>
            <div className="product-grid">
              {upsells.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
          </div>
        </div>
      )}

      {/* Đánh giá */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={styles.sectionTitle}>⭐ Đánh giá từ khách hàng</h2>
          {user && deliveredOrders.length > 0 && (
            <button className="btn btn-outline" onClick={() => setShowReviewForm(f => !f)}
              style={{ fontSize: 13, padding: '7px 14px' }}>
              {showReviewForm ? 'Đóng' : '✏️ Viết đánh giá'}
            </button>
          )}
        </div>

        {showReviewForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: 'var(--shadow)' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Chọn đơn hàng của bạn</label>
              <select value={reviewForm.order_id} onChange={e => setReviewForm(f => ({ ...f, order_id: e.target.value }))}
                style={{ ...styles.input, marginTop: 4 }}>
                <option value="">-- Chọn đơn hàng --</option>
                {deliveredOrders.map(o => (
                  <option key={o.id} value={o.id}>Đơn #{o.id} — {new Date(o.created_at).toLocaleDateString('vi-VN')}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Đánh giá</label>
              <div style={{ marginTop: 4 }}>
                <StarRating value={reviewForm.rating} onChange={r => setReviewForm(f => ({ ...f, rating: r }))} size={28} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Nhận xét</label>
              <textarea value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
                placeholder="Chia sẻ trải nghiệm của bạn về sản phẩm này..."
                style={{ ...styles.input, marginTop: 4, height: 80, resize: 'vertical' }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Link ảnh thực tế (tùy chọn)</label>
              <input value={reviewForm.image_url} onChange={e => setReviewForm(f => ({ ...f, image_url: e.target.value }))}
                placeholder="https://..." style={{ ...styles.input, marginTop: 4 }} />
            </div>
            <button onClick={submitReview} className="btn btn-primary">Gửi đánh giá</button>
          </div>
        )}

        {!reviews ? <div className="spinner" /> : reviews.reviews.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chưa có đánh giá nào. Hãy là người đầu tiên!</p>
        ) : reviews.reviews.map(r => (
          <div key={r.id} style={{ background: '#fff', borderRadius: 10, padding: 16, marginBottom: 12, boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-light)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>
                  {r.user_name[0].toUpperCase()}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{r.user_name}</p>
                  <StarRating value={r.rating} size={14} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {new Date(r.created_at).toLocaleDateString('vi-VN')}
              </span>
            </div>
            {r.comment && <p style={{ fontSize: 14, color: 'var(--text)', marginTop: 6 }}>{r.comment}</p>}
            {r.image_url && (
              <img src={r.image_url} alt="review" style={{ marginTop: 8, maxWidth: 200, borderRadius: 8, objectFit: 'cover' }} />
            )}
          </div>
        ))}
      </div>

      {/* Sản phẩm liên quan */}
      {related.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <h2 style={styles.sectionTitle}>Sản phẩm liên quan</h2>
          <div className="product-grid">
            {related.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── COMPARE PAGE ─────────────────────────────────────────────────────────────

function ComparePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const ids = new URLSearchParams(location.search).get('ids')?.split(',').filter(Boolean) || [];
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ids.length) { navigate('/products'); return; }
    Promise.all(ids.map(id => api.get(`/products/id/${id}`).catch(() => null)))
      .then(list => setProducts(list.filter(Boolean)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (!products.length) return <div className="container" style={{ padding: 40, textAlign: 'center' }}>
    <p>Không tìm thấy sản phẩm để so sánh.</p>
    <Link to="/products" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>Chọn sản phẩm</Link>
  </div>;

  // Tập hợp tất cả key specs
  const allSpecs = [...new Set(
    products.flatMap(p => Object.keys(JSON.parse(p.specs || '{}')))
  )];

  const cols = products.length;
  const colW = `${Math.floor(100 / (cols + 1))}%`;

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>⚖️ So sánh sản phẩm</h1>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
          <thead>
            <tr>
              <th style={{ ...styles.cmpTh, width: '22%', background: 'var(--bg)' }}>Tiêu chí</th>
              {products.map(p => (
                <th key={p.id} style={{ ...styles.cmpTh, width: colW }}>
                  <img src={p.image_url} alt={p.name} style={{ width: '100%', maxHeight: 120, objectFit: 'contain', marginBottom: 8 }} />
                  <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{p.name}</p>
                  <p style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 15 }}>{p.price.toLocaleString('vi-VN')}₫</p>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Basic info */}
            {[
              { label: 'Thương hiệu', key: 'brand' },
              { label: 'Danh mục', key: 'category_name' },
              { label: 'Tồn kho', key: 'stock', fmt: v => v > 0 ? `${v} cái` : '⚠️ Hết hàng' },
            ].map(row => (
              <tr key={row.label} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={styles.cmpLabel}>{row.label}</td>
                {products.map(p => (
                  <td key={p.id} style={styles.cmpCell}>
                    {row.fmt ? row.fmt(p[row.key]) : (p[row.key] || '—')}
                  </td>
                ))}
              </tr>
            ))}

            {/* Thông số kỹ thuật */}
            {allSpecs.length > 0 && (
              <tr style={{ borderTop: '2px solid var(--primary)' }}>
                <td colSpan={cols + 1} style={{ padding: '8px 14px', background: 'var(--primary-light)', fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                  ⚙️ Thông số kỹ thuật
                </td>
              </tr>
            )}
            {allSpecs.map(spec => {
              const vals = products.map(p => JSON.parse(p.specs || '{}')[spec] || '—');
              return (
                <tr key={spec} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={styles.cmpLabel}>{spec}</td>
                  {vals.map((v, i) => (
                    <td key={i} style={styles.cmpCell}>{v}</td>
                  ))}
                </tr>
              );
            })}

            {/* Nút mua */}
            <tr style={{ borderTop: '2px solid var(--border)' }}>
              <td style={styles.cmpLabel}></td>
              {products.map(p => (
                <td key={p.id} style={{ ...styles.cmpCell, textAlign: 'center' }}>
                  <Link to={`/products/${p.slug}`} className="btn btn-primary"
                    style={{ fontSize: 13, padding: '8px 14px', justifyContent: 'center' }}>
                    Xem & Mua
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} className="btn btn-outline" style={{ fontSize: 13 }}>
          ← Thêm sản phẩm để so sánh
        </button>
      </div>
    </div>
  );
}

// ─── CART PAGE ────────────────────────────────────────────────────────────────

function CartPage() {
  const { items, removeItem, updateQty, total, clearCart } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) return (
    <div className="container" style={styles.emptyCart}>
      <p style={{ fontSize: 48 }}>🛒</p>
      <h2>Giỏ hàng trống</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Hãy thêm sản phẩm vào giỏ hàng</p>
      <button className="btn btn-primary" onClick={() => navigate('/products')}>Tiếp tục mua sắm</button>
    </div>
  );

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>🛒 Giỏ hàng ({items.length} sản phẩm)</h1>
      <div style={styles.cartLayout}>
        <div style={{ flex: 1 }}>
          {items.map(item => (
            <div key={item.id} style={styles.cartItem}>
              <img src={item.image_url} alt={item.name} style={styles.cartItemImg} />
              <div style={{ flex: 1 }}>
                <Link to={`/products/${item.slug}`} style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</Link>
                <p style={{ color: 'var(--primary)', fontWeight: 700, marginTop: 4 }}>{item.price.toLocaleString('vi-VN')}₫</p>
              </div>
              <div style={styles.qtyCtrl}>
                <button onClick={() => updateQty(item.id, item.quantity - 1)} style={styles.qtyBtn}>−</button>
                <span style={styles.qtyVal}>{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.quantity + 1)} style={styles.qtyBtn}>+</button>
              </div>
              <p style={{ fontWeight: 700, minWidth: 100, textAlign: 'right' }}>
                {(item.price * item.quantity).toLocaleString('vi-VN')}₫
              </p>
              <button onClick={() => removeItem(item.id)} style={styles.removeBtn}>✕</button>
            </div>
          ))}
          <button onClick={clearCart} style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, background: 'none', textDecoration: 'underline', border: 'none', cursor: 'pointer' }}>
            Xóa tất cả
          </button>
        </div>
        <div style={styles.cartSummary}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Tóm tắt đơn hàng</h3>
          <div style={styles.summaryRow}><span>Tạm tính</span><span>{total.toLocaleString('vi-VN')}₫</span></div>
          <div style={styles.summaryRow}><span>Phí ship</span><span style={{ color: 'var(--success)' }}>Miễn phí</span></div>
          <div style={{ ...styles.summaryRow, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, fontWeight: 700, fontSize: 16 }}>
            <span>Tổng cộng</span><span style={{ color: 'var(--primary)' }}>{total.toLocaleString('vi-VN')}₫</span>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 20 }} onClick={() => navigate('/checkout')}>
            Đặt hàng →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CHECKOUT PAGE (với coupon + đặt lịch lắp đặt) ───────────────────────────

function CheckoutPage() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [wantInstall, setWantInstall] = useState(false);
  const [form, setForm] = useState({
    customer_name: user?.name || '',
    customer_phone: '',
    shipping_address: '',
    payment_method: 'cod',
    install_date: '',
    install_slot: '',
    note: ''
  });

  useEffect(() => {
    if (!user) { toast('Vui lòng đăng nhập để đặt hàng!', 'error'); navigate('/login'); }
    else if (items.length === 0) navigate('/cart');
  }, []);

  if (!user || items.length === 0) return null;

  const discount = couponResult?.discount || 0;
  const isFreeShip = couponResult?.coupon?.type === 'free_ship';
  const finalTotal = Math.max(0, total - discount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await api.post('/coupons/validate', { code: couponCode, order_total: total });
      setCouponResult(res);
      toast(res.message, 'success');
    } catch (err) {
      setCouponResult(null);
      toast(err.error || 'Mã không hợp lệ', 'error');
    } finally { setCouponLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.customer_phone || !form.shipping_address) {
      return toast('Vui lòng điền đầy đủ thông tin!', 'error');
    }
    if (wantInstall && (!form.install_date || !form.install_slot)) {
      return toast('Vui lòng chọn ngày và khung giờ lắp đặt!', 'error');
    }
    setLoading(true);
    try {
      const res = await api.post('/orders', {
        ...form,
        coupon_code: couponResult?.coupon?.code || null,
        discount_amount: discount,
        items: items.map(i => ({ product_id: i.id, quantity: i.quantity }))
      });
      clearCart();
      toast('Đặt hàng thành công! 🎉', 'success');
      navigate(`/orders/${res.order.id}`);
    } catch (err) {
      toast(err.error || 'Đặt hàng thất bại', 'error');
    } finally { setLoading(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const slots = ['7:00 – 9:00', '9:00 – 11:00', '13:00 – 15:00', '15:00 – 17:00', '17:00 – 19:00'];

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>📋 Đặt hàng</h1>
      <div style={styles.cartLayout}>
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Họ tên người nhận *</label>
            <input value={form.customer_name} onChange={e => set('customer_name', e.target.value)} placeholder="Nguyễn Văn A" style={styles.input} />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Số điện thoại *</label>
            <input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="0918 058 495" style={styles.input} type="tel" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Địa chỉ giao hàng *</label>
            <textarea value={form.shipping_address} onChange={e => set('shipping_address', e.target.value)}
              placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
              style={{ ...styles.input, height: 80, resize: 'vertical' }} />
          </div>

          {/* Mã giảm giá */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Mã giảm giá</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Nhập mã..." style={{ ...styles.input, flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), applyCoupon())} />
              <button type="button" onClick={applyCoupon} disabled={couponLoading}
                className="btn btn-outline" style={{ padding: '10px 16px', fontSize: 13 }}>
                {couponLoading ? '...' : 'Áp dụng'}
              </button>
            </div>
            {couponResult && (
              <p style={{ fontSize: 13, color: 'var(--success)', marginTop: 4 }}>
                ✓ {couponResult.coupon.type === 'free_ship' ? 'Miễn phí vận chuyển!' : `Giảm ${discount.toLocaleString('vi-VN')}₫`}
                <button type="button" onClick={() => { setCouponResult(null); setCouponCode(''); }}
                  style={{ marginLeft: 8, background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </p>
            )}
          </div>

          {/* Đặt lịch lắp đặt */}
          <div style={{ background: '#f0f7ff', borderRadius: 10, padding: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
              <input type="checkbox" checked={wantInstall} onChange={e => setWantInstall(e.target.checked)} />
              🔧 Đặt lịch lắp đặt tại nhà (miễn phí)
            </label>
            {wantInstall && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Ngày lắp đặt</label>
                  <input type="date" value={form.install_date} onChange={e => set('install_date', e.target.value)}
                    min={new Date(Date.now() + 86400000).toISOString().slice(0,10)}
                    style={styles.input} />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Khung giờ</label>
                  <select value={form.install_slot} onChange={e => set('install_slot', e.target.value)} style={styles.input}>
                    <option value="">-- Chọn giờ --</option>
                    {slots.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Thanh toán */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Phương thức thanh toán</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['cod','💵 Thanh toán khi nhận hàng (COD)'],['bank_transfer','🏦 Chuyển khoản ngân hàng'],['momo','💜 Ví MoMo']].map(([val, label]) => (
                <label key={val} style={{ ...styles.payOpt, ...(form.payment_method === val ? styles.payOptActive : {}) }}>
                  <input type="radio" value={val} checked={form.payment_method === val}
                    onChange={() => set('payment_method', val)} style={{ marginRight: 8 }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Ghi chú</label>
            <input value={form.note} onChange={e => set('note', e.target.value)} placeholder="Ghi chú (nếu có)" style={styles.input} />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ justifyContent: 'center', padding: '14px', fontSize: 16 }}>
            {loading ? 'Đang xử lý...' : '✅ Xác nhận đặt hàng'}
          </button>
        </form>

        <div style={styles.cartSummary}>
          <h3 style={{ marginBottom: 16, fontSize: 16 }}>Đơn hàng của bạn</h3>
          {items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
              <span style={{ flex: 1 }}>{i.name} <span style={{ color: 'var(--text-muted)' }}>x{i.quantity}</span></span>
              <span style={{ fontWeight: 600 }}>{(i.price * i.quantity).toLocaleString('vi-VN')}₫</span>
            </div>
          ))}
          {discount > 0 && (
            <div style={{ ...styles.summaryRow, color: 'var(--success)' }}>
              <span>Giảm giá ({couponCode})</span>
              <span>−{discount.toLocaleString('vi-VN')}₫</span>
            </div>
          )}
          {isFreeShip && <div style={{ ...styles.summaryRow, color: 'var(--success)' }}><span>Phí ship</span><span>Miễn phí</span></div>}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
            <span>Tổng cộng</span>
            <span style={{ color: 'var(--primary)' }}>{finalTotal.toLocaleString('vi-VN')}₫</span>
          </div>
          {wantInstall && form.install_date && (
            <div style={{ marginTop: 12, background: '#e8f5e9', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
              🔧 Lắp đặt: {new Date(form.install_date).toLocaleDateString('vi-VN')} — {form.install_slot}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ORDER DETAIL PAGE ────────────────────────────────────────────────────────

const STATUS_MAP = {
  pending:   { label: 'Chờ xác nhận', color: '#ff9800' },
  confirmed: { label: 'Đã xác nhận',  color: '#2196f3' },
  shipping:  { label: 'Đang giao',    color: '#9c27b0' },
  delivered: { label: 'Đã giao',      color: '#4caf50' },
  cancelled: { label: 'Đã huỷ',       color: '#f44336' },
};

function OrderDetailPage() {
  const id = window.location.pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const loadData = () => api.get(`/orders/${id}`).then(setData).catch(() => navigate('/orders/my'));
  useEffect(() => { loadData(); }, [id]);

  if (!data) return <div className="spinner" />;
  const { order, items, warranties = [] } = data;
  const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const finalTotal = order.total_amount - (order.discount_amount || 0);

  const handleCancel = async () => {
    if (!window.confirm('Bạn có chắc muốn huỷ đơn hàng này?')) return;
    setCancelling(true);
    try {
      await api.patch(`/orders/${id}/cancel`, {});
      toast('Đã huỷ đơn hàng thành công', 'success');
      loadData();
    } catch (err) {
      toast(err.error || 'Không thể huỷ đơn hàng', 'error');
    } finally { setCancelling(false); }
  };

  return (
    <div className="container" style={{ padding: '24px 16px 48px', maxWidth: 640 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, boxShadow: 'var(--shadow)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <p style={{ fontSize: 48 }}>{order.status === 'cancelled' ? '❌' : order.status === 'delivered' ? '🎉' : '✅'}</p>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>
            {order.status === 'cancelled' ? 'Đơn hàng đã huỷ' : order.status === 'delivered' ? 'Đã giao hàng thành công!' : 'Đặt hàng thành công!'}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>Mã đơn hàng: <strong>#{order.id}</strong></p>
          <span style={{ display: 'inline-block', marginTop: 8, background: s.color+'22', color: s.color, padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            {s.label}
          </span>
        </div>

        {/* Thông tin giao hàng */}
        <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: 'var(--text-muted)' }}>THÔNG TIN GIAO HÀNG</p>
          <p style={styles.infoRow}><span>Người nhận:</span><strong>{order.customer_name}</strong></p>
          <p style={styles.infoRow}><span>SĐT:</span><strong>{order.customer_phone}</strong></p>
          <p style={styles.infoRow}><span>Địa chỉ:</span><span>{order.shipping_address}</span></p>
          <p style={styles.infoRow}><span>Thanh toán:</span><span>
            {order.payment_method === 'cod' ? '💵 COD' : order.payment_method === 'momo' ? '💜 MoMo' : '🏦 Chuyển khoản'}
          </span></p>
          {order.install_date && (
            <p style={{ ...styles.infoRow, color: '#1565c0' }}>
              <span>🔧 Lắp đặt:</span>
              <span>{order.install_date} — {order.install_slot}</span>
            </p>
          )}
          {order.coupon_code && (
            <p style={{ ...styles.infoRow, color: 'var(--success)' }}>
              <span>🏷️ Mã giảm giá:</span><span>{order.coupon_code}</span>
            </p>
          )}
        </div>

        {/* Sản phẩm */}
        <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: 'var(--text-muted)' }}>SẢN PHẨM ĐÃ ĐẶT</p>
        {items.map(i => (
          <div key={i.id} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
            <img src={i.image_url} alt={i.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{i.name}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>SL: {i.quantity} × {i.unit_price.toLocaleString('vi-VN')}₫</p>
            </div>
            <p style={{ fontWeight: 700 }}>{(i.quantity * i.unit_price).toLocaleString('vi-VN')}₫</p>
          </div>
        ))}

        {/* Tổng tiền */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Tạm tính</span>
            <span>{order.total_amount.toLocaleString('vi-VN')}₫</span>
          </div>
          {(order.discount_amount || 0) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: 'var(--success)', marginBottom: 6 }}>
              <span>Giảm giá {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
              <span>−{order.discount_amount.toLocaleString('vi-VN')}₫</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 18, marginTop: 8 }}>
            <span>Tổng cộng</span>
            <span style={{ color: 'var(--primary)' }}>{finalTotal.toLocaleString('vi-VN')}₫</span>
          </div>
        </div>

        {/* Thông tin bảo hành */}
        {warranties.length > 0 && (
          <div style={{ marginTop: 20, background: '#e8f5e9', borderRadius: 10, padding: 16 }}>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#2e7d32' }}>🛡️ THÔNG TIN BẢO HÀNH</p>
            {warranties.map(w => (
              <div key={w.id} style={{ background: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, border: `1px solid ${w.is_valid ? '#a5d6a7' : '#ef9a9a'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{w.product_name}</p>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12,
                    background: w.is_valid ? '#e8f5e9' : '#ffebee',
                    color: w.is_valid ? '#2e7d32' : '#c62828' }}>
                    {w.is_valid ? `✓ Còn ${w.days_left} ngày` : '✕ Hết hạn'}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  <span>Ngày mua: {w.purchase_date}</span>
                  <span>Hết hạn: {w.expires_at}</span>
                  {w.serial_number && <span>Serial: {w.serial_number}</span>}
                  {w.imei && <span>IMEI: {w.imei}</span>}
                </div>
                {w.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>{w.notes}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Nút hành động — phân theo role */}
        {isAdmin ? (
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => window.history.back()} className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
              ← Quay lại
            </button>
            <Link to={`/admin/warranty/new?order_id=${order.id}`} className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
              🛡️ Cấp bảo hành
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              <Link to="/orders/my" className="btn btn-outline" style={{ flex: 1, justifyContent: 'center', minWidth: 120 }}>
                📦 Đơn của tôi
              </Link>
              <Link to="/products" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', minWidth: 120 }}>
                Tiếp tục mua sắm
              </Link>
            </div>
            {canCancel && (
              <button onClick={handleCancel} disabled={cancelling}
                style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 8,
                  border: '1.5px solid #f44336', background: '#fff', color: '#f44336',
                  fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {cancelling ? 'Đang huỷ...' : '✕ Huỷ đơn hàng'}
              </button>
            )}
            {canCancel && (
              <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                Chỉ có thể huỷ khi đơn chưa được vận chuyển
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── MY ORDERS PAGE ───────────────────────────────────────────────────────────

function MyOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/orders/my').then(setOrders).finally(() => setLoading(false)); }, []);
  if (loading) return <div className="spinner" />;
  return (
    <div className="container" style={{ padding: '24px 16px 48px', maxWidth: 780 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>📦 Đơn hàng của tôi</h1>
      {orders.length === 0 ? <div style={styles.empty}>Bạn chưa có đơn hàng nào</div>
        : orders.map(order => {
          const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
          return (
            <div key={order.id} style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: 'var(--shadow)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>Đơn #{order.id}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12 }}>{new Date(order.created_at).toLocaleDateString('vi-VN')}</span>
                </div>
                <span style={{ background: s.color+'22', color: s.color, padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                {order.items?.map(i => `${i.product_name} x${i.quantity}`).join(', ')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{order.total_amount.toLocaleString('vi-VN')}₫</span>
                <Link to={`/orders/${order.id}`} style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>Xem chi tiết →</Link>
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ─── WARRANTY PAGE ────────────────────────────────────────────────────────────

function WarrantyPage() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('phone');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults(null);
    try {
      const res = await api.get(`/warranty/lookup?${type}=${encodeURIComponent(query.trim())}`);
      setResults(res);
    } catch (err) {
      setError(err.error || 'Không tìm thấy thông tin bảo hành');
    } finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ padding: '40px 16px 64px', maxWidth: 640 }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 48, marginBottom: 8 }}>🛡️</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Tra cứu bảo hành điện tử</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
          Nhập số điện thoại hoặc số serial để kiểm tra thông tin bảo hành
        </p>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: 'var(--shadow)' }}>
        <form onSubmit={lookup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {[['phone','📞 Số điện thoại'],['serial','🔢 Số serial / IMEI']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setType(val)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: type === val ? 'var(--primary)' : '#f5f5f5',
                  color: type === val ? '#fff' : 'var(--text)', border: 'none' }}>
                {label}
              </button>
            ))}
          </div>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={type === 'phone' ? '0918 058 495' : 'Serial hoặc IMEI...'}
            style={{ ...styles.input, fontSize: 15, padding: '12px 16px' }} />
          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ justifyContent: 'center', padding: '13px', fontSize: 15 }}>
            {loading ? 'Đang tra cứu...' : '🔍 Tra cứu bảo hành'}
          </button>
        </form>

        {error && <p style={{ marginTop: 16, color: 'var(--primary)', fontSize: 14, textAlign: 'center' }}>⚠️ {error}</p>}

        {results && results.map(w => (
          <div key={w.id} style={{ marginTop: 20, border: `2px solid ${w.is_valid ? '#4caf50' : '#f44336'}`, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              {w.image_url && <img src={w.image_url} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} alt="" />}
              <div>
                <p style={{ fontWeight: 700, fontSize: 15 }}>{w.product_name}</p>
                {w.brand && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{w.brand}</p>}
              </div>
              <span style={{ marginLeft: 'auto', background: w.is_valid ? '#e8f5e9' : '#ffebee',
                color: w.is_valid ? '#2e7d32' : '#c62828', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {w.is_valid ? `✓ Còn ${w.days_left} ngày` : '✕ Hết hạn BH'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
              <p style={styles.infoRow}><span>Ngày mua:</span><span>{w.purchase_date}</span></p>
              <p style={styles.infoRow}><span>Hết hạn:</span><span>{w.expires_at}</span></p>
              {w.serial_number && <p style={styles.infoRow}><span>Serial:</span><span>{w.serial_number}</span></p>}
              {w.imei && <p style={styles.infoRow}><span>IMEI:</span><span>{w.imei}</span></p>}
            </div>
            {w.notes && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>{w.notes}</p>}
          </div>
        ))}
      </div>

      <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
        Cần hỗ trợ? Liên hệ {SHOP.phone} hoặc {SHOP.email}
      </p>
    </div>
  );
}

// ─── QUIZ PAGE (Tư vấn chọn sản phẩm) ────────────────────────────────────────

const QUIZ_STEPS = [
  {
    q: 'Bạn cần loại thiết bị nào?',
    key: 'type',
    opts: [
      { label: '🍵 Ấm đun / Nồi cơm', val: 'dun-nau' },
      { label: '💡 Đèn LED', val: 'chieu-sang' },
      { label: '💆 Máy sấy / Bàn ủi', val: 'cham-soc-ca-nhan' },
      { label: '🍳 Máy xay sinh tố', val: 'nha-bep' },
      { label: '🔌 Dây điện / Ổ cắm', val: 'day-phu-kien-dien' },
      { label: '⚖️ Cân điện tử', val: 'thiet-bi-do-luong' },
    ]
  },
  {
    q: 'Ngân sách của bạn?',
    key: 'budget',
    opts: [
      { label: '💰 Dưới 200.000₫', val: '0-200000' },
      { label: '💰 200.000 – 500.000₫', val: '200000-500000' },
      { label: '💰 500.000 – 1.000.000₫', val: '500000-1000000' },
      { label: '💰 Trên 1.000.000₫', val: '1000000-99999999' },
    ]
  },
  {
    q: 'Thương hiệu ưu tiên?',
    key: 'brand',
    opts: [
      { label: '⭐ Philips', val: 'Philips' },
      { label: '⭐ Panasonic', val: 'Panasonic' },
      { label: '⭐ Sunhouse', val: 'Sunhouse' },
      { label: '⭐ Rạng Đông / Điện Quang', val: 'Rạng Đông' },
      { label: '🎯 Không quan trọng', val: '' },
    ]
  },
];

function QuizPage() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const choose = (key, val) => {
    const next = { ...answers, [key]: val };
    setAnswers(next);
    if (step < QUIZ_STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      fetchResults(next);
    }
  };

  const fetchResults = async (ans) => {
    setLoading(true);
    try {
      const [pmin, pmax] = (ans.budget || '0-99999999').split('-');
      const q = new URLSearchParams({ category: ans.type || '', pmin, pmax, limit: 6 });
      if (ans.brand) q.set('brand', ans.brand);
      const data = await api.get(`/products?${q}`);
      setResults(data.products);
    } catch { setResults([]); }
    finally { setLoading(false); }
  };

  const restart = () => { setStep(0); setAnswers({}); setResults(null); };

  if (loading) return <div style={{ padding: 80 }}><div className="spinner" /></div>;

  if (results) return (
    <div className="container" style={{ padding: '32px 16px 64px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <p style={{ fontSize: 40 }}>🎯</p>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          {results.length > 0 ? `Tìm thấy ${results.length} sản phẩm phù hợp!` : 'Không có sản phẩm phù hợp'}
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>Dựa trên lựa chọn của bạn</p>
      </div>
      {results.length > 0
        ? <div className="product-grid">{results.map(p => <ProductCard key={p.id} product={p} />)}</div>
        : <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Hãy thử chọn lại với bộ lọc khác</p>
          </div>
      }
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32 }}>
        <button onClick={restart} className="btn btn-outline">🔄 Tư vấn lại</button>
        <button onClick={() => navigate('/products')} className="btn btn-primary">Xem tất cả sản phẩm</button>
      </div>
    </div>
  );

  const cur = QUIZ_STEPS[step];

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', minHeight: '70vh', padding: '40px 16px' }}>
      <div style={{ width: '100%', maxWidth: 520 }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
          {QUIZ_STEPS.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 4, borderRadius: 4,
              background: i <= step ? 'var(--primary)' : 'var(--border)' }} />
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Câu hỏi {step + 1}/{QUIZ_STEPS.length}</p>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 24 }}>{cur.q}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cur.opts.map(opt => (
            <button key={opt.val} onClick={() => choose(cur.key, opt.val)}
              style={{ padding: '14px 18px', borderRadius: 10, border: '1.5px solid var(--border)',
                background: '#fff', textAlign: 'left', fontSize: 15, cursor: 'pointer',
                fontWeight: 500, transition: 'all .15s', color: 'var(--text)' }}
              onMouseEnter={e => { e.target.style.borderColor='var(--primary)'; e.target.style.background='var(--primary-light)'; }}
              onMouseLeave={e => { e.target.style.borderColor='var(--border)'; e.target.style.background='#fff'; }}>
              {opt.label}
            </button>
          ))}
        </div>

        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ marginTop: 20, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}>
            ← Quay lại
          </button>
        )}
      </div>
    </div>
  );
}

// ─── AUTH PAGE ────────────────────────────────────────────────────────────────

function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await api.post(isLogin ? '/auth/login' : '/auth/register', form);
      login(res.token, res.user);
      toast(`Xin chào, ${res.user.name}!`, 'success');
      navigate(res.user.role === 'admin' ? '/admin/orders' : '/');
    } catch (err) { toast(err.error || 'Có lỗi xảy ra', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '70vh', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420, boxShadow: 'var(--shadow)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 8, fontSize: 22 }}>{isLogin ? '🔐 Đăng nhập' : '📝 Đăng ký'}</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, marginBottom: 28 }}>
          {isLogin ? `Chào mừng đến ${SHOP.name}!` : 'Tạo tài khoản mới'}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!isLogin && <div style={styles.formGroup}><label style={styles.label}>Họ tên</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Nguyễn Văn A" style={styles.input} /></div>}
          <div style={styles.formGroup}><label style={styles.label}>Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} type="email" placeholder="email@example.com" style={styles.input} /></div>
          <div style={styles.formGroup}><label style={styles.label}>Mật khẩu</label>
            <input value={form.password} onChange={e => set('password', e.target.value)} type="password" placeholder="Tối thiểu 6 ký tự" style={styles.input} /></div>
          {!isLogin && <div style={styles.formGroup}><label style={styles.label}>Số điện thoại</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" placeholder="0909 123 456" style={styles.input} /></div>}
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 4 }}>
            {loading ? 'Đang xử lý...' : isLogin ? 'Đăng nhập' : 'Đăng ký'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-muted)' }}>
          {isLogin ? 'Chưa có tài khoản? ' : 'Đã có tài khoản? '}
          <button onClick={() => setIsLogin(l => !l)} style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', fontSize: 14, border: 'none', cursor: 'pointer' }}>
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── ADMIN: ORDERS ────────────────────────────────────────────────────────────

function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const toast = useToast();

  const fetchOrders = () => {
    setLoading(true);
    api.get(`/admin/orders?status=${filter}`).then(setOrders).finally(() => setLoading(false));
  };
  useEffect(() => { fetchOrders(); }, [filter]);

  const updateStatus = async (id, status) => {
    try { await api.patch(`/admin/orders/${id}`, { status }); toast('Cập nhật thành công!', 'success'); fetchOrders(); }
    catch { toast('Cập nhật thất bại', 'error'); }
  };

  const nextStatus = { pending: 'confirmed', confirmed: 'shipping', shipping: 'delivered' };
  const tabs = [['pending','Chờ xác nhận'],['confirmed','Đã xác nhận'],['shipping','Đang giao'],['delivered','Đã giao'],['all','Tất cả']];

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>📦 Quản lý đơn hàng</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ ...styles.tabBtn, ...(filter === k ? styles.tabBtnActive : {}) }}>{l}</button>
        ))}
      </div>
      {loading ? <div className="spinner" /> : orders.length === 0 ? (
        <div style={styles.empty}>Không có đơn hàng nào</div>
      ) : orders.map(order => {
        const s = STATUS_MAP[order.status] || STATUS_MAP.pending;
        const next = nextStatus[order.status];
        return (
          <div key={order.id} style={styles.adminOrderCard}>
            <div style={styles.adminOrderHeader}>
              <div>
                <span style={{ fontWeight: 700, fontSize: 15 }}>Đơn #{order.id}</span>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 12 }}>
                  {new Date(order.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <span style={{ background: s.color+'22', color: s.color, padding: '4px 12px', borderRadius: 16, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '12px 0', fontSize: 14 }}>
              <p><span style={{ color: 'var(--text-muted)' }}>Khách:</span> <strong>{order.customer_name}</strong></p>
              <p><span style={{ color: 'var(--text-muted)' }}>SĐT:</span> <strong>{order.customer_phone}</strong></p>
              <p style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-muted)' }}>Địa chỉ:</span> {order.shipping_address}</p>
              <p><span style={{ color: 'var(--text-muted)' }}>Thanh toán:</span> {order.payment_method === 'cod' ? 'COD' : order.payment_method === 'momo' ? 'MoMo' : 'Chuyển khoản'}</p>
              <p><span style={{ color: 'var(--text-muted)' }}>Tổng tiền:</span> <strong style={{ color: 'var(--primary)' }}>{(order.total_amount-(order.discount_amount||0)).toLocaleString('vi-VN')}₫</strong>
                {(order.discount_amount||0) > 0 && <span style={{ fontSize:12, color:'var(--success)', marginLeft:6 }}>(-{order.discount_amount.toLocaleString('vi-VN')}₫ {order.coupon_code ? `mã ${order.coupon_code}` : ''})</span>}
              </p>
              {order.install_date && (
                <p style={{ gridColumn: '1/-1', color: '#1565c0' }}>
                  🔧 Lắp đặt: {order.install_date} — {order.install_slot}
                </p>
              )}
            </div>
            {order.note && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>Ghi chú: {order.note}</p>}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link to={`/orders/${order.id}`} style={{ ...styles.btn2, color: 'var(--text)' }}>👁️ Xem chi tiết</Link>
              <Link to={`/admin/warranty/new?order_id=${order.id}`} style={{ ...styles.btn2, color: '#1565c0', borderColor: '#1565c0' }}>🛡️ Cấp bảo hành</Link>
              {next && (
                <button onClick={() => updateStatus(order.id, next)} className="btn btn-primary" style={{ padding: '7px 14px', fontSize: 13 }}>
                  ✅ → {STATUS_MAP[next].label}
                </button>
              )}
              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                <button onClick={() => updateStatus(order.id, 'cancelled')}
                  style={{ ...styles.btn2, color: '#f44336', borderColor: '#f44336' }}>✕ Huỷ đơn</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── ADMIN: PRODUCTS ──────────────────────────────────────────────────────────

function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  const fetchProducts = () => {
    setLoading(true);
    api.get('/admin/products/all').then(setProducts).finally(() => setLoading(false));
  };
  useEffect(() => { fetchProducts(); }, []);

  const toggleActive = async (p) => {
    try {
      await api.patch(`/admin/products/${p.id}`, { is_active: p.is_active ? 0 : 1 });
      toast(p.is_active ? 'Đã ẩn sản phẩm' : 'Đã hiện sản phẩm', 'success');
      fetchProducts();
    } catch { toast('Thao tác thất bại', 'error'); }
  };

  const deleteProduct = async (id, name) => {
    if (!window.confirm(`Xoá sản phẩm "${name}"?`)) return;
    try { await api.delete(`/admin/products/${id}`); toast('Đã xoá', 'success'); fetchProducts(); }
    catch { toast('Xoá thất bại', 'error'); }
  };

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));
  const lowStock = products.filter(p => p.stock <= p.min_stock && p.is_active).length;

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>🛍️ Quản lý sản phẩm</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/products/new')}>+ Thêm sản phẩm</button>
      </div>
      {lowStock > 0 && (
        <div style={{ background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>
          ⚠️ <strong>{lowStock} sản phẩm</strong> sắp hết hàng (dưới ngưỡng tối thiểu)
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm kiếm sản phẩm..." style={{ ...styles.input, maxWidth: 300 }} />
      </div>
      {loading ? <div className="spinner" /> : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={styles.th}>Ảnh</th>
                <th style={styles.th}>Tên sản phẩm</th>
                <th style={styles.th}>Giá</th>
                <th style={styles.th}>Tồn kho</th>
                <th style={styles.th}>Trạng thái</th>
                <th style={styles.th}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--border)', opacity: p.is_active ? 1 : 0.55 }}>
                  <td style={styles.td}>
                    <img src={p.image_url} alt={p.name} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                  </td>
                  <td style={styles.td}>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category_name} {p.brand && `· ${p.brand}`}</p>
                  </td>
                  <td style={styles.td}>{p.price.toLocaleString('vi-VN')}₫</td>
                  <td style={styles.td}>
                    <span style={{ color: p.stock <= p.min_stock ? '#f44336' : p.stock < 20 ? '#ff9800' : 'var(--success)', fontWeight: 600 }}>
                      {p.stock}
                    </span>
                    {p.stock <= p.min_stock && <span style={{ fontSize: 10, color: '#f44336', display: 'block' }}>⚠️ Sắp hết</span>}
                  </td>
                  <td style={styles.td}>
                    <span style={{ background: p.is_active ? '#e8f5e9' : '#eeeeee', color: p.is_active ? 'var(--success)' : '#888', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      {p.is_active ? 'Đang bán' : 'Đã ẩn'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button onClick={() => navigate(`/admin/products/edit/${p.id}`)}
                        style={{ ...styles.btn2, fontSize: 12, padding: '4px 8px' }}>✏️ Sửa</button>
                      <button onClick={() => toggleActive(p)}
                        style={{ ...styles.btn2, fontSize: 12, padding: '4px 8px' }}>
                        {p.is_active ? '🙈 Ẩn' : '👁️ Hiện'}
                      </button>
                      <button onClick={() => deleteProduct(p.id, p.name)}
                        style={{ ...styles.btn2, fontSize: 12, padding: '4px 8px', color: '#f44336', borderColor: '#f44336' }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: PRODUCT FORM ──────────────────────────────────────────────────────

// Thay thế hàm AdminProductFormPage trong App.jsx
// Thêm tính năng upload ảnh lên Cloudinary thay vì nhập URL thủ công

function AdminProductFormPage() {
  const isEdit = window.location.pathname.includes('/edit/');
  const id = isEdit ? window.location.pathname.split('/').pop() : null;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [specsRaw, setSpecsRaw] = useState('');
  const [upsellRaw, setUpsellRaw] = useState('');
  const [form, setForm] = useState({
    name:'', slug:'', brand:'', price:'', stock:'', min_stock:'5', weight_kg:'1',
    description:'', image_url:'', category_id:'', is_active:1
  });
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = React.useRef();

  useEffect(() => {
    api.get('/categories').then(setCategories);
    if (isEdit) {
      api.get(`/admin/products/${id}`).then(p => {
        setForm({
          name: p.name, slug: p.slug, brand: p.brand || '',
          price: p.price, stock: p.stock, min_stock: p.min_stock || 5,
          weight_kg: p.weight_kg || 1, description: p.description || '',
          image_url: p.image_url || '', category_id: p.category_id || p.category || '',
          is_active: p.is_active ? 1 : 0
        });
        const specs = p.specs instanceof Object && !Array.isArray(p.specs) ? p.specs : {};
        setSpecsRaw(JSON.stringify(specs, null, 2));
        setUpsellRaw((p.upsell_ids || []).join(', '));
      }).catch(() => navigate('/admin/products'));
    }
  }, [id]);

  const autoSlug = name => name.toLowerCase()
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g,'a').replace(/[èéẹẻẽêềếệểễ]/g,'e')
    .replace(/[ìíịỉĩ]/g,'i').replace(/[òóọỏõôồốộổỗơờớợởỡ]/g,'o')
    .replace(/[ùúụủũưừứựửữ]/g,'u').replace(/[ỳýỵỷỹ]/g,'y').replace(/đ/g,'d')
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').trim();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Upload ảnh lên Cloudinary qua backend
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('Ảnh không được quá 5MB', 'error');

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/admin/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        set('image_url', data.url);
        toast('Tải ảnh lên thành công!', 'success');
      } else {
        throw new Error(data.error || 'Upload thất bại');
      }
    } catch (err) {
      toast(err.message || 'Lỗi tải ảnh', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.category_id) return toast('Thiếu thông tin bắt buộc!', 'error');

    let specs = {};
    try { specs = specsRaw.trim() ? JSON.parse(specsRaw) : {}; }
    catch { return toast('Thông số kỹ thuật không đúng định dạng JSON', 'error'); }

    const upsell_ids = upsellRaw.split(',').map(s => s.trim()).filter(Boolean);

    setLoading(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        stock: parseInt(form.stock) || 0,
        min_stock: parseInt(form.min_stock) || 5,
        weight_kg: parseFloat(form.weight_kg) || 1,
        is_active: form.is_active === 1 || form.is_active === true,
        specs,
        upsell_ids,
        category_id: form.category_id
      };

      if (isEdit) await api.patch(`/admin/products/${id}`, payload);
      else await api.post('/admin/products', payload);

      toast(isEdit ? 'Cập nhật thành công!' : 'Thêm sản phẩm thành công!', 'success');
      navigate('/admin/products');
    } catch (err) {
      toast(err.error || 'Lỗi khi lưu', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '24px 16px 48px', maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/admin/products')}
          style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>{isEdit ? '✏️ Sửa sản phẩm' : '➕ Thêm sản phẩm mới'}</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: 'var(--shadow)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

            {/* Tên */}
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Tên sản phẩm *</label>
              <input value={form.name} onChange={e => { set('name', e.target.value); if (!isEdit) set('slug', autoSlug(e.target.value)); }}
                placeholder="Ấm đun siêu tốc Philips 1.7L" style={styles.input} />
            </div>

            {/* Slug */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Slug (URL) *</label>
              <input value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="am-dun-sieu-toc-philips" style={styles.input} />
            </div>

            {/* Thương hiệu */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Thương hiệu</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Philips, Sunhouse..." style={styles.input} />
            </div>

            {/* Danh mục */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Danh mục *</label>
              <select value={form.category_id} onChange={e => set('category_id', e.target.value)} style={styles.input}>
                <option value="">-- Chọn danh mục --</option>
                {categories.map(c => <option key={c._id || c.id} value={c._id || c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            {/* Giá */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Giá bán (₫) *</label>
              <input value={form.price} onChange={e => set('price', e.target.value)} type="number" min="0" placeholder="250000" style={styles.input} />
            </div>

            {/* Tồn kho */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Tồn kho</label>
              <input value={form.stock} onChange={e => set('stock', e.target.value)} type="number" min="0" placeholder="100" style={styles.input} />
            </div>

            {/* Cảnh báo kho */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Cảnh báo khi còn dưới</label>
              <input value={form.min_stock} onChange={e => set('min_stock', e.target.value)} type="number" min="0" placeholder="5" style={styles.input} />
            </div>

            {/* Khối lượng */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Khối lượng (kg)</label>
              <input value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} type="number" min="0" step="0.1" placeholder="1.5" style={styles.input} />
            </div>

            {/* Upload ảnh */}
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Ảnh sản phẩm</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input value={form.image_url} onChange={e => set('image_url', e.target.value)}
                    placeholder="Nhập URL hoặc upload ảnh bên dưới..." style={styles.input} />
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFileUpload}
                      style={{ display: 'none' }} />
                    <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                      style={{ ...styles.btn2, fontSize: 13, padding: '7px 14px' }}>
                      {uploading ? '⏳ Đang tải...' : '📸 Chọn ảnh từ máy'}
                    </button>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tối đa 5MB, định dạng JPG/PNG/WebP</span>
                  </div>
                </div>
                {form.image_url && (
                  <img src={form.image_url} alt="preview"
                    style={{ width: 90, height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />
                )}
              </div>
            </div>

            {/* Mô tả */}
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Mô tả sản phẩm</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Mô tả chi tiết về sản phẩm..."
                style={{ ...styles.input, height: 90, resize: 'vertical' }} />
            </div>

            {/* Thông số kỹ thuật JSON */}
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Thông số kỹ thuật (JSON)</label>
              <textarea value={specsRaw} onChange={e => setSpecsRaw(e.target.value)}
                placeholder={'{\n  "Công suất": "1200W",\n  "Dung tích": "1.7L",\n  "Chất liệu": "Inox 304"\n}'}
                style={{ ...styles.input, height: 110, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Nhập theo dạng JSON. Ví dụ: {`{"Công suất": "2200W", "Dung tích": "1.7L"}`}
              </p>
            </div>

            {/* Upsell IDs */}
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Gợi ý mua kèm — ID sản phẩm (cách nhau dấu phẩy)</label>
              <input value={upsellRaw} onChange={e => setUpsellRaw(e.target.value)}
                placeholder="id1, id2, id3" style={styles.input} />
            </div>

            {/* Trạng thái */}
            <div style={styles.formGroup}>
              <label style={styles.label}>Trạng thái hiển thị</label>
              <select value={form.is_active} onChange={e => set('is_active', parseInt(e.target.value))} style={styles.input}>
                <option value={1}>Đang bán (hiển thị)</option>
                <option value={0}>Ẩn (không hiển thị)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" onClick={() => navigate('/admin/products')}
              className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>
              Huỷ
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || uploading}
              style={{ flex: 2, justifyContent: 'center', padding: 14 }}>
              {loading ? 'Đang lưu...' : isEdit ? '💾 Lưu thay đổi' : '➕ Thêm sản phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
// ─── ADMIN: REPORTS ───────────────────────────────────────────────────────────

function AdminReportsPage() {
  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/reports/summary').then(setSummary);
    api.get('/admin/reports/revenue?months=6').then(setRevenue);
    api.get('/admin/reports/top-products?limit=8').then(setTopProducts);
    api.get('/admin/reports/low-stock').then(setLowStock);
  }, []);

  const maxRevenue = Math.max(...revenue.map(r => r.revenue || 0), 1);

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>📊 Báo cáo & Thống kê</h1>

      {/* Summary cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 32 }}>
          {[
            { label: 'Đơn hôm nay', val: summary.today_orders, icon: '📦', color: '#1565c0' },
            { label: 'Doanh thu tháng', val: `${Math.round(summary.month_revenue/1000)}K₫`, icon: '💰', color: '#2e7d32' },
            { label: 'Chờ xử lý', val: summary.pending_orders, icon: '⏳', color: '#e65100', link: '/admin/orders' },
            { label: 'Tổng đơn', val: summary.total_orders, icon: '🛒', color: '#555' },
            { label: 'Sắp hết hàng', val: summary.low_stock, icon: '⚠️', color: '#c62828', link: '/admin/products' },
          ].map(x => (
            <div key={x.label} onClick={() => x.link && navigate(x.link)}
              style={{ background: '#fff', borderRadius: 12, padding: '16px 18px', boxShadow: 'var(--shadow)',
                cursor: x.link ? 'pointer' : 'default', borderLeft: `4px solid ${x.color}` }}>
              <p style={{ fontSize: 24 }}>{x.icon}</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: x.color, marginTop: 4 }}>{x.val}</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{x.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Revenue chart */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow)', marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📈 Doanh thu 6 tháng gần nhất</h2>
        {revenue.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chưa có dữ liệu</p> : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
            {revenue.map(r => {
              const h = Math.max(8, Math.round((r.revenue / maxRevenue) * 140));
              return (
                <div key={r.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.2 }}>
                    {Math.round(r.revenue/1000)}K
                  </span>
                  <div style={{ width: '100%', height: h, background: 'var(--primary)', borderRadius: '4px 4px 0 0', transition: 'height .3s', minHeight: 4 }} />
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {r.month?.slice(5)}/{r.month?.slice(2,4)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.orders} đơn</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Top products */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🏆 Sản phẩm bán chạy</h2>
          {topProducts.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: i < 3 ? 'var(--primary)' : 'var(--text-muted)', width: 20 }}>
                {i + 1}
              </span>
              <img src={p.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Bán: {p.total_sold} · {Math.round(p.total_revenue/1000)}K₫</p>
              </div>
            </div>
          ))}
          {topProducts.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Chưa có dữ liệu</p>}
        </div>

        {/* Low stock */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: 'var(--shadow)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>⚠️ Cảnh báo tồn kho</h2>
          {lowStock.length === 0
            ? <p style={{ color: 'var(--success)', fontSize: 14 }}>✓ Tất cả sản phẩm đủ hàng</p>
            : lowStock.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer' }}
                onClick={() => navigate(`/admin/products/edit/${p.id}`)}>
                <img src={p.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.category_name}</p>
                </div>
                <span style={{ color: p.stock === 0 ? '#f44336' : '#ff9800', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
                  {p.stock === 0 ? 'Hết hàng' : `Còn ${p.stock}`}
                </span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN: COUPONS ───────────────────────────────────────────────────────────

function AdminCouponsPage() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code:'', type:'percent', value:'', min_order:'', max_uses:'100', expires_at:'' });
  const toast = useToast();

  const fetchCoupons = () => { setLoading(true); api.get('/coupons/admin').then(setCoupons).finally(() => setLoading(false)); };
  useEffect(() => { fetchCoupons(); }, []);

  const createCoupon = async (e) => {
    e.preventDefault();
    try {
      await api.post('/coupons/admin', form);
      toast('Tạo mã thành công!', 'success');
      setShowForm(false);
      setForm({ code:'', type:'percent', value:'', min_order:'', max_uses:'100', expires_at:'' });
      fetchCoupons();
    } catch (err) { toast(err.error || 'Lỗi tạo mã', 'error'); }
  };

  const toggleCoupon = async (c) => {
    await api.patch(`/coupons/admin/${c.id}`, { is_active: c.is_active ? 0 : 1 });
    fetchCoupons();
  };

  const deleteCoupon = async (id) => {
    if (!window.confirm('Xoá mã này?')) return;
    await api.delete(`/coupons/admin/${id}`);
    toast('Đã xoá', 'success'); fetchCoupons();
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const typeLabel = { percent: 'Giảm %', fixed: 'Giảm tiền cố định', free_ship: 'Miễn phí ship' };

  return (
    <div className="container" style={{ padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>🏷️ Quản lý mã giảm giá</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(f => !f)}>
          {showForm ? 'Đóng' : '+ Tạo mã mới'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: 'var(--shadow)' }}>
          <form onSubmit={createCoupon} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mã giảm giá *</label>
              <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())} placeholder="SUMMER20" style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Loại *</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} style={styles.input}>
                <option value="percent">Giảm % (ví dụ: 20%)</option>
                <option value="fixed">Giảm tiền cố định</option>
                <option value="free_ship">Miễn phí vận chuyển</option>
              </select>
            </div>
            {form.type !== 'free_ship' && (
              <div style={styles.formGroup}>
                <label style={styles.label}>{form.type === 'percent' ? 'Phần trăm (%) *' : 'Số tiền giảm (₫) *'}</label>
                <input value={form.value} onChange={e => set('value', e.target.value)} type="number" min="0.01" step={form.type === 'percent' ? '1' : '1000'} placeholder={form.type === 'percent' ? '20' : '50000'} style={styles.input} />
              </div>
            )}
            {form.type === 'free_ship' && (
              <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
                <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#1565c0' }}>
                  💡 Mã miễn phí vận chuyển — không cần nhập giá trị giảm
                </div>
              </div>
            )}
            <div style={styles.formGroup}>
              <label style={styles.label}>Đơn hàng tối thiểu (₫)</label>
              <input value={form.min_order} onChange={e => set('min_order', e.target.value)} type="number" min="0" placeholder="0" style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Số lần dùng tối đa</label>
              <input value={form.max_uses} onChange={e => set('max_uses', e.target.value)} type="number" min="1" style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Hết hạn (để trống = không hết hạn)</label>
              <input value={form.expires_at} onChange={e => set('expires_at', e.target.value)} type="date" style={styles.input} />
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 12 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>✓ Tạo mã</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>Huỷ</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="spinner" /> : (
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow)', overflow: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                {['Mã','Loại','Giá trị','Đơn tối thiểu','Đã dùng','Hết hạn','Trạng thái','Thao tác'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid var(--border)', opacity: c.is_active ? 1 : 0.5 }}>
                  <td style={styles.td}><strong style={{ fontFamily: 'monospace' }}>{c.code}</strong></td>
                  <td style={styles.td}>{typeLabel[c.type]}</td>
                  <td style={styles.td}>
                    {c.type === 'free_ship' ? 'Miễn ship' : c.type === 'percent' ? `${c.value}%` : `${c.value.toLocaleString('vi-VN')}₫`}
                  </td>
                  <td style={styles.td}>{c.min_order > 0 ? `${c.min_order.toLocaleString('vi-VN')}₫` : '—'}</td>
                  <td style={styles.td}>{c.used_count}/{c.max_uses}</td>
                  <td style={styles.td}>{c.expires_at || '—'}</td>
                  <td style={styles.td}>
                    <span style={{ background: c.is_active ? '#e8f5e9' : '#eeeeee', color: c.is_active ? 'var(--success)' : '#888', padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      {c.is_active ? 'Đang hoạt động' : 'Tắt'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => toggleCoupon(c)} style={{ ...styles.btn2, fontSize: 12, padding: '4px 8px' }}>
                        {c.is_active ? 'Tắt' : 'Bật'}
                      </button>
                      <button onClick={() => deleteCoupon(c.id)} style={{ ...styles.btn2, fontSize: 12, padding: '4px 8px', color: '#f44336', borderColor: '#f44336' }}>
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {coupons.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>Chưa có mã giảm giá nào</p>}
        </div>
      )}
    </div>
  );
}

// ─── ADMIN: WARRANTY FORM ─────────────────────────────────────────────────────

function AdminWarrantyFormPage() {
  const orderId = new URLSearchParams(window.location.search).get('order_id') || '';
  const [form, setForm] = useState({ order_id: orderId, product_id:'', customer_phone:'', serial_number:'', imei:'', purchase_date: new Date().toISOString().slice(0,10), warranty_months:'12', notes:'' });
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/products/all').then(setProducts);
    if (orderId) {
      api.get(`/orders/${orderId}`).then(d => {
        setForm(f => ({ ...f, customer_phone: d.order.customer_phone }));
        if (d.items?.length === 1) setForm(f => ({ ...f, product_id: d.items[0].product_id }));
        setProducts(d.items?.map(i => ({ id: i.product_id, name: i.name })) || []);
      }).catch(() => {});
    }
  }, [orderId]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/warranty/admin', form);
      toast('Tạo phiếu bảo hành thành công!', 'success');
      navigate('/admin/orders');
    } catch (err) { toast(err.error || 'Lỗi tạo phiếu bảo hành', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="container" style={{ padding: '24px 16px 48px', maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => navigate('/admin/orders')} style={{ background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer' }}>←</button>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>🛡️ Cấp phiếu bảo hành</h1>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: 'var(--shadow)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mã đơn hàng *</label>
              <input value={form.order_id} onChange={e => set('order_id', e.target.value)} placeholder="123" style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>SĐT khách hàng *</label>
              <input value={form.customer_phone} onChange={e => set('customer_phone', e.target.value)} placeholder="0918 058 495" style={styles.input} />
            </div>
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Sản phẩm *</label>
              <select value={form.product_id} onChange={e => set('product_id', e.target.value)} style={styles.input}>
                <option value="">-- Chọn sản phẩm --</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Số serial (nếu có)</label>
              <input value={form.serial_number} onChange={e => set('serial_number', e.target.value)} placeholder="SN12345..." style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>IMEI (nếu có)</label>
              <input value={form.imei} onChange={e => set('imei', e.target.value)} placeholder="IMEI..." style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Ngày mua *</label>
              <input type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} style={styles.input} />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Thời hạn bảo hành (tháng) *</label>
              <select value={form.warranty_months} onChange={e => set('warranty_months', e.target.value)} style={styles.input}>
                {[6,12,18,24,36].map(m => <option key={m} value={m}>{m} tháng</option>)}
              </select>
            </div>
            <div style={{ ...styles.formGroup, gridColumn: '1/-1' }}>
              <label style={styles.label}>Ghi chú bảo hành</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Điều kiện bảo hành, loại trừ..." style={{ ...styles.input, height: 70, resize: 'vertical' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => navigate('/admin/orders')} className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }}>Huỷ</button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, justifyContent: 'center', padding: 14 }}>
              {loading ? 'Đang lưu...' : '🛡️ Cấp phiếu bảo hành'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// // ─── REQUIRE GUARDS ───────────────────────────────────────────────────────────

// function RequireLogin({ children }) {
//   const { user } = useAuth();
//   const navigate = useNavigate();
//   const toast = useToast();
//   useEffect(() => { if (!user) { toast('Vui lòng đăng nhập!', 'error'); navigate('/login'); } }, [user]);
//   if (!user) return null;
//   return children;
// }

// function RequireAdmin({ children }) {
//   const { user, isAdmin } = useAuth();
//   const navigate = useNavigate();
//   useEffect(() => { if (!user || !isAdmin) navigate('/'); }, [user, isAdmin]);
//   if (!user || !isAdmin) return null;
//   return children;
// }

// ─── APP ROOT ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <Header />
          <main style={{ minHeight: 'calc(100vh - 120px)' }}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:slug" element={<ProductDetailPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/warranty" element={<WarrantyPage />} />
              <Route path="/quiz" element={<QuizPage />} />
              <Route path="/login" element={<AuthPage />} />

              {/* Customer only */}
              <Route path="/cart" element={<RequireLogin><CartPage /></RequireLogin>} />
              <Route path="/checkout" element={<RequireLogin><CheckoutPage /></RequireLogin>} />
              <Route path="/orders/my" element={<RequireLogin><MyOrdersPage /></RequireLogin>} />
              <Route path="/orders/:id" element={<RequireLogin><OrderDetailPage /></RequireLogin>} />

              {/* Admin only */}
              <Route path="/admin/orders" element={<RequireAdmin><AdminOrdersPage /></RequireAdmin>} />
              <Route path="/admin/products" element={<RequireAdmin><AdminProductsPage /></RequireAdmin>} />
              <Route path="/admin/products/new" element={<RequireAdmin><AdminProductFormPage /></RequireAdmin>} />
              <Route path="/admin/products/edit/:id" element={<RequireAdmin><AdminProductFormPage /></RequireAdmin>} />
              <Route path="/admin/reports" element={<RequireAdmin><AdminReportsPage /></RequireAdmin>} />
              <Route path="/admin/coupons" element={<RequireAdmin><AdminCouponsPage /></RequireAdmin>} />
              <Route path="/admin/warranty/new" element={<RequireAdmin><AdminWarrantyFormPage /></RequireAdmin>} />

              <Route path="*" element={
                <div style={{ textAlign: 'center', padding: 80 }}>
                  <h2>404 — Không tìm thấy trang</h2>
                  <Link to="/" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-flex' }}>Về trang chủ</Link>
                </div>
              } />
            </Routes>
          </main>
          <Footer />
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = {
  header: { background: 'var(--primary)', color: '#fff', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  headerInner: { display: 'flex', alignItems: 'center', gap: 16, height: 64 },
  logo: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 20, whiteSpace: 'nowrap' },
  logoIcon: { fontSize: 24 },
  searchForm: { flex: 1, display: 'flex', maxWidth: 480 },
  searchInput: { flex: 1, padding: '8px 14px', borderRadius: '8px 0 0 8px', border: 'none', fontSize: 14, outline: 'none' },
  searchBtn: { padding: '8px 14px', background: '#ffcc02', borderRadius: '0 8px 8px 0', fontSize: 16, border: 'none', cursor: 'pointer' },
  headerActions: { display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' },
  cartBtn: { display: 'flex', alignItems: 'center', gap: 4, color: '#fff', fontWeight: 600, position: 'relative', fontSize: 15 },
  cartBadge: { background: '#ffcc02', color: '#333', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, position: 'absolute', top: -8, right: 30 },
  userBtn: { background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' },
  loginBtn: { background: '#fff', color: 'var(--primary)', padding: '6px 14px', borderRadius: 8, fontSize: 14, fontWeight: 600 },
  dropdown: { position: 'absolute', top: '100%', right: 0, background: '#fff', borderRadius: 10, boxShadow: 'var(--shadow-hover)', minWidth: 210, overflow: 'hidden', marginTop: 8, zIndex: 200 },
  dropdownItem: { display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px', fontSize: 14, color: 'var(--text)', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)', border: 'none' },
  banner: { padding: '40px 0', position: 'relative' },
  bannerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  bannerSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 8 },
  bannerTitle: { color: '#fff', fontSize: 32, fontWeight: 700, marginBottom: 8 },
  bannerDesc: { color: 'rgba(255,255,255,0.9)', marginBottom: 20, fontSize: 15 },
  bannerEmoji: { fontSize: 80, opacity: 0.3 },
  bannerDots: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer', transition: 'all .3s' },
  dotActive: { background: '#fff', width: 20, borderRadius: 4 },
  sectionTitle: { fontSize: 20, fontWeight: 700, marginBottom: 16 },
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 },
  catCard: { background: '#fff', borderRadius: 12, padding: '16px 12px', textAlign: 'center', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' },
  catIcon: { fontSize: 28 },
  catName: { fontWeight: 600, fontSize: 13 },
  catCount: { fontSize: 12, color: 'var(--text-muted)' },
  card: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'block', transition: 'transform .2s,box-shadow .2s' },
  cardImgWrap: { position: 'relative', height: 180, overflow: 'hidden' },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover' },
  outOfStock: { position: 'absolute', top: 8, left: 8, background: '#888', color: '#fff', fontSize: 11, padding: '2px 8px', borderRadius: 4 },
  cardBody: { padding: 12 },
  cardCat: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 },
  cardName: { fontWeight: 600, fontSize: 13, marginBottom: 10, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { color: 'var(--primary)', fontWeight: 700, fontSize: 15 },
  addBtn: { background: 'var(--primary)', color: '#fff', width: 30, height: 30, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' },
  addBtnDisabled: { background: '#ccc', color: '#fff', width: 30, height: 30, borderRadius: 8, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed', border: 'none' },
  trustRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginTop: 48, padding: 24, background: '#fff', borderRadius: 12, boxShadow: 'var(--shadow)' },
  trustItem: { display: 'flex', gap: 12, alignItems: 'center' },
  productsLayout: { display: 'flex', gap: 24 },
  sidebar: { width: 220, flexShrink: 0, background: '#fff', borderRadius: 12, padding: 16, boxShadow: 'var(--shadow)', alignSelf: 'flex-start', position: 'sticky', top: 80 },
  sidebarTitle: { fontWeight: 700, fontSize: 14, marginBottom: 10 },
  catItem: { display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '8px 10px', borderRadius: 8, fontSize: 13, background: 'none', color: 'var(--text)', cursor: 'pointer', marginBottom: 2, border: 'none' },
  catItemActive: { background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 },
  catItemCount: { marginLeft: 'auto', background: 'var(--bg)', borderRadius: 10, padding: '1px 7px', fontSize: 11 },
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sortSelect: { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 14, outline: 'none' },
  empty: { textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 16 },
  pagination: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 32 },
  pageBtn: { width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 14 },
  pageBtnActive: { background: 'var(--primary)', color: '#fff', border: 'none' },
  breadcrumb: { fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 },
  detailLayout: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 },
  detailImgWrap: { borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: 'var(--shadow)' },
  detailImg: { width: '100%', height: 380, objectFit: 'cover' },
  detailInfo: { display: 'flex', flexDirection: 'column', gap: 12 },
  detailTitle: { fontSize: 22, fontWeight: 700, lineHeight: 1.4 },
  detailPrice: { fontSize: 28, fontWeight: 700, color: 'var(--primary)' },
  stockRow: { display: 'flex', alignItems: 'center', gap: 10 },
  qtyRow: { display: 'flex', alignItems: 'center', gap: 16 },
  qtyCtrl: { display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' },
  qtyBtn: { width: 36, height: 36, background: '#f5f5f5', border: 'none', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { width: 44, textAlign: 'center', fontWeight: 600 },
  descBox: { background: '#f9f9f9', borderRadius: 10, padding: 16, marginTop: 4 },
  cmpTh: { padding: '14px 12px', textAlign: 'center', fontWeight: 600, fontSize: 13, borderBottom: '2px solid var(--border)', verticalAlign: 'top' },
  cmpLabel: { padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg)', whiteSpace: 'nowrap' },
  cmpCell: { padding: '10px 12px', fontSize: 13, textAlign: 'center', verticalAlign: 'middle' },
  cartLayout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  cartItem: { display: 'flex', alignItems: 'center', gap: 16, background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: 'var(--shadow)' },
  cartItemImg: { width: 72, height: 72, objectFit: 'cover', borderRadius: 8 },
  removeBtn: { background: 'none', color: '#bbb', fontSize: 16, padding: 4, cursor: 'pointer', border: 'none' },
  cartSummary: { width: 300, flexShrink: 0, background: '#fff', borderRadius: 12, padding: 24, boxShadow: 'var(--shadow)', position: 'sticky', top: 80 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 15 },
  emptyCart: { textAlign: 'center', padding: '80px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  input: { padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#fff' },
  payOpt: { flex: 1, padding: '12px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center' },
  payOptActive: { border: '2px solid var(--primary)', background: 'var(--primary-light)' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, borderBottom: '1px solid var(--border)' },
  tabBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  tabBtnActive: { background: 'var(--primary)', color: '#fff', border: 'none' },
  adminOrderCard: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: 'var(--shadow)' },
  adminOrderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  btn2: { padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px 14px', textAlign: 'left', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' },
  td: { padding: '12px 14px', fontSize: 14, verticalAlign: 'middle' },
  footer: { background: '#1a1a1a', color: '#fff', padding: '40px 0 20px' },
  footerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32, marginBottom: 32 },
  footerLogo: { fontSize: 20, fontWeight: 700, color: '#ffcc02', marginBottom: 12 },
  footerHeading: { fontWeight: 600, marginBottom: 12, fontSize: 15 },
  footerText: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  footerBottom: { borderTop: '1px solid #333', paddingTop: 16, textAlign: 'center', color: '#666', fontSize: 13 },
};