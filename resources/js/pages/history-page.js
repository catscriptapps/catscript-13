// /resources/js/pages/history-page.js

import { enableTableSearch } from '../components/table-search.js';
import { updateCount } from '../components/table-pagination-count.js';
import { initArchiveActivity } from '../utils/history/archive-activity.js';
import { initDeleteHistory } from '../utils/history/delete-history.js';

/**
 * Initialize the History page JS.
 */
export function init() {
    const baseUrl = window.APP_CONFIG?.baseUrl;

    // 1. Enable AJAX search & Pagination
    enableTableSearch({
        searchInputId: 'history-search',
        tbodyId: 'history-tbody',
        countId: 'history-count',
        endpoint: `${baseUrl}api/history`,
        resourceLabel: 'action',
        queryParam: 'q'
    });

    // 2. Initialize the separate action listeners
    initArchiveActivity();
    initDeleteHistory();

    // 3. Initial count update
    updateCount('action', '#history-tbody', '#history-count');
}