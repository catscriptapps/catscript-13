// /resources/js/utils/cash-flow/charts.js
//
// Small, dependency-free SVG charts for Cash Flow, following the dataviz
// method: one y-axis per chart, thin marks (bars <= 24px, 4px rounded data
// end, square at the baseline; 2px lines), hairline solid grid, recessive
// axes, text in ink tokens (never the series colour), selective direct
// labels, and a hover / keyboard-focus tooltip on every chart. Colours come
// from CSS custom properties (--cf-in / --cf-out / --cf-net / ink / grid),
// defined in app.css for light and dark.
//
// Labels are inserted with textContent only.

const SVG = 'http://www.w3.org/2000/svg';

const moneyFmt = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' });
export const money = (n) => moneyFmt.format(n);
export function compactMoney(n) {
  const a = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `${sign}$${Math.round(a)}`;
}

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG, name);
  // A `style` attribute is written first: setting it later would wipe the
  // colour roles below (that's what left some labels default-black).
  if (attrs.style) node.setAttribute('style', attrs.style);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'style') return;
    // CSS custom properties resolve reliably in style, not in SVG
    // presentation attributes — so colour roles go through style.
    if ((k === 'fill' || k === 'stroke') && String(v).startsWith('var(')) node.style.setProperty(k, v);
    else node.setAttribute(k, v);
  });
  if (parent) parent.appendChild(node);
  return node;
}

/** Nice round tick values covering [min, max] (min <= 0 <= max allowed). */
function niceTicks(min, max, count = 4) {
  if (min === max) { max = min + 1; }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) || 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

/** Rect path with only the data-end corners rounded (top if up, bottom if down). */
function barPath(x, y, w, h, r, up) {
  r = Math.min(r, w / 2, h);
  if (h <= 0) return '';
  if (up) {
    return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
  }
  return `M${x},${y} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w - r} Q${x + w},${y + h} ${x + w},${y + h - r} V${y} Z`;
}

// ------------------------------------------------------------
// Tooltip (one per chart container)
// ------------------------------------------------------------

function tooltip(container) {
  let tip = container.querySelector('.cf-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'cf-tip pointer-events-none absolute z-20 hidden min-w-[9rem] rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 backdrop-blur px-3 py-2 text-xs shadow-lg';
    container.appendChild(tip);
  }
  return {
    show(x, y, title, rows) {
      tip.replaceChildren();
      const h = document.createElement('p');
      h.className = 'font-semibold text-gray-500 dark:text-gray-400 mb-1';
      h.textContent = title;
      tip.appendChild(h);
      rows.forEach(({ color, label, value, dot }) => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 py-0.5';
        const key = document.createElement('span');
        key.className = dot ? 'h-2 w-2 rounded-full flex-shrink-0' : 'h-0.5 w-3 rounded flex-shrink-0';
        key.style.background = color;
        const v = document.createElement('span');
        v.className = 'font-semibold text-gray-900 dark:text-white';
        v.textContent = value;
        const l = document.createElement('span');
        l.className = 'text-gray-500 dark:text-gray-400';
        l.textContent = label;
        row.append(key, v, l);
        tip.appendChild(row);
      });
      tip.classList.remove('hidden');
      const cw = container.clientWidth;
      const tw = tip.offsetWidth;
      const left = Math.min(Math.max(x - tw / 2, 0), cw - tw);
      tip.style.left = `${left}px`;
      tip.style.top = `${Math.max(y - tip.offsetHeight - 10, 0)}px`;
    },
    hide() { tip.classList.add('hidden'); },
  };
}

function emptyState(container, text) {
  container.querySelector('svg')?.remove();
  let p = container.querySelector('.cf-empty');
  if (!p) {
    p = document.createElement('p');
    p.className = 'cf-empty absolute inset-0 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500';
    container.appendChild(p);
  }
  p.textContent = text;
  p.classList.remove('hidden');
}

function clearEmpty(container) {
  container.querySelector('.cf-empty')?.classList.add('hidden');
}

// ------------------------------------------------------------
// 1. Money in vs out — diverging columns around zero, net as a dot
// ------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Array<{label: string, title: string, in: number, out: number}>} buckets
 */
export function renderFlowChart(container, buckets) {
  const tip = tooltip(container);
  if (!buckets.length || buckets.every((b) => !b.in && !b.out)) {
    emptyState(container, 'No entries in this period');
    return;
  }
  clearEmpty(container);

  const W = container.clientWidth || 600;
  const H = container.clientHeight || 288;
  const m = { top: 12, right: 8, bottom: 26, left: 52 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;

  const maxIn = Math.max(0, ...buckets.map((b) => b.in));
  const maxOut = Math.max(0, ...buckets.map((b) => b.out));
  const ticks = niceTicks(-maxOut, maxIn, 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const y = (v) => m.top + ((hi - v) / (hi - lo || 1)) * ph;

  const band = pw / buckets.length;
  const barW = Math.max(2, Math.min(24, band * 0.62));

  container.querySelector('svg')?.remove();
  const svg = el('svg', { width: W, height: H, role: 'img', 'aria-label': 'Money in and money out by period' });
  container.prepend(svg);

  // grid + y ticks
  ticks.forEach((t) => {
    el('line', { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t), stroke: t === 0 ? 'var(--cf-axis)' : 'var(--cf-grid)', 'stroke-width': 1, 'shape-rendering': 'crispEdges' }, svg);
    const label = el('text', { x: m.left - 8, y: y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--cf-muted)', style: 'font-variant-numeric: tabular-nums' }, svg);
    label.textContent = compactMoney(t);
  });

  // x labels: thin out so they never collide
  const every = Math.max(1, Math.ceil(buckets.length / Math.max(1, Math.floor(pw / 46))));

  const zero = y(0);
  buckets.forEach((b, i) => {
    const cx = m.left + band * i + band / 2;
    const x = cx - barW / 2;

    if (b.in > 0) el('path', { d: barPath(x, y(b.in), barW, zero - y(b.in) - 1, 4, true), fill: 'var(--cf-in)' }, svg);
    if (b.out > 0) el('path', { d: barPath(x, zero + 1, barW, y(-b.out) - zero - 1, 4, false), fill: 'var(--cf-out)' }, svg);

    const net = b.in - b.out;
    if (b.in > 0 || b.out > 0) {
      el('circle', { cx, cy: y(net), r: 4, fill: 'var(--cf-net)', stroke: 'var(--cf-surface)', 'stroke-width': 2 }, svg);
    }

    if (i % every === 0) {
      const t = el('text', { x: cx, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--cf-muted)' }, svg);
      t.textContent = b.label;
    }

    // hit target: the whole band, keyboard-focusable
    const hit = el('rect', { x: m.left + band * i, y: m.top, width: band, height: ph, fill: 'transparent', tabindex: 0, 'aria-label': `${b.title}: in ${money(b.in)}, out ${money(b.out)}, net ${money(net)}` }, svg);
    const show = () => {
      hit.setAttribute('fill', 'rgba(127,127,127,0.07)');
      tip.show(cx, Math.min(y(b.in), zero) , b.title, [
        { color: 'var(--cf-in)', label: 'in', value: money(b.in) },
        { color: 'var(--cf-out)', label: 'out', value: money(b.out) },
        { color: 'var(--cf-net)', label: 'net', value: money(net), dot: true },
      ]);
    };
    const hide = () => { hit.setAttribute('fill', 'transparent'); tip.hide(); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', show);
    hit.addEventListener('blur', hide);
  });
}

// ------------------------------------------------------------
// 2. Running net — single line + wash, crosshair tooltip
// ------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Array<{title: string, value: number}>} points  in date order
 */
export function renderBalanceChart(container, points) {
  const tip = tooltip(container);
  if (points.length < 2) {
    emptyState(container, points.length ? 'Add another entry to see the trend' : 'No entries in this period');
    return;
  }
  clearEmpty(container);

  const W = container.clientWidth || 600;
  const H = container.clientHeight || 224;
  const m = { top: 14, right: 70, bottom: 12, left: 52 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;

  const vals = points.map((p) => p.value);
  const ticks = niceTicks(Math.min(0, ...vals), Math.max(0, ...vals), 4);
  const lo = ticks[0];
  const hi = ticks[ticks.length - 1];
  const x = (i) => m.left + (points.length === 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const y = (v) => m.top + ((hi - v) / (hi - lo || 1)) * ph;

  container.querySelector('svg')?.remove();
  const svg = el('svg', { width: W, height: H, role: 'img', 'aria-label': 'Running net across the period' });
  container.prepend(svg);

  ticks.forEach((t) => {
    el('line', { x1: m.left, x2: W - m.right, y1: y(t), y2: y(t), stroke: t === 0 ? 'var(--cf-axis)' : 'var(--cf-grid)', 'stroke-width': 1, 'shape-rendering': 'crispEdges' }, svg);
    const label = el('text', { x: m.left - 8, y: y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--cf-muted)', style: 'font-variant-numeric: tabular-nums' }, svg);
    label.textContent = compactMoney(t);
  });

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.value)}`).join(' ');
  el('path', { d: `${line} L${x(points.length - 1)},${y(0)} L${x(0)},${y(0)} Z`, fill: 'var(--cf-net)', 'fill-opacity': 0.1 }, svg);
  el('path', { d: line, fill: 'none', stroke: 'var(--cf-net)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

  // end dot + direct label (the one value worth labelling)
  const last = points[points.length - 1];
  el('circle', { cx: x(points.length - 1), cy: y(last.value), r: 4, fill: 'var(--cf-net)', stroke: 'var(--cf-surface)', 'stroke-width': 2 }, svg);
  const endLabel = el('text', { x: x(points.length - 1) + 10, y: y(last.value) + 4, 'font-size': 12, 'font-weight': 600, fill: 'var(--cf-ink)' }, svg);
  endLabel.textContent = compactMoney(last.value);

  // crosshair
  const cross = el('line', { y1: m.top, y2: H - m.bottom, stroke: 'var(--cf-axis)', 'stroke-width': 1, visibility: 'hidden' }, svg);
  const marker = el('circle', { r: 4, fill: 'var(--cf-net)', stroke: 'var(--cf-surface)', 'stroke-width': 2, visibility: 'hidden' }, svg);
  const hit = el('rect', { x: m.left, y: m.top, width: pw, height: ph, fill: 'transparent', tabindex: 0, 'aria-label': `Running net, ends at ${money(last.value)}` }, svg);

  const showAt = (i) => {
    const p = points[i];
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    marker.setAttribute('cx', x(i)); marker.setAttribute('cy', y(p.value)); marker.setAttribute('visibility', 'visible');
    tip.show(x(i), y(p.value), p.title, [{ color: 'var(--cf-net)', label: 'running net', value: money(p.value) }]);
  };
  const hide = () => { cross.setAttribute('visibility', 'hidden'); marker.setAttribute('visibility', 'hidden'); tip.hide(); };
  let focusIndex = points.length - 1;

  hit.addEventListener('pointermove', (e) => {
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - m.left) / pw) * (points.length - 1));
    showAt(Math.max(0, Math.min(points.length - 1, i)));
  });
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('focus', () => showAt(focusIndex));
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      focusIndex = Math.max(0, Math.min(points.length - 1, focusIndex + (e.key === 'ArrowRight' ? 1 : -1)));
      showAt(focusIndex);
    }
  });
}

// ------------------------------------------------------------
// 3. Where the money went — horizontal bars, value at the tip
// ------------------------------------------------------------

/**
 * @param {HTMLElement} container
 * @param {Array<{label: string, value: number, count: number}>} rows  sorted desc
 */
export function renderTopChart(container, rows) {
  const tip = tooltip(container);
  if (!rows.length) {
    container.style.height = '12rem';
    emptyState(container, 'No money out in this period');
    return;
  }
  clearEmpty(container);

  const rowH = 38;
  const W = container.clientWidth || 320;
  const H = rows.length * rowH + 4;
  container.style.height = `${H}px`;
  const labelW = Math.min(130, W * 0.4);
  const valueW = 64;
  const pw = Math.max(20, W - labelW - valueW - 12);
  const max = Math.max(...rows.map((r) => r.value));

  container.querySelector('svg')?.remove();
  const svg = el('svg', { width: W, height: H, role: 'img', 'aria-label': 'Biggest money-out entries' });
  container.prepend(svg);

  rows.forEach((r, i) => {
    const cy = i * rowH + rowH / 2;
    const w = Math.max(3, (r.value / max) * pw);

    const label = el('text', { x: 0, y: cy + 4, 'font-size': 12, fill: 'var(--cf-ink-2)' }, svg);
    label.textContent = r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label;

    // horizontal bar: square at the baseline (left), 4px rounded data end (right)
    const bx = labelW;
    const bh = 14;
    const by = cy - bh / 2;
    const rr = Math.min(4, w / 2);
    el('path', { d: `M${bx},${by} H${bx + w - rr} Q${bx + w},${by} ${bx + w},${by + rr} V${by + bh - rr} Q${bx + w},${by + bh} ${bx + w - rr},${by + bh} H${bx} Z`, fill: 'var(--cf-out)' }, svg);

    const v = el('text', { x: bx + w + 8, y: cy + 4, 'font-size': 12, 'font-weight': 600, fill: 'var(--cf-ink)', style: 'font-variant-numeric: tabular-nums' }, svg);
    v.textContent = compactMoney(r.value);

    const hit = el('rect', { x: 0, y: i * rowH, width: W, height: rowH, fill: 'transparent', tabindex: 0, 'aria-label': `${r.label}: ${money(r.value)} across ${r.count} entries` }, svg);
    const show = () => {
      hit.setAttribute('fill', 'rgba(127,127,127,0.07)');
      tip.show(bx + w / 2, by, r.label, [
        { color: 'var(--cf-out)', label: 'out', value: money(r.value) },
        { color: 'var(--cf-muted)', label: r.count === 1 ? 'entry' : 'entries', value: String(r.count), dot: true },
      ]);
    };
    const hide = () => { hit.setAttribute('fill', 'transparent'); tip.hide(); };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('focus', show);
    hit.addEventListener('blur', hide);
  });
}
