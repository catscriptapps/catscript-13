// /resources/js/pages/faqs-page.js
//
// FAQs (help centre): every question lives in memory (seeded from
// #faqs-data) with its topic. The topic tabs (a list on wide screens, a
// scrolling chip row on phones) pick what's shown; typing in the hero search
// looks across every answer instead, grouped by topic, with the matches
// highlighted. Answers open in place; each has a "Copy link" that points
// straight at it (?topic=…#faq-…); ?q=… opens with a search.
//
// Admins also see archived questions and get the editor (topic, question,
// answer with a live preview of the formatting), reordering and delete —
// every write returns the fresh state. Answer HTML comes from the server
// (FaqsController::format — escaped plain text with light formatting).

import { Modal } from '../factories/modal-factory.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { TONE, formSection, kitInput, kitLabel, kitSubmit, kitGhost } from '../forms/form-kit.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/faqs`;
const HERO_SLIDE_MS = 8 * 1000;
// Same section names as FaqsController::CATEGORIES (empty ones are skipped)
const SECTIONS = ['Start here', 'Workspace', 'Community', 'Help', 'Admin'];

let data = { faqs: [], categories: [], is_admin: false, contact_url: '' };
let state = { topic: 'getting-started', q: '', open: new Set() };
let modal = null;
let heroTimer = null;

const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  chevron: 'M19 9l-7 7-7-7',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  up: 'M5 15l7-7 7 7', down: 'M19 9l-7 7-7-7', plus: 'M12 4v16m8-8H4',
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cat = (key) => data.categories.find((c) => c.key === key) || data.categories[0];
const inTopic = (key) => data.faqs.filter((f) => f.category === key).sort((a, b) => a.order - b.order);
const words = (q) => q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
const plainOf = (f) => `${f.question} ${f.answer}`.toLowerCase();

async function post(body) {
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}
function adopt(json) { ['faqs', 'categories', 'is_admin'].forEach((k) => { if (json[k] !== undefined) data[k] = json[k]; }); }

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('faqs-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('faqs-data')?.textContent || '{}') }; } catch { /* defaults */ }

  // Deep link: ?topic=…, #faq-…
  const params = new URLSearchParams(window.location.search);
  const hashId = window.location.hash.startsWith('#faq-') ? window.location.hash.slice(5) : '';
  const linked = hashId && data.faqs.find((f) => f.id === hashId);
  const topic = linked?.category || params.get('topic');
  state = { topic: data.categories.some((c) => c.key === topic) ? topic : firstTopic(), q: '', open: new Set(linked ? [linked.id] : []) };

  page.addEventListener('click', onClick);
  const search = document.getElementById('faq-search');
  // ?q=… starts with a search (shareable)
  if (!linked && params.get('q') && search) { search.value = params.get('q'); state.q = params.get('q').trim(); }
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim(); renderBody(); renderTopics(); }, 120));
  // "/" jumps to the search box (unless you're typing somewhere)
  document.addEventListener('keydown', onSlash);

  renderTiles();
  renderTopics();
  renderBody();
  startHeroSlides();
  if (linked) requestAnimationFrame(() => document.getElementById(`faq-${linked.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}

function onSlash(e) {
  if (!document.getElementById('faqs-page')) { document.removeEventListener('keydown', onSlash); return; }
  if (e.key !== '/' || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
  e.preventDefault();
  document.getElementById('faq-search')?.focus();
}

const firstTopic = () => (data.categories.find((c) => c.count > 0) || data.categories[0])?.key || 'getting-started';

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#faqs-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  heroTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(heroTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function renderTiles() {
  const el = document.getElementById('faq-tiles');
  if (!el) return;
  const published = data.faqs.filter((f) => f.active);
  const topics = data.categories.filter((c) => c.count > 0);
  const apps = topics.filter((c) => ['Workspace', 'Community'].includes(c.section));
  const tile = (value, label) => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-3 py-3 text-center min-w-0">
      <span class="block text-2xl font-bold leading-none">${value}</span>
      <span class="block text-[10px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">${label}</span>
    </div>`;
  el.innerHTML = tile(published.length, 'Answers') + tile(topics.length, 'Topics') + tile(apps.length, 'Apps covered');
}

function renderTopics() {
  const el = document.getElementById('faq-topics');
  if (!el) return;
  const searching = !!state.q;
  const visible = data.categories.filter((c) => c.count > 0 || data.is_admin);
  const chip = (c) => {
    const on = !searching && c.key === state.topic;
    return `<button type="button" data-topic="${c.key}" aria-pressed="${on}" class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${on ? 'bg-secondary-900 text-white dark:bg-white dark:text-gray-900' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}"><span aria-hidden="true">${c.icon}</span>${escapeHtml(c.label)}</button>`;
  };
  const row = (c) => {
    const on = !searching && c.key === state.topic;
    return `<button type="button" data-topic="${c.key}" aria-current="${on ? 'page' : 'false'}" class="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors ${on ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 font-medium'}">
      <span aria-hidden="true" class="h-7 w-7 flex-shrink-0 rounded-lg ${on ? 'bg-white dark:bg-gray-900 shadow-sm' : 'bg-gray-100 dark:bg-gray-800'} flex items-center justify-center text-sm">${c.icon}</span>
      <span class="min-w-0 flex-1 truncate">${escapeHtml(c.label)}</span>
      <span class="text-[11px] ${on ? 'text-primary-500' : 'text-gray-400'}">${c.count}</span></button>`;
  };
  el.innerHTML = `
    <div class="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 lg:hidden">${visible.map(chip).join('')}</div>
    <div class="hidden lg:block space-y-3 py-1">
      ${SECTIONS.map((s) => {
        const list = visible.filter((c) => c.section === s);
        return list.length ? `<div><p class="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">${s}</p>${list.map(row).join('')}</div>` : '';
      }).join('')}
    </div>`;
}

function itemHtml(f, showTopic = false) {
  const open = state.open.has(f.id);
  const c = cat(f.category);
  const btn = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition-colors';
  return `
    <article id="faq-${escapeHtml(f.id)}" class="rounded-2xl border ${open ? 'border-primary-200 dark:border-primary-900/60 shadow-md shadow-primary-500/5' : 'border-gray-200 dark:border-gray-800 shadow-sm'} bg-white dark:bg-gray-900 transition-shadow ${f.active ? '' : 'opacity-70'}">
      <h3>
        <button type="button" data-toggle="${escapeHtml(f.id)}" aria-expanded="${open}" class="w-full flex items-start gap-3 px-5 py-4 text-left">
          <span class="min-w-0 flex-1">
            ${showTopic ? `<span class="block mb-1 text-[11px] font-semibold text-gray-400">${c.icon} ${escapeHtml(c.label)}</span>` : ''}
            <span data-q class="block text-[15px] font-semibold leading-snug ${open ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}">${escapeHtml(f.question)}</span>
            ${f.active ? '' : '<span class="mt-1 inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-500">Archived — only admins see this</span>'}
          </span>
          <span class="mt-0.5 h-7 w-7 flex-shrink-0 rounded-full ${open ? 'bg-primary-500 text-white rotate-180' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'} flex items-center justify-center transition-transform duration-200">${svg(ICON.chevron)}</span>
        </button>
      </h3>
      ${open ? `
        <div class="px-5 pb-4">
          <div data-a class="faq-answer text-sm leading-relaxed text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800 pt-4 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_li]:mb-1 [&_strong]:font-semibold [&_strong]:text-gray-800 dark:[&_strong]:text-gray-100">${f.html}</div>
          <div class="mt-3 flex flex-wrap items-center gap-1">
            <button type="button" data-copy="${escapeHtml(f.id)}" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.link, 'h-3.5 w-3.5')} Copy link</button>
            ${data.is_admin ? `
              <span class="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700"></span>
              <button type="button" data-edit="${escapeHtml(f.id)}" class="${btn} text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40">${svg(ICON.edit, 'h-3.5 w-3.5')} Edit</button>
              <button type="button" data-move="${escapeHtml(f.id)}" data-dir="-1" title="Move up" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.up, 'h-3.5 w-3.5')}</button>
              <button type="button" data-move="${escapeHtml(f.id)}" data-dir="1" title="Move down" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.down, 'h-3.5 w-3.5')}</button>
              <button type="button" data-delete="${escapeHtml(f.id)}" class="${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">${svg(ICON.trash, 'h-3.5 w-3.5')} Delete</button>` : ''}
            ${f.updated ? `<span class="ml-auto text-[11px] text-gray-400">Updated ${new Date(`${f.updated}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}</span>` : ''}
          </div>
        </div>` : ''}
    </article>`;
}

const stillStuck = () => `
  <div class="relative overflow-hidden rounded-2xl border border-orange-100 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-950/20 dark:to-gray-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
    <div aria-hidden="true" class="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-orange-300/30 blur-2xl"></div>
    <span class="relative h-11 w-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 text-white flex items-center justify-center text-xl shadow-md">🙋</span>
    <div class="relative min-w-0 flex-1"><p class="text-sm font-bold text-gray-900 dark:text-white">Still stuck?</p><p class="text-xs text-gray-500 dark:text-gray-400">Ask a real person — we usually reply within a day.</p></div>
    <div class="relative flex flex-wrap gap-2">
      <button type="button" data-open-chat class="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Live chat</button>
      <a href="${escapeHtml(data.contact_url)}" data-partial class="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors">Contact us</a>
    </div>
  </div>`;

function renderBody() {
  const el = document.getElementById('faq-body');
  if (!el) return;

  // Search: across every topic, best matches first, grouped by topic
  if (state.q) {
    const ws = words(state.q);
    const scored = data.faqs.map((f) => {
      const text = plainOf(f);
      if (!ws.every((w) => text.includes(w))) return null;
      const q = f.question.toLowerCase();
      return { f, score: ws.reduce((s, w) => s + (q.includes(w) ? 3 : 1), 0) };
    }).filter(Boolean).sort((a, b) => b.score - a.score);
    el.innerHTML = `
      <div class="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4 shadow-sm">
        <p class="text-sm text-gray-600 dark:text-gray-300 flex-1"><strong class="text-gray-900 dark:text-white">${plural(scored.length, 'answer')}</strong> for “${escapeHtml(state.q)}”</p>
        <button type="button" data-clear class="text-xs font-semibold text-primary-600 hover:underline">Clear search</button>
      </div>
      ${scored.length ? scored.map(({ f }) => itemHtml(f, true)).join('') : `
        <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-14 text-center shadow-sm">
          <p class="text-3xl mb-2">🔍</p><p class="text-sm font-semibold text-gray-800 dark:text-gray-100">Nothing matches that</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Try fewer or different words — or ask us directly below.</p></div>`}
      ${stillStuck()}`;
    highlight(el, ws);
    return;
  }

  const c = cat(state.topic);
  const list = inTopic(c.key);
  el.innerHTML = `
    <div class="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm flex items-center gap-4">
      <div aria-hidden="true" class="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary-300/20 blur-2xl"></div>
      <span class="relative h-12 w-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-primary-400 via-orange-500 to-rose-500 flex items-center justify-center text-2xl shadow-md shadow-primary-500/25">${c.icon}</span>
      <div class="relative min-w-0 flex-1">
        <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">${escapeHtml(c.section)}</p>
        <h2 class="text-lg font-bold text-gray-900 dark:text-white">${escapeHtml(c.label)}</h2>
        <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(c.blurb)} · ${plural(list.filter((f) => f.active).length, 'answer')}</p>
      </div>
      <div class="relative flex items-center gap-2 flex-shrink-0">
        ${list.length > 1 ? `<button type="button" data-expand class="hidden sm:inline-flex px-3 py-2 rounded-xl text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">${list.every((f) => state.open.has(f.id)) ? 'Collapse all' : 'Expand all'}</button>` : ''}
        ${data.is_admin ? `<button type="button" data-new class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm">${svg(ICON.plus, 'h-3.5 w-3.5')} Add question</button>` : ''}
      </div>
    </div>
    ${list.length ? list.map((f) => itemHtml(f)).join('') : `
      <div class="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">No questions in this topic yet.</div>`}
    ${stillStuck()}`;
}

/** Wrap the search words in <mark> inside questions and open answers (text nodes only, so links stay intact). */
function highlight(root, ws) {
  if (!ws.length) return;
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  root.querySelectorAll('[data-q], [data-a]').forEach((box) => {
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((n) => {
      if (!re.test(n.nodeValue)) return;
      re.lastIndex = 0;
      const span = document.createElement('span');
      span.innerHTML = escapeHtml(n.nodeValue).replace(re, '<mark class="rounded bg-amber-200/80 dark:bg-amber-500/30 text-inherit px-0.5">$1</mark>');
      n.replaceWith(...span.childNodes);
    });
  });
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onClick(e) {
  const t = e.target.closest('[data-topic]');
  if (t) {
    state.topic = t.dataset.topic;
    state.q = '';
    const s = document.getElementById('faq-search');
    if (s) s.value = '';
    renderTopics(); renderBody();
    const url = new URL(window.location.href);
    url.searchParams.set('topic', state.topic);
    url.hash = '';
    history.replaceState(history.state, '', url);
    if (window.matchMedia('(max-width: 1023px)').matches) document.getElementById('faq-body')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }
  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    const id = tg.dataset.toggle;
    if (state.open.has(id)) state.open.delete(id); else state.open.add(id);
    renderBody();
    return;
  }
  if (e.target.closest('[data-expand]')) {
    const list = inTopic(state.topic);
    const all = list.every((f) => state.open.has(f.id));
    list.forEach((f) => (all ? state.open.delete(f.id) : state.open.add(f.id)));
    renderBody();
    return;
  }
  if (e.target.closest('[data-clear]')) {
    state.q = '';
    document.getElementById('faq-search').value = '';
    renderTopics(); renderBody();
    return;
  }
  if (e.target.closest('[data-open-chat]')) {
    (document.getElementById('chat-widget-bubble') || document.querySelector('#chat-widget a'))?.click();
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const f = data.faqs.find((x) => x.id === cp.dataset.copy);
    const url = new URL(`${base()}faqs`, window.location.origin);
    url.searchParams.set('topic', f.category);
    url.hash = `faq-${f.id}`;
    try { await navigator.clipboard.writeText(url.toString()); showToast('Link copied — it opens this answer.', 'success'); } catch { showToast(url.toString(), 'success'); }
    return;
  }

  // Admin
  if (!data.is_admin) return;
  if (e.target.closest('[data-new]')) { openEditor(null); return; }
  const ed = e.target.closest('[data-edit]');
  if (ed) { openEditor(data.faqs.find((f) => f.id === ed.dataset.edit)); return; }
  try {
    const mv = e.target.closest('[data-move]');
    if (mv) {
      adopt(await post({ action: 'move', id: mv.dataset.move, dir: Number(mv.dataset.dir) }));
      renderBody();
      return;
    }
    const del = e.target.closest('[data-delete]');
    if (del) {
      const f = data.faqs.find((x) => x.id === del.dataset.delete);
      if (!(await confirmDialog(`Delete “<strong>${escapeHtml(f.question)}</strong>” for good? To just hide it, edit it and untick Published.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      const json = await post({ action: 'delete', id: f.id });
      adopt(json); renderTiles(); renderTopics(); renderBody();
      showToast(json.messages?.[0] || 'Deleted.', 'success');
    }
  } catch (err) { showToast(err.message, 'error'); }
}

// ------------------------------------------------------------
// Editor (admins)
// ------------------------------------------------------------

/** Mirror of FaqsController::format() for the live preview. */
function preview(text) {
  const inline = (s) => escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((\/[A-Za-z0-9\-/?=&;#_.]*)\)/g, '<span class="font-semibold text-primary-600 underline">$1</span>');
  return text.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n/).map((block) => {
    const lines = block.split('\n').filter((l) => l.trim());
    if (!lines.length) return '';
    if (lines.every((l) => /^\s*[-•]\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}

function openEditor(f) {
  const isEdit = !!f;
  const v = f || { question: '', answer: '', category: state.topic, active: true };
  modal?.destroy();
  modal = new Modal({
    id: 'faq-editor', title: isEdit ? 'Edit question' : 'New question', size: 'lg', showFooter: false,
    content: `
      <form id="faq-form" class="space-y-5" novalidate>
        ${formSection(TONE.orange, '❓', 'The question', 'Word it the way someone would ask it.', `
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
            <div><label for="faq-q" class="${kitLabel}">Question</label>
              <input id="faq-q" name="question" maxlength="255" value="${escapeHtml(v.question)}" placeholder="e.g. How do I record a payment?" class="${kitInput}"></div>
            <div><label for="faq-cat" class="${kitLabel}">Topic</label>
              <select id="faq-cat" name="category" class="${kitInput}">
                ${SECTIONS.filter((s) => data.categories.some((c) => c.section === s)).map((s) => `<optgroup label="${s}">${data.categories.filter((c) => c.section === s).map((c) => `<option value="${c.key}" ${c.key === v.category ? 'selected' : ''}>${c.icon} ${escapeHtml(c.label)}</option>`).join('')}</optgroup>`).join('')}
              </select></div>
          </div>`)}
        ${formSection(TONE.sky, '✍️', 'The answer', 'Blank line = new paragraph · “- ” = bullet · “1. ” = numbered step · **bold** · [label](/page) = link.', `
          <div class="grid gap-4 lg:grid-cols-2">
            <div><label for="faq-a" class="${kitLabel}">Answer</label>
              <textarea id="faq-a" name="answer" rows="12" maxlength="20000" class="${kitInput} resize-y font-mono text-[13px] leading-relaxed">${escapeHtml(v.answer)}</textarea></div>
            <div><p class="${kitLabel}">Preview</p>
              <div data-preview class="h-full max-h-[22rem] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_strong]:font-semibold [&_strong]:text-gray-800 dark:[&_strong]:text-gray-100"></div></div>
          </div>`)}
        <label class="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3 cursor-pointer">
          <input type="checkbox" name="active" ${v.active ? 'checked' : ''} class="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500">
          <span><span class="block text-sm font-semibold text-gray-900 dark:text-white">Published</span><span class="block text-xs text-gray-500 dark:text-gray-400">Untick to archive it — only admins will see it.</span></span>
        </label>
        <div class="api-message space-y-2"></div>
        <div class="flex justify-end gap-3">
          <button type="button" data-cancel class="${kitGhost}">Cancel</button>
          <button type="submit" class="${kitSubmit}">${isEdit ? 'Save changes' : 'Add question'}</button>
        </div>
      </form>`,
  });
  modal.open();
  const form = document.getElementById('faq-form');
  const ta = form.querySelector('[name="answer"]');
  const paint = () => { form.querySelector('[data-preview]').innerHTML = preview(ta.value) || '<p class="text-gray-400">The answer will appear here.</p>'; };
  ta.addEventListener('input', paint);
  paint();
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true;
    const box = form.querySelector('.api-message');
    box.innerHTML = '';
    try {
      const json = await post({ action: 'save', id: f?.id || '', question: form.question.value, answer: ta.value, category: form.category.value, active: form.active.checked });
      adopt(json);
      state.topic = form.category.value;
      state.q = '';
      state.open.add(json.saved);
      document.getElementById('faq-search').value = '';
      modal.close();
      renderTiles(); renderTopics(); renderBody();
      document.getElementById(`faq-${json.saved}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      showToast(json.messages?.[0] || 'Saved.', 'success');
    } catch (err) {
      box.innerHTML = (err.messages || [err.message]).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
    } finally { b.disabled = false; }
  });
}
