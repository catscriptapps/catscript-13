<?php
// /resources/views/partials/real-estate-world-header.php

declare(strict_types=1);

/**
 * CatScript Apps - Core Dynamic Topbar
 */
?>
<header class="h-20 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-40 transition-colors duration-300">

    <!-- Structural Controls (Responsive Open/Close triggers) -->
    <div class="flex items-center space-x-4">
        <!-- Desktop Quick Expand -->
        <button
            @click="$store.sidebar.expanded = !$store.sidebar.expanded"
            class="hidden lg:block text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>

        <!-- Mobile Menu Toggle -->
        <button
            @click="mobileMenuOpen = !mobileMenuOpen"
            class="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
            aria-label="Toggle Menu">
            <svg x-show="!mobileMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <svg x-show="mobileMenuOpen" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" x-cloak>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        <!-- Target System Context Heading -->
        <div class="hidden sm:flex items-center gap-2">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            </div>
            <span class="text-sm font-semibold text-gray-500 dark:text-gray-400">
                Your Everyday App Suite
            </span>
        </div>
    </div>

    <!-- Profile Actions, Dark Mode Switcher Infrastructure -->
    <div class="flex items-center space-x-1 sm:space-x-4 min-w-0">

        <!-- Dark Mode Toggle Trigger Component -->
        <button
            @click="$store.theme.toggle()"
            class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none"
            aria-label="Toggle Dark Mode">
            <!-- Light icon -->
            <svg x-show="!$store.theme.isDark" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.344l-.707.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
            </svg>
            <!-- Dark icon -->
            <svg x-show="$store.theme.isDark" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" x-cloak>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
        </button>

        <!-- Messages: the contact-form inbox, with its unread badge (admin only — ui/unread-handler.js) -->
        <?php if ($isLoggedIn && \Src\Service\AuthService::isAdmin()): ?>
            <?php $headerUnread = \Src\Controller\MessagesController::unreadCount(); ?>
            <a href="<?= $baseUrl ?>messages" data-partial title="Messages" aria-label="Messages"
                class="relative p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                <span data-messages-badge class="<?= $headerUnread ? '' : 'hidden ' ?>absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-white dark:ring-gray-900"><?= $headerUnread ? ($headerUnread > 99 ? '99+' : $headerUnread) : '' ?></span>
            </a>
        <?php endif; ?>

        <!-- Settings (admin only) -->
        <?php if ($isLoggedIn && \Src\Service\AuthService::isAdmin()): ?>
            <a href="<?= $baseUrl ?>settings" data-partial title="Settings"
                class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a7.75 7.75 0 0 1 0 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 0 1 0-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281Z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
            </a>
        <?php endif; ?>

        <!-- Admin Dashboard (admin only) -->
        <?php if ($isLoggedIn && \Src\Service\AuthService::isAdmin()): ?>
            <a href="<?= $baseUrl ?>admin" data-partial title="Admin Dashboard"
                class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
                </svg>
            </a>
        <?php endif; ?>

        <!-- DB Reset Trigger (user #1 only) -->
        <?php if ($isLoggedIn && \Src\Service\AuthService::isCat()): ?>
            <button data-reset-button data-tooltip="DB Reset" title="DB Reset (apply database updates)"
                class="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 dark:hover:text-red-400 transition-all focus:outline-none">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="h-5 w-5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        <?php endif; ?>

        <div class="hidden sm:block h-6 w-px bg-gray-200 dark:bg-gray-800"></div>

        <!-- Account Meta Details -->
        <?php $accountInfo = \Src\Config\NavigationConfig::getUserDisplayInfo(); ?>
        <?php if ($isLoggedIn): ?>
            <a href="#" data-logout-button class="flex items-center space-x-3 group cursor-pointer">
                <div id="header-account-avatar" data-initial="<?= htmlspecialchars($accountInfo['initial']) ?>" data-accent-class="bg-primary-600" class="w-8 h-8 rounded-full <?= empty($accountInfo['avatarUrl']) ? 'bg-primary-600' : '' ?> text-white font-bold flex items-center justify-center text-sm shadow-sm overflow-hidden">
                    <?php if (!empty($accountInfo['avatarUrl'])): ?>
                        <img src="<?= $assetBase . 'images/uploads/avatars/' . htmlspecialchars($accountInfo['avatarUrl']) ?>" alt="Avatar" class="w-full h-full object-cover">
                    <?php else: ?>
                        <?= htmlspecialchars($accountInfo['initial']) ?>
                    <?php endif; ?>
                </div>
                <div class="hidden md:flex flex-col leading-tight">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"><?= htmlspecialchars($accountInfo['displayName']) ?></span>
                    <span class="text-xs text-gray-400 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors">Sign Out</span>
                </div>
            </a>
        <?php else: ?>
            <a href="<?= $baseUrl ?>login" data-login-button class="flex items-center space-x-3 group cursor-pointer">
                <div class="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold flex items-center justify-center text-sm shadow-sm">
                    G
                </div>
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 hidden md:block transition-colors">Sign In</span>
            </a>
        <?php endif; ?>
    </div>
</header>
