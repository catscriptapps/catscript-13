// /resources/js/factories/modal-factory.js

/**
 * Generic, reusable modal component with:
 * - Configurable ID, title, content
 * - Optional footer buttons
 * - Size variants (sm, md, lg, xl)
 * - Autofocus on first input
 * - Smooth show/hide animations
 * - Dark/light mode support
 */

export class Modal {
  /**
   * Constructor to initialize the modal instance.
   * @param {object} options - Modal options
   * @param {string} options.id - Unique ID for modal elements
   * @param {string} options.title - Modal title text
   * @param {string|HTMLElement} options.content - HTML content for modal body
   * @param {Array} options.footerButtons - Array of footer button configs {id, text, classes, onClick, hidden}
   * @param {string} options.size - Modal size: sm, md, lg, xl
   * @param {boolean} options.showFooter - Whether to display the footer
   */
  constructor({ id, title, content, footerButtons = [], size = 'lg', showFooter = true }) {
    this.id = id;                     // Modal container ID
    this.title = title;               // Modal title
    this.content = content;           // Body content
    this.footerButtons = footerButtons; // Footer button configs
    this.size = size;                 // Size class for modal width
    this.showFooter = showFooter;     // Whether footer is visible
    this.modal = null;                // Reference to modal DOM element
    this.overlay = null;              // Reference to overlay DOM element

    this.createModal();               // Build the modal HTML and inject into DOM
    this.attachBaseListeners();       // Attach default event listeners
  }

  /**
   * Returns Tailwind width class based on size option.
   */
  getSizeClass() {
    switch (this.size) {
      case 'sm': return 'max-w-sm';
      case 'md': return 'max-w-md';
      case 'lg': return 'max-w-4xl';
      case 'xl': return 'max-w-6xl';
      default: return 'max-w-4xl';
    }
  }

  /**
   * Builds the modal panel's inner HTML (header/title, body, optional
   * footer) — shared by both the first-time DOM insertion and a same-id
   * reuse's content refresh.
   */
  renderPanelHtml() {
    const footerHtml =
      this.showFooter && this.footerButtons.length
        ? `
        <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 z-10 flex justify-end">
          ${this.footerButtons
          .map(
            (btn) => `
              <button
                id="${btn.id}"
                class="${btn.classes} ${btn.hidden ? 'hidden' : ''}"
              >
                ${btn.text}
              </button>`
          )
          .join('')}
        </div>`
        : '';

    const logo = ``; // `<img src="${window.APP_CONFIG.assetBase}images/logo/favicon.ico" alt="" class="h-10 w-10 mr-2" />`;

    return `
        <div class="relative w-full ${this.getSizeClass()} bg-white dark:bg-gray-900 rounded-lg shadow-xl flex flex-col overflow-visible my-12">

          <!-- Modal Header -->
          <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center">
              ${logo}<span id="${this.id}-title">${this.title}</span>
            </h2>
            <button id="close-${this.id}" aria-label="Close modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          <!-- Modal Body -->
          <div class="modal-body p-6 overflow-visible">${this.content}</div>

          <!-- Modal Footer (optional) -->
          ${footerHtml}
        </div>
      `;
  }

  /**
   * Creates modal HTML and appends it to document body. If a modal with the
   * same ID already exists (a previous open() call for this same modal id,
   * e.g. re-opening "Edit" for a different record), its content is
   * refreshed in place instead — this.modal/this.overlay MUST still be set
   * to the existing elements here, otherwise attachBaseListeners() below
   * captures null references and every open()/close() on this instance
   * silently no-ops.
   */
  createModal() {
    const existing = document.getElementById(this.id);

    if (existing) {
      this.modal = existing;
      this.overlay = document.getElementById(`${this.id}-overlay`);
      this.modal.innerHTML = this.renderPanelHtml();
      return;
    }

    // Build main modal + overlay HTML
    const modalHtml = `
      <div id="${this.id}-overlay"
        class="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-75 hidden opacity-0 transition-opacity duration-300"
        style="z-index:2147483647">
      </div>

      <div id="${this.id}"
        class="fixed inset-0 hidden flex items-start justify-center p-4 transition-all duration-300 transform scale-95 opacity-0 overflow-y-auto"
        style="z-index:2147483648">
        ${this.renderPanelHtml()}
      </div>
    `;

    // Inject modal HTML into the body
    const container = document.getElementById('modal-zone') || document.body;
    container.insertAdjacentHTML('beforeend', modalHtml);

    // Store references for later use
    this.modal = document.getElementById(this.id);
    this.overlay = document.getElementById(`${this.id}-overlay`);
  }

  /**
   * Attach default listeners:
   * - Close button
   * - Overlay click
   * - Escape key
   * - Footer button clicks (user-defined and built-in close)
   */
  attachBaseListeners() {
    const closeBtn = document.getElementById(`close-${this.id}`);
    const overlay = this.overlay;
    const modal = this.modal;

    // Core toggle function to show/hide modal
    const toggle = (show) => {
      if (!modal || !overlay) return;

      if (show) {
        // 💎 ADD THIS signal that a high-priority modal is active
        document.body.classList.add('modal-open-priority');
        overlay.classList.remove('hidden');
        modal.classList.remove('hidden');

        // Animate in
        requestAnimationFrame(() => {
          overlay.classList.add('opacity-100');
          modal.classList.add('opacity-100', 'scale-100');
          modal.classList.remove('opacity-0', 'scale-95');

          // Autofocus first input after animation
          setTimeout(() => {
            const firstInput = modal.querySelector('input, textarea, [autofocus]');
            if (firstInput) firstInput.focus();
          }, 250);
        });

        document.body.style.overflow = 'hidden'; // Prevent body scroll
      } else {
        // 💎 Remove the signal for high priority active modal
        document.body.classList.remove('modal-open-priority');

        overlay.classList.remove('opacity-100');
        modal.classList.remove('opacity-100', 'scale-100');
        modal.classList.add('opacity-0', 'scale-95');

        // Hide elements after animation
        setTimeout(() => {
          overlay.classList.add('hidden');
          modal.classList.add('hidden');
          document.body.style.overflow = ''; // Restore body scroll
        }, 300);
      }
    };

    this.toggle = toggle;

    // Top-right close button — a fresh element every time (createModal()
    // replaces this.modal's innerHTML wholesale on reuse), so it always
    // needs a fresh listener; no risk of stacking duplicates here.
    closeBtn?.addEventListener('click', () => toggle(false));

    // overlay and document, unlike the modal panel's own contents, are NOT
    // recreated when a modal id is reused — only wire their listeners once
    // per element, or repeated open() calls for the same modal would stack
    // one more overlay-click/Escape listener each time.
    if (overlay && !overlay.dataset.listenersAttached) {
      overlay.dataset.listenersAttached = 'true';

      // Clicking overlay closes modal
      overlay.addEventListener('click', () => this.toggle(false));

      // Escape key closes modal safely
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.modal && !this.modal.classList.contains('hidden')) {
          this.toggle(false);
        }
      });
    }

    // Footer buttons: bind user-defined onClick or default close behavior
    this.footerButtons.forEach((btn) => {
      const el = document.getElementById(btn.id);
      if (!el) return;

      // Built-in "Close" behavior
      if (btn.id === 'modal-close-footer' || btn.text.toLowerCase().includes('close')) {
        el.addEventListener('click', () => toggle(false));
      }

      // Optional user-defined click handler
      if (typeof btn.onClick === 'function') {
        el.addEventListener('click', btn.onClick);
      }
    });
  }

  /**
   * Open modal programmatically
   */
  open() {
    this.toggle(true);
  }

  /**
   * Close modal programmatically
   */
  close() {
    this.toggle(false);
  }

  /**
   * Fully destroy modal DOM (panel AND its overlay). Previously only the
   * panel was removed, so destroying an open modal — e.g. "Edit" from a
   * view modal, which destroys the view modal before opening the form —
   * left its dark overlay covering the page until clicked, and left body
   * scrolling locked.
   */
  destroy() {
    const wasOpen = this.modal && !this.modal.classList.contains('hidden');

    [this.modal, this.overlay].forEach((el) => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    if (wasOpen) {
      document.body.classList.remove('modal-open-priority');
      document.body.style.overflow = '';
    }

    this.modal = null;
    this.overlay = null;
  }
}
