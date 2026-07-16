/* ─── CONSTANTS ─── */
const LOGO = 'https://raw.githubusercontent.com/Devilakv/Bgmi/refs/heads/main/70dabcedd7b19ab4bd947e66390201b1.jpg';
const LIB_URL = 'https://raw.githubusercontent.com/Devilakv/Xzzz/refs/heads/main/library.json?t=';
const FB = 'https://akv-library-default-rtdb.asia-southeast1.firebasedatabase.app/';

/* ─── STATE ─── */
let ALL = [], FILTERED = [];
let CUR_BOOK = null;
let PREV_PAGE = 'home', CUR_PAGE = 'home';
let CBZ_URLS = [];
let CHAP_DATA = [], CHAP_PAGE = 0, CHAP_ASC = false, CHAP_PER = 20;
let CUR_CHAP_IDX = 0;

/* ─── LOCAL STORAGE ─── */
const ls = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lss = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ─── TOAST ─── */
let _tt;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ─── ROUTER ─── */
function nav(page, bookData) {
  const target = document.getElementById('p-' + page);
  if (!target) { toast('Page not found: ' + page); return; }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  target.classList.add('active');
  PREV_PAGE = CUR_PAGE; CUR_PAGE = page;
  const sa = document.querySelector('#p-' + page + ' .sa');
  if (sa) sa.scrollTop = 0;
  if (page === 'home')           initHome();
  else if (page === 'list')      initList();
  else if (page === 'details')   initDetails(bookData);
  else if (page === 'reader')    initReader();
  else if (page === 'pdf')       initPdf();
  else if (page === 'categories') initCategories();
  else if (page === 'notifications') initNotifs();
  else if (page === 'profile')   initProfile();
  else if (page === 'settings')  initSettingsPage();
  else if (page === 'filter')    initFilterPage();
  else if (page === 'notifsettings') initNotifSettingsPage();
  else if (page === 'login')     initLogin();
  else if (page === 'admin')     initAdmin();
}

/* ─── AUTH HELPERS ─── */
function authUser(){ return ls('authUser'); }
function isAdmin(){ const u = authUser(); return !!u && u.role === 'admin'; }
function openAccount(){ authUser() ? nav('profile') : nav('login'); }
function openAdmin(){ if (!isAdmin()) { toast('🔒 Admin only — sign in with an admin account'); return; } nav('admin'); }

/* ─── FALLBACK LOCAL DATA ─── */
const LOCAL_DATA = [
  {
    id:'reverend-insanity',title:'Reverend Insanity',cover:LOGO,
    category:'Fantasy',theme:'Martial Arts',type:'CBZ',format:'Manhwa',
    studio:'Acqq, KuaiKan',published:'2024',publicationStatus:'Cancelled',translationStatus:'Completed',
    rating:'9.8',ratingCount:'1',chapter:'Chap 96',currentChapter:'Chap 96',totalChapters:'96',
    documentUrl:'https://files.catbox.moe/br57ql.cbz',lastRead:'1m',updated:'2h',added:'6mo',
    metrics:{comments:425,likes:1840},
    description:'A mountain of corpses, a sea of blood. At the summit, only two people remained.\n\nThis is the story of Fang Yuan as uses the Spring Autumn Cicada to rebirth back 500 years into his past to change his destiny, defy the heavens, and tread a dark path toward absolute immortality.'
  },
  {
    id:'100th-regression',title:'The 100th Regression',cover:LOGO,
    category:'Fantasy',theme:'Regression',type:'PDF',format:'Novel',
    studio:'AKV Novels',published:'2026',publicationStatus:'Ongoing',translationStatus:'Completed',
    rating:'9.5',ratingCount:'1',chapter:'Vol 1',currentChapter:'Vol 1',totalChapters:'50',
    documentUrl:'https://files.catbox.moe/21ajem.pdf',lastRead:'10m',updated:'3h',added:'2d',
    metrics:{comments:14,likes:42},
    description:'A warrior reborn into the same deadly loop 100 times seeks to break free. Each regression unlocks buried memories and hidden powers that reshape the battlefield — and destiny itself.'
  }
];

/* ─── GENERATE CHAPTERS ─── */
function generateChapters(total, type, docUrl) {
  const groups = ['Timelessleaf','(low quality)','A&V STUDIO','(fan scan)'];
  const times = ['3 years','2 years','1 year','8 months','3 months','1 month','2 weeks','5 days','2 days','1 day'];
  const chs = [];
  const url = docUrl || (type === 'PDF' ? 'https://files.catbox.moe/21ajem.pdf' : 'https://files.catbox.moe/br57ql.cbz');
  for (let i = total; i >= 1; i--) {
    const isEnd = i === total;
    const g1 = groups[Math.floor(Math.random()*2)];
    const t = times[Math.min(Math.floor((total-i)/total*times.length), times.length-1)];
    chs.push({
      chap: i, isEnd,
      entries: [{ upvotes: Math.floor(Math.random()*300)+5, time: t, group: g1, url, type }]
    });
  }
  return chs;
}

/* ─── PROCESS BOOK ─── */
function processBook(b) {
  const totalChaps = parseInt(b.totalChapters) || 10;
  const type = b.type || 'CBZ';
  if (b.chapters && Array.isArray(b.chapters) && b.chapters.length > 0) {
    const maxChap = Math.max(...b.chapters.map(c => c.chap || 0));
    return { ...b, chapters: b.chapters, totalChapters: String(maxChap || b.chapters.length) };
  }
  return { ...b, chapters: generateChapters(totalChaps, type, b.documentUrl) };
}

/* ─── FETCH LIBRARY ─── */
async function fetchLib() {
  const custom = ls('customLibrary');
  if (custom && Array.isArray(custom) && custom.length) {
    ALL = applyCachedMetadata(custom.map(processBook));
    return;
  }
  try {
    const r = await fetch(LIB_URL + Date.now());
    if (!r.ok) throw 0;
    const d = await r.json();
    if (Array.isArray(d) && d.length) {
      ALL = applyCachedMetadata(d.map(processBook));
      return;
    }
    throw 0;
  } catch {
    ALL = applyCachedMetadata(LOCAL_DATA.map(processBook));
  }
}

/* ─── RELOAD LIBRARY (MERGE LOGIC) ─── */
async function reloadLibrary() {
  if (!isAdmin()) { toast('🔒 Admin only'); return; }
  toast('🔄 Syncing with GitHub…');
  try {
    const r = await fetch(LIB_URL + Date.now());
    if (!r.ok) throw new Error('Network error');
    const githubData = await r.json();
    
    let currentLibrary = ls('customLibrary') || ALL.map(({chapters, ...rest}) => rest);
    let added = 0;
    let updated = 0;

    if (Array.isArray(githubData)) {
      githubData.forEach(gitBook => {
        const idx = currentLibrary.findIndex(b => b.id === gitBook.id);
        if (idx === -1) {
          currentLibrary.push(gitBook);
          added++;
        } else if (!currentLibrary[idx].imported) {
          currentLibrary[idx] = { ...currentLibrary[idx], ...gitBook };
          updated++;
        }
      });
    }

    lss('customLibrary', currentLibrary);
    ALL = applyCachedMetadata(currentLibrary.map(processBook));
    FILTERED = applyContentFilters(ALL);
    
    renderFeatured(ALL);
    renderGrid(FILTERED);
    toast(`✅ Sync Complete: ${added} new, ${updated} updated!`);
  } catch (e) {
    toast('❌ Failed to fetch from GitHub');
  }
}

/* ══════════════ METADATA API SYSTEM ══════════════ */

function normTitle(t){ return (t||'').toLowerCase().replace(/[^a-z0-9\s]/g,'').replace(/\s+/g,' ').trim(); }

function detectBookType(b){
  const s = ((b.format||'') + ' ' + (b.type||'') + ' ' + (b.category||'')).toLowerCase();
  if (s.includes('novel')) return 'novel';
  if (s.includes('manhwa')) return 'manhwa';
  if (s.includes('manhua')) return 'manhua';
  return 'manga';
}

/* AniList GraphQL engine */
async function fetchAniListMeta(title) {
  const query = `query($search:String){Media(search:$search,type:MANGA,sort:SEARCH_MATCH){id title{romaji english} coverImage{extraLarge} description staff(perPage:5){edges{role node{name{full}}}} genres status format countryOfOrigin averageScore}}`;
  try {
    const r = await fetch('https://graphql.anilist.co', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query, variables:{search:title}}) });
    const d = await r.json();
    const m = d?.data?.Media;
    if (!m) return null;
    let artist = '';
    (m.staff?.edges || []).forEach(e => {
      const role = (e.role||'').toLowerCase();
      if (!artist && (role.includes('art') || role.includes('draw') || role.includes('illustrat'))) artist = e.node?.name?.full;
    });
    return {
      _metaSrc: 'anilist',
      cover: m.coverImage?.extraLarge,
      description: m.description?.replace(/<[^>]+>/g, ''),
      artist: artist || null,
      format: m.format,
      rating: m.averageScore ? (m.averageScore/10).toFixed(1) : null
    };
  } catch { return null; }
}

/* MyAnimeList/Jikan Engine */
async function fetchJikanMeta(title) {
  try {
    const r = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(title)}&limit=1`);
    if (!r.ok) return null;
    const d = await r.json();
    const m = d?.data?.[0];
    if (!m) return null;
    return {
      _metaSrc: 'jikan',
      cover: m.images?.webp?.large_image_url || m.images?.jpg?.large_image_url,
      description: m.synopsis,
      format: m.type,
      rating: m.score ? String(m.score) : null
    };
  } catch { return null; }
}

async function fetchMetaForBook(book) {
  const title = book.title;
  if (!title) return null;
  let meta = await fetchAniListMeta(title);
  if (!meta || !meta.description) {
    const jmeta = await fetchJikanMeta(title);
    if (jmeta) {
      meta = Object.assign({}, jmeta, meta ? {
        cover: (meta.cover || jmeta.cover),
        description: (meta.description || jmeta.description),
        genres: (meta.genres || jmeta.genres),
        _metaSrc: 'anilist+jikan'
      } : {});
    }
  }
  return meta;
}

function applyMetaToBook(book, meta) {
  if (!meta) return book;
  const b = { ...book };
  if (meta.cover && (!b.cover || b.cover === LOGO)) b.cover = meta.cover;
  if (meta.description && !b.description) b.description = meta.description;
  if (meta.artist && !b.artist) b.artist = meta.artist;
  if (meta.genres && !b.category) b.category = meta.genres.split(', ')[0];
  if (meta.genres && !b.theme) b.theme = meta.genres;
  if (meta.published && !b.published) b.published = meta.published;
  if (meta.publicationStatus && !b.publicationStatus) b.publicationStatus = meta.publicationStatus;
  if (meta.anilistScore && (!b.rating || b.rating === '9.8')) b.rating = meta.anilistScore;
  if (meta.malScore && (!b.rating || b.rating === '9.8')) b.rating = meta.malScore;
  b._metaSrc = meta._metaSrc;
  b._metaFetched = Date.now();
  return b;
}

function applyCachedMetadata(books) {
  const cache = ls('metaCache') || {};
  return books.map(b => {
    const m = cache[b.id];
    return m ? applyMetaToBook(b, m) : b;
  });
}

/* ─── BULK SYNC FUNCTIONS ─── */
let _metaRefreshRunning = false;

async function reloadAllMetadata() {
  if (!isAdmin()) { toast('🔒 Admin only'); return; }
  if (_metaRefreshRunning) { toast('⏳ Already refreshing metadata…'); return; }
  if (!ALL.length) { toast('⚠️ Load library first'); return; }
  
  _metaRefreshRunning = true;
  toast(`🔍 Fetching metadata for ${ALL.length} titles…`);

  let done = 0, updated = 0;
  const metaCache = {};
  
  for (let i = 0; i < ALL.length; i++) {
    const book = ALL[i];
    try {
      const meta = await fetchMetaForBook(book);
      if (meta) {
        metaCache[book.id] = meta;
        ALL[i] = applyMetaToBook(book, meta);
        updated++;
      }
    } catch {}
    if (i < ALL.length - 1) await new Promise(res => setTimeout(res, 850));
  }

  lss('metaCache', metaCache);
  const custom = ls('customLibrary');
  if (custom && Array.isArray(custom)) {
    const enriched = custom.map(b => {
      const m = metaCache[b.id];
      return m ? applyMetaToBook(b, m) : b;
    });
    lss('customLibrary', enriched);
  }

  FILTERED = applyContentFilters(ALL);
  renderFeatured(ALL);
  renderGrid(FILTERED);
  if (CUR_PAGE === 'list') renderList(LIST_BOOKS);

  _metaRefreshRunning = false;
  toast(`✅ Metadata refreshed: ${updated} / ${ALL.length} titles enriched`);
}

async function handleAniListFetchClick() {
  const val = document.getElementById('aniListIdInput').value.trim();
  if(!val) { toast('Please input a Title or ID string.'); return; }
  
  toast('📡 Fetching from AniList...');
  const fetchedData = await fetchAniListMeta(val);
  if(fetchedData) {
    let currentLibraryData = ls('customLibrary') || [];
    if (!currentLibraryData.length && ALL.length) {
      currentLibraryData = ALL.map(({chapters, ...rest}) => rest);
    }
    
    const extractedBook = processBook({ id: `anilist-${Date.now()}`, ...fetchedData, imported: false });
    
    currentLibraryData = currentLibraryData.filter(b => b.title.toLowerCase() !== extractedBook.title.toLowerCase());
    currentLibraryData.unshift(extractedBook);
    
    lss('customLibrary', currentLibraryData);
    ALL = currentLibraryData.map(processBook);
    FILTERED = applyContentFilters(ALL);
    
    document.getElementById('jsonEditor').value = JSON.stringify(currentLibraryData, null, 2);
    renderFeatured(ALL);
    renderGrid(FILTERED);
    openBook(extractedBook);
    closeJsonModal();
    toast('✨ Sync complete!');
  } else {
    toast('❌ No results on AniList');
  }
}

async function handleMalFetchClick() {
  const val = document.getElementById('malIdInput').value.trim();
  if(!val) { toast('Please input a Title or ID string.'); return; }

  toast('📡 Fetching from MyAnimeList...');
  const fetchedData = await fetchJikanMeta(val);
  if(fetchedData) {
    let currentLibraryData = ls('customLibrary') || [];
    if (!currentLibraryData.length && ALL.length) {
      currentLibraryData = ALL.map(({chapters, ...rest}) => rest);
    }

    const extractedBook = processBook({ id: `mal-${Date.now()}`, ...fetchedData, imported: false });

    currentLibraryData = currentLibraryData.filter(b => b.title.toLowerCase() !== extractedBook.title.toLowerCase());
    currentLibraryData.unshift(extractedBook);

    lss('customLibrary', currentLibraryData);
    ALL = currentLibraryData.map(processBook);
    FILTERED = applyContentFilters(ALL);

    document.getElementById('jsonEditor').value = JSON.stringify(currentLibraryData, null, 2);
    renderFeatured(ALL);
    renderGrid(FILTERED);
    openBook(extractedBook);
    closeJsonModal();
    toast('✨ Sync complete!');
  } else {
    toast('❌ No results on MyAnimeList');
  }
}

/* ─── JSON EDITOR MODAL ─── */
function openJsonModal() {
  if (!isAdmin()) { toast('🔒 Admin only'); return; }
  const modal = document.getElementById('jsonModal');
  const editor = document.getElementById('jsonEditor');
  const status = document.getElementById('jsonStatus');
  const data = ALL.length ? ALL : LOCAL_DATA;
  const cleanData = data.map(b => {
    const copy = {...b};
    return copy;
  });
  editor.value = JSON.stringify(cleanData, null, 2);
  status.style.display = 'none';
  modal.classList.add('open');
}

function closeJsonModal() {
  document.getElementById('jsonModal').classList.remove('open');
}

function saveJsonEdit() {
  const editor = document.getElementById('jsonEditor');
  const status = document.getElementById('jsonStatus');
  try {
    const parsed = JSON.parse(editor.value);
    if (!Array.isArray(parsed)) throw new Error('JSON must be an array of books');
    if (!parsed.length) throw new Error('Array cannot be empty');
    lss('customLibrary', parsed);
    ALL = parsed.map(processBook);
    FILTERED = [...ALL];
    renderFeatured(ALL);
    renderGrid(FILTERED);
    status.textContent = '✅ Saved! Library updated with ' + ALL.length + ' books.';
    status.className = 'json-status json-ok';
    status.style.display = 'block';
    toast('✅ Library updated!');
    if (CUR_PAGE === 'profile') initProfile();
    setTimeout(() => closeJsonModal(), 1200);
  } catch(e) {
    status.textContent = '❌ Invalid JSON: ' + e.message;
    status.className = 'json-status json-err';
    status.style.display = 'block';
  }
}

/* ─── HOME ─── */
async function initHome() {
  if (!ALL.length) await fetchLib();
  FILTERED = applyContentFilters(ALL);
  renderFeatured(FILTERED.length ? FILTERED : ALL);
  renderGrid(FILTERED);
}

function renderFeatured(books) {
  const s = document.getElementById('fstrip');
  if (!s) return;
  books = books.filter(b => !b.imported);
  s.innerHTML = '';
  books.slice(0, 6).forEach(b => {
    const c = document.createElement('div');
    c.className = 'fcard';
    c.innerHTML = `<img src="${b.cover}" alt="${b.title}" loading="lazy">
      <div class="fov"><h3>${b.title}</h3><p>${b.category||'Manhwa'} · ${b.chapter||'Chap 1'}</p></div>`;
    c.onclick = () => openBook(b);
    s.appendChild(c);
  });
}

function renderGrid(books) {
  const g = document.getElementById('bgrid');
  if (!g) return;
  books = books.filter(b => !b.imported);
  g.innerHTML = '';
  if (!books.length) {
    g.innerHTML = `<div style="grid-column:1/-1" class="empty"><i class="fa-solid fa-search"></i><h3>No titles found</h3></div>`;
    return;
  }
  const favs = ls('favs') || [];
  books.forEach(b => {
    const c = document.createElement('div');
    c.className = 'bcard';
    
    // FORMAT OVERLAY TAG INSTEAD OF FILE TYPE
    const formatStr = b.format || 'Manga';
    const tc = formatStr.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const bm = favs.includes(b.id);
    
    c.innerHTML = `<div class="bcw">
      <img src="${b.cover}" alt="${b.title}" loading="lazy">
      <span class="btype ${tc}">${formatStr}</span>
      ${bm ? `<div class="bbk"><i class="fa-solid fa-bookmark"></i></div>` : ''}
    </div>
    <div class="bcb">
      <h3>${b.title}</h3>
      <div class="bcm">
        <span>${b.chapter||'Chap 1'}</span>
        <div class="bcm-r">
          <span><i class="fa-solid fa-comment"></i>${b.metrics?.comments||0}</span>
          <span><i class="fa-solid fa-heart"></i>${b.metrics?.likes||0}</span>
        </div>
      </div>
    </div>`;
    c.onclick = () => openBook(b);
    g.appendChild(c);
  });
}

function filterCat(el, cat) {
  document.querySelectorAll('.cpill').forEach(p => p.classList.remove('on'));
  el.classList.add('on');
  FILTERED = cat==='All' ? [...ALL] : ALL.filter(b =>
    (b.category||'').toLowerCase()===cat.toLowerCase() ||
    (b.type||'').toLowerCase()===cat.toLowerCase() ||
    (b.format||'').toLowerCase().includes(cat.toLowerCase())
  );
  renderGrid(FILTERED);
}

/* ─── OPEN BOOK ─── */
function openBook(book) {
  CUR_BOOK = book;
  lss('cur', book);
  nav('details', book);
}

/* ─── DETAILS ─── */
async function initDetails(book) {
  book = book || ls('cur');
  if (!book) { nav('home'); return; }
  CUR_BOOK = book;

  if (!book._metaFetched) {
    fetchMetaForBook(book).then(meta => {
      if (!meta) return;
      const cache = ls('metaCache') || {};
      cache[book.id] = meta;
      lss('metaCache', cache);
      const idx = ALL.findIndex(b => b.id === book.id);
      if (idx >= 0) ALL[idx] = applyMetaToBook(ALL[idx], meta);
      if (CUR_PAGE === 'details' && CUR_BOOK?.id === book.id) {
        const enriched = applyMetaToBook(CUR_BOOK, meta);
        CUR_BOOK = enriched;
        lss('cur', enriched);
        const cov = document.getElementById('d-cover');
        if (cov && enriched.cover && enriched.cover !== book.cover) cov.src = enriched.cover;
        const descEl = document.getElementById('d-desc');
        if (descEl && enriched.description && !book.description) {
          descEl.innerHTML = enriched.description.replace(/\n/g,'<br>');
        }
        const infoGrid = document.getElementById('d-info');
        if (infoGrid) {
          const metaSrcLabel = enriched._metaSrc
            ? `<div class="irow" style="margin-top:4px"><span class="ilbl" style="font-size:9.5px">Source:</span><span style="font-size:9.5px;color:var(--t3)">📡 ${enriched._metaSrc.toUpperCase()}</span></div>`
            : '';
          infoGrid.innerHTML = `
            ${enriched.artist ? `<div class="irow"><span class="ilbl">Artist:</span><span class="ival">${enriched.artist}</span></div>` : ''}
            <div class="irow"><span class="ilbl">Genres:</span><span class="ival">${enriched.theme || enriched.category||'–'}</span></div>
            <div class="irow"><span class="ilbl">Format:</span><span class="ival">${enriched.format||'Web Comic'}</span></div>
            <div class="irow"><span class="ilbl">Studio:</span><span class="ival">${enriched.studio||'A&V STUDIO'}</span></div>
            <div class="irow"><span class="ilbl">Published:</span><span class="ival">${enriched.published||'–'}</span></div>
            <div class="irow"><span class="ilbl">Pub. Status:</span><span class="ival">${enriched.publicationStatus||'–'}</span></div>
            <div class="irow"><span class="ilbl">Translation:</span><span class="ival">${enriched.translationStatus||'–'}</span></div>
            ${enriched.countryOfOrigin ? `<div class="irow"><span class="ilbl">Country:</span><span class="ival">${enriched.countryOfOrigin}</span></div>` : ''}
            ${metaSrcLabel}`;
        }
      }
    }).catch(() => {});
  }

  document.getElementById('d-back').onclick = () => nav(PREV_PAGE==='details'?'home':PREV_PAGE);
  document.getElementById('d-cover').src = book.cover || '';
  document.getElementById('d-title').textContent = book.title || '';
  const chapCount = book.chapters ? book.chapters.length : (parseInt(book.totalChapters) || '?');
  document.getElementById('d-meta').innerHTML = `
    <div class="mr"><span class="ml">Published:</span> <span class="tblue">${book.published||'–'}</span></div>
    <div class="mr"><span class="ml">Status:</span> 📖 ${book.publicationStatus||'Ongoing'}</div>
    <div class="mr"><span class="ml">Chapters:</span> <span class="tblue">${chapCount}</span></div>`;
  
  const descEl = document.getElementById('d-desc');
  const descTog = document.getElementById('desc-toggle');
  descEl.innerHTML = (book.description||'').replace(/\n/g,'<br>');
  descEl.classList.add('collapsed');
  descTog.textContent = 'Read more';
  
  const metaSrcLabel = book._metaSrc
    ? `<div class="irow" style="margin-top:4px"><span class="ilbl" style="font-size:9.5px">Source:</span><span style="font-size:9.5px;color:var(--t3)">📡 ${book._metaSrc.toUpperCase()}</span></div>`
    : '';
  
  document.getElementById('d-info').innerHTML = `
    ${book.artist ? `<div class="irow"><span class="ilbl">Artist:</span><span class="ival">${book.artist}</span></div>` : ''}
    <div class="irow"><span class="ilbl">Genres:</span><span class="ival">${book.theme || book.category||'–'}</span></div>
    <div class="irow"><span class="ilbl">Format:</span><span class="ival">${book.format||'Web Comic'}</span></div>
    <div class="irow"><span class="ilbl">Studio:</span><span class="ival">${book.studio||'A&V STUDIO'}</span></div>
    <div class="irow"><span class="ilbl">Published:</span><span class="ival">${book.published||'–'}</span></div>
    <div class="irow"><span class="ilbl">Pub. Status:</span><span class="ival">${book.publicationStatus||'–'}</span></div>
    <div class="irow"><span class="ilbl">Translation:</span><span class="ival">${book.translationStatus||'–'}</span></div>
    ${book.countryOfOrigin ? `<div class="irow"><span class="ilbl">Country:</span><span class="ival">${book.countryOfOrigin}</span></div>` : ''}
    ${metaSrcLabel}`;
    
  const chapN = String(book.currentChapter||book.chapter||'').replace(/[^0-9]/g,'');
  document.getElementById('d-readtxt').textContent = chapN ? `Continue Ch.${chapN}` : 'Read Now';
  const states = ls('states') || {};
  document.getElementById('d-status').value = states[book.id] || book.status || 'Reading';
  document.getElementById('d-status').onchange = e => {
    const s2 = ls('states')||{}; s2[book.id]=e.target.value; lss('states',s2);
    toast('Status: '+e.target.value);
  };
  const favs = ls('favs') || [];
  setNotifyBtn(favs.includes(book.id));
  document.getElementById('d-notify').onclick = () => {
    let f = ls('favs') || [];
    const was = f.includes(book.id);
    f = was ? f.filter(x=>x!==book.id) : [...new Set([...f, book.id])];
    lss('favs', f);
    setNotifyBtn(!was);
    toast(was?'Removed from favorites':'❤️ Added to favorites');
    renderGrid(FILTERED);
  };
  document.getElementById('d-share').onclick = () => {
    if (navigator.share) navigator.share({title:book.title,text:(book.description||'').slice(0,120),url:location.href}).catch(()=>{});
    else { navigator.clipboard?.writeText(location.href).then(()=>toast('Link copied!')); }
  };
  document.getElementById('d-readbtn').onclick = () => {
    const chs = book.chapters || [];
    const curN = parseInt(String(book.currentChapter||book.chapter||'').replace(/[^0-9]/g,''), 10);
    const c = chs.find(x => x.chap === curN) || chs[chs.length-1] || null;
    const e = c?.entries?.[0] || {};
    const u = e.url || book.documentUrl || '';
    const t = (e.type || book.type || '').toLowerCase();
    const idx = c ? chs.indexOf(c) : 0;
    lss('chapIdx', idx); CUR_CHAP_IDX = idx;
    if (t==='pdf' || u.toLowerCase().endsWith('.pdf')) {
      lss('pdfUrl', u); if (c) lss('pdfChap', c.chap);
      nav('pdf');
    } else {
      lss('cbzUrl', u); if (c) lss('cbzChap', c.chap);
      nav('reader');
    }
  };
  loadRating(book);
  document.getElementById('yrt-trigger').onclick = () => {
    const w = document.getElementById('yr-wrap');
    w.style.display = w.style.display==='none'?'block':'none';
  };
  document.getElementById('yr-sel').onchange = e => {
    document.getElementById('yr-wrap').style.display='none';
    submitRating(book, e.target.value);
  };
  CHAP_DATA = book.chapters || generateChapters(parseInt(book.totalChapters)||10, book.type||'CBZ', book.documentUrl);
  CHAP_PAGE = 0; CHAP_ASC = false;
  buildGroupFilter();
  renderChapters();
}

function setNotifyBtn(on) {
  const b = document.getElementById('d-notify');
  if (!b) return;
  b.className = 'nbtn'+(on?' fol':'');
}

function toggleDesc() {
  const el = document.getElementById('d-desc');
  const btn = document.getElementById('desc-toggle');
  if (el.classList.contains('collapsed')) {
    el.classList.remove('collapsed');
    btn.textContent = 'Show less';
  } else {
    el.classList.add('collapsed');
    btn.textContent = 'Read more';
  }
}

/* ─── RATING ─── */
async function loadRating(book) {
  const def = parseFloat(book.rating||'9.8');
  const defN = parseInt(book.ratingCount||'1',10);
  const ur = ls('ratings') || {};
  const prev = ur[book.id] || 'none';
  document.getElementById('yr-sel').value = prev;
  if (prev!=='none') {
    document.getElementById('yr-star').innerHTML=`<i class="fa-solid fa-star" style="color:var(--acc2)"></i>`;
    const v=document.getElementById('yr-val'); v.textContent=prev; v.style.display='inline';
  }
  let sum=def*defN, cnt=defN;
  try {
    const r=await fetch(`${FB}ratings/${book.id}.json`);
    if (r.ok){const d=await r.json();if(d){sum=d.sumPoints??sum;cnt=d.totalVotes??cnt;}}
  } catch{}
  const avg=cnt>0?(sum/cnt).toFixed(1):def.toFixed(1);
  const se=document.getElementById('d-score');
  const ce=document.getElementById('d-rcnt');
  if(se)se.textContent=avg;
  if(ce)ce.textContent=`(${cnt} rating${cnt!==1?'s':''})`;
}

async function submitRating(book, nv) {
  const ur=ls('ratings')||{};
  const pv=ur[book.id]||'none';
  const def=parseFloat(book.rating||'9.8'),defN=parseInt(book.ratingCount||'1',10);
  let sum=def*defN,cnt=defN;
  try {
    const r=await fetch(`${FB}ratings/${book.id}.json`);
    if(r.ok){const d=await r.json();if(d){sum=d.sumPoints??sum;cnt=d.totalVotes??cnt;}}
    if(pv!=='none'){sum-=parseInt(pv,10);cnt-=1;}
    if(nv!=='none'){sum+=parseInt(nv,10);cnt+=1;}
    await fetch(`${FB}ratings/${book.id}.json`,{
      method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({sumPoints:sum,totalVotes:cnt})
    });
    if(nv==='none')delete ur[book.id]; else ur[book.id]=nv;
    lss('ratings',ur);
    const avg=cnt>0?(sum/cnt).toFixed(1):def.toFixed(1);
    const se=document.getElementById('d-score'),ce=document.getElementById('d-rcnt');
    if(se)se.textContent=avg;
    if(ce)ce.textContent=`(${cnt} ratings)`;
    const star=document.getElementById('yr-star'),val=document.getElementById('yr-val');
    if(nv!=='none'){
      if(star)star.innerHTML=`<i class="fa-solid fa-star" style="color:var(--acc2)"></i>`;
      if(val){val.textContent=nv;val.style.display='inline';}
    } else {
      if(star)star.innerHTML=`<i class="fa-regular fa-star"></i>`;
      if(val)val.style.display='none';
    }
    toast(nv==='none'?'Rating removed':`Rated ${nv}/10`);
  } catch(e){ toast('Could not save rating'); }
}

/* ─── CHAPTER LIST & COMICK API SYNC ─── */
async function syncChaptersFromComick() {
  const book = CUR_BOOK;
  if (!book) return;
  toast('📡 Fetching chapters from Comick...');

  try {
    const res = await fetch(`https://api.comick.dev/v1.0/search?q=${encodeURIComponent(book.title)}&limit=1`);
    const data = await res.json();
    if (!data || !data.length) { toast('❌ Comic not found on Comick'); return; }
    const comicHid = data[0].hid;

    const chRes = await fetch(`https://api.comick.dev/comic/${comicHid}/chapters?lang=en&limit=200`);
    const chData = await chRes.json();

    if (!chData.chapters || !chData.chapters.length) { toast('❌ No English chapters found'); return; }

    const chaptersMap = {};
    chData.chapters.forEach(c => {
      const chapNum = c.chap || '1';
      if (!chaptersMap[chapNum]) chaptersMap[chapNum] = [];
      const group = c.group_name && c.group_name.length ? c.group_name[0] : 'Comick';
      chaptersMap[chapNum].push({
        upvotes: c.upc || 0,
        time: new Date(c.created_at).toLocaleDateString(),
        group: group,
        url: c.hid, // This is the chapterHid we use for reading later
        type: 'COMICK'
      });
    });

    const formattedChaps = Object.keys(chaptersMap)
      .sort((a,b) => parseFloat(b) - parseFloat(a))
      .map(chapNum => {
        return { chap: chapNum, isEnd: false, entries: chaptersMap[chapNum] };
      });

    if (formattedChaps.length) {
      book.chapters = formattedChaps;
      book.type = 'COMICK';
      book.totalChapters = String(Math.max(...formattedChaps.map(c => parseFloat(c.chap))));

      let lib = ls('customLibrary') || ALL.map(({chapters, ...r})=>r);
      const idx = lib.findIndex(b => b.id === book.id);
      if (idx !== -1) {
         lib[idx].chapters = formattedChaps;
         lib[idx].type = 'COMICK';
         lib[idx].totalChapters = book.totalChapters;
      } else {
         lib.push(book);
      }
      lss('customLibrary', lib);
      ALL = applyCachedMetadata(lib.map(processBook));

      CHAP_DATA = formattedChaps;
      buildGroupFilter();
      renderChapters();
      toast('✨ Successfully synced chapters from Comick!');
    }
  } catch (e) {
    toast('❌ Error connecting to Comick API');
  }
}

/* ─── MANGADEX API SYNC ─── */
async function syncChaptersFromMangaDex() {
  const book = CUR_BOOK;
  if (!book) return;

  const btn = document.getElementById('mangadex-sync-btn');
  if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }
  toast('📡 Fetching chapters from MangaDex...');

  try {
    // Step 1: Search for the manga
    const searchRes = await fetch(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(book.title)}&limit=5&includes[]=author&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
    );
    if (!searchRes.ok) throw new Error('MangaDex search failed');
    const searchData = await searchRes.json();
    if (!searchData.data || !searchData.data.length) { toast('❌ Manga not found on MangaDex'); return; }

    const mangaId = searchData.data[0].id;

    // Step 2: Fetch English chapters in batches (max 500 per request)
    let allChapters = [];
    let offset = 0;
    const limit = 500;
    while (true) {
      const feedRes = await fetch(
        `https://api.mangadex.org/manga/${mangaId}/feed?translatedLanguage[]=en&limit=${limit}&offset=${offset}&order[chapter]=desc&includes[]=scanlation_group&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica`
      );
      if (!feedRes.ok) throw new Error('MangaDex feed fetch failed');
      const feedData = await feedRes.json();
      const batch = feedData.data || [];
      allChapters = allChapters.concat(batch);
      if (batch.length < limit) break;
      offset += limit;
    }

    if (!allChapters.length) { toast('❌ No English chapters found on MangaDex'); return; }

    // Step 3: Format chapters into app format
    const chaptersMap = {};
    allChapters.forEach(c => {
      const chapNum = c.attributes.chapter || '1';
      if (!chaptersMap[chapNum]) chaptersMap[chapNum] = [];
      const groupRel = (c.relationships || []).find(r => r.type === 'scanlation_group');
      const groupName = groupRel?.attributes?.name || 'MangaDex';
      const pubAt = c.attributes.publishAt || c.attributes.createdAt || '';
      chaptersMap[chapNum].push({
        upvotes: 0,
        time: pubAt ? new Date(pubAt).toLocaleDateString() : '–',
        group: groupName,
        url: c.id,   // MangaDex chapter UUID used in reader
        type: 'MANGADEX'
      });
    });

    const formattedChaps = Object.keys(chaptersMap)
      .sort((a, b) => parseFloat(b) - parseFloat(a))
      .map(chapNum => ({ chap: chapNum, isEnd: false, entries: chaptersMap[chapNum] }));

    if (formattedChaps.length) {
      book.chapters = formattedChaps;
      book.type = 'MANGADEX';
      book.totalChapters = String(Math.max(...formattedChaps.map(c => parseFloat(c.chap))));

      let lib = ls('customLibrary') || ALL.map(({ chapters, ...r }) => r);
      const idx = lib.findIndex(b => b.id === book.id);
      if (idx !== -1) {
        lib[idx].chapters = formattedChaps;
        lib[idx].type = 'MANGADEX';
        lib[idx].totalChapters = book.totalChapters;
      } else {
        lib.push(book);
      }
      lss('customLibrary', lib);
      ALL = applyCachedMetadata(lib.map(processBook));

      CHAP_DATA = formattedChaps;
      buildGroupFilter();
      renderChapters();
      toast(`✨ MangaDex sync done! ${formattedChaps.length} chapters loaded`);
    }
  } catch (e) {
    toast('❌ Error connecting to MangaDex API: ' + (e.message || ''));
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

/* ─── ADMIN: REFRESH API CHAPTER SOURCES ─── */
async function adminRefreshComick() {
  if (!isAdmin()) { toast('🔒 Admin only'); return; }
  const sel = document.getElementById('admApiBookSel');
  const bookId = sel?.value;
  if (!bookId) { toast('Select a book first'); return; }
  const book = ALL.find(b => b.id === bookId);
  if (!book) { toast('Book not found'); return; }
  CUR_BOOK = book;
  const status = document.getElementById('admApiStatus');
  if (status) { status.style.display = 'block'; status.style.background = 'rgba(99,102,241,.1)'; status.style.color = 'var(--acc2)'; status.textContent = '⏳ Refreshing Comick chapters…'; }
  await syncChaptersFromComick();
  if (status) { status.textContent = '✅ Comick refresh complete for: ' + book.title; }
}

async function adminRefreshMangaDex() {
  if (!isAdmin()) { toast('🔒 Admin only'); return; }
  const sel = document.getElementById('admApiBookSel');
  const bookId = sel?.value;
  if (!bookId) { toast('Select a book first'); return; }
  const book = ALL.find(b => b.id === bookId);
  if (!book) { toast('Book not found'); return; }
  CUR_BOOK = book;
  const status = document.getElementById('admApiStatus');
  if (status) { status.style.display = 'block'; status.style.background = 'rgba(249,115,22,.1)'; status.style.color = '#f97316'; status.textContent = '⏳ Refreshing MangaDex chapters…'; }
  await syncChaptersFromMangaDex();
  if (status) { status.textContent = '✅ MangaDex refresh complete for: ' + book.title; }
}

function buildGroupFilter() {
  const sel = document.getElementById('grp-filter');
  if (!sel) return;
  const groups = new Set();
  CHAP_DATA.forEach(c => c.entries.forEach(e => groups.add(e.group)));
  sel.innerHTML = '<option value="All">All Groups</option>';
  [...groups].forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  });
}

function renderChapters() {
  const list = document.getElementById('chap-list');
  const pages = document.getElementById('chap-pages');
  const grpF = document.getElementById('grp-filter')?.value||'All';
  if (!list) return;
  let data = [...CHAP_DATA];
  if (CHAP_ASC) data = data.slice().reverse();
  let filtered = grpF==='All' ? data : data.filter(c=>c.entries.some(e=>e.group===grpF));
  const total = filtered.length;
  const totalEntries = filtered.reduce((s,c)=>s+c.entries.length,0);
  document.getElementById('chap-count-lbl').textContent =
    `Chapters (${total} total · ${totalEntries} releases)`;
  const totalPages = Math.max(1, Math.ceil(total/CHAP_PER));
  if (CHAP_PAGE >= totalPages) CHAP_PAGE = totalPages-1;
  const slice = filtered.slice(CHAP_PAGE*CHAP_PER, (CHAP_PAGE+1)*CHAP_PER);
  const startIdx = CHAP_PAGE*CHAP_PER;
  const readChaps = ls('readChaps') || {};
  const bookReadKey = CUR_BOOK?.id || '';
  list.innerHTML = '';
  slice.forEach((c, si) => {
    c.entries.forEach(e => {
      const isRead = (readChaps[bookReadKey]||[]).includes(c.chap);
      const isLQ = (e.group||'').includes('low quality') || (e.group||'').includes('fan scan');
      const row = document.createElement('div');
      row.className = 'chap-row' + (isRead?' read-chap':'');
      row.innerHTML = `
        <span class="chap-flag">🇬🇧</span>
        <span class="chap-num">Ch. ${c.chap}${c.isEnd?`<span class="chap-end-badge">END</span>`:''}</span>
        <span class="chap-upv"><i class="fa-solid fa-arrow-up"></i>${e.upvotes}</span>
        <span class="chap-time">${e.time}</span>
        <span class="chap-grp ${isLQ?'lq':''}">${e.group}</span>`;
      row.onclick = () => openChapFromList(c, e, startIdx+si);
      list.appendChild(row);
    });
  });
  pages.innerHTML = `<div class="pg-showing">Showing ${startIdx+1} – ${Math.min((CHAP_PAGE+1)*CHAP_PER,total)} of ${total} chapters</div>`;
  if (totalPages > 1) {
    const addPg = (lbl, idx, disabled=false, active=false) => {
      const b = document.createElement('button');
      b.className='pgbtn'+(active?' on':'');
      b.textContent=lbl; b.disabled=disabled;
      if (!disabled && !active) b.onclick=()=>{CHAP_PAGE=idx;renderChapters();document.getElementById('chap-list')?.scrollIntoView({behavior:'smooth',block:'start'});};
      pages.appendChild(b);
    };
    addPg('‹ Prev', CHAP_PAGE-1, CHAP_PAGE===0);
    addPg('First', 0, CHAP_PAGE===0);
    if (CHAP_PAGE > 1) addPg('…', -1, true);
    if (CHAP_PAGE > 0) addPg(CHAP_PAGE, CHAP_PAGE-1);
    addPg(CHAP_PAGE+1, CHAP_PAGE, false, true);
    if (CHAP_PAGE < totalPages-1) addPg(CHAP_PAGE+2, CHAP_PAGE+1);
    if (CHAP_PAGE < totalPages-2) addPg('…', -1, true);
    addPg('Last', totalPages-1, CHAP_PAGE===totalPages-1);
    addPg('Next ›', CHAP_PAGE+1, CHAP_PAGE===totalPages-1);
  }
}

function toggleChapSort() {
  CHAP_ASC = !CHAP_ASC;
  CHAP_PAGE = 0;
  document.getElementById('sort-lbl').textContent = CHAP_ASC ? 'Asc' : 'Desc';
  document.getElementById('sort-btn').classList.toggle('on', CHAP_ASC);
  renderChapters();
}

function gotoChap() {
  const val = parseInt(document.getElementById('goto-input').value, 10);
  if (!val) return;
  let data=[...CHAP_DATA];
  if(CHAP_ASC) data=data.slice().reverse();
  const grpF=document.getElementById('grp-filter')?.value||'All';
  const filtered=grpF==='All'?data:data.filter(c=>c.entries.some(e=>e.group===grpF));
  const idx=filtered.findIndex(c=>parseFloat(c.chap)===val);
  if (idx<0){toast(`Chapter ${val} not found`);return;}
  CHAP_PAGE=Math.floor(idx/CHAP_PER);
  renderChapters();
  setTimeout(()=>{
    const rows=document.querySelectorAll('.chap-row');
    rows.forEach(r=>{if(r.querySelector('.chap-num')?.textContent.includes('Ch. '+val))r.scrollIntoView({behavior:'smooth',block:'center'});});
  },100);
}

function openChapFromList(chapObj, entry, listIdx) {
  const rk = CUR_BOOK?.id || '';
  const rc = ls('readChaps') || {};
  rc[rk] = [...new Set([...(rc[rk]||[]),chapObj.chap])];
  lss('readChaps', rc);
  localStorage.setItem('lastReadAt', String(Date.now()));
  CUR_CHAP_IDX = listIdx;
  lss('chapIdx', listIdx);
  if (CUR_BOOK) {
    CUR_BOOK.currentChapter = `Chap ${chapObj.chap}`;
    lss('cur', CUR_BOOK);
  }
  const t = (entry.type||CUR_BOOK?.type||'CBZ').toLowerCase();
  const u = entry.url||CUR_BOOK?.documentUrl||'';
  lss('cbzEntryType', entry.type || CUR_BOOK?.type || 'CBZ');
  if (t==='pdf'||u.endsWith('.pdf')) {
    lss('pdfUrl', u);
    lss('pdfChap', chapObj.chap);
    nav('pdf');
  } else {
    lss('cbzUrl', u);
    lss('cbzChap', chapObj.chap);
    nav('reader');
  }
  renderChapters();
}

/* ─── CBZ/COMICK READER (vertical scroll) ─── */
let CBZ_CHAP_NUM = null;

function initReader() {
  const book = CUR_BOOK || ls('cur');
  document.getElementById('r-back').onclick = () => nav('details');
  document.getElementById('r-file').onchange = e => {
    const f=e.target.files[0];
    if(f){
      document.getElementById('r-title').textContent=f.name.replace(/\.[^/.]+$/,'');
      document.getElementById('r-chap').textContent='Local File';
      processCBZ(f);
    }
  };
  if (book) {
    document.getElementById('r-title').textContent = book.title||'Archive';
    CBZ_CHAP_NUM = ls('cbzChap');
    document.getElementById('r-chap').textContent = CBZ_CHAP_NUM ? `Chapter ${CBZ_CHAP_NUM}` : (book.currentChapter||book.chapter||'Chapter 1');
  }
  const url = ls('cbzUrl') || book?.documentUrl || '';
  updateReaderNavBtns();
  
  const readerScroll = document.getElementById('reader-body-scroll');
  const scrollTopBtn = document.getElementById('scroll-top-btn');
  if (readerScroll) {
    readerScroll.onscroll = () => {
      const imgs = document.querySelectorAll('#r-stream img');
      if (!imgs.length) return;
      let cur = 1;
      imgs.forEach((img, i) => {
        const rect = img.getBoundingClientRect();
        if (rect.top <= window.innerHeight / 2 && rect.bottom >= 0) cur = i+1;
      });
      document.getElementById('r-prog').textContent = `${cur} / ${imgs.length} Pages`;
      if (scrollTopBtn) {
        if (readerScroll.scrollTop > 300) scrollTopBtn.classList.add('visible');
        else scrollTopBtn.classList.remove('visible');
      }
    };
  }
  
  // READER LOGIC BRANCH
  const entryType = (ls('cbzEntryType') || book?.type || '').toUpperCase();
  if (entryType === 'MANGADEX' || (book?.type === 'MANGADEX' && url && !url.includes('http'))) {
    loadMangaDexReader(url);
  } else if (entryType === 'COMICK' || book?.type === 'COMICK' || (url && url.length > 5 && !url.includes('http') && !url.includes('/'))) {
    loadComickReader(url);
  } else if (url && /^https?:\/\//i.test(url)) {
    fetchCBZ(url);
  } else {
    setLoaderState('fa-folder-open','No File Loaded','Tap the folder icon to open a local .cbz file');
  }
}

async function loadComickReader(chapterHid) {
  setLoaderState('fa-spinner fa-spin', 'Loading Pages...', 'Connecting to Comick servers...');
  try {
    const res = await fetch(`https://api.comick.dev/chapter/${chapterHid}`);
    if (!res.ok) throw new Error('Failed to fetch from Comick');
    const data = await res.json();
    
    if (!data.chapter.md_images || !data.chapter.md_images.length) {
        throw new Error('No images found in chapter');
    }

    const images = data.chapter.md_images.map(img => `https://meo.comick.pictures/${img.b2key}`);
    
    document.getElementById('r-loader').style.display = 'none';
    const stream = document.getElementById('r-stream');
    stream.innerHTML = '';
    stream.style.display = 'flex';
    document.getElementById('r-prog').textContent = `1 / ${images.length} Pages`;
    
    images.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      stream.appendChild(img);
    });
  } catch (e) {
    setLoaderState('fa-circle-xmark', 'Error Loading Chapter', e.message);
  }
}

async function loadMangaDexReader(chapterId) {
  setLoaderState('fa-spinner fa-spin', 'Loading Pages...', 'Connecting to MangaDex servers...');
  try {
    const res = await fetch(`https://api.mangadex.org/at-home/server/${chapterId}`);
    if (!res.ok) throw new Error('Failed to fetch chapter from MangaDex');
    const data = await res.json();

    const { baseUrl, chapter } = data;
    if (!chapter || !chapter.data || !chapter.data.length) throw new Error('No images found in chapter');

    // Use data-saver for faster mobile loading
    const images = chapter.data.map(fn => `${baseUrl}/data/${chapter.hash}/${fn}`);

    document.getElementById('r-loader').style.display = 'none';
    const stream = document.getElementById('r-stream');
    stream.innerHTML = '';
    stream.style.display = 'flex';
    document.getElementById('r-prog').textContent = `1 / ${images.length} Pages`;

    images.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.loading = 'lazy';
      img.onerror = () => { img.style.opacity = '0.3'; };
      stream.appendChild(img);
    });
  } catch (e) {
    setLoaderState('fa-circle-xmark', 'Error Loading Chapter', e.message);
  }
}

function scrollReaderToTop() {
  const readerScroll = document.getElementById('reader-body-scroll');
  if (readerScroll) readerScroll.scrollTo({top:0, behavior:'smooth'});
}

async function fetchCBZ(url) {
  setLoaderState('fa-spinner fa-spin','Loading Chapter…','Fetching archive from server…');
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = await r.arrayBuffer();
    await processCBZ(buf);
  } catch(e) {
    setLoaderState('fa-circle-xmark','Failed to Load', e.message);
  }
}

async function processCBZ(src) {
  const loader = document.getElementById('r-loader');
  const stream = document.getElementById('r-stream');
  const prog = document.getElementById('r-prog');
  try {
    const zip = await JSZip.loadAsync(src);
    const entries = [];
    zip.forEach((path, node) => {
      if (!node.dir && /\.(webp|jpg|jpeg|png|gif|jfif)$/i.test(path)) entries.push(node);
    });
    entries.sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
    if (!entries.length) throw new Error('No images found in archive.');
    CBZ_URLS.forEach(u=>URL.revokeObjectURL(u)); CBZ_URLS=[];
    if (loader) loader.style.display='none';
    if (stream){stream.innerHTML='';stream.style.display='flex';}
    if (prog) prog.textContent=`1 / ${entries.length} Pages`;
    const first=entries.slice(0,3), rest=entries.slice(3);
    for (const e of first) {
      const blob=await e.async('blob');
      const u=URL.createObjectURL(blob); CBZ_URLS.push(u);
      const img=document.createElement('img'); img.src=u; img.alt=e.name;
      stream?.appendChild(img);
    }
    setTimeout(async()=>{
      for (const e of rest) {
        const blob=await e.async('blob');
        const u=URL.createObjectURL(blob); CBZ_URLS.push(u);
        const img=document.createElement('img'); img.src=u; img.alt=e.name; img.loading='lazy';
        stream?.appendChild(img);
      }
    },100);
  } catch(e){
    setLoaderState('fa-circle-xmark','Extraction Error', e.message);
  }
}

function setLoaderState(icon, title, sub) {
  const l=document.getElementById('r-loader'), s=document.getElementById('r-stream');
  if(l){l.style.display='block';l.innerHTML=`<i class="fa-solid ${icon}"></i><h3>${title}</h3><p>${sub}</p>`;}
  if(s) s.style.display='none';
}

function updateReaderNavBtns() {
  const chs = CUR_BOOK?.chapters||[];
  const idx = ls('chapIdx') ?? CUR_CHAP_IDX;
  document.getElementById('r-prev').disabled = idx<=0;
  document.getElementById('r-next').disabled = idx>=chs.length-1;
}

function readerPrevChap() {
  const chs=CUR_BOOK?.chapters||[]; let idx=ls('chapIdx')??CUR_CHAP_IDX;
  if(idx<=0)return;
  idx--;
  const c=chs[idx]; if(!c)return;
  const e=c.entries[0];
  lss('chapIdx',idx); CUR_CHAP_IDX=idx;
  lss('cbzChap',c.chap); lss('cbzUrl',e.url);
  lss('cbzEntryType', e.type || CUR_BOOK?.type || 'CBZ');
  document.getElementById('r-chap').textContent=`Chapter ${c.chap}`;
  scrollReaderToTop();
  const eType = (e.type || CUR_BOOK?.type || '').toUpperCase();
  if (eType === 'MANGADEX') loadMangaDexReader(e.url);
  else if (eType === 'COMICK') loadComickReader(e.url);
  else fetchCBZ(e.url);
  updateReaderNavBtns();
}

function readerNextChap() {
  const chs=CUR_BOOK?.chapters||[]; let idx=ls('chapIdx')??CUR_CHAP_IDX;
  if(idx>=chs.length-1)return;
  idx++;
  const c=chs[idx]; if(!c)return;
  const e=c.entries[0];
  lss('chapIdx',idx); CUR_CHAP_IDX=idx;
  lss('cbzChap',c.chap); lss('cbzUrl',e.url);
  lss('cbzEntryType', e.type || CUR_BOOK?.type || 'CBZ');
  document.getElementById('r-chap').textContent=`Chapter ${c.chap}`;
  scrollReaderToTop();
  const eType = (e.type || CUR_BOOK?.type || '').toUpperCase();
  if (eType === 'MANGADEX') loadMangaDexReader(e.url);
  else if (eType === 'COMICK') loadComickReader(e.url);
  else fetchCBZ(e.url);
  updateReaderNavBtns();
}

/* ─── PDF READER ─── */
let PDF_CHAP_NUM = null;

function initPdf() {
  const book = CUR_BOOK || ls('cur');
  document.getElementById('pdf-back').onclick = () => nav('details');
  if (book) {
    document.getElementById('pdf-title').textContent = book.title||'Document';
    PDF_CHAP_NUM = ls('pdfChap');
    document.getElementById('pdf-chap').textContent = PDF_CHAP_NUM ? `Chapter ${PDF_CHAP_NUM}` : 'E-BOOK DOCUMENT PLAYER';
  }
  const url = ls('pdfUrl') || book?.documentUrl || '';
  updatePdfNavBtns();
  loadPdfUrl(url);
}

function loadPdfUrl(url) {
  if (!url) { showPdfFallback('No document URL', ''); return; }
  const dl = document.getElementById('pdf-dl');
  if (dl) { dl.href=url; dl.setAttribute('download',''); }
  const frame = document.getElementById('pdf-frame');
  const fallback = document.getElementById('pdf-fallback');
  const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  frame.style.display = 'block';
  fallback.classList.add('hid');
  frame.src = viewerUrl;
  let loaded = false;
  frame.onload = () => { loaded = true; };
  setTimeout(() => {
    if (!loaded) showPdfFallback(document.getElementById('pdf-title')?.textContent||'Document', url);
  }, 8000);
}

function showPdfFallback(name, url) {
  const frame = document.getElementById('pdf-frame');
  const fallback = document.getElementById('pdf-fallback');
  frame.style.display = 'none';
  fallback.classList.remove('hid');
  document.getElementById('pdf-fall-name').textContent = name;
  document.getElementById('pdf-open-tab').onclick = () => window.open(url,'_blank');
}

function updatePdfNavBtns() {
  const chs=CUR_BOOK?.chapters||[];
  const idx=ls('chapIdx')??CUR_CHAP_IDX;
  document.getElementById('pdf-prev').disabled=idx<=0;
  document.getElementById('pdf-next').disabled=idx>=chs.length-1;
}

function pdfPrevChap() {
  const chs=CUR_BOOK?.chapters||[]; let idx=ls('chapIdx')??CUR_CHAP_IDX;
  if(idx<=0)return; idx--;
  const c=chs[idx]; if(!c)return;
  const e=c.entries[0];
  lss('chapIdx',idx); CUR_CHAP_IDX=idx;
  lss('pdfChap',c.chap); lss('pdfUrl',e.url);
  document.getElementById('pdf-chap').textContent=`Chapter ${c.chap}`;
  loadPdfUrl(e.url); updatePdfNavBtns();
}

function pdfNextChap() {
  const chs=CUR_BOOK?.chapters||[]; let idx=ls('chapIdx')??CUR_CHAP_IDX;
  if(idx>=chs.length-1)return; idx++;
  const c=chs[idx]; if(!c)return;
  const e=c.entries[0];
  lss('chapIdx',idx); CUR_CHAP_IDX=idx;
  lss('pdfChap',c.chap); lss('pdfUrl',e.url);
  document.getElementById('pdf-chap').textContent=`Chapter ${c.chap}`;
  loadPdfUrl(e.url); updatePdfNavBtns();
}

/* ─── MY LIST ─── */
let LIST_BOOKS = [];
async function initList() {
  if (!ALL.length) await fetchLib();
  LIST_BOOKS = [...ALL];
  renderList(LIST_BOOKS);
}

function renderList(books) {
  const body = document.getElementById('lbody');
  const favs = ls('favs') || [];
  const states = ls('states') || {};
  if (!body) return;
  body.innerHTML = '';
  const saved = books.filter(b => favs.includes(b.id));
  if (!saved.length) {
    body.innerHTML=`<div class="empty"><i class="fa-solid fa-bookmark"></i><h3>Your list is empty</h3><p>Follow a title from home to add it here.</p></div>`;
    return;
  }
  saved.forEach(b => {
    const st = states[b.id] || b.status || 'Reading';
    const sc = st.toLowerCase().replace(/\s+/g,'-');
    const cur = b.currentChapter||b.chapter||'1';
    const tot = b.chapters ? b.chapters.length : (b.totalChapters||'?');
    const row = document.createElement('div'); row.className='lrow';
    row.innerHTML=`
      <div class="lt-cell"><div class="limg"><img src="${b.cover}" alt="${b.title}" loading="lazy"></div>
        <div class="linf"><h3>${b.title}</h3><p><span class="tcat">${b.category||'Action'}</span></p></div>
      </div>
      <div><button class="ppill rb-btn"><span class="cc">${cur}</span> / ${tot}</button></div>
      <div class="lib-col-rat"><span class="rbadge"><i class="fa-solid fa-star"></i>${b.rating||'–'}</span></div>
      <div class="lib-col-pub"><span class="spill s-${sc}">${st}</span></div>
      <div><button class="frem" title="Remove">❤️</button></div>`;
    row.querySelector('.lt-cell').onclick=()=>openBook(b);
    row.querySelector('.rb-btn').onclick=e=>{e.stopPropagation();openBook(b);};
    row.querySelector('.frem').onclick=e=>{
      e.stopPropagation();
      let f=ls('favs')||[]; f=f.filter(x=>x!==b.id); lss('favs',f);
      toast('Removed from list'); renderList(LIST_BOOKS);
    };
    body.appendChild(row);
  });
}

function filterList() {
  const q=(document.getElementById('lsearch')?.value||'').toLowerCase();
  const cat=document.getElementById('lcat')?.value||'All';
  const sort=document.getElementById('lsort')?.value||'Default';
  let r=LIST_BOOKS.filter(b=>{
    const tm=(b.title||'').toLowerCase().includes(q);
    const cm=cat==='All'||b.category===cat;
    return tm&&cm;
  });
  if(sort==='A-Z') r.sort((a,b)=>a.title.localeCompare(b.title));
  if(sort==='Z-A') r.sort((a,b)=>b.title.localeCompare(a.title));
  if(sort==='Rating') r.sort((a,b)=>parseFloat(b.rating||0)-parseFloat(a.rating||0));
  renderList(r);
}

/* ─── CATEGORIES ─── */
const CATS = [
  {name:'Action',icon:'⚔️',color:'#ef4444',bg:'rgba(239,68,68,.12)',desc:'High-intensity battles'},
  {name:'Fantasy',icon:'🪄',color:'#a855f7',bg:'rgba(168,85,247,.12)',desc:'Magic & mythical worlds'},
  {name:'Novel',icon:'📖',color:'#3b82f6',bg:'rgba(59,130,246,.12)',desc:'Web novels & stories'},
  {name:'Manhwa',icon:'🎨',color:'#10b981',bg:'rgba(16,185,129,.12)',desc:'Korean web comics'},
  {name:'Romance',icon:'💘',color:'#f43f5e',bg:'rgba(244,63,94,.12)',desc:'Love & relationships'},
  {name:'Sci-Fi',icon:'🚀',color:'#38bdf8',bg:'rgba(56,189,248,.12)',desc:'Futuristic adventures'},
  {name:'Horror',icon:'👁️',color:'#f59e0b',bg:'rgba(245,158,11,.12)',desc:'Dark & terrifying'},
  {name:'Martial Arts',icon:'🥋',color:'#eab308',bg:'rgba(234,179,8,.12)',desc:'Combat & power'},
];

async function initCategories() {
  if (!ALL.length) await fetchLib();
  const popList = document.getElementById('popularList');
  if (popList) {
    popList.innerHTML = '';
    const sorted = ALL.filter(b => !b.imported).sort((a,b)=>parseFloat(b.rating||0)-parseFloat(a.rating||0));
    sorted.slice(0, 10).forEach((b, i) => {
      const item = document.createElement('div');
      item.className = 'pop-item';
      const tags = [b.category, b.theme, b.format].filter(Boolean);
      const chapCount = b.chapters ? b.chapters.length : b.totalChapters;
      item.innerHTML = `
        <div class="pop-rank">${i+1}</div>
        <img class="pop-img" src="${b.cover}" alt="${b.title}" loading="lazy">
        <div class="pop-info">
          <h3>${b.title}</h3>
          <div class="pop-tags">${tags.map(t=>`<span class="pop-tag">${t}</span>`).join('')}</div>
        </div>
        <div class="pop-chap">${chapCount}</div>`;
      item.onclick = () => openBook(b);
      popList.appendChild(item);
    });
  }
  const g = document.getElementById('catsGrid');
  if (!g) return;
  g.innerHTML = '';
  CATS.forEach(cat => {
    const c = document.createElement('div'); c.className='cat-card';
    c.innerHTML = `<div class="cat-ico" style="background:${cat.bg};color:${cat.color}">${cat.icon}</div>
      <div class="cat-info"><h3>${cat.name}</h3><p>${cat.desc}</p></div>`;
    c.onclick = () => {
      nav('home');
      setTimeout(() => {
        const btn = document.querySelector(`.cpill[data-cat="${cat.name}"]`);
        if(btn) filterCat(btn, cat.name);
        else{FILTERED=ALL.filter(b=>(b.category||'').toLowerCase().includes(cat.name.toLowerCase()));renderGrid(FILTERED);}
      }, 50);
    };
    g.appendChild(c);
  });
}

/* ─── NOTIFICATIONS ─── */
let NOTIFS_DATA = [
  {icon:'📖',color:'#3b82f6',bg:'rgba(59,130,246,.12)',title:'New Chapter Available',body:'Reverend Insanity — Chapter 97 is now live!',time:'2 min ago',unread:true},
  {icon:'⭐',color:'#eab308',bg:'rgba(234,179,8,.12)',title:'Rating Milestone',body:'Reverend Insanity surpassed 9.8 average rating.',time:'1 hr ago',unread:true},
  {icon:'🔔',color:'#10b981',bg:'rgba(16,185,129,.12)',title:'Beginning Mortal — Ch. 5',body:'Chapter 5 has been uploaded by DEVILAKV.',time:'3 hr ago',unread:false},
  {icon:'📢',color:'#a855f7',bg:'rgba(168,85,247,.12)',title:'Studio Announcement',body:'A&V STUDIO v2.0 is now live with full PWA upgrade!',time:'Yesterday',unread:false},
  {icon:'💬',color:'#f59e0b',bg:'rgba(245,158,11,.12)',title:'Reply on Your Rating',body:'Someone replied to your review on 100th Regression.',time:'2 days ago',unread:false},
];

function initNotifs(){renderNotifs();}
function renderNotifs(){
  const l=document.getElementById('notifList');
  if(!l)return; l.innerHTML='';
  NOTIFS_DATA.forEach((n,i)=>{
    const el=document.createElement('div');
    el.className='notif-item'+(n.unread?' unread':'');
    el.innerHTML=`<div class="notif-ico" style="background:${n.bg};color:${n.color}">${n.icon}</div>
      <div class="notif-body"><h4>${n.title}</h4><p>${n.body}</p><div class="notif-time">${n.time}</div></div>`;
    el.onclick=()=>{NOTIFS_DATA[i].unread=false;el.classList.remove('unread');};
    l.appendChild(el);
  });
}
function markAllRead(){NOTIFS_DATA.forEach(n=>n.unread=false);renderNotifs();toast('All marked as read');}

/* ─── PROFILE (SETTINGS) ─── */
const FMT_COLORS = {Manga:'#38bdf8',Manhwa:'#10b981',Manhua:'#f59e0b',Others:'#94a3b8'};
const ST_COLORS = {'Reading':'#38bdf8','Completed':'#3b82f6','On Hold':'#b45309','Dropped':'#e11d48','Plan to Read':'#94a3b8'};

function getProfilePic(){ return localStorage.getItem('profilePic') || LOGO; }

function applyProfilePic(){
  const src = getProfilePic();
  document.querySelectorAll('.av-avatar').forEach(i => {
    i.src = src;
    i.style.cursor = 'pointer';
    i.onclick = () => openAccount();
    i.title = authUser() ? 'View profile' : 'Login';
  });
  const p = document.getElementById('profAv'); if (p) p.src = src;
  const t = document.getElementById('epAvThumb'); if (t) t.src = src;
}

function applyBanner(){
  const b = localStorage.getItem('profileBanner');
  const el = document.getElementById('profBanner');
  if (el) el.style.backgroundImage = b ? `url(${b})` : '';
}

function readImageFile(file, maxSize, quality, cb){
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Please choose an image file'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let data;
      try { data = c.toDataURL('image/jpeg', quality); } catch { data = ev.target.result; }
      cb(data);
    };
    img.onerror = () => toast('Could not read that image');
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById('avatarInput').onchange = e => {
  readImageFile(e.target.files[0], 512, .85, data => {
    try { localStorage.setItem('profilePic', data); }
    catch { toast('Image too large to save'); return; }
    applyProfilePic();
    toast('Avatar updated');
  });
  e.target.value = '';
};

document.getElementById('bannerInput').onchange = e => {
  readImageFile(e.target.files[0], 1280, .8, data => {
    try { localStorage.setItem('profileBanner', data); }
    catch { toast('Image too large to save'); return; }
    applyBanner();
    toast('Banner updated');
  });
  e.target.value = '';
};

function getProfileId(){
  let id = localStorage.getItem('profileId');
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() :
      'xxxx-xxxx-xxxx'.replace(/x/g, () => Math.floor(Math.random()*16).toString(16)));
    localStorage.setItem('profileId', id);
  }
  return id;
}

function openEditProfile(){
  document.getElementById('epId').textContent = getProfileId();
  document.getElementById('epName').value = localStorage.getItem('profileName') || 'DEVILAKV';
  document.getElementById('epAbout').value = localStorage.getItem('profileAbout') || '';
  document.getElementById('epAvThumb').src = getProfilePic();
  document.getElementById('epOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeEditProfile(){
  document.getElementById('epOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function saveEditProfile(){
  const n = document.getElementById('epName').value.trim();
  if (n) {
    localStorage.setItem('profileName', n);
    const el = document.getElementById('profName');
    if (el) el.textContent = n;
  }
  localStorage.setItem('profileAbout', document.getElementById('epAbout').value.trim());
  toast('Profile saved');
  closeEditProfile();
}

function timeAgo(ts){
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'a few seconds ago';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' hour' + (h > 1 ? 's' : '') + ' ago';
  const d = Math.floor(h / 24);
  return d + ' day' + (d > 1 ? 's' : '') + ' ago';
}

function renderStatCol(barId, rowsId, data, colors){
  const bar = document.getElementById(barId), rows = document.getElementById(rowsId);
  if (!bar || !rows) return;
  bar.innerHTML = ''; rows.innerHTML = '';
  const sum = Object.values(data).reduce((a,b) => a + b, 0) || 1;
  Object.entries(data).forEach(([k, v]) => {
    if (v > 0) {
      const seg = document.createElement('i');
      seg.style.height = (v / sum * 100) + '%';
      seg.style.background = colors[k];
      bar.appendChild(seg);
    }
    const r = document.createElement('div');
    r.className = 'sum-row';
    r.innerHTML = `<span class="dot" style="background:${colors[k]}"></span><span class="lbl">${k}</span><span class="val">${v.toLocaleString()}</span>`;
    rows.appendChild(r);
  });
}

async function initProfile(){
  if (!authUser()) { nav('login'); return; }
  if (!ALL.length) await fetchLib();
  applyProfilePic();
  applyBanner();
  document.getElementById('profName').textContent = localStorage.getItem('profileName') || 'DEVILAKV';
  const states = ls('states') || {}, ratings = ls('ratings') || {}, readChaps = ls('readChaps') || {};
  const fmt = {Manga:0, Manhwa:0, Manhua:0, Others:0};
  ALL.forEach(b => {
    const f = ((b.format||'') + ' ' + (b.category||'')).toLowerCase();
    if (f.includes('manhwa')) fmt.Manhwa++;
    else if (f.includes('manhua')) fmt.Manhua++;
    else if (f.includes('manga')) fmt.Manga++;
    else fmt.Others++;
  });
  const st = {'Reading':0,'Completed':0,'On Hold':0,'Dropped':0,'Plan to Read':0};
  ALL.forEach(b => {
    let s = states[b.id] || b.status || 'Reading';
    if (!(s in st)) s = 'Reading';
    st[s]++;
  });
  renderStatCol('fmtBar','fmtRows',fmt,FMT_COLORS);
  renderStatCol('stBar','stRows',st,ST_COLORS);
  document.getElementById('profListCount').textContent = ALL.length.toLocaleString();
  const karma = ALL.reduce((s,b) => s + (b.metrics?.comments||0), 0);
  document.getElementById('profKarma').textContent = karma.toLocaleString();
  document.getElementById('profReviews').textContent = '0';
  const listTotal = ALL.length - st['Dropped'] - st['Plan to Read'];
  const totalChs = ALL.reduce((s,b) => s + (b.chapters ? b.chapters.length : (parseInt(b.totalChapters)||0)), 0);
  const marked = Object.values(readChaps).reduce((s,a) => s + (Array.isArray(a) ? a.length : 0), 0);
  document.getElementById('sumTotals').innerHTML = `
    Total comics in list: <b>${listTotal.toLocaleString()}</b><br>
    Total ratings: <b>${Object.keys(ratings).length.toLocaleString()}</b><br>
    Total reviews: <b>0</b><br>
    Total chapters in your list: <b>${totalChs.toLocaleString()}</b><br>
    Total chapters were marked: <b>${marked.toLocaleString()}</b>`;
  const lastRead = localStorage.getItem('lastReadAt');
  let memberSince = localStorage.getItem('memberSince');
  if (!memberSince) { memberSince = String(Date.now()); localStorage.setItem('memberSince', memberSince); }
  document.getElementById('sumActivity').innerHTML = `
    Last read at: <b>${lastRead ? timeAgo(parseInt(lastRead,10)) : '–'}</b><br>
    Last activity at: <b>a few seconds ago</b><br>
    Member since: <b>${new Date(parseInt(memberSince,10)).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</b>`;
}

/* ─── SETTINGS ─── */
function initSettingsPage(){
  syncAppearanceUI();
  const adm = isAdmin();
  document.querySelectorAll('#p-settings .adm-only').forEach(el => { el.style.display = adm ? '' : 'none'; });
}

function setDarkMode(mode){
  localStorage.setItem('dmMode', mode);
  applyAppearance();
  syncAppearanceUI();
  toast(mode === 'system' ? 'Synced with system' : mode.charAt(0).toUpperCase()+mode.slice(1)+' mode');
}

function setTheme(th){
  localStorage.setItem('themeMode', th);
  applyAppearance();
  syncAppearanceUI();
  toast('Theme: ' + th.charAt(0).toUpperCase()+th.slice(1));
}

function applyAppearance(){
  const dm = localStorage.getItem('dmMode') || 'dark';
  const th = localStorage.getItem('themeMode') || 'gray';
  let light = dm === 'light';
  if (dm === 'system') light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  document.documentElement.classList.toggle('light', light);
  document.documentElement.classList.toggle('blk', th === 'black' && !light);
}

function syncAppearanceUI(){
  const dm = localStorage.getItem('dmMode') || 'dark';
  const th = localStorage.getItem('themeMode') || 'gray';
  document.querySelectorAll('#dmOpts .rad-row').forEach(r => r.classList.toggle('on', r.dataset.val === dm));
  document.querySelectorAll('#thOpts .rad-row').forEach(r => r.classList.toggle('on', r.dataset.val === th));
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if ((localStorage.getItem('dmMode') || 'dark') === 'system') applyAppearance();
  });
}

function gotoEditProfile(){
  if (!authUser()) { nav('login'); return; }
  nav('profile');
  setTimeout(() => openEditProfile(), 80);
}

function exportData(){
  const data = {
    exportedAt: new Date().toISOString(),
    app: 'A&V STUDIO',
    library: ALL.length ? ALL : (ls('customLibrary') || []),
    favs: ls('favs') || [],
    states: ls('states') || {},
    ratings: ls('ratings') || {},
    readChaps: ls('readChaps') || {},
    profile: {
      id: localStorage.getItem('profileId') || '',
      name: localStorage.getItem('profileName') || 'DEVILAKV',
      about: localStorage.getItem('profileAbout') || '',
      memberSince: localStorage.getItem('memberSince') || ''
    },
    appearance: {
      dmMode: localStorage.getItem('dmMode') || 'dark',
      themeMode: localStorage.getItem('themeMode') || 'gray'
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'av-studio-backup.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📤 Backup exported');
}

document.getElementById('importInput').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try { restoreJsonBackup(JSON.parse(ev.target.result)); }
    catch(err) { toast('Invalid backup file'); }
  };
  reader.readAsText(f);
  e.target.value = '';
};

function csvEscape(v){
  v = String(v == null ? '' : v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v;
}

function downloadFile(content, name, mime){
  const blob = new Blob([content], {type: mime});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportCsv(){
  const states = ls('states') || {};
  const favs = ls('favs') || [];
  const readChaps = ls('readChaps') || {};
  const rows = [['id','title','format','type','category','status','reading_status','current_chapter','total_chapters','rating','favorite','cover','documentUrl']];
  const books = ALL.length ? ALL : LOCAL_DATA.map(processBook);
  books.forEach(b => {
    const read = (readChaps[b.id] || []).length;
    rows.push([
      b.id, b.title, b.format||'', b.type||'', b.category||'',
      b.publicationStatus||'', states[b.id]||'Reading', read || b.currentChapter||'', b.totalChapters||'',
      b.rating||'', favs.includes(b.id) ? 'yes' : 'no', b.cover||'', b.documentUrl||''
    ]);
  });
  downloadFile(rows.map(r => r.map(csvEscape).join(',')).join('\n'), 'av-studio-list.csv', 'text/csv');
  toast('CSV exported — ' + books.length + ' comics');
}

function exportMalXml(){
  const states = ls('states') || {};
  const readChaps = ls('readChaps') || {};
  const books = ALL.length ? ALL : LOCAL_DATA.map(processBook);
  const stMap = {'Reading':'Reading','Completed':'Completed','On-Hold':'On-Hold','Dropped':'Dropped','Plan to Read':'Plan to Read'};
  const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let xml = '<?xml version="1.0" encoding="UTF-8" ?>\n<myanimelist>\n';
  xml += '  <myinfo>\n    <user_name>' + esc(localStorage.getItem('profileName') || 'DEVILAKV') + '</user_name>\n    <user_export_type>2</user_export_type>\n  </myinfo>\n';
  books.forEach(b => {
    const read = (readChaps[b.id] || []).length || parseInt(b.currentChapter) || 0;
    xml += '  <manga>\n' +
      '    <manga_title><![CDATA[' + (b.title||'') + ']]></manga_title>\n' +
      '    <manga_chapters>' + (parseInt(b.totalChapters) || 0) + '</manga_chapters>\n' +
      '    <my_read_chapters>' + read + '</my_read_chapters>\n' +
      '    <my_score>' + Math.round(parseFloat(b.rating) || 0) + '</my_score>\n' +
      '    <my_status>' + esc(stMap[states[b.id]] || 'Reading') + '</my_status>\n' +
      '    <update_on_import>1</update_on_import>\n' +
      '  </manga>\n';
  });
  xml += '</myanimelist>\n';
  downloadFile(xml, 'av-studio-mal-export.xml', 'text/xml');
  toast('MAL/Anilist XML exported — ' + books.length + ' comics');
}

let MAL_XML_FILE = null, BACKUP_FILE = null;
document.getElementById('malXmlInput').onchange = e => {
  MAL_XML_FILE = e.target.files[0] || null;
  document.getElementById('malXmlName').textContent = MAL_XML_FILE ? MAL_XML_FILE.name : 'No file chosen';
};
document.getElementById('backupCsvInput').onchange = e => {
  BACKUP_FILE = e.target.files[0] || null;
  document.getElementById('backupCsvName').textContent = BACKUP_FILE ? BACKUP_FILE.name : 'No file chosen';
};

function importMalXml(){
  if (!MAL_XML_FILE) { toast('Choose the .xml file first'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const doc = new DOMParser().parseFromString(ev.target.result, 'text/xml');
      const entries = [...doc.querySelectorAll('manga')];
      if (!entries.length) throw new Error('no entries');
      const states = ls('states') || {};
      const favs = new Set(ls('favs') || []);
      const lib = (ls('customLibrary') || (ALL.length ? ALL.map(({chapters,...r}) => r) : []));
      let added = 0, updated = 0;
      entries.forEach(m => {
        const g = t => { const el = m.querySelector(t); return el ? el.textContent.trim() : ''; };
        const title = g('manga_title'); if (!title) return;
        const id = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
        const total = parseInt(g('manga_chapters')) || 10;
        const readN = parseInt(g('my_read_chapters')) || 0;
        const score = parseFloat(g('my_score')) || 0;
        const st = g('my_status') || 'Reading';
        states[id] = st;
        favs.add(id);
        const existing = lib.find(b => b.id === id);
        if (existing) {
          existing.totalChapters = String(Math.max(total, parseInt(existing.totalChapters)||0));
          existing.currentChapter = 'Chap ' + readN;
          updated++;
        } else {
          lib.push({
            id, title, cover:LOGO, category:'Manga', theme:'',
            type:'CBZ', format:'Manga', studio:'', published:'', publicationStatus:'Ongoing',
            translationStatus:'Ongoing', rating: score ? String(score) : '0', ratingCount:'1',
            chapter:'Chap ' + (readN || 1), currentChapter:'Chap ' + (readN || 1),
            totalChapters:String(total), documentUrl:'', updated:'now', added:'now',
            imported:true,
            metrics:{comments:0,likes:0}, description:'Imported from a MyAnimeList-format export file.'
          });
          added++;
        }
      });
      lss('states', states);
      lss('favs', [...favs]);
      lss('customLibrary', lib);
      ALL = lib.map(processBook);
      FILTERED = applyContentFilters(ALL);
      renderFeatured(ALL); renderGrid(FILTERED);
      toast('Imported to My List: ' + added + ' added, ' + updated + ' updated');
      MAL_XML_FILE = null;
      document.getElementById('malXmlName').textContent = 'No file chosen';
      document.getElementById('malXmlInput').value = '';
    } catch(err) {
      toast('Invalid MyAnimeList XML file');
    }
  };
  reader.readAsText(MAL_XML_FILE);
}

function parseCsvLine(line){
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function importBackupFile(){
  if (!BACKUP_FILE) { toast('Choose the .csv or .json file first'); return; }
  const isJson = /\.json$/i.test(BACKUP_FILE.name);
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      if (isJson) { restoreJsonBackup(JSON.parse(ev.target.result)); }
      else {
        const lines = ev.target.result.split(/\r?\n/).filter(l => l.trim());
        const head = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
        const idx = n => head.indexOf(n);
        if (idx('title') === -1) throw new Error('bad csv');
        const states = ls('states') || {}, favs = new Set(ls('favs') || []);
        const lib = (ls('customLibrary') || (ALL.length ? ALL.map(({chapters,...r}) => r) : []));
        let added = 0, updated = 0;
        for (let i = 1; i < lines.length; i++) {
          const c = parseCsvLine(lines[i]);
          const get = n => idx(n) > -1 ? (c[idx(n)] || '') : '';
          const title = get('title'); if (!title) continue;
          const id = get('id') || title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
          if (get('reading_status')) states[id] = get('reading_status');
          favs.add(id);
          const existing = lib.find(b => b.id === id);
          if (existing) {
            if (get('current_chapter')) existing.currentChapter = 'Chap ' + get('current_chapter');
            if (get('total_chapters')) existing.totalChapters = get('total_chapters');
            updated++;
          } else {
            lib.push({
              id, title, cover:get('cover') || LOGO,
              category:get('category') || 'Manhwa', theme:'', type:get('type') || 'CBZ',
              format:get('format') || '', studio:'', published:'',
              publicationStatus:get('status') || 'Ongoing', translationStatus:'Ongoing',
              rating:get('rating') || '0', ratingCount:'1',
              chapter:'Chap ' + (get('current_chapter') || 1),
              currentChapter:'Chap ' + (get('current_chapter') || 1),
              totalChapters:get('total_chapters') || '10',
              documentUrl:get('documenturl') || '', updated:'now', added:'now',
              imported:true,
              metrics:{comments:0,likes:0}, description:'Restored from an A&V STUDIO CSV backup.'
            });
            added++;
          }
        }
        if (!added && !updated) throw new Error('empty');
        lss('states', states); lss('favs', [...favs]); lss('customLibrary', lib);
        ALL = lib.map(processBook);
        FILTERED = applyContentFilters(ALL);
        renderFeatured(ALL); renderGrid(FILTERED);
        toast('Imported to My List: ' + added + ' added, ' + updated + ' updated');
      }
      BACKUP_FILE = null;
      document.getElementById('backupCsvName').textContent = 'No file chosen';
      document.getElementById('backupCsvInput').value = '';
    } catch(err) {
      toast('Invalid backup file');
    }
  };
  reader.readAsText(BACKUP_FILE);
}

function restoreJsonBackup(d){
  if (Array.isArray(d)) {
    lss('customLibrary', d);
    ALL = d.map(processBook);
  } else {
    if (Array.isArray(d.library) && d.library.length) { lss('customLibrary', d.library); ALL = d.library.map(processBook); }
    if (d.favs) lss('favs', d.favs);
    if (d.states) lss('states', d.states);
    if (d.ratings) lss('ratings', d.ratings);
    if (d.readChaps) lss('readChaps', d.readChaps);
    if (d.profile) {
      if (d.profile.name) localStorage.setItem('profileName', d.profile.name);
      if (d.profile.about) localStorage.setItem('profileAbout', d.profile.about);
      if (d.profile.memberSince) localStorage.setItem('memberSince', d.profile.memberSince);
    }
    if (d.appearance) {
      if (d.appearance.dmMode) localStorage.setItem('dmMode', d.appearance.dmMode);
      if (d.appearance.themeMode) localStorage.setItem('themeMode', d.appearance.themeMode);
      applyAppearance(); syncAppearanceUI();
    }
    if (d.notifSettings) lss('notifSettings', d.notifSettings);
    if (d.contentFilters) lss('contentFilters', d.contentFilters);
  }
  FILTERED = applyContentFilters(ALL);
  renderFeatured(ALL); renderGrid(FILTERED);
  toast('Import successful!');
}

const NOTIF_DEFAULTS = {'comment.web':true,'comment.app':true,'chapter.web':true,'chapter.app':true,'features.web':true,'features.app':true};
function initNotifSettingsPage(){
  const saved = Object.assign({}, NOTIF_DEFAULTS, ls('notifSettings') || {});
  document.querySelectorAll('#p-notifsettings .ntf-chk').forEach(el => {
    el.classList.toggle('on', !!saved[el.dataset.k]);
    el.onclick = () => el.classList.toggle('on');
  });
}
function saveNotifSettings(){
  const out = {};
  document.querySelectorAll('#p-notifsettings .ntf-chk').forEach(el => { out[el.dataset.k] = el.classList.contains('on'); });
  lss('notifSettings', out);
  toast('Notification settings saved');
}

const FILTER_DEFAULTS = {
  showMyList:true, showCountdown:true,
  typeManga:true, typeManhwa:true, typeManhua:true, typeOthers:true,
  demoMale:true, demoFemale:true, demoNone:true,
  mature:true, gore:true, nudity:true, adult:true
};
function getFilters(){ return Object.assign({}, FILTER_DEFAULTS, ls('contentFilters') || {}); }

function initFilterPage(){
  const f = getFilters();
  document.querySelectorAll('#filterWrap .chk-row').forEach(el => el.classList.toggle('on', !!f[el.dataset.f]));
}
function togFilter(el){ el.classList.toggle('on'); }
function saveFilters(){
  const out = {};
  document.querySelectorAll('#filterWrap .chk-row').forEach(el => { out[el.dataset.f] = el.classList.contains('on'); });
  lss('contentFilters', out);
  FILTERED = applyContentFilters(ALL);
  renderFeatured(FILTERED.length ? FILTERED : ALL);
  renderGrid(FILTERED);
  toast('Preferences saved — filters applied');
}

function bookOriginType(b){
  const s = ((b.format||'') + ' ' + (b.category||'') + ' ' + (b.type||'')).toLowerCase();
  if (s.includes('manhwa')) return 'typeManhwa';
  if (s.includes('manhua')) return 'typeManhua';
  if (s.includes('manga')) return 'typeManga';
  return 'typeOthers';
}
function bookDemo(b){
  const d = (b.demographic||'').toLowerCase();
  if (/(shounen|seinen|male)/.test(d)) return 'demoMale';
  if (/(shoujo|josei|female)/.test(d)) return 'demoFemale';
  return 'demoNone';
}
function bookMatureKey(b){
  const m = (b.mature||'').toLowerCase();
  if (m === 'adult') return 'adult';
  if (m === 'nudity') return 'nudity';
  if (m === 'gore' || m === 'horror') return 'gore';
  if (m === 'mature') return 'mature';
  return null;
}

function applyContentFilters(list){
  const f = getFilters();
  return list.filter(b => {
    if (!f[bookOriginType(b)]) return false;
    if (!f[bookDemo(b)]) return false;
    const mk = bookMatureKey(b);
    if (mk && !f[mk]) return false;
    return true;
  });
}

function logoutData(){
  if (!authUser()) { nav('login'); return; }
  if (confirm('Log out? Your profile, list and progress on this device will be cleared.')) {
    ['authUser','favs','states','ratings','readChaps','chapIdx','lastReadAt','profileName','profileAbout','profilePic','profileBanner','profileId'].forEach(k => localStorage.removeItem(k));
    applyProfilePic();
    toast('👋 Logged out');
    nav('home');
  }
}

function togSet(row){const t=row.querySelector('.stog');if(t)t.classList.toggle('on');}
function clearData(){
  if(confirm('Clear all saved data? This cannot be undone.')){
    ['favs','states','ratings','cur','readChaps','chapIdx','cbzUrl','cbzChap','pdfUrl','pdfChap','customLibrary','lastReadAt'].forEach(k=>localStorage.removeItem(k));
    toast('✅ All data cleared');
  }
}

let AUTH_MODE = 'login';
function userKey(email){ return email.toLowerCase().trim().replace(/[.#$\[\]\/@]/g,'_'); }

async function sha256Hex(s){
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('');
  } catch {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0; }
    return 'f' + h1.toString(16) + s.length.toString(16);
  }
}

function initLogin(){
  if (authUser()) { nav('profile'); return; }
  AUTH_MODE = 'login';
  syncAuthUI();
}

function toggleAuthMode(){
  AUTH_MODE = AUTH_MODE === 'login' ? 'signup' : 'login';
  syncAuthUI();
}

function syncAuthUI(){
  const signup = AUTH_MODE === 'signup';
  document.getElementById('authTitle').textContent = signup ? 'Sign up' : 'Login';
  document.getElementById('authNameField').style.display = signup ? 'block' : 'none';
  document.getElementById('authSubmit').textContent = signup ? 'Create account' : 'Sign in with password';
  document.getElementById('authAltText').innerHTML = signup
    ? 'Already have an account? <a onclick="toggleAuthMode()">Login</a>'
    : 'Don&apos;t have an account? <a onclick="toggleAuthMode()">Sign up</a>';
}

function togglePassVis(){
  const inp = document.getElementById('authPass');
  const ico = document.getElementById('authEyeIcon');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  ico.className = show ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
}

function socialLogin(provider){
  toast('Social sign-in is not available on this local site — use email & password');
}

async function submitAuth(){
  const email = (document.getElementById('authEmail').value || '').trim().toLowerCase();
  const pass = document.getElementById('authPass').value || '';
  if (!email || !email.includes('@')) { toast('Enter a valid e-mail'); return; }
  if (pass.length < 4) { toast('Password must be at least 4 characters'); return; }
  const key = userKey(email);
  const btn = document.getElementById('authSubmit');
  btn.disabled = true; btn.style.opacity = '.7';
  try {
    if (AUTH_MODE === 'signup') {
      const name = (document.getElementById('authName').value || '').trim();
      if (!name) { toast('Enter a display name'); return; }
      const r = await fetch(`${FB}users/${key}.json`);
      const existing = r.ok ? await r.json() : null;
      if (existing) { toast('Account already exists — please login'); return; }
      let role = 'user';
      try {
        const ar = await fetch(`${FB}users.json?shallow=true`);
        const all = ar.ok ? await ar.json() : null;
        if (!all || !Object.keys(all).length) role = 'admin';
      } catch {}
      const passHash = await sha256Hex(pass);
      await fetch(`${FB}users/${key}.json`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ email, name, passHash, role, banned:false, createdAt: Date.now() })
      });
      lss('authUser', { key, email, name, role });
      localStorage.setItem('profileName', name);
      applyProfilePic();
      toast(role === 'admin' ? '🎉 Account created — you are the ADMIN' : '🎉 Account created');
      nav('profile');
    } else {
      const r = await fetch(`${FB}users/${key}.json`);
      const u = r.ok ? await r.json() : null;
      if (!u) { toast('No account found — sign up first'); return; }
      if (u.banned) { toast('🚫 This account has been banned'); return; }
      const passHash = await sha256Hex(pass);
      if (passHash !== u.passHash) { toast('❌ Wrong password'); return; }
      lss('authUser', { key, email: u.email, name: u.name, role: u.role || 'user' });
      localStorage.setItem('profileName', u.name || u.email);
      applyProfilePic();
      toast('👋 Welcome back, ' + (u.name || u.email));
      nav('profile');
    }
    document.getElementById('authPass').value = '';
  } catch(e) {
    toast('Network error — check your connection');
  } finally {
    btn.disabled = false; btn.style.opacity = '';
  }
}

async function initAdmin(){
  if (!isAdmin()) { toast('🔒 Admin only'); nav('settings'); return; }
  if (!ALL.length) await fetchLib();
  const bookOptions = ALL.map(b =>
    `<option value="${b.id}">${b.title} (${(b.type||'CBZ').toUpperCase()})</option>`).join('');
  const sel = document.getElementById('admBookSel');
  if (sel) sel.innerHTML = bookOptions;
  const apiSel = document.getElementById('admApiBookSel');
  if (apiSel) apiSel.innerHTML = bookOptions;
  const apiStatus = document.getElementById('admApiStatus');
  if (apiStatus) apiStatus.style.display = 'none';
  admRenderChapters();
  admLoadUsers();
}

function admCurBook(){
  const id = document.getElementById('admBookSel')?.value;
  return ALL.find(b => b.id === id);
}

function admMakeChapRow(chap, url, type){
  const row = document.createElement('div');
  row.className = 'adm-chap-row';
  row.dataset.chap = chap;
  const tSel = (t) => (type||'CBZ').toUpperCase() === t ? ' selected' : '';
  row.innerHTML = `<span class="ch-n">Ch.${chap}</span>
    <input class="adm-inp adm-url" value="${(url||'').replace(/"/g,'&quot;')}" placeholder="File URL (.cbz / .pdf)">
    <select class="adm-inp adm-type"><option${tSel('CBZ')}>CBZ</option><option${tSel('PDF')}>PDF</option></select>
    <button class="adm-del" title="Delete chapter"><i class="fa-solid fa-trash"></i></button>`;
  row.querySelector('.adm-del').onclick = () => { row.remove(); };
  return row;
}

function admRenderChapters(){
  const b = admCurBook();
  const list = document.getElementById('admChapList');
  if (!b || !list) return;
  list.innerHTML = '';
  const chs = [...(b.chapters || [])].sort((a,c) => c.chap - a.chap);
  chs.forEach(c => {
    const e = c.entries?.[0] || {};
    list.appendChild(admMakeChapRow(c.chap, e.url, e.type));
  });
}

function admAddChapter(){
  const n = parseInt(document.getElementById('admNewChap').value, 10);
  const u = (document.getElementById('admNewUrl').value || '').trim();
  const t = document.getElementById('admNewType').value;
  if (!n || !u) { toast('Enter a chapter number and file URL'); return; }
  const list = document.getElementById('admChapList');
  if ([...list.children].some(r => parseInt(r.dataset.chap, 10) === n)) { toast('Chapter ' + n + ' already in the list'); return; }
  list.prepend(admMakeChapRow(n, u, t));
  document.getElementById('admNewChap').value = '';
  document.getElementById('admNewUrl').value = '';
  toast('Chapter ' + n + ' added — press Save to apply');
}

function admSaveChapters(){
  const b = admCurBook();
  if (!b) { toast('Select a book first'); return; }
  const rows = [...document.querySelectorAll('#admChapList .adm-chap-row')];
  if (!rows.length) { toast('No chapters to save'); return; }
  const old = {};
  (b.chapters || []).forEach(c => { old[c.chap] = c; });
  const chaps = rows.map(r => {
    const n = parseInt(r.dataset.chap, 10);
    const url = (r.querySelector('.adm-url').value || '').trim();
    const type = r.querySelector('.adm-type').value;
    const prev = old[n]?.entries?.[0] || {};
    return { chap: n, isEnd: false, entries: [{
      upvotes: prev.upvotes || 0, time: prev.time || 'now',
      group: prev.group || 'A&V STUDIO', url, type
    }]};
  }).sort((a,c) => c.chap - a.chap);
  const maxChap = Math.max(...chaps.map(c => c.chap));
  chaps.forEach(c => { c.isEnd = c.chap === maxChap; });
  const lib = ls('customLibrary') || ALL.map(({chapters, ...r}) => r);
  const i = lib.findIndex(x => x.id === b.id);
  const updated = { ...(i >= 0 ? lib[i] : b), chapters: chaps, totalChapters: String(maxChap) };
  if (i >= 0) lib[i] = updated; else lib.push(updated);
  lss('customLibrary', lib);
  ALL = applyCachedMetadata(lib.map(processBook));
  FILTERED = applyContentFilters(ALL);
  admRenderChapters();
  toast('✅ Saved ' + chaps.length + ' chapter links for ' + b.title);
}

async function admLoadUsers(){
  const box = document.getElementById('admUserList');
  if (!box) return;
  box.innerHTML = '<div class="empty" style="padding:24px"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading users…</p></div>';
  try {
    const r = await fetch(`${FB}users.json`);
    const d = r.ok ? await r.json() : null;
    const users = d ? Object.entries(d) : [];
    if (!users.length) {
      box.innerHTML = '<div class="empty"><i class="fa-solid fa-users"></i><h3>No users yet</h3><p>Accounts will appear here after sign up.</p></div>';
      return;
    }
    box.innerHTML = '';
    users.sort((a,b) => (a[1].createdAt||0) - (b[1].createdAt||0));
    users.forEach(([key, u]) => {
      const roleLbl = u.banned ? 'banned' : (u.role || 'user');
      const el = document.createElement('div');
      el.className = 'adm-user';
      el.innerHTML = `
        <div class="adm-user-info"><h4>${u.name || '–'}</h4><p>${u.email || key}</p></div>
        <span class="role-badge role-${roleLbl}">${roleLbl}</span>
        ${u.role !== 'admin' ? `
          <button class="adm-act ${u.role === 'mod' ? '' : 'ok'} mod-btn">${u.role === 'mod' ? 'Unmod' : 'Mod'}</button>
          <button class="adm-act ${u.banned ? 'ok' : 'danger'} ban-btn">${u.banned ? 'Unban' : 'Ban'}</button>` : ''}`;
      const modBtn = el.querySelector('.mod-btn');
      if (modBtn) modBtn.onclick = () => admSetUser(key, { role: u.role === 'mod' ? 'user' : 'mod' });
      const banBtn = el.querySelector('.ban-btn');
      if (banBtn) banBtn.onclick = () => {
        if (!u.banned && !confirm('Ban ' + (u.name || u.email) + '? They will no longer be able to log in.')) return;
        admSetUser(key, { banned: !u.banned });
      };
      box.appendChild(el);
    });
  } catch {
    box.innerHTML = '<div class="empty"><i class="fa-solid fa-triangle-exclamation"></i><h3>Could not load users</h3><p>Check your connection and try Refresh.</p></div>';
  }
}

async function admSetUser(key, patch){
  try {
    await fetch(`${FB}users/${key}.json`, {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(patch)
    });
    toast('✅ User updated');
    admLoadUsers();
  } catch {
    toast('Failed to update user');
  }
}

function openSearch(){
  document.getElementById('sovl').classList.add('open');
  document.getElementById('sinput').focus();
  document.getElementById('sres').innerHTML='';
}
function closeSearch(){
  document.getElementById('sovl').classList.remove('open');
  document.getElementById('sinput').value='';
}
document.getElementById('sinput').oninput = async function(){
  const q=this.value.toLowerCase().trim();
  const r=document.getElementById('sres'); r.innerHTML='';
  if(!q)return;
  if(!ALL.length) await fetchLib();
  const m=ALL.filter(b=>(b.title||'').toLowerCase().includes(q)||(b.category||'').toLowerCase().includes(q));
  if(!m.length){r.innerHTML=`<div class="empty"><i class="fa-solid fa-search"></i><h3>No results for "${q}"</h3></div>`;return;}
  m.forEach(b=>{
    const c=document.createElement('div'); c.className='src-card';
    c.innerHTML=`<img src="${b.cover}" alt="${b.title}"><div class="src-info"><h4>${b.title}</h4><p>${b.category||'–'} · ${b.chapter||'Chap 1'}</p></div>`;
    c.onclick=()=>{closeSearch();openBook(b);};
    r.appendChild(c);
  });
};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSearch();});

document.addEventListener('DOMContentLoaded', () => {
  applyAppearance();
  applyProfilePic();
  initHome();
  setInterval(async () => {
    try {
      const r = await fetch(LIB_URL + Date.now()); if (!r.ok) return;
      const githubData = await r.json();
      if (Array.isArray(githubData) && githubData.length) {
        let currentLibrary = ls('customLibrary') || ALL.map(({chapters,...r})=>r);
        let changed = false;
        githubData.forEach(gitBook => {
          const idx = currentLibrary.findIndex(b => b.id === gitBook.id);
          if (idx === -1) { currentLibrary.push(gitBook); changed = true; }
          else if (!currentLibrary[idx].imported && JSON.stringify(currentLibrary[idx]) !== JSON.stringify(gitBook)) { currentLibrary[idx] = { ...currentLibrary[idx], ...gitBook }; changed = true; }
        });
        if (changed) { lss('customLibrary', currentLibrary); ALL = applyCachedMetadata(currentLibrary.map(processBook)); toast('🔄 Sync verified'); }
      }
    } catch {}
  }, 5 * 60 * 1000);
});
