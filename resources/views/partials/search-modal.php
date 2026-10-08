<?php
// /resources/views/partials/search-modal.php

use Src\Config\NavigationConfig;

if (!class_exists(NavigationConfig::class)) {
    return;
}

$isLoggedIn = isset($_SESSION['user_id']);
$navIcons = NavigationConfig::getIcons();

/**
 * The client requested a focus on People. 
 */
$label = 'People';
$icon = $navIcons['Users'] ?? $navIcons['Dashboard'];
$icon = str_replace('class="h-6 w-6"', 'class="w-4 h-4"', $icon);
?>

<div id="search-modal" class="fixed inset-0 z-[100] hidden overflow-y-auto" role="dialog" aria-modal="true">
    <div class="fixed inset-0 bg-secondary-900/40 backdrop-blur-md transition-opacity"></div>

    <div class="flex min-h-full items-start justify-center p-4 sm:p-6 lg:p-20">
        <div class="relative w-full max-w-3xl transform overflow-hidden rounded-[2.5rem] bg-white dark:bg-gray-900 p-8 shadow-2xl transition-all border border-gray-200 dark:border-gray-800">

            <div class="flex flex-wrap gap-3 mb-6 <?= !$isLoggedIn ? 'opacity-50 pointer-events-none' : '' ?>">
                <button data-category="users"
                    class="search-cat-btn flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all bg-primary-400 text-white shadow-lg shadow-primary-400/20">
                    <span class="opacity-70"><?= $icon ?></span>
                    <?= $label ?>
                </button>
            </div>

            <div class="relative group">
                <div class="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none">
                    <svg class="w-6 h-6 text-gray-400 group-focus-within:text-primary-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>
                </div>
                <input type="text" id="global-search-input"
                    <?= !$isLoggedIn ? 'disabled' : '' ?>
                    placeholder="<?= !$isLoggedIn ? 'Search is disabled...' : 'Search for people by name or location...' ?>"
                    class="block w-full py-5 pl-14 pr-6 text-lg font-medium text-secondary-900 bg-gray-50 dark:bg-secondary-800/50 border-2 border-transparent <?= $isLoggedIn ? 'focus:border-primary-400 focus:bg-white' : 'cursor-not-allowed opacity-60' ?> dark:focus:bg-secondary-800 rounded-2xl outline-none transition-all dark:text-white"
                    autocomplete="off">
            </div>

            <div id="search-results" class="mt-8 min-h-[200px]">
                <?php if ($isLoggedIn): ?>
                    <div class="flex flex-col items-center justify-center py-10 text-gray-400">
                        <svg class="w-12 h-12 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607Z" />
                        </svg>
                        <p class="text-xs font-bold uppercase tracking-widest">Type a name to begin...</p>
                    </div>
                <?php endif; ?>
            </div>

            <div class="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <span class="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Press <kbd class="font-sans">ESC</kbd> to close</span>
                <button id="close-search" class="text-[11px] font-black uppercase tracking-widest text-secondary-900 dark:text-white hover:text-primary-400 transition-colors">Close Search</button>
            </div>
        </div>
    </div>
</div>