<?php
// /resources/views/pages/home.php

declare(strict_types=1);

/**
 * CatScript Apps - Guest Home Page
 *
 * Hero banner, spotlight row, category cards, module grid with Live /
 * Coming Soon badges, closing CTA. The module list comes from
 * Src\Config\AppsCatalog — add your apps there (flip 'live' and give it a
 * 'slug' when one ships) and this page follows.
 *
 * @var bool $isLoggedIn
 * @var string $baseUrl
 * @var string $assetBase
 */

use Src\Config\AppsCatalog;
use Src\Utils\CuratedPhotos;

// Optional: drop numerically-named photos into public/images/home/ and the
// hero picks them up as a slideshow; with none, it falls back to a solid card.
$slideshowImages = CuratedPhotos::fromHomeFolder($assetBase);

// The suite (categories, apps, live flags) lives in one place — see
// Src\Config\AppsCatalog — shared with the About page and the dashboard.
$categories = AppsCatalog::categories();
$categoryAccentClasses = AppsCatalog::accentClasses();
$modules = AppsCatalog::apps();

$liveModules = array_values(array_filter($modules, fn($m) => $m['live']));
$liveCount = count($liveModules);
?>
<?php
// The home page's TV screensaver (home-page.js): the slideshow, clearly,
// with the logo, a big clock and the live apps featured one at a time.
$saver = [
    'slides'   => $slideshowImages,
    'captions' => CuratedPhotos::captions(),
    'logo'     => $assetBase . 'images/logo/logo-dark.jpg',
    'live'     => $liveCount,
    'apps'     => array_map(fn($m) => ['name' => $m['name'], 'text' => $m['text']], $liveModules),
];
?>
<div id="home-page" class="space-y-8" data-saver="<?= htmlspecialchars(json_encode($saver, JSON_UNESCAPED_UNICODE), ENT_QUOTES) ?>">

    <!-- Hero: photo slideshow under a navy wash — headline, one line, two buttons -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/85 via-secondary-900/60 to-secondary-900/15"></div>

        <div class="relative max-w-2xl p-6 sm:px-10 sm:py-12" data-aos="fade-up">
            <h1 class="text-3xl sm:text-4xl font-bold tracking-tight leading-[1.12] drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
                Every app you need,<br class="hidden sm:inline">
                <span class="text-primary-300">behind one sign-in</span>
            </h1>
            <p class="mt-3 text-base text-secondary-50 max-w-xl">One account, one dashboard, and a growing set of apps that work together.</p>

            <div class="mt-6 flex flex-col sm:flex-row gap-3">
                <?php if ($isLoggedIn): ?>
                    <a href="<?= $baseUrl ?>dashboard" data-partial class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-400 text-white font-bold text-sm shadow-lg shadow-primary-500/30 transition-colors">
                        Go to your dashboard
                    </a>
                <?php else: ?>
                    <a href="<?= $baseUrl ?>login" data-login-button class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-500 hover:bg-primary-400 text-white font-bold text-sm shadow-lg shadow-primary-500/30 transition-colors">
                        Sign in
                    </a>
                <?php endif; ?>
                <a href="#the-apps" data-scroll-to="the-apps" class="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/20 text-white font-bold text-sm transition-colors">
                    Explore the apps
                </a>
            </div>

        </div>

        <?php if (count($slideshowImages ?? []) > 1): ?>
            <!-- Slide indicators (filled by home-page.js) -->
            <div class="absolute bottom-4 right-5 flex gap-1.5" data-hero-dots aria-hidden="true">
                <?php foreach ($slideshowImages as $i => $_): ?>
                    <span class="h-1.5 rounded-full transition-all duration-500 <?= $i === 0 ? 'w-6 bg-white' : 'w-1.5 bg-white/40' ?>"></span>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>
    </section>

    <!-- Spotlight -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 relative overflow-hidden flex flex-col justify-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-sm" data-aos="fade-up">
            <div aria-hidden="true" class="pointer-events-none absolute -right-16 -bottom-16 h-48 w-48 rounded-full bg-primary-100/70 dark:bg-primary-900/20 blur-2xl"></div>
            <span class="relative text-xs font-semibold tracking-[0.2em] text-primary-600 dark:text-primary-400 uppercase mb-2">Built To Work Together</span>
            <h3 class="relative text-xl font-bold text-gray-900 dark:text-white">Small Apps, One Home</h3>
            <p class="relative text-sm text-gray-500 dark:text-gray-400 mt-2 max-w-2xl">Each app does one job well — and they all share your profile, messages, and activity history, so moving between them feels like one app.</p>
            <div class="relative mt-5 flex flex-wrap gap-2">
                <?php foreach (['One sign-in', 'Shared profile', 'Per-person access', 'Light & dark', 'Phone-friendly'] as $perk): ?>
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        <svg class="h-3.5 w-3.5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg><?= $perk ?>
                    </span>
                <?php endforeach; ?>
            </div>
        </div>
        <div class="relative overflow-hidden flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-50 via-white to-amber-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-950/30 border border-gray-200 dark:border-gray-800 shadow-sm p-6 h-44 lg:h-auto" data-aos="fade-up" data-aos-delay="100">
            <img src="<?= $assetBase ?>images/logo/logo-light.jpg" alt="<?= htmlspecialchars($appName) ?>" class="animate-float-soft max-h-24 w-auto block dark:hidden drop-shadow-lg" />
            <img src="<?= $assetBase ?>images/logo/logo-dark.jpg" alt="<?= htmlspecialchars($appName) ?>" class="animate-float-soft max-h-24 w-auto hidden dark:block drop-shadow-lg" />
        </div>
    </div>

    <!-- Categories -->
    <div>
        <div class="flex items-center justify-between mb-4" data-aos="fade-up">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">Built For Every Part Of Your Day</h3>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <?php foreach ($categories as $i => $category): ?>
                <div class="group relative overflow-hidden flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                    data-aos="fade-up" data-aos-delay="<?= $i * 80 ?>">
                    <div aria-hidden="true" class="absolute inset-x-0 top-0 h-1 opacity-70 group-hover:opacity-100 transition-opacity <?= $categoryAccentClasses[$category['accent']] ?>" style="background-color: currentColor"></div>
                    <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 <?= $categoryAccentClasses[$category['accent']] ?>">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><?= $category['icon'] ?></svg>
                    </div>
                    <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-1"><?= htmlspecialchars($category['name']) ?></h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 flex-1"><?= htmlspecialchars($category['text']) ?></p>
                    <div class="mt-4 flex flex-wrap gap-1.5">
                        <?php foreach ($category['apps'] as $catApp): ?>
                            <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><?= htmlspecialchars($catApp) ?></span>
                        <?php endforeach; ?>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- The Apps -->
    <div id="the-apps" class="scroll-mt-24">
        <div class="flex flex-wrap items-end justify-between gap-3 mb-4" data-aos="fade-up">
            <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white">The Apps</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Everything in the suite — new apps go live here as they land.</p>
            </div>
            <div class="flex items-center gap-3">
                <div class="hidden sm:block w-32 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="<?= (int) round($liveCount / max(1, count($modules)) * 100) ?>" aria-label="Apps live">
                    <div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600" style="width: <?= round($liveCount / max(1, count($modules)) * 100) ?>%"></div>
                </div>
                <span class="text-xs text-primary-700 bg-primary-50 dark:bg-primary-950/40 dark:text-primary-300 px-2 py-1 rounded-md font-semibold whitespace-nowrap"><?= $liveCount ?>/<?= count($modules) ?> Live</span>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <?php foreach ($modules as $i => $module): ?>
                <?php $isLink = $module['live'] && !empty($module['slug']); ?>
                <<?= $isLink ? 'a href="' . $baseUrl . $module['slug'] . '" data-partial' : 'div' ?>
                    data-aos="fade-up" data-aos-delay="<?= ($i % 3) * 80 ?>"
                    class="group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 <?= $module['live']
                        ? 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-700 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/10'
                        : 'bg-white/60 dark:bg-gray-900/50 border border-dashed border-gray-300 dark:border-gray-800' ?>">
                    <?php if ($module['live']): ?>
                        <div aria-hidden="true" class="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-primary-200/0 group-hover:bg-primary-200/40 dark:group-hover:bg-primary-900/30 blur-2xl transition-colors duration-500"></div>
                    <?php endif; ?>
                    <div class="relative flex items-start justify-between">
                        <div class="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 <?= $module['live'] ? 'bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-md shadow-primary-500/30 group-hover:scale-110' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500' ?>">
                            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><?= $module['icon'] ?></svg>
                        </div>
                        <?php if ($module['live']): ?>
                            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                <span class="relative flex h-1.5 w-1.5">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                </span>
                                Live
                            </span>
                        <?php else: ?>
                            <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                Coming Soon
                            </span>
                        <?php endif; ?>
                    </div>
                    <h4 class="relative text-sm font-bold text-gray-900 dark:text-white mb-1 <?= $isLink ? 'group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors' : '' ?>"><?= htmlspecialchars($module['name']) ?></h4>
                    <p class="relative text-xs text-gray-500 dark:text-gray-400"><?= htmlspecialchars($module['text']) ?></p>
                    <?php if ($isLink): ?>
                        <span class="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 dark:text-primary-400">
                            Open <?= htmlspecialchars($module['name']) ?>
                            <svg class="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </span>
                    <?php endif; ?>
                </<?= $isLink ? 'a' : 'div' ?>>
            <?php endforeach; ?>
        </div>
    </div>

    <!-- Closing CTA -->
    <section class="relative overflow-hidden rounded-3xl p-8 sm:p-12 text-center bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-950 animate-gradient-shift border border-secondary-800" data-aos="fade-up">
        <div aria-hidden="true" class="animate-glow-drift pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-primary-500/25 blur-3xl"></div>
        <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 right-1/4 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl"></div>
        <div class="relative z-10 max-w-xl mx-auto">
            <h2 class="text-2xl sm:text-3xl font-bold text-white mb-3">Ready to get organised?</h2>
            <p class="text-sm text-secondary-200 mb-6">Sign in to start using the apps, or get in touch and we'll let you know as each new one goes live.</p>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                <?php if ($isLoggedIn): ?>
                    <a href="<?= $baseUrl ?>dashboard" data-partial class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-primary-500 hover:bg-primary-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-500/30 transition-all hover:-translate-y-0.5">
                        Go To Dashboard
                    </a>
                <?php else: ?>
                    <a href="<?= $baseUrl ?>login" data-login-button class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-primary-500 hover:bg-primary-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary-500/30 transition-all hover:-translate-y-0.5">
                        Sign In
                    </a>
                <?php endif; ?>
                <a href="<?= $baseUrl ?>contact" data-partial class="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl border border-white/20 transition-colors">
                    Contact Us
                </a>
            </div>
        </div>
    </section>
</div>
