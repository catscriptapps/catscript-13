// /resources/js/utils/cash-flow/guest-store.js
//
// Guest (try-it) mode for Cash Flow: the ledger lives only in this browser's
// localStorage — nothing is sent to the server. Entries are validated with
// the same rules as CashFlowController::save(), and have the same shape as
// CashFlowController::present(), so the page code treats both modes alike.
// Falls back to memory-only if storage is unavailable (private mode, etc.).

const KEY = 'catscript.cashflow.guest.v1';
let memory = null;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return memory;
  }
}

function write(ledger) {
  memory = ledger;
  try { localStorage.setItem(KEY, JSON.stringify(ledger)); } catch { /* memory only */ }
}

function nextRef(ledger) {
  const max = ledger.reduce((m, t) => Math.max(m, Number(String(t.ref).replace(/\D/g, '')) || 0), 0);
  return `DEMO-${pad(max + 1).padStart(4, '0')}`;
}

/** Realistic household sample entries for the last three months (never future-dated). */
export function sampleLedger() {
  const today = new Date();
  const rows = [];
  const add = (monthsAgo, day, type, title, amount, details = '') => {
    const d = new Date(today.getFullYear(), today.getMonth() - monthsAgo, day);
    if (d > today) return;
    rows.push({ type, title, amount, date: iso(d), details });
  };

  [2, 1, 0].forEach((m) => {
    const bump = (2 - m) * 3.4; // small month-to-month drift so the charts move
    add(m, 1, 'income', 'Paycheck', 2150);
    add(m, 15, 'income', 'Paycheck', 2150);
    if (m !== 1) add(m, 20, 'income', 'Side gig', 320 + m * 40);
    add(m, 1, 'expense', 'Mortgage', 1650);
    add(m, 3, 'expense', 'Internet', 90.39);
    add(m, 5, 'expense', 'Groceries', 142.18 + bump);
    add(m, 12, 'expense', 'Groceries', 96.42 + bump);
    add(m, 19, 'expense', 'Groceries', 118.75 - bump);
    add(m, 8, 'expense', 'Hydro', 118.62 - bump * 2);
    add(m, 10, 'expense', 'Enbridge Gas', 94.3 + bump * 3);
    add(m, 14, 'expense', 'Car insurance', 214.65);
    add(m, 17, 'expense', 'Gas station', 61.2 + bump);
    add(m, 22, 'expense', 'Dining out', 48.9 + bump * 2, 'Family dinner');
    add(m, 25, 'expense', 'Savings transfer', 250);
  });

  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  return rows.map((r, i) => ({
    encoded_id: uid(),
    ref: `DEMO-${pad(i + 1).padStart(4, '0')}`,
    title: r.title,
    type: r.type,
    amount: Math.round(r.amount * 100) / 100,
    date: r.date,
    details: r.details,
    receipt_url: null,
  })).reverse();
}

export const guestStore = {
  /** The guest ledger, seeding sample entries the very first time. */
  load() {
    const existing = read();
    if (Array.isArray(existing)) return existing;
    const seeded = sampleLedger();
    write(seeded);
    return seeded;
  },

  persist(ledger) {
    write(ledger);
  },

  resetToSample() {
    const seeded = sampleLedger();
    write(seeded);
    return seeded;
  },

  clear() {
    write([]);
    return [];
  },

  /**
   * Create / update, mirroring CashFlowController::save() validation.
   * @returns {{success: boolean, messages: string[], transaction?: object}}
   */
  save(data, encodedId, ledger) {
    const title = String(data.title ?? '').trim();
    const type = String(data.type ?? '');
    const amountRaw = String(data.amount ?? '').replace(/[,$\s]/g, '').trim();
    const date = String(data.transaction_date ?? '').trim();
    const details = String(data.details ?? '').trim();

    const errors = [];
    if (!['income', 'expense'].includes(type)) errors.push('Choose money in or money out.');
    if (!title) errors.push('Give the entry a title.');
    else if (title.length > 255) errors.push('The title must be 255 characters or fewer.');
    if (!/^\d+(\.\d{1,2})?$/.test(amountRaw) || Number(amountRaw) <= 0) errors.push('Enter an amount greater than zero, with up to 2 decimals.');
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || iso(parsed) !== date) errors.push('Choose a valid date.');
    if (details.length > 5000) errors.push('Notes must be 5,000 characters or fewer.');
    if (errors.length) return { success: false, messages: errors };

    const existing = encodedId ? ledger.find((t) => t.encoded_id === encodedId) : null;
    if (encodedId && !existing) return { success: false, messages: ['Entry not found.'] };

    const transaction = {
      encoded_id: existing?.encoded_id || uid(),
      ref: existing?.ref || nextRef(ledger),
      title,
      type,
      amount: Math.round(Number(amountRaw) * 100) / 100,
      date,
      details,
      receipt_url: null,
    };
    return { success: true, messages: [existing ? 'Entry updated.' : 'Entry recorded.'], transaction };
  },
};
