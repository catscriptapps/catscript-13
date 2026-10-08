// /resources/js/ui/pagination-footer.js

// Renders a simple "Showing X of Y" footer for CRUD tables.

/**
 * Updates the pagination footer with current and total counts.
 * @param {Object} options
 * @param {number} options.total - Total number of items (unfiltered)
 * @param {number} options.filtered - Number of items currently visible
 * @param {string} options.entity - Singular noun (e.g. 'user', 'customer')
 * @param {string} options.selector - CSS selector for the footer container
 */
export function renderPaginationFooter({ total, filtered, entity, selector }) {
    const footer = document.querySelector(selector);
    if (!footer) return;

    const plural = total === 1 ? entity : `${entity}s`;
    const text =
        filtered === total
        ? `Showing ${total} ${plural}`
        : `Showing ${filtered} of ${total} ${plural}`;

    footer.textContent = text;
}
