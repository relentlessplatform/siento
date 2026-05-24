/* ═══════════════════════════════════════════════════════════
   JOURNAL PWA — APP LOGIC
   Supabase · Auth · Entries · Media · Moods
═══════════════════════════════════════════════════════════ */

'use strict';

// ── SUPABASE INIT ────────────────────────────────────────────────────────────
const SUPABASE_URL    = 'https://mozkrgmstcmnckcyphpm.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vemtyZ21zdGNtbmNrY3lwaHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NzkzMjQsImV4cCI6MjA5NTE1NTMyNH0.AMSO_nxBv2Cuwn7rU43mnUFQH0A6BSDrmJk6lH5wR6Y';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── STATE ────────────────────────────────────────────────────────────────────
let currentUser   = null;
let currentProfile= null;
let allEntries    = [];
let editingEntry  = null;
let selectedEmotion = null;
let selectedEnergy  = null;
let pendingPhotos  = [];   // { file, dataUrl }
let tags           = [];
let currentView    = 'dashboard';

// ── DOM REFS ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const authScreen  = $('auth-screen');
const appScreen   = $('app-screen');
const loginForm   = $('login-form');
const signupForm  = $('signup-form');
const loginError  = $('login-error');
const signupError = $('signup-error');
const entryModal  = $('entry-modal');
const detailModal = $('detail-modal');
const toast       = $('toast');
const sidebar     = $('sidebar');

// ── UTILS ────────────────────────────────────────────────────────────────────
function showToast(msg, dur = 2800) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 320);
  }, dur);
}

function setLoading(btn, on) {
  const ldr = btn.querySelector('.btn-loader');
  const txt = btn.querySelector('span');
  if (on) { ldr?.classList.remove('hidden'); btn.disabled = true; if(txt) txt.style.opacity='0'; }
  else     { ldr?.classList.add('hidden');    btn.disabled = false; if(txt) txt.style.opacity=''; }
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}
function formatDatetime(iso) {
  return formatDate(iso) + ' · ' + formatTime(iso);
}
function localNow() {
  const now = new Date();
  const off = now.getTimezoneOffset() * 60000;
  return new Date(now - off).toISOString().slice(0,16);
}

const EMOTION_EMOJI = {
  happy:'😊', excited:'🤩', grateful:'🥰', calm:'😌', neutral:'😐',
  tired:'😴', sad:'😢', anxious:'😰', angry:'😤', sick:'🤒'
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function avatarLetter(name) {
  return (name || 'U')[0].toUpperCase();
}

// ── DB SETUP ─────────────────────────────────────────────────────────────────
async function ensureTables() {
  // profiles, entries, photos are created via Supabase SQL editor or migrations
  // We use upsert/insert patterns that handle missing rows gracefully
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    await loadProfile();
    showApp();
  } else {
    showAuth();
  }
}

function showAuth() {
  authScreen.classList.add('active');
  appScreen.classList.remove('active');
}
function showApp() {
  authScreen.classList.remove('active');
  appScreen.classList.add('active');
  updateUserUI();
  loadDashboard();
}

async function loadProfile() {
  const { data } = await db
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single();
  currentProfile = data;
}

// Auth tabs
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const which = tab.dataset.tab;
    loginForm.classList.toggle('active', which === 'login');
    signupForm.classList.toggle('active', which === 'signup');
    loginError.textContent = '';
    signupError.textContent = '';
  });
});

// Toggle password visibility
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = btn.parentElement.querySelector('input[type]');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
});

// LOGIN
loginForm.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.textContent = '';
  const username = $('login-username').value.trim().toLowerCase();
  const password = $('login-password').value;
  const btn = loginForm.querySelector('button[type="submit"]');
  setLoading(btn, true);

  try {
    // Look up email from profiles by username
    const { data: prof } = await db
      .from('profiles')
      .select('email')
      .eq('username', username)
      .single();

    if (!prof?.email) {
      loginError.textContent = 'Username not found.';
      setLoading(btn, false); return;
    }

    const { data, error } = await db.auth.signInWithPassword({ email: prof.email, password });
    if (error) { loginError.textContent = 'Incorrect password.'; setLoading(btn, false); return; }
    currentUser = data.user;
    await loadProfile();
    showApp();
  } catch {
    loginError.textContent = 'Something went wrong. Try again.';
  }
  setLoading(btn, false);
});

// SIGNUP
signupForm.addEventListener('submit', async e => {
  e.preventDefault();
  signupError.textContent = '';
  const firstName = $('signup-firstname').value.trim();
  const lastName  = $('signup-lastname').value.trim();
  const username  = $('signup-username').value.trim().toLowerCase();
  const password  = $('signup-password').value;
  const btn = signupForm.querySelector('button[type="submit"]');

  if (!firstName || !lastName || !username || !password) {
    signupError.textContent = 'Please fill all fields.'; return;
  }
  if (password.length < 6) {
    signupError.textContent = 'Password must be at least 6 characters.'; return;
  }
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    signupError.textContent = 'Username: 3-20 chars, letters, numbers, underscores.'; return;
  }

  setLoading(btn, true);

  try {
    // Check username uniqueness
    const { data: existing } = await db
      .from('profiles').select('id').eq('username', username).single();
    if (existing) {
      signupError.textContent = 'Username already taken.';
      setLoading(btn, false); return;
    }

    const email = `${username}@journal.local`;
    const { data, error } = await db.auth.signUp({ email, password });
    if (error) { signupError.textContent = error.message; setLoading(btn, false); return; }

    currentUser = data.user;

    await db.from('profiles').upsert({
      id: currentUser.id,
      username, email,
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`,
      created_at: new Date().toISOString()
    });

    await loadProfile();
    showApp();
    showToast(`Welcome, ${firstName}! ✨`);
  } catch (err) {
    signupError.textContent = err.message || 'Something went wrong.';
  }
  setLoading(btn, false);
});

// LOGOUT
$('logout-btn').addEventListener('click', async () => {
  await db.auth.signOut();
  currentUser = null; currentProfile = null; allEntries = [];
  showAuth();
});

// ── UI UPDATES ───────────────────────────────────────────────────────────────
function updateUserUI() {
  const name = currentProfile?.full_name || currentProfile?.first_name || 'User';
  const handle = currentProfile?.username || 'user';
  $('sidebar-name').textContent = name;
  $('sidebar-handle').textContent = '@' + handle;
  $('sidebar-avatar').textContent = avatarLetter(name);
  $('dash-name-display').textContent = (currentProfile?.first_name || name) + '.';
  $('dash-greeting').textContent = greeting();

  const now = new Date();
  $('badge-day').textContent = now.toLocaleDateString('en-US', { weekday:'short' });
  $('badge-num').textContent  = now.getDate();
}

// ── NAVIGATION ───────────────────────────────────────────────────────────────
function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = $('view-' + view);
  if (el) el.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n =>
    n.classList.toggle('active', n.dataset.view === view));
  document.querySelectorAll('.bnav-item[data-view]').forEach(n =>
    n.classList.toggle('active', n.dataset.view === view));

  const titles = { dashboard:'Journal', entries:'All Entries', moods:'Mood Tracker', memories:'Memories' };
  $('topbar-title').textContent = titles[view] || 'Journal';

  if (view === 'entries') loadAllEntries();
  if (view === 'moods')   loadMoodView();
  if (view === 'memories') loadMemories();

  // close mobile sidebar
  sidebar.classList.remove('open');
  $('mobile-menu-overlay').classList.remove('open');
}

document.querySelectorAll('[data-view]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    switchView(el.dataset.view);
  });
});

$('menu-btn').addEventListener('click', () => {
  sidebar.classList.add('open');
  $('mobile-menu-overlay').classList.add('open');
});
$('mobile-menu-overlay').addEventListener('click', () => {
  sidebar.classList.remove('open');
  $('mobile-menu-overlay').classList.remove('open');
});

// ── DASHBOARD ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  await fetchEntries();
  renderRecentEntries();
  renderStats();
  renderMoodWeek();
}

function renderStats() {
  $('stat-total').textContent = allEntries.length;

  // streak
  let streak = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  const days = new Set(allEntries.map(e => {
    const d = new Date(e.created_at); d.setHours(0,0,0,0); return d.getTime();
  }));
  for (let i = 0; i < 365; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (days.has(d.getTime())) streak++;
    else if (i > 0) break;
  }
  $('stat-streak').textContent = streak;

  // photos count
  const photos = allEntries.reduce((n,e) => n + (e.photos?.length || 0), 0);
  $('stat-photos').textContent = photos;
}

function renderMoodWeek() {
  const wrap = $('mood-week');
  wrap.innerHTML = '';
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    days.push(d);
  }
  days.forEach(day => {
    const entry = allEntries.find(e => {
      const ed = new Date(e.created_at); ed.setHours(0,0,0,0);
      return ed.getTime() === day.getTime();
    });
    const label = day.toLocaleDateString('en-US', { weekday:'short' }).slice(0,1);
    const emoji = entry?.emotion ? EMOTION_EMOJI[entry.emotion] || '·' : '·';
    wrap.insertAdjacentHTML('beforeend', `
      <div class="mood-day">
        <div class="mood-day-label">${label}</div>
        <div class="mood-day-emoji">${emoji}</div>
      </div>
    `);
  });
}

function renderRecentEntries() {
  const list = $('recent-entries-list');
  const recent = allEntries.slice(0, 5);
  if (!recent.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📔</div><div class="empty-title">No entries yet</div><div class="empty-sub">Start writing your first entry!</div></div>';
    return;
  }
  list.innerHTML = recent.map((e,i) => entryCardHTML(e, i)).join('');
  attachCardListeners(list);
}

// ── ENTRIES ───────────────────────────────────────────────────────────────────
async function fetchEntries() {
  if (!currentUser) return;
  const { data, error } = await db
    .from('entries')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });
  if (!error) allEntries = data || [];
}

async function loadAllEntries() {
  await fetchEntries();
  renderAllEntries(allEntries);
}

function renderAllEntries(entries) {
  const list = $('all-entries-list');
  const empty = $('entries-empty');
  if (!entries.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = entries.map((e,i) => entryCardHTML(e, i)).join('');
  attachCardListeners(list);
}

function entryCardHTML(e, i) {
  const emoji  = e.emotion ? EMOTION_EMOJI[e.emotion] || '' : '';
  const title  = e.title || 'Untitled Entry';
  const preview= (e.body || '').slice(0, 120);
  const date   = formatDate(e.created_at);
  const tags   = (e.tags || []).slice(0,3).map(t => `<span class="entry-tag">${escapeHTML(t)}</span>`).join('');
  const photos = e.photos || [];
  const thumb  = photos.length
    ? `<img class="entry-has-photo" src="${photos[0]}" alt="" loading="lazy">`
    : '';
  const locationHTML = e.location
    ? `<span class="entry-card-meta">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${escapeHTML(e.location)}
      </span>` : '';
  return `
    <div class="entry-card" data-id="${e.id}" style="animation-delay:${i*0.04}s">
      <div class="entry-card-header">
        <div class="entry-card-title">${escapeHTML(title)}</div>
        <div class="entry-card-emotion">${emoji}</div>
      </div>
      ${preview ? `<div class="entry-card-preview">${escapeHTML(preview)}</div>` : ''}
      <div class="entry-card-footer">
        <span class="entry-card-meta">${date}</span>
        ${locationHTML}
        ${tags}
        ${thumb}
      </div>
    </div>
  `;
}

function attachCardListeners(container) {
  container.querySelectorAll('.entry-card').forEach(card => {
    card.addEventListener('click', () => openDetail(card.dataset.id));
  });
}

function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Search
$('search-input').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  const filtered = allEntries.filter(entry =>
    (entry.title||'').toLowerCase().includes(q) ||
    (entry.body||'').toLowerCase().includes(q) ||
    (entry.location||'').toLowerCase().includes(q) ||
    (entry.tags||[]).some(t => t.toLowerCase().includes(q))
  );
  renderAllEntries(filtered);
});

// ── MOOD VIEW ─────────────────────────────────────────────────────────────────
async function loadMoodView() {
  await fetchEntries();
  renderMoodChart();
  renderMoodHistory();
}

function renderMoodChart() {
  const wrap = document.querySelector('.mood-chart-wrap');
  const entriesWithMood = allEntries.filter(e => e.emotion);

  if (!entriesWithMood.length) {
    wrap.innerHTML = `<div class="no-data-chart">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
      Start logging emotions to see your mood chart
    </div>`;
    return;
  }

  // Count emotions
  const counts = {};
  entriesWithMood.forEach(e => { counts[e.emotion] = (counts[e.emotion]||0)+1; });

  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  const max = sorted[0][1];

  const barsHTML = sorted.map(([emotion, count]) => {
    const pct = Math.round((count/max)*100);
    const emoji = EMOTION_EMOJI[emotion] || '';
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:28px;text-align:center;font-size:20px">${emoji}</div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--text2);margin-bottom:4px;text-transform:capitalize">${emotion}</div>
          <div style="background:var(--bg3);border-radius:6px;height:8px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--blue));border-radius:6px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1)"></div>
          </div>
        </div>
        <div style="width:24px;text-align:right;font-size:13px;color:var(--text2);font-weight:500">${count}</div>
      </div>`;
  }).join('');

  wrap.innerHTML = `<div style="padding:4px 0">${barsHTML}</div>`;
}

function renderMoodHistory() {
  const list = $('mood-history-list');
  const entriesWithMood = allEntries.filter(e => e.emotion).slice(0, 30);
  if (!entriesWithMood.length) {
    list.innerHTML = '<p style="color:var(--text3);font-size:14px;text-align:center;padding:24px">No moods recorded yet.</p>';
    return;
  }
  list.innerHTML = entriesWithMood.map(e => `
    <div class="mood-history-item">
      <div class="mood-history-emoji">${EMOTION_EMOJI[e.emotion]||'·'}</div>
      <div class="mood-history-info">
        <div class="mood-history-name">${e.emotion}</div>
        <div class="mood-history-date">${formatDatetime(e.created_at)} ${e.title ? '· '+escapeHTML(e.title) : ''}</div>
      </div>
    </div>
  `).join('');
}

// ── MEMORIES ──────────────────────────────────────────────────────────────────
async function loadMemories() {
  await fetchEntries();
  const grid = $('memories-grid');
  const empty = $('memories-empty');
  const photos = [];
  allEntries.forEach(e => {
    (e.photos||[]).forEach(url => photos.push({ url, entry: e }));
  });
  if (!photos.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = photos.map(({ url, entry }) => `
    <div class="memory-thumb" data-id="${entry.id}">
      <img src="${url}" alt="" loading="lazy" />
      <div class="memory-thumb-overlay">${formatDate(entry.created_at)}</div>
    </div>
  `).join('');
  grid.querySelectorAll('.memory-thumb').forEach(t => {
    t.addEventListener('click', () => openDetail(t.dataset.id));
  });
}

// ── NEW ENTRY MODAL ───────────────────────────────────────────────────────────
function openNewEntry() {
  editingEntry    = null;
  selectedEmotion = null;
  selectedEnergy  = null;
  pendingPhotos   = [];
  tags            = [];

  $('modal-title').textContent = 'New Entry';
  $('entry-title').value       = '';
  $('entry-body').value        = '';
  $('entry-location').value    = '';
  $('entry-song').value        = '';
  $('entry-date').value        = localNow();
  $('photo-preview').innerHTML = '';
  $('tags-list').innerHTML     = '';
  $('tags-input').value        = '';

  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('selected'));

  openModal(entryModal);
}

function openModal(modal) {
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(modal) {
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

// Triggers
$('new-entry-btn').addEventListener('click', openNewEntry);
$('sidebar-new-btn')?.addEventListener('click', openNewEntry);
$('topbar-new-btn').addEventListener('click', openNewEntry);
$('quick-write-trigger').addEventListener('click', openNewEntry);
$('bnav-new').addEventListener('click', e => { e.preventDefault(); openNewEntry(); });

$('modal-close').addEventListener('click', () => closeModal(entryModal));
entryModal.addEventListener('click', e => { if(e.target===entryModal) closeModal(entryModal); });

// Emotion picker
document.querySelectorAll('.emotion-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
    if (selectedEmotion === btn.dataset.emotion) {
      selectedEmotion = null;
    } else {
      btn.classList.add('selected');
      selectedEmotion = btn.dataset.emotion;
    }
  });
});

// Energy picker
document.querySelectorAll('.energy-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('selected'));
    if (selectedEnergy === +btn.dataset.level) {
      selectedEnergy = null;
    } else {
      btn.classList.add('selected');
      selectedEnergy = +btn.dataset.level;
    }
  });
});

// Location detect
$('detect-location').addEventListener('click', () => {
  if (!navigator.geolocation) { showToast('Geolocation not supported'); return; }
  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lon } = pos.coords;
    try {
      const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
      const data = await res.json();
      const loc  = data.address?.city || data.address?.town || data.address?.village
        || data.address?.county || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      $('entry-location').value = loc;
    } catch {
      $('entry-location').value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  }, () => showToast('Could not get location'));
});

// Photo upload
$('photo-add-btn').addEventListener('click', () => $('photo-input').click());
$('photo-input').addEventListener('change', e => {
  [...e.target.files].forEach(file => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      pendingPhotos.push({ file, dataUrl: ev.target.result });
      renderPhotoPreview();
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
});

function renderPhotoPreview() {
  const preview = $('photo-preview');
  preview.innerHTML = pendingPhotos.map((p, i) => `
    <div class="photo-thumb-wrap">
      <img src="${p.dataUrl}" alt="" />
      <button class="photo-remove-btn" data-idx="${i}">✕</button>
    </div>
  `).join('');
  preview.querySelectorAll('.photo-remove-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingPhotos.splice(+btn.dataset.idx, 1);
      renderPhotoPreview();
    });
  });
}

// Tags
$('tags-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = $('tags-input').value.trim().toLowerCase().replace(/[^a-z0-9\-_]/g,'');
    if (val && !tags.includes(val) && tags.length < 10) {
      tags.push(val);
      renderTags();
    }
    $('tags-input').value = '';
  }
  if (e.key === 'Backspace' && !$('tags-input').value && tags.length) {
    tags.pop(); renderTags();
  }
});
function renderTags() {
  $('tags-list').innerHTML = tags.map((t,i) => `
    <span class="tag-chip">#${escapeHTML(t)}<button data-idx="${i}">✕</button></span>
  `).join('');
  $('tags-list').querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => { tags.splice(+b.dataset.idx,1); renderTags(); });
  });
}

// SAVE ENTRY
$('modal-save').addEventListener('click', saveEntry);

async function saveEntry() {
  const title    = $('entry-title').value.trim();
  const body     = $('entry-body').value.trim();
  const location = $('entry-location').value.trim();
  const song     = $('entry-song').value.trim();
  const dateVal  = $('entry-date').value;

  if (!body && !title) { showToast('Write something first ✍️'); return; }

  const btn = $('modal-save');
  btn.textContent = 'Saving…'; btn.disabled = true;

  try {
    // Upload photos
    const photoUrls = [];
    for (const p of pendingPhotos) {
      const ext  = p.file.name.split('.').pop();
      const path = `${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await db.storage.from('journal-photos').upload(path, p.file, { contentType: p.file.type });
      if (!upErr) {
        const { data: urlData } = db.storage.from('journal-photos').getPublicUrl(path);
        photoUrls.push(urlData.publicUrl);
      } else {
        // fallback: store dataUrl if storage not configured
        photoUrls.push(p.dataUrl);
      }
    }

    const payload = {
      user_id:    currentUser.id,
      title:      title || null,
      body:       body || null,
      emotion:    selectedEmotion,
      energy:     selectedEnergy,
      location:   location || null,
      song:       song || null,
      tags:       tags,
      photos:     photoUrls,
      created_at: dateVal ? new Date(dateVal).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (editingEntry) {
      await db.from('entries').update(payload).eq('id', editingEntry.id);
      showToast('Entry updated ✓');
    } else {
      await db.from('entries').insert(payload);
      showToast('Entry saved ✓');
    }

    closeModal(entryModal);
    await loadDashboard();
    if (currentView === 'entries') loadAllEntries();

  } catch (err) {
    showToast('Error saving entry');
    console.error(err);
  }

  btn.textContent = 'Save'; btn.disabled = false;
}

// ── ENTRY DETAIL ──────────────────────────────────────────────────────────────
async function openDetail(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return;

  const emoji = entry.emotion ? EMOTION_EMOJI[entry.emotion] : '';
  const photos = (entry.photos||[]).map(url => `
    <div class="detail-photo"><img src="${url}" alt="" loading="lazy"/></div>
  `).join('');
  const tagsHTML = (entry.tags||[]).map(t => `<span class="entry-tag">#${escapeHTML(t)}</span>`).join('');

  const chips = [];
  chips.push(`<div class="detail-chip">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    ${formatDatetime(entry.created_at)}
  </div>`);
  if (entry.emotion) chips.push(`<div class="detail-chip">${emoji} ${entry.emotion}</div>`);
  if (entry.energy)  chips.push(`<div class="detail-chip">⚡ Energy ${entry.energy}/5</div>`);
  if (entry.location) chips.push(`<div class="detail-chip">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
    ${escapeHTML(entry.location)}
  </div>`);
  if (entry.song) chips.push(`<div class="detail-chip">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
    ${escapeHTML(entry.song)}
  </div>`);

  $('detail-body').innerHTML = `
    ${entry.title ? `<div class="detail-entry-title">${escapeHTML(entry.title)}</div>` : ''}
    <div class="detail-meta-row">${chips.join('')}</div>
    ${entry.body ? `<div class="detail-entry-body">${escapeHTML(entry.body)}</div>` : ''}
    ${photos ? `<div class="detail-photos-grid">${photos}</div>` : ''}
    ${tagsHTML ? `<div class="detail-tags-row">${tagsHTML}</div>` : ''}
  `;

  $('detail-delete').dataset.id = id;
  openModal(detailModal);
}

$('detail-close').addEventListener('click', () => closeModal(detailModal));
detailModal.addEventListener('click', e => { if(e.target===detailModal) closeModal(detailModal); });

$('detail-delete').addEventListener('click', async () => {
  const id = $('detail-delete').dataset.id;
  if (!confirm('Delete this entry?')) return;
  await db.from('entries').delete().eq('id', id);
  allEntries = allEntries.filter(e => e.id !== id);
  closeModal(detailModal);
  showToast('Entry deleted');
  renderRecentEntries();
  renderStats();
  renderMoodWeek();
  if (currentView === 'entries') renderAllEntries(allEntries);
  if (currentView === 'memories') loadMemories();
});

// ── PWA SERVICE WORKER ────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
initAuth();
