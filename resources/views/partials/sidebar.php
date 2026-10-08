<?php
// /resources/views/partials/sidebar.php

declare(strict_types=1);

/**
 * CatScript Apps - Left Navigation Sidebar
 *
 * A deep-navy panel with the brand's orange as its light source: grouped
 * sections, glowing active item (styled via .sidebar-link in app.css and
 * kept in sync on SPA navigation by utils/spa-router.js), live badges, and
 * a personal card at the bottom.
 *
 * Nav items come straight from NavigationConfig::getNavLinks() — the public
 * links for guests, the permission-filtered app links once signed in — so a
 * rebuilt CatScript app only needs registering there to show up here.
 *
 * Badges: #messages-badge is filled by ui/unread-handler.js (polls
 * api/global-unread); #tasks-nav-badge (due today) is rendered here and
 * refreshed by pages/tasks-page.js after each change.
 */

use Src\Config\NavigationConfig;
use Src\Service\AuthService;

// Set by layouts/app.php before it includes this partial
/** @var string $baseUrl */
/** @var string $assetBase */
/** @var string|null $path */
/** @var bool $isLoggedIn */

$signedIn = (bool) ($isLoggedIn ?? false);
$navLinks = NavigationConfig::getNavLinks($signedIn);
$navIcons = NavigationConfig::getIcons();

// NavigationConfig URLs already carry APP_BASE_PATH, so compare against the
// base-prefixed request path rather than the normalized $path.
$currentFullPath = ($_ENV['APP_BASE_PATH'] ?? '') . ($path ?? '');

// Grouped the same way as the dashboard (NavigationConfig::sections()):
// Workspace / Business / Community / Account (members) or Help (guests).
// A section also lists apps still being built (NavigationConfig::UPCOMING) as "Soon".
$sections = NavigationConfig::sections($signedIn);
$upcoming = $signedIn ? NavigationConfig::upcoming() : [];

// Apps a guest can try in the browser (AppsCatalog demo => true)
$guestDemos = $signedIn ? [] : array_column(array_filter(\Src\Config\AppsCatalog::apps(), fn($a) => !empty($a['demo'])), 'name');

// Tasks due today (badge)
$tasksDueToday = 0;
if ($signedIn && isset($navLinks['Tasks'])) {
    try {
        $tasksDueToday = \App\Models\Task::whereDate('due_date', date('Y-m-d'))->count();
    } catch (\Throwable $e) {
        $tasksDueToday = 0;
    }
}

// Personal card
$me = $signedIn ? AuthService::currentUser() : null;
$meName = $me->full_name ?? '';
$meFirst = $me?->first_name ?: 'there';
$meAvatar = !empty($me?->avatar_url) ? $assetBase . 'images/uploads/avatars/' . $me->avatar_url : null;
$meRole = $signedIn && AuthService::isAdmin() ? 'Admin' : 'Member';
$hour = (int) date('G');
$greeting = $hour < 12 ? 'Good morning' : ($hour < 17 ? 'Good afternoon' : 'Good evening');
$profileUrl = ($_ENV['APP_BASE_PATH'] ?? '') . '/profile';
?>
<aside
    class="fixed inset-y-0 left-0 z-50 flex flex-col w-64 overflow-hidden bg-gradient-to-b from-secondary-800 via-secondary-900 to-secondary-950 text-white border-r border-white/5 shadow-2xl shadow-secondary-950/30 transition-all duration-300 ease-in-out"
    :class="[$store.sidebar.expanded ? 'lg:w-64' : 'lg:w-24', mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0']"
    @click="if ($event.target.closest('a')) mobileMenuOpen = false"
    x-cloak>
    <?php /* On phones, tapping any link in here (menu items, the profile card,
             sign in) closes the slide-out menu — SPA navigation doesn't reload
             the page, so nothing else would. A no-op on desktop. */ ?>

    <!-- Atmosphere: orange glow + faint dot grid (purely decorative) -->
    <div aria-hidden="true" class="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-primary-500/25 blur-3xl"></div>
    <div aria-hidden="true" class="pointer-events-none absolute bottom-10 -left-24 h-56 w-56 rounded-full bg-primary-600/10 blur-3xl"></div>
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-[0.07]"
        style="background-image: radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px); background-size: 18px 18px; mask-image: linear-gradient(to bottom, black, transparent 70%); -webkit-mask-image: linear-gradient(to bottom, black, transparent 70%);"></div>

    <!-- Brand -->
    <div class="relative flex items-center justify-center px-5 h-20 flex-shrink-0">
        <a href="<?= $baseUrl ?>" data-partial class="flex items-center justify-center" aria-label="CatScript Apps home">
            <img x-show="$store.sidebar.expanded || mobileMenuOpen" src="<?= $assetBase ?>images/logo/logo-dark.jpg" alt="CatScript Apps" class="h-11 w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]" />
            <span x-show="!$store.sidebar.expanded && !mobileMenuOpen" x-cloak
                class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 shadow-lg shadow-primary-500/20">
                <img src="<?= $assetBase ?>images/logo/favicon.ico" alt="CatScript Apps" class="h-8 w-8 object-contain" />
            </span>
        </a>

        <button @click="mobileMenuOpen = false" class="lg:hidden absolute right-4 p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 focus:outline-none" aria-label="Close menu">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
    </div>

    <!-- Navigation -->
    <nav class="relative flex-1 px-4 pt-2 pb-4 overflow-y-auto overflow-x-hidden custom-scrollbar sidebar-scroll" data-nav-accent="primary" aria-label="Main">
        <?php foreach ($sections as $sectionName => $links): ?>
            <div class="mb-5 last:mb-0">
                <p x-show="$store.sidebar.expanded || mobileMenuOpen"
                    class="px-3 mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35"><?= htmlspecialchars($sectionName) ?></p>
                <div x-show="!$store.sidebar.expanded && !mobileMenuOpen" x-cloak class="mx-auto mb-2 h-px w-8 bg-white/10"></div>

                <div class="space-y-1">
                    <?php foreach ($links as $name => $link): ?>
                        <?php
                        $isActive = $currentFullPath === $link['url'];
                        $badge = in_array($name, $guestDemos, true)
                            ? '<span class="sidebar-try-tag" title="Try it in your browser — no account needed">Try</span>'
                            : match ($name) {
                            'Tasks' => $tasksDueToday > 0
                                ? '<span id="tasks-nav-badge" class="sidebar-badge">' . $tasksDueToday . '</span>'
                                : '<span id="tasks-nav-badge" class="sidebar-badge hidden"></span>',
                            'Messages' => '<span id="messages-badge" class="sidebar-badge hidden"></span>',
                            default => '',
                        };
                        ?>
                        <a href="<?= htmlspecialchars($link['url']) ?>" data-partial title="<?= htmlspecialchars($name) ?>"
                            class="sidebar-link <?= $isActive ? 'is-active' : '' ?>"
                            :class="!$store.sidebar.expanded && !mobileMenuOpen ? 'lg:justify-center' : ''"
                            <?= $isActive ? 'aria-current="page"' : '' ?>>
                            <span class="sidebar-icon"><?= $navIcons[$name] ?? '' ?></span>
                            <span x-show="$store.sidebar.expanded || mobileMenuOpen" class="flex-1 truncate text-sm"><?= htmlspecialchars($name) ?></span>
                            <?php if ($badge): ?>
                                <span class="sidebar-badge-slot" :class="!$store.sidebar.expanded && !mobileMenuOpen ? 'is-collapsed' : ''"><?= $badge ?></span>
                            <?php endif; ?>
                        </a>
                    <?php endforeach; ?>

                    <?php foreach ($upcoming[$sectionName] ?? [] as $name): ?>
                        <!-- Being built — shown so the section's shape is clear, not clickable -->
                        <div title="<?= htmlspecialchars($name) ?> — coming soon" aria-disabled="true"
                            class="sidebar-link opacity-50 cursor-default hover:bg-transparent"
                            :class="!$store.sidebar.expanded && !mobileMenuOpen ? 'lg:justify-center' : ''">
                            <span class="sidebar-icon"><?= $navIcons[$name] ?? '' ?></span>
                            <span x-show="$store.sidebar.expanded || mobileMenuOpen" class="flex-1 truncate text-sm"><?= htmlspecialchars($name) ?></span>
                            <span x-show="$store.sidebar.expanded || mobileMenuOpen" class="sidebar-try-tag">Soon</span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </nav>

    <!-- Personal card -->
    <div class="relative flex-shrink-0 p-3 border-t border-white/10">
        <?php if ($me): ?>
            <a href="<?= htmlspecialchars($profileUrl) ?>" data-partial title="Your profile"
                class="group flex items-center gap-3 rounded-2xl p-2.5 bg-white/5 hover:bg-white/10 ring-1 ring-white/10 transition-colors"
                :class="!$store.sidebar.expanded && !mobileMenuOpen ? 'lg:justify-center lg:bg-transparent lg:ring-0' : ''">
                <span class="relative flex-shrink-0">
                    <?php if ($meAvatar): ?>
                        <img src="<?= htmlspecialchars($meAvatar) ?>" alt="" class="h-10 w-10 rounded-xl object-cover ring-2 ring-primary-500/60">
                    <?php else: ?>
                        <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold ring-2 ring-primary-500/40"><?= htmlspecialchars(strtoupper(substr($meFirst, 0, 1))) ?></span>
                    <?php endif; ?>
                    <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-secondary-900" title="Online"></span>
                </span>
                <span x-show="$store.sidebar.expanded || mobileMenuOpen" class="min-w-0 flex-1">
                    <span class="block text-[11px] text-white/50 truncate"><?= $greeting ?>,</span>
                    <span class="block text-sm font-semibold truncate group-hover:text-primary-300 transition-colors"><?= htmlspecialchars($meFirst) ?></span>
                </span>
                <span x-show="$store.sidebar.expanded || mobileMenuOpen"
                    class="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md <?= $meRole === 'Admin' ? 'bg-primary-500/20 text-primary-300' : 'bg-white/10 text-white/60' ?>"><?= $meRole ?></span>
            </a>
        <?php else: ?>
            <div x-show="$store.sidebar.expanded || mobileMenuOpen" class="rounded-2xl p-4 bg-gradient-to-br from-primary-500/25 to-primary-600/5 ring-1 ring-primary-400/25">
                <p class="text-sm font-bold">Welcome to CatScript</p>
                <p class="text-xs text-white/60 mt-0.5 mb-3">Your everyday app suite, one sign-in away.</p>
                <a href="<?= $baseUrl ?>login" data-login-button
                    class="flex items-center justify-center gap-2 w-full rounded-xl bg-primary-500 hover:bg-primary-400 py-2 text-sm font-semibold shadow-lg shadow-primary-500/30 transition-colors">
                    Sign in
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </a>
            </div>
            <a href="<?= $baseUrl ?>login" data-login-button x-show="!$store.sidebar.expanded && !mobileMenuOpen" x-cloak title="Sign in"
                class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500 hover:bg-primary-400 shadow-lg shadow-primary-500/30 transition-colors">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            </a>
        <?php endif; ?>

        <!-- Collapse toggle (desktop only) -->
        <button type="button"
            @click="$store.sidebar.expanded = !$store.sidebar.expanded"
            class="hidden lg:flex mt-2 w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-white/45 hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
            :class="!$store.sidebar.expanded ? 'justify-center' : ''"
            :aria-label="$store.sidebar.expanded ? 'Collapse sidebar' : 'Expand sidebar'">
            <svg class="h-4 w-4 transform transition-transform duration-300" :class="!$store.sidebar.expanded && 'rotate-180'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            <span x-show="$store.sidebar.expanded">Collapse</span>
        </button>
    </div>
</aside>
