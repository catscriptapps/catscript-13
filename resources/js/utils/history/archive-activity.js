// /resources/js/utils/history/archive-activity.js

import { showToast } from '../../ui/toast.js';
import { updateCount } from '../../components/table-pagination-count.js';

export function initArchiveActivity(tableSelector = '#history-tbody') {
    const tbody = document.querySelector(tableSelector);
    const modal = document.getElementById('archive-modal');
    if (!tbody || !modal) return;

    const confirmBtn = document.getElementById('confirm-archive');
    const cancelBtn = document.getElementById('cancel-archive');

    let activeRow = null;
    let activeId = null;

    tbody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="archive-history"]');
        if (!btn) return;

        activeRow = btn.closest('tr[data-id]');
        activeId = activeRow?.dataset.id;
        modal.classList.remove('hidden');
    });

    const closeModal = () => {
        modal.classList.add('hidden');
        activeRow = null;
        activeId = null;
    };

    cancelBtn.addEventListener('click', closeModal);

    confirmBtn.addEventListener('click', async () => {
        if (!activeId || !activeRow) return;

        try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Archiving...';

            const response = await fetch(`${window.APP_CONFIG?.baseUrl}api/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'archive', id: activeId })
            });

            const result = await response.json();

            if (result.success) {
                showToast('Activity successfully archived', 'success');

                // 1. Force immediate visual fade
                activeRow.style.transition = 'all 0.4s ease';
                activeRow.style.opacity = '0';
                activeRow.style.transform = 'translateX(-20px)';

                // 2. Kill the padding on all cells to force the row to collapse physically
                const cells = activeRow.querySelectorAll('td');
                cells.forEach(td => {
                    td.style.transition = 'all 0.4s ease';
                    td.style.paddingTop = '0';
                    td.style.paddingBottom = '0';
                    td.style.height = '0';
                });

                // 3. Finally remove it after the animation finishes
                setTimeout(() => {
                    activeRow.remove();
                    updateCount('history', tableSelector, '#history-count');
                    checkEmptyState(tbody);
                }, 400);
            } else {
                showToast(result.message || 'Error archiving', 'error');
            }
        } catch (error) {
            showToast('Server error', 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Archive';
            closeModal();
        }
    });
}

function checkEmptyState(tbody) {
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
}