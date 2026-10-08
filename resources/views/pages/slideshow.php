<?php
// /resources/views/pages/slideshow.php
//
// Slideshow: the photos behind every hero banner and the TV screensavers
// (Timetable, Chores, Tasks…). Admins, and anyone granted the "Slideshow"
// app. The set is embedded as JSON (#slideshow-data); resources/js/pages/
// slideshow-page.js draws the grid (reorder buttons), select-many delete,
// uploads (modals/upload-modal.js) and the full-screen preview with its
// banner / screensaver crop views. Organised like the Pictures app.

declare(strict_types=1);

use Src\Controller\SlideshowController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

/** @var string $baseUrl */
/** @var string $assetBase */

if (!AuthService::hasAccess('Slideshow')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$data = SlideshowController::state();
$slides = CuratedPhotos::fromHomeFolder($assetBase);
$breadcrumbs = AuthService::isAdmin()
    ? [['label' => 'Admin', 'href' => $baseUrl . 'admin'], ['label' => 'Slideshow']]
    : [['label' => 'Slideshow']];
?>
<div id="slideshow-page" class="space-y-6">

    <?php include __DIR__ . '/../components/breadcrumbs.php'; ?>

    <!-- Hero: the slideshow itself, live -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/70 to-secondary-900/30"></div>
        <div id="ss-hero" class="relative p-6 sm:px-10 sm:py-8"></div>
    </section>

    <?php if (!$data['ready']): ?>
        <div class="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-5 py-4 text-sm text-amber-800 dark:text-amber-200">
            <strong>One step first:</strong> the slideshow needs a database update before photos can be managed here. Run the DB update from the header (it’s safe — it only adds what’s missing), then reload this page. Until then, the site keeps showing the photos already in <code>images/home/</code>.
        </div>
    <?php endif; ?>

    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div class="min-w-0 flex-1">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">The photos, in order</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">To move a photo, click its ⇄ button, then the ⇄ on the photo whose place it should take · click a photo to preview it in a banner and on the TV.</p>
        </div>
        <div class="flex flex-shrink-0 items-center gap-2">
            <button type="button" id="ss-select-btn"
                class="hidden flex-shrink-0 inline-flex items-center gap-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Select
            </button>
            <button type="button" id="ss-upload-btn" <?= $data['ready'] ? '' : 'disabled' ?>
                class="flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Add photos
            </button>
        </div>
    </div>

    <!-- Grid -->
    <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div id="ss-grid" class="p-3 sm:p-5 min-h-[12rem]" aria-live="polite"></div>
    </section>

    <!-- Selection bar (select mode) -->
    <div id="ss-selectbar" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-2xl bg-secondary-900 text-white shadow-2xl shadow-black/30 ring-1 ring-white/10 px-3 py-2">
        <span class="px-2 text-sm font-semibold whitespace-nowrap" data-sel-count>0 selected</span>
        <button type="button" data-sel="all" class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors">Select all</button>
        <button type="button" data-sel="delete" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-200 hover:bg-red-500/30 transition-colors disabled:opacity-40" disabled>Delete</button>
        <button type="button" data-sel="cancel" class="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors">Done</button>
    </div>

    <script type="application/json" id="slideshow-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
