// /resources/js/components/table-pagination-count.js

/**
 * Generic module to manage "Showing X items" count display for any resource.
 */

/**
 * Updates a table count display.
 * @param {string} resourceLabel - Singular label, e.g., 'inspection', 'customer'
 * @param {string} tbodySelector - Selector for the table body
 * @param {string} countSelector - Selector for the count display element
 */
export function updateCount(resourceLabel, tbodySelector, countSelector) {
    const tbody = document.querySelector(tbodySelector);
    const countDiv = document.querySelector(countSelector);
    if (!tbody || !countDiv) return;

    // 1. Get all child rows
    const rows = tbody.children;
    let actualCount = rows.length;

    // 2. Check if the only row present is the "No items found" message
    // We detect this by checking if the first row contains a td with a high colspan 
    // or if the text matches "No [resource] found"
    if (rows.length === 1) {
        const firstRow = rows[0];
        const isNoResultsRow = firstRow.querySelector('td[colspan]') !== null;

        if (isNoResultsRow) {
            actualCount = 0;
        }
    }

    const label = resourceLabel.toLowerCase();
    const labelPlural = (label === 'property') ? 'properties' : label + "s";

    countDiv.textContent = `Showing ${actualCount} ${actualCount === 1 ? label : labelPlural}`;
}

/**
 * Initializes a table count display on page load.
 */
export function initCount(resourceLabel, tbodySelector, countSelector) {
    updateCount(resourceLabel, tbodySelector, countSelector);
}