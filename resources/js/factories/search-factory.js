// /resources/js/factories/search-factory.js

/**
 * Global Search Factory
 *
 * Provides a reusable, debounced search handler for API-backed resources.
 *
 * @param {Object} options
 * @param {string} options.inputSelector - CSS selector for the search input field.
 * @param {string} options.endpoint - API endpoint URL (e.g., '/api/users').
 * @param {function} options.onResults - Callback that receives the fetched data.
 * @param {number} [options.delay=300] - Debounce delay in milliseconds.
 * @param {function} [options.onError] - Optional error callback.
 * @returns {Object} Public interface for triggering search manually.
 */
export function createSearchHandler({ inputSelector, endpoint, onResults, delay = 300, onError }) {
    const inputEl = document.querySelector(inputSelector);
    if (!inputEl) {
        console.error(`Search input not found for selector: ${inputSelector}`);
        return;
    }

    let timeout = null;
    let controller = null; // For aborting previous requests

    const performSearch = async (query) => {
        if (controller) controller.abort();
        controller = new AbortController();

        try {
            const res = await fetch(`${endpoint}?q=${encodeURIComponent(query)}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && typeof onResults === 'function') {
                onResults(data.data || []);
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Search error:', err);
                if (typeof onError === 'function') onError(err);
            }
        }
    };

    // Debounced input listener
    inputEl.addEventListener('input', () => {
        const query = inputEl.value.trim();

        clearTimeout(timeout);
        timeout = setTimeout(() => performSearch(query), delay);
    });

    return {
        search: performSearch // Allow manual triggering if needed
    };
}
