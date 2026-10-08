// /resources/js/utils/history/delete-history.js

import { createDeleteHandler } from '../../factories/delete-factory.js';
import { showToast } from '../../ui/toast.js';
import { updateCount } from '../../components/table-pagination-count.js';

/**
 * Attaches permanent delete functionality to the history table via delegation.
 */
export function initDeleteHistory(tableSelector = '#history-tbody') {
    const tbody = document.querySelector(tableSelector);
    if (!tbody) return;

    // Initialize the factory for the History endpoint
    const baseUrl = window.APP_CONFIG?.baseUrl || '/';
    const deleteHandler = createDeleteHandler(`${baseUrl}api/history-delete`, 'Activity Record');

    // Delegate click to delete buttons
    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete-history"]');
        if (!btn) return;

        e.stopPropagation();

        const row = btn.closest('tr[data-id]');
        const id = row?.dataset.id;

        if (!id || !row) {
            console.error('Delete failed: Missing ID or row element.');
            return;
        }

        // Trigger the factory's confirmation modal
        deleteHandler.showConfirmation(id, row, (success) => {
            if (!success) return;

            // 1. Show high-contrast toast
            showToast('Activity record permanently deleted', 'success');

            // 2. Update the count in the footer
            updateCount('history', tableSelector, '#history-count');

            // 3. Handle empty state if no rows are left
            const remainingRows = tbody.querySelectorAll('tr:not(.empty-state-row)').length;
            if (remainingRows === 0) {
                tbody.innerHTML = `
                    <tr class="empty-state-row">
                        <td colspan="100%" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400 font-sans">
                            <div class="flex flex-col items-center">
                                <svg class="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p class="font-bold text-lg text-gray-900 dark:text-white">No activity found</p>
                                <p class="text-sm">The audit trail is currently empty.</p>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });
    });
}