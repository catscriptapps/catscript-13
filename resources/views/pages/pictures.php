<?php
// /resources/views/pages/pictures.php
//
// Pictures: the owner's private gallery. The whole gallery is embedded as
// JSON (#pictures-data) and resources/js/pages/pictures-page.js renders the
// featured carousel, the month-grouped grid, filters, search, selection and
// the full-screen viewer from it — so everything updates on the spot.

declare(strict_types=1);

use Src\Controller\PicturesController;
use Src\Service\AuthService;

// Guests get a try-it demo: photos stay in this browser (utils/pictures/guest-store.js)
$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Pictures')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$pictures = $isGuest ? [] : PicturesController::gallery((int) AuthService::userId());
$sampleSlides = $isGuest ? \Src\Utils\CuratedPhotos::fromHomeFolder($assetBase) : [];
$seg = 'pic-seg px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white';
?>
<div id="pictures-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>" data-slides="<?= htmlspecialchars(json_encode($sampleSlides), ENT_QUOTES) ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Pictures (guest)' : 'Pictures']];
    include __DIR__ . '/../components/breadcrumbs.php';
    if ($isGuest) {
        $demoApp = 'Pictures';
        $demoText = 'a few sample photos (yours never leave this device)';
        $demoIdPrefix = 'pic';
        include __DIR__ . '/../components/guest-demo-banner.php';
    }
    ?>

    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Pictures</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1"><?= $isGuest ? 'Try it out — the photos you add stay in this browser.' : 'Your private gallery — only you can see these.' ?></p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <button type="button" id="pic-slideshow-btn" title="Play your pictures full screen"
                class="hidden flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-secondary-900 hover:bg-secondary-800 dark:bg-white/10 dark:hover:bg-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" /></svg>
                Slideshow
            </button>
            <button type="button" id="pic-select-btn"
                class="hidden flex-shrink-0 inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Select
            </button>
            <button type="button" id="pic-upload-btn"
                class="flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload pictures
            </button>
        </div>
    </div>

    <!-- Featured carousel (favourites, or the latest uploads) — filled by JS -->
    <section id="pic-featured" class="hidden relative overflow-hidden rounded-3xl bg-secondary-900 shadow-xl shadow-secondary-900/10 h-64 sm:h-80 lg:h-[26rem]" aria-label="Featured pictures"></section>

    <!-- Stats -->
    <div id="pic-stats" class="hidden grid grid-cols-3 gap-3 sm:gap-4">
        <?php foreach ([['total', 'Pictures', 'text-gray-900 dark:text-white'], ['month', 'Added this month', 'text-primary-600 dark:text-primary-400'], ['favourites', 'Favourites', 'text-pink-600 dark:text-pink-400']] as [$key, $label, $tone]): ?>
            <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm px-4 sm:px-5 py-3.5">
                <span class="block text-2xl sm:text-3xl font-bold leading-none <?= $tone ?>" data-stat="<?= $key ?>">0</span>
                <span class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mt-1.5"><?= $label ?></span>
            </div>
        <?php endforeach; ?>
    </div>

    <!-- Gallery card -->
    <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div id="pic-toolbar" class="hidden flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-6 py-3 border-b border-gray-100 dark:border-gray-800">
            <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 self-start" role="group" aria-label="Show">
                <button type="button" class="<?= $seg ?>" data-filter="all" aria-pressed="true">All</button>
                <button type="button" class="<?= $seg ?>" data-filter="favourites" aria-pressed="false">Favourites</button>
            </div>
            <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 self-start" role="group" aria-label="Order">
                <button type="button" class="<?= $seg ?>" data-sort="newest" aria-pressed="true">Newest</button>
                <button type="button" class="<?= $seg ?>" data-sort="oldest" aria-pressed="false">Oldest</button>
            </div>
            <div class="relative sm:ml-auto sm:w-72">
                <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="search" id="pic-search" autocomplete="off" placeholder="Search captions &amp; comments…"
                    class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition">
            </div>
        </div>

        <div id="pic-grid" class="p-3 sm:p-5 min-h-[12rem]" aria-live="polite"></div>
    </section>

    <!-- Selection bar (select mode) -->
    <div id="pic-selectbar" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-secondary-900 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 px-3 py-2">
        <span class="px-2 text-sm font-semibold whitespace-nowrap" data-sel-count>0 selected</span>
        <button type="button" data-sel="all" class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors">Select all</button>
        <button type="button" data-sel="favourite" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-pink-500/20 text-pink-200 hover:bg-pink-500/30 transition-colors disabled:opacity-40" disabled>Favourite</button>
        <button type="button" data-sel="delete" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-40" disabled>Delete</button>
        <button type="button" data-sel="cancel" class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors">Done</button>
    </div>

    <script type="application/json" id="pictures-data"><?= json_encode($pictures, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
