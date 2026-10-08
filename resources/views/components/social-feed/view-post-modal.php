<?php
// /resources/views/components/social-feed/view-post-modal.php
?>

<div id="view-post-modal" class="fixed inset-0 z-50 hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
    <div class="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" id="close-post-modal-overlay"></div>

        <div class="inline-block transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl sm:align-middle border border-gray-200 dark:border-gray-800">

            <div id="view-post-media-container" class="hidden w-full bg-black flex justify-center border-b border-gray-200 dark:border-gray-800">
            </div>

            <div class="px-6 py-6">
                <div class="flex items-start justify-between mb-4">
                    <div class="flex items-center space-x-3">
                        <div id="view-post-avatar" class="h-10 w-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-lg shadow-sm overflow-hidden">
                        </div>
                        <div>
                            <h3 class="text-sm font-bold text-gray-900 dark:text-white font-sans" id="view-post-author"></h3>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5" id="view-post-time"></p>
                        </div>
                    </div>
                    <button type="button" class="close-post-modal text-gray-400 hover:text-gray-500 transition-colors">
                        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div id="view-post-content" class="text-base text-gray-800 dark:text-gray-200 leading-relaxed font-sans mb-6">
                </div>

                <hr class="border-gray-100 dark:border-gray-800 mb-4">

                <div>
                    <label class="block text-[11px] font-bold uppercase tracking-widest text-primary-600 mb-4">Comments</label>

                    <div id="view-post-comments-list" class="space-y-4 max-h-64 overflow-y-auto mb-6 pr-2 custom-scrollbar">
                    </div>

                    <div class="flex items-start space-x-3 mt-4">
                        <div class="flex-1 relative">
                            <textarea id="post-comment-input" rows="1"
                                class="block w-full rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 px-4 pr-12 text-sm placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 text-gray-900 dark:text-white transition-all resize-none"
                                placeholder="Write a comment..."></textarea>

                            <button type="button" id="comment-emoji-btn" class="absolute right-3 top-2 text-gray-400 hover:text-primary-500">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </button>
                        </div>
                        <button type="button" id="submit-comment-btn"
                            class="shrink-0 h-10 w-10 flex items-center justify-center rounded-xl bg-primary-600 text-white shadow-md hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-50">
                            <svg class="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-between items-center">
                <div id="view-post-stats" class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest flex space-x-4">
                    <span><span id="modal-likes-count">0</span> Likes</span>
                    <span><span id="modal-comments-count">0</span> Comments</span>
                </div>
                <div class="flex space-x-3">
                    <button type="button" class="close-post-modal rounded-xl px-4 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Close</button>
                </div>
            </div>
        </div>
    </div>
</div>