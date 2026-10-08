// /resources/js/pages/contact-page.js
//
// Contact page (resources/views/pages/contact.php): the live identity card
// (initials, subject, who it's from, character count), the topic chips that
// fill the subject, inline errors, and the thank-you card once it's sent.
// Posts to api/contact (MessagesController::submitContact), which answers
// validation and rate-limit problems with 422 + messages — shown as they are.
// Also rotates the hero photos and wires "Start a live chat" to the chat bubble.

import { escapeHtml } from '../utils/escape-html.js';
import { bumpAvatar } from '../forms/form-kit.js';

const HERO_SLIDE_MS = 8 * 1000;
const MAX_BODY = 5000;
let heroTimer = null;

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export function init() {
  const page = document.getElementById('contact-page');
  const form = document.getElementById('contact-form');
  // Guard against double init (SPA navigation) — listeners would stack
  if (!page || !form || page.dataset.ready) return;
  page.dataset.ready = 'true';

  startHeroSlides();
  const field = (n) => form.querySelector(`[name="${n}"]`);
  const msgBox = form.querySelector('.api-message');
  const submit = document.getElementById('contact-submit');

  // ---- Live preview ------------------------------------------------------
  let lastInitials = null;
  const refresh = () => {
    const name = field('full_name').value.trim();
    const email = field('email').value.trim();
    const subject = field('subject').value.trim();
    const count = field('message').value.length;

    form.querySelector('[data-preview-title]').textContent = subject || 'What’s it about?';
    form.querySelector('[data-preview-sub]').textContent = name ? `From ${name}${email ? ` · ${email}` : ''}` : (email ? `From ${email}` : 'From you');
    const ini = initials(name);
    if (ini !== lastInitials) {
      form.querySelector('[data-preview-avatar]').textContent = ini || '👋';
      if (lastInitials !== null) bumpAvatar(form);
      lastInitials = ini;
    }
    const counter = form.querySelector('[data-preview-count]');
    counter.textContent = count.toLocaleString('en-CA');
    counter.classList.toggle('text-amber-300', count > MAX_BODY * 0.9);

    // Chips follow the subject
    form.querySelectorAll('[data-topic]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.topic === subject)));
  };
  form.addEventListener('input', refresh);
  refresh();

  form.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-topic]');
    if (!chip) return;
    const subject = field('subject');
    subject.value = chip.getAttribute('aria-pressed') === 'true' ? '' : chip.dataset.topic;
    refresh();
    field('message').focus();
  });

  // ---- Errors --------------------------------------------------------------
  const showErrors = (list) => {
    msgBox.innerHTML = list.map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
    msgBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const mark = (name, bad) => {
    const el = field(name);
    el.classList.toggle('border-red-400', bad);
    el.classList.toggle('dark:border-red-500', bad);
    el.setAttribute('aria-invalid', String(bad));
  };

  const check = () => {
    const errors = [];
    const name = field('full_name').value.trim();
    const email = field('email').value.trim();
    const message = field('message').value.trim();
    mark('full_name', !name);
    if (!name) errors.push('Please tell us your name.');
    const emailBad = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    mark('email', emailBad);
    if (emailBad) errors.push('Please enter a valid email address, so we can reply.');
    mark('message', !message);
    if (!message) errors.push('Please write your message.');
    return errors;
  };
  // Clear a field's red border as soon as it's fixed
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) mark(e.target.name, false); });

  // ---- Send ----------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msgBox.innerHTML = '';
    const errors = check();
    if (errors.length) { showErrors(errors); return; }

    const label = submit.querySelector('[data-label]');
    submit.disabled = true;
    label.textContent = 'Sending…';
    try {
      const res = await fetch(`${window.APP_CONFIG?.baseUrl || '/'}api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const result = await res.json().catch(() => ({ success: false }));
      if (!result.success) {
        showErrors(result.messages || ['Sorry — your message couldn’t be sent. Please try again in a moment.']);
        return;
      }
      // Thank-you card in place of the form
      const done = document.getElementById('contact-done');
      done.querySelector('[data-done-text]').textContent = result.messages?.[0] || 'Thanks — we’ll be in touch by email.';
      form.classList.add('hidden');
      done.classList.remove('hidden');
      done.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } catch {
      showErrors(['Sorry — your message couldn’t be sent. Check your connection and try again.']);
    } finally {
      submit.disabled = false;
      label.textContent = 'Send message';
    }
  });

  document.querySelector('#contact-done [data-again]')?.addEventListener('click', () => {
    // Keep who they are, clear what they said
    field('subject').value = '';
    field('message').value = '';
    refresh();
    document.getElementById('contact-done').classList.add('hidden');
    form.classList.remove('hidden');
    field('subject').focus();
  });

  // ---- "Start a live chat" → the chat bubble (an inbox link for admins) ----
  page.querySelector('[data-open-chat]')?.addEventListener('click', () => {
    const bubble = document.getElementById('chat-widget-bubble') || document.querySelector('#chat-widget a');
    if (!bubble) return;
    const panel = document.getElementById('chat-widget-panel');
    if (panel && !panel.classList.contains('hidden')) { document.getElementById('chat-widget-input')?.focus(); return; }
    bubble.click();
  });
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#contact-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  heroTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(heroTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}
