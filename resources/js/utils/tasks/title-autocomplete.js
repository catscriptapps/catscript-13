// /resources/js/utils/tasks/title-autocomplete.js
//
// Suggests titles from earlier tasks while typing (recurring bills etc. —
// "Pay Enbridge Gas", "Pay Rogers (Internet)"). Ported from the legacy
// task-autocomplete.js; keyboard navigable (↑/↓/Enter/Escape).

import { debounce } from '../debounce.js';
import { escapeHtml } from '../escape-html.js';

/**
 * @param {HTMLInputElement} input
 * @param {(q: string) => string[]} [source] local suggestions (guest mode);
 *   defaults to the server's api/tasks?suggest=1
 */
export function initTitleAutocomplete(input, source = null) {
  if (!input || input.dataset.autocomplete) return;
  input.dataset.autocomplete = 'on';

  const list = document.createElement('ul');
  list.className = 'absolute z-[100] left-0 right-0 mt-1 max-h-60 overflow-y-auto custom-scrollbar rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hidden';
  list.setAttribute('role', 'listbox');
  input.parentNode.appendChild(list);

  let items = [];
  let active = -1;

  const hide = () => { list.classList.add('hidden'); active = -1; };

  const highlight = (index) => {
    active = index;
    [...list.children].forEach((li, i) => {
      li.classList.toggle('bg-primary-50', i === active);
      li.classList.toggle('dark:bg-primary-900/30', i === active);
    });
  };

  const choose = (index) => {
    if (index < 0 || index >= items.length) return;
    input.value = items[index];
    hide();
  };

  const render = () => {
    if (!items.length) return hide();
    list.innerHTML = items.map((t, i) =>
      `<li role="option" data-index="${i}" class="px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30">${escapeHtml(t)}</li>`
    ).join('');
    list.classList.remove('hidden');
    active = -1;
  };

  const fetchSuggestions = debounce(async () => {
    const q = input.value.trim();
    if (q.length < 2) return hide();
    if (source) {
      items = source(q).filter((t) => t.toLowerCase() !== q.toLowerCase());
      return render();
    }
    try {
      const res = await fetch(`${window.APP_CONFIG?.baseUrl || '/'}api/tasks?suggest=1&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      items = (json.success ? json.data : []).filter((t) => t.toLowerCase() !== q.toLowerCase());
      render();
    } catch {
      hide();
    }
  }, 200);

  input.addEventListener('input', fetchSuggestions);

  input.addEventListener('keydown', (e) => {
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  });

  // mousedown (not click) so the choice lands before the input blurs
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-index]');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.index));
  });

  input.addEventListener('blur', () => setTimeout(hide, 100));
}
