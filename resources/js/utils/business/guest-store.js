// /resources/js/utils/business/guest-store.js
//
// Guest (try-it) mode for the Business apps — Customers, Invoices and Receipts
// share one demo book, kept only in this browser's localStorage. The lookups
// (countries, regions, invoice statuses, terms, payment methods) come from the
// page; everything else is sample data the guest can change freely.
// handleCustomers() / handleInvoices() / handleReceipts() answer like
// server/api/customers.php, invoices.php and receipts.php (the controllers'
// rules and response shapes), so the pages treat both modes alike. Keep them
// in step. Receipts live on their invoice (invoice.payments).

const KEY = 'catscript.business.guest.v1';
const CLOSED = [4, 6];        // Paid In Full, Cancelled
const MAX_ITEMS = 100;
let memory = null;
let book = null;
/** invoice_statuses (the Customers page doesn't send them, so they're known here too) */
const STATUSES = [
  { id: 1, name: 'Draft', color: 'gray' }, { id: 2, name: 'Sent', color: 'blue' }, { id: 3, name: 'Partially Paid', color: 'orange' },
  { id: 4, name: 'Paid In Full', color: 'green' }, { id: 5, name: 'Overdue', color: 'red' }, { id: 6, name: 'Cancelled', color: 'slate' },
];
const METHODS = ['E-Transfer', 'Bank Transfer', 'Cash', 'Cheque', 'Credit Card', 'Wire', 'Other'];
let lookups = { countries: [], regions: [], statuses: STATUSES, payment_terms: [], delivery_terms: [], currencies: ['CAD', 'USD'], methods: METHODS };

const ok = (messages, extra = {}) => ({ success: true, messages: [].concat(messages), ...extra });
const fail = (messages) => ({ success: false, messages: [].concat(messages) });
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const round2 = (n) => Math.round(n * 100) / 100;
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ------------------------------------------------------------
// Rich text (same allow-list as Src\Utils\RichText::clean)
// ------------------------------------------------------------

const ALLOWED = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI']);

export function cleanRichText(html) {
  const doc = new DOMParser().parseFromString(`<div>${String(html ?? '')}</div>`, 'text/html');
  const walk = (node) => [...node.childNodes].map((n) => {
    if (n.nodeType === Node.TEXT_NODE) return n.textContent.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    if (n.nodeType !== Node.ELEMENT_NODE) return '';
    const inner = walk(n);
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'TEMPLATE'].includes(n.tagName)) return '';
    if (!ALLOWED.has(n.tagName)) return inner;
    const tag = n.tagName.toLowerCase();
    return tag === 'br' ? '<br>' : `<${tag}>${inner}</${tag}>`;
  }).join('');
  return walk(doc.body.firstChild).trim();
}
const plainText = (html) => new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.textContent.replace(/ /g, ' ').trim();

// ------------------------------------------------------------
// Sample book
// ------------------------------------------------------------

function sample() {
  const on = 7, bc = 2, qc = 9, ny = 45;
  const customers = [
    ['Maple Leaf Renovations', 'office@mapleleafreno.example', '(705) 555-0142', 'mapleleafreno.example', '48 Dunlop St E', 'Barrie', 1, on, 'L4M 1A3', 820],
    ['Harbourview Dental', 'frontdesk@harbourview.example', '(604) 555-0188', 'harbourviewdental.example', '1200 W Georgia St', 'Vancouver', 1, bc, 'V6E 4R2', 640],
    ['Northern Lights Bakery', 'hello@northernlights.example', '(705) 555-0117', '', '9 Main St', 'Huntsville', 1, on, 'P1H 2C4', 410],
    ['Sterling & Co. Law', 'admin@sterlinglaw.example', '(416) 555-0199', 'sterlinglaw.example', '100 King St W', 'Toronto', 1, on, 'M5X 1A9', 300],
    ['Petit Café Montréal', 'bonjour@petitcafe.example', '(514) 555-0133', 'petitcafe.example', '350 Rue Saint-Paul', 'Montréal', 1, qc, 'H2Y 1H2', 190],
    ['Hudson Valley Outfitters', 'orders@hvoutfitters.example', '(845) 555-0160', 'hvoutfitters.example', '22 River Rd', 'Kingston', 2, ny, '12401', 120],
    ['Old Mill Photography', 'studio@oldmill.example', '(705) 555-0105', '', '3 Mill Lane', 'Orillia', 1, on, 'L3V 3A1', 900],
  ].map(([name, email, phone, website, address, city, country_id, region_id, postal, age], i) => ({
    id: `gc${i + 1}`, name, email, phone, website, address, city, country_id, region_id, postal, logo: null, active: i !== 6, since: daysAgo(age),
  }));

  const line = (d, q, r) => ({ description: d, quantity: q, unit_price: r });
  const inv = (n, c, title, age, dueIn, status, cur, items, payments = [], pt = 3, dt = 2) => ({
    id: `gi${n}`, number: `DEMO-INV-${pad(n).padStart(4, '0')}`, title, customer_id: c, created: daysAgo(age),
    due: dueIn === null ? null : daysAgo(age - dueIn), status_id: status, currency: cur, payment_term_id: pt, delivery_term_id: dt,
    items, payments,
  });
  let rseq = 0;
  const pay = (amount, age, method = 'E-Transfer', note = '', active = true) => {
    rseq += 1;
    return { id: `gr${rseq}`, number: receiptNumber(rseq), amount, date: daysAgo(age), method, note, active, created: daysAgo(age) };
  };

  const invoices = [
    inv(1, 'gc1', 'Website redesign', 330, 30, 4, 'CAD', [line('<b>Discovery &amp; design</b><ul><li>Two workshops</li><li>Home page mock-ups</li></ul>', 12, 85), line('Build &amp; launch', 30, 85)], [pay(3570, 300)]),
    inv(2, 'gc2', 'Booking system', 280, 30, 4, 'CAD', [line('Online booking integration', 40, 90), line('Staff training session', 3, 75), line('Returning-client discount', -1, 250)], [pay(3575, 250, 'Cheque')]),
    inv(3, 'gc3', 'Menu board & ordering page', 210, 15, 4, 'CAD', [line('Ordering page', 16, 80), line('Printed menu design', 4, 60)], [pay(1520, 195)]),
    inv(4, 'gc4', 'Client portal — phase 1', 150, 30, 3, 'CAD', [line('<b>Secure document portal</b><br>Login, uploads and audit log', 60, 95)], [pay(2850, 120, 'Wire')]),
    inv(5, 'gc6', 'Online store setup', 120, 30, 4, 'USD', [line('Store theme & product import', 24, 70), line('Payment gateway setup', 5, 70)], [pay(2030, 95, 'Credit Card')]),
    inv(6, 'gc5', 'Bilingual website', 75, 30, 2, 'CAD', [line('French / English site', 28, 80), line('Photography edits', 6, 50)], [pay(1000, 40, 'Cheque', 'Cheque #2201 — returned NSF', false)]),
    inv(7, 'gc1', 'Monthly maintenance — summer', 50, 15, 2, 'CAD', [line('Maintenance &amp; updates', 3, 250)]),
    inv(8, 'gc2', 'Patient reminder emails', 40, 30, 5, 'CAD', [line('Automated reminders', 14, 90)]),
    inv(9, 'gc4', 'Client portal — phase 2', 12, 30, 1, 'CAD', [line('E-signatures', 20, 95), line('Reporting dashboard', 16, 95)]),
    inv(10, 'gc3', 'Holiday promo page', 6, null, 2, 'CAD', [line('Landing page &amp; coupon codes', 8, 80)]),
    inv(11, 'gc6', 'Cancelled: photo shoot', 90, 30, 6, 'USD', [line('Product photo shoot', 1, 600)]),
  ];
  return { customers, invoices, seq: invoices.length, rseq };
}

const receiptNumber = (n) => `DEMO-RCT-${String(n).padStart(4, '0')}`;

function read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memory; } }
function write() { memory = book; try { localStorage.setItem(KEY, JSON.stringify(book)); } catch { /* memory only */ } }
function ensure() {
  if (book) return book;
  const s = read();
  book = s && Array.isArray(s.customers) && Array.isArray(s.invoices) ? s : sample();
  // Books saved before Receipts: give every payment an id, a number and a state
  let changed = !s;
  if (typeof book.rseq !== 'number') { book.rseq = 0; changed = true; }
  book.invoices.forEach((i) => {
    i.payments = i.payments || [];
    i.payments.forEach((p) => {
      if (p.id && typeof p.active === 'boolean' && /^DEMO-RCT-\d{4}$/.test(p.number || '')) return;
      book.rseq += 1;
      Object.assign(p, { id: p.id || uid('gr'), number: receiptNumber(book.rseq), active: p.active !== false, created: p.created || p.date, method: METHODS.find((m) => m.toLowerCase() === String(p.method || '').toLowerCase()) || p.method || 'E-Transfer', note: p.note || '' });
      changed = true;
    });
  });
  if (changed) write();
  return book;
}

// ------------------------------------------------------------
// Presenting (same shapes as the controllers)
// ------------------------------------------------------------

const totalOf = (i) => round2(i.items.reduce((s, l) => s + l.quantity * l.unit_price, 0));
const paidOf = (i, exceptId = '') => round2((i.payments || []).filter((p) => p.active !== false && p.id !== exceptId).reduce((s, p) => s + p.amount, 0));
const status = (id) => lookups.statuses.find((s) => s.id === id) || { id, name: 'Unknown', color: 'gray' };

function summary(i) {
  const c = book.customers.find((x) => x.id === i.customer_id);
  const total = totalOf(i);
  const paid = paidOf(i);
  const open = !CLOSED.includes(i.status_id);
  return {
    id: i.id, number: i.number, title: i.title,
    customer_id: c ? c.id : null, customer: c ? c.name : 'Unknown customer',
    due: i.due, created: i.created, total, paid,
    balance: open ? round2(Math.max(0, total - paid)) : 0,
    currency: i.currency, status: status(i.status_id), open,
    overdue: open && i.status_id !== 1 && !!i.due && i.due < today(),
  };
}

function detail(id) {
  const i = book.invoices.find((x) => x.id === id);
  if (!i) return null;
  const c = book.customers.find((x) => x.id === i.customer_id);
  return {
    ...summary(i),
    payment_term_id: i.payment_term_id || null,
    delivery_term_id: i.delivery_term_id || null,
    items: i.items.map((l) => ({ ...l, description: cleanRichText(l.description), amount: round2(l.quantity * l.unit_price) })),
    receipts: (i.payments || []).filter((p) => p.active !== false).sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ id: p.id, number: p.number, amount: p.amount, date: p.date, method: p.method, note: p.note })),
    customer_email: c?.email || '',
  };
}

function billing(cid) {
  const out = { invoices: 0, billed: 0, open: 0, outstanding: 0, last: null };
  book.invoices.filter((i) => i.customer_id === cid).forEach((i) => {
    const total = totalOf(i);
    out.invoices++;
    if (i.status_id !== 6) out.billed += total;
    if (!CLOSED.includes(i.status_id)) { out.open++; out.outstanding += Math.max(0, total - paidOf(i)); }
    if (!out.last || i.created > out.last) out.last = i.created;
  });
  out.billed = round2(out.billed);
  out.outstanding = round2(out.outstanding);
  return out;
}

function presentCustomer(c) {
  const region = lookups.regions.find((r) => r.id === c.region_id);
  const country = lookups.countries.find((x) => x.id === c.country_id);
  return {
    ...c,
    region: region?.name || '', region_code: region?.code || '', country: country?.name || '',
    billing: billing(c.id),
  };
}

function customersState() {
  ensure();
  return {
    customers: [...book.customers].sort((a, b) => a.name.localeCompare(b.name)).map(presentCustomer),
    countries: lookups.countries,
    regions: lookups.regions,
    year: new Date().getFullYear(),
  };
}

function invoicesState() {
  ensure();
  return {
    invoices: [...book.invoices].sort((a, b) => b.created.localeCompare(a.created) || b.number.localeCompare(a.number)).map(summary),
    customers: [...book.customers].sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => ({ id: c.id, name: c.name, city: c.city, email: c.email, active: c.active, logo: c.logo })),
    statuses: lookups.statuses,
    payment_terms: lookups.payment_terms,
    delivery_terms: lookups.delivery_terms,
    currencies: lookups.currencies,
    next_number: `DEMO-INV-${String(book.seq + 1).padStart(4, '0')}`,
    today: today(),
    can_email: false,
  };
}

function presentReceipt(p, i) {
  const c = book.customers.find((x) => x.id === i.customer_id);
  const total = totalOf(i);
  const paid = paidOf(i);
  return {
    id: p.id, number: p.number, amount: p.amount, date: p.date, method: p.method, note: p.note || '',
    active: p.active !== false, created: p.created || p.date, currency: i.currency,
    invoice_id: i.id, invoice_number: i.number, invoice_title: i.title,
    invoice_total: total, invoice_paid: paid, invoice_balance: i.status_id === 6 ? 0 : round2(Math.max(0, total - paid)),
    invoice_status: status(i.status_id),
    customer_id: c ? c.id : null, customer: c ? c.name : 'Unknown customer',
  };
}

const allReceipts = () => book.invoices.flatMap((i) => (i.payments || []).map((p) => ({ p, i })));

function receiptsState() {
  ensure();
  return {
    receipts: allReceipts().map(({ p, i }) => presentReceipt(p, i))
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.number.localeCompare(a.number)),
    invoices: [...book.invoices].sort((a, b) => b.created.localeCompare(a.created) || b.number.localeCompare(a.number)).map((i) => {
      const s = summary(i);
      return { id: s.id, number: s.number, title: s.title, customer_id: s.customer_id, customer: s.customer, total: s.total, paid: s.paid, currency: s.currency, due: s.due, status: s.status };
    }),
    customers: [...book.customers].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ id: c.id, name: c.name, logo: c.logo })),
    methods: lookups.methods,
    next_number: receiptNumber(book.rseq + 1),
    today: today(),
    can_email: false,
  };
}

function receiptDetail(id) {
  ensure();
  const hit = allReceipts().find(({ p }) => p.id === id);
  if (!hit) return null;
  const c = book.customers.find((x) => x.id === hit.i.customer_id);
  const region = lookups.regions.find((r) => r.id === c?.region_id);
  return {
    ...presentReceipt(hit.p, hit.i),
    customer_email: c?.email || '',
    customer_place: [c?.city, region?.code].filter(Boolean).join(', '),
    invoice_due: hit.i.due,
  };
}

// ------------------------------------------------------------
// Customers (mirror CustomersController)
// ------------------------------------------------------------

function saveCustomer(b) {
  ensure();
  const isNew = !b.id;
  const f = {
    name: String(b.name ?? '').trim(),
    email: String(b.email ?? '').trim().toLowerCase(),
    phone: String(b.phone ?? '').trim(),
    website: String(b.website ?? '').trim(),
    address: String(b.address ?? '').trim(),
    city: String(b.city ?? '').trim(),
    postal: String(b.postal ?? '').trim().toUpperCase(),
    country_id: Number(b.country_id) || null,
    region_id: Number(b.region_id) || null,
  };
  const others = book.customers.filter((c) => c.id !== b.id);
  const errors = [];
  if (!f.name) errors.push('Enter the customer or company name.');
  else if (f.name.length > 255) errors.push('The name must be 255 characters or fewer.');
  else if (others.some((c) => c.name.toLowerCase() === f.name.toLowerCase())) errors.push(`There's already a customer called “${f.name}”.`);
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) errors.push('That email address doesn’t look right.');
  else if (f.email && others.some((c) => c.email === f.email)) errors.push('Another customer already uses that email address.');
  if (f.phone.length > 50) errors.push('The phone number is too long.');
  if (f.website) { try { new URL(/^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`); } catch { errors.push('That website address doesn’t look right.'); } }
  if (f.address.length > 255) errors.push('The address is too long.');
  if (f.city.length > 255) errors.push('The city is too long.');
  if (f.postal.length > 16) errors.push('The postal / ZIP code is too long.');
  if (f.country_id && !lookups.countries.some((c) => c.id === f.country_id)) errors.push('Choose a country from the list.');
  if (f.region_id && !lookups.regions.some((r) => r.id === f.region_id && r.country_id === f.country_id)) errors.push('Choose a province / state in that country.');
  if (errors.length) return fail(errors);

  let c;
  if (isNew) {
    c = { id: uid('gc'), ...f, logo: null, active: true, since: today() };
    book.customers.push(c);
  } else {
    c = book.customers.find((x) => x.id === b.id);
    if (!c) return fail('Customer not found.');
    Object.assign(c, f);
  }
  write();
  return ok(isNew ? 'Customer added.' : 'Customer saved.', { ...customersState(), saved: c.id });
}

function customerById(id) { ensure(); return book.customers.find((c) => c.id === id); }

export const guestBusiness = {
  /** Lookups from the page (countries, regions, statuses, terms, currencies). */
  setup(l) { lookups = { ...lookups, ...Object.fromEntries(Object.entries(l || {}).filter(([, v]) => v !== undefined)) }; },
  customersState,
  invoicesState,
  receiptsState,
  receiptDetail,
  customerInvoices(id) {
    ensure();
    return book.invoices.filter((i) => i.customer_id === id).sort((a, b) => b.created.localeCompare(a.created)).map((i) => {
      const s = summary(i);
      return { id: s.id, number: s.number, title: s.title, due: s.due, created: s.created, total: s.total, paid: s.paid, currency: s.currency, status: s.status.name, color: s.status.color };
    });
  },
  detail(id) { ensure(); return detail(id); },
  resetToSample() { book = sample(); write(); },
  clear() { book = { customers: [], invoices: [], seq: 0, rseq: 0 }; write(); },

  /** A small logo (data URL) for a customer. */
  setLogo(id, dataUrl) {
    const c = customerById(id);
    if (!c) return fail('Customer not found.');
    c.logo = dataUrl;
    write();
    return ok('Logo updated.', { logo: dataUrl });
  },

  /** The directory as CSV, like CustomersController::csv(). */
  csv() {
    const rows = [['Customer', 'Email', 'Phone', 'Website', 'Address', 'City', 'Province / State', 'Country', 'Postal code', 'Status', 'Invoices', 'Billed', 'Outstanding', 'Customer since']];
    customersState().customers.forEach((c) => rows.push([c.name, c.email, c.phone, c.website, c.address, c.city, c.region, c.country, c.postal,
      c.active ? 'Active' : 'Archived', c.billing.invoices, c.billing.billed.toFixed(2), c.billing.outstanding.toFixed(2), c.since || '']));
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}`;
  },

  handleCustomers(b) {
    ensure();
    const c = b.id ? book.customers.find((x) => x.id === b.id) : null;
    switch (b.action) {
      case 'save': return saveCustomer(b);
      case 'archive':
      case 'restore':
        if (!c) return fail('Customer not found.');
        c.active = b.action === 'restore';
        write();
        return ok(c.active ? 'Customer restored.' : 'Customer archived.', customersState());
      case 'delete':
        if (!c) return fail('Customer not found.');
        if (book.invoices.some((i) => i.customer_id === c.id)) return fail(`${c.name} has invoices, so they can't be deleted — archive them instead.`);
        book.customers = book.customers.filter((x) => x !== c);
        write();
        return ok(`“${c.name}” deleted.`, customersState());
      case 'remove-logo':
        if (!c) return fail('Customer not found.');
        c.logo = null;
        write();
        return ok('Logo removed.', customersState());
      default: return fail('Unknown action.');
    }
  },

  handleInvoices(b) {
    ensure();
    const inv = b.id ? book.invoices.find((x) => x.id === b.id) : null;
    switch (b.action) {
      case 'save': return saveInvoice(b);
      case 'status': {
        const s = lookups.statuses.find((x) => x.id === Number(b.status_id));
        if (!inv || !s) return fail('Invoice or status not found.');
        inv.status_id = s.id;
        write();
        return ok(`Marked as ${s.name}.`, invoicesState());
      }
      case 'duplicate': {
        if (!inv) return fail('Invoice not found.');
        return saveInvoice({ ...inv, id: '', due: '', currency: inv.currency, status_id: 1, items: inv.items.map((l) => ({ ...l, quantity: String(l.quantity), unit_price: String(l.unit_price) })) });
      }
      case 'delete':
        if (!inv) return fail('Invoice not found.');
        if ((inv.payments || []).length) return fail(`${inv.number} has payments recorded, so it can't be deleted — mark it Cancelled instead.`);
        book.invoices = book.invoices.filter((x) => x !== inv);
        write();
        return ok(`${inv.number} deleted.`, invoicesState());
      case 'email': return fail('Emailing invoices is available once you sign in — in this demo, use Print / Save as PDF.');
      default: return fail('Unknown action.');
    }
  },

  handleReceipts(b) {
    ensure();
    const hit = b.id ? allReceipts().find(({ p }) => p.id === b.id) : null;
    switch (b.action) {
      case 'save': return saveReceipt(b);
      case 'void':
      case 'restore': {
        if (!hit) return fail('Receipt not found.');
        const active = b.action === 'restore';
        if (active) {
          if (hit.i.status_id === 6) return fail(`${hit.i.number} is cancelled, so the receipt can’t be restored.`);
          const error = overpaid(hit.i, hit.p.amount, hit.p.id);
          if (error) return fail(`${error} Restoring it would overpay the invoice.`);
        }
        hit.p.active = active;
        syncInvoice(hit.i);
        write();
        return ok(active ? `${hit.p.number} restored.` : `${hit.p.number} voided — it no longer counts as paid.`, receiptsState());
      }
      case 'delete':
        if (!hit) return fail('Receipt not found.');
        hit.i.payments = hit.i.payments.filter((p) => p !== hit.p);
        syncInvoice(hit.i);
        write();
        return ok(`${hit.p.number} deleted.`, receiptsState());
      case 'email': return fail('Emailing receipts is available once you sign in — in this demo, use Print / Save as PDF.');
      default: return fail('Unknown action.');
    }
  },
};

// ------------------------------------------------------------
// Receipts (mirror ReceiptsController)
// ------------------------------------------------------------

function overpaid(i, amount, exceptId = '') {
  const owing = round2(totalOf(i) - paidOf(i, exceptId));
  const money = (n) => n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (owing <= 0) return `${i.number} is already paid in full.`;
  if (amount - owing > 0.004) return `That’s more than the ${i.currency} ${money(owing)} still owing on ${i.number}.`;
  return null;
}

/** Same rules as ReceiptsController::syncInvoice. */
function syncInvoice(i) {
  if (!i || i.status_id === 6) return;
  const paid = paidOf(i);
  if (paid > 0 && paid >= totalOf(i)) i.status_id = 4;
  else if (paid > 0) i.status_id = 3;
  else if ([3, 4].includes(i.status_id)) i.status_id = 2;
}

function saveReceipt(b) {
  const isNew = !b.id;
  const hit = isNew ? null : allReceipts().find(({ p }) => p.id === b.id);
  if (!isNew && !hit) return fail('Receipt not found.');
  const inv = book.invoices.find((i) => i.id === b.invoice_id);
  const amountRaw = String(b.amount ?? '').replace(/[,\s$]/g, '');
  const date = String(b.date ?? '').trim();
  const method = String(b.method ?? '').trim();
  const note = String(b.note ?? '').trim();
  const sameInvoice = hit && inv && hit.i === inv;

  const errors = [];
  if (!inv) errors.push('Choose the invoice this payment is for.');
  else if (inv.status_id === 6 && !sameInvoice) errors.push(`${inv.number} is cancelled, so payments can't be recorded against it.`);
  const amountOk = /^\d+(\.\d{1,2})?$/.test(amountRaw) && Number(amountRaw) > 0;
  if (!amountOk) errors.push('Enter the amount received, like 250 or 250.50.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00`))) errors.push('Choose the date the payment was received.');
  if (!lookups.methods.includes(method) && !(hit && method && method === hit.p.method)) errors.push('Choose how it was paid.');
  if (note.length > 255) errors.push('The reference note must be 255 characters or fewer.');
  if (inv && amountOk && (isNew || hit.p.active !== false)) {
    const error = overpaid(inv, round2(Number(amountRaw)), hit?.p.id);
    if (error) errors.push(error);
  }
  if (errors.length) return fail(errors);

  const fields = { amount: round2(Number(amountRaw)), date, method, note };
  let p;
  if (isNew) {
    book.rseq += 1;
    p = { id: uid('gr'), number: receiptNumber(book.rseq), active: true, created: today(), ...fields };
    inv.payments = inv.payments || [];
    inv.payments.push(p);
  } else {
    p = Object.assign(hit.p, fields);
    if (hit.i !== inv) {
      hit.i.payments = hit.i.payments.filter((x) => x !== p);
      inv.payments = inv.payments || [];
      inv.payments.push(p);
      syncInvoice(hit.i);
    }
  }
  syncInvoice(inv);
  write();
  return ok(isNew ? `Payment recorded — receipt ${p.number}.` : 'Receipt saved.', { saved: p.id, ...receiptsState() });
}

// ------------------------------------------------------------
// Invoices (mirror InvoicesController::save)
// ------------------------------------------------------------

function saveInvoice(b) {
  const isNew = !b.id;
  const cust = book.customers.find((c) => c.id === b.customer_id);
  const title = String(b.title ?? '').trim();
  const due = String(b.due ?? '').trim();
  const currency = String(b.currency || 'CAD').toUpperCase();
  const pt = Number(b.payment_term_id) || null;
  const dt = Number(b.delivery_term_id) || null;
  const statusId = Number(b.status_id || 1);

  const errors = [];
  if (!cust) errors.push('Choose who the invoice is for.');
  if (!title) errors.push('Give the invoice a title (the project or reference).');
  else if (title.length > 255) errors.push('The title must be 255 characters or fewer.');
  if (due && (!/^\d{4}-\d{2}-\d{2}$/.test(due) || Number.isNaN(Date.parse(`${due}T00:00:00`)))) errors.push('Choose a valid due date (or leave it for "upon receipt").');
  if (!lookups.currencies.includes(currency)) errors.push('Choose CAD or USD.');
  if (pt && !lookups.payment_terms.some((t) => t.id === pt)) errors.push('Choose payment terms from the list.');
  if (dt && !lookups.delivery_terms.some((t) => t.id === dt)) errors.push('Choose delivery terms from the list.');
  if (!lookups.statuses.some((s) => s.id === statusId)) errors.push('Choose a status.');

  const lines = [];
  (b.items || []).slice(0, MAX_ITEMS + 1).forEach((raw, n) => {
    const desc = cleanRichText(raw.description);
    const qty = String(raw.quantity ?? '').replace(/[,\s]/g, '');
    const rate = String(raw.unit_price ?? '').replace(/[,\s$]/g, '');
    if (!plainText(desc) && !qty && !rate) return;
    const row = n + 1;
    if (!plainText(desc)) errors.push(`Line ${row}: describe the work.`);
    if (!/^-?\d+(\.\d{1,2})?$/.test(qty) || Number(qty) === 0) errors.push(`Line ${row}: enter a quantity (use a negative number for a discount).`);
    if (!/^\d+(\.\d{1,2})?$/.test(rate)) errors.push(`Line ${row}: enter a rate like 80 or 80.50.`);
    if (desc.length > 20000) errors.push(`Line ${row}: the description is too long.`);
    lines.push({ description: desc, quantity: round2(Number(qty)), unit_price: round2(Number(rate)) });
  });
  if (!lines.length) errors.push('Add at least one line.');
  else if (lines.length > MAX_ITEMS) errors.push(`An invoice can have up to ${MAX_ITEMS} lines.`);
  const total = round2(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0));
  if (!errors.length && total < 0) errors.push('The total can’t be below zero — check the discount lines.');
  if (errors.length) return fail(errors);

  const fields = { customer_id: cust.id, title, due: due || null, currency, payment_term_id: pt, delivery_term_id: dt, status_id: statusId, items: lines };
  let inv;
  if (isNew) {
    book.seq += 1;
    inv = { id: uid('gi'), number: `DEMO-INV-${String(book.seq).padStart(4, '0')}`, created: today(), payments: [], ...fields };
    book.invoices.push(inv);
  } else {
    inv = book.invoices.find((x) => x.id === b.id);
    if (!inv) return fail('Invoice not found.');
    Object.assign(inv, fields);
  }
  write();
  return ok(isNew ? `Invoice ${inv.number} created.` : 'Invoice saved.', { saved: inv.id, ...invoicesState() });
}
