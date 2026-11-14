// Token Radar dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol
// detail view with the model's own inputs and the protocol's farm plan, the
// live-token set and the flagged bridged products. No network: every byte it
// shows comes from data.js, which is generated from the sealed snapshot.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = {
    q: '', category: 'all', chain: 'all', watchlistOnly: false, earlyOnly: false,
    tvlMin: 0, tab: 'board', sort: 'implied', dir: -1, selected: null,
  };

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return 'x' + n.toFixed(3); }

  // The page recomputes a row from the snapshot figures and the calibrated
  // multiple at full precision, so the page's arithmetic and board.json
  // visibly agree: the same operation order as lib/model.ts.
  function impliedOf(row) {
    var m = DATA.model;
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var chainMult = Math.min(m.chain_cap, 1 + m.chain_step * Math.max(0, (row.chains || []).length - 1));
    return Math.max(1, Math.round(row.tvl_usd * row.base_multiple_exact * growthMult * maturity * chainMult));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  var WATCHLIST = {};
  DATA.rows.forEach(function (r) { WATCHLIST[r.slug] = true; });

  function isWatchlist(r) { return !!WATCHLIST[r.slug] && r.tvl_usd >= DATA.floor_usd; }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl') === '1') state.watchlistOnly = true;
    if (params.get('early') === '1') state.earlyOnly = true;
    if (params.get('tvl')) state.tvlMin = parseInt(params.get('tvl'), 10) || 0;
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('p')) state.selected = params.get('p');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlistOnly) params.set('wl', '1');
    if (state.earlyOnly) params.set('early', '1');
    if (state.tvlMin > 0) params.set('tvl', String(state.tvlMin));
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (state.watchlistOnly && !isWatchlist(r)) return false;
      if (state.earlyOnly && isWatchlist(r)) return false;
      if (r.tvl_usd < state.tvlMin) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'multiple') { av = a.base_multiple; bv = b.base_multiple; }
      else if (key === 'rank') { av = a.rank; bv = b.rank; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function masthead() {
    return el('header', { class: 'masthead' },
      el('div', { class: 'brand' },
        el('span', { class: 'radar-dot', 'aria-hidden': 'true' }),
        el('div', null,
          el('h1', null, 'TOKEN ', el('span', { text: 'RADAR' })),
          el('p', { class: 'tagline', text: 'Pre-token protocols, ranked by implied value — from the snapshot’s own figures.' })
        )
      ),
      el('div', { class: 'snapshot-line' },
        el('div', { text: 'Snapshot ' + DATA.as_of + ' · DefiLlama protocol index' }),
        el('div', { text: 'Model ' + DATA.model_version + ' · calibrated on live-token comps' })
      )
    );
  }

  function stats() {
    return el('section', { class: 'stats' },
      el('div', { class: 'stat' }, el('b', { class: 'teal', text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('span', { text: 'Watchlist covered' })),
      el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'Pre-token rows scored' })),
      el('div', { class: 'stat' }, el('b', { text: String(DATA.early_size) }), el('span', { text: 'Early rows below the floor' })),
      el('div', { class: 'stat' }, el('b', { text: fmtUsd(DATA.rows[0] ? DATA.rows[0].implied_value_usd : 0) }), el('span', { text: 'Top implied value' })),
      el('div', { class: 'stat' }, el('b', { class: 'amber', text: String(DATA.flagged_size) }), el('span', { text: 'Flagged bridged products' }))
    );
  }

  function tabs() {
    function tabBtn(key, label, n) {
      return el('button', {
        type: 'button', 'aria-pressed': state.tab === key ? 'true' : 'false',
        onclick: function () { state.tab = key; writeHash(); render(); },
      }, label + ' ', el('span', { class: 'n', text: '(' + n + ')' }));
    }
    return el('div', { class: 'tabs' },
      tabBtn('board', 'Board', DATA.board_size),
      tabBtn('live', 'Live tokens', DATA.live_size),
      tabBtn('flagged', 'Flagged', DATA.flagged_size)
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chainCount = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { chainCount[c] = (chainCount[c] || 0) + 1; }); });
    var chains = Object.keys(chainCount).sort(function (a, b) { return chainCount[b] - chainCount[a]; }).slice(0, 40);
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var select = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { state.category = select.value; writeHash(); render(); });
    var chainSel = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSel.addEventListener('change', function () { state.chain = chainSel.value; writeHash(); render(); });
    var wlBox = el('input', { type: 'checkbox', id: 'wl', checked: state.watchlistOnly ? 'checked' : null });
    wlBox.addEventListener('change', function () { state.watchlistOnly = wlBox.checked; if (wlBox.checked) state.earlyOnly = false; writeHash(); render(); });
    var earlyBox = el('input', { type: 'checkbox', id: 'early', checked: state.earlyOnly ? 'checked' : null });
    earlyBox.addEventListener('change', function () { state.earlyOnly = earlyBox.checked; if (earlyBox.checked) state.watchlistOnly = false; writeHash(); render(); });
    var tvl = el('input', { type: 'range', id: 'tvl', min: '0', max: '3000', step: '10', value: String(Math.round(state.tvlMin / 1e6)), 'aria-label': 'Minimum TVL in millions' });
    tvl.addEventListener('input', function () { state.tvlMin = parseInt(tvl.value, 10) * 1e6; writeHash(); render(); });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), select),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSel),
      el('div', { class: 'field' }, el('label', { for: 'tvl', text: 'Min TVL' }), tvl,
        el('span', { class: 'range-val', text: state.tvlMin > 0 ? '≥ ' + fmtUsd(state.tvlMin) : 'any size' })),
      el('div', { class: 'checks' },
        el('label', null, wlBox, 'Watchlist only'),
        el('label', null, earlyBox, 'Early only')
      ),
      el('span', { class: 'count', text: filteredRows().length + ' rows shown' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col', class: key === 'implied' || key === 'tvl' || key === 'growth' || key === 'age' || key === 'multiple' || key === 'rank' ? 'num' : null },
      el('button', {
        type: 'button',
        style: 'background:none;border:0;color:inherit;font:inherit;cursor:pointer;padding:0;text-transform:inherit;letter-spacing:inherit',
        onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' ? 1 : -1; } render(); },
      }, label, state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' ▼' : ' ▲' }) : null)
    );
  }

  function tokenBadge(r) {
    if (r.flag === 'bridged') return el('span', { class: 'badge warn', text: 'bridged' });
    return el('span', { class: 'badge', text: 'records no token' });
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'btn', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; state.earlyOnly = false; state.tvlMin = 0; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'aria-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } },
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', null,
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') + (r.chains && r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', title: r.multiple_source === 'category-median' ? 'Category median of live-token comps' : 'Global median (too few comps in this category)', text: fmtMult(r.base_multiple) }),
        el('td', null, el('div', null,
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, tokenBadge(r))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols, strongest implied value first. Select a row for its model breakdown and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('multiple', 'Multiple'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'badge grey', text: 'live' })),
        el('td', null, el('div', null,
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: r.mcap_tvl === null ? 'n/a' : 'x' + r.mcap_tvl.toFixed(3) }),
        el('td', null, el('span', { class: 'badge grey', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are the calibration comps — set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }), el('th', { scope: 'col', class: 'num', text: '7d' }),
            el('th', { scope: 'col', class: 'num', text: 'Market cap' }), el('th', { scope: 'col', class: 'num', text: 'Mcap / TVL' }),
            el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function flaggedTable() {
    var tbody = el('tbody');
    DATA.flagged.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', null,
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' · ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num', text: fmtUsd(r.implied_value_usd) }),
        el('td', null, el('span', { text: r.reason }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Flagged, not hidden: these rows are ranked for completeness, but a bridged product moves a token that already trades — it is not a token waiting to launch.' }),
          el('thead', null, el('tr', null,
            el('th', { scope: 'col', class: 'num', text: 'Rank' }), el('th', { scope: 'col', text: 'Protocol' }),
            el('th', { scope: 'col', class: 'num', text: 'TVL' }), el('th', { scope: 'col', class: 'num', text: 'Implied value' }),
            el('th', { scope: 'col', text: 'Why flagged' }))),
          tbody
        )
      )
    );
  }

  function methodPanel() {
    var m = DATA.model;
    var cal = DATA.calibration;
    var calRows = cal.by_category.map(function (c) {
      return el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: fmtMult(c.multiple) }),
        el('td', { class: 'num', text: String(c.comps) }),
        el('td', { text: c.source === 'category-median' ? 'category median' : 'global median (too few comps)' })
      );
    });
    return el('section', { class: 'panel method' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { text: 'One function scores every row, from the snapshot’s own figures. No protocol name is special-cased and no row is hand-picked.' }),
      el('p', null, el('code', {
        text: 'implied = round( tvl_usd x multiple x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') x min(1 + 0.02 x (chains - 1), ' + m.chain_cap + ') )',
      })),
      el('p', { text: 'The multiple is the calibration: for each category with at least ' + cal.min_comps + ' live-token protocols in the snapshot, it is the median market-cap / TVL of those live protocols; otherwise it is the global median of ' + fmtMult(cal.global_multiple) + ' from ' + cal.global_comps + ' live comps. Multiples are clamped to [' + cal.clamp_min + ', ' + cal.clamp_max + ']. Age is the time since the protocol was first listed; an unlisted age uses ' + m.unknown_age_days + ' days. The early radar is every rankable pre-token protocol below the watchlist floor, and the live-token protocols are set aside with their market caps shown.' }),
      el('table', { class: 'calib' },
        el('caption', { text: 'Calibrated multiples by category (median mcap / TVL of live-token comps in the snapshot).' }),
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Category' }),
          el('th', { scope: 'col', class: 'num', text: 'Multiple' }),
          el('th', { scope: 'col', class: 'num', text: 'Comps' }),
          el('th', { scope: 'col', text: 'Source' }))),
        el('tbody', null, calRows)
      ),
      el('p', { class: 'footnote', text: 'Implied value is this entry’s estimate, not a price and not a promise that a token will launch. “Records no token” means the DefiLlama record carries no token for the protocol — the record is not proof that none exists. Snapshot ' + DATA.as_of + '; farm plans are estimates of cost and time, not financial advice.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  var HONEST_NOTES = {
    'usdd': 'USDD already circulates as a stablecoin; the record shows no separate token. This farm uses the stablecoin itself — it is not a wait for a new token launch.',
    'lightning-network': 'Lightning is a payment network and rarely issues a token. Farm the network usage, not a token launch.',
    'bittensor-dtao': 'TAO itself already trades; dTAO is a subnet mechanism, so this is a subnet position, not a new-token wait.',
  };

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    var inner = el('div', { class: 'detail-inner' });
    inner.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'badge', text: 'Rank ' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' · ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close-x', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    if (row.flag === 'bridged') {
      inner.appendChild(el('div', { class: 'note', text: 'Flagged: a bridged product — the token it moves already trades on another chain, so it is not a token waiting to launch.' }));
    }
    if (HONEST_NOTES[row.slug]) {
      inner.appendChild(el('div', { class: 'note', text: HONEST_NOTES[row.slug] }));
    }
    var kv = el('div', { class: 'kv' });
    [
      ['TVL', fmtUsd(row.tvl_usd)],
      ['Seven-day growth', fmtPct(row.change_7d)],
      ['Age with no token on record', fmtAge(row.age_days)],
      ['Calibrated multiple', fmtMult(row.base_multiple) + (row.multiple_source === 'category-median' ? ' (category median)' : ' (global median)')],
      ['Growth multiplier', String(row.growth_multiplier)],
      ['Maturity multiplier', String(row.maturity_multiplier)],
      ['Chain multiplier', String(row.chain_multiplier) + ' (' + (row.chains || []).length + ' chains)'],
      ['Implied value', fmtUsd(row.implied_value_usd)],
    ].forEach(function (pair) {
      kv.appendChild(el('div', null, el('span', { text: pair[0] }), el('b', { text: pair[1] })));
    });
    inner.appendChild(el('section', null,
      el('h3', { text: 'Implied value' }),
      kv,
      el('p', { class: 'footnote', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board — the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    var steps = el('ol', { class: 'steps' });
    row.farm_steps.forEach(function (s) {
      var at = s.indexOf(' Cost: ');
      var action = at >= 0 ? s.slice(0, at) : s;
      var tail = at >= 0 ? s.slice(at + 1) : '';
      steps.appendChild(el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail })));
    });
    inner.appendChild(el('section', null, el('h3', { text: 'Farm plan' }), steps));
    dialog.appendChild(inner);
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'wrap' });
    shell.appendChild(masthead());
    shell.appendChild(stats());
    shell.appendChild(tabs());
    if (state.tab === 'board') {
      shell.appendChild(controls());
      shell.appendChild(boardTable());
      shell.appendChild(methodPanel());
    } else if (state.tab === 'live') {
      shell.appendChild(liveTable());
    } else {
      shell.appendChild(flaggedTable());
    }
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
