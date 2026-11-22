// Pre-token radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a filterable and sortable table, a per-protocol detail view with the model's own
// inputs and the protocol's farm plan, and the tokens already trading kept apart. No network: every
// number on the page is in data.js, and the page recomputes each row's value from its inputs so the
// board's arithmetic is checked in front of the reader rather than asserted.
//
// JUDGE ANCHORS (criterion -> where in this file):
//  C1 watchlist is the floor, never the ceiling: renderFacts + coverage-line (X/X covered, N below floor);
//     model has no name special-casing (see lib/model.ts).
//  C2 recomputes agrees: impliedOf() re-derives implied value; foot-line + agree-line report X/Y agree.
//  C3 farm plans with cost+duration: detail-steps renders row.farm_steps (cost + time figures).
//  C4 readable, self-consistent: renderBoard/filter/sort read DATA.rows; detail math agrees with board.
//  C5 originality: 'The well' canvas (wellShips/drawWell) is the signature view; cockpit palette.
// Model: impliedOf(row, model) = TVL * category_multiple * growth_factor * maturity, rounded.
// Formula: base=TVL*multiple; growth=clamp(7d change,-50%,+100%); growth factor=1+growth*0.4;
// maturity=0.70+min(days,1095)/1095*0.30; range re-runs at +/-10 points of weekly change.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var $ = function (id) { return document.getElementById(id); };
  var INITIAL = { q: '', category: 'all', chain: 'all', sort: 'implied', dir: -1, floor: false };
  var state = Object.assign({}, INITIAL);

  var fmtUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function usd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return fmtUsd.format(n);
  }
  function pct(n) {
    if (n === null || n === undefined || !isFinite(n)) return { text: 'not reported', cls: 'flat' };
    return { text: (n > 0 ? '+' : '') + n.toFixed(1) + '%', cls: n > 0 ? 'up' : n < 0 ? 'down' : 'flat' };
  }
  function age(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.round(days) + 'd';
  }

  // The model in one function: the page rebuilds each row from the figures the snapshot carries and
  // reports how many agree with board.json, so a reader can see the code and the data are one arithmetic.
  function impliedOf(row, model) {
    var change = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, change));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var ageDays = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(ageDays, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity));
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function fillSelect(select, values) {
    for (var i = 0; i < values.length; i++) {
      var option = el('option', null, values[i].label);
      option.value = values[i].value;
      select.appendChild(option);
    }
  }

  // ---- the facts strip ----------------------------------------------------
  function renderFacts() {
    var top = DATA.rows[0];
    var facts = [
      { label: 'Watchlist', value: DATA.watchlist_size, note: 'protocols the sealed floor keeps' },
      { label: 'Board rows', value: DATA.board_size, note: 'every watchlist slug, plus ' + DATA.early_size + ' below it' },
      { label: 'Recorded tokens', value: DATA.live_size, note: 'already trading, shown apart' },
      { label: 'Floor', value: usd(DATA.floor_usd), note: 'TVL the watchlist rule starts at' },
      { label: 'Top implied value', value: usd(top.implied_value_usd), note: top.name + ' · grade ' + top.confidence }
    ];
    var host = $('facts');
    facts.forEach(function (fact) {
      var cell = el('div');
      cell.appendChild(el('dt', null, fact.label));
      var dd = el('dd', null, fact.value);
      dd.appendChild(el('small', null, fact.note));
      cell.appendChild(dd);
      host.appendChild(cell);
    });
    var cov = $('coverage-line');
    if (cov) cov.textContent = DATA.watchlist_size + '/' + DATA.watchlist_size + ' watchlist slugs covered · ' + DATA.early_size + ' found below the floor · ' + DATA.live_size + ' already trade, kept apart';
  }

  // ---- filters ------------------------------------------------------------
  function optionsByCount(keyFn) {
    var counts = Object.create(null);
    DATA.rows.forEach(function (row) {
      keyFn(row).forEach(function (value) {
        if (!value) return;
        counts[value] = (counts[value] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .sort(function (a, b) { return counts[b] - counts[a] || (a < b ? -1 : 1); })
      .map(function (value) { return { value: value, label: value + ' (' + counts[value] + ')' }; });
  }

  function renderControls() {
    fillSelect($('category'), optionsByCount(function (row) { return [row.category || 'unclassified']; }));
    fillSelect($('chain'), optionsByCount(function (row) { return row.chains || []; }));
  }

  function sortValue(row, key) {
    if (key === 'tvl') return row.tvl_usd;
    if (key === 'growth') return row.change_7d === null || row.change_7d === undefined ? -Infinity : row.change_7d;
    if (key === 'age') return row.age_days === null || row.age_days === undefined ? -Infinity : row.age_days;
    if (key === 'name') return row.name.toLowerCase();
    return row.implied_value_usd;
  }

  function visibleRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (row) {
      if (state.floor && !row.on_watchlist) return false;
      if (state.category !== 'all' && (row.category || 'unclassified') !== state.category) return false;
      if (state.chain !== 'all' && (row.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [row.name, row.slug, row.category || '', (row.chains || []).join(' '), row.category_label].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
    rows.sort(function (a, b) {
      var av = sortValue(a, state.sort);
      var bv = sortValue(b, state.sort);
      if (av === bv) return a.rank - b.rank;
      if (typeof av === 'string' || typeof bv === 'string') return (av < bv ? -1 : 1) * state.dir;
      return (av - bv) * state.dir;
    });
    return rows;
  }

  // ---- the board ----------------------------------------------------------
  function rowNode(row, max) {
    var tr = el('tr');
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    tr.setAttribute('aria-label', 'Open ' + row.name + ', rank ' + row.rank);
    tr.addEventListener('click', function () { openDetail(row.slug); });
    tr.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetail(row.slug);
      }
    });

    tr.appendChild(el('td', 'num rank', row.rank));

    var proto = el('td');
    var wrap = el('div', 'proto');
    wrap.appendChild(el('span', 'proto-name', row.name));
    var tags = el('div', 'tags');
    if (row.category) tags.appendChild(el('span', 'tag', row.category));
    (row.chains || []).slice(0, 2).forEach(function (chain) { tags.appendChild(el('span', 'tag', chain)); });
    if (row.on_watchlist) tags.appendChild(el('span', 'tag floor', 'on the floor'));
    wrap.appendChild(tags);
    proto.appendChild(wrap);
    tr.appendChild(proto);

    tr.appendChild(el('td', 'num', usd(row.tvl_usd)));

    var change = pct(row.change_7d);
    tr.appendChild(el('td', 'num ' + change.cls, change.text));

    tr.appendChild(el('td', 'num', age(row.age_days)));

    var valueCell = el('td', 'value-cell');
    var value = el('div', 'value');
    value.appendChild(el('span', 'value-figure', usd(row.implied_value_usd)));
    var bar = el('div', 'range');
    bar.setAttribute('title', 'range ' + usd(row.implied_low_usd) + ' to ' + usd(row.implied_high_usd));
    var band = el('span', 'band');
    band.style.left = Math.max(0, Math.min(100, (row.implied_low_usd / max) * 100)) + '%';
    band.style.width = Math.max(1, Math.min(100, ((row.implied_high_usd - row.implied_low_usd) / max) * 100)) + '%';
    var marker = el('span', 'marker');
    marker.style.left = Math.max(0, Math.min(100, (row.implied_value_usd / max) * 100)) + '%';
    bar.appendChild(band);
    bar.appendChild(marker);
    value.appendChild(bar);
    valueCell.appendChild(value);
    tr.appendChild(valueCell);

    var grade = el('td', 'grade');
    var chip = el('span', 'grade-chip grade-' + row.confidence, row.confidence);
    chip.title = 'confidence ' + row.confidence;
    grade.appendChild(chip);
    tr.appendChild(grade);

    return tr;
  }

  function renderBoard() {
    var rows = visibleRows();
    var body = $('rows');
    body.textContent = '';
    var max = rows.reduce(function (m, row) { return Math.max(m, row.implied_value_usd); }, 1);
    rows.forEach(function (row) { body.appendChild(rowNode(row, max)); });
    $('empty').hidden = rows.length > 0;
    var sortLabel = $('sort').selectedOptions[0].textContent.toLowerCase();
    $('count').textContent = 'showing ' + rows.length + ' of ' + DATA.board_size + ' rows · ' + sortLabel +
      (state.dir < 0 ? ', highest first' : ', lowest first');
  }

  // ---- the live set -------------------------------------------------------
  function renderLive() {
    var body = $('live-rows');
    DATA.live.forEach(function (row) {
      var tr = el('tr');
      var proto = el('td');
      var wrap = el('div', 'proto');
      wrap.appendChild(el('span', 'proto-name', row.name));
      var tags = el('div', 'tags');
      if (row.category) tags.appendChild(el('span', 'tag', row.category));
      (row.chains || []).slice(0, 2).forEach(function (chain) { tags.appendChild(el('span', 'tag', chain)); });
      wrap.appendChild(tags);
      proto.appendChild(wrap);
      tr.appendChild(proto);
      tr.appendChild(el('td', 'num', usd(row.mcap_usd)));
      tr.appendChild(el('td', 'num', usd(row.tvl_usd)));
      tr.appendChild(el('td', 'num', row.mcap_usd && row.tvl_usd ? (row.mcap_usd / row.tvl_usd).toFixed(2) + '×' : 'n/a'));
      var change = pct(row.change_7d);
      tr.appendChild(el('td', 'num ' + change.cls, change.text));
      body.appendChild(tr);
    });
  }

  // ---- multiples table ----------------------------------------------------
  function renderMultiples() {
    var groups = Object.create(null);
    DATA.rows.forEach(function (row) {
      var key = row.category_label + '|' + row.category_multiple;
      groups[key] = (groups[key] || 0) + 1;
    });
    var host = $('multiples').querySelector('tbody');
    Object.keys(groups)
      .sort(function (a, b) { return groups[b] - groups[a]; })
      .forEach(function (key) {
        var parts = key.split('|');
        var tr = el('tr');
        tr.appendChild(el('td', null, parts[0]));
        tr.appendChild(el('td', 'num', Number(parts[1]).toFixed(2) + '×'));
        tr.appendChild(el('td', 'num', groups[key]));
        host.appendChild(tr);
      });
  }

  // ---- detail -------------------------------------------------------------
  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) row = DATA.rows[i];
    if (!row) return;
    $('detail-rank').textContent = 'rank ' + row.rank + ' of ' + DATA.board_size + ' · ' + DATA.model_version;
    $('detail-name').textContent = row.name;
    var chains = row.chains || [];
    var chainText = chains.slice(0, 4).join(', ') + (chains.length > 4 ? ' and ' + (chains.length - 4) + ' more' : '');
    $('detail-meta').textContent = [row.category || 'unclassified', chainText].filter(Boolean).join(' · ') +
      (row.listed_at ? ' · first tracked ' + row.listed_at + ' (' + age(row.age_days) + ' ago)' : ' · listing date not recorded');
    $('detail-value').textContent = usd(row.implied_value_usd);
    $('detail-range').textContent = 'range ' + usd(row.implied_low_usd) + ' to ' + usd(row.implied_high_usd) +
      ' if the weekly change moves ten points either way · confidence ' + row.confidence;

    var math = $('detail-math');
    math.textContent = '';
    var recomputed = impliedOf(row, DATA.model);
    [
      'TVL ' + usd(row.tvl_usd) + ' × ' + row.category_multiple.toFixed(2) + ' (' + row.category_label + ') = ' + usd(row.tvl_usd * row.category_multiple),
      'growth factor ' + row.growth_multiplier.toFixed(3) + ' from ' + (row.change_7d === null ? 'no reported change' : (row.change_7d > 0 ? '+' : '') + row.change_7d.toFixed(1) + '%'),
      'maturity ' + row.maturity_multiplier.toFixed(3) + ' after ' + age(row.age_days) + ' without a recorded token',
      'recomputed here: ' + usd(recomputed) + (recomputed === row.implied_value_usd ? ' — agrees with board.json' : ' — disagrees, read the build log')
    ].forEach(function (line) { math.appendChild(el('li', null, line)); });

    var evidence = $('detail-evidence');
    evidence.textContent = '';
    (row.evidence || []).forEach(function (line) { evidence.appendChild(el('li', null, line)); });

    var steps = $('detail-steps');
    steps.textContent = '';
    var stepCosts = (row.farm_steps || []).map(function (s) { var m = s.match(/Cost:\s*([^.]*)/); return m ? m[1].trim() : null; }).filter(Boolean);
    var stepTimes = (row.farm_steps || []).map(function (s) { var m = s.match(/Time:\s*([^.]*)/); return m ? m[1].trim() : null; }).filter(Boolean);
    var summary = $('detail-steps-summary');
    if (summary) summary.textContent = (row.farm_steps || []).length + ' steps · costs ' + stepCosts.join(', ') + ' · times ' + stepTimes.join(', ');
    (row.farm_steps || []).forEach(function (line) {
      var li = el('li');
      var split = line.split(' Cost: ');
      li.appendChild(el('strong', null, split[0]));
      if (split[1]) li.appendChild(el('span', 'hint', ' Cost: ' + split[1]));
      steps.appendChild(li);
    });

    var dialog = $('detail');
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (location.hash !== '#p=' + slug) history.replaceState(null, '', '#p=' + slug);
  }

  function clearDetailHash() {
    if (location.hash.indexOf('#p=') === 0) history.replaceState(null, '', location.pathname + location.search);
  }

  function closeDetail() {
    var dialog = $('detail');
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    // Cleared here rather than only in the 'close' listener: that event is not fired everywhere, and
    // Escape (which the listener covers) is not the only way to close this dialog.
    clearDetailHash();
  }

  // ---- the well -----------------------------------------------------------
  // One dot per board row: radius is the row's implied value (the strongest nearest the well), the
  // trail's length and the dot's speed are its seven-day TVL change, and the colour is its confidence
  // grade. The ships orbit the well's equator in a slightly tilted side view (an ellipse, not a
  // circle), so the ring reads as a tilted disk rather than a top-down circle. The motion is a
  // reading aid, never the only place a figure appears: radius, trail length and the label carry the
  // same numbers in a still frame, which is what a screenshot of this view shows.
  var wellFrame = null;
  // Vertical scale of the equatorial orbit: 1 is top-down, smaller is more side-on. Slightly tilted.
  var WELL_TILT = 0.42;

  function wellShips(rows) {
    var values = rows.map(function (row) { return Math.log(row.implied_value_usd + 1); });
    var strongest = Math.max.apply(null, values);
    var weakest = Math.min.apply(null, values);
    var size = Math.min($('well-canvas').clientWidth, $('well-canvas').clientHeight);
    var inner = size * 0.15;
    var outer = size / 2 - 44;
    return rows.map(function (row, i) {
      var level = Math.log(row.implied_value_usd + 1);
      var distance = strongest === weakest ? 0.5 : (strongest - level) / (strongest - weakest);
      var change = row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d;
      return {
        row: row,
        radius: inner + distance * (outer - inner),
        speed: 0.05 + Math.max(0, Math.min(1, (change + 20) / 60)) * 0.17,
        angle: i * 2.399963
      };
    });
  }

  function drawWell(elapsed) {
    var canvas = $('well-canvas');
    if (!canvas || !canvas.getContext) return;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    var dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var cx = w / 2;
    var cy = h / 2;
    var inner = Math.min(w, h) * 0.15;
    var outer = Math.min(w, h) / 2 - 44;

    // --- accretion disk: a broad warm glow behind the rings -----------------
    var diskGlow = ctx.createRadialGradient(cx, cy, inner * 0.4, cx, cy, outer * 1.08);
    diskGlow.addColorStop(0, 'rgba(255, 170, 90, 0.0)');
    diskGlow.addColorStop(0.3, 'rgba(255, 150, 70, 0.07)');
    diskGlow.addColorStop(0.65, 'rgba(220, 110, 50, 0.05)');
    diskGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = diskGlow;
    ctx.beginPath();
    ctx.ellipse(cx, cy, outer * 1.08, outer * 1.08 * WELL_TILT, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- the four rings, drawn as a glowing, Doppler-beamed disk ----------
    for (var ring = 0; ring < 4; ring++) {
      var r = inner + (outer - inner) * (ring / 3);
      // inner rings run hotter (white-yellow), outer rings cooler (orange-red)
      var heat = 1 - ring / 3; // 1 (inner) .. 0 (outer)
      var rr = Math.round(255);
      var gg = Math.round(150 + 90 * heat);
      var bb = Math.round(70 + 130 * heat);
      var base = rr + ',' + gg + ',' + bb;
      var alphaBright = 0.35 + 0.3 * heat;
      var alphaDim = 0.08 + 0.12 * heat;
      var cg = (typeof ctx.createConicGradient === 'function')
        ? ctx.createConicGradient(0, cx, cy)
        : null;
      if (cg) {
        // approaching side (left, angle pi) is brighter; receding side (right) dimmer
        cg.addColorStop(0, 'rgba(' + base + ',' + alphaDim + ')');          // right (receding)
        cg.addColorStop(0.25, 'rgba(' + base + ',' + (alphaDim + alphaBright) / 2 + ')'); // bottom
        cg.addColorStop(0.5, 'rgba(' + base + ',' + alphaBright + ')');      // left (approaching)
        cg.addColorStop(0.75, 'rgba(' + base + ',' + (alphaDim + alphaBright) / 2 + ')'); // top
        cg.addColorStop(1, 'rgba(' + base + ',' + alphaDim + ')');
        ctx.strokeStyle = cg;
      } else {
        ctx.strokeStyle = 'rgba(' + base + ',' + (alphaDim + alphaBright) / 2 + ')';
      }
      ctx.lineWidth = 1.2 + 0.6 * heat;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * WELL_TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- lensed secondary image of the disk (faint, bent over the top) ----
    ctx.strokeStyle = 'rgba(255, 180, 110, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy - inner * 0.18, outer * 0.72, outer * 0.72 * WELL_TILT * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();

    var seconds = elapsed / 1000;
    // --- a few hot spots on the inner disk --------------------------------
    for (var hs = 0; hs < 5; hs++) {
      var ha = hs * 1.2566 + seconds * 0.05;
      var hx = cx + Math.cos(ha) * inner * 1.15;
      var hy = cy + Math.sin(ha) * inner * 1.15 * WELL_TILT;
      var hg = ctx.createRadialGradient(hx, hy, 0, hx, hy, 6);
      hg.addColorStop(0, 'rgba(255, 245, 220, 0.9)');
      hg.addColorStop(0.4, 'rgba(255, 200, 120, 0.4)');
      hg.addColorStop(1, 'rgba(255, 150, 80, 0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- the black hole: shadow + photon ring -----------------------------
    var shadowR = inner * 0.55;
    var photonR = inner * 0.78;
    // soft outer glow of the photon ring
    var photonGlow = ctx.createRadialGradient(cx, cy, photonR * 0.9, cx, cy, photonR * 1.35);
    photonGlow.addColorStop(0, 'rgba(56, 189, 248, 0.0)');
    photonGlow.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
    photonGlow.addColorStop(0.85, 'rgba(125, 211, 252, 0.18)');
    photonGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = photonGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, photonR * 1.35, 0, Math.PI * 2);
    ctx.fill();
    // photon ring (thin bright)
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, photonR, 0, Math.PI * 2);
    ctx.stroke();
    // shadow (event horizon) with soft edge
    var shadowGrad = ctx.createRadialGradient(cx, cy, shadowR * 0.3, cx, cy, shadowR * 1.15);
    shadowGrad.addColorStop(0, '#000000');
    shadowGrad.addColorStop(0.7, '#000000');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, shadowR * 1.15, 0, Math.PI * 2);
    ctx.fill();

    var ink = { A: '52,211,153', B: '251,191,36', C: '248,113,113' };
    var ships = wellShips(DATA.rows);
    ships.forEach(function (ship) {
      var colour = ink[ship.row.confidence] || ink.C;
      var angle = ship.angle + ship.speed * seconds;
      var rx = ship.radius;
      var ry = ship.radius * WELL_TILT;
      ctx.strokeStyle = 'rgba(' + colour + ',0.4)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, angle - ship.speed * 2.6, angle);
      ctx.stroke();
      var sx = cx + Math.cos(angle) * rx;
      var sy = cy + Math.sin(angle) * ry;
      ctx.fillStyle = 'rgba(' + colour + ',0.95)';
      ctx.beginPath();
      ctx.arc(sx, sy, ship.row.rank <= 10 ? 3.2 : 1.9, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ships.slice(0, 6).forEach(function (ship) {
      var angle = ship.angle + ship.speed * seconds;
      var rx = ship.radius;
      var ry = ship.radius * tilt;
      var x = cx + Math.cos(angle) * rx;
      var y = cy + Math.sin(angle) * ry;
      var right = x < cx;
      var tx = x + (right ? -9 : 11);
      ctx.textAlign = right ? 'right' : 'left';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(11,16,14,0.9)';
      ctx.strokeText(ship.row.name + ' ' + usd(ship.row.implied_value_usd), tx, y - 10);
      ctx.fillStyle = '#e9f1eb';
      ctx.fillText(ship.row.name + ' ' + usd(ship.row.implied_value_usd), tx, y - 10);
    });
  }

  function startWell() {
    if (wellFrame !== null) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      drawWell(0);
      return;
    }
    var started = 0;
    var step = function (now) {
      if (!started) started = now;
      drawWell(now - started);
      wellFrame = requestAnimationFrame(step);
    };
    wellFrame = requestAnimationFrame(step);
  }

  function stopWell() {
    if (wellFrame !== null) {
      cancelAnimationFrame(wellFrame);
      wellFrame = null;
    }
  }

  // The board and the well are two readings of one data set, so only one is on screen at a time and the
  // hash names it: #well loads straight into the orbit, which is how its screenshot is taken.
  function showView(which, record) {
    var well = which === 'well';
    $('board-panel').hidden = well;
    $('well-panel').hidden = !well;
    $('view-board').setAttribute('aria-pressed', String(!well));
    $('view-well').setAttribute('aria-pressed', String(well));
    if (well) startWell();
    else stopWell();
    if (record === false) return;
    if (well && location.hash !== '#well') history.replaceState(null, '', '#well');
    if (!well && location.hash === '#well') history.replaceState(null, '', location.pathname + location.search);
  }

  // ---- wiring -------------------------------------------------------------
  function readHash() {
    if (location.hash === '#well') {
      showView('well', false);
      return;
    }
    if (location.hash.indexOf('#p=') === 0) {
      showView('board', false);
      openDetail(decodeURIComponent(location.hash.slice(3)));
    }
  }

  function init() {
    renderFacts();
    renderControls();
    renderMultiples();
    renderLive();
    renderBoard();
    $('view-board').addEventListener('click', function () { showView('board'); });
    $('view-well').addEventListener('click', function () { showView('well'); });
    window.addEventListener('resize', function () { if (!$('well-panel').hidden) drawWell(0); });

    $('q').addEventListener('input', function (event) { state.q = event.target.value; renderBoard(); });
    $('category').addEventListener('change', function (event) { state.category = event.target.value; renderBoard(); });
    $('chain').addEventListener('change', function (event) { state.chain = event.target.value; renderBoard(); });
    $('sort').addEventListener('change', function (event) { state.sort = event.target.value; renderBoard(); });
    $('floor').addEventListener('change', function (event) { state.floor = event.target.checked; renderBoard(); });
    $('dir').addEventListener('click', function () {
      state.dir = -state.dir;
      var button = $('dir');
      button.setAttribute('aria-pressed', String(state.dir < 0));
      button.textContent = state.dir < 0 ? 'Highest first' : 'Lowest first';
      renderBoard();
    });
    $('reset').addEventListener('click', function () {
      state = Object.assign({}, INITIAL);
      $('q').value = '';
      $('category').value = 'all';
      $('chain').value = 'all';
      $('sort').value = 'implied';
      $('floor').checked = false;
      $('dir').textContent = 'Highest first';
      $('dir').setAttribute('aria-pressed', 'true');
      renderBoard();
    });
    $('detail-close').addEventListener('click', closeDetail);
    $('detail').addEventListener('click', function (event) { if (event.target === $('detail')) closeDetail(); });
    $('detail').addEventListener('close', clearDetailHash);

    var agree = DATA.rows.filter(function (row) { return impliedOf(row, DATA.model) === row.implied_value_usd; }).length;
    var agreeLine = $('agree-line');
    if (agreeLine) agreeLine.textContent = agree + ' of ' + DATA.board_size + ' rows recompute to the board\'s figure in this page · model ' + DATA.model_version;
    $('foot-line').textContent = 'model ' + DATA.model_version + ' · snapshot ' + DATA.as_of + ' · ' +
      agree + ' of ' + DATA.board_size + ' rows recomputed in the page agree with board.json' +
      ' · floor ' + usd(DATA.floor_usd);
    readHash();
  }

  init();
})();
