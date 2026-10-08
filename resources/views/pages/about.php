<?php
// /resources/views/pages/about.php
//
// About — the suite itself: what each app does, how they fit together, and
// what's live versus coming next. All app data comes from
// Src\Config\AppsCatalog (shared with the home page and dashboard), so this
// page updates itself as apps go live.

declare(strict_types=1);

/** @var bool $isLoggedIn */
/** @var string $baseUrl */

use Src\Config\AppsCatalog;

$apps = AppsCatalog::apps();
$categories = AppsCatalog::categories();
$accent = AppsCatalog::accentClasses();
$byName = array_column($apps, null, 'name');

$live = array_values(array_filter($apps, fn($a) => $a['live']));
$liveCount = count($live);
$comingSoon = AppsCatalog::comingSoon();
$total = count($apps);
$progress = $total ? (int) round($liveCount / $total * 100) : 0;

$pillars = [
    [
        'title' => 'One sign-in for everything',
        'text' => 'A single account opens every app you have access to — no separate logins, no juggling.',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />',
    ],
    [
        'title' => 'Everything connected',
        'text' => 'Your profile, messages, and activity history follow you from app to app, so the suite feels like one place.',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />',
    ],
    [
        'title' => 'Private where it matters',
        'text' => 'Each person only sees the apps they’ve been given, and admin tools stay with the admins.',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />',
    ],
    [
        'title' => 'Built for every screen',
        'text' => 'Fast, instant page changes, a light and dark look, and a layout that works on a phone as well as a desktop.',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />',
    ],
];

$check = '<svg class="h-4 w-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>';

// Hero photo: the admin-uploaded one (public/images/uploads/about/), else the
// first home-page photo, else the navy gradient. See Src\Utils\AboutHero.
$heroPhoto = \Src\Utils\AboutHero::url($assetBase);
$heroIsCustom = \Src\Utils\AboutHero::customFile() !== null;
$canEditHero = \Src\Service\AuthService::isAdmin();
?>
<div class="space-y-8">

    <?php
    $breadcrumbs = [['label' => 'About']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <!-- Hero -->
    <section id="about-hero" class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-600 via-secondary-800 to-secondary-900 text-white shadow-sm">
        <!-- Photo, with a navy wash that's strongest behind the text. Always
             rendered (hidden when there's no photo) so an admin's upload can
             swap it in without a reload. -->
        <div id="about-hero-photo" class="<?= $heroPhoto ? '' : 'hidden' ?>">
            <img id="about-hero-img" src="<?= htmlspecialchars((string) $heroPhoto) ?>" alt="" aria-hidden="true" class="absolute inset-0 h-full w-full object-cover">
            <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/95 via-secondary-900/80 to-secondary-900/30"></div>
            <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-t from-secondary-950/50 to-transparent"></div>
        </div>
        <?php if (!$heroPhoto): ?>
            <div aria-hidden="true" class="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary-500/25 blur-3xl"></div>
            <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl"></div>
        <?php endif; ?>

        <div class="relative grid grid-cols-1 lg:grid-cols-5 gap-8 p-6 sm:p-10">
            <div class="lg:col-span-3">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300">About <?= htmlspecialchars($appName) ?></p>
                <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight leading-tight">A family of small, focused apps that work as one.</h1>
                <p class="mt-4 text-base text-secondary-100 max-w-xl">Each app does one job well — and they all share one account, one profile, and one place to find everything.</p>
                <?php if ($canEditHero): ?>
                    <!-- Admin: change / reset the hero photo (in flow, so it never overlaps) -->
                    <div class="mt-6 flex flex-wrap items-center gap-2">
                        <button type="button" id="about-hero-reset" title="Go back to the default photo"
                            class="<?= $heroIsCustom ? '' : 'hidden' ?> inline-flex items-center gap-1.5 rounded-lg bg-black/30 hover:bg-black/45 backdrop-blur-md ring-1 ring-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                            Reset
                        </button>
                        <button type="button" id="about-hero-change"
                            class="inline-flex items-center gap-1.5 rounded-lg bg-black/30 hover:bg-black/45 backdrop-blur-md ring-1 ring-white/20 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            Change photo
                        </button>
                    </div>
                <?php endif; ?>
            </div>
            <div class="lg:col-span-2 grid grid-cols-3 lg:grid-cols-1 gap-3 content-center">
                <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-lg shadow-black/10 px-5 py-4">
                    <span class="block text-3xl font-bold leading-none"><?= $total ?></span>
                    <span class="block text-xs font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">Apps in the suite</span>
                </div>
                <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-lg shadow-black/10 px-5 py-4">
                    <span class="block text-3xl font-bold leading-none"><?= $liveCount ?></span>
                    <span class="block text-xs font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">Live now</span>
                </div>
                <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/20 shadow-lg shadow-black/10 px-5 py-4">
                    <span class="block text-3xl font-bold leading-none"><?= count($categories) ?></span>
                    <span class="block text-xs font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">Parts of your day</span>
                </div>
            </div>
        </div>
    </section>

    <!-- The suite -->
    <section class="space-y-6">
        <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">The suite</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Every app, grouped by the part of life it looks after.</p>
        </div>

        <?php foreach ($categories as $category): ?>
            <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-5 sm:p-6">
                <div class="flex items-start gap-4">
                    <div class="h-11 w-11 flex-shrink-0 rounded-xl flex items-center justify-center <?= $accent[$category['accent']] ?? '' ?>">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><?= $category['icon'] ?></svg>
                    </div>
                    <div class="min-w-0">
                        <h3 class="text-base font-bold text-gray-900 dark:text-white"><?= htmlspecialchars($category['name']) ?></h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400"><?= htmlspecialchars($category['text']) ?></p>
                    </div>
                </div>

                <div class="mt-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <?php foreach ($category['apps'] as $catApp): ?>
                        <?php $app = $byName[$catApp];
                        $isLink = $app['live'] && !empty($app['slug']); ?>
                        <<?= $isLink ? 'a href="' . $baseUrl . $app['slug'] . '" data-partial' : 'div' ?>
                            class="group flex flex-col rounded-xl border p-4 transition-all <?= $app['live'] ? 'border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-800 hover:shadow-md' : 'border-dashed border-gray-300 dark:border-gray-700' ?>">
                            <div class="flex items-center justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0">
                                    <span class="h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center <?= $app['live'] ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500' ?>">
                                        <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><?= $app['icon'] ?></svg>
                                    </span>
                                    <span class="text-sm font-bold text-gray-900 dark:text-white truncate <?= $isLink ? 'group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors' : '' ?>"><?= htmlspecialchars($app['name']) ?></span>
                                </div>
                                <?php if ($app['live']): ?>
                                    <span class="flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Live
                                    </span>
                                <?php else: ?>
                                    <span class="flex-shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Coming soon</span>
                                <?php endif; ?>
                            </div>
                            <p class="mt-3 text-sm text-gray-600 dark:text-gray-300"><?= htmlspecialchars($app['text']) ?></p>
                            <ul class="mt-3 space-y-1.5 flex-1">
                                <?php foreach ($app['highlights'] as $h): ?>
                                    <li class="flex items-start gap-2 text-xs <?= $app['live'] ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500' ?>">
                                        <span class="<?= $app['live'] ? 'text-primary-500' : 'text-gray-300 dark:text-gray-600' ?>"><?= $check ?></span><?= htmlspecialchars($h) ?>
                                    </li>
                                <?php endforeach; ?>
                            </ul>
                            <?php if ($isLink): ?>
                                <span class="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400">
                                    Open <?= htmlspecialchars($app['name']) ?>
                                    <svg class="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </span>
                            <?php endif; ?>
                        </<?= $isLink ? 'a' : 'div' ?>>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endforeach; ?>
    </section>

    <!-- Built to work together -->
    <section>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Built to work together</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Why one suite beats a drawer full of separate apps.</p>
        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <?php foreach ($pillars as $p): ?>
                <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-5">
                    <div class="h-10 w-10 rounded-xl flex items-center justify-center bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><?= $p['icon'] ?></svg>
                    </div>
                    <h3 class="mt-4 text-sm font-bold text-gray-900 dark:text-white"><?= htmlspecialchars($p['title']) ?></h3>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400"><?= htmlspecialchars($p['text']) ?></p>
                </div>
            <?php endforeach; ?>
        </div>
    </section>

    <!-- Rebuild progress -->
    <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-5 sm:p-6">
        <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">Growing, app by app</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">New apps join the suite one at a time — each goes live here the moment it’s ready.</p>
            </div>
            <p class="text-sm font-semibold text-gray-900 dark:text-white"><?= $liveCount ?> of <?= $total ?> live</p>
        </div>
        <div class="mt-4 h-2.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?= $progress ?>" aria-label="Apps rebuilt">
            <div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600" style="width: <?= $progress ?>%"></div>
        </div>
        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Live now</p>
                <div class="flex flex-wrap gap-2">
                    <?php foreach ($live as $a): ?>
                        <a href="<?= $baseUrl . $a['slug'] ?>" data-partial class="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors">
                            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span><?= htmlspecialchars($a['name']) ?>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
            <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Coming next</p>
                <div class="flex flex-wrap gap-2">
                    <?php if (!$comingSoon): ?>
                        <span class="text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">More on the way</span>
                    <?php endif; ?>
                    <?php foreach ($comingSoon as $name): ?>
                        <span class="text-sm font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><?= htmlspecialchars($name) ?></span>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </section>

    <!-- Closing -->
    <section class="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center bg-secondary-900 border border-secondary-800">
        <div aria-hidden="true" class="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-56 w-[28rem] rounded-full bg-primary-500/20 blur-3xl"></div>
        <div class="relative max-w-xl mx-auto">
            <h2 class="text-2xl sm:text-3xl font-bold text-white">Ready when you are</h2>
            <p class="mt-3 text-sm text-secondary-200">
                <?= $isLoggedIn
                    ? 'Jump back into your apps from the dashboard.'
                    : 'Accounts are created by an administrator. Sign in to get started, or get in touch to ask for access.' ?>
            </p>
            <div class="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <?php if ($isLoggedIn): ?>
                    <a href="<?= $baseUrl ?>dashboard" data-partial class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-500/30 transition-colors">Go to dashboard</a>
                <?php else: ?>
                    <a href="<?= $baseUrl ?>login" data-login-button class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-500/30 transition-colors">Sign in</a>
                <?php endif; ?>
                <a href="<?= $baseUrl ?>contact" data-partial class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/20 transition-colors">Contact us</a>
            </div>
        </div>
    </section>
</div>
