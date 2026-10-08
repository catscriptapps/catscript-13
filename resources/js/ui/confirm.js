// /resources/js/ui/confirm.js

/**
 * Custom Confirmation Dialog
 * @param {string} message - The body text
 * @param {string} confirmText - Label for the action button
 * @param {string} cancelText - Label for the close button
 * @param {string} confirmColor - Tailwind class for the confirm button color
 */
export function confirmDialog(
    message = "Are you sure?", 
    confirmText = "Confirm", 
    cancelText = "Cancel",
    confirmColor = "bg-navy-600 hover:bg-navy-700"
) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200';
        // Modals (factories/modal-factory.js) sit at the maximum z-index, so the
        // confirm matches it; appended to <body> last, it paints above them.
        overlay.style.zIndex = '2147483647';
        
        overlay.innerHTML = `
            <div class="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl transform animate-in zoom-in-95 duration-200">
                <div class="flex items-center gap-4 mb-4">
                    <div class="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-full text-primary-600 dark:text-primary-400">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                    </div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Confirm Action</h3>
                </div>
                <p class="text-gray-600 dark:text-gray-400 mb-6">${message}</p>
                <div class="flex justify-end gap-3">
                    <button id="confirm-cancel" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        ${cancelText}
                    </button>
                    <button id="confirm-proceed" class="px-4 py-2 text-sm font-medium text-white ${confirmColor} rounded-lg shadow-sm transition-colors">
                        ${confirmText}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const cleanup = (value) => {
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.remove();
                resolve(value);
            }, 150);
        };

        overlay.querySelector('#confirm-cancel').onclick = () => cleanup(false);
        overlay.querySelector('#confirm-proceed').onclick = () => cleanup(true);
        
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleEsc);
                cleanup(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
    });
}