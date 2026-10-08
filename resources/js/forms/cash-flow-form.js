// /resources/js/forms/cash-flow-form.js

import { escapeHtml } from '../utils/escape-html.js';

/** YYYY-MM-DD in the browser's local time zone (not UTC). */
export function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Record / edit entry form. The #cf-impact panel is filled live by
 * pages/cash-flow-page.js as the amount, type and date change.
 * @param {object|null} entry  CashFlowController::present() data when editing
 */
export function cashFlowForm(entry = null, formId = 'cf-form') {
  const type = entry?.type || 'expense';
  const amount = entry ? Number(entry.amount).toFixed(2) : '';
  const date = entry?.date || localDate();

  const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
  const label = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';
  const chip = 'cf-date-chip px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors';
  const typeBtn = (value, text, swatch) => `
    <label class="relative flex-1 cursor-pointer">
      <input type="radio" name="type" value="${value}" class="peer sr-only" ${type === value ? 'checked' : ''} />
      <span class="flex items-center justify-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-4 py-3 text-sm font-bold text-gray-500 dark:text-gray-400 transition-all peer-checked:border-gray-900 peer-checked:bg-gray-900 peer-checked:text-white dark:peer-checked:border-white dark:peer-checked:bg-white dark:peer-checked:text-gray-900 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-primary-500">
        <span class="h-2.5 w-2.5 rounded-sm" style="background: var(${swatch})"></span>${text}
      </span>
    </label>`;

  return `
  <form id="${formId}" class="cf-root space-y-5" novalidate ${entry ? `data-encoded-id="${entry.encoded_id}"` : ''}>
    <div class="flex gap-3" role="radiogroup" aria-label="Type">
      ${typeBtn('income', 'Money in', '--cf-in')}
      ${typeBtn('expense', 'Money out', '--cf-out')}
    </div>

    <div>
      <label for="${formId}-amount" class="${label}">Amount</label>
      <div class="relative">
        <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
        <input type="text" inputmode="decimal" required id="${formId}-amount" name="amount" autocomplete="off"
          placeholder="0.00" value="${amount}"
          class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-3.5 py-3 text-2xl font-bold tracking-tight text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition" />
      </div>
    </div>

    <div>
      <label for="${formId}-title" class="${label}">Title</label>
      <div class="relative">
        <input type="text" required maxlength="255" id="${formId}-title" name="title" autocomplete="off"
          placeholder="e.g. BMO - Mortgage" value="${escapeHtml(entry?.title ?? '')}" class="${input}" />
      </div>
    </div>

    <div>
      <label for="${formId}-date" class="${label}">Date</label>
      <input type="date" required id="${formId}-date" name="transaction_date" value="${date}" class="${input}" />
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button type="button" class="${chip}" data-offset="0">Today</button>
        <button type="button" class="${chip}" data-offset="-1">Yesterday</button>
      </div>
    </div>

    <div>
      <label for="${formId}-details" class="${label}">Notes <span class="font-normal text-gray-400">(optional)</span></label>
      <textarea id="${formId}-details" name="details" rows="2" maxlength="5000" placeholder="Anything worth remembering…"
        class="${input} resize-y">${escapeHtml(entry?.details ?? '')}</textarea>
    </div>

    <!-- Live impact (filled as you type) -->
    <div id="cf-impact" class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 px-4 py-3" aria-live="polite"></div>

    <div class="api-message"></div>

    <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
      <button type="button" class="cf-cancel px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
      <button type="submit" class="inline-flex items-center justify-center min-w-[8.5rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60">
        ${entry ? 'Save changes' : 'Record entry'}
      </button>
    </div>
  </form>`;
}
