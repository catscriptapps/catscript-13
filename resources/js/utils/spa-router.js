// /resources/js/utils/spa-router.js

/**
 * Partial SPA Router — handles navigation, history, and content loading.
 * Links with [data-partial] trigger partial loads.
 * Pages are PHP partials returning valid HTML <title> + content.
 */

import { showSpinner, hideSpinner } from './../ui/spinner.js';

/**
 * Marks the sidebar link for the current page as active (.is-active — the
 * look lives in app.css under "Sidebar navigation"). Scoped to the
 * sidebar's `nav[data-nav-accent]` .sidebar-link items.
 */
export function updateActiveLink(url) {
  let path = new URL(url, window.location.origin).pathname;

  // The app root renders the home page (server-side normalizePath() maps
  // "/" to "/home"), so highlight the Home link there too.
  const rootPath = new URL(window.APP_CONFIG?.baseUrl || '/', window.location.origin).pathname;
  if (path === rootPath || path === rootPath.replace(/\/$/, '')) {
    path = rootPath.replace(/\/$/, '') + '/home';
  }

  document.querySelectorAll('nav[data-nav-accent] a.sidebar-link[data-partial]').forEach((link) => {
    const isActive = new URL(link.href, window.location.origin).pathname === path;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

/**
 * Updated loadPartial for spa-router.js
 * Handles content injection and Document Title sync.
 */
export async function loadPartial(url, pushState = true, clickedLink = null) {
  try {
    showSpinner();

    const response = await fetch(url, { headers: { 'X-Requested-With': 'XMLHttpRequest' } });
    if (!response.ok) throw new Error(`Failed to load ${url}`);

    const html = await response.text();
    const appName = window.APP_CONFIG?.appName || 'Catscript';

    // 1. Title & Meta Summary extraction logic
    const urlPath = new URL(url, window.location.origin).pathname;
    const isHome = urlPath === '/' || urlPath === '/index.php';

    const trigger = clickedLink || document.querySelector(`a[data-partial][href*="${urlPath.split('/').pop()}"]`);

    // Fall back to the server-supplied X-Page-Title/X-Page-Summary headers when this
    // load wasn't triggered by a clicked <a data-partial> (e.g. a programmatic redirect
    // after a form submission) — otherwise the header title/summary would go blank.
    let pageTitle = trigger?.getAttribute('data-title') || '';
    let pageSummary = trigger?.getAttribute('data-summary') || '';

    if (!pageTitle) {
      const headerTitle = response.headers.get('X-Page-Title');
      if (headerTitle) pageTitle = decodeURIComponent(headerTitle);
    }
    if (!pageSummary) {
      const headerSummary = response.headers.get('X-Page-Summary');
      if (headerSummary) pageSummary = decodeURIComponent(headerSummary);
    }

    if (pageTitle) {
      document.title = `${pageTitle} | ${appName}`;
    }

    // Dispatch global event caught by Alpine context within layout-header.php
    window.dispatchEvent(new CustomEvent('spa-navigation', {
      detail: { isHome, title: pageTitle, summary: pageSummary }
    }));

    // 2. Style Cleanup
    document.querySelectorAll('style[data-page-style]').forEach(tag => tag.remove());

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    doc.querySelectorAll('style').forEach(style => {
      style.setAttribute('data-page-style', 'true');
      document.head.appendChild(style);
    });

    // 3. Content Injection
    const masterContainer = document.querySelector('#main-content');
    if (masterContainer) {
      masterContainer.style.display = 'none';
      masterContainer.innerHTML = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
      masterContainer.style.display = 'block';
    }

    // 4. State Management
    updateActiveLink(url);
    if (pushState) history.pushState({ url }, '', url);

    hideSpinner();
    window.scrollTo(0, 0);
    document.body.dispatchEvent(new CustomEvent('partial-load', { detail: { url } }));

  } catch (err) {
    console.error('SPA Load Error:', err);
    hideSpinner();
  }
}

/**
 * GET filter/search forms (e.g. the search + region bar on
 * real-estate-leads, or contractor-discovery's search + category bar) opt
 * into partial loads the same way links do: add [data-partial] to the
 * <form>. Submitting builds the querystring from the form fields (so page
 * reload/back-button/pagination links keep working exactly the same) and
 * routes it through loadPartial() instead of a native navigation.
 *
 * POST forms (login, signup, etc.) are untouched — those legitimately want
 * a full page load, or already handle their own submission via fetch.
 */
function bindPartialForms() {
  document.body.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-partial]');
    if (!form || form.method.toUpperCase() !== 'GET') return;

    e.preventDefault();
    const params = new URLSearchParams(new FormData(form));
    const url = form.action.split('?')[0] + '?' + params.toString();
    loadPartial(url, true);
  });
}

export function bindPartialLinks() {
  document.body.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-partial]');
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey) return;

    e.preventDefault();
    loadPartial(link.href, true, link);
  });

  window.addEventListener('popstate', (e) => {
    const url = e.state?.url || window.location.href;
    loadPartial(url, false);
  });

  bindPartialForms();
  updateActiveLink(window.location.href);
}

window.loadPartial = loadPartial;