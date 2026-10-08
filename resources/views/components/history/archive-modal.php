<?php
// /resources/views/components/history/archive-modal.php
?>

<div id="archive-modal" class="fixed inset-0 z-50 hidden">
    <div class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"></div>
    <div class="flex items-center justify-center min-h-screen p-4">
        <div class="bg-white dark:bg-gray-900 rounded-2xl max-w-sm w-full shadow-2xl transform transition-all border border-gray-200 dark:border-gray-800">
            <div class="p-6 text-center">
                <div class="w-16 h-16 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                </div>
                <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2 font-sans">Archive Record?</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 font-sans">This activity will be moved to the audit archives and hidden from this view.</p>
            </div>
            <div class="flex border-t border-gray-100 dark:border-gray-800">
                <button id="cancel-archive" class="flex-1 px-4 py-4 text-sm font-bold text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors uppercase tracking-widest">Cancel</button>
                <button id="confirm-archive" class="flex-1 px-4 py-4 text-sm font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors border-l border-gray-100 dark:border-gray-800 uppercase tracking-widest">Archive</button>
            </div>
        </div>
    </div>
</div>