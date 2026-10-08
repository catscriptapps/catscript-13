<?php
// /resources/views/components/social-feed/sidebar.php

$currentUser = \Src\Service\AuthService::currentUser();
$currentUserName = $currentUser->full_name ?? 'User';
$currentUserInitials = strtoupper(substr($currentUserName, 0, 1));
$currentUserAvatar = $currentUser->avatar_url ?? null;
$currentUsername = $currentUser
    ? strtolower(str_replace(' ', '', $currentUserName)) . $currentUser->id
    : 'user';
$assetBase = getAssetBase();
?>

<!-- Sticky below the 80px (h-20) header and capped to the viewport height.
     The profile card and people search stay fixed; only the "Who to follow"
     list scrolls, taking whatever height is left. -->
<aside class="hidden lg:flex lg:flex-col lg:col-span-4 sticky top-24 self-start max-h-[calc(100vh-7rem)] gap-6">

    <div class="flex-shrink-0 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div class="h-8 bg-gradient-to-r from-secondary-500 to-secondary-900"></div>
        <div class="px-4 pb-3">
            <!-- Compact: photo beside the name, counts on one line below. -->
            <div class="flex items-start gap-3">
                <?php if ($currentUserAvatar): ?>
                    <img src="<?= $assetBase ?>images/uploads/avatars/<?= $currentUserAvatar ?>"
                        class="-mt-5 h-12 w-12 flex-shrink-0 rounded-xl border-4 border-white dark:border-gray-900 object-cover shadow-sm">
                <?php else: ?>
                    <div class="-mt-5 h-12 w-12 flex-shrink-0 rounded-xl border-4 border-white dark:border-gray-900 bg-secondary-600 flex items-center justify-center text-white text-lg font-bold shadow-sm">
                        <?= $currentUserInitials ?>
                    </div>
                <?php endif; ?>
                <div class="min-w-0 pt-1.5">
                    <h2 class="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                        <?= htmlspecialchars($currentUserName) ?>
                    </h2>
                    <p class="text-xs text-gray-500 truncate">@<?= htmlspecialchars($currentUsername) ?></p>
                </div>
            </div>

            <div class="flex items-center gap-5 border-t border-gray-100 dark:border-gray-800 mt-3 pt-2.5">
                <button type="button" data-follow-list-trigger="following" class="flex items-baseline gap-1.5 hover:opacity-70 transition-opacity">
                    <span id="following-count" class="text-sm font-bold text-gray-900 dark:text-white">0</span>
                    <span class="text-[11px] text-gray-500 uppercase tracking-wider font-sans">Following</span>
                </button>
                <button type="button" data-follow-list-trigger="followers" class="flex items-baseline gap-1.5 hover:opacity-70 transition-opacity">
                    <span id="followers-count" class="text-sm font-bold text-gray-900 dark:text-white">0</span>
                    <span class="text-[11px] text-gray-500 uppercase tracking-wider font-sans">Followers</span>
                </button>
            </div>
        </div>
    </div>

    <div class="relative group flex-shrink-0">
        <div class="relative flex items-center">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg class="h-5 w-5 text-gray-400 group-focus-within:text-secondary-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
            <input type="text"
                id="user-search-input"
                placeholder="SEARCH PEOPLE..."
                class="block w-full pl-11 pr-4 py-3 bg-white dark:bg-gray-900 border-2 border-transparent focus:border-secondary-500/50 rounded-2xl shadow-sm text-xs font-black tracking-widest uppercase text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 outline-none transition-all focus:ring-4 focus:ring-secondary-500/10"
                autocomplete="off">
        </div>

        <!-- Floats over the "Who to follow" card below it. -->
        <div id="search-results-dropdown"
            class="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 hidden transition-all">
            <div id="search-results-content" class="max-h-[300px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
            </div>
        </div>
    </div>

    <div class="flex flex-col min-h-0 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
        <h3 class="flex-shrink-0 font-bold text-gray-900 dark:text-white mb-4 flex items-center text-sm font-sans uppercase tracking-tight">
            <svg class="w-4 h-4 mr-2 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Who to follow
        </h3>

        <div id="suggested-follows" class="min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-4">
            <div class="animate-pulse space-y-4">
                <div class="flex items-center space-x-3">
                    <div class="rounded-full bg-gray-100 dark:bg-gray-800 h-10 w-10"></div>
                    <div class="flex-1 space-y-2 py-1">
                        <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded w-3/4"></div>
                        <div class="h-2 bg-gray-100 dark:bg-gray-800 rounded w-1/2"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="flex-shrink-0 px-4 text-[12px] text-gray-400 uppercase tracking-widest font-bold font-sans">
        © <?= date('Y') . ' • ' . ($appName ?? 'CatScript') ?> • Social Stack
    </div>
</aside>