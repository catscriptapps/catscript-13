// /resources/js/factories/delete-factory.js

/**
 * Global Delete Confirmation Handler
 *
 * This factory creates and manages a reusable confirmation modal for deleting
 * any entity, implementing conditional event binding to prioritize SPA-safe behavior.
 *
 * @param {string} endpoint The base API endpoint for the resource (e.g., '/api/users').
 * @param {string} resourceName The user-friendly name of the resource (e.g., 'User').
 */
export function createDeleteHandler(endpoint, resourceName) {
    const modalId = `${resourceName}-delete-modal`;
    let modal = document.getElementById(modalId);
    
    // --- Determine if resource is the single exception that requires BIND ONCE ---
    const EXCEPTION_RESOURCE_NAME = 'FAQ'; 
    const requiresBindOnce = (resourceName === EXCEPTION_RESOURCE_NAME);

    // Create modal only once
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900 bg-opacity-70 dark:bg-opacity-80 transition-opacity duration-300 opacity-0 pointer-events-none';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm transform transition-all duration-300 translate-y-4 opacity-0 p-6">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Confirm Deletion</h3>
                <p id="delete-message" class="text-gray-600 dark:text-gray-400 mb-6"></p>

                <div id="delete-feedback" class="hidden px-3 py-2 text-sm rounded transition-all mb-4" role="alert"></div>

                <div id="delete-actions" class="flex justify-end space-x-3">
                    <button type="button" class="cancel-delete-btn px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                        No, Cancel
                    </button>
                    <button type="button" class="confirm-delete-btn px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                        Yes, Delete
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Scoped references
    const confirmBtn = modal.querySelector('.confirm-delete-btn');
    const cancelBtn = modal.querySelector('.cancel-delete-btn');
    const deleteMessage = modal.querySelector('#delete-message');
    const deleteFeedback = modal.querySelector('#delete-feedback');
    const deleteActions = modal.querySelector('#delete-actions');

    let currentEncodedId = null;
    let currentRow = null;
    let hideTimeout;
    let successCallback = null;
    let currentExtraData = {}; // Storage for the optional data

    // --- showModal and hideModal functions ---
    // FIXED: Added extraData = {} to the parameter list
    const showModal = (encodedId, rowElement, onSuccess, extraData = {}) => {
        clearTimeout(hideTimeout);
        currentEncodedId = encodedId;
        currentRow = rowElement;
        successCallback = typeof onSuccess === 'function' ? onSuccess : null;
        currentExtraData = extraData; // Now extraData is defined!

        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Yes, Delete';
        deleteFeedback.classList.add('hidden');
        deleteActions.classList.remove('hidden');

        deleteMessage.textContent = `Are you sure you want to permanently delete this ${resourceName}? This action cannot be undone.`;

        setTimeout(() => {
            modal.classList.add('opacity-100', 'pointer-events-auto');
            modal.querySelector('.transform').classList.remove('translate-y-4', 'opacity-0');
        }, 10);
    };

    const hideModal = () => {
        modal.classList.remove('opacity-100', 'pointer-events-auto');
        modal.querySelector('.transform').classList.add('translate-y-4', 'opacity-0');
        currentEncodedId = null;
        currentRow = null;
        successCallback = null;
        currentExtraData = {}; 
    };

    // --- handleConfirm function ---
    const handleConfirm = async () => {
        if (!currentEncodedId || !currentRow) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';
        deleteActions.classList.add('hidden');

        try {
            const res = await fetch(`${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    _method: 'DELETE',
                    id: currentEncodedId,
                    ...currentExtraData // Safely merges extra data if present
                })
            });

            const result = await res.json();
            const success = result.success && res.ok;

            deleteFeedback.classList.remove(
                'hidden',
                'bg-green-100',
                'text-green-800',
                'bg-red-100',
                'text-red-800'
            );

            deleteFeedback.textContent = Array.isArray(result.messages)
                ? result.messages.join(' ')
                : result.message || (success ? `${resourceName} deleted successfully!` : `Failed to delete ${resourceName}.`);

            deleteFeedback.classList.remove('hidden');
            deleteFeedback.classList.add(
                success ? 'bg-green-100' : 'bg-red-100',
                success ? 'text-green-800' : 'text-red-800'
            );

            if (success) {
                currentRow.style.opacity = '0';
                    currentRow.style.transition = 'opacity 0.3s ease';
                    setTimeout(() => {
                        currentRow.remove();
                        if (typeof successCallback === 'function') {
                            try { 
                                // Pass the whole 'result' object instead of just 'true'
                                successCallback(result); 
                            } catch (cbErr) { 
                                console.error('delete onSuccess callback error', cbErr); 
                            }
                        }
                    }, 300);

                    hideTimeout = setTimeout(hideModal, 1000);
            } else {
                if (typeof successCallback === 'function') {
                    try { 
                        // Pass the whole 'result' object (which likely has error messages)
                        successCallback(result); 
                    } catch (cbErr) { 
                        console.error('delete onSuccess callback error', cbErr); 
                    }
                }
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Yes, Delete';
                deleteActions.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Delete API error:', error);
            deleteFeedback.textContent = 'A network error occurred. Please try again.';
            deleteFeedback.classList.remove('hidden');
            deleteFeedback.classList.add('bg-red-100', 'text-red-800');

            if (typeof successCallback === 'function') {
                try { successCallback(false); } catch (cbErr) { console.error('delete onSuccess callback error', cbErr); }
            }

            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Yes, Delete';
            deleteActions.classList.remove('hidden');
        }
    };

    // --- SPA-Safe Event Binding ---
    cancelBtn.removeEventListener('click', hideModal);
    confirmBtn.removeEventListener('click', handleConfirm);
    
    cancelBtn.addEventListener('click', hideModal);
    confirmBtn.addEventListener('click', handleConfirm);

    return {
        showConfirmation: showModal,
        hideConfirmation: hideModal
    };
}