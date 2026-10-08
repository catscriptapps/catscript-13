// /resources/js/utils/table-footer.js

/**
 * Update the footer pagination summary.
 * Expects window.__pagination to be available.
 *
 * @param {HTMLElement} tbody - The table body element
 */
export function updateFooterCount(tbody) {
  const footer = document.getElementById('users-footer');
  if (!footer || !window.__pagination) return;

  const rowCount = tbody.querySelectorAll('tr').length;
  const total = window.__pagination.total;

  footer.innerHTML = `
    <div>Showing <span id="row-count">${rowCount}</span> of <span id="total-count">${total}</span> users</div>
    <div class="space-x-2">
      ${window.__pagination.current_page > 1
        ? `<button id="users-prev" data-page="${window.__pagination.current_page - 1}" class="px-3 py-1 rounded border">Prev</button>`
        : ''}
      ${window.__pagination.current_page < window.__pagination.last_page
        ? `<button id="users-next" data-page="${window.__pagination.current_page + 1}" class="px-3 py-1 rounded border">Next</button>`
        : ''}
    </div>
  `;
}
