var STORAGE_KEYS = {
  theme: 'guaguatime-theme',
  language: 'guaguatime-language',
  savings: 'guaguatime-savings',
  favorites: 'guaguatime-favorites',
  history: 'guaguatime-history'
};

var CONDITION_ICONS = {
  rain: 'water_drop',
  rush_hour: 'schedule',
  paro: 'front_hand'
};

// Fallback strings so the UI never shows raw keys
var FALLBACK = {
  'status.loading': 'Cargando...',
  'status.errorTitle': 'Error',
  'status.errorText': 'No se pudo cargar la aplicacion.',
  'status.emptyTitle': 'Tu simulador esta listo',
  'status.emptyText': 'Selecciona origen y destino para comenzar.',
  'status.noResultsTitle': 'Sin resultados',
  'status.noResultsText': 'No hay rutas para esa combinacion.',
  'results.emptySummary': 'Busca una ruta para comenzar.',
  'results.noResultsSummary': 'No se encontraron rutas.',
  'search.originPlaceholder': '-- Selecciona origen --',
  'search.destinationPlaceholder': '-- Selecciona destino --',
  'favorites.empty': 'Sin favoritos aun.',
  'history.empty': 'Sin historial aun.',
  'detail.empty': 'Selecciona una ruta.',
  'map.caption': 'Selecciona una ruta para verla aqui',
  'detail.noAlerts': 'Sin alertas activas.'
};

var state = {
  sectors: [],
  routes: [],
  conditions: [],
  translations: {},
  dataLoaded: false,
  currentLanguage: 'es',
  currentTheme: 'light',
  savingsMode: 'off',
  selectedConditions: [],
  favorites: [],
  history: [],
  sortBy: 'time',
  search: { origin: '', destination: '' },
  ui: { status: 'empty', results: [] },
  selectedRouteId: null
};

var els = {};
var currencyFormatter = new Intl.NumberFormat('es-DO');

/* ============================================================
   INIT
   ============================================================ */
function init() {
  els = {
    form: document.getElementById('search-form'),
    origin: document.getElementById('origin'),
    destination: document.getElementById('destination'),
    originError: document.getElementById('origin-error'),
    destinationError: document.getElementById('destination-error'),
    conditionsList: document.getElementById('conditions-list'),
    resultsList: document.getElementById('results-list'),
    resultsSummary: document.getElementById('results-summary'),
    detailView: document.getElementById('detail-view'),
    detailModalBody: document.getElementById('detail-modal-body'),
    favoritesView: document.getElementById('favorites-view'),
    historyView: document.getElementById('history-view'),
    statusView: document.getElementById('status-view'),
    mapContainer: document.getElementById('map-container'),
    mapCaption: document.getElementById('map-caption'),
    themeToggle: document.getElementById('theme-toggle'),
    langToggle: document.getElementById('lang-toggle'),
    langLabel: document.getElementById('lang-label'),
    savingsToggle: document.getElementById('savings-toggle'),
    swapBtn: document.getElementById('swap-btn'),
    heroTime: document.getElementById('hero-time'),
    heroCost: document.getElementById('hero-cost'),
    heroTransfers: document.getElementById('hero-transfers'),
    openFavoritesModal: document.getElementById('open-favorites-modal'),
    openHistoryModal: document.getElementById('open-history-modal'),
    favoritesModalContent: document.getElementById('favorites-modal-content'),
    historyModalContent: document.getElementById('history-modal-content')
  };

  hydratePreferences();
  applyTheme();
  applySavingsMode();
  bindEvents();

  // Show a simple loading message WITHOUT using translate()
  els.statusView.innerHTML = '<article class="status-card">' +
    '<span class="material-icons-round status-card__icon">hourglass_top</span>' +
    '<h3>Cargando...</h3><p>Preparando datos del simulador.</p></article>';

  // Load all data
  Promise.all([
    fetchJson('./data/sectores.json'),
    fetchJson('./data/rutas.json'),
    fetchJson('./data/condiciones.json'),
    fetchJson('./data/i18n-es.json'),
    fetchJson('./data/i18n-en.json')
  ]).then(function(results) {
    state.sectors = results[0];
    state.routes = results[1];
    state.conditions = results[2];
    state.translations.es = results[3];
    state.translations.en = results[4];
    state.dataLoaded = true;

    // Now that translations are loaded, render everything
    applyLanguage();
    renderSectors();
    renderConditions();
    setStatus('empty');
    renderAll();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function() {});
    }
  }).catch(function(error) {
    console.error('Failed to load data:', error);
    // Show error without translate — data might not have loaded
    els.statusView.innerHTML = '<article class="status-card">' +
      '<span class="material-icons-round status-card__icon">error_outline</span>' +
      '<h3>Error al cargar</h3><p>No se pudieron cargar los datos. Intenta recargar la pagina.</p></article>';
  });
}

/* ============================================================
   FETCH JSON (with XHR fallback for file://)
   ============================================================ */
function fetchJson(path) {
  return new Promise(function(resolve, reject) {
    if (typeof fetch === 'function') {
      fetch(path).then(function(res) {
        if (res.ok || res.status === 0) return res.json();
        throw new Error('HTTP ' + res.status);
      }).then(resolve).catch(function() {
        xhrLoad(path, resolve, reject);
      });
    } else {
      xhrLoad(path, resolve, reject);
    }
  });
}

function xhrLoad(path, resolve, reject) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', path, true);
  xhr.onload = function() {
    if (xhr.status === 200 || xhr.status === 0) {
      try { resolve(JSON.parse(xhr.responseText)); }
      catch(e) { reject(e); }
    } else { reject(new Error('XHR ' + xhr.status)); }
  };
  xhr.onerror = function() { reject(new Error('XHR failed: ' + path)); };
  xhr.send();
}

/* ============================================================
   PREFERENCES
   ============================================================ */
function hydratePreferences() {
  state.currentTheme = localStorage.getItem(STORAGE_KEYS.theme) || detectSystemTheme();
  state.currentLanguage = localStorage.getItem(STORAGE_KEYS.language) || 'es';
  state.savingsMode = localStorage.getItem(STORAGE_KEYS.savings) || 'off';
  state.favorites = readArray(STORAGE_KEYS.favorites);
  state.history = readArray(STORAGE_KEYS.history);
}

function detectSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readArray(key) {
  try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; }
  catch(e) { return []; }
}

function writeArray(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

/* ============================================================
   EVENTS
   ============================================================ */
function bindEvents() {
  els.form.addEventListener('submit', handleSearchSubmit);
  els.swapBtn.addEventListener('click', swapSearchValues);
  els.themeToggle.addEventListener('click', toggleTheme);
  els.langToggle.addEventListener('click', toggleLanguage);
  els.savingsToggle.addEventListener('click', toggleSavingsMode);
  els.openFavoritesModal.addEventListener('click', function() { openModal('favorites-modal'); });
  els.openHistoryModal.addEventListener('click', function() { openModal('history-modal'); });

  document.querySelectorAll('.sort-chip').forEach(function(btn) {
    btn.addEventListener('click', function() {
      state.sortBy = btn.dataset.sort;
      state.ui.results = sortRoutes(state.ui.results.slice());
      if (state.ui.results.length) state.selectedRouteId = state.ui.results[0].id;
      renderSortChips();
      renderResults();
      renderDetail();
      renderMap();
      renderHeroStats();
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach(function(btn) {
    btn.addEventListener('click', function() { closeModal(btn.dataset.closeModal); });
  });

  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.is-open').forEach(function(m) { closeModal(m.id); });
    }
  });
}

/* ============================================================
   RENDER SECTORS — populates <select> dropdowns
   ============================================================ */
function renderSectors() {
  var sorted = state.sectors.slice().sort(function(a, b) { return a.name.localeCompare(b.name); });

  // Save current selection
  var curOrigin = els.origin.value;
  var curDest = els.destination.value;

  // Clear and rebuild using DOM methods (no innerHTML encoding issues)
  els.origin.innerHTML = '';
  els.destination.innerHTML = '';

  var phO = document.createElement('option');
  phO.value = '';
  phO.textContent = translate('search.originPlaceholder');
  els.origin.appendChild(phO);

  var phD = document.createElement('option');
  phD.value = '';
  phD.textContent = translate('search.destinationPlaceholder');
  els.destination.appendChild(phD);

  sorted.forEach(function(s) {
    var o1 = document.createElement('option');
    o1.value = s.name;
    o1.textContent = s.name;
    els.origin.appendChild(o1);

    var o2 = document.createElement('option');
    o2.value = s.name;
    o2.textContent = s.name;
    els.destination.appendChild(o2);
  });

  // Restore selection
  if (curOrigin) els.origin.value = curOrigin;
  if (curDest) els.destination.value = curDest;
}

/* ============================================================
   RENDER CONDITIONS (toggle switches)
   ============================================================ */
function renderConditions() {
  var html = '';
  state.conditions.forEach(function(c) {
    var checked = state.selectedConditions.indexOf(c.id) !== -1 ? ' checked' : '';
    var icon = CONDITION_ICONS[c.id] || 'warning';
    html += '<label class="condition-card" for="cond-' + c.id + '">' +
      '<div class="condition-card__info">' +
        '<div class="condition-card__icon condition-card__icon--' + c.id + '">' +
          '<span class="material-icons-round">' + icon + '</span>' +
        '</div>' +
        '<div class="condition-card__text">' +
          '<span class="condition-card__title">' + esc(translate(c.labelKey)) + '</span>' +
          '<span class="condition-card__meta">+' + c.time_pct + '% tiempo &middot; RD$' + c.cost_extra + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="toggle-switch">' +
        '<input id="cond-' + c.id + '" type="checkbox" data-cid="' + c.id + '"' + checked + ' />' +
        '<span class="toggle-switch__track"></span>' +
      '</div>' +
    '</label>';
  });
  els.conditionsList.innerHTML = html;

  els.conditionsList.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
    cb.addEventListener('change', onConditionChange);
  });
}

function onConditionChange() {
  state.selectedConditions = [];
  els.conditionsList.querySelectorAll('input[type="checkbox"]:checked').forEach(function(item) {
    state.selectedConditions.push(item.dataset.cid);
  });
  if (state.search.origin && state.search.destination) {
    var results = calculateRoutes(state.search.origin, state.search.destination);
    state.ui.results = results;
    state.selectedRouteId = results.length ? results[0].id : null;
    setStatus(results.length ? 'success' : 'no-results');
  }
  renderAll();
}

/* ============================================================
   SEARCH
   ============================================================ */
function handleSearchSubmit(e) {
  e.preventDefault();
  if (!validateSearch(true)) return;

  state.search.origin = els.origin.value.trim();
  state.search.destination = els.destination.value.trim();
  setStatus('loading');
  renderAll();

  var delay = state.savingsMode === 'on' ? 60 : 180;
  setTimeout(function() {
    var results = calculateRoutes(state.search.origin, state.search.destination);
    state.ui.results = results;
    state.selectedRouteId = results.length ? results[0].id : null;
    setStatus(results.length ? 'success' : 'no-results');
    if (results.length) addHistoryEntry(results[0]);
    renderAll();
  }, delay);
}

function validateSearch(showErrors) {
  var origin = els.origin.value.trim();
  var dest = els.destination.value.trim();
  var valid = true;
  els.originError.textContent = '';
  els.destinationError.textContent = '';

  if (!origin) { valid = false; if (showErrors) els.originError.textContent = translate('validation.requiredOrigin'); }
  if (!dest) { valid = false; if (showErrors) els.destinationError.textContent = translate('validation.requiredDestination'); }
  if (origin && dest && origin.toLowerCase() === dest.toLowerCase()) {
    valid = false; if (showErrors) els.destinationError.textContent = translate('validation.same');
  }
  return valid;
}

function swapSearchValues() {
  var tmp = els.origin.value;
  els.origin.value = els.destination.value;
  els.destination.value = tmp;
}

/* ============================================================
   ROUTE CALCULATION
   ============================================================ */
function calculateRoutes(originName, destName) {
  var oSector = findSectorByName(originName);
  var dSector = findSectorByName(destName);
  if (!oSector || !dSector) return [];

  var active = getActiveConditions();
  var timeMul = active.reduce(function(a, c) { return a * (1 + c.time_pct / 100); }, 1);
  var extraCost = active.reduce(function(a, c) { return a + Number(c.cost_extra || 0); }, 0);
  var alertsList = active.map(function(c) { return { id: c.id, text: translate(c.alertKey) }; });
  var meta = { originName: oSector.name, destinationName: dSector.name, conditions: state.selectedConditions.slice() };

  // Find direct routes (A→B or B→A)
  function findDirect(fromId, toId) {
    var fwd = state.routes.filter(function(r) { return norm(r.origin) === norm(fromId) && norm(r.destination) === norm(toId); });
    var rev = state.routes.filter(function(r) { return norm(r.origin) === norm(toId) && norm(r.destination) === norm(fromId); });
    return fwd.concat(rev.map(function(r) {
      return { id: r.id + '-rev', name: r.name, origin: toId, destination: fromId,
        segments: r.segments.slice().reverse().map(function(seg) {
          return { id: seg.id + '-r', fromId: seg.toId, toId: seg.fromId, from: seg.to, to: seg.from, modeKey: seg.modeKey, time_min: seg.time_min, cost: seg.cost, instruction: seg.instruction };
        })
      };
    }));
  }

  function makeResult(id, name, segs) {
    var baseTime = segs.reduce(function(s, seg) { return s + Number(seg.time_min || 0); }, 0);
    var baseCost = segs.reduce(function(s, seg) { return s + Number(seg.cost || 0); }, 0);
    return {
      id: id, name: name, origin: oSector.id, destination: dSector.id,
      segments: segs, baseTime: baseTime, baseCost: baseCost,
      totalTime: Math.round(baseTime * timeMul), totalCost: baseCost + extraCost,
      transfers: Math.max(segs.length - 1, 0), alerts: alertsList, searchMeta: meta
    };
  }

  // 1) Direct routes
  var direct = findDirect(oSector.id, dSector.id);
  var results = direct.map(function(r) { return makeResult(r.id, r.name, r.segments); });

  // 2) If no direct routes, try via hubs (gazcue, naco, zona_colonial)
  if (!results.length) {
    var hubs = ['gazcue', 'naco', 'zona_colonial', 'los_prados', 'arroyo_hondo'];
    var seen = {};
    hubs.forEach(function(hub) {
      if (hub === oSector.id || hub === dSector.id) return;
      var legA = findDirect(oSector.id, hub);
      var legB = findDirect(hub, dSector.id);
      if (legA.length && legB.length) {
        var a = legA[0]; var b = legB[0];
        var key = a.id + '|' + b.id;
        if (!seen[key]) {
          seen[key] = true;
          var hubSector = state.sectors.find(function(s) { return s.id === hub; });
          var hubName = hubSector ? hubSector.name : hub;
          var combined = a.segments.concat(b.segments);
          results.push(makeResult('hub-' + hub + '-' + oSector.id + '-' + dSector.id,
            'Vía ' + hubName, combined));
        }
      }
    });
  }

  // 3) If still nothing, generate a synthetic direct route
  if (!results.length) {
    var dist = Math.abs(oSector.coords.x - dSector.coords.x) + Math.abs(oSector.coords.y - dSector.coords.y);
    var estTime = Math.max(10, Math.round(dist / 12));
    var modes = [
      { key: 'modes.guagua', cost: 25, factor: 1 },
      { key: 'modes.carroPublico', cost: 35, factor: 0.85 },
      { key: 'modes.motoconcho', cost: 60 + Math.round(dist / 8), factor: 0.6 }
    ];
    modes.forEach(function(m, i) {
      var t = Math.round(estTime * m.factor);
      results.push(makeResult('gen-' + i + '-' + oSector.id + '-' + dSector.id,
        translate(m.key) + ' ' + oSector.name + ' → ' + dSector.name,
        [{ id: 'gs-' + i, fromId: oSector.id, toId: dSector.id, from: oSector.name, to: dSector.name,
           modeKey: m.key, time_min: t, cost: m.cost,
           instruction: { es: translate(m.key) + ' directo de ' + oSector.name + ' a ' + dSector.name + '.', en: 'Direct ' + translate(m.key) + ' from ' + oSector.name + ' to ' + dSector.name + '.' } }]
      ));
    });
  }

  return sortRoutes(results);
}

function sortRoutes(routes) {
  var s = routes.slice();
  if (state.sortBy === 'cost') s.sort(function(a, b) { return a.totalCost - b.totalCost || a.totalTime - b.totalTime; });
  else if (state.sortBy === 'transfers') s.sort(function(a, b) { return a.transfers - b.transfers || a.totalTime - b.totalTime; });
  else s.sort(function(a, b) { return a.totalTime - b.totalTime || a.totalCost - b.totalCost; });
  return s;
}

function getActiveConditions() {
  return state.conditions.filter(function(c) { return state.selectedConditions.indexOf(c.id) !== -1; });
}

/* ============================================================
   FAVORITES
   ============================================================ */
function isFavorite(route) {
  return state.favorites.some(function(f) {
    return f.route.id === route.id &&
      f.route.searchMeta.originName === route.searchMeta.originName &&
      f.route.searchMeta.destinationName === route.searchMeta.destinationName;
  });
}

function toggleFavorite(routeId) {
  var route = findRouteInAll(routeId);
  if (!route) return;
  if (isFavorite(route)) {
    state.favorites = state.favorites.filter(function(f) {
      return !(f.route.id === route.id && f.route.searchMeta.originName === route.searchMeta.originName && f.route.searchMeta.destinationName === route.searchMeta.destinationName);
    });
  } else {
    state.favorites.unshift({ favoriteId: 'fav-' + Date.now(), savedAt: new Date().toISOString(), route: route });
    if (state.favorites.length > 24) state.favorites = state.favorites.slice(0, 24);
  }
  writeArray(STORAGE_KEYS.favorites, state.favorites);
  renderFavorites();
  renderFavoritesModal();
  renderResults();
}

function findRouteInAll(routeId) {
  var r = state.ui.results.find(function(x) { return x.id === routeId; });
  if (r) return r;
  var f = state.favorites.find(function(x) { return x.route.id === routeId; });
  if (f) return f.route;
  var h = state.history.find(function(x) { return x.route.id === routeId; });
  if (h) return h.route;
  return null;
}

/* ============================================================
   HISTORY
   ============================================================ */
function addHistoryEntry(route) {
  state.history = [
    { entryId: 'hist-' + Date.now(), savedAt: new Date().toISOString(), sortBy: state.sortBy, route: route }
  ].concat(state.history.filter(function(h) {
    return !(h.route.id === route.id && h.route.searchMeta.originName === route.searchMeta.originName && h.route.searchMeta.destinationName === route.searchMeta.destinationName);
  })).slice(0, 24);
  writeArray(STORAGE_KEYS.history, state.history);
}

function rerunRoute(route) {
  els.origin.value = route.searchMeta.originName;
  els.destination.value = route.searchMeta.destinationName;
  state.selectedConditions = route.searchMeta.conditions.slice();
  renderConditions();
  state.search.origin = route.searchMeta.originName;
  state.search.destination = route.searchMeta.destinationName;
  state.ui.results = calculateRoutes(route.searchMeta.originName, route.searchMeta.destinationName);
  state.selectedRouteId = route.id;
  setStatus(state.ui.results.length ? 'success' : 'no-results');
  renderAll();
  closeModal('favorites-modal');
  closeModal('history-modal');
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderAll() {
  renderStatus();
  renderSortChips();
  renderResults();
  renderDetail();
  renderFavorites();
  renderHistory();
  renderMap();
  renderHeroStats();
}

function renderStatus() {
  var s = state.ui.status;
  var icons = { loading: 'hourglass_top', error: 'error_outline', empty: 'explore', 'no-results': 'search_off' };
  var titles = { loading: 'status.loading', error: 'status.errorTitle', empty: 'status.emptyTitle', 'no-results': 'status.noResultsTitle' };
  var texts = { loading: 'results.emptySummary', error: 'status.errorText', empty: 'status.emptyText', 'no-results': 'status.noResultsText' };

  if (icons[s]) {
    els.statusView.innerHTML = '<article class="status-card">' +
      '<span class="material-icons-round status-card__icon">' + icons[s] + '</span>' +
      '<h3>' + esc(translate(titles[s])) + '</h3>' +
      '<p>' + esc(translate(texts[s])) + '</p></article>';
  } else {
    els.statusView.innerHTML = '';
  }
}

function renderResults() {
  if (state.ui.status !== 'success' || !state.ui.results.length) {
    els.resultsList.innerHTML = '';
    els.resultsSummary.textContent = state.ui.status === 'no-results'
      ? translate('results.noResultsSummary') : translate('results.emptySummary');
    return;
  }

  els.resultsSummary.textContent = translate('results.summary').replace('{count}', String(state.ui.results.length));
  var fastest = sortByProp(state.ui.results, 'totalTime')[0];
  var cheapest = sortByProp(state.ui.results, 'totalCost')[0];
  var lowTrans = sortByProp(state.ui.results, 'transfers')[0];

  var html = '';
  state.ui.results.forEach(function(route) {
    var fav = isFavorite(route);
    var sel = route.id === state.selectedRouteId;
    var badges = '';
    if (route.id === fastest.id) badges += '<span class="badge badge--fastest">' + esc(translate('results.fastest')) + '</span>';
    if (route.id === cheapest.id) badges += '<span class="badge badge--cheapest">' + esc(translate('results.cheapest')) + '</span>';
    if (route.id === lowTrans.id) badges += '<span class="badge badge--low-transfers">' + esc(translate('results.lowTransfers')) + '</span>';

    var modes = '';
    route.segments.forEach(function(seg) {
      modes += '<span class="badge ' + modeBadgeClass(seg.modeKey) + '">' + esc(translate(seg.modeKey)) + '</span>';
    });

    var alerts = '';
    if (route.alerts.length) {
      alerts = '<div class="route-card__alerts">';
      route.alerts.forEach(function(a) {
        alerts += '<div class="alert-inline"><span class="material-icons-round">warning_amber</span>' + esc(a.text) + '</div>';
      });
      alerts += '</div>';
    }

    html += '<article class="route-card' + (sel ? ' is-selected' : '') + '" data-rid="' + route.id + '">';
    html += '<div class="route-card__topbar">';
    html += '<button class="fav-btn' + (fav ? ' is-favorited' : '') + '" type="button" data-fav="' + route.id + '"><span class="material-icons-round">' + (fav ? 'favorite' : 'favorite_border') + '</span></button>';
    if (badges) html += '<div class="route-card__badges">' + badges + '</div>';
    html += '</div>';
    html += '<div class="route-card__header">';
    html += '<p class="route-card__route">' + esc(route.searchMeta.originName) + ' &#8594; ' + esc(route.searchMeta.destinationName) + '</p>';
    html += '<p class="route-card__name">' + esc(route.name) + '</p>';
    html += '</div>';
    html += '<div class="route-card__metrics">';
    html += '<div class="metric-card"><span>' + esc(translate('sort.time')) + '</span><strong>' + route.totalTime + ' ' + esc(translate('units.minutes')) + '</strong></div>';
    html += '<div class="metric-card"><span>' + esc(translate('sort.cost')) + '</span><strong>RD$' + fmtCurrency(route.totalCost) + '</strong></div>';
    html += '<div class="metric-card"><span>' + esc(translate('sort.transfers')) + '</span><strong>' + route.transfers + '</strong></div>';
    html += '</div>';
    html += '<div class="route-card__modes">' + modes + '</div>';
    html += alerts;
    html += '<div class="route-card__footer">';
    html += '<span class="route-card__seg-count">' + route.segments.length + ' ' + esc(translate('detail.segments')) + '</span>';
    html += '<button class="btn-detail" type="button" data-detail="' + route.id + '"><span class="material-icons-round">visibility</span>' + esc(translate('results.viewDetail')) + '</button>';
    html += '</div>';
    html += '</article>';
  });

  els.resultsList.innerHTML = html;

  // Bind events
  els.resultsList.querySelectorAll('[data-rid]').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('[data-fav]') || e.target.closest('[data-detail]')) return;
      state.selectedRouteId = card.dataset.rid;
      renderResults(); renderDetail(); renderMap(); renderHeroStats();
      renderDetailModal();
      openModal('detail-modal');
    });
  });
  els.resultsList.querySelectorAll('[data-fav]').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); toggleFavorite(btn.dataset.fav); });
  });
  els.resultsList.querySelectorAll('[data-detail]').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      state.selectedRouteId = btn.dataset.detail;
      renderDetailModal();
      openModal('detail-modal');
    });
  });
}

/* ============================================================
   DETAIL
   ============================================================ */
function renderDetail() {
  var route = getSelectedRoute();
  if (!route) {
    els.detailView.innerHTML = '<div class="detail-empty">' + esc(translate('detail.empty')) + '</div>';
    return;
  }
  els.detailView.innerHTML = buildDetailHtml(route);
}

function renderDetailModal() {
  var route = getSelectedRoute();
  if (!route || !els.detailModalBody) return;
  els.detailModalBody.innerHTML = buildDetailHtml(route);
}

function buildDetailHtml(route) {
  var alertsHtml = '';
  if (route.alerts.length) {
    route.alerts.forEach(function(a) {
      alertsHtml += '<div class="alert-inline"><span class="material-icons-round">warning_amber</span>' + esc(a.text) + '</div>';
    });
  } else {
    alertsHtml = '<div class="detail-empty">' + esc(translate('detail.noAlerts')) + '</div>';
  }

  var stepsHtml = '';
  route.segments.forEach(function(seg, i) {
    stepsHtml += '<article class="detail-step">' +
      '<div class="detail-step__num">' + (i + 1) + '</div>' +
      '<div>' +
        '<div class="detail-step__transport"><span class="badge ' + modeBadgeClass(seg.modeKey) + '">' + esc(translate(seg.modeKey)) + '</span></div>' +
        '<div class="detail-step__route">' + esc(seg.from) + ' &#8594; ' + esc(seg.to) + '</div>' +
        '<div class="detail-step__meta">' + seg.time_min + ' ' + esc(translate('units.minutes')) + ' &middot; RD$' + fmtCurrency(seg.cost) + '</div>' +
        '<div class="detail-step__instruction">' + esc(translateInstruction(seg)) + '</div>' +
      '</div></article>';
  });

  return '<div class="detail-header">' +
    '<h3 class="detail-header__title">' + esc(route.name) + '</h3>' +
    '<p class="detail-header__route">' + esc(route.searchMeta.originName) + ' &#8594; ' + esc(route.searchMeta.destinationName) + '</p></div>' +
    '<div class="detail-kpis">' +
      '<article class="detail-kpi"><span class="detail-kpi__label">' + esc(translate('detail.totalTime')) + '</span><strong class="detail-kpi__value">' + route.totalTime + ' ' + esc(translate('units.minutes')) + '</strong></article>' +
      '<article class="detail-kpi"><span class="detail-kpi__label">' + esc(translate('detail.totalCost')) + '</span><strong class="detail-kpi__value">RD$' + fmtCurrency(route.totalCost) + '</strong></article>' +
      '<article class="detail-kpi"><span class="detail-kpi__label">' + esc(translate('detail.transfers')) + '</span><strong class="detail-kpi__value">' + route.transfers + '</strong></article>' +
    '</div>' +
    '<div class="detail-alerts">' + alertsHtml + '</div>' +
    '<div class="detail-steps">' + stepsHtml + '</div>';
}

/* ============================================================
   FAVORITES / HISTORY VIEWS
   ============================================================ */
function renderFavorites() {
  if (!state.favorites.length) {
    els.favoritesView.innerHTML = '<div class="detail-empty">' + esc(translate('favorites.empty')) + '</div>';
    return;
  }
  var html = '';
  state.favorites.slice(0, 3).forEach(function(item) {
    html += '<button class="favorite-card" type="button" data-favid="' + item.favoriteId + '">' +
      '<p class="fav-card__route">' + esc(item.route.searchMeta.originName) + ' &#8594; ' + esc(item.route.searchMeta.destinationName) + '</p>' +
      '<p class="fav-card__name">' + esc(item.route.name) + '</p>' +
      '<div class="fav-card__pills"><span class="pill-stat"><strong>' + item.route.totalTime + '</strong> ' + esc(translate('units.minutes')) + '</span>' +
      '<span class="pill-stat"><strong>RD$' + fmtCurrency(item.route.totalCost) + '</strong></span></div></button>';
  });
  els.favoritesView.innerHTML = html;

  els.favoritesView.querySelectorAll('[data-favid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = state.favorites.find(function(f) { return f.favoriteId === btn.dataset.favid; });
      if (item) rerunRoute(item.route);
    });
  });
  renderFavoritesModal();
}

function renderHistory() {
  if (!state.history.length) {
    els.historyView.innerHTML = '<div class="detail-empty">' + esc(translate('history.empty')) + '</div>';
    return;
  }
  var html = '';
  state.history.slice(0, 3).forEach(function(item) {
    html += '<button class="history-card" type="button" data-hid="' + item.entryId + '">' +
      '<p class="hist-card__route">' + esc(item.route.searchMeta.originName) + ' &#8594; ' + esc(item.route.searchMeta.destinationName) + '</p>' +
      '<p class="hist-card__name">' + esc(item.route.name) + '</p>' +
      '<div class="hist-card__pills"><span class="pill-stat"><strong>' + item.route.totalTime + '</strong> ' + esc(translate('units.minutes')) + '</span>' +
      '<span class="pill-stat"><strong>RD$' + fmtCurrency(item.route.totalCost) + '</strong></span></div>' +
      '<div class="hist-card__date">' + formatDate(item.savedAt) + '</div></button>';
  });
  els.historyView.innerHTML = html;

  els.historyView.querySelectorAll('[data-hid]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var item = state.history.find(function(h) { return h.entryId === btn.dataset.hid; });
      if (item) rerunRoute(item.route);
    });
  });
  renderHistoryModal();
}

function renderFavoritesModal() {
  if (!state.favorites.length) {
    els.favoritesModalContent.innerHTML = '<div class="modal-empty">' + esc(translate('favorites.empty')) + '</div>';
    return;
  }
  var html = '';
  state.favorites.forEach(function(item) {
    html += buildModalRouteCard(item.route, {
      date: formatDate(item.savedAt),
      primary: { label: translate('favorites.rerun'), action: 'rerun' },
      secondary: { label: translate('favorites.delete'), action: 'delete-fav' },
      id: item.favoriteId
    });
  });
  els.favoritesModalContent.innerHTML = html;
  bindModalActions();
}

function renderHistoryModal() {
  if (!state.history.length) {
    els.historyModalContent.innerHTML = '<div class="modal-empty">' + esc(translate('history.empty')) + '</div>';
    return;
  }
  var html = '';
  state.history.forEach(function(item) {
    html += buildModalRouteCard(item.route, {
      date: formatDate(item.savedAt),
      primary: { label: translate('history.repeat'), action: 'rerun' },
      secondary: null,
      id: item.entryId
    });
  });
  els.historyModalContent.innerHTML = html;
  bindModalActions();
}

function buildModalRouteCard(route, cfg) {
  var stepsHtml = '';
  route.segments.forEach(function(seg, i) {
    stepsHtml += '<div class="modal-route-card__step"><div class="modal-step-num">' + (i+1) + '</div><div>' +
      '<span class="badge ' + modeBadgeClass(seg.modeKey) + '">' + esc(translate(seg.modeKey)) + '</span>' +
      '<div class="step-route">' + esc(seg.from) + ' &#8594; ' + esc(seg.to) + '</div>' +
      '<div class="step-meta">' + seg.time_min + ' ' + esc(translate('units.minutes')) + ' &middot; RD$' + fmtCurrency(seg.cost) + '</div>' +
      '<div class="step-instruction">' + esc(translateInstruction(seg)) + '</div></div></div>';
  });
  var secBtn = cfg.secondary
    ? '<button class="card-action" type="button" data-mact="' + cfg.secondary.action + '" data-mid="' + cfg.id + '">' + esc(cfg.secondary.label) + '</button>'
    : '';

  return '<article class="modal-route-card">' +
    '<div class="modal-route-card__header"><div>' +
      '<h3 class="modal-route-card__title">' + esc(route.searchMeta.originName) + ' &#8594; ' + esc(route.searchMeta.destinationName) + '</h3>' +
      '<p class="modal-route-card__subtitle">' + esc(route.name) + '</p></div>' +
      '<span class="badge">' + route.segments.length + ' ' + esc(translate('detail.segments')) + '</span></div>' +
    '<div class="modal-route-card__kpis">' +
      '<article class="modal-route-card__kpi"><span>' + esc(translate('sort.time')) + '</span><strong>' + route.totalTime + ' ' + esc(translate('units.minutes')) + '</strong></article>' +
      '<article class="modal-route-card__kpi"><span>' + esc(translate('sort.cost')) + '</span><strong>RD$' + fmtCurrency(route.totalCost) + '</strong></article>' +
      '<article class="modal-route-card__kpi"><span>' + esc(translate('sort.transfers')) + '</span><strong>' + route.transfers + '</strong></article></div>' +
    '<div class="modal-route-card__steps-label">' + esc(translate('detail.title')) + '</div>' +
    '<div class="modal-route-card__steps">' + stepsHtml + '</div>' +
    '<div class="modal-route-card__footer"><div class="card-actions">' +
      '<button class="card-action" type="button" data-mact="' + cfg.primary.action + '" data-mid="' + cfg.id + '">' + esc(cfg.primary.label) + '</button>' +
      secBtn + '</div><span class="modal-route-card__date">' + esc(cfg.date) + '</span></div></article>';
}

function bindModalActions() {
  document.querySelectorAll('[data-mact]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var action = btn.dataset.mact;
      var id = btn.dataset.mid;
      if (action === 'rerun') {
        var fav = state.favorites.find(function(f) { return f.favoriteId === id; });
        var hist = state.history.find(function(h) { return h.entryId === id; });
        if (fav) rerunRoute(fav.route);
        else if (hist) rerunRoute(hist.route);
      }
      if (action === 'delete-fav') {
        state.favorites = state.favorites.filter(function(f) { return f.favoriteId !== id; });
        writeArray(STORAGE_KEYS.favorites, state.favorites);
        renderFavorites();
      }
    });
  });
}

/* ============================================================
   MAP
   ============================================================ */
function renderMap() {
  var route = getSelectedRoute();
  if (!route) {
    els.mapContainer.innerHTML = '<div class="detail-empty">' + esc(translate('map.caption')) + '</div>';
    return;
  }

  var activeIds = {};
  route.segments.forEach(function(seg) { activeIds[seg.fromId] = true; activeIds[seg.toId] = true; });

  var lines = '';
  route.segments.forEach(function(seg) {
    var from = state.sectors.find(function(s) { return s.id === seg.fromId; });
    var to = state.sectors.find(function(s) { return s.id === seg.toId; });
    if (!from || !to) return;
    lines += '<g><line class="map-line map-line--active" x1="' + from.coords.x + '" y1="' + from.coords.y +
      '" x2="' + to.coords.x + '" y2="' + to.coords.y + '" stroke="' + modeLineColor(seg.modeKey) + '"></line>' +
      '<circle class="map-stop" cx="' + from.coords.x + '" cy="' + from.coords.y + '" r="6"></circle>' +
      '<circle class="map-stop" cx="' + to.coords.x + '" cy="' + to.coords.y + '" r="6"></circle></g>';
  });

  var nodes = '';
  state.sectors.forEach(function(sec) {
    nodes += '<g><circle class="map-node' + (activeIds[sec.id] ? ' map-node--active' : '') +
      '" cx="' + sec.coords.x + '" cy="' + sec.coords.y + '" r="11"></circle>' +
      '<text class="map-node-label" x="' + (sec.coords.x + 16) + '" y="' + (sec.coords.y + 5) + '">' + esc(sec.name) + '</text></g>';
  });

  els.mapContainer.innerHTML = '<svg class="map-svg" viewBox="10 10 620 280" role="img">' +
    '<defs><linearGradient id="mapBg" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0%" stop-color="rgba(61,165,217,0.14)"></stop>' +
    '<stop offset="100%" stop-color="rgba(13,59,102,0.03)"></stop></linearGradient></defs>' +
    '<rect x="10" y="10" width="620" height="280" rx="28" fill="url(#mapBg)"></rect>' +
    lines + nodes + '</svg>';
  els.mapCaption.textContent = route.searchMeta.originName + ' \u2192 ' + route.searchMeta.destinationName;
}

function renderHeroStats() {
  var route = getSelectedRoute();
  if (!route) {
    els.heroTime.textContent = '--';
    els.heroCost.textContent = '--';
    els.heroTransfers.textContent = '--';
    return;
  }
  els.heroTime.textContent = route.totalTime + ' ' + translate('units.minutes');
  els.heroCost.textContent = 'RD$' + fmtCurrency(route.totalCost);
  els.heroTransfers.textContent = String(route.transfers);
}

function renderSortChips() {
  document.querySelectorAll('.sort-chip').forEach(function(chip) {
    chip.classList.toggle('is-active', chip.dataset.sort === state.sortBy);
  });
}

/* ============================================================
   THEME / LANGUAGE / SAVINGS
   ============================================================ */
function toggleTheme() {
  state.currentTheme = state.currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(STORAGE_KEYS.theme, state.currentTheme);
  applyTheme();
  renderMap();
}

function applyTheme() {
  document.body.dataset.theme = state.currentTheme;
  var iconEl = els.themeToggle ? els.themeToggle.querySelector('.material-icons-round') : null;
  if (iconEl) iconEl.textContent = state.currentTheme === 'dark' ? 'dark_mode' : 'light_mode';
}

function toggleLanguage() {
  state.currentLanguage = state.currentLanguage === 'es' ? 'en' : 'es';
  localStorage.setItem(STORAGE_KEYS.language, state.currentLanguage);

  // Update lang label immediately
  els.langLabel.textContent = state.currentLanguage.toUpperCase();
  document.documentElement.lang = state.currentLanguage;

  // Update all static data-i18n elements
  document.querySelectorAll('[data-i18n]').forEach(function(node) {
    node.textContent = translate(node.dataset.i18n);
  });

  // Re-render all dynamic content with new language
  if (state.dataLoaded) {
    renderSectors();
    renderConditions();
    renderAll();
  }
}

function applyLanguage() {
  document.documentElement.lang = state.currentLanguage;
  if (els.langLabel) els.langLabel.textContent = state.currentLanguage.toUpperCase();
  document.querySelectorAll('[data-i18n]').forEach(function(node) {
    node.textContent = translate(node.dataset.i18n);
  });
}

function toggleSavingsMode() {
  state.savingsMode = state.savingsMode === 'on' ? 'off' : 'on';
  localStorage.setItem(STORAGE_KEYS.savings, state.savingsMode);
  applySavingsMode();
}

function applySavingsMode() {
  document.body.dataset.savings = state.savingsMode;
  if (els.savingsToggle) {
    els.savingsToggle.setAttribute('aria-pressed', String(state.savingsMode === 'on'));
    els.savingsToggle.classList.toggle('is-active', state.savingsMode === 'on');
    var icon = els.savingsToggle.querySelector('.material-icons-round');
    if (icon) icon.textContent = state.savingsMode === 'on' ? 'bolt' : 'bolt';
  }
}

/* ============================================================
   MODALS
   ============================================================ */
function openModal(id) {
  if (id === 'favorites-modal') renderFavoritesModal();
  if (id === 'history-modal') renderHistoryModal();
  if (id === 'detail-modal') renderDetailModal();
  var modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  var modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('is-open');
  document.body.style.overflow = '';
}

/* ============================================================
   HELPERS
   ============================================================ */
function setStatus(s) { state.ui.status = s; }

function findSectorByName(name) {
  return state.sectors.find(function(s) { return norm(s.name) === norm(name); });
}

function norm(v) { return String(v || '').trim().toLowerCase(); }

function getSelectedRoute() {
  if (!state.selectedRouteId) return null;
  return state.ui.results.find(function(r) { return r.id === state.selectedRouteId; }) || null;
}

function translate(key) {
  // Try current language dict
  var dict = state.translations[state.currentLanguage];
  if (dict) {
    var val = resolvePath(dict, key);
    if (val !== undefined) return val;
  }
  // Try Spanish fallback
  if (state.currentLanguage !== 'es' && state.translations.es) {
    var esFallback = resolvePath(state.translations.es, key);
    if (esFallback !== undefined) return esFallback;
  }
  // Try hardcoded fallback
  if (FALLBACK[key]) return FALLBACK[key];
  return key;
}

function resolvePath(obj, path) {
  var parts = path.split('.');
  var cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (cur && typeof cur === 'object' && parts[i] in cur) {
      cur = cur[parts[i]];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

function translateInstruction(seg) {
  if (!seg.instruction) return '';
  return seg.instruction[state.currentLanguage] || seg.instruction.es || '';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtCurrency(n) { return currencyFormatter.format(n); }

function modeBadgeClass(modeKey) {
  var k = String(modeKey).toLowerCase();
  if (k.indexOf('guagua') !== -1) return 'badge--guagua';
  if (k.indexOf('carro') !== -1) return 'badge--carro';
  if (k.indexOf('moto') !== -1) return 'badge--moto';
  return 'badge--concho';
}

function modeLineColor(modeKey) {
  var k = String(modeKey).toLowerCase();
  var prop = '--mode-concho';
  if (k.indexOf('guagua') !== -1) prop = '--mode-guagua';
  else if (k.indexOf('carro') !== -1) prop = '--mode-carro';
  else if (k.indexOf('moto') !== -1) prop = '--mode-moto';
  return getComputedStyle(document.body).getPropertyValue(prop).trim();
}

function formatDate(val) {
  try {
    var loc = state.currentLanguage === 'en' ? 'en-US' : 'es-DO';
    return new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(val));
  } catch(e) { return val; }
}

function sortByProp(items, prop) {
  return items.slice().sort(function(a, b) { return a[prop] - b[prop]; });
}

/* ============================================================
   BOOT
   ============================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
