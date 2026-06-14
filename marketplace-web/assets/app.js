// API base: ?mongo=... | window.__MONGO_API__ | Render | localhost
const qs = new URLSearchParams(location.search);
let MONGO_API = qs.get('mongo') || window.__MONGO_API__ || '';
if (!MONGO_API) {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    MONGO_API = 'http://localhost:8004';
  } else if (host.includes('web.app') || host.includes('firebaseapp.com')) {
    MONGO_API = ''; // Use same-origin (Firebase rewrite) or set via ?mongo=
  }
}

const API_BASE = qs.get('api') || window.__API_BASE__ || (() => {
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:8004';
  if (host.includes('web.app') || host.includes('firebaseapp.com')) return ''; // same-origin or set via ?api=
  return '';
})();

// ===== Ripple effect on buttons =====
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  btn.style.setProperty('--x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
  btn.style.setProperty('--y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
});

// ===== Toast system =====
const toastContainer = document.createElement('div');
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function toast({ title, message, type = 'info', duration = 4000 }) {
  const icons = { success: '✓', error: '✗', info: '⚡' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `
    <div class="toast-icon">${icons[type] || '•'}</div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-message">${message}</div>` : ''}
    </div>
  `;
  toastContainer.appendChild(el);
  setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, duration);
}

// ===== Loading state on buttons =====
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) { btn.classList.add('loading'); btn.disabled = true; }
  else { btn.classList.remove('loading'); btn.disabled = false; }
}

// ===== API helpers =====
function getToken() { return document.getElementById('token')?.value?.trim() || ''; }

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

async function api(method, path, body = null, auth = false) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? authHeaders() : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = { raw: await res.text() }; }
  if (!res.ok) {
    const msg = data?.detail || data?.error || JSON.stringify(data);
    throw new Error(msg);
  }
  return data;
}

const apiGet = (path, auth = false) => api('GET', path, null, auth);
const apiPost = (path, body, auth = false) => api('POST', path, body, auth);

// MongoDB API helper — routes to MONGO_API or same-origin /api/* 
async function mongoApi(method, path, body = null) {
  const base = MONGO_API || '';
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${base}${path}`, opts);
  let data;
  try { data = await res.json(); } catch { data = { raw: await res.text() }; }
  if (!res.ok) throw new Error(data?.detail || data?.error || JSON.stringify(data));
  return data;
}
const mongoGet = (path) => mongoApi('GET', path);
const mongoPost = (path, body) => mongoApi('POST', path, body);
const mongoPut = (path, body) => mongoApi('PUT', path, body);
const mongoDel = (path) => mongoApi('DELETE', path);

// ===== Auth MongoDB (unifié) =====
async function register() {
  const btn = document.getElementById('btn-register');
  setLoading(btn, true);
  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const role = document.getElementById('role').value;

    if (!email || !password || !name) throw new Error('Email, mot de passe et nom requis');
    if (password.length < 6) throw new Error('Mot de passe : min 6 caractères');

    const data = await mongoPost('/api/users/register', { email, password, name, phone, role });
    document.getElementById('mongoUserId').value = data._id || '';
    document.getElementById('token').value = JSON.stringify(data, null, 2);
    setOut(data);
    toast({ title: 'Compte créé', message: `Bienvenue ${name} (${role})`, type: 'success' });
  } catch (e) {
    setOut({ error: String(e) });
    toast({ title: 'Erreur inscription', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function login() {
  const btn = document.getElementById('btn-login');
  setLoading(btn, true);
  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (!email || !password) throw new Error('Email et mot de passe requis');

    const data = await mongoPost('/api/users/login', { email, password });
    document.getElementById('mongoUserId').value = data._id || '';
    document.getElementById('token').value = JSON.stringify(data, null, 2);
    setOut(data);
    toast({ title: 'Connecté', message: `Bienvenue ${data.name || data.email}`, type: 'success' });

    // Auto-load products & categories
    loadMongoProducts();
    loadMongoCategories();
  } catch (e) {
    setOut({ error: String(e) });
    toast({ title: 'Erreur connexion', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Role =====
async function selectRole() {
  const btn = document.getElementById('btn-role');
  setLoading(btn, true);
  try {
    const data = await apiPost('/role/select', { role: document.getElementById('role').value }, true);
    setOut(data);
    toast({ title: 'Rôle mis à jour', message: data.role, type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Vendor profile =====
async function saveVendorProfile() {
  const btn = document.getElementById('btn-vendor');
  setLoading(btn, true);
  try {
    const data = await apiPost('/vendors/register-profile', {
      full_name: document.getElementById('full_name').value.trim(),
      national_id: document.getElementById('national_id').value.trim(),
      city: document.getElementById('city').value.trim(),
      activity: document.getElementById('activity').value.trim(),
      whatsapp_number: document.getElementById('whatsapp_number').value.trim() || null,
    }, true);
    setOut(data);
    toast({ title: 'Profil vendeur', message: 'Enregistré avec succès', type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Subscription =====
let lastProviderRef = null;

async function createSubscription() {
  const btn = document.getElementById('btn-subscription');
  setLoading(btn, true);
  try {
    const data = await apiPost('/subscriptions/create', { method: document.getElementById('method').value }, true);
    lastProviderRef = data.provider_reference;
    document.getElementById('provider_reference').value = lastProviderRef;
    setOut(data);
    toast({ title: 'Abonnement', message: data.message, type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function simulateWebhook() {
  const btn = document.getElementById('btn-webhook');
  setLoading(btn, true);
  try {
    if (!lastProviderRef) lastProviderRef = document.getElementById('provider_reference').value;
    const data = await apiPost('/subscriptions/webhook', { provider_reference: lastProviderRef, status: 'paid' });
    setOut(data);
    toast({ title: 'Webhook', message: `Statut: ${data.status}`, type: 'info' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur webhook', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Articles =====
async function createArticle() {
  const btn = document.getElementById('btn-article');
  setLoading(btn, true);
  try {
    const userId = document.getElementById('mongoUserId')?.value || '';
    const userName = document.getElementById('name')?.value || '';
    const data = await apiPost('/api/articles', {
      title: document.getElementById('article_title').value.trim(),
      content: document.getElementById('article_content').value.trim(),
      author_id: userId,
      author_name: userName,
    }, true);
    document.getElementById('article_id').value = data.id || data._id;
    setOut(data);
    toast({ title: 'Article publié', message: data.title, type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function sendMessage() {
  const btn = document.getElementById('btn-message');
  setLoading(btn, true);
  try {
    const articleId = document.getElementById('article_id').value.trim();
    if (!articleId) throw new Error('article_id manquant');
    const senderId = document.getElementById('mongoUserId')?.value || '';
    const senderName = document.getElementById('name')?.value || '';
    const data = await apiPost(`/api/articles/${articleId}/messages`, {
      content: document.getElementById('message_content').value.trim(),
      sender_id: senderId,
      sender_name: senderName,
    }, true);
    setOut(data);
    toast({ title: 'Message envoyé', type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function loadInbox() {
  const userId = document.getElementById('mongoUserId')?.value;
  if (!userId) { toast({ title: 'Erreur', message: 'Connectez-vous d\'abord', type: 'error' }); return; }
  try {
    const data = await apiGet(`/api/articles/messages/inbox?user_id=${encodeURIComponent(userId)}`, true);
    setOut(data);
    toast({ title: 'Boîte réception', message: `${data.length} message(s)`, type: 'info' });
  } catch (e) { setOut({ error: String(e) }); }
}

async function loadOutbox() {
  const userId = document.getElementById('mongoUserId')?.value;
  if (!userId) { toast({ title: 'Erreur', message: 'Connectez-vous d\'abord', type: 'error' }); return; }
  try {
    const data = await apiGet(`/api/articles/messages/outbox?user_id=${encodeURIComponent(userId)}`, true);
    setOut(data);
    toast({ title: 'Messages envoyés', message: `${data.length} message(s)`, type: 'info' });
  } catch (e) { setOut({ error: String(e) }); }
}

// ===== Products / Search =====
function toIntOrNull(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fillCart(productId) {
  const el = document.getElementById('cartProductId');
  if (el) el.value = String(productId);
  showSection('panier');
  toast({ title: 'Produit sélectionné', message: `ID: ${productId}`, type: 'info' });
}

async function doSearchProducts() {
  const container = document.getElementById('products_out');
  container.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px"></div>';
  try {
    const q = document.getElementById('search_q').value.trim();
    const vendor = toIntOrNull(document.getElementById('search_vendor').value);
    const minPrice = toIntOrNull(document.getElementById('search_min_price').value);
    const maxPrice = toIntOrNull(document.getElementById('search_max_price').value);

    // Try MongoDB first, fallback to Payza
    let list = [];
    try {
      const params = new URLSearchParams();
      if (q) params.set('search', q);
      if (minPrice !== null) params.set('min_price', String(minPrice));
      if (maxPrice !== null) params.set('max_price', String(maxPrice));
      const data = await mongoGet(`/api/products?${params.toString()}`);
      list = Array.isArray(data) ? data : [];
    } catch {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (vendor !== null) params.set('vendor_user_id', String(vendor));
      const data = await apiGet(`/products/search?${params.toString()}`);
      list = Array.isArray(data) ? data : data?.products || data?.items || data?.results || [];
    }

    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Aucun produit trouvé</div></div>';
      return;
    }

    container.innerHTML = list.slice(0, 24).map(p => {
      const id = p?._id ?? p?.id ?? p?.product_id ?? '';
      const title = p?.title ?? p?.name ?? p?.content ?? 'Produit';
      const price = p?.price ?? p?.unit_price ?? p?.amount;
      const img = p?.image_url ?? p?.image ?? p?.thumbnail;
      const safeTitle = String(title).replace(/[<>]/g, '');
      const priceTxt = price != null && price !== '' ? String(price) : '';
      return `<div class="productCard">
        <div class="productImg">${img ? `<img src="${img}" alt="" loading="lazy" />` : '<div class="imgPlaceholder"></div>'}</div>
        <div class="productBody">
          <div class="productTitle" title="${safeTitle}">${safeTitle}</div>
          <div class="productPrice">${priceTxt ? `${priceTxt} $` : '—'}</div>
          <button class="btn btn-primary productBtn" onclick="fillCart('${String(id)}')">Ajouter</button>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<pre>${JSON.stringify({ error: String(e) }, null, 2)}</pre>`;
    toast({ title: 'Erreur recherche', message: String(e), type: 'error' });
  }
}

// ===== Seed catalog =====
async function seedCatalog() {
  const btn = document.getElementById('btn-seed');
  setLoading(btn, true);
  try {
    const data = await apiPost('/products/seed', {}, true);
    toast({ title: 'Catalogue rempli', message: `${data.count} produits ajoutés`, type: 'success' });
    doSearchProducts();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Create product (vendor) =====
let prodUploadedImage = '';

function prodUploadedImageUrl() {
  return prodUploadedImage || document.getElementById('prod_image').value.trim() || null;
}

async function uploadProdImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast({ title: 'Erreur', message: 'Image uniquement', type: 'error' }); return; }
  if (file.size > 5 * 1024 * 1024) { toast({ title: 'Erreur', message: 'Max 5 Mo', type: 'error' }); return; }
  const preview = document.getElementById('prodUploadPreview');
  preview.textContent = '⏳ Upload...';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Upload échoué');
    prodUploadedImage = data.url;
    document.getElementById('prod_image').value = data.url;
    preview.innerHTML = `<img src="${data.url}" style="max-height:60px;border-radius:6px;margin-top:4px" /> ✅`;
    toast({ title: 'Image uploadée', type: 'success' });
  } catch (e) {
    preview.textContent = `❌ ${e.message}`;
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function createProduct() {
  const btn = document.getElementById('btn-create-product');
  setLoading(btn, true);
  try {
    const data = await apiPost('/products/create', {
      name: document.getElementById('prod_name').value.trim(),
      description: document.getElementById('prod_desc').value.trim() || null,
      price_usd: Number(document.getElementById('prod_price').value),
      image_url: prodUploadedImageUrl(),
    }, true);
    prodUploadedImage = '';
    document.getElementById('prodUploadPreview').textContent = '';
    setOut(data);
    toast({ title: 'Produit créé', message: data.name, type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Mobile Payment =====
async function doMobilePayment() {
  const amount = parseFloat(document.getElementById('pmt_amount').value);
  const phone = document.getElementById('pmt_phone').value.trim();
  const operator = document.getElementById('pmt_operator').value;
  const description = document.getElementById('pmt_desc').value.trim() || 'Paiement easy-market';
  const result = document.getElementById('pmt_result');

  if (!amount || amount <= 0) { toast({ title: 'Erreur', message: 'Montant invalide', type: 'error' }); return; }
  if (!phone) { toast({ title: 'Erreur', message: 'Numéro requis', type: 'error' }); return; }

  result.innerHTML = '⏳ Traitement...';
  try {
    const data = await initiateMobilePayment(amount, phone, operator, description);
    result.innerHTML = `
      <div style="background:rgba(255,106,0,0.06);border-radius:8px;padding:8px;border:1px solid rgba(255,106,0,0.1)">
        <div style="font-weight:700;color:var(--alibaba-light)">✅ Paiement initié</div>
        <div style="font-size:12px;margin-top:4px">Réf: <strong>${data.reference}</strong></div>
        <div style="font-size:12px">Montant: ${data.amount} $ + Frais: ${data.fee} $ = <strong>${data.total} $</strong></div>
        <div style="font-size:12px">PIN: <strong style="color:#22c55e">${data.pin}</strong></div>
        <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px">${data.instructions}</div>
        <button class="btn btn-secondary btn-sm mt-1" onclick="simulatePaymentConfirm('${data.reference}')">Simuler confirmation</button>
      </div>
    `;
    toast({ title: 'Paiement initié', message: `Réf: ${data.reference}`, type: 'success' });
  } catch (e) {
    result.innerHTML = `<span style="color:#ef4444;font-size:12px">❌ ${e.message}</span>`;
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function simulatePaymentConfirm(reference) {
  const result = document.getElementById('pmt_result');
  try {
    const data = await apiPost('/api/payments/mobile/callback', {
      reference: reference,
      status: 'paid',
      transaction_id: `TXN-${Date.now()}`,
    }, true);
    result.innerHTML += `<div style="color:#22c55e;font-size:12px;margin-top:4px">✅ Paiement confirmé: ${data.status}</div>`;
    toast({ title: 'Paiement confirmé', type: 'success' });
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

// ===== Cart =====
async function cartAdd() {
  const btn = document.getElementById('btn-cart-add');
  setLoading(btn, true);
  try {
    const productId = Number(document.getElementById('cart_product_id').value);
    const qty = Number(document.getElementById('cart_qty').value);
    if (!productId) throw new Error('product_id manquant');
    if (!qty || qty < 1) throw new Error('Quantité invalide');
    const data = await apiPost('/cart/add', { product_id: productId, qty }, true);
    setCartOut(data);
    toast({ title: 'Ajouté au panier', message: `Qty: ${qty}`, type: 'success' });
  } catch (e) { setCartOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function loadCart() {
  const listEl = document.getElementById('cart_list');
  const outEl = document.getElementById('cart_out');
  listEl.innerHTML = '<div class="skeleton" style="height:100px;border-radius:12px"></div>';
  try {
    const data = await apiGet('/cart', true);
    outEl.textContent = JSON.stringify(data, null, 2);
    const list = Array.isArray(data) ? data : data?.items || data?.cart_items || data?.products || null;
    if (!list || !list.length) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🛒</div><div class="empty-state-text">Panier vide</div></div>';
      return;
    }
    listEl.innerHTML = list.map(item => {
      const title = item?.title ?? item?.name ?? 'Produit';
      const qty = item?.qty ?? item?.quantity ?? 1;
      const price = item?.price ?? item?.unit_price ?? item?.amount;
      const img = item?.image_url ?? null;
      const safeTitle = String(title).replace(/[<>]/g, '');
      const priceTxt = price != null && price !== '' ? String(price) : '';
      const totalTxt = (price != null && price !== '' && Number.isFinite(Number(qty))) ? String(Number(price) * Number(qty)) : '';
      const imgHtml = img ? `<img src="${img}" alt="${safeTitle}" loading="lazy" onerror="this.style.display='none'" />` : `<div class="cartItemImgPlaceholder"><svg viewBox="0 0 40 30" width="40" height="30"><circle cx="20" cy="10" r="8" fill="rgba(139,92,246,0.2)"/><path d="M8 28 L16 18 L24 22 L32 12 L40 28" stroke="rgba(139,92,246,0.2)" stroke-width="1.5" fill="none"/></svg></div>`;
      return `<div class="cartItem">
        <div class="cartItemImg">${imgHtml}</div>
        <div class="cartItemBody">
          <div class="cartItemTitle" title="${safeTitle}">${safeTitle}</div>
          <div class="cartItemPrice">
            <span>${priceTxt ? `${priceTxt} $` : '—'}</span>
            <span class="muted">x ${qty}</span>
          </div>
          ${totalTxt ? `<div class="cartItemTotal">Total: ${totalTxt} $</div>` : ''}
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    listEl.innerHTML = '';
    outEl.textContent = JSON.stringify({ error: String(e) }, null, 2);
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function checkout() {
  const btn = document.getElementById('btn-checkout');
  setLoading(btn, true);
  try {
    const data = await apiPost('/orders/checkout', {}, true);
    setCartOut(data);
    toast({ title: 'Commande passée', message: `ID: ${data.order_ids?.join(', ')}`, type: 'success' });
  } catch (e) { setCartOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

// ===== Output helpers =====
function setOut(obj) {
  const el = document.getElementById('out');
  if (el) el.textContent = JSON.stringify(obj, null, 2);
}
function setCartOut(obj) {
  const el = document.getElementById('cart_out');
  if (el) el.textContent = JSON.stringify(obj, null, 2);
}

// ===== OpenStreetMap / Leaflet =====
let mapInstance = null;
let mapUserMarker = null;
let mapVendorMarkers = [];
let mapRouteLine = null;

function initMap(lat, lng) {
  const el = document.getElementById('map');
  if (!el) return;
  if (mapInstance) {
    mapInstance.setView([lat, lng], 13);
    return;
  }
  mapInstance = L.map('map', {
    center: [lat, lng],
    zoom: 13,
    zoomControl: true,
    attributionControl: true,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapInstance);
}

function addUserMarker(lat, lng, label) {
  if (!mapInstance) initMap(lat, lng);
  if (mapUserMarker) mapUserMarker.remove();
  const icon = L.divIcon({
    html: '<div style="background:#8b5cf6;width:18px;height:18px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 12px rgba(139,92,246,0.6)"></div>',
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  mapUserMarker = L.marker([lat, lng], { icon })
    .addTo(mapInstance)
    .bindPopup(`<strong>${label || 'Vous'}</strong><br/>${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  mapInstance.setView([lat, lng], mapInstance.getZoom() < 13 ? 13 : mapInstance.getZoom());
}

function clearVendorMarkers() {
  mapVendorMarkers.forEach(m => m.remove());
  mapVendorMarkers = [];
}

function addVendorMarker(lat, lng, label, distance) {
  if (!mapInstance) return;
  const icon = L.divIcon({
    html: `<div style="background:#f59e0b;width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px rgba(245,158,11,0.5)"></div>`,
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  const content = `<strong>🏪 ${label}</strong>${distance != null ? `<br/>${distance} km` : ''}<br/><span style="font-size:11px">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`;
  const m = L.marker([lat, lng], { icon })
    .addTo(mapInstance)
    .bindPopup(content);
  mapVendorMarkers.push(m);
  return m;
}

function fitMapToAllMarkers() {
  if (!mapInstance) return;
  const all = [];
  if (mapUserMarker) all.push(mapUserMarker.getLatLng());
  mapVendorMarkers.forEach(m => all.push(m.getLatLng()));
  if (all.length > 1) {
    mapInstance.fitBounds(L.latLngBounds(all), { padding: [40, 40] });
  }
}

async function showRoute(destLat, destLng) {
  if (!mapInstance || !mapUserMarker) {
    toast({ title: 'Erreur', message: 'Localisez-vous d\'abord', type: 'error' });
    return;
  }
  const src = mapUserMarker.getLatLng();
  try {
    const resp = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${src.lng},${src.lat};${destLng},${destLat}?overview=full&geometries=geojson`
    );
    const data = await resp.json();
    if (!data.routes || !data.routes.length) throw new Error('Aucun itinéraire trouvé');
    const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
    const distanceKm = (data.routes[0].distance / 1000).toFixed(1);
    const durationMin = Math.round(data.routes[0].duration / 60);

    if (mapRouteLine) mapRouteLine.remove();
    mapRouteLine = L.polyline(coords, {
      color: '#8b5cf6',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 10',
    }).addTo(mapInstance);
    mapInstance.fitBounds(mapRouteLine.getBounds(), { padding: [40, 40] });

    document.getElementById('map_info').textContent = `🚗 ${distanceKm} km · ${durationMin} min`;
    toast({ title: 'Itinéraire', message: `${distanceKm} km · ${durationMin} min`, type: 'success' });
  } catch (e) {
    toast({ title: 'Erreur itinéraire', message: String(e), type: 'error' });
  }
}

// ===== GPS / Localisation =====
async function locateMe() {
  const btn = document.getElementById('btn-locate');
  setLoading(btn, true);
  try {
    if (!navigator.geolocation) {
      throw new Error('La géolocalisation n\'est pas supportée par votre navigateur');
    }
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    document.getElementById('gps_lat').value = lat.toFixed(6);
    document.getElementById('gps_lng').value = lng.toFixed(6);
    document.getElementById('nearby_lat').value = lat.toFixed(6);
    document.getElementById('nearby_lng').value = lng.toFixed(6);
    toast({ title: 'Position obtenue', message: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, type: 'success' });
    await apiPost('/location/update', { latitude: lat, longitude: lng }, true);
    toast({ title: 'Localisation', message: 'Position enregistrée sur le serveur', type: 'success' });
    initMap(lat, lng);
    addUserMarker(lat, lng, 'Moi');
    document.getElementById('map_info').textContent = '✅ Votre position affichée sur la carte';
  } catch (e) {
    const msg = e.code === 1 ? 'Permission refusée' : e.code === 2 ? 'Position indisponible' : e.code === 3 ? 'Délai dépassé' : String(e);
    toast({ title: 'Erreur GPS', message: msg, type: 'error' });
  } finally { setLoading(btn, false); }
}

async function loadMyLocation() {
  try {
    const data = await apiGet('/location/me', true);
    if (data.latitude != null && data.longitude != null) {
      document.getElementById('gps_lat').value = data.latitude;
      document.getElementById('gps_lng').value = data.longitude;
      document.getElementById('nearby_lat').value = data.latitude;
      document.getElementById('nearby_lng').value = data.longitude;
      toast({ title: 'Localisation', message: `Lat: ${data.latitude}, Lng: ${data.longitude}`, type: 'info' });
      initMap(data.latitude, data.longitude);
      addUserMarker(data.latitude, data.longitude, 'Moi');
      document.getElementById('map_info').textContent = '✅ Position chargée sur la carte';
    } else {
      toast({ title: 'Localisation', message: 'Aucune position enregistrée', type: 'info' });
    }
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function searchNearbyVendors() {
  const container = document.getElementById('nearby_out');
  container.innerHTML = '<div class="skeleton" style="height:100px;border-radius:12px"></div>';
  try {
    const lat = parseFloat(document.getElementById('nearby_lat').value);
    const lng = parseFloat(document.getElementById('nearby_lng').value);
    const radius = parseFloat(document.getElementById('nearby_radius').value) || 50;
    if (!lat || !lng) throw new Error('Activez d\'abord votre position GPS');
    const data = await apiGet(`/vendors/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`, true);
    const list = Array.isArray(data) ? data : [];
    if (!list.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📍</div><div class="empty-state-text">Aucun vendeur à proximité</div></div>';
      return;
    }
    container.innerHTML = list.map(v => `
      <div class="productCard" style="padding:12px;cursor:pointer" onclick="showRoute(${v.latitude}, ${v.longitude})">
        <div class="productBody">
          <div class="productTitle">${v.full_name}</div>
          <div style="font-size:12px;color:var(--text-muted)">${v.activity} · ${v.city}</div>
          <div style="font-size:12px;color:var(--accent)">${v.distance_km} km</div>
          ${v.whatsapp_number ? `<div style="font-size:12px;margin-top:4px">📱 ${v.whatsapp_number}</div>` : ''}
          <div style="font-size:11px;color:var(--good);margin-top:4px">🛣️ Cliquez pour l'itinéraire</div>
        </div>
      </div>
    `).join('');
    initMap(lat, lng);
    addUserMarker(lat, lng, 'Moi');
    clearVendorMarkers();
    list.forEach(v => {
      if (v.latitude != null && v.longitude != null) {
        addVendorMarker(v.latitude, v.longitude, v.full_name, v.distance_km);
      }
    });
    fitMapToAllMarkers();
    document.getElementById('map_info').textContent = `${list.length} vendeur(s) trouvé(s) · Cliquez sur un vendeur pour voir l'itinéraire`;
  } catch (e) {
    container.innerHTML = `<pre style="font-size:12px">${JSON.stringify({ error: String(e) }, null, 2)}</pre>`;
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

function viewMap() {
  const el = document.getElementById('map');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const lat = parseFloat(document.getElementById('gps_lat')?.value);
  const lng = parseFloat(document.getElementById('gps_lng')?.value);
  if (lat && lng) {
    initMap(lat, lng);
    addUserMarker(lat, lng, 'Moi');
    document.getElementById('map_info').textContent = '🗺️ Carte ouverte';
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        initMap(latitude, longitude);
        addUserMarker(latitude, longitude, 'Moi');
        document.getElementById('map_info').textContent = '🗺️ Carte ouverte — position approximative';
      },
      () => {
        initMap(-4.33, 15.31);
        document.getElementById('map_info').textContent = '🗺️ Carte ouverte (Kinshasa, RDC)';
      },
      { enableHighAccuracy: false, timeout: 5000 }
    );
  } else {
    initMap(-4.33, 15.31);
    document.getElementById('map_info').textContent = '🗺️ Carte ouverte (Kinshasa, RDC)';
  }
}

async function showAllVendorsOnMap() {
  const lat = parseFloat(document.getElementById('nearby_lat').value);
  const lng = parseFloat(document.getElementById('nearby_lng').value);
  const radius = parseFloat(document.getElementById('nearby_radius').value) || 50;
  if (!lat || !lng) { toast({ title: 'Erreur', message: 'Activez d\'abord votre position GPS', type: 'error' }); return; }
  initMap(lat, lng);
  addUserMarker(lat, lng, 'Moi');
  try {
    const data = await apiGet(`/vendors/nearby?lat=${lat}&lng=${lng}&radius_km=${radius}`, true);
    const list = Array.isArray(data) ? data : [];
    clearVendorMarkers();
    list.forEach(v => {
      if (v.latitude != null && v.longitude != null) {
        addVendorMarker(v.latitude, v.longitude, v.full_name, v.distance_km);
      }
    });
    fitMapToAllMarkers();
    document.getElementById('map_info').textContent = `${list.length} vendeur(s) affiché(s) sur la carte`;
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

// ===== Panier MongoDB (Cart) =====
function getCartUserId() {
  let id = document.getElementById('cartUserId').value.trim();
  if (!id) {
    const email = document.getElementById('cartUserEmail').value.trim();
    if (email) id = email;
  }
  return id || null;
}

async function loadMongoCart() {
  const userId = getCartUserId();
  if (!userId) { toast({ title: 'Erreur', message: 'ID ou email utilisateur requis', type: 'error' }); return; }
  const container = document.getElementById('cartItemsContainer');
  container.innerHTML = '<div class="skeleton" style="height:100px;border-radius:12px"></div>';
  try {
    const items = await mongoGet(`/api/cart/${encodeURIComponent(userId)}`);
    const checkoutBtn = document.getElementById('btnCheckout');
    const badge = document.getElementById('cartBadgeCount');
    if (!items || !items.length) {
      container.innerHTML = '<div class="empty-state" style="padding:20px"><div class="empty-state-icon">🛒</div><div class="empty-state-text">Panier vide</div></div>';
      checkoutBtn.style.display = 'none';
      if (badge) badge.textContent = '0';
      return;
    }
    if (badge) badge.textContent = String(items.length);
    let total = 0;
    container.innerHTML = items.map((item, idx) => {
      const id = item.product_id || '';
      const qty = item.quantity || 1;
      const priceTxt = item.price ? `${item.price} $` : '—';
      total += (item.price || 0) * qty;
      return `<div class="cartItem" style="padding:10px;border-radius:12px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong style="font-size:13px">${id.slice(-8)}</strong><span class="muted" style="font-size:11px;margin-left:6px">x ${qty}</span></div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="color:#22c55e;font-weight:800">${priceTxt}</span>
            <button class="btn btn-ghost btn-sm" onclick="mongoCartRemove('${id}')" style="padding:4px 8px;font-size:11px">✕</button>
          </div>
        </div>
      </div>`;
    }).join('');
    // Add total line
    container.innerHTML += `<div style="text-align:right;padding:8px 4px;font-size:15px;font-weight:900;color:#22c55e">Total: ${total.toFixed(2)} $</div>`;
    checkoutBtn.style.display = 'block';
  } catch (e) {
    container.innerHTML = `<p class="muted">Erreur: ${e.message}</p>`;
  }
}

async function mongoCartAdd() {
  const userId = getCartUserId();
  const productId = document.getElementById('cartProductId').value.trim();
  const qty = parseInt(document.getElementById('cartQty').value) || 1;
  if (!userId || !productId) { toast({ title: 'Erreur', message: 'ID utilisateur + produit requis', type: 'error' }); return; }
  try {
    await mongoPost(`/api/cart/${encodeURIComponent(userId)}/add`, { product_id: productId, quantity: qty });
    toast({ title: 'Ajouté au panier', type: 'success' });
    loadMongoCart();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function mongoCartRemove(productId) {
  const userId = getCartUserId();
  if (!userId) return;
  try {
    await mongoDel(`/api/cart/${encodeURIComponent(userId)}/item/${encodeURIComponent(productId)}`);
    toast({ title: 'Retiré du panier', type: 'info' });
    loadMongoCart();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function mongoCartClear() {
  const userId = getCartUserId();
  if (!userId) return;
  if (!confirm('Vider le panier ?')) return;
  try {
    await mongoDel(`/api/cart/${encodeURIComponent(userId)}`);
    toast({ title: 'Panier vidé', type: 'info' });
    loadMongoCart();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function mongoCheckout() {
  const userId = getCartUserId();
  if (!userId) { toast({ title: 'Erreur', message: 'Connecte-toi d\'abord', type: 'error' }); return; }
  try {
    const order = await mongoPost(`/api/cart/${encodeURIComponent(userId)}/checkout`, {});
    toast({ title: 'Commande passée !', message: `#${order._id.slice(-8)} — ${order.total.toFixed(2)} $`, type: 'success' });
    loadMongoCart();
    loadMongoOrders();
  } catch (e) {
    toast({ title: 'Erreur checkout', message: String(e), type: 'error' });
  }
}

// ===== Commandes (Orders) =====
async function loadMongoOrders() {
  const container = document.getElementById('ordersContainer');
  if (!container) return;
  const userId = getCartUserId();
  if (!userId) { container.innerHTML = '<div class="muted" style="text-align:center;padding:16px">Connecte-toi pour voir tes commandes</div>'; return; }
  container.innerHTML = '<div class="skeleton" style="height:80px;border-radius:12px"></div>';
  try {
    const orders = await mongoGet(`/api/orders/?buyer_id=${encodeURIComponent(userId)}`);
    if (!orders || !orders.length) {
      container.innerHTML = '<div class="muted" style="text-align:center;padding:16px">Aucune commande</div>';
      return;
    }
    const statusColors = { pending: '#f59e0b', confirmed: '#3b82f6', shipped: '#8b5cf6', delivered: '#22c55e', cancelled: '#ef4444' };
    container.innerHTML = orders.map(o => {
      const color = statusColors[o.status] || 'rgba(255,255,255,0.4)';
      return `<div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:12px;margin-bottom:8px;border:1px solid rgba(255,255,255,0.06)">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>#${o._id.slice(-8)}</strong>
          <span style="color:${color};font-weight:700;font-size:12px;background:rgba(255,255,255,0.05);padding:3px 10px;border-radius:999px">${o.status}</span>
        </div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px">
          ${o.items ? o.items.length : 0} article(s) · ${o.total ? Number(o.total).toFixed(2) : '0.00'} $
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,0.25);margin-top:2px">${new Date(o.created_at).toLocaleString()}</div>
        ${o.status === 'pending' ? `<button class="btn btn-ghost btn-sm mt-1" onclick="mongoCancelOrder('${o._id}')" style="font-size:10px">Annuler</button>` : ''}
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<p class="muted">Erreur: ${e.message}</p>`;
  }
}

async function mongoCancelOrder(orderId) {
  try {
    await mongoPut(`/api/orders/${orderId}/status`, { status: 'cancelled' });
    toast({ title: 'Commande annulée', type: 'info' });
    loadMongoOrders();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

// ===== Catégories (CRUD) =====
async function catLoadAll() {
  const grid = document.getElementById('catGrid');
  const count = document.getElementById('catTotalCount');
  grid.innerHTML = '<div class="al-cat"><div class="ico">⏳</div><div class="nm">Chargement...</div></div>';
  try {
    const cats = await mongoGet('/api/categories/');
    const list = Array.isArray(cats) ? cats : [];
    if (count) count.textContent = String(list.length);
    if (!list.length) {
      grid.innerHTML = '<div class="al-cat" style="grid-column:1/-1;padding:20px"><div class="nm" style="color:rgba(255,255,255,0.3)">Aucune catégorie</div></div>';
      return;
    }
    grid.innerHTML = list.map(c => `
      <div class="al-cat" style="position:relative">
        <div class="ico">${c.image ? `<img src="${c.image}" style="width:28px;height:28px;border-radius:6px;object-fit:cover" />` : '📁'}</div>
        <div class="nm">${String(c.name || '').replace(/[<>]/g, '')}</div>
        <div style="font-size:9px;color:rgba(255,255,255,0.3);margin-top:2px">${(c.description || '').slice(0, 20)}</div>
        <div style="display:flex;gap:4px;justify-content:center;margin-top:4px">
          <button class="btn btn-ghost btn-sm" onclick="catEdit('${c._id}')" style="padding:2px 6px;font-size:9px">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="catDelete('${c._id}')" style="padding:2px 6px;font-size:9px">🗑️</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    grid.innerHTML = `<div class="al-cat" style="grid-column:1/-1"><div class="nm" style="color:#ef4444">Erreur: ${e.message}</div></div>`;
  }
}

async function catCreate() {
  const name = document.getElementById('catNewName').value.trim();
  const description = document.getElementById('catNewDesc').value.trim();
  const image = document.getElementById('catNewImage').value.trim();
  if (!name) { toast({ title: 'Erreur', message: 'Nom requis', type: 'error' }); return; }
  try {
    await mongoPost('/api/categories/', { name, description, image });
    document.getElementById('catNewName').value = '';
    document.getElementById('catNewDesc').value = '';
    document.getElementById('catNewImage').value = '';
    toast({ title: 'Catégorie créée', message: name, type: 'success' });
    catLoadAll();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function catEdit(id) {
  document.getElementById('catEditPanel').style.display = 'block';
  document.getElementById('catEditId').value = id;
  try {
    const cat = await mongoGet(`/api/categories/${id}`);
    document.getElementById('catEditName').value = cat.name || '';
    document.getElementById('catEditDesc').value = cat.description || '';
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function catUpdate() {
  const id = document.getElementById('catEditId').value;
  const name = document.getElementById('catEditName').value.trim();
  const description = document.getElementById('catEditDesc').value.trim();
  if (!id || !name) { toast({ title: 'Erreur', message: 'Nom requis', type: 'error' }); return; }
  try {
    await mongoPut(`/api/categories/${id}`, { name, description });
    document.getElementById('catEditPanel').style.display = 'none';
    toast({ title: 'Catégorie mise à jour', type: 'success' });
    catLoadAll();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function catDelete(id) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  try {
    await mongoDel(`/api/categories/${id}`);
    toast({ title: 'Catégorie supprimée', type: 'info' });
    catLoadAll();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

// Auto-init
setTimeout(() => { catLoadAll(); }, 600);

// ===== Product Browser v2 =====
let browserSort = '';
let browserTimer = null;

function debounceSearch() {
  clearTimeout(browserTimer);
  browserTimer = setTimeout(() => browserSearchProducts(), 300);
}

function browserSetSort(sort, el) {
  browserSort = sort;
  document.querySelectorAll('.al-notif-filter span').forEach(s => s.classList.remove('active'));
  if (el) el.classList.add('active');
  browserSearchProducts();
}

async function browserSearchProducts(page = 1) {
  const grid = document.getElementById('browserGrid');
  const count = document.getElementById('catalogCount');
  const resultCount = document.getElementById('browserResultCount');
  grid.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px;grid-column:1/-1"></div>';
  try {
    const q = document.getElementById('browserSearch').value.trim();
    const category = document.getElementById('browserCategory').value;
    const maxPrice = document.getElementById('browserMaxPrice').value;
    const params = new URLSearchParams();
    if (q) params.set('search', q);
    if (category) params.set('category', category);
    if (maxPrice) params.set('max_price', maxPrice);
    const limit = 12;
    params.set('limit', String(limit));
    params.set('skip', String((page - 1) * limit));
    const data = await mongoGet(`/api/products/?${params.toString()}`);
    const list = Array.isArray(data) ? data : [];
    if (resultCount) resultCount.textContent = `${list.length} résultat(s)`;
    if (count) count.textContent = `${list.length} produits`;
    if (!list.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">📦</div><div class="empty-state-text">Aucun produit trouvé</div></div>';
      return;
    }
    grid.innerHTML = list.map(p => {
      const id = p._id || '';
      const name = String(p.name || '').replace(/[<>]/g, '');
      const price = p.price != null ? `${Number(p.price).toLocaleString()} $` : '—';
      const img = p.image || '';
      const stock = p.stock != null ? `<span style="font-size:11px;color:${p.stock > 0 ? 'rgba(74,222,128,0.6)' : 'rgba(255,100,100,0.6)'}">${p.stock > 0 ? 'En stock' : 'Épuisé'}</span>` : '';
      return `<div class="productCard flutter-fade-in">
        <div class="productImg">${img ? `<img src="${img}" alt="" loading="lazy" />` : '<div class="imgPlaceholder"></div>'}</div>
        <div class="productBody">
          <div class="productTitle" title="${name}">${name}</div>
          <div class="productPrice">${price} ${stock}</div>
          <button class="productBtn" onclick="fillCart('${id}')">Ajouter</button>
        </div>
      </div>`;
    }).join('');
    // Pagination
    const pag = document.getElementById('browserPagination');
    if (pag && list.length >= limit) {
      pag.innerHTML = `<button class="btn btn-ghost btn-sm" onclick="browserSearchProducts(${page - 1})" ${page <= 1 ? 'disabled' : ''}>← Préc.</button>
        <span style="font-size:12px;color:rgba(255,255,255,0.4);padding:0 8px">Page ${page}</span>
        <button class="btn btn-ghost btn-sm" onclick="browserSearchProducts(${page + 1})">Suiv. →</button>`;
    } else if (pag) pag.innerHTML = '';
  } catch (e) {
    grid.innerHTML = `<p class="muted" style="grid-column:1/-1">Erreur: ${e.message}</p>`;
  }
}

function showAddProductPanel() {
  const el = document.getElementById('browserAddPanel');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function browserCreateProduct() {
  const btn = event.target;
  setLoading(btn, true);
  try {
    const data = await mongoPost('/api/products/', {
      name: document.getElementById('browserNewName').value.trim(),
      price: parseFloat(document.getElementById('browserNewPrice').value),
      description: document.getElementById('browserNewDesc').value.trim(),
      category: document.getElementById('browserNewCategory').value.trim(),
      stock: parseInt(document.getElementById('browserNewStock').value) || 0,
      image: document.getElementById('browserNewImage').value.trim() || uploadedImageUrl,
    });
    document.getElementById('browserAddPanel').style.display = 'none';
    document.getElementById('browserNewName').value = '';
    document.getElementById('browserNewPrice').value = '';
    document.getElementById('browserNewDesc').value = '';
    document.getElementById('browserNewCategory').value = '';
    document.getElementById('browserNewImage').value = '';
    document.getElementById('uploadPreview').style.display = 'none';
    document.getElementById('uploadPreview').innerHTML = '';
    document.getElementById('dropZoneText').textContent = '📸 Glissez une image ici ou cliquez pour sélectionner';
    uploadedImageUrl = '';
    toast({ title: 'Produit créé', message: data.name, type: 'success' });
    browserSearchProducts();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function browserLoadCategories() {
  try {
    const cats = await mongoGet('/api/categories/');
    const sel = document.getElementById('browserCategory');
    if (!sel) return;
    sel.innerHTML = '<option value="">Toutes</option>' + cats.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  } catch {}
}

// ===== Image Upload =====
let uploadedImageUrl = '';

async function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  await uploadFile(file);
}

async function handleDrop(event) {
  event.preventDefault();
  const zone = document.getElementById('dropZone');
  zone.style.borderColor = 'rgba(255,106,0,0.3)';
  zone.style.background = 'rgba(255,106,0,0.03)';
  const file = event.dataTransfer.files[0];
  if (!file) return;
  await uploadFile(file);
}

async function uploadFile(file) {
  if (!file.type.startsWith('image/')) {
    toast({ title: 'Erreur', message: 'Seules les images sont acceptées', type: 'error' });
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast({ title: 'Erreur', message: 'Fichier trop volumineux (max 5 Mo)', type: 'error' });
    return;
  }
  const preview = document.getElementById('uploadPreview');
  const text = document.getElementById('dropZoneText');
  preview.style.display = 'block';
  preview.innerHTML = '<div style="color:var(--alibaba-light)">⏳ Upload en cours...</div>';
  text.textContent = '📸 Upload en cours...';
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Upload échoué');
    uploadedImageUrl = data.url;
    document.getElementById('browserNewImage').value = data.url;
    preview.innerHTML = `<img src="${data.url}" style="max-height:100px;border-radius:8px;border:1px solid rgba(255,106,0,0.2)" />`;
    text.textContent = '✅ Image uploadée';
    toast({ title: 'Image uploadée', type: 'success' });
  } catch (e) {
    preview.innerHTML = `<span style="color:#ef4444;font-size:12px">❌ ${e.message}</span>`;
    toast({ title: 'Erreur upload', message: String(e), type: 'error' });
  }
}

// ===== Mobile Payment (Orange Money / M-Pesa / Airtel) =====
async function initiateMobilePayment(amount, phone, operator, description) {
  const data = await apiPost('/api/payments/mobile/initiate', {
    amount, phone, operator, description: description || 'Paiement easy-market'
  }, true);
  return data;
}

async function checkPaymentStatus(reference) {
  return await apiGet(`/api/payments/status/${reference}`, true);
}

async function loadPaymentHistory() {
  const userId = document.getElementById('mongoUserId')?.value;
  if (!userId) { toast({ title: 'Erreur', message: 'Connectez-vous d\'abord', type: 'error' }); return; }
  try {
    const data = await apiGet(`/api/payments/history/${userId}`, true);
    setOut(data);
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

// ===== Real-time Messages =====
let eventSource = null;

async function sendArticleMessage(articleId, content) {
  const senderId = document.getElementById('mongoUserId')?.value || '';
  const senderName = document.getElementById('name')?.value || '';
  if (!articleId || !content) { toast({ title: 'Erreur', message: 'article_id et content requis', type: 'error' }); return; }
  try {
    const data = await apiPost(`/api/articles/${articleId}/messages`, {
      content, sender_id: senderId, sender_name: senderName,
    }, true);
    toast({ title: 'Message envoyé', type: 'success' });
    return data;
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function loadInbox() {
  const userId = document.getElementById('mongoUserId')?.value;
  if (!userId) { toast({ title: 'Erreur', message: 'Connectez-vous d\'abord', type: 'error' }); return; }
  try {
    const data = await apiGet(`/api/articles/messages/inbox?user_id=${encodeURIComponent(userId)}`, true);
    setOut(data);
    toast({ title: 'Boîte de réception', message: `${data.length} message(s)`, type: 'info' });
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function loadOutbox() {
  const userId = document.getElementById('mongoUserId')?.value;
  if (!userId) { toast({ title: 'Erreur', message: 'Connectez-vous d\'abord', type: 'error' }); return; }
  try {
    const data = await apiGet(`/api/articles/messages/outbox?user_id=${encodeURIComponent(userId)}`, true);
    setOut(data);
    toast({ title: 'Messages envoyés', message: `${data.length} message(s)`, type: 'info' });
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

function connectRealtimeMessages() {
  const userId = document.getElementById('mongoUserId')?.value;
  if (!userId) return;
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`${API_BASE}/api/articles/messages/stream?user_id=${encodeURIComponent(userId)}`);
  eventSource.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      toast({ title: `📩 ${msg.sender_name || 'Nouveau message'}`, message: msg.content?.slice(0, 80), type: 'info' });
    } catch {}
  };
  eventSource.onerror = () => {
    if (eventSource) { eventSource.close(); eventSource = null; }
  };
}

// ===== Override login to connect real-time =====
const _origLogin = login;
login = async function() {
  await _origLogin.apply(this, arguments);
  connectRealtimeMessages();
};

const _origRegister = register;
register = async function() {
  await _origRegister.apply(this, arguments);
  connectRealtimeMessages();
};

// ===== Load Homepage Products =====
async function loadHomepageProducts() {
  try {
    const products = await mongoGet('/api/products/?limit=12');
    const list = Array.isArray(products) ? products : [];
    const topGrid = document.getElementById('topSalesGrid');
    const popularGrid = document.getElementById('popularGrid');
    const newGrid = document.getElementById('newArrivalsGrid');
    const featuredGrid = document.getElementById('featuredGrid');
    const statProducts = document.getElementById('statProducts');
    const statVendors = document.getElementById('statVendors');
    const statOrders = document.getElementById('statOrders');

    if (statProducts) statProducts.textContent = String(list.length);
    if (statVendors) {
      const uniqueVendors = new Set(list.map(p => p.seller_name || '').filter(Boolean));
      statVendors.textContent = String(uniqueVendors.size || Math.floor(Math.random() * 8) + 3);
    }
    if (statOrders) statOrders.textContent = String(Math.floor(Math.random() * 40) + 10);

    const renderCard = (p, badge) => {
      const id = p._id || '';
      const name = String(p.name || '').replace(/[<>]/g, '');
      const price = p.price != null ? `${Number(p.price).toLocaleString()} $` : '—';
      const img = p.image || '';
      const rating = p.rating || 4.5;
      const stars = '★'.repeat(Math.floor(rating)) + (rating % 1 >= 0.5 ? '½' : '');
      return `<div class="productCard flutter-fade-in">
        <div class="productImg">${img ? `<img src="${img}" alt="" loading="lazy" />` : '<div class="imgPlaceholder"></div>'}</div>
        <div class="productBody">
          ${badge ? `<span class="badge-promo" style="margin-bottom:4px;display:inline-block">${badge}</span>` : ''}
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px">
            <span style="color:var(--star);font-size:11px">${stars}</span>
            <span style="font-size:10px;color:rgba(255,255,255,0.3)">(${p.reviews_count || 0})</span>
          </div>
          <div class="productTitle" title="${name}">${name}</div>
          <div class="productPrice">${price}</div>
          <button class="productBtn" onclick="fillCart('${id}')">Voir</button>
        </div>
      </div>`;
    };

    if (topGrid) {
      const top = list.slice(0, 4);
      topGrid.innerHTML = top.length ? top.map(p => renderCard(p, '🔥 Top')).join('') : '<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px">Aucun produit</div>';
    }
    if (popularGrid) {
      const pop = list.slice(2, 6);
      popularGrid.innerHTML = pop.length ? pop.map(p => renderCard(p, '⭐ Populaire')).join('') : '<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px">Aucun produit</div>';
    }
    if (newGrid) {
      const sorted = [...list].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      const news = sorted.slice(0, 4);
      newGrid.innerHTML = news.length ? news.map(p => renderCard(p, '🆕 Nouveau')).join('') : '<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px">Aucun produit</div>';
    }
    if (featuredGrid) {
      const feat = list.slice(4, 8);
      featuredGrid.innerHTML = feat.length ? feat.map(p => renderCard(p)).join('') : '<div class="muted" style="grid-column:1/-1;text-align:center;padding:20px">Aucun produit</div>';
    }
  } catch (e) {
    const fallback = [
      { name: 'iPhone 15 Pro Max', price: 1299, image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300&h=200&fit=crop', rating: 4.8, reviews_count: 234 },
      { name: 'MacBook Air M3', price: 1499, image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&h=200&fit=crop', rating: 4.9, reviews_count: 189 },
      { name: 'Nike Air Max 270', price: 150, image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=200&fit=crop', rating: 4.5, reviews_count: 432 },
      { name: 'Casque Bose QC45', price: 329, image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300&h=200&fit=crop', rating: 4.6, reviews_count: 298 },
    ];
    const fb = (p, badge) => `<div class="productCard flutter-fade-in">
      <div class="productImg"><img src="${p.image}" alt="" loading="lazy" /></div>
      <div class="productBody">
        ${badge ? `<span class="badge-promo" style="margin-bottom:4px;display:inline-block">${badge}</span>` : ''}
        <div style="display:flex;align-items:center;gap:4px;margin-bottom:4px"><span style="color:var(--star);font-size:11px">${'★'.repeat(Math.floor(p.rating))}</span><span style="font-size:10px;color:rgba(255,255,255,0.3)">(${p.reviews_count})</span></div>
        <div class="productTitle">${p.name}</div>
        <div class="productPrice">${p.price} $</div>
        <button class="productBtn">Voir</button>
      </div>
    </div>`;
    ['topSalesGrid','popularGrid','newArrivalsGrid','featuredGrid'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = fallback.map(p => fb(p, id === 'topSalesGrid' ? '🔥 Top' : id === 'popularGrid' ? '⭐ Populaire' : id === 'newArrivalsGrid' ? '🆕 Nouveau' : '')).join('');
    });
    if (document.getElementById('statProducts')) document.getElementById('statProducts').textContent = '4+';
    if (document.getElementById('statVendors')) document.getElementById('statVendors').textContent = '8';
    if (document.getElementById('statOrders')) document.getElementById('statOrders').textContent = '45';
  }
}

// Auto-init on page load
setTimeout(() => {
  browserSearchProducts();
  browserLoadCategories();
  loadHomepageProducts();
}, 500);

// ===== Notifications =====
async function requestNotifPerm() {
  if (!('Notification' in window)) { toast({ title: 'Non supporté', type: 'error' }); return; }
  if (navigator.serviceWorker) { try { await navigator.serviceWorker.ready; } catch {} }
  const perm = await Notification.requestPermission();
  toast({ title: 'Notifications', message: `Permission: ${perm}`, type: perm === 'granted' ? 'success' : 'info' });
}

async function sendTestNotification() {
  if (!('Notification' in window)) { toast({ title: 'Non supporté', type: 'error' }); return; }
  if (Notification.permission !== 'granted') { toast({ title: 'Permission requise', message: 'Active les notifications d\'abord', type: 'error' }); return; }
  const title = document.getElementById('notif_title')?.value || 'easy-market';
  const body = document.getElementById('notif_body')?.value || 'Notification test';
  const icon = './assets/cart-icon.svg';
  if (navigator.serviceWorker?.ready) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, icon, tag: 'easy-market' });
  } else {
    new Notification(title, { body, icon });
  }
  toast({ title: 'Notification envoyée', type: 'success' });
}
