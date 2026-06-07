// API base: use ?mongo=... query param, window.__MONGO_API__, or localhost:8005
const qs = new URLSearchParams(location.search);
const MONGO_API = qs.get('mongo') || window.__MONGO_API__ || (location.hostname === 'localhost' || location.hostname === '127.0.0.1' ? 'http://localhost:8005' : '');
const API_BASE = window.__API_BASE__ || 'http://localhost:8000';

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
    const data = await apiPost('/articles', {
      title: document.getElementById('article_title').value.trim(),
      content: document.getElementById('article_content').value.trim(),
    }, true);
    document.getElementById('article_id').value = data.id;
    setOut(data);
    toast({ title: 'Article publié', message: data.title, type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function sendMessage() {
  const btn = document.getElementById('btn-message');
  setLoading(btn, true);
  try {
    const articleId = Number(document.getElementById('article_id').value);
    if (!articleId) throw new Error('article_id manquant');
    const data = await apiPost(`/articles/${articleId}/messages`, {
      content: document.getElementById('message_content').value.trim(),
    }, true);
    setOut(data);
    toast({ title: 'Message envoyé', type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
}

async function loadInbox() {
  try {
    const data = await apiGet('/articles/messages/inbox', true);
    setOut(data);
  } catch (e) { setOut({ error: String(e) }); }
}

async function loadOutbox() {
  try {
    const data = await apiGet('/articles/messages/outbox', true);
    setOut(data);
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
  const el = document.getElementById('cart_product_id');
  if (el) el.value = String(productId);
  const meta = document.getElementById('cartMeta');
  if (meta) meta.textContent = 'Produit sélectionné. Ajoute au panier.';
  const badge = document.querySelector('.qtyPill');
  if (badge) { badge.classList.remove('bounce'); void badge.offsetWidth; badge.classList.add('bounce'); }
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
async function createProduct() {
  const btn = document.getElementById('btn-create-product');
  setLoading(btn, true);
  try {
    const data = await apiPost('/products/create', {
      name: document.getElementById('prod_name').value.trim(),
      description: document.getElementById('prod_desc').value.trim() || null,
      price_usd: Number(document.getElementById('prod_price').value),
      image_url: document.getElementById('prod_image').value.trim() || null,
    }, true);
    setOut(data);
    toast({ title: 'Produit créé', message: data.name, type: 'success' });
  } catch (e) { setOut({ error: String(e) }); toast({ title: 'Erreur', message: String(e), type: 'error' });
  } finally { setLoading(btn, false); }
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

// ===== MongoDB-specific functions =====
async function loadMongoCategories() {
  try {
    const cats = await mongoGet('/api/categories/');
    const el = document.getElementById('mongoCategories');
    if (!el) return;
    el.innerHTML = cats.map(c => `
      <div class="al-cat" onclick="loadMongoProductsByCategory('${encodeURIComponent(c.name)}')">
        <div class="ico">📁</div>
        <div class="nm">${c.name}</div>
      </div>
    `).join('');
  } catch (e) {
    console.warn('Mongo categories unavailable:', e.message);
  }
}

async function loadMongoProducts() {
  const el = document.getElementById('mongoProducts');
  if (!el) return;
  el.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px"></div>';
  try {
    const prods = await mongoGet('/api/products/');
    el.innerHTML = prods.slice(0, 12).map(p => `
      <div class="productCard">
        <div class="productImg">${p.image ? `<img src="${p.image}" alt="" loading="lazy" />` : '<div class="imgPlaceholder"></div>'}</div>
        <div class="productBody">
          <div class="productTitle">${String(p.name).replace(/[<>]/g, '')}</div>
          <div class="productPrice">${p.price} $</div>
          <button class="productBtn" onclick="fillCart('${p._id}')">Ajouter</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="muted">MongoDB indisponible: ${e.message}</p>`;
  }
}

async function loadMongoProductsByCategory(category) {
  const el = document.getElementById('mongoProducts');
  if (!el) return;
  el.innerHTML = '<div class="skeleton" style="height:200px;border-radius:12px"></div>';
  try {
    const prods = await mongoGet(`/api/products/?category=${encodeURIComponent(category)}`);
    document.getElementById('mongoSectionTitle').textContent = `📁 ${category}`;
    el.innerHTML = prods.map(p => `
      <div class="productCard">
        <div class="productImg">${p.image ? `<img src="${p.image}" alt="" loading="lazy" />` : '<div class="imgPlaceholder"></div>'}</div>
        <div class="productBody">
          <div class="productTitle">${String(p.name).replace(/[<>]/g, '')}</div>
          <div class="productPrice">${p.price} $</div>
          <button class="productBtn" onclick="fillCart('${p._id}')">Ajouter</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = `<p class="muted">Erreur: ${e.message}</p>`;
  }
}

async function loginMongo() {
  const email = document.getElementById('mongoEmail').value.trim();
  const password = document.getElementById('mongoPassword').value;
  if (!email || !password) { toast({ title: 'Erreur', message: 'Email et mot de passe requis', type: 'error' }); return; }
  try {
    const data = await mongoPost('/api/users/login', { email, password });
    document.getElementById('mongoUserId').value = data._id || '';
    document.getElementById('mongoUserInfo').textContent = `Connecté: ${data.name || data.email}`;
    document.getElementById('mongoUserInfo').style.color = '#4ade80';
    toast({ title: 'Connexion MongoDB', message: `Bienvenue ${data.name || data.email}`, type: 'success' });
    loadMongoProducts();
    loadMongoCategories();
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function registerMongo() {
  const email = document.getElementById('mongoEmail').value.trim();
  const password = document.getElementById('mongoPassword').value;
  const name = document.getElementById('mongoName').value.trim();
  if (!email || !password || !name) { toast({ title: 'Erreur', message: 'Tous les champs requis', type: 'error' }); return; }
  try {
    const data = await mongoPost('/api/users/register', { email, password, name });
    document.getElementById('mongoUserId').value = data._id || '';
    document.getElementById('mongoUserInfo').textContent = `Créé: ${data.name || data.email}`;
    document.getElementById('mongoUserInfo').style.color = '#4ade80';
    toast({ title: 'Inscription MongoDB', message: 'Compte créé avec succès', type: 'success' });
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function placeMongoOrder() {
  const buyerId = document.getElementById('mongoUserId').value;
  const productId = document.getElementById('mongoOrderProduct').value;
  const quantity = parseInt(document.getElementById('mongoOrderQty').value) || 1;
  if (!buyerId || !productId) { toast({ title: 'Erreur', message: 'Connectez-vous et sélectionnez un produit', type: 'error' }); return; }
  try {
    const data = await mongoPost('/api/orders/', {
      buyer_id: buyerId,
      items: [{ product_id: productId, quantity }],
      total: 0, // server should calculate
    });
    document.getElementById('mongoOrderResult').textContent = JSON.stringify(data, null, 2);
    toast({ title: 'Commande MongoDB', message: `Order ID: ${data._id}`, type: 'success' });
  } catch (e) {
    toast({ title: 'Erreur', message: String(e), type: 'error' });
  }
}

async function loadMongoOrders() {
  const el = document.getElementById('mongoOrdersList');
  if (!el) return;
  const buyerId = document.getElementById('mongoUserId').value;
  if (!buyerId) { el.innerHTML = '<p class="muted">Connectez-vous d\'abord</p>'; return; }
  try {
    const orders = await mongoGet(`/api/orders/?buyer_id=${buyerId}`);
    el.innerHTML = orders.length ? orders.map(o => `
      <div style="background:rgba(255,106,0,0.06);border-radius:10px;padding:10px;margin-bottom:8px;border:1px solid rgba(255,106,0,0.1)">
        <strong>#${o._id.slice(-6)}</strong> — ${o.status}
        <div style="font-size:12px;color:rgba(255,255,255,0.5)">${o.items.length} article(s) · ${o.total} $</div>
        <div style="font-size:11px;color:rgba(255,255,255,0.3)">${new Date(o.created_at).toLocaleString()}</div>
      </div>
    `).join('') : '<p class="muted">Aucune commande</p>';
  } catch (e) {
    el.innerHTML = `<p class="muted">Erreur: ${e.message}</p>`;
  }
}

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
