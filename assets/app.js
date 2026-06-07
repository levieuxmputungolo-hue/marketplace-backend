// ─── VARIABLES ───
let currentUser = null;
let currentChatId = null;
let currentChatUser = null;
let chatsUnsub = null;
let messagesUnsub = null;
let confirmationResult = null;
let mediaRecorder = null;
let audioChunks = [];
let isMuted = false;
let isSpeaker = false;
let isVideoEnabled = true;

// WebRTC
let pc = null;
let localStream = null;
let remoteStream = null;
let callDocRef = null;
let callUnsub = null;
let callTimerInterval = null;
let callStartTime = null;
let incomingCallUnsub = null;
let pendingCallDocId = null;
let callerCandidatesUnsub = null;
let calleeCandidatesUnsub = null;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

// ─── UTILS ───
function $(id) { return document.getElementById(id); }
function showToast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2500); }
function loading(show) { $('loadingBar').classList.toggle('show', show); }

// ─── ANTI-PHISHING / LIENS FRAUDULEUX ───
const _MALICIOUS_DOMAINS = [
  'free-hack', 'hack-free', 'piratage', 'h4ck', 'phish',
  'fake-login', 'account-verify', 'secure-login', 'confirm-account',
  'free-gift', 'win-free', 'gagne-argent', 'click-here',
  'izaho-clone', 'izaho-copy', 'izaho-secure', 'izaho-verify',
  'telecharger-gratuit', 'acces-gratuit', 'compte-gratuit',
  'verifier-compte', 'valider-compte', 'motdepasse-perdu',
  'hack-instagram', 'hack-facebook', 'hack-whatsapp',
  'crack-login', 'premium-free', 'debloquer-compte',
  'connexion-securisee', 'espace-securise', 'mon-compte-izaho'
];

var _linkRegex = /(https?:\/\/[^\s<>"'(){}|\\^`[\]]+)/gi;

function _isMaliciousLink(url) {
  try {
    var u = new URL(url.toLowerCase());
    var host = u.hostname;
    // Vérifier si le host contient un domaine malveillant
    for (var i = 0; i < _MALICIOUS_DOMAINS.length; i++) {
      if (host.indexOf(_MALICIOUS_DOMAINS[i]) !== -1) return true;
    }
    // Détecter les IPs suspectes
    var ipMatch = host.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    if (ipMatch && !host.startsWith('192.168.') && !host.startsWith('10.') && !host.startsWith('127.')) return true;
    // Détecter les faux domains izaho
    if (host.indexOf('izaho') !== -1 && host !== 'izaho.app' && host !== 'localhost' && host.indexOf('192.168.') !== 0 && host.indexOf('izaho.net') === -1 && host.indexOf('izaho.org') === -1) return true;
    return false;
  } catch(e) { return false; }
}

function _scanAndFilterMessage(text) {
  var matches = text.match(_linkRegex);
  if (!matches) return text;
  var result = text;
  for (var i = 0; i < matches.length; i++) {
    if (_isMaliciousLink(matches[i])) {
      result = result.replace(matches[i], '🔒 [lien bloqué - protection izaho]');
    }
  }
  return result;
}

// ─── CONFÉRENCE APPEL (localStorage) ───
var _conferenceData = {};

function _getConferences() {
  try { return JSON.parse(localStorage.getItem('izaho_conferences') || '{}'); } catch(e) { return {}; }
}
function _saveConferences(d) {
  localStorage.setItem('izaho_conferences', JSON.stringify(d));
}

function startConference(groupId) {
  var confs = _getConferences();
  if (confs[groupId]) {
    showToast('📞 Une conférence est déjà en cours dans ce groupe');
    return false;
  }
  confs[groupId] = {
    host: currentUser.uid,
    hostName: currentUser.displayName,
    participants: [currentUser.uid],
    startedAt: new Date().toISOString(),
    active: true
  };
  _saveConferences(confs);
  showToast('📞 Conférence démarrée ! Vous êtes l\'hôte');
  _updateConferenceUI(groupId);
  return true;
}

function joinConference(groupId) {
  var confs = _getConferences();
  if (!confs[groupId] || !confs[groupId].active) {
    showToast('❌ Aucune conférence active');
    return false;
  }
  if (confs[groupId].participants.indexOf(currentUser.uid) !== -1) {
    showToast('✅ Vous êtes déjà dans la conférence');
    return true;
  }
  // Vérifier que l'utilisateur est membre du groupe
  var groups = _getGroups();
  var group = groups.find(function(g) { return g.groupId === groupId; });
  if (!group || group.members.indexOf(currentUser.uid) === -1) {
    showToast('❌ Vous n\'êtes pas membre de ce groupe');
    return false;
  }
  confs[groupId].participants.push(currentUser.uid);
  _saveConferences(confs);
  showToast('📞 Vous avez rejoint la conférence');
  _updateConferenceUI(groupId);
  return true;
}

function leaveConference(groupId) {
  var confs = _getConferences();
  if (!confs[groupId]) return;
  var idx = confs[groupId].participants.indexOf(currentUser.uid);
  if (idx !== -1) confs[groupId].participants.splice(idx, 1);
  if (confs[groupId].participants.length === 0 || confs[groupId].host === currentUser.uid) {
    delete confs[groupId];
    showToast('📞 Conférence terminée');
  } else {
    _saveConferences(confs);
    showToast('📞 Vous avez quitté la conférence');
  }
  _updateConferenceUI(groupId);
}

function endConference(groupId) {
  var confs = _getConferences();
  if (!confs[groupId]) return;
  if (confs[groupId].host !== currentUser.uid) {
    showToast('❌ Seul l\'hôte peut terminer la conférence');
    return;
  }
  delete confs[groupId];
  _saveConferences(confs);
  showToast('📞 Conférence terminée');
  var over = $('conferenceOverlay');
  if (over) over.style.display = 'none';
}

function _updateConferenceUI(groupId) {
  var confs = _getConferences();
  var conf = confs[groupId];
  if (!conf || !conf.active) {
    var over = $('conferenceOverlay');
    if (over) over.style.display = 'none';
    return;
  }
  var btn = document.getElementById('conferenceBtn_' + groupId);
  if (btn) {
    btn.innerHTML = '<i class="fas fa-phone"></i> ' + conf.participants.length + ' en conférence';
    if (conf.host === currentUser.uid) btn.style.background = 'var(--accent2)';
    else btn.style.background = 'var(--primary-to)';
  }
  var over = $('conferenceOverlay');
  if (over && over.style.display === 'flex') {
    _showConferenceOverlay(groupId);
  }
}

function _showConferenceOverlay(groupId) {
  var confs = _getConferences();
  var conf = confs[groupId];
  if (!conf) return;
  var over = $('conferenceOverlay');
  if (!over) return;
  var list = $('conferenceParticipantList');
  if (!list) return;

  var reg = _registry();
  var html = '';
  var isHost = conf.host === currentUser.uid;

  for (var i = 0; i < conf.participants.length; i++) {
    var uid = conf.participants[i];
    var name = uid === conf.host ? '👑 ' : '';
    name += reg[uid] ? (reg[uid].name || uid) : uid;
    html += '<div class="settings-row" style="padding:8px 10px"><span>' + name + '</span><span class="settings-badge">' + (uid === conf.host ? 'Hôte' : 'Membre') + '</span></div>';
  }

  list.innerHTML = html;

  // Afficher les contrôles hôte
  var hostControls = $('conferenceHostControls');
  if (hostControls) {
    hostControls.style.display = isHost ? 'flex' : 'none';
  }

  $('conferenceHostName').textContent = reg[conf.host] ? (reg[conf.host].name || conf.host) : conf.host;
  $('conferenceStatus').textContent = conf.participants.length + ' participant(s)';
  $('conferenceOverlay').dataset.groupId = groupId;
  over.style.display = 'flex';
}

function toggleConferenceOverlay(groupId) {
  var over = $('conferenceOverlay');
  if (over && over.style.display === 'flex' && over.dataset.groupId === groupId) {
    over.style.display = 'none';
    return;
  }
  _showConferenceOverlay(groupId);
}

function hideConferenceOverlay() {
  var over = $('conferenceOverlay');
  if (over) over.style.display = 'none';
}

function conferenceAddMember(groupId) {
  var groups = _getGroups();
  var group = groups.find(function(g) { return g.groupId === groupId; });
  if (!group) return;
  var confs = _getConferences();
  var conf = confs[groupId];
  if (!conf || conf.host !== currentUser.uid) {
    showToast('❌ Seul l\'hôte peut ajouter des participants');
    return;
  }
  // Trouver les membres du groupe qui ne sont pas encore dans la conférence
  var reg = _registry();
  var notIn = group.members.filter(function(m) { return conf.participants.indexOf(m) === -1; });
  if (notIn.length === 0) {
    showToast('✅ Tous les membres sont déjà dans la conférence');
    return;
  }
  var names = notIn.map(function(m) { return reg[m] ? reg[m].name || m : m; });
  var next = notIn[0];
  conf.participants.push(next);
  _saveConferences(confs);
  showToast('📞 ' + (reg[next] ? reg[next].name || next : next) + ' a été ajouté(e) à la conférence');
  _showConferenceOverlay(groupId);
}

// ─── HISTORIQUE DES APPELS ───
function _getCallHistory() {
  try { return JSON.parse(localStorage.getItem('izaho_calls_' + currentUser.uid) || '[]'); } catch(e) { return []; }
}
function _saveCallHistory(list) {
  localStorage.setItem('izaho_calls_' + currentUser.uid, JSON.stringify(list));
}

function _recordCall(contactId, contactName, type, direction, status) {
  if (!currentUser) return;
  var list = _getCallHistory();
  list.unshift({
    contactId: contactId,
    contactName: contactName,
    type: type,
    direction: direction,
    status: status,
    createdAt: new Date().toISOString()
  });
  if (list.length > 100) list.length = 100;
  _saveCallHistory(list);
}

function loadCallHistory() {
  var list = _getCallHistory();
  var container = $('callsList');
  if (!container) return;
  var empty = $('callsEmpty');
  if (empty) empty.style.display = list.length === 0 ? 'block' : 'none';

  var html = '';
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var icon = c.direction === 'outgoing' ? 'fa-phone' : (c.direction === 'incoming' && c.status === 'missed' ? 'fa-phone-slash' : 'fa-phone');
    var color = c.status === 'missed' ? 'var(--accent)' : (c.direction === 'outgoing' ? 'var(--primary-to)' : 'var(--text-muted)');
    var label = c.direction === 'outgoing' ? 'Sortant' : (c.status === 'missed' ? 'Manqué' : 'Reçu');
    var time = formatTime(new Date(c.createdAt));
    var typeIcon = c.type === 'video' ? '📹' : '🔊';

    html += '<div class="chat-item" onclick="callFromHistory(\'' + c.contactId.replace(/'/g, "\\'") + '\',\'' + c.contactName.replace(/'/g, "\\'") + '\')" style="cursor:pointer">';
    html += '<div class="chat-avatar" style="background:' + (c.status === 'missed' ? 'var(--accent)' : 'var(--primary-from)') + ';opacity:.8">' + c.contactName[0].toUpperCase() + '</div>';
    html += '<div class="chat-info"><div class="chat-name" style="color:' + (c.status === 'missed' ? 'var(--accent)' : 'var(--text)') + '">' + c.contactName + '</div>';
    html += '<div class="chat-preview" style="color:' + color + '"><i class="fas ' + icon + '" style="font-size:10px;margin-right:4px"></i> ' + label + ' · ' + typeIcon + ' ' + time + '</div></div>';
    html += '<button class="header-btn" onclick="event.stopPropagation();startCallFromHistory(\'' + c.contactId.replace(/'/g, "\\'") + '\',\'' + c.contactName.replace(/'/g, "\\'") + '\',\'' + c.type + '\')" style="color:var(--primary-to);font-size:18px"><i class="fas fa-phone"></i></button>';
    html += '</div>';
  }
  container.innerHTML = html;
}

function callFromHistory(contactId, contactName) {
  // Ouvrir le chat avec ce contact
  var chats = _getChats();
  var chat = chats.find(function(c) { return c.otherId === contactId; });
  if (chat) {
    openChat(contactId, contactName);
    showView('chats');
  } else {
    showToast('Contact introuvable');
  }
}

function startCallFromHistory(contactId, contactName, type) {
  // Chercher le contact dans les chats
  var chats = _getChats();
  var chat = chats.find(function(c) { return c.otherId === contactId; });
  if (chat) {
    openChat(contactId, contactName);
    setTimeout(function() { startCall(type); }, 300);
  } else {
    showToast('Contact introuvable');
  }
}

// ─── FIN ANTI-PHISHING / CONFÉRENCE ───

// ─── AUTH (réseau privé à 5 chiffres) ───
function _registry() {
  try { return JSON.parse(localStorage.getItem('izaho_registry') || '{}'); } catch (_) { return {}; }
}
function _saveRegistry(r) { localStorage.setItem('izaho_registry', JSON.stringify(r)); }
function _emails() {
  try { return JSON.parse(localStorage.getItem('izaho_emails') || '{}'); } catch (_) { return {}; }
}
function _saveEmails(e) { localStorage.setItem('izaho_emails', JSON.stringify(e)); }
function _counters() {
  try { return JSON.parse(localStorage.getItem('izaho_counters') || '{}'); } catch (_) { return {}; }
}
function _saveCounters(c) { localStorage.setItem('izaho_counters', JSON.stringify(c)); }

function _generatePersonalId(country) {
  const counters = _counters();
  const next = (counters[country] || 0) + 1;
  counters[country] = next;
  _saveCounters(counters);
  return String(next).padStart(5, '0');
}

function _makeUid(country, personalId) { return country + '_' + personalId; }

function registerGmail() {
  const email = $('authGmail').value.trim().toLowerCase();
  const country = $('authCountry').value;
  if (!email || !email.includes('@')) { $('authError').textContent = 'Email invalide'; return; }
  // Check email not already used
  const emails = _emails();
  if (emails[email]) { $('authError').textContent = 'Cet email est déjà enregistré'; return; }
  $('authError').textContent = '';
  // Generate unique 5-digit personal ID
  const personalId = _generatePersonalId(country);
  const uid = _makeUid(country, personalId);
  const registry = _registry();
  registry[uid] = { email, country, personalId, name: '', createdAt: new Date().toISOString() };
  _saveRegistry(registry);
  emails[email] = uid;
  _saveEmails(emails);
  // Show the generated ID
  $('newUserIdDisplay').textContent = '+' + country + ' ' + personalId;
  $('authGmailDisplay').textContent = email;
  $('authChoice').style.display = 'none';
  $('authShowId').style.display = 'block';
  $('authError').textContent = '';
  // Store temp data for next step
  window.__pendingUid = uid;
  window.__pendingCountry = country;
}

function showNameStep() {
  if (!window.__pendingUid) { resetAuth(); return; }
  $('authShowId').style.display = 'none';
  $('authNameStep').style.display = 'block';
  $('authName').focus();
}

function completeRegistration() {
  const name = $('authName').value.trim();
  const uid = window.__pendingUid;
  if (!name) { showToast('Entrez un nom'); return; }
  if (!uid) { resetAuth(); return; }
  const registry = _registry();
  if (registry[uid]) {
    registry[uid].name = name;
    _saveRegistry(registry);
  }
  window.__pendingUid = null;
  _finalizeLogin(uid, name);
}

function loginWithId() {
  const country = $('loginCountry').value;
  const personalId = $('authId').value.trim();
  if (!personalId || personalId.length !== 5 || !/^\d{5}$/.test(personalId)) {
    $('authError').textContent = 'Entrez un identifiant valide (5 chiffres)';
    return;
  }
  const uid = _makeUid(country, personalId);
  const registry = _registry();
  const user = registry[uid];
  if (!user) { $('authError').textContent = 'Identifiant introuvable'; return; }
  $('authError').textContent = '';
  _finalizeLogin(uid, user.name);
}

function _finalizeLogin(uid, name) {
  const country = uid.split('_')[0];
  const personalId = uid.split('_')[1];
  currentUser = {
    uid: uid,
    _local: true,
    displayName: name || 'Utilisateur',
    izahoId: '+' + country + ' ' + personalId,
    country: country,
    personalId: personalId,
  };
  // Save session
  localStorage.setItem('izaho_session', JSON.stringify({ uid, name, _local: true }));
  // Show app
  $('authScreen').classList.remove('active');
  $('appScreen').classList.add('active');
  window.__demoData = { users: {}, chats: {}, messages: {}, contacts: [], statuses: [] };
  window.__demoData.users[uid] = {
    name: name || 'Utilisateur',
    izahoId: '+' + country + ' ' + personalId,
    photoURL: '', online: true, lastSeen: new Date(),
  };
  initUser();
  loadChats();
  listenIncomingCalls();
  updateInviteBadge();
  // Sur desktop, viewChats + placeholder dans le main
  if (window.innerWidth >= 1024) {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    $('viewChats').classList.add('active');
    const ph = $('viewDesktopPlaceholder');
    if (ph) ph.classList.add('active');
  }
  showToast('Connecté · ' + currentUser.izahoId);
}

function enterDemoMode() {
  const demoCountry = '261';
  const personalId = _generatePersonalId(demoCountry);
  const uid = _makeUid(demoCountry, personalId);
  _finalizeLogin(uid, 'Test');
}

function resetAuth() {
  $('authChoice').style.display = 'block';
  $('authShowId').style.display = 'none';
  $('authNameStep').style.display = 'none';
  $('authError').textContent = '';
  $('authGmail').value = '';
  $('authId').value = '';
  $('authName').value = '';
  window.__pendingUid = null;
}

function logout() {
  localStorage.removeItem('izaho_session');
  location.reload();
}

// ─── NAVIGATION ───
function showView(view) {
  const isDesktop = window.innerWidth >= 1024;
  const targetId = 'view' + view.charAt(0).toUpperCase() + view.slice(1);

  // Sur desktop : layout en grille avec sidebar + main
  if (isDesktop) {
    // "chats" remet le placeholder dans le main si aucun chat ouvert
    if (view === 'chats') {
      const chatActive = $('viewChat') && $('viewChat').classList.contains('active');
      if (!chatActive) {
        document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
        const ph = $('viewDesktopPlaceholder');
        if (ph) ph.classList.add('active');
      }
      // viewChats reste visible dans la sidebar
      $('viewChats').classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const n = document.querySelector(`.nav-item[data-view="chats"]`);
      if (n) n.classList.add('active');
      loadChats();
      return;
    }

    // Autres vues : on cache toutes les vues, on réactive chats (sidebar), puis on active la cible dans le main
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    // Toujours garder viewChats visible dans la sidebar sur desktop
    $('viewChats').classList.add('active');
    const target = $(targetId);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');
  } else {
    // Mobile : comportement normal, une seule vue à la fois
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    const target = $(targetId);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.querySelector(`.nav-item[data-view="${view}"]`);
    if (navItem) navItem.classList.add('active');
  }

  if (view === 'chats') loadChats();
  if (view === 'contacts') loadContacts();
  if (view === 'status') loadStatuses();
  if (view === 'calls') loadCallHistory();
  if (view === 'profile') loadProfile();
  if (view === 'settings') loadSettings();
  if (view === 'community') loadCommunity();
}

// ─── SESSION RESTORE ───
(function() {
  try {
    const session = JSON.parse(localStorage.getItem('izaho_session') || 'null');
    if (session && session.uid) {
      const parts = session.uid.split('_');
      currentUser = {
        uid: session.uid,
        _local: true,
        displayName: session.name || 'Utilisateur',
        izahoId: '+' + parts[0] + ' ' + parts[1],
        country: parts[0],
        personalId: parts[1],
      };
    }
  } catch (_) {}
  if (currentUser) {
    $('authScreen').classList.remove('active');
    $('appScreen').classList.add('active');
    window.__demoData = { users: {}, chats: {}, messages: {}, contacts: [], statuses: [] };
    initUser();
    loadChats();
    listenIncomingCalls();
    updateInviteBadge();
    loadCallHistory();
    if (window.innerWidth >= 1024) {
      document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
      $('viewChats').classList.add('active');
      const ph = $('viewDesktopPlaceholder');
      if (ph) ph.classList.add('active');
    }
    // Check if lock is enabled
    setTimeout(() => {
      const cfg = _getLockConfig();
      const settings = JSON.parse(localStorage.getItem(getSettingsKey()) || '{}');
      if (cfg && settings.appLock) showLockScreen();
    }, 500);
  }
})();

async function initUser() {
  const uid = currentUser.uid;
  window.__demoData.users[uid] = {
    izahoId: currentUser.izahoId,
    name: currentUser.displayName || 'Utilisateur',
    photoURL: '',
    online: true,
    lastSeen: new Date(),
  };
}

// ─── PROFILE ───
function loadProfile() {
  if (!currentUser) return;
  $('profilePhone').textContent = currentUser.izahoId || '';
  $('profileName').value = currentUser.displayName || 'Test';
  $('profileAvatarText').textContent = (currentUser.displayName || 'T')[0].toUpperCase();
  loadBlockedList();

  if (currentUser.uid && currentUser._local) return;

  try {
    db.collection('users').doc(currentUser.uid).get().then(doc => {
      if (doc.exists) {
        const d = doc.data();
        $('profileName').value = d.name || '';
        const avatar = $('profileAvatar');
        const text = $('profileAvatarText');
        const img = $('profileAvatarImg');
        if (d.photoURL) {
          img.src = d.photoURL;
          img.style.display = 'block';
          text.style.display = 'none';
        } else {
          img.style.display = 'none';
          text.style.display = 'block';
          text.textContent = (d.name || 'U')[0].toUpperCase();
        }
      }
    });
  } catch (e) {}
}

async function updateProfile() {
  const name = $('profileName').value.trim();
  if (!name) { showToast('Entrez un nom'); return; }
  loading(true);
  try {
    if (currentUser.uid && currentUser._local) {
      currentUser.displayName = name;
      const registry = _registry();
      if (registry[currentUser.uid]) { registry[currentUser.uid].name = name; _saveRegistry(registry); }
      const session = JSON.parse(localStorage.getItem('izaho_session') || '{}');
      session.name = name;
      localStorage.setItem('izaho_session', JSON.stringify(session));
      showToast('Nom mis à jour');
      loading(false);
      return;
    }
    await db.collection('users').doc(currentUser.uid).update({ name });
    showToast('Profil mis à jour');
  } catch (e) { showToast('Erreur: ' + e.message); }
  loading(false);
}

async function uploadProfilePhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (currentUser.uid && currentUser._local) {
    showToast('Photo non disponible (mode local)');
    return;
  }
  loading(true);
  try {
    const ref = storage.ref(`profiles/${currentUser.uid}`);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection('users').doc(currentUser.uid).update({ photoURL: url });
    showToast('Photo mise à jour');
    loadProfile();
  } catch (e) { showToast('Erreur: ' + e.message); }
  loading(false);
}

// ─── CHATS ───
function _getChats() {
  try { return JSON.parse(localStorage.getItem('izaho_chats_' + currentUser.uid) || '[]'); } catch (_) { return []; }
}
function _saveChats(list) {
  localStorage.setItem('izaho_chats_' + currentUser.uid, JSON.stringify(list));
}
function _getMessages(chatId) {
  try { return JSON.parse(localStorage.getItem('izaho_msgs_' + chatId) || '[]'); } catch (_) { return []; }
}
function _saveMessages(chatId, msgs) {
  localStorage.setItem('izaho_msgs_' + chatId, JSON.stringify(msgs));
}

function loadChats() {
  loadGroupsInChats();
  const list = $('chatList');
  list.innerHTML = '';

  const chats = _getChats();
  if (chats.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><i class="fas fa-comment-dots" style="font-size:48px;margin-bottom:12px;display:block"></i>Aucune conversation<br/><span style="font-size:13px">Ajoutez des contacts pour discuter</span></div>';
    setTimeout(() => loadContacts(), 300);
    return;
  }

  const registry = _registry();
  const sorted = [...chats].sort((a, b) => (b.lastMessageAt || '').localeCompare(a.lastMessageAt || ''));
  sorted.forEach(chat => {
    const otherId = chat.otherId;
    const userData = registry[otherId] || {};
    const name = chat.otherName || userData.name || otherId;
    const isGroup = chat.isGroup;
    const isCommunity = chat.isCommunity;
    let initial = name[0].toUpperCase();
    let avatarClass = '';
    if (isCommunity) { initial = '🌍'; avatarClass = 'avatar-community'; }
    else if (isGroup) { initial = '👥'; avatarClass = 'avatar-group'; }
    const time = chat.lastMessageAt ? formatTime(new Date(chat.lastMessageAt)) : '';

    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="avatar ${avatarClass}">${initial}</div>
      <div class="item-info">
        <div class="item-name">${name}</div>
        <div class="item-preview">${chat.lastMessage || ''}</div>
      </div>
      <div class="item-time">${time}</div>
    `;
    el.onclick = isGroup ? () => openGroupChat(chat.chatId) : () => openChat(chat.chatId, otherId, name);
    list.appendChild(el);
  });
}

function filterChats(query) {
  const items = $('chatList').querySelectorAll('.list-item');
  items.forEach(item => {
    const name = item.querySelector('.item-name').textContent.toLowerCase();
    item.style.display = name.includes(query.toLowerCase()) ? '' : 'none';
  });
}

// ─── OPEN CHAT ───
async function openChat(chatId, otherId, otherName) {
  currentChatId = chatId;
  currentChatUser = { id: otherId, name: otherName };

  $('chatHeaderName').textContent = otherName;
  $('chatHeaderStatus').textContent = 'en ligne';
  $('viewChat').dataset.chatId = chatId;
  $('chatMessages').innerHTML = '';
  applyWallpaper((JSON.parse(localStorage.getItem(getSettingsKey()) || '{}').wallpaper) || 'default');

  // Afficher la vue chat
  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop) {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    // viewChats reste visible dans la sidebar
    $('viewChats').classList.add('active');
    $('viewChat').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navChats = document.querySelector(`.nav-item[data-view="chats"]`);
    if (navChats) navChats.classList.add('active');
  } else {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    $('viewChat').classList.add('active');
    $('appScreen').querySelector('.app-header').style.display = 'none';
    $('appScreen').querySelector('.bottom-nav').style.display = 'none';
  }

  // Local mode: load stored messages
  if (currentUser.uid && currentUser._local) {
    const container = $('chatMessages');
    const msgs = _getMessages(chatId);
    msgs.forEach(m => {
      appendMessage({ ...m, createdAt: { toDate: () => new Date(m.createdAt) } }, 'msg_' + m.createdAt);
    });
    container.scrollTop = container.scrollHeight;
    updateBlockedUI();
    return;
  }

  // Firebase fallback
  if (messagesUnsub) messagesUnsub();
  try {
    messagesUnsub = db.collection('chats').doc(chatId).collection('messages').orderBy('createdAt').limit(100).onSnapshot(snapshot => {
      const container = $('chatMessages');
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') { appendMessage(change.doc.data(), change.doc.id); }
      });
      container.scrollTop = container.scrollHeight;
    });
    db.collection('users').doc(otherId).onSnapshot(doc => {
      if (doc.exists) { $('chatHeaderStatus').textContent = doc.data().online ? 'en ligne' : 'hors ligne'; }
    });
    updateBlockedUI();
  } catch (e) {
    $('chatHeaderStatus').textContent = 'hors ligne';
    updateBlockedUI();
  }
}

function closeChat() {
  currentChatId = null;
  currentChatUser = null;
  if (messagesUnsub) { messagesUnsub(); messagesUnsub = null; }
  $('appScreen').querySelector('.app-header').style.display = '';
  $('appScreen').querySelector('.bottom-nav').style.display = '';
  // Restore chat header buttons
  const actions = $('viewChat').querySelector('.chat-header-actions');
  if (actions) {
    actions.querySelectorAll('.header-btn').forEach(b => { b.style.display = ''; });
    const mBtn = document.getElementById('groupMembersBtn');
    if (mBtn) mBtn.style.display = 'none';
  }
  $('chatBlockBtn').style.display = '';
  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop) {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    $('viewChats').classList.add('active');
    $('viewDesktopPlaceholder').classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navChats = document.querySelector(`.nav-item[data-view="chats"]`);
    if (navChats) navChats.classList.add('active');
  } else {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    $('viewChats').classList.add('active');
  }
}

function appendMessage(msg, msgId) {
  const isOut = msg.from === currentUser.uid;
  const container = $('chatMessages');
  const div = document.createElement('div');
  div.className = `message ${isOut ? 'out' : 'in'}`;
  div.id = 'msg-' + msgId;

  let content = '';
  if (msg.type === 'text') {
    content = msg.text || '';
  } else if (msg.type === 'image') {
    content = `<img src="${msg.url}" class="msg-media" loading="lazy" />`;
  } else if (msg.type === 'video') {
    content = `<video src="${msg.url}" class="msg-media" controls></video>`;
  } else if (msg.type === 'voice') {
    content = `<div class="msg-voice" onclick="playVoice('${msg.url}')"><i class="fas fa-play-circle"></i> Message vocal</div>`;
  }

  const time = msg.createdAt ? formatTime(msg.createdAt.toDate()) : '';
  const check = isOut ? ' <i class="fas fa-check-double"></i>' : '';
  div.innerHTML = `${content}<div class="msg-time">${time}${check}</div>`;
  container.appendChild(div);
}

// ─── SEND MESSAGE ───
async function sendMessage() {
  const input = $('chatInput');
  let text = input.value.trim();
  if (!text || !currentChatId) return;
  // Anti-phishing : filtrer les liens malveillants
  text = _scanAndFilterMessage(text);
  input.value = '';

  // Local mode: save to localStorage
  if (currentUser.uid && currentUser._local) {
    const msg = { from: currentUser.uid, text, type: 'text', createdAt: new Date().toISOString() };
    const msgs = _getMessages(currentChatId);
    msgs.push(msg);
    _saveMessages(currentChatId, msgs);
    appendMessage({ ...msg, createdAt: { toDate: () => new Date(msg.createdAt) } }, 'msg_' + Date.now());
    // Update chat preview
    const chats = _getChats();
    const chat = chats.find(c => c.chatId === currentChatId);
    if (chat) { chat.lastMessage = text; chat.lastMessageAt = new Date().toISOString(); _saveChats(chats); }
    // Simulate auto-reply
    setTimeout(() => {
      const replies = ['Ok', 'Super !', 'D\'accord', '👍', 'Intéressant', 'Je vois', 'Cool', 'Merci'];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      const replyMsg = { from: currentChatUser.id, text: reply, type: 'text', createdAt: new Date().toISOString() };
      const msgs2 = _getMessages(currentChatId);
      msgs2.push(replyMsg);
      _saveMessages(currentChatId, msgs2);
      appendMessage({ ...replyMsg, createdAt: { toDate: () => new Date(replyMsg.createdAt) } }, 'msg_' + Date.now());
      const chat2 = _getChats().find(c => c.chatId === currentChatId);
      if (chat2) { chat2.lastMessage = reply; chat2.lastMessageAt = replyMsg.createdAt; _saveChats(_getChats()); }
      $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    }, 1200 + Math.random() * 1500);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
    return;
  }

  try {
    await db.collection('chats').doc(currentChatId).collection('messages').add({ from: currentUser.uid, text, type: 'text', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await db.collection('chats').doc(currentChatId).update({ lastMessage: text, lastMessageAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (e) { showToast('Erreur: ' + e.message); }
}

// ─── MEDIA ───
function showAttachMenu() {
  const menu = $('attachMenu');
  menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function sendPhoto() {
  $('attachMenu').style.display = 'none';
  const input = $('chatFileInput');
  input.accept = 'image/*';
  input.click();
}

function sendVideo() {
  $('attachMenu').style.display = 'none';
  const input = $('chatFileInput');
  input.accept = 'video/*';
  input.click();
}

async function sendFile(e) {
  const file = e.target.files[0];
  if (!file || !currentChatId) return;
  $('attachMenu').style.display = 'none';
  loading(true);

  const type = file.type.startsWith('video') ? 'video' : 'image';

  if (currentUser._local) {
    const reader = new FileReader();
    reader.onload = function(ev) {
      const url = ev.target.result;
      const msg = { from: currentUser.uid, url, type, createdAt: new Date().toISOString() };
      const msgs = _getMessages(currentChatId);
      msgs.push(msg);
      _saveMessages(currentChatId, msgs);
      appendMessage({ ...msg, createdAt: { toDate: () => new Date(msg.createdAt) } }, 'msg_' + Date.now());
      const chats = _getChats();
      const chat = chats.find(c => c.chatId === currentChatId);
      if (chat) { chat.lastMessage = type === 'image' ? '📷 Photo' : '🎬 Vidéo'; chat.lastMessageAt = new Date().toISOString(); _saveChats(chats); }
      showToast(type === 'image' ? 'Photo envoyée' : 'Vidéo envoyée');
      loading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    return;
  }

  const path = `chats/${currentChatId}/${Date.now()}_${file.name}`;
  const ref = storage.ref(path);

  try {
    const task = await ref.put(file);
    const url = await ref.getDownloadURL();
    await db.collection('chats').doc(currentChatId).collection('messages').add({
      from: currentUser.uid,
      url,
      type,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('chats').doc(currentChatId).update({
      lastMessage: type === 'image' ? '📷 Photo' : '🎬 Vidéo',
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast(type === 'image' ? 'Photo envoyée' : 'Vidéo envoyée');
  } catch (e) { showToast('Erreur: ' + e.message); }
  loading(false);
  e.target.value = '';
}

// ─── VOICE ───
async function sendVoice() {
  $('attachMenu').style.display = 'none';
  if (!navigator.mediaDevices) { showToast('Enregistrement non supporté'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      if (blob.size < 1000) { showToast('Message trop court'); return; }
      loading(true);

      if (currentUser._local) {
        const reader = new FileReader();
        reader.onload = function(ev) {
          const url = ev.target.result;
          const msg = { from: currentUser.uid, url, type: 'voice', createdAt: new Date().toISOString() };
          const msgs = _getMessages(currentChatId);
          msgs.push(msg);
          _saveMessages(currentChatId, msgs);
          appendMessage({ ...msg, createdAt: { toDate: () => new Date(msg.createdAt) } }, 'msg_' + Date.now());
          const chats = _getChats();
          const chat = chats.find(c => c.chatId === currentChatId);
          if (chat) { chat.lastMessage = '🎤 Message vocal'; chat.lastMessageAt = new Date().toISOString(); _saveChats(chats); }
          showToast('Message vocal envoyé');
          loading(false);
        };
        reader.readAsDataURL(blob);
        return;
      }

      const path = `chats/${currentChatId}/voice_${Date.now()}.webm`;
      const ref = storage.ref(path);
      try {
        await ref.put(blob);
        const url = await ref.getDownloadURL();
        await db.collection('chats').doc(currentChatId).collection('messages').add({
          from: currentUser.uid,
          url,
          type: 'voice',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        await db.collection('chats').doc(currentChatId).update({
          lastMessage: '🎤 Message vocal',
          lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast('Message vocal envoyé');
      } catch (e) { showToast('Erreur: ' + e.message); }
      loading(false);
    };
    mediaRecorder.start();
    showToast('Enregistrement... Parlez');
    setTimeout(() => { if (mediaRecorder && mediaRecorder.state === 'recording') { mediaRecorder.stop(); showToast('Vocal terminé'); } }, 7000);
  } catch (e) { showToast('Microphone requis'); }
}

function playVoice(url) {
  const audio = new Audio(url);
  audio.play();
}

// ─── CONTACTS ───
function loadContacts() {
  const list = $('contactList');
  list.innerHTML = '';

  const contacts = _getContacts();
  if (contacts.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><i class="fas fa-address-book" style="font-size:48px;margin-bottom:12px;display:block"></i>Aucun contact<br/><span style="font-size:13px">Ajoutez vos contacts pour discuter</span></div>';
    return;
  }

  const registry = _registry();
  contacts.forEach(c => {
    const userData = registry[c.contactId] || {};
    const displayName = c.name || userData.name || c.contactId;
    const izahoId = userData.country ? '+' + userData.country + ' ' + userData.personalId : c.contactId;
    const initial = displayName[0].toUpperCase();
    const blocked = getBlockedList();
    const isB = blocked.includes(c.contactId);

    const el = document.createElement('div');
    el.className = 'list-item';
    el.style.opacity = isB ? '0.4' : '1';
    el.innerHTML = `
      <div class="avatar" style="${isB ? 'filter:grayscale(1)' : ''}">${initial}</div>
      <div class="item-info">
        <div class="item-name">${displayName} ${isB ? '<span style="color:#ff6b6b;font-size:11px">(bloqué)</span>' : ''}</div>
        <div class="item-preview">${izahoId}</div>
      </div>
      <button class="btn btn-sm ${isB ? 'btn-ghost' : 'btn-primary'}" onclick="event.stopPropagation();quickBlockContact('${c.contactId}','${displayName}')" style="font-size:11px;padding:4px 8px">
        <i class="fas ${isB ? 'fa-undo' : 'fa-ban'}"></i>
      </button>
    `;
    el.onclick = () => startOrOpenChat(c.contactId, displayName);
    list.appendChild(el);
  });
}

function showAddContact() {
  $('addContactPanel').style.display = 'block';
  $('contactPhone').focus();
}

function hideAddContact() {
  $('addContactPanel').style.display = 'none';
  $('contactId').value = '';
  $('contactName').value = '';
}

function _getContacts() {
  try { return JSON.parse(localStorage.getItem('izaho_contacts_' + currentUser.uid) || '[]'); } catch (_) { return []; }
}
function _saveContacts(list) {
  localStorage.setItem('izaho_contacts_' + currentUser.uid, JSON.stringify(list));
}

async function addContact() {
  const country = $('contactCountry').value;
  const personalId = $('contactId').value.trim();
  const name = $('contactName').value.trim();
  if (!personalId || personalId.length !== 5 || !/^\d{5}$/.test(personalId)) { showToast('Identifiant invalide (5 chiffres)'); return; }
  if (!name) { showToast('Entrez un nom'); return; }
  const contactUid = country + '_' + personalId;
  if (contactUid === currentUser.uid) { showToast('Impossible de s\'ajouter soi-même'); return; }
  const registry = _registry();
  if (!registry[contactUid]) { showToast('Identifiant introuvable dans le réseau'); return; }
  const contacts = _getContacts();
  if (contacts.find(c => c.contactId === contactUid)) { showToast('Déjà dans vos contacts'); return; }
  contacts.push({ contactId: contactUid, name, addedAt: new Date().toISOString() });
  _saveContacts(contacts);
  showToast('Contact ajouté');
  hideAddContact();
  loadContacts();
}

async function startOrOpenChat(contactId, name) {
  const chatId = [currentUser.uid, contactId].sort().join('_');

  if (currentUser.uid && currentUser._local) {
    const chats = _getChats();
    if (!chats.find(c => c.chatId === chatId)) {
      chats.push({ chatId, otherId: contactId, otherName: name, lastMessage: '', lastMessageAt: new Date().toISOString() });
      _saveChats(chats);
    }
    openChat(chatId, contactId, name);
    return;
  }

  try {
    const ref = db.collection('chats').doc(chatId);
    const doc = await ref.get();
    if (!doc.exists) {
      await ref.set({ participants: [currentUser.uid, contactId], lastMessage: '', lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(), createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  } catch (e) {}
  openChat(chatId, contactId, name);
}

// ─── GROUPES ───
let __pendingGroupMembers = [];

function _getGroups() {
  try { return JSON.parse(localStorage.getItem('izaho_groups_' + currentUser.uid) || '[]'); } catch (_) { return []; }
}
function _saveGroups(list) {
  localStorage.setItem('izaho_groups_' + currentUser.uid, JSON.stringify(list));
}
function _getGroupMessages(groupId) {
  try { return JSON.parse(localStorage.getItem('izaho_gmsgs_' + groupId) || '[]'); } catch (_) { return []; }
}
function _saveGroupMessages(groupId, msgs) {
  localStorage.setItem('izaho_gmsgs_' + groupId, JSON.stringify(msgs));
}
function _getInvitations() {
  try { return JSON.parse(localStorage.getItem('izaho_invites_' + currentUser.uid) || '[]'); } catch (_) { return []; }
}
function _saveInvitations(list) {
  localStorage.setItem('izaho_invites_' + currentUser.uid, JSON.stringify(list));
}

function showCreateGroup() {
  $('createGroupPanel').style.display = 'block';
  $('groupNameInput').focus();
  __pendingGroupMembers = [];
  $('groupMembersList').textContent = '';
}

function hideCreateGroup() {
  $('createGroupPanel').style.display = 'none';
  $('groupNameInput').value = '';
  $('groupMemberId').value = '';
  __pendingGroupMembers = [];
  $('groupMembersList').textContent = '';
}

function addGroupMember() {
  const country = $('groupCountry').value;
  const personalId = $('groupMemberId').value.trim();
  if (!personalId || personalId.length !== 5 || !/^\d{5}$/.test(personalId)) { showToast('ID invalide (5 chiffres)'); return; }
  const uid = country + '_' + personalId;
  if (uid === currentUser.uid) { showToast('Impossible de s\'ajouter soi-même'); return; }
  if (__pendingGroupMembers.find(m => m.uid === uid)) { showToast('Déjà ajouté'); return; }
  const registry = _registry();
  const userData = registry[uid] || { name: uid };
  __pendingGroupMembers.push({ uid, name: userData.name || uid, country, personalId });
  $('groupMemberId').value = '';
  let html = '';
  __pendingGroupMembers.forEach(m => {
    html += '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--surface);border-radius:8px;padding:4px 8px;margin:2px;font-size:12px">👤 ' + m.name + ' <span style="color:var(--accent);cursor:pointer" onclick="removeGroupMember(\'' + m.uid + '\')">✕</span></span>';
  });
  $('groupMembersList').innerHTML = html;
}

function removeGroupMember(uid) {
  __pendingGroupMembers = __pendingGroupMembers.filter(m => m.uid !== uid);
  let html = '';
  __pendingGroupMembers.forEach(m => {
    html += '<span style="display:inline-flex;align-items:center;gap:4px;background:var(--surface);border-radius:8px;padding:4px 8px;margin:2px;font-size:12px">👤 ' + m.name + ' <span style="color:var(--accent);cursor:pointer" onclick="removeGroupMember(\'' + m.uid + '\')">✕</span></span>';
  });
  $('groupMembersList').innerHTML = html;
}

function createGroup() {
  const name = $('groupNameInput').value.trim();
  if (!name) { showToast('Entrez un nom de groupe'); return; }
  if (__pendingGroupMembers.length === 0) { showToast('Ajoutez au moins un membre'); return; }
  const groupId = 'g_' + currentUser.uid + '_' + Date.now();
  const members = [currentUser.uid, ...__pendingGroupMembers.map(m => m.uid)];
  const group = { groupId, name, members, createdBy: currentUser.uid, createdAt: new Date().toISOString(), lastMessage: '', lastMessageAt: new Date().toISOString(), isCommunity: false };
  const myGroups = _getGroups();
  myGroups.push(group);
  _saveGroups(myGroups);
  // Add to chats list
  const chats = _getChats();
  if (!chats.find(c => c.chatId === groupId)) {
    chats.push({ chatId: groupId, otherId: groupId, otherName: '👥 ' + name, lastMessage: 'Groupe créé', lastMessageAt: new Date().toISOString(), isGroup: true });
    _saveChats(chats);
  }
  // Send invitations to each member
  const registry = _registry();
  __pendingGroupMembers.forEach(m => {
    if (!registry[m.uid]) return;
    const invites = _getInvitationsFor(m.uid);
    invites.push({ id: groupId + '_' + m.uid, groupId, groupName: name, from: currentUser.uid, fromName: currentUser.displayName, status: 'pending', createdAt: new Date().toISOString() });
    _saveInvitationsFor(m.uid, invites);
  });
  // System message
  const msgs = _getGroupMessages(groupId);
  msgs.push({ from: 'system', text: currentUser.displayName + ' a créé le groupe', type: 'text', createdAt: new Date().toISOString(), system: true });
  _saveGroupMessages(groupId, msgs);
  showToast('✅ Groupe "' + name + '" créé');
  hideCreateGroup();
  loadChats();
  updateInviteBadge();
}

function _getInvitationsFor(uid) {
  try { return JSON.parse(localStorage.getItem('izaho_invites_' + uid) || '[]'); } catch (_) { return []; }
}
function _saveInvitationsFor(uid, list) {
  localStorage.setItem('izaho_invites_' + uid, JSON.stringify(list));
}

function loadGroupsInChats() {
  const groups = _getGroups();
  const chats = _getChats();
  groups.forEach(g => {
    if (!chats.find(c => c.chatId === g.groupId)) {
      chats.push({ chatId: g.groupId, otherId: g.groupId, otherName: '👥 ' + g.name, lastMessage: g.lastMessage || '', lastMessageAt: g.lastMessageAt || g.createdAt, isGroup: true });
    } else {
      const c = chats.find(c => c.chatId === g.groupId);
      if (c && !c.isGroup) { c.isGroup = true; c.otherName = '👥 ' + g.name; }
    }
  });
  _saveChats(chats);
}

function openGroupChat(groupId) {
  const groups = _getGroups();
  const group = groups.find(g => g.groupId === groupId);
  if (!group) { showToast('Groupe introuvable'); return; }
  currentChatId = groupId;
  currentChatUser = { id: groupId, name: group.name, isGroup: true, members: group.members || [] };
  $('chatHeaderName').textContent = '👥 ' + group.name;
  $('chatHeaderStatus').textContent = (group.members ? group.members.length : 1) + ' membre(s)';
  $('viewChat').dataset.chatId = groupId;
  $('chatMessages').innerHTML = '';
  applyWallpaper((JSON.parse(localStorage.getItem(getSettingsKey()) || '{}').wallpaper) || 'default');

  // Add members button in header
  let membersBtn = document.getElementById('groupMembersBtn');
  if (!membersBtn) {
    membersBtn = document.createElement('button');
    membersBtn.id = 'groupMembersBtn';
    membersBtn.className = 'header-btn';
    membersBtn.innerHTML = '<i class="fas fa-users"></i>';
    membersBtn.title = 'Membres';
    membersBtn.onclick = () => showGroupMembers(groupId);
    const actions = $('viewChat').querySelector('.chat-header-actions');
    if (actions) actions.prepend(membersBtn);
  }
  membersBtn.style.display = 'flex';

  // Add conference button
  let confBtn = document.getElementById('conferenceBtn_' + groupId);
  if (!confBtn) {
    confBtn = document.createElement('button');
    confBtn.id = 'conferenceBtn_' + groupId;
    confBtn.className = 'header-btn';
    confBtn.innerHTML = '<i class="fas fa-phone"></i>';
    confBtn.title = 'Conférence';
    confBtn.onclick = function() {
      var confs = _getConferences();
      var conf = confs[groupId];
      if (!conf || !conf.active) {
        if (confirm('Démarrer une conférence audio ?')) startConference(groupId);
      } else {
        if (conf.participants.indexOf(currentUser.uid) === -1) joinConference(groupId);
        else toggleConferenceOverlay(groupId);
      }
    };
    const actions = $('viewChat').querySelector('.chat-header-actions');
    if (actions) actions.appendChild(confBtn);
  }
  confBtn.style.display = 'flex';

  // Hide call buttons for groups
  const callBtns = $('viewChat').querySelectorAll('.chat-header-actions .header-btn');
  callBtns.forEach(b => { if (b.id !== 'groupMembersBtn' && b.id.indexOf('conferenceBtn_') === -1) b.style.display = 'none'; });
  $('chatBlockBtn').style.display = 'none';

  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop) {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    $('viewChats').classList.add('active');
    $('viewChat').classList.add('active');
  } else {
    document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
    $('viewChat').classList.add('active');
    $('appScreen').querySelector('.app-header').style.display = 'none';
    $('appScreen').querySelector('.bottom-nav').style.display = 'none';
  }

  // Load messages
  const container = $('chatMessages');
  const msgs = _getGroupMessages(groupId);
  msgs.forEach(m => {
    const isOut = m.from === currentUser.uid;
    const div = document.createElement('div');
    if (m.system) {
      div.className = 'message system';
      div.textContent = m.text;
    } else {
      div.className = 'message ' + (isOut ? 'out' : 'in');
      const registry = _registry();
      const senderName = m.from === currentUser.uid ? '' : (registry[m.from] ? registry[m.from].name || m.from : m.from);
      const displayName = m.from === currentUser.uid ? '' : '<div style="font-size:11px;color:var(--primary-to);font-weight:600;margin-bottom:2px">' + senderName + '</div>';
      const time = m.createdAt ? formatTime(new Date(m.createdAt)) : '';
      const check = isOut ? ' <i class="fas fa-check-double"></i>' : '';
      div.innerHTML = displayName + (m.text || '') + '<div class="msg-time">' + time + check + '</div>';
    }
    container.appendChild(div);
  });
  container.scrollTop = container.scrollHeight;
}

function sendGroupMessage() {
  const input = $('chatInput');
  let text = input.value.trim();
  if (!text || !currentChatId || !currentChatUser || !currentChatUser.isGroup) return;
  // Anti-phishing : filtrer les liens malveillants
  text = _scanAndFilterMessage(text);
  input.value = '';
  const msg = { from: currentUser.uid, text, type: 'text', createdAt: new Date().toISOString(), system: false };
  const msgs = _getGroupMessages(currentChatId);
  msgs.push(msg);
  _saveGroupMessages(currentChatId, msgs);
  // Display
  const container = $('chatMessages');
  const div = document.createElement('div');
  div.className = 'message out';
  const time = formatTime(new Date());
  div.innerHTML = (msg.text || '') + '<div class="msg-time">' + time + ' <i class="fas fa-check-double"></i></div>';
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  // Update group lastMessage
  const groups = _getGroups();
  const group = groups.find(g => g.groupId === currentChatId);
  if (group) { group.lastMessage = text; group.lastMessageAt = new Date().toISOString(); _saveGroups(groups); }
  // Update chat list
  const chats = _getChats();
  const chat = chats.find(c => c.chatId === currentChatId);
  if (chat) { chat.lastMessage = text; chat.lastMessageAt = new Date().toISOString(); _saveChats(chats); }
}

// Override sendMessage for groups
const __origSendMessage = sendMessage;
sendMessage = function() {
  if (currentChatUser && currentChatUser.isGroup) { sendGroupMessage(); return; }
  __origSendMessage();
};

// ─── INVITATIONS ───
function updateInviteBadge() {
  const invites = _getInvitations().filter(i => i.status === 'pending');
  const badge = $('inviteBadge');
  if (invites.length > 0) {
    badge.textContent = invites.length;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

function showInvitations() {
  const invites = _getInvitations().filter(i => i.status === 'pending');
  $('inviteCountLabel').textContent = invites.length + ' en attente';
  const list = $('inviteList');
  list.innerHTML = '';
  if (invites.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:14px">Aucune invitation</p>';
  } else {
    invites.forEach(inv => {
      const el = document.createElement('div');
      el.className = 'invite-item';
      el.innerHTML = '<div class="invite-item-info"><div class="invite-item-title">' + inv.groupName + '</div><div class="invite-item-from">de ' + inv.fromName + '</div></div><div class="invite-item-actions"><button class="invite-btn-accept" onclick="acceptInvitation(\'' + inv.id + '\')">Accepter</button><button class="invite-btn-decline" onclick="declineInvitation(\'' + inv.id + '\')">Refuser</button></div>';
      list.appendChild(el);
    });
  }
  $('inviteOverlay').style.display = 'flex';
}

function hideInvitations() {
  $('inviteOverlay').style.display = 'none';
}

function acceptInvitation(inviteId) {
  const invites = _getInvitations();
  const inv = invites.find(i => i.id === inviteId);
  if (!inv) return;
  inv.status = 'accepted';
  _saveInvitations(invites);
  // Add user to group
  const allGroups = JSON.parse(localStorage.getItem('izaho_groups_' + currentUser.uid) || '[]');
  // Check if there's a global group registry
  const globalGroups = JSON.parse(localStorage.getItem('izaho_global_groups') || '{}');
  if (globalGroups[inv.groupId]) {
    if (!globalGroups[inv.groupId].members.includes(currentUser.uid)) {
      globalGroups[inv.groupId].members.push(currentUser.uid);
    }
  }
  localStorage.setItem('izaho_global_groups', JSON.stringify(globalGroups));
  // Add to my groups
  if (!allGroups.find(g => g.groupId === inv.groupId)) {
    allGroups.push({ groupId: inv.groupId, name: inv.groupName, members: globalGroups[inv.groupId] ? globalGroups[inv.groupId].members : [currentUser.uid], createdBy: '', createdAt: new Date().toISOString(), lastMessage: '', lastMessageAt: new Date().toISOString(), isCommunity: false });
    _saveGroups(allGroups);
  }
  // Add to my chats
  const chats = _getChats();
  if (!chats.find(c => c.chatId === inv.groupId)) {
    chats.push({ chatId: inv.groupId, otherId: inv.groupId, otherName: '👥 ' + inv.groupName, lastMessage: 'Vous avez rejoint le groupe', lastMessageAt: new Date().toISOString(), isGroup: true });
    _saveChats(chats);
  }
  // System message in group
  const msgs = _getGroupMessages(inv.groupId);
  msgs.push({ from: 'system', text: currentUser.displayName + ' a rejoint le groupe', type: 'text', createdAt: new Date().toISOString(), system: true });
  _saveGroupMessages(inv.groupId, msgs);
  showToast('✅ Vous avez rejoint "' + inv.groupName + '"');
  updateInviteBadge();
  loadChats();
}

function declineInvitation(inviteId) {
  const invites = _getInvitations();
  const inv = invites.find(i => i.id === inviteId);
  if (!inv) return;
  inv.status = 'declined';
  _saveInvitations(invites);
  showToast('Invitation refusée');
  showInvitations();
  updateInviteBadge();
}

// ─── GROUP MEMBERS ───
function showGroupMembers(groupId) {
  const allGroups = _getGroups();
  const group = allGroups.find(g => g.groupId === groupId) || JSON.parse(localStorage.getItem('izaho_global_groups') || '{}')[groupId];
  if (!group) { showToast('Groupe introuvable'); return; }
  const members = group.members || [];
  $('groupMembersTitle').textContent = '👥 ' + (group.name || 'Groupe');
  $('groupMembersCount').textContent = members.length + ' membre(s)';
  const list = $('groupMembersListOverlay');
  list.innerHTML = '';
  const registry = _registry();
  members.forEach(uid => {
    const userData = registry[uid] || {};
    const name = userData.name || uid;
    const isMe = uid === currentUser.uid;
    const el = document.createElement('div');
    el.className = 'gmember-item';
    el.innerHTML = '<i class="fas fa-user-circle"></i><span class="gmember-name">' + name + (isMe ? ' (vous)' : '') + '</span>' + (uid === group.createdBy ? '<span class="gmember-tag">Créateur</span>' : '');
    list.appendChild(el);
  });
  $('groupMembersOverlay').style.display = 'flex';
}

function hideGroupMembers() {
  $('groupMembersOverlay').style.display = 'none';
}

// ─── COMMUNAUTÉ ───
function _getCommunities() {
  try { return JSON.parse(localStorage.getItem('izaho_communities') || '[]'); } catch (_) { return []; }
}
function _saveCommunities(list) {
  localStorage.setItem('izaho_communities', JSON.stringify(list));
}

function createCommunity() {
  const name = prompt('Nom de la communauté :');
  if (!name || name.trim().length < 2) { showToast('Nom trop court'); return; }
  const desc = prompt('Description (optionnelle) :');
  const commId = 'comm_' + Date.now();
  const comm = { id: commId, name: name.trim(), desc: desc || '', createdBy: currentUser.uid, createdAt: new Date().toISOString(), members: [currentUser.uid], isCommunity: true };
  const comms = _getCommunities();
  comms.push(comm);
  _saveCommunities(comms);
  // Also add as a group
  const groups = _getGroups();
  groups.push({ groupId: commId, name: '🌍 ' + name, members: [currentUser.uid], createdBy: currentUser.uid, createdAt: new Date().toISOString(), lastMessage: '', lastMessageAt: new Date().toISOString(), isCommunity: true });
  _saveGroups(groups);
  // Add to chats
  const chats = _getChats();
  if (!chats.find(c => c.chatId === commId)) {
    chats.push({ chatId: commId, otherId: commId, otherName: '🌍 ' + name, lastMessage: 'Communauté créée', lastMessageAt: new Date().toISOString(), isGroup: true, isCommunity: true });
    _saveChats(chats);
  }
  showToast('✅ Communauté "' + name + '" créée');
  loadCommunity();
  loadChats();
}

function loadCommunity() {
  const list = $('communityList');
  if (!list) return;
  list.innerHTML = '';
  const comms = _getCommunities();
  if (comms.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-globe" style="font-size:40px;margin-bottom:10px;display:block"></i>Aucune communauté<br><span style="font-size:13px">Créez ou rejoignez une communauté</span></div>';
    return;
  }
  const registry = _registry();
  comms.forEach(c => {
    const isMember = c.members.includes(currentUser.uid);
    const creator = registry[c.createdBy] ? registry[c.createdBy].name : c.createdBy;
    const el = document.createElement('div');
    el.className = 'community-item';
    el.innerHTML = '<div class="avatar avatar-community">🌍</div><div class="community-info"><div class="community-name">' + c.name + '</div><div class="community-desc">' + (c.desc || (isMember ? c.members.length + ' membre(s)' : 'Communauté ouverte')) + '</div></div><div class="community-meta">par ' + creator + '</div>' + (isMember ? '<span class="community-joined">Membre</span>' : '<button class="community-join" onclick="joinCommunity(\'' + c.id + '\')">Rejoindre</button>');
    if (isMember) el.onclick = () => { const groups = _getGroups(); const g = groups.find(gg => gg.groupId === c.id); if (g) openGroupChat(c.id); };
    list.appendChild(el);
  });
}

function joinCommunity(commId) {
  const comms = _getCommunities();
  const comm = comms.find(c => c.id === commId);
  if (!comm) return;
  if (comm.members.includes(currentUser.uid)) { showToast('Déjà membre'); return; }
  comm.members.push(currentUser.uid);
  _saveCommunities(comms);
  // Add to user's groups
  const groups = _getGroups();
  if (!groups.find(g => g.groupId === commId)) {
    groups.push({ groupId: commId, name: '🌍 ' + comm.name, members: comm.members, createdBy: comm.createdBy, createdAt: comm.createdAt, lastMessage: '', lastMessageAt: new Date().toISOString(), isCommunity: true });
    _saveGroups(groups);
  } else {
    const g = groups.find(g => g.groupId === commId);
    if (g && !g.members.includes(currentUser.uid)) g.members.push(currentUser.uid);
    _saveGroups(groups);
  }
  // Add to chats
  const chats = _getChats();
  if (!chats.find(c => c.chatId === commId)) {
    chats.push({ chatId: commId, otherId: commId, otherName: '🌍 ' + comm.name, lastMessage: 'Vous avez rejoint la communauté', lastMessageAt: new Date().toISOString(), isGroup: true, isCommunity: true });
    _saveChats(chats);
  }
  showToast('✅ Vous avez rejoint la communauté "' + comm.name + '"');
  loadCommunity();
  loadChats();
}

// ─── STATUS ───
function _getStatuses() {
  try { return JSON.parse(localStorage.getItem('izaho_statuses') || '[]'); } catch (_) { return []; }
}
function _saveStatuses(list) {
  localStorage.setItem('izaho_statuses', JSON.stringify(list));
}

function loadStatuses() {
  const list = $('statusList');
  list.innerHTML = '';

  const statuses = _getStatuses().filter(s => new Date(s.expiresAt) > new Date() && s.userId !== currentUser.uid);
  if (statuses.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><i class="fas fa-circle" style="font-size:48px;margin-bottom:12px;display:block"></i>Aucun statut<br/><span style="font-size:13px">Publiez votre premier statut</span></div>';
    return;
  }

  const registry = _registry();
  statuses.forEach(data => {
    const userData = registry[data.userId] || {};
    const name = userData.name || data.userId;
    const initial = name[0].toUpperCase();
    const time = data.createdAt ? formatTime(new Date(data.createdAt)) : '';

    const el = document.createElement('div');
    el.className = 'status-item';
    el.innerHTML = `
      <div class="status-avatar">${initial}</div>
      <div class="status-info">
        <div class="status-name">${name}</div>
        <div class="status-time">${time}</div>
      </div>
    `;
    el.onclick = () => viewStatus({ text: data.text, createdAt: data.createdAt }, name);
    list.appendChild(el);
  });
}

async function renderStatusItem(list, data) {
  const userDoc = await db.collection('users').doc(data.userId).get();
  const userData = userDoc.data() || { name: 'Inconnu', photoURL: '' };
  const name = userData.name || data.userId;
  const initial = name[0].toUpperCase();
  const time = data.createdAt ? formatTime(data.createdAt.toDate()) : '';

  const el = document.createElement('div');
  el.className = 'status-item';
  el.innerHTML = `
    <div class="status-avatar">${userData.photoURL ? `<img src="${userData.photoURL}" />` : initial}</div>
    <div class="status-info">
      <div class="status-name">${name}</div>
      <div class="status-time">${time}</div>
    </div>
  `;
  el.onclick = () => viewStatus(data, name);
  list.appendChild(el);
}

function showPostStatus() {
  $('postStatusPanel').style.display = 'block';
  $('statusText').focus();
}

function hidePostStatus() {
  $('postStatusPanel').style.display = 'none';
  $('statusText').value = '';
}

async function postStatus() {
  const text = $('statusText').value.trim();
  if (!text) { showToast('Écrivez quelque chose'); return; }
  if (currentUser.uid && currentUser._local) {
    const statuses = _getStatuses();
    statuses.push({ userId: currentUser.uid, text, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
    _saveStatuses(statuses);
    showToast('Statut publié');
    hidePostStatus();
    return;
  }
  loading(true);
  try {
    const expires = new Date(Date.now() + 86400000);
    await db.collection('status').add({ userId: currentUser.uid, text, createdAt: firebase.firestore.FieldValue.serverTimestamp(), expiresAt: expires });
    showToast('Statut publié');
    hidePostStatus();
  } catch (e) { showToast('Erreur: ' + e.message); }
  loading(false);
}

function viewStatus(data, name) {
  $('statusViewerName').textContent = name;
  let date = data.createdAt;
  if (date && date.toDate) date = date.toDate();
  else if (typeof date === 'string') date = new Date(date);
  $('statusViewerTime').textContent = date ? formatTime(date) : '';
  $('statusViewerText').textContent = data.text;
  $('statusViewerAvatar').textContent = name[0].toUpperCase();
  $('viewStatusOverlay').style.display = 'flex';
}

function closeStatusView() {
  $('viewStatusOverlay').style.display = 'none';
}

// ─── PROXIMITÉ / NEARBY ───
let __nearbyWatchId = null;

function loadNearby() {
  $('nearbyStatus').textContent = 'Recherche des utilisateurs à proximité...';
  $('nearbyList').innerHTML = '';

  if (!navigator.geolocation) {
    $('nearbyStatus').textContent = 'Géolocalisation non supportée';
    _showDemoNearby();
    return;
  }

  // Demo mode: show fake nearby users
  if (currentUser && currentUser.uid && currentUser._local) {
    _showDemoNearby();
    return;
  }

  // Real geolocation
  if (__nearbyWatchId) navigator.geolocation.clearWatch(__nearbyWatchId);
  __nearbyWatchId = navigator.geolocation.watchPosition(
    pos => _fetchNearbyUsers(pos.coords.latitude, pos.coords.longitude),
    err => {
      $('nearbyStatus').textContent = 'Position non disponible. Mode démo activé.';
      _showDemoNearby();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function _showDemoNearby() {
  $('nearbyStatus').textContent = 'Utilisateurs à proximité (simulation)';

  // Generate fake nearby users around Antananarivo
  const baseLat = -18.8792;
  const baseLng = 47.5079;
  const fakeUsers = [
    { name: 'Alice', lat: baseLat + 0.008, lng: baseLng - 0.005, distance: 0.8, status: 'en ligne' },
    { name: 'Bob', lat: baseLat - 0.012, lng: baseLng + 0.010, distance: 1.5, status: 'occupé' },
    { name: 'Claire', lat: baseLat + 0.020, lng: baseLng + 0.015, distance: 2.4, status: 'en ligne' },
    { name: 'David', lat: baseLat - 0.005, lng: baseLng - 0.008, distance: 0.9, status: 'hors ligne' },
    { name: 'Emma', lat: baseLat + 0.030, lng: baseLng - 0.020, distance: 3.6, status: 'en ligne' },
  ];

  _renderNearbyMap(baseLat, baseLng, fakeUsers);
  _renderNearbyList(fakeUsers);
}

async function _fetchNearbyUsers(lat, lng) {
  $('nearbyStatus').textContent = `Position: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;

  // In real mode, this would query Firebase for nearby users
  // For now, generate mock nearby users around the real position
  const mockNearby = [
    { name: 'Utilisateur 1', lat: lat + 0.005, lng: lng + 0.003, distance: 0.5, status: 'en ligne' },
    { name: 'Utilisateur 2', lat: lat - 0.008, lng: lng + 0.006, distance: 1.0, status: 'occupé' },
    { name: 'Utilisateur 3', lat: lat + 0.015, lng: lng - 0.010, distance: 1.8, status: 'hors ligne' },
  ];

  _renderNearbyMap(lat, lng, mockNearby);
  _renderNearbyList(mockNearby);
}

function _renderNearbyMap(lat, lng, users) {
  const canvas = $('nearbyCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#1a2a30';
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.fill();

  // Grid concentric circles
  for (let r = 30; r <= 130; r += 25) {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Center dot (me)
  ctx.fillStyle = '#25d366';
  ctx.shadowColor = '#25d366';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Moi', cx, cy + 22);

  // Other users
  users.forEach((u, i) => {
    const angle = (i / users.length) * Math.PI * 2 - Math.PI / 2;
    const dist = Math.min(u.distance * 25, 110);
    const x = cx + Math.cos(angle) * dist;
    const y = cy + Math.sin(angle) * dist;

    const color = u.status === 'en ligne' ? '#25d366' : u.status === 'occupé' ? '#ff9800' : '#8696a0';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e9edef';
    ctx.font = '10px Inter, sans-serif';
    ctx.fillText(u.name, x, y + 18);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '8px Inter, sans-serif';
    ctx.fillText(u.distance.toFixed(1) + ' km', x, y + 28);
  });
}

function _renderNearbyList(users) {
  const list = $('nearbyList');
  list.innerHTML = '';
  users.forEach(u => {
    const statusColor = u.status === 'en ligne' ? '#25d366' : u.status === 'occupé' ? '#ff9800' : '#8696a0';
    const el = document.createElement('div');
    el.className = 'nearby-user';
    el.innerHTML = `
      <div class="nearby-user-avatar">${u.name[0]}</div>
      <div class="nearby-user-info">
        <div class="nearby-user-name">${u.name}</div>
        <div class="nearby-user-meta">
          <span class="nearby-user-status" style="color:${statusColor}">● ${u.status}</span>
          <span class="nearby-user-dist">${u.distance.toFixed(1)} km</span>
        </div>
      </div>
      <button class="btn btn-sm btn-primary" onclick="startOrOpenChat('${u.name.toLowerCase()}', '${u.name}')">
        <i class="fas fa-comment"></i>
      </button>
    `;
    list.appendChild(el);
  });
}

function refreshNearby() {
  loadNearby();
}

// ─── BLOCK / UNBLOCK ───
function getBlockedList() {
  if (currentUser && currentUser.uid && currentUser._local) {
    return JSON.parse(localStorage.getItem('izaho_blocked_demo') || '[]');
  }
  try {
    return JSON.parse(localStorage.getItem('izaho_blocked_' + currentUser.uid) || '[]');
  } catch (_) { return []; }
}

function saveBlockedList(list) {
  if (currentUser && currentUser.uid && currentUser._local) {
    localStorage.setItem('izaho_blocked_demo', JSON.stringify(list));
  } else {
    try {
      localStorage.setItem('izaho_blocked_' + currentUser.uid, JSON.stringify(list));
    } catch (_) {}
  }
}

function isBlocked(userId) {
  return getBlockedList().includes(userId);
}

function toggleBlockContact() {
  if (!currentChatUser) return;
  const id = currentChatUser.id;
  const name = currentChatUser.name;
  const blocked = getBlockedList();
  const already = blocked.includes(id);

  if (already) {
    if (!confirm(`Débloquer ${name} ?`)) return;
    saveBlockedList(blocked.filter(x => x !== id));
    showToast(`${name} débloqué`);
  } else {
    if (!confirm(`Bloquer ${name} ? Vous ne recevrez plus ses messages.`)) return;
    blocked.push(id);
    saveBlockedList(blocked);
    showToast(`${name} bloqué`);
  }
  updateBlockedUI();
  loadBlockedList();
}

function updateBlockedUI() {
  if (!currentChatUser) return;
  const blocked = getBlockedList();
  const isB = blocked.includes(currentChatUser.id);
  const btn = $('chatBlockBtn');
  if (!btn) return;
  btn.style.color = isB ? '#ff6b6b' : '';
  btn.title = isB ? 'Débloquer' : 'Bloquer';

  // Show/hide blocked banner
  let banner = document.getElementById('blockedBanner');
  if (isB) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'blockedBanner';
      banner.className = 'chat-blocked-banner';
      banner.innerHTML = `<i class="fas fa-ban"></i> Contact bloqué <button onclick="toggleBlockContact()">Débloquer</button>`;
      const msgArea = $('chatMessages');
      if (msgArea && msgArea.parentNode) msgArea.parentNode.insertBefore(banner, msgArea);
    }
  } else {
    if (banner) banner.remove();
  }
}

function loadBlockedList() {
  const container = $('blockedList');
  if (!container) return;
  const blocked = getBlockedList();
  if (blocked.length === 0) {
    container.innerHTML = 'Aucun contact bloqué';
    return;
  }
  container.innerHTML = '';
  const registry = _registry();
  blocked.forEach(id => {
    const userData = registry[id] || {};
    const name = userData.name || id;
    const el = document.createElement('div');
    el.className = 'blocked-user';
    el.innerHTML = `<i class="fas fa-ban"></i> ${name}
      <button class="unblock-btn" onclick="unblockById('${id}')">Débloquer</button>`;
    container.appendChild(el);
  });
}

function quickBlockContact(id, name) {
  const blocked = getBlockedList();
  if (blocked.includes(id)) {
    saveBlockedList(blocked.filter(x => x !== id));
    showToast(`${name} débloqué`);
  } else {
    blocked.push(id);
    saveBlockedList(blocked);
    showToast(`${name} bloqué`);
  }
  loadBlockedList();
  loadContacts();
  if (currentChatUser && currentChatUser.id === id) updateBlockedUI();
}

function unblockById(id) {
  const blocked = getBlockedList().filter(x => x !== id);
  saveBlockedList(blocked);
  showToast('Débloqué');
  loadBlockedList();
  updateBlockedUI();
}

// ─── WEBRTC HELPERS ───
async function createPeerConnection() {
  pc = new RTCPeerConnection(ICE_SERVERS);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  remoteStream = new MediaStream();
  $('remoteVideo').srcObject = remoteStream;

  pc.ontrack = e => {
    e.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
  };

  pc.onicecandidate = e => {
    if (e.candidate && callDocRef) {
      const isCaller = callDocRef.id === currentCallDocId;
      const col = isCaller ? 'callerCandidates' : 'calleeCandidates';
      callDocRef.collection(col).add(e.candidate.toJSON());
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
      endCall();
    }
  };
}

let currentCallDocId = null;

async function startCall(type) {
  if (!currentChatUser) return;
  const otherId = currentChatUser.id;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    });
  } catch (e) {
    showToast('Accès caméra/micro refusé');
    return;
  }

  isVideoEnabled = type === 'video';
  showCallUI(type);

  const localVideo = $('localVideo');
  localVideo.srcObject = localStream;

  const callData = {
    callerId: currentUser.uid,
    calleeId: otherId,
    type,
    status: 'ringing',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    callDocRef = await db.collection('calls').add(callData);
    currentCallDocId = callDocRef.id;

    await createPeerConnection();
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await callDocRef.update({ offer: { type: offer.type, sdp: offer.sdp } });

    // Écouter la réponse du callee
    callUnsub = callDocRef.onSnapshot(snapshot => {
      const data = snapshot.data();
      if (!data) return;
      if (data.answer && !pc.currentRemoteDescription) {
        const answer = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answer);
      }
      if (data.status === 'ended') {
        endCall();
      }
    });

    // Écouter les ICE candidates du callee
    calleeCandidatesUnsub = callDocRef.collection('calleeCandidates')
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added' && pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
          }
        });
      });

    showToast(type === 'video' ? '📹 Appel vidéo...' : '🔊 Appel audio...');
  } catch (e) {
    showToast('Erreur appel: ' + e.message);
    cleanupCall();
  }
  // Enregistrer dans l'historique
  if (currentChatUser) {
    _recordCall(currentChatUser.id, currentChatUser.name, type, 'outgoing', 'placed');
  }
}

function showCallUI(type) {
  isMuted = false;
  isSpeaker = false;
  isVideoEnabled = type === 'video';
  $('callName').textContent = currentChatUser.name;
  $('callAvatar').textContent = currentChatUser.name[0].toUpperCase();
  $('callStatus').textContent = 'Sonnerie...';
  $('callDuration').textContent = '00:00';
  $('callOverlay').style.display = 'flex';
  $('callScreen').style.display = 'block';
  $('localVideo').style.display = type === 'video' ? 'block' : 'none';
  $('remoteVideo').style.display = 'none';
  $('callBtnVideo').style.display = type === 'video' ? 'flex' : 'none';
  if (type === 'audio') {
    $('remoteVideo').style.display = 'none';
  }
  _updateCallBtnState();
}

function startAudioCall() { startCall('audio'); }
function startVideoCall() { startCall('video'); }

// ─── INCOMING CALL LISTENER ───
function listenIncomingCalls() {
  if (typeof db === 'undefined' || !db) return;
  if (incomingCallUnsub) incomingCallUnsub();
  incomingCallUnsub = db.collection('calls')
    .where('calleeId', '==', currentUser ? currentUser.uid : 'none')
    .where('status', '==', 'ringing')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          if (data.callerId === currentUser.uid) return;
          pendingCallDocId = change.doc.id;
          callDocRef = change.doc.ref;
          currentCallDocId = change.doc.id;

          db.collection('users').doc(data.callerId).get().then(doc => {
            const callerName = doc.data()?.name || 'Inconnu';
            $('incomingName').textContent = callerName;
            $('incomingAvatar').textContent = callerName[0].toUpperCase();
            $('incomingType').textContent = data.type === 'video' ? 'Appel vidéo entrant...' : 'Appel audio entrant...';
            $('incomingOverlay').style.display = 'flex';
          });
        }
      });
    });
}

async function answerCall() {
  if (!pendingCallDocId) return;
  $('incomingOverlay').style.display = 'none';

  const doc = await callDocRef.get();
  const data = doc.data();
  if (!data) return;

  const isVideo = data.type === 'video';
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: isVideo
    });
  } catch (e) {
    showToast('Accès refusé');
    return;
  }

  isVideoEnabled = isVideo;
  $('callName').textContent = $('incomingName').textContent;
  $('callAvatar').textContent = $('incomingAvatar').textContent;
  $('callStatus').textContent = 'Connexion...';
  $('callDuration').textContent = '00:00';
  $('callOverlay').style.display = 'flex';
  $('callScreen').style.display = 'block';
  $('localVideo').style.display = isVideo ? 'block' : 'none';
  $('remoteVideo').style.display = isVideo ? 'block' : 'none';
  $('callBtnVideo').style.display = isVideo ? 'flex' : 'none';

  const localVideo = $('localVideo');
  localVideo.srcObject = localStream;

  await createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await callDocRef.update({
    answer: { type: answer.type, sdp: answer.sdp },
    status: 'connected'
  });

  // Écouter ICE candidates du caller
  callerCandidatesUnsub = callDocRef.collection('callerCandidates')
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added' && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(change.doc.data()));
        }
      });
    });

  // Surveiller l'état
  callUnsub = callDocRef.onSnapshot(snapshot => {
    const d = snapshot.data();
    if (d && d.status === 'ended') endCall();
  });

  pendingCallDocId = null;
  startCallTimer();
  showToast('Appel connecté');
  if (currentChatUser) {
    _recordCall(currentChatUser.id, currentChatUser.name, data.type || 'audio', 'incoming', 'answered');
  }
}

function rejectCall() {
  if (callDocRef) {
    callDocRef.update({ status: 'ended' });
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (pc) { pc.close(); pc = null; }
  $('incomingOverlay').style.display = 'none';
  pendingCallDocId = null;
  showToast('Appel refusé');
  if (currentChatUser) {
    _recordCall(currentChatUser.id, currentChatUser.name, 'audio', 'incoming', 'missed');
  }
}

function endCall() {
  if (!window.__callEnded) {
    window.__callEnded = true;
    if (currentChatUser) {
      _recordCall(currentChatUser.id, currentChatUser.name, isVideoEnabled ? 'video' : 'audio', 'outgoing', 'ended');
    }
  }
  cleanupCall();
  $('callOverlay').style.display = 'none';
  $('incomingOverlay').style.display = 'none';
  showToast('Appel terminé');
}

function cleanupCall() {
  if (callDocRef && currentCallDocId) {
    callDocRef.update({ status: 'ended' }).catch(() => {});
  }
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (pc) { pc.close(); pc = null; }
  if (callUnsub) { callUnsub(); callUnsub = null; }
  if (callerCandidatesUnsub) { callerCandidatesUnsub(); callerCandidatesUnsub = null; }
  if (calleeCandidatesUnsub) { calleeCandidatesUnsub(); calleeCandidatesUnsub = null; }
  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }
  callDocRef = null;
  currentCallDocId = null;
  pendingCallDocId = null;
  $('localVideo').srcObject = null;
  $('remoteVideo').srcObject = null;
  $('localVideo').style.display = 'none';
  $('remoteVideo').style.display = 'none';
  $('callBtnVideo').style.display = 'none';
  isMuted = false;
  isSpeaker = false;
  window.__callEnded = false;
  isVideoEnabled = true;
  _updateCallBtnState();
  remoteStream = null;
}

function startCallTimer() {
  callStartTime = Date.now();
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    $('callDuration').textContent = `${m}:${s}`;
    $('callStatus').textContent = 'En cours';
  }, 1000);
}

function _updateCallBtnState() {
  var muteBtn = document.querySelector('.call-btn-mute');
  if (muteBtn) {
    if (isMuted) {
      muteBtn.innerHTML = '<i class="fas fa-microphone-slash"></i><span class="call-btn-label">Micro coupé</span>';
      muteBtn.style.background = 'rgba(253,121,168,0.3)';
    } else {
      muteBtn.innerHTML = '<i class="fas fa-microphone"></i><span class="call-btn-label">Micro</span>';
      muteBtn.style.background = '';
    }
  }
  var speakerBtn = document.querySelector('.call-btn-speaker');
  if (speakerBtn) {
    if (isSpeaker) {
      speakerBtn.innerHTML = '<i class="fas fa-volume-up"></i><span class="call-btn-label">Haut-parleur</span>';
      speakerBtn.style.background = 'rgba(0,206,201,0.3)';
    } else {
      speakerBtn.innerHTML = '<i class="fas fa-volume-off"></i><span class="call-btn-label">Écouteur</span>';
      speakerBtn.style.background = '';
    }
  }
  var videoBtn = document.querySelector('.call-btn-accept');
  if (videoBtn && videoBtn.id === 'callBtnVideo') {
    if (!isVideoEnabled) {
      videoBtn.innerHTML = '<i class="fas fa-video-slash"></i><span class="call-btn-label">Caméra coupée</span>';
      videoBtn.style.background = 'rgba(253,121,168,0.3)';
    } else {
      videoBtn.innerHTML = '<i class="fas fa-video"></i><span class="call-btn-label">Vidéo</span>';
      videoBtn.style.background = '';
    }
  }
}

function toggleMute() {
  isMuted = !isMuted;
  if (localStream) {
    localStream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });
  }
  _updateCallBtnState();
  showToast(isMuted ? '🔇 Micro coupé' : '🎤 Micro activé');
}

function toggleSpeaker() {
  isSpeaker = !isSpeaker;
  _updateCallBtnState();
  showToast(isSpeaker ? '🔊 Haut-parleur' : '🎧 Écouteur');
}

function toggleVideo() {
  if (!localStream) return;
  isVideoEnabled = !isVideoEnabled;
  localStream.getVideoTracks().forEach(t => { t.enabled = isVideoEnabled; });
  $('localVideo').style.display = isVideoEnabled ? 'block' : 'none';
  _updateCallBtnState();
  showToast(isVideoEnabled ? '📷 Caméra activée' : '🚫 Caméra coupée');
}

// ─── I18N / TRANSLATIONS ───
const __langs = {
  fr: {
    appTitle: 'izaho',
    headerProfile: 'Profil',
    authTagline: 'Votre réseau privé',
    authWelcome: 'Bienvenue sur izaho', authChoiceHint: 'Choisissez votre pays et recevez un identifiant unique.',
    authCountryLabel: 'Votre pays',
    authNewLabel: 'Nouveau ? Entrez votre Gmail', authCreateBtn: 'Créer mon identifiant',
    authOr: 'ou', authReturnLabel: 'Déjà un identifiant ?', authLoginBtn: 'Se connecter',
    authIdCreated: 'Identifiant créé', authIdSaved: 'Enregistré sur votre compte Gmail',
    authYourId: 'Votre identifiant unique', authShareHint: 'Partagez cet identifiant pour être contacté',
    authGmailNote: 'Un email de confirmation a été envoyé à',
    authContinue: 'Continuer →',
    authNameTitle: 'Choisissez votre nom', authNameHint: 'Ce nom sera visible par vos contacts',
    authStartBtn: 'Rejoindre izaho',
    authBack: '\u2190 Retour', authDemoBtn: 'Mode démo (sans Gmail)',
    navChats: 'Chats', navContacts: 'Contacts', navStatus: 'Statut', navNearby: 'Proximité',
    searchChats: 'Rechercher un chat...',
    desktopPlaceholder: 'Sélectionnez un chat ou démarrez une nouvelle conversation',
    settingsTitle: 'Paramètres',
    secTitle: 'Chiffrement & Sécurité',
    secBanner: 'Tous vos messages sont protégés par un <strong>chiffrement de bout en bout</strong>. Seul\u00b7e\u00b7s vous et votre interlocuteur\u00b7rice pouvez les lire.',
    secCode: 'Code de sécurité', secCodeShow: 'Afficher',
    secAlert: 'Notifications de sécurité', secAlertHint: 'Alerte si un contact change de clé',
    secAppLock: 'Verrouillage de l\'app', secAppLockHint: 'Code PIN ou empreinte pour ouvrir izaho',
    privTitle: 'Confidentialité',
    privLastSeen: 'Dernière vue', privProfilePhoto: 'Photo de profil', privStatus: 'Statut',
    privReadReceipts: 'Accusés de lecture', privReadReceiptsHint: 'Les autres verront quand vous lisez leurs messages',
    optEveryone: 'Tout le monde', optContacts: 'Mes contacts', optNobody: 'Personne',
    msgTitle: 'Messages',
    msgEphemeral: 'Messages éphémères', msgDuration: 'Durée',
    dur24h: '24 heures', dur7d: '7 jours', dur90d: '90 jours',
    msgAutoDL: 'Téléchargement auto des médias', msgAutoDLHint: 'Images et vidéos en Wi-Fi',
    accountTitle: 'Compte',
    accountNotif: 'Notifications', accountTheme: 'Thème', accountVersion: 'Version',
    themeDark: 'Sombre', settingsLang: 'Langue',
  },
  mg: {
    appTitle: 'izaho',
    authTagline: 'Hafatra haingana',
    authLoginTitle: 'Hiditra', authLoginHint: 'Ampidiro ny nomeraon-telefaoninao',
    authSendCode: 'Alefaso ny kaody', authDemoBtn: 'Fitsapana tsy misy serveur',
    authVerifyTitle: 'Fanamarinana', authVerifyHint: 'Kaody nalefa tany amin\'ny', authVerifyBtn: 'Hamarino', authBack: '\u2190 Ovay ny nomerao',
    navChats: 'Resaka', navContacts: 'Kontakt', navStatus: 'Sata', navNearby: 'Manodidina',
    searchChats: 'Mitady resaka...',
    settingsTitle: 'Parametra',
    secTitle: 'Fiarovana & Tsiambaratelo',
    secBanner: 'Ny hafatrao dia arovan\'ny <strong>fiarovana hatrany amin\'ny farany</strong>. Ianao sy ny mpiresakao ihany no mahita azy.',
    secCode: 'Kaody fiarovana', secCodeShow: 'Asehoy',
    secAlert: 'Fanairana fiarovana', secAlertHint: 'Mampandre raha misy manova ny fanalahidy',
    secAppLock: 'Hidim-piarovana', secAppLockHint: 'Kaody PIN na dian-tanana hanokatra izaho',
    privTitle: 'Tsiambaratelo',
    privLastSeen: 'Fijerena farany', privProfilePhoto: 'Sarin\'ny mombamomba', privStatus: 'Sata',
    privReadReceipts: 'Fanamarinana famakiana', privReadReceiptsHint: 'Hahafantatra ny hafa raha namaky ny hafatrao ianao',
    optEveryone: 'Ny olona rehetra', optContacts: 'Ny kontaktako', optNobody: 'Tsia',
    msgTitle: 'Hafatra',
    msgEphemeral: 'Hafatra mandalo', msgDuration: 'Faharetana',
    dur24h: '24 ora', dur7d: '7 andro', dur90d: '90 andro',
    msgAutoDL: 'Fampidinana mandeha ho azy', msgAutoDLHint: 'Sary sy horonan-tsary amin\'ny Wi-Fi',
    accountTitle: 'Kaonty',
    accountNotif: 'Fampandrenesana', accountTheme: 'Loko', accountVersion: 'Version',
    themeDark: 'Maizina', settingsLang: 'Fiteny',
  },
  en: {
    appTitle: 'izaho',
    authTagline: 'Instant Messaging',
    authLoginTitle: 'Login', authLoginHint: 'Enter your phone number',
    authSendCode: 'Send Code', authDemoBtn: 'Demo mode (offline)',
    authVerifyTitle: 'Verify', authVerifyHint: 'Code sent to', authVerifyBtn: 'Verify', authBack: '\u2190 Change number',
    navChats: 'Chats', navContacts: 'Contacts', navStatus: 'Status', navNearby: 'Nearby',
    searchChats: 'Search chats...',
    settingsTitle: 'Settings',
    secTitle: 'Encryption & Security',
    secBanner: 'All your messages are protected by <strong>end-to-end encryption</strong>. Only you and the recipient can read them.',
    secCode: 'Security code', secCodeShow: 'Show',
    secAlert: 'Security notifications', secAlertHint: 'Alert when a contact changes their key',
    secAppLock: 'App lock', secAppLockHint: 'PIN or fingerprint to open izaho',
    privTitle: 'Privacy',
    privLastSeen: 'Last seen', privProfilePhoto: 'Profile photo', privStatus: 'Status',
    privReadReceipts: 'Read receipts', privReadReceiptsHint: 'Others will see when you read their messages',
    optEveryone: 'Everyone', optContacts: 'My contacts', optNobody: 'Nobody',
    msgTitle: 'Messages',
    msgEphemeral: 'Disappearing messages', msgDuration: 'Duration',
    dur24h: '24 hours', dur7d: '7 days', dur90d: '90 days',
    msgAutoDL: 'Auto-download media', msgAutoDLHint: 'Images and videos on Wi-Fi',
    accountTitle: 'Account',
    accountNotif: 'Notifications', accountTheme: 'Theme', accountVersion: 'Version',
    themeDark: 'Dark', settingsLang: 'Language',
  },
  es: {
    appTitle: 'izaho',
    authTagline: 'Mensajería instantánea',
    authLoginTitle: 'Iniciar sesión', authLoginHint: 'Ingresa tu número de teléfono',
    authSendCode: 'Enviar código', authDemoBtn: 'Modo demo (sin conexión)',
    authVerifyTitle: 'Verificar', authVerifyHint: 'Código enviado a', authVerifyBtn: 'Verificar', authBack: '\u2190 Cambiar número',
    navChats: 'Chats', navContacts: 'Contactos', navStatus: 'Estado', navNearby: 'Cercanos',
    searchChats: 'Buscar chats...',
    settingsTitle: 'Ajustes',
    secTitle: 'Cifrado y seguridad',
    secBanner: 'Todos tus mensajes están protegidos con <strong>cifrado de extremo a extremo</strong>. Solo tú y el destinatario pueden leerlos.',
    secCode: 'Código de seguridad', secCodeShow: 'Mostrar',
    secAlert: 'Notificaciones de seguridad', secAlertHint: 'Alerta si un contacto cambia su clave',
    secAppLock: 'Bloqueo de app', secAppLockHint: 'PIN o huella para abrir izaho',
    privTitle: 'Privacidad',
    privLastSeen: 'Visto por última vez', privProfilePhoto: 'Foto de perfil', privStatus: 'Estado',
    privReadReceipts: 'Confirmaciones de lectura', privReadReceiptsHint: 'Otros verán cuándo lees sus mensajes',
    optEveryone: 'Todos', optContacts: 'Mis contactos', optNobody: 'Nadie',
    msgTitle: 'Mensajes',
    msgEphemeral: 'Mensajes temporales', msgDuration: 'Duración',
    dur24h: '24 horas', dur7d: '7 días', dur90d: '90 días',
    msgAutoDL: 'Descarga automática', msgAutoDLHint: 'Imágenes y videos en Wi-Fi',
    accountTitle: 'Cuenta',
    accountNotif: 'Notificaciones', accountTheme: 'Tema', accountVersion: 'Versión',
    themeDark: 'Oscuro', settingsLang: 'Idioma',
  },
  pt: {
    appTitle: 'izaho',
    authTagline: 'Mensagens instantâneas',
    authLoginTitle: 'Entrar', authLoginHint: 'Digite seu número de telefone',
    authSendCode: 'Enviar código', authDemoBtn: 'Modo demo (offline)',
    authVerifyTitle: 'Verificar', authVerifyHint: 'Código enviado para', authVerifyBtn: 'Verificar', authBack: '\u2190 Mudar número',
    navChats: 'Conversas', navContacts: 'Contatos', navStatus: 'Status', navNearby: 'Próximos',
    searchChats: 'Pesquisar conversas...',
    settingsTitle: 'Configurações',
    secTitle: 'Criptografia e segurança',
    secBanner: 'Todas as suas mensagens são protegidas com <strong>criptografia de ponta a ponta</strong>. Só você e o destinatário podem lê-las.',
    secCode: 'Código de segurança', secCodeShow: 'Mostrar',
    secAlert: 'Notificações de segurança', secAlertHint: 'Alerta se um contacto mudar a chave',
    secAppLock: 'Bloqueio do app', secAppLockHint: 'PIN ou impressão digital para abrir izaho',
    privTitle: 'Privacidade',
    privLastSeen: 'Visto por último', privProfilePhoto: 'Foto de perfil', privStatus: 'Estado',
    privReadReceipts: 'Confirmações de leitura', privReadReceiptsHint: 'Outros veem quando lê as mensagens',
    optEveryone: 'Todos', optContacts: 'Meus contactos', optNobody: 'Ninguém',
    msgTitle: 'Mensagens',
    msgEphemeral: 'Mensagens temporárias', msgDuration: 'Duração',
    dur24h: '24 horas', dur7d: '7 dias', dur90d: '90 dias',
    msgAutoDL: 'Download automático', msgAutoDLHint: 'Imagens e vídeos no Wi-Fi',
    accountTitle: 'Conta',
    accountNotif: 'Notificações', accountTheme: 'Tema', accountVersion: 'Versão',
    themeDark: 'Escuro', settingsLang: 'Idioma',
  },
  it: {
    appTitle: 'izaho',
    authTagline: 'Messaggistica istantanea',
    authLoginTitle: 'Accedi', authLoginHint: 'Inserisci il tuo numero di telefono',
    authSendCode: 'Invia codice', authDemoBtn: 'Modalità demo (offline)',
    authVerifyTitle: 'Verifica', authVerifyHint: 'Codice inviato a', authVerifyBtn: 'Verifica', authBack: '\u2190 Cambia numero',
    navChats: 'Chat', navContacts: 'Contatti', navStatus: 'Stato', navNearby: 'Vicini',
    searchChats: 'Cerca chat...',
    settingsTitle: 'Impostazioni',
    secTitle: 'Crittografia e sicurezza',
    secBanner: 'Tutti i tuoi messaggi sono protetti da <strong>crittografia end-to-end</strong>. Solo tu e il destinatario potete leggerli.',
    secCode: 'Codice di sicurezza', secCodeShow: 'Mostra',
    secAlert: 'Notifiche di sicurezza', secAlertHint: 'Avviso se un contatto cambia chiave',
    secAppLock: 'Blocco app', secAppLockHint: 'PIN o impronta per aprire izaho',
    privTitle: 'Privacy',
    privLastSeen: 'Ultimo accesso', privProfilePhoto: 'Foto profilo', privStatus: 'Stato',
    privReadReceipts: 'Conferme di lettura', privReadReceiptsHint: 'Altri vedono quando leggi i loro messaggi',
    optEveryone: 'Tutti', optContacts: 'I miei contatti', optNobody: 'Nessuno',
    msgTitle: 'Messaggi',
    msgEphemeral: 'Messaggi temporanei', msgDuration: 'Durata',
    dur24h: '24 ore', dur7d: '7 giorni', dur90d: '90 giorni',
    msgAutoDL: 'Download automatico media', msgAutoDLHint: 'Immagini e video su Wi-Fi',
    accountTitle: 'Account',
    accountNotif: 'Notifiche', accountTheme: 'Tema', accountVersion: 'Versione',
    themeDark: 'Scuro', settingsLang: 'Lingua',
  },
  de: {
    appTitle: 'izaho',
    authTagline: 'Sofortnachrichten',
    authLoginTitle: 'Anmelden', authLoginHint: 'Gib deine Telefonnummer ein',
    authSendCode: 'Code senden', authDemoBtn: 'Demo-Modus (offline)',
    authVerifyTitle: 'Bestätigen', authVerifyHint: 'Code gesendet an', authVerifyBtn: 'Bestätigen', authBack: '\u2190 Nummer ändern',
    navChats: 'Chats', navContacts: 'Kontakte', navStatus: 'Status', navNearby: 'In der Nähe',
    searchChats: 'Chats durchsuchen...',
    settingsTitle: 'Einstellungen',
    secTitle: 'Verschlüsselung & Sicherheit',
    secBanner: 'Alle deine Nachrichten sind durch <strong>Ende-zu-Ende-Verschlüsselung</strong> geschützt. Nur du und der Empfänger können sie lesen.',
    secCode: 'Sicherheitscode', secCodeShow: 'Anzeigen',
    secAlert: 'Sicherheitsbenachrichtigungen', secAlertHint: 'Warnung, wenn ein Kontakt seinen Schlüssel ändert',
    secAppLock: 'App-Sperre', secAppLockHint: 'PIN oder Fingerabdruck zum Öffnen von izaho',
    privTitle: 'Datenschutz',
    privLastSeen: 'Zuletzt gesehen', privProfilePhoto: 'Profilbild', privStatus: 'Status',
    privReadReceipts: 'Lesebestätigungen', privReadReceiptsHint: 'Andere sehen, wann du ihre Nachrichten liest',
    optEveryone: 'Alle', optContacts: 'Meine Kontakte', optNobody: 'Niemand',
    msgTitle: 'Nachrichten',
    msgEphemeral: 'Verschwindende Nachrichten', msgDuration: 'Dauer',
    dur24h: '24 Stunden', dur7d: '7 Tage', dur90d: '90 Tage',
    msgAutoDL: 'Auto-Download Medien', msgAutoDLHint: 'Bilder und Videos über Wi-Fi',
    accountTitle: 'Konto',
    accountNotif: 'Benachrichtigungen', accountTheme: 'Design', accountVersion: 'Version',
    themeDark: 'Dunkel', settingsLang: 'Sprache',
  },
  nl: {
    appTitle: 'izaho',
    authTagline: 'Directe berichten',
    authLoginTitle: 'Inloggen', authLoginHint: 'Voer je telefoonnummer in',
    authSendCode: 'Code verzenden', authDemoBtn: 'Demomodus (offline)',
    authVerifyTitle: 'Verifiëren', authVerifyHint: 'Code verzonden naar', authVerifyBtn: 'Verifiëren', authBack: '\u2190 Nummer wijzigen',
    navChats: 'Chats', navContacts: 'Contacten', navStatus: 'Status', navNearby: 'In de buurt',
    searchChats: 'Zoek chats...',
    settingsTitle: 'Instellingen',
    secTitle: 'Versleuteling en beveiliging',
    secBanner: 'Al je berichten zijn beveiligd met <strong>end-to-end-versleuteling</strong>. Alleen jij en de ontvanger kunnen ze lezen.',
    secCode: 'Beveiligingscode', secCodeShow: 'Weergeven',
    secAlert: 'Beveiligingsmeldingen', secAlertHint: 'Waarschuwing als een contact zijn sleutel wijzigt',
    secAppLock: 'App-vergrendeling', secAppLockHint: 'PIN of vingerafdruk om izaho te openen',
    privTitle: 'Privacy',
    privLastSeen: 'Laatst gezien', privProfilePhoto: 'Profielfoto', privStatus: 'Status',
    privReadReceipts: 'Leesbevestigingen', privReadReceiptsHint: 'Anderen zien wanneer je hun berichten leest',
    optEveryone: 'Iedereen', optContacts: 'Mijn contacten', optNobody: 'Niemand',
    msgTitle: 'Berichten',
    msgEphemeral: 'Verdwijnende berichten', msgDuration: 'Duur',
    dur24h: '24 uur', dur7d: '7 dagen', dur90d: '90 dagen',
    msgAutoDL: 'Auto download media', msgAutoDLHint: 'Afbeeldingen en video\'s via Wi-Fi',
    accountTitle: 'Account',
    accountNotif: 'Meldingen', accountTheme: 'Thema', accountVersion: 'Versie',
    themeDark: 'Donker', settingsLang: 'Taal',
  },
  sw: {
    appTitle: 'izaho',
    authTagline: 'Ujumbe wa papasapo',
    authLoginTitle: 'Ingia', authLoginHint: 'Weka namba yako ya simu',
    authSendCode: 'Tuma msimbo', authDemoBtn: 'Hali ya majaribio (offline)',
    authVerifyTitle: 'Thibitisha', authVerifyHint: 'Msimbo umetumwa kwa', authVerifyBtn: 'Thibitisha', authBack: '\u2190 Badilisha namba',
    navChats: 'Mazungumzo', navContacts: 'Wasiliani', navStatus: 'Hali', navNearby: 'Karibu',
    searchChats: 'Tafuta mazungumzo...',
    settingsTitle: 'Mipangilio',
    secTitle: 'Usimbaji fiche na usalama',
    secBanner: 'Ujumbe wako wote unalindwa kwa <strong>usimbaji fiche wa mwisho hadi mwisho</strong>. Wewe na mpokeaji pekee ndio mnaoweza kusoma.',
    secCode: 'Msimbo wa usalama', secCodeShow: 'Onyesha',
    secAlert: 'Arifa za usalama', secAlertHint: 'Tahadhari wakati mwasiliani anabadilisha ufunguo',
    secAppLock: 'Kufunga programu', secAppLockHint: 'PIN au alama ya kidole kufungua izaho',
    privTitle: 'Faragha',
    privLastSeen: 'Ilionekana mwisho', privProfilePhoto: 'Picha ya wasifu', privStatus: 'Hali',
    privReadReceipts: 'Risiti za usomaji', privReadReceiptsHint: 'Wengine wataona wakati unasoma ujumbe wao',
    optEveryone: 'Kila mtu', optContacts: 'Wasiliani wangu', optNobody: 'Hakuna',
    msgTitle: 'Ujumbe',
    msgEphemeral: 'Ujumbe unaotoweka', msgDuration: 'Muda',
    dur24h: 'Saa 24', dur7d: 'Siku 7', dur90d: 'Siku 90',
    msgAutoDL: 'Pakua kiotomatiki', msgAutoDLHint: 'Picha na video kwenye Wi-Fi',
    accountTitle: 'Akaunti',
    accountNotif: 'Arifa', accountTheme: 'Mandhari', accountVersion: 'Toleo',
    themeDark: 'Giza', settingsLang: 'Lugha',
  },
  tr: {
    appTitle: 'izaho',
    authTagline: 'Anlık mesajlaşma',
    authLoginTitle: 'Giriş', authLoginHint: 'Telefon numaranızı girin',
    authSendCode: 'Kod gönder', authDemoBtn: 'Demo modu (çevrimdışı)',
    authVerifyTitle: 'Doğrula', authVerifyHint: 'Kod gönderildi:', authVerifyBtn: 'Doğrula', authBack: '\u2190 Numarayı değiştir',
    navChats: 'Sohbet', navContacts: 'Kişiler', navStatus: 'Durum', navNearby: 'Yakındakiler',
    searchChats: 'Sohbet ara...',
    settingsTitle: 'Ayarlar',
    secTitle: 'Şifreleme ve güvenlik',
    secBanner: 'Tüm mesajlarınız <strong>uçtan uca şifreleme</strong> ile korunur. Yalnızca siz ve alıcı okuyabilir.',
    secCode: 'Güvenlik kodu', secCodeShow: 'Göster',
    secAlert: 'Güvenlik bildirimleri', secAlertHint: 'Bir kişi anahtarını değiştirirse uyar',
    secAppLock: 'Uygulama kilidi', secAppLockHint: 'izaho\'yu açmak için PIN veya parmak izi',
    privTitle: 'Gizlilik',
    privLastSeen: 'Son görülme', privProfilePhoto: 'Profil fotoğrafı', privStatus: 'Durum',
    privReadReceipts: 'Okundu bilgisi', privReadReceiptsHint: 'Diğerleri mesajlarını okuduğunuzu görür',
    optEveryone: 'Herkes', optContacts: 'Kişilerim', optNobody: 'Hiç kimse',
    msgTitle: 'Mesajlar',
    msgEphemeral: 'Kaybolan mesajlar', msgDuration: 'Süre',
    dur24h: '24 saat', dur7d: '7 gün', dur90d: '90 gün',
    msgAutoDL: 'Ortamı otomatik indir', msgAutoDLHint: 'Wi-Fi\'da resim ve videolar',
    accountTitle: 'Hesap',
    accountNotif: 'Bildirimler', accountTheme: 'Tema', accountVersion: 'Sürüm',
    themeDark: 'Koyu', settingsLang: 'Dil',
  },
  ru: {
    appTitle: 'izaho',
    authTagline: 'Мгновенные сообщения',
    authLoginTitle: 'Вход', authLoginHint: 'Введите номер телефона',
    authSendCode: 'Отправить код', authDemoBtn: 'Демо-режим (офлайн)',
    authVerifyTitle: 'Подтверждение', authVerifyHint: 'Код отправлен на', authVerifyBtn: 'Подтвердить', authBack: '\u2190 Изменить номер',
    navChats: 'Чаты', navContacts: 'Контакты', navStatus: 'Статус', navNearby: 'Рядом',
    searchChats: 'Поиск чатов...',
    settingsTitle: 'Настройки',
    secTitle: 'Шифрование и безопасность',
    secBanner: 'Все ваши сообщения защищены <strong>сквозным шифрованием</strong>. Только вы и получатель можете их читать.',
    secCode: 'Код безопасности', secCodeShow: 'Показать',
    secAlert: 'Уведомления безопасности', secAlertHint: 'Оповещение при смене ключа контактом',
    secAppLock: 'Блокировка приложения', secAppLockHint: 'PIN или отпечаток для открытия izaho',
    privTitle: 'Конфиденциальность',
    privLastSeen: 'Был(а) недавно', privProfilePhoto: 'Фото профиля', privStatus: 'Статус',
    privReadReceipts: 'Отчёты о прочтении', privReadReceiptsHint: 'Другие увидят, когда вы читаете их сообщения',
    optEveryone: 'Все', optContacts: 'Мои контакты', optNobody: 'Никто',
    msgTitle: 'Сообщения',
    msgEphemeral: 'Исчезающие сообщения', msgDuration: 'Длительность',
    dur24h: '24 часа', dur7d: '7 дней', dur90d: '90 дней',
    msgAutoDL: 'Автоскачивание медиа', msgAutoDLHint: 'Изображения и видео по Wi-Fi',
    accountTitle: 'Аккаунт',
    accountNotif: 'Уведомления', accountTheme: 'Тема', accountVersion: 'Версия',
    themeDark: 'Тёмная', settingsLang: 'Язык',
  },
  ar: {
    appTitle: 'izaho',
    authTagline: 'المراسلة الفورية',
    authLoginTitle: 'تسجيل الدخول', authLoginHint: 'أدخل رقم هاتفك',
    authSendCode: 'إرسال الرمز', authDemoBtn: 'وضع التجربة (بدون اتصال)',
    authVerifyTitle: 'التحقق', authVerifyHint: 'تم إرسال الرمز إلى', authVerifyBtn: 'تحقق', authBack: '\u2190 تغيير الرقم',
    navChats: 'المحادثات', navContacts: 'جهات الاتصال', navStatus: 'الحالة', navNearby: 'القريبون',
    searchChats: 'بحث في المحادثات...',
    settingsTitle: 'الإعدادات',
    secTitle: 'التشفير والأمان',
    secBanner: 'جميع رسائلك محمية بـ <strong>التشفير من الطرف إلى الطرف</strong>. فقط أنت والمستلم يمكنكما قراءتها.',
    secCode: 'رمز الأمان', secCodeShow: 'إظهار',
    secAlert: 'إشعارات الأمان', secAlertHint: 'تنبيه عند تغيير جهة اتصال لمفتاحها',
    secAppLock: 'قفل التطبيق', secAppLockHint: 'PIN أو بصمة لفتح izaho',
    privTitle: 'الخصوصية',
    privLastSeen: 'آخر ظهور', privProfilePhoto: 'صورة الملف الشخصي', privStatus: 'الحالة',
    privReadReceipts: 'إيصالات القراءة', privReadReceiptsHint: 'سيرى الآخرون عندما تقرأ رسائلهم',
    optEveryone: 'الجميع', optContacts: 'جهات اتصالي', optNobody: 'لا أحد',
    msgTitle: 'الرسائل',
    msgEphemeral: 'الرسائل المؤقتة', msgDuration: 'المدة',
    dur24h: '24 ساعة', dur7d: '7 أيام', dur90d: '90 يوماً',
    msgAutoDL: 'التنزيل التلقائي', msgAutoDLHint: 'الصور والفيديو عبر Wi-Fi',
    accountTitle: 'الحساب',
    accountNotif: 'الإشعارات', accountTheme: 'المظهر', accountVersion: 'الإصدار',
    themeDark: 'داكن', settingsLang: 'اللغة',
  },
  hi: {
    appTitle: 'izaho',
    authTagline: 'त्वरित संदेश',
    authLoginTitle: 'लॉग इन', authLoginHint: 'अपना फ़ोन नंबर दर्ज करें',
    authSendCode: 'कोड भेजें', authDemoBtn: 'डेमो मोड (ऑफ़लाइन)',
    authVerifyTitle: 'सत्यापित करें', authVerifyHint: 'कोड भेजा गया', authVerifyBtn: 'सत्यापित करें', authBack: '\u2190 नंबर बदलें',
    navChats: 'चैट', navContacts: 'संपर्क', navStatus: 'स्थिति', navNearby: 'आस-पास',
    searchChats: 'चैट खोजें...',
    settingsTitle: 'सेटिंग्स',
    secTitle: 'एन्क्रिप्शन और सुरक्षा',
    secBanner: 'आपके सभी संदेश <strong>एंड-टू-एंड एन्क्रिप्शन</strong> द्वारा सुरक्षित हैं। केवल आप और प्राप्तकर्ता ही पढ़ सकते हैं।',
    secCode: 'सुरक्षा कोड', secCodeShow: 'दिखाएँ',
    secAlert: 'सुरक्षा सूचनाएँ', secAlertHint: 'जब कोई संपर्क अपनी कुंजी बदलता है तो सचेत करें',
    secAppLock: 'ऐप लॉक', secAppLockHint: 'izaho खोलने के लिए PIN या फ़िंगरप्रिंट',
    privTitle: 'गोपनीयता',
    privLastSeen: 'अंतिम बार देखा', privProfilePhoto: 'प्रोफ़ाइल फ़ोटो', privStatus: 'स्थिति',
    privReadReceipts: 'पढ़ने की पावती', privReadReceiptsHint: 'अन्य देखेंगे कि आपने उनके संदेश कब पढ़े',
    optEveryone: 'सभी', optContacts: 'मेरे संपर्क', optNobody: 'कोई नहीं',
    msgTitle: 'संदेश',
    msgEphemeral: 'गायब होने वाले संदेश', msgDuration: 'अवधि',
    dur24h: '24 घंटे', dur7d: '7 दिन', dur90d: '90 दिन',
    msgAutoDL: 'ऑटो-डाउनलोड मीडिया', msgAutoDLHint: 'Wi-Fi पर चित्र और वीडियो',
    accountTitle: 'खाता',
    accountNotif: 'सूचनाएँ', accountTheme: 'थीम', accountVersion: 'संस्करण',
    themeDark: 'डार्क', settingsLang: 'भाषा',
  },
  zh: {
    appTitle: 'izaho',
    authTagline: '即时通讯',
    authLoginTitle: '登录', authLoginHint: '输入您的电话号码',
    authSendCode: '发送验证码', authDemoBtn: '演示模式（离线）',
    authVerifyTitle: '验证', authVerifyHint: '验证码已发送至', authVerifyBtn: '验证', authBack: '\u2190 更改号码',
    navChats: '聊天', navContacts: '联系人', navStatus: '状态', navNearby: '附近',
    searchChats: '搜索聊天...',
    settingsTitle: '设置',
    secTitle: '加密与安全',
    secBanner: '您的所有消息均受<strong>端到端加密</strong>保护。只有您和接收者可以阅读。',
    secCode: '安全验证码', secCodeShow: '显示',
    secAlert: '安全通知', secAlertHint: '联系人更改密钥时发出警报',
    secAppLock: '应用锁', secAppLockHint: '使用PIN或指纹打开izaho',
    privTitle: '隐私',
    privLastSeen: '最后上线', privProfilePhoto: '个人资料照片', privStatus: '状态',
    privReadReceipts: '已读回执', privReadReceiptsHint: '其他人会看到您何时阅读他们的消息',
    optEveryone: '所有人', optContacts: '我的联系人', optNobody: '无人',
    msgTitle: '消息',
    msgEphemeral: ' disappearing 消失的消息', msgDuration: '持续时间',
    dur24h: '24小时', dur7d: '7天', dur90d: '90天',
    msgAutoDL: '自动下载媒体', msgAutoDLHint: 'Wi-Fi下自动下载图片和视频',
    accountTitle: '账户',
    accountNotif: '通知', accountTheme: '主题', accountVersion: '版本',
    themeDark: '深色', settingsLang: '语言',
  },
  ja: {
    appTitle: 'izaho',
    authTagline: 'インスタントメッセージ',
    authLoginTitle: 'ログイン', authLoginHint: '電話番号を入力',
    authSendCode: 'コードを送信', authDemoBtn: 'デモモード（オフライン）',
    authVerifyTitle: '確認', authVerifyHint: 'コードを送信先:', authVerifyBtn: '確認', authBack: '\u2190 番号を変更',
    navChats: 'チャット', navContacts: '連絡先', navStatus: 'ステータス', navNearby: '近く',
    searchChats: 'チャットを検索...',
    settingsTitle: '設定',
    secTitle: '暗号化とセキュリティ',
    secBanner: 'すべてのメッセージは<strong>エンドツーエンド暗号化</strong>で保護されています。あなたと受信者だけが読むことができます。',
    secCode: 'セキュリティコード', secCodeShow: '表示',
    secAlert: 'セキュリティ通知', secAlertHint: '連絡先が鍵を変更したときに警告',
    secAppLock: 'アプリロック', secAppLockHint: 'izahoを開くにはPINまたは指紋',
    privTitle: 'プライバシー',
    privLastSeen: '最終閲覧', privProfilePhoto: 'プロフィール写真', privStatus: 'ステータス',
    privReadReceipts: '既読通知', privReadReceiptsHint: '相手があなたのメッセージを読んだとき表示',
    optEveryone: '全員', optContacts: 'マイ連絡先', optNobody: 'なし',
    msgTitle: 'メッセージ',
    msgEphemeral: '消えるメッセージ', msgDuration: '期間',
    dur24h: '24時間', dur7d: '7日間', dur90d: '90日間',
    msgAutoDL: 'メディア自動ダウンロード', msgAutoDLHint: 'Wi-Fiで画像と動画を自動保存',
    accountTitle: 'アカウント',
    accountNotif: '通知', accountTheme: 'テーマ', accountVersion: 'バージョン',
    themeDark: 'ダーク', settingsLang: '言語',
  },
};

function applyLanguage(code) {
  const lang = code === 'fr' ? __langs.fr : { ...__langs.fr, ...(__langs[code] || {}) };
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (!lang[key]) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = lang[key];
    } else {
      el.innerHTML = lang[key];
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (lang[key]) el.title = lang[key];
  });
  document.documentElement.lang = code;
  document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
}

// ─── APP LOCK ───
let __lockPatternSequence = [];
let __lockPatternConfirm = [];
let __lockPinValue = '';
let __lockPinConfirm = '';
let __isLockSetup = false;

function _getLockConfig() {
  try { return JSON.parse(localStorage.getItem('izaho_lock_config') || 'null'); } catch (_) { return null; }
}
function _saveLockConfig(cfg) {
  localStorage.setItem('izaho_lock_config', JSON.stringify(cfg));
}

function toggleAppLock(checked) {
  const opts = $('lockOptions');
  if (checked) {
    opts.style.display = 'block';
    const cfg = _getLockConfig();
    if (cfg) {
      $('lockType').value = cfg.type;
      $('lockSetupRow').style.display = 'none';
      $('lockChangeRow').style.display = 'flex';
      $('lockInfo').textContent = cfg.type === 'pin' ? '🔒 Code PIN configuré' : cfg.type === 'password' ? '🔒 Mot de passe configuré' : cfg.type === 'pattern' ? '🔒 Schéma configuré' : '🔒 Biométrie configurée';
    } else {
      $('lockSetupRow').style.display = 'flex';
      $('lockChangeRow').style.display = 'none';
      $('lockInfo').textContent = 'Choisissez un type et configurez';
    }
    onLockTypeChange($('lockType').value);
  } else {
    opts.style.display = 'none';
  }
  saveSetting('appLock', checked);
}

function onLockTypeChange(type) {
  const cfg = _getLockConfig();
  const setupBtn = $('lockSetupBtn');
  const label = $('lockSetupLabel');
  if (cfg && cfg.type === type) {
    label.textContent = 'Modifier';
    setupBtn.innerHTML = '<i class="fas fa-pen"></i> Changer';
  } else {
    label.textContent = 'Configurer';
    setupBtn.innerHTML = '<i class="fas fa-plus"></i> Définir';
  }
}

function showLockSetup(isChange) {
  if (isChange) {
    const cfg = _getLockConfig();
    if (!cfg) return;
    if (cfg.type === 'pin') showPinSetup(true);
    else if (cfg.type === 'password') showPasswordSetup(true);
    else if (cfg.type === 'pattern') showPatternSetup(true);
    else if (cfg.type === 'biometric') setupBiometric();
    return;
  }
  const type = $('lockType').value;
  if (type === 'pin') showPinSetup(false);
  else if (type === 'password') showPasswordSetup(false);
  else if (type === 'pattern') showPatternSetup(false);
  else if (type === 'biometric') setupBiometric();
}

// ─── PIN SETUP ───
function showPinSetup(isChange) {
  __lockPinValue = '';
  __lockPinConfirm = '';
  __isLockSetup = false;
  $('pinSetup').style.display = 'flex';
  $('pinSetupSubtitle').textContent = 'Entrez un code à 4 à 6 chiffres';
  $('pinSetupError').textContent = '';
  renderPinDots('pinSetupDots', 0);
}

function hidePinSetup() {
  $('pinSetup').style.display = 'none';
}

function pinSetupInput(d) {
  if (__isLockSetup) return;
  if (__lockPinValue.length >= 6) return;
  __lockPinValue += d;
  renderPinDots('pinSetupDots', __lockPinValue.length);
  if (__lockPinValue.length >= 4) {
    if (!__lockPinConfirm) {
      // First entry done, ask to confirm
      if (__lockPinValue.length < 4) return;
      __lockPinConfirm = __lockPinValue;
      __lockPinValue = '';
      renderPinDots('pinSetupDots', 0);
      $('pinSetupSubtitle').textContent = 'Confirmez le code PIN';
      $('pinSetupError').textContent = '';
    } else {
      // Confirm
      if (__lockPinValue === __lockPinConfirm) {
        _saveLockConfig({ type: 'pin', value: __lockPinValue });
        __isLockSetup = true;
        $('pinSetupError').textContent = '';
        showToast('✅ Code PIN enregistré');
        hidePinSetup();
        refreshLockUI();
      } else {
        $('pinSetupError').textContent = '❌ Les codes ne correspondent pas';
        __lockPinValue = '';
        __lockPinConfirm = '';
        renderPinDots('pinSetupDots', 0);
        $('pinSetupSubtitle').textContent = 'Entrez un code à 4 à 6 chiffres';
      }
    }
  }
}

function pinSetupBackspace() {
  if (__lockPinValue.length > 0) {
    __lockPinValue = __lockPinValue.slice(0, -1);
    renderPinDots('pinSetupDots', __lockPinValue.length);
  }
}

function renderPinDots(containerId, count) {
  const container = $(containerId);
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('div');
    dot.className = 'lock-pin-dot' + (i < count ? ' filled' : '');
    container.appendChild(dot);
  }
}

// ─── PASSWORD SETUP ───
function showPasswordSetup(isChange) {
  $('lockSubtitle').textContent = 'Créez un mot de passe';
  // Simple prompt-based for now
  const pwd = prompt('Nouveau mot de passe :');
  if (!pwd || pwd.length < 3) { showToast('Mot de passe trop court'); return; }
  const confirm = prompt('Confirmez le mot de passe :');
  if (pwd !== confirm) { showToast('❌ Les mots de passe ne correspondent pas'); return; }
  _saveLockConfig({ type: 'password', value: pwd });
  showToast('✅ Mot de passe enregistré');
  refreshLockUI();
}

// ─── PATTERN SETUP ───
function showPatternSetup() {
  __lockPatternSequence = [];
  __lockPatternConfirm = [];
  $('patternSetup').style.display = 'flex';
  $('patternSetupSubtitle').textContent = 'Reliez au moins 4 points';
  $('patternSetupError').textContent = '';
  $('patternSetupConfirm').style.display = 'none';
  renderPatternCanvas('patternSetupCanvas', null, true);
}

function hidePatternSetup() {
  $('patternSetup').style.display = 'none';
}

function patternSetupClear() {
  __lockPatternSequence = [];
  $('patternSetupError').textContent = '';
  $('patternSetupSubtitle').textContent = __lockPatternConfirm.length > 0 ? 'Confirmez le schéma' : 'Reliez au moins 4 points';
  $('patternSetupConfirm').style.display = 'none';
  renderPatternCanvas('patternSetupCanvas', null, true);
}

function patternSetupConfirm() {
  if (__lockPatternSequence.length < 4) return;
  if (__lockPatternConfirm.length === 0) {
    // First entry
    __lockPatternConfirm = [...__lockPatternSequence];
    __lockPatternSequence = [];
    $('patternSetupSubtitle').textContent = 'Confirmez le schéma';
    $('patternSetupError').textContent = '';
    $('patternSetupConfirm').style.display = 'none';
    renderPatternCanvas('patternSetupCanvas', null, true);
  } else {
    // Confirm
    const match = __lockPatternSequence.length === __lockPatternConfirm.length &&
      __lockPatternSequence.every((v, i) => v === __lockPatternConfirm[i]);
    if (match) {
      _saveLockConfig({ type: 'pattern', value: __lockPatternSequence.join('-') });
      showToast('✅ Schéma enregistré');
      hidePatternSetup();
      refreshLockUI();
    } else {
      $('patternSetupError').textContent = '❌ Les schémas ne correspondent pas';
      __lockPatternSequence = [];
      __lockPatternConfirm = [];
      $('patternSetupSubtitle').textContent = 'Reliez au moins 4 points';
      $('patternSetupConfirm').style.display = 'none';
      renderPatternCanvas('patternSetupCanvas', null, true);
    }
  }
}

// ─── PATTERN CANVAS ───
const __patternDots = [
  { x: 50, y: 50 }, { x: 140, y: 50 }, { x: 230, y: 50 },
  { x: 50, y: 140 }, { x: 140, y: 140 }, { x: 230, y: 140 },
  { x: 50, y: 230 }, { x: 140, y: 230 }, { x: 230, y: 230 },
];

function renderPatternCanvas(canvasId, sequence, isSetup) {
  const canvas = $(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const dots = __patternDots;
  const seq = sequence || [];

  // Draw lines
  if (seq.length > 0) {
    ctx.beginPath();
    ctx.strokeStyle = isSetup ? 'var(--primary-to, #00cec9)' : 'var(--primary-to, #00cec9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.moveTo(dots[seq[0]].x, dots[seq[0]].y);
    for (let i = 1; i < seq.length; i++) {
      ctx.lineTo(dots[seq[i]].x, dots[seq[i]].y);
    }
    ctx.stroke();
  }

  // Draw dots
  dots.forEach((dot, i) => {
    const isActive = seq.includes(i);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, isActive ? 18 : 14, 0, Math.PI * 2);
    if (isActive) {
      ctx.fillStyle = 'var(--primary-to, #00cec9)';
      ctx.fill();
      ctx.fillStyle = '#0b0f1c';
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
}

function _getPatternCanvasDot(canvas, x, y) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const cx = (x - rect.left) * scaleX;
  const cy = (y - rect.top) * scaleY;
  for (let i = 0; i < __patternDots.length; i++) {
    const d = __patternDots[i];
    const dist = Math.sqrt((cx - d.x) ** 2 + (cy - d.y) ** 2);
    if (dist < 28) return i;
  }
  return -1;
}

// Setup pattern canvas events
document.addEventListener('DOMContentLoaded', function() {
  // Pattern setup
  const setupCanvas = document.getElementById('patternSetupCanvas');
  if (setupCanvas) {
    setupCanvas.addEventListener('mousedown', function(e) {
      e.preventDefault();
      const idx = _getPatternCanvasDot(this, e.clientX, e.clientY);
      if (idx >= 0 && !__lockPatternSequence.includes(idx)) {
        __lockPatternSequence.push(idx);
        renderPatternCanvas('patternSetupCanvas', __lockPatternSequence, true);
        if (__lockPatternSequence.length >= 4) {
          if (__lockPatternConfirm.length > 0) {
            $('patternSetupConfirm').style.display = 'flex';
          } else {
            $('patternSetupConfirm').style.display = 'flex';
            $('patternSetupConfirm').innerHTML = '<i class="fas fa-check"></i> Suivant';
          }
        }
        $('patternSetupError').textContent = '';
      }
    });
    setupCanvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      const t = e.touches[0];
      const idx = _getPatternCanvasDot(this, t.clientX, t.clientY);
      if (idx >= 0 && !__lockPatternSequence.includes(idx)) {
        __lockPatternSequence.push(idx);
        renderPatternCanvas('patternSetupCanvas', __lockPatternSequence, true);
        if (__lockPatternSequence.length >= 4) {
          if (__lockPatternConfirm.length > 0) {
            $('patternSetupConfirm').style.display = 'flex';
          } else {
            $('patternSetupConfirm').style.display = 'flex';
            $('patternSetupConfirm').innerHTML = '<i class="fas fa-check"></i> Suivant';
          }
        }
        $('patternSetupError').textContent = '';
      }
    });
  }

  // Lock pattern canvas
  const lockCanvas = document.getElementById('lockPatternCanvas');
  if (lockCanvas) {
    lockCanvas.addEventListener('mousedown', function(e) {
      e.preventDefault();
      userStartedPattern = true;
      const idx = _getPatternCanvasDot(this, e.clientX, e.clientY);
      if (idx >= 0 && !lockPatternSeq.includes(idx)) {
        lockPatternSeq.push(idx);
        renderPatternCanvas('lockPatternCanvas', lockPatternSeq, false);
        $('lockPatternError').textContent = '';
      }
    });
    lockCanvas.addEventListener('mousemove', function(e) {
      if (!userStartedPattern) return;
      e.preventDefault();
      const idx = _getPatternCanvasDot(this, e.clientX, e.clientY);
      if (idx >= 0 && !lockPatternSeq.includes(idx)) {
        lockPatternSeq.push(idx);
        renderPatternCanvas('lockPatternCanvas', lockPatternSeq, false);
        $('lockPatternError').textContent = '';
      }
    });
    lockCanvas.addEventListener('mouseup', function(e) {
      userStartedPattern = false;
      if (lockPatternSeq.length > 0) {
        lockPatternComplete();
      }
    });
    lockCanvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      userStartedPattern = true;
      const t = e.touches[0];
      const idx = _getPatternCanvasDot(this, t.clientX, t.clientY);
      if (idx >= 0 && !lockPatternSeq.includes(idx)) {
        lockPatternSeq.push(idx);
        renderPatternCanvas('lockPatternCanvas', lockPatternSeq, false);
        $('lockPatternError').textContent = '';
      }
    });
    lockCanvas.addEventListener('touchmove', function(e) {
      if (!userStartedPattern) return;
      e.preventDefault();
      const t = e.touches[0];
      const idx = _getPatternCanvasDot(this, t.clientX, t.clientY);
      if (idx >= 0 && !lockPatternSeq.includes(idx)) {
        lockPatternSeq.push(idx);
        renderPatternCanvas('lockPatternCanvas', lockPatternSeq, false);
        $('lockPatternError').textContent = '';
      }
    });
    lockCanvas.addEventListener('touchend', function(e) {
      userStartedPattern = false;
      if (lockPatternSeq.length > 0) {
        lockPatternComplete();
      }
    });
  }
});

// ─── BIOMETRIC ───
function setupBiometric() {
  if (window.PublicKeyCredential) {
    // Try WebAuthn
    _saveLockConfig({ type: 'biometric', value: 'webauthn' });
    showToast('✅ Biométrie configurée');
    refreshLockUI();
  } else {
    showToast('🔑 Biométrie non disponible sur ce navigateur');
  }
}

function lockBiometricAuth() {
  if (window.PublicKeyCredential) {
    showToast('✅ Authentifié');
    hideLockScreen();
  } else {
    $('lockError').textContent = 'Biométrie non supportée';
  }
}

// ─── LOCK SCREEN ───
let lockPatternSeq = [];
let userStartedPattern = false;

function showLockScreen() {
  const cfg = _getLockConfig();
  if (!cfg) return;
  $('lockScreen').style.display = 'flex';
  $('lockError').textContent = '';
  $('lockInputArea').style.display = 'none';
  $('lockPatternArea').style.display = 'none';
  $('lockBiometricArea').style.display = 'none';
  $('lockNumpad').style.display = 'none';
  $('lockKeyboardArea').style.display = 'none';

  if (cfg.type === 'pin') {
    $('lockInputArea').style.display = 'block';
    $('lockNumpad').style.display = 'grid';
    lockPinAttempt = '';
    renderPinDotsLock('');
    $('lockSubtitle').textContent = 'Entrez votre code PIN';
  } else if (cfg.type === 'password') {
    $('lockInputArea').style.display = 'block';
    $('lockKeyboardArea').style.display = 'block';
    $('lockPasswordInput').value = '';
    $('lockPasswordInput').focus();
    $('lockSubtitle').textContent = 'Entrez votre mot de passe';
  } else if (cfg.type === 'pattern') {
    $('lockPatternArea').style.display = 'block';
    lockPatternSeq = [];
    renderPatternCanvas('lockPatternCanvas', [], false);
    $('lockSubtitle').textContent = 'Dessinez votre schéma';
  } else if (cfg.type === 'biometric') {
    $('lockBiometricArea').style.display = 'block';
    $('lockSubtitle').textContent = 'Authentifiez-vous';
    setTimeout(() => lockBiometricAuth(), 300);
  }
}

function hideLockScreen() {
  $('lockScreen').style.display = 'none';
}

let lockPinAttempt = '';

function lockNumpadInput(d) {
  if (lockPinAttempt.length >= 6) return;
  lockPinAttempt += d;
  renderPinDotsLock(lockPinAttempt);
  if (lockPinAttempt.length >= 4) {
    checkPin();
  }
}

function lockNumpadBackspace() {
  if (lockPinAttempt.length > 0) {
    lockPinAttempt = lockPinAttempt.slice(0, -1);
    renderPinDotsLock(lockPinAttempt);
  }
}

function renderPinDotsLock(val) {
  const container = $('lockPinDots');
  container.innerHTML = '';
  for (let i = 0; i < 6; i++) {
    const dot = document.createElement('div');
    dot.className = 'lock-pin-dot' + (i < val.length ? ' filled' : '');
    container.appendChild(dot);
  }
}

function checkPin() {
  const cfg = _getLockConfig();
  if (!cfg || cfg.type !== 'pin') return;
  if (lockPinAttempt === cfg.value) {
    $('lockError').textContent = '';
    hideLockScreen();
  } else {
    $('lockError').textContent = '❌ Code incorrect';
    renderPinDotsError();
    setTimeout(() => {
      lockPinAttempt = '';
      renderPinDotsLock('');
      $('lockError').textContent = '';
    }, 600);
  }
}

function renderPinDotsError() {
  const container = $('lockPinDots');
  container.querySelectorAll('.lock-pin-dot').forEach(d => d.classList.add('error'));
}

function lockSubmitPassword() {
  const val = $('lockPasswordInput').value;
  const cfg = _getLockConfig();
  if (!cfg || cfg.type !== 'password') return;
  if (val === cfg.value) {
    hideLockScreen();
  } else {
    $('lockError').textContent = '❌ Mot de passe incorrect';
    $('lockPasswordInput').value = '';
    setTimeout(() => $('lockError').textContent = '', 1500);
  }
}

function lockPatternClear() {
  lockPatternSeq = [];
  renderPatternCanvas('lockPatternCanvas', [], false);
  $('lockPatternError').textContent = '';
}

function lockPatternComplete() {
  const cfg = _getLockConfig();
  if (!cfg || cfg.type !== 'pattern') return;
  const saved = cfg.value.split('-').map(Number);
  if (lockPatternSeq.length === saved.length && lockPatternSeq.every((v, i) => v === saved[i])) {
    $('lockPatternError').textContent = '';
    hideLockScreen();
  } else {
    $('lockPatternError').textContent = '❌ Schéma incorrect';
    setTimeout(() => {
      lockPatternSeq = [];
      renderPatternCanvas('lockPatternCanvas', [], false);
      $('lockPatternError').textContent = '';
    }, 600);
  }
}

function refreshLockUI() {
  const cfg = _getLockConfig();
  if (cfg) {
    $('lockSetupRow').style.display = 'none';
    $('lockChangeRow').style.display = 'flex';
    $('lockInfo').textContent = cfg.type === 'pin' ? '🔒 Code PIN configuré' : cfg.type === 'password' ? '🔒 Mot de passe configuré' : cfg.type === 'pattern' ? '🔒 Schéma configuré' : '🔒 Biométrie configurée';
  }
}

// Auto-lock on visibility change
document.addEventListener('visibilitychange', function() {
  if (document.hidden) return;
  const cfg = _getLockConfig();
  const settings = JSON.parse(localStorage.getItem(getSettingsKey()) || '{}');
  if (cfg && settings.appLock) {
    showLockScreen();
  }
});

// Update ICE_SERVERS for global connectivity
const __iceServersExtended = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.voip.blackberry.com:3478' },
    { urls: 'stun:stun.altar.com.pl:3478' },
    {
      urls: 'turn:global.turn.izaho.net:3478',
      username: 'izaho',
      credential: 'izaho2024'
    },
    {
      urls: 'turn:turn.izaho.org:3478?transport=tcp',
      username: 'izaho',
      credential: 'izaho2024'
    },
  ]
};// Override ICE_SERVERS
// In production, replace with your own TURN servers
Object.assign(ICE_SERVERS, __iceServersExtended);

// ─── SETTINGS ───
function getSettingsKey() {
  if (currentUser && currentUser.uid && currentUser._local) return 'izaho_settings_demo';
  return 'izaho_settings_' + (currentUser ? currentUser.uid : 'default');
}

function loadSettings() {
  const data = JSON.parse(localStorage.getItem(getSettingsKey()) || '{}');
  const defaults = {
    language: 'fr',
    secAlert: true,
    appLock: false,
    lastSeen: 'contacts',
    profilePhoto: 'everyone',
    status: 'everyone',
    readReceipts: true,
    ephemeral: false,
    ephemeralDuration: '7d',
    autoDownload: true,
    notifications: true,
    wallpaper: 'default',
  };
  const merged = { ...defaults, ...data };

  // Apply to UI
  $('settingSecAlert').checked = merged.secAlert;
  $('settingAppLock').checked = merged.appLock;
  $('settingLastSeen').value = merged.lastSeen;
  $('settingProfilePhoto').value = merged.profilePhoto;
  $('settingStatus').value = merged.status;
  $('settingReadReceipts').checked = merged.readReceipts;
  $('settingEphemeral').checked = merged.ephemeral;
  $('settingEphemeralDuration').value = merged.ephemeralDuration;
  $('settingAutoDownload').checked = merged.autoDownload;
  $('settingNotifications').checked = merged.notifications;
  if ($('settingLanguage')) $('settingLanguage').value = merged.language;

  // Show/hide ephemeral duration row
  $('ephemeralDurationRow').style.display = merged.ephemeral ? 'flex' : 'none';

  // Apply language
  applyLanguage(merged.language);

  // Highlight active wallpaper
  const wallEls = document.querySelectorAll('.wallpaper-option');
  wallEls.forEach(el => {
    el.style.borderColor = el.dataset.wall === (merged.wallpaper || 'default') ? 'var(--primary-to)' : 'transparent';
    el.style.opacity = el.dataset.wall === (merged.wallpaper || 'default') ? '1' : '.6';
  });
  applyWallpaper(merged.wallpaper || 'default');
}

function setWallpaper(val, el) {
  saveSetting('wallpaper', val);
  document.querySelectorAll('.wallpaper-option').forEach(e => {
    e.style.borderColor = 'transparent';
    e.style.opacity = '.6';
  });
  if (el) { el.style.borderColor = 'var(--primary-to)'; el.style.opacity = '1'; }
  applyWallpaper(val);
}

function applyWallpaper(val) {
  const chatArea = $('chatMessages');
  if (!chatArea) return;
  chatArea.style.background = '';
  chatArea.style.backgroundImage = '';
  chatArea.style.backgroundSize = '';
  chatArea.style.backgroundPosition = '';
  switch (val) {
    case 'default': break;
    case 'grad1': chatArea.style.background = 'linear-gradient(135deg, #0b0f1c 0%, #1a1a3e 100%)'; break;
    case 'grad2': chatArea.style.background = 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)'; break;
    case 'grad3': chatArea.style.background = 'linear-gradient(135deg, #1a0a2e 0%, #16213e 100%)'; break;
    case 'grad4': chatArea.style.background = 'linear-gradient(135deg, #0d1b2a 0%, #1b2838 100%)'; break;
    case 'grad5': chatArea.style.background = 'linear-gradient(135deg, #1c0a0a 0%, #2d1b1b 100%)'; break;
    case 'pattern1': chatArea.style.backgroundImage = 'radial-gradient(circle, rgba(108,92,231,.12) 1px, transparent 1px)'; chatArea.style.backgroundSize = '20px 20px'; break;
    case 'pattern2': chatArea.style.backgroundImage = 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,206,201,.08) 20px, rgba(0,206,201,.08) 21px)'; break;
    case 'pattern3': chatArea.style.backgroundImage = 'linear-gradient(45deg, rgba(108,92,231,.08) 25%, transparent 25%, transparent 75%, rgba(108,92,231,.08) 75%), linear-gradient(45deg, rgba(108,92,231,.08) 25%, transparent 25%, transparent 75%, rgba(108,92,231,.08) 75%)'; chatArea.style.backgroundSize = '40px 40px'; chatArea.style.backgroundPosition = '0 0, 20px 20px'; break;
  }
}

function saveSetting(key, value) {
  const storageKey = getSettingsKey();
  const data = JSON.parse(localStorage.getItem(storageKey) || '{}');
  data[key] = value;
  localStorage.setItem(storageKey, JSON.stringify(data));

  // Ephemeral toggle: show/hide duration
  if (key === 'ephemeral') {
    $('ephemeralDurationRow').style.display = value ? 'flex' : 'none';
  }
  // Language change: apply immediately
  if (key === 'language') {
    applyLanguage(value);
  }
}

function showSecurityCode() {
  $('securCodeModal').style.display = 'flex';
}

function hideSecurityCode() {
  $('securCodeModal').style.display = 'none';
}

// ─── FORMAT ───
function formatTime(date) {
  const now = new Date();
  const diff = (now - date) / 1000;
  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ─── FIN PROTECTION ───

// ─── CREATOR PANEL (administrateur caché) ───
let _crTapCount = 0;
let _crTapTimer = null;

// Accès secret : taper 7 fois sur la version dans Paramètres
function _initCreatorAccess() {
  var el = document.querySelector('.settings-badge');
  if (!el || el.textContent.indexOf('izaho v') === -1) {
    setTimeout(_initCreatorAccess, 1000);
    return;
  }
  el.style.cursor = 'pointer';
  el.addEventListener('click', function(e) {
    _crTapCount++;
    if (_crTapTimer) clearTimeout(_crTapTimer);
    if (_crTapCount >= 7) {
      _crTapCount = 0;
      showCreatorPanel();
      return;
    }
    _crTapTimer = setTimeout(function() { _crTapCount = 0; }, 1500);
  });
}
setTimeout(_initCreatorAccess, 2000);

function showCreatorPanel() {
  var over = $('creatorPanel');
  if (!over) return;

  // Protection status
  var pStat = $('crProtectionStatus');
  if (pStat) pStat.textContent = window.__IZAHO_PARALYZED ? '❌ Paralysé' : '✅ Active';
  pStat.style.color = window.__IZAHO_PARALYZED ? 'var(--accent)' : 'var(--primary-to)';

  var dStat = $('crDomainStatus');
  if (dStat) {
    var proto = window.location.protocol;
    var host = window.location.hostname;
    if (proto === 'file:') dStat.textContent = '❌ file:// (copie locale)';
    else if (host === 'localhost' || host === '127.0.0.1') dStat.textContent = '✅ Localhost';
    else if (host.indexOf('izaho') > -1 || host.indexOf('192.168.') === 0) dStat.textContent = '✅ ' + host;
    else dStat.textContent = '⚠️ ' + host + ' (non reconnu)';
  }

  var iStat = $('crIntegrityStatus');
  if (iStat) {
    try {
      var ok = typeof window.sendMessage === 'function' && typeof window.loadChats === 'function';
      iStat.textContent = ok ? '✅ OK' : '❌ Modifiée';
      iStat.style.color = ok ? 'var(--primary-to)' : 'var(--accent)';
    } catch(e) { iStat.textContent = '❌ Erreur'; }
  }

  // Server list
  var sList = $('crServerList');
  if (sList) {
    var html = '';
    try {
      var servers = window.ICE_SERVERS ? (window.ICE_SERVERS.iceServers || []) : [];
      if (servers.length === 0) {
        // Fallback: take from __iceServersExtended
        try {
          if (typeof __iceServersExtended !== 'undefined' && __iceServersExtended.iceServers) {
            servers = __iceServersExtended.iceServers;
          }
        } catch(e) {}
      }
      servers.forEach(function(s) {
        var url = s.urls || s.url || '';
        var type = url.indexOf('turn:') === 0 ? 'TURN' : 'STUN';
        var hasAuth = s.username ? ' 🔐' : '';
        html += '<div class="settings-row" style="padding:6px 8px"><span style="color:var(--text-muted)">' + type + '</span><span class="settings-badge" style="font-size:11px;word-break:break-all;max-width:200px">' + url + hasAuth + '</span></div>';
      });
    } catch(e) { html = '<div style="color:var(--text-muted)">Erreur chargement serveurs</div>'; }
    sList.innerHTML = html || '<div style="color:var(--text-muted)">Aucun serveur configuré</div>';
  }

  over.style.display = 'flex';
}

function hideCreatorPanel() {
  var over = $('creatorPanel');
  if (over) over.style.display = 'none';
}

function copyKillSwitch() {
  try {
    navigator.clipboard.writeText('__IZAHO_OVERRIDE()');
    showToast('📋 Commande copiée');
  } catch(e) {
    showToast('❌ Copie non disponible');
  }
}

function execKillSwitch() {
  window.__IZAHO_PARALYZED = false;
  window.__IZAHO_SECURE = false;
  try { localStorage.removeItem('izaho_protected'); } catch(e) {}
  showToast('✅ Protection désactivée');
  showCreatorPanel();
}

function crResetProtection() {
  window.__IZAHO_PARALYZED = false;
  window.__IZAHO_SECURE = false;
  try { localStorage.removeItem('izaho_protected'); } catch(e) {}
  showToast('🔄 Protection réinitialisée');
  showCreatorPanel();
}

function crClearProtectedFlag() {
  try { localStorage.removeItem('izaho_protected'); } catch(e) {}
  showToast('🧹 Flag effacé');
}

// ─── RESIZE HANDLER ───
window._desktop = window.innerWidth >= 1024;
window.addEventListener('resize', function() {
  const wasDesktop = window._desktop === true;
  const isDesktop = window.innerWidth >= 1024;
  if (isDesktop === wasDesktop) return;
  window._desktop = isDesktop;
  // Transition entre mobile et desktop
  if (currentUser) {
    if (isDesktop) {
      document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
      $('viewChats').classList.add('active');
      $('viewDesktopPlaceholder').classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const n = document.querySelector(`.nav-item[data-view="chats"]`);
      if (n) n.classList.add('active');
    } else {
      document.querySelectorAll('#appScreen > .view').forEach(v => v.classList.remove('active'));
      $('viewChats').classList.add('active');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const n = document.querySelector(`.nav-item[data-view="chats"]`);
      if (n) n.classList.add('active');
    }
  }
});
