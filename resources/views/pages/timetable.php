<?php
// /resources/views/pages/timetable.php
//
// Timetable: the family's shared weekly routine. Categories and every
// activity are embedded as JSON (#timetable-data); resources/js/pages/
// timetable-page.js draws the live hero (now / next, today at a glance —
// with the category filter and options), the week (an hour-by-hour grid on wide screens, a
// day-by-day list on phones) and every modal from it, and patches it from
// each API response. The toolbar and the day headers stay pinned under the
// app header while the week scrolls.

declare(strict_types=1);

use App\Models\TimetableActivity;
use Src\Controller\TimetableController;
use Src\Service\AuthService;

// Three audiences (as with Tasks and Cash Flow):
//   - guests (not signed in): a try-it demo. data-mode="guest" makes the page
//     script keep a whole timetable in this browser's localStorage (seeded
//     with a sample week) — nothing reaches the server or the database.
//   - signed in without Timetable access: access denied.
//   - signed in with access: the shared family timetable from catscript_db.
$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Timetable')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$data = ($isGuest ? ['categories' => [], 'activities' => [], 'can_edit' => true] : TimetableController::state())
    + [
        'days'   => TimetableActivity::DAYS,
        // Screensaver backdrop (Live mode, left alone on a big screen): the
        // same numbered photos as the home page slideshow
        'slides' => \Src\Utils\CuratedPhotos::fromHomeFolder($assetBase),
    ];
$heroBtn = 'inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md ring-1 ring-white/15 px-3.5 py-2 text-sm font-semibold text-white transition-colors';
?>
<div id="timetable-page" class="space-y-5" data-mode="<?= $isGuest ? 'guest' : 'account' ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Timetable (guest)' : 'Timetable']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <?php if ($isGuest): ?>
        <?php
        $demoApp = 'the Timetable';
        $demoText = 'a sample family week';
        $demoIdPrefix = 'tt';
        include __DIR__ . '/../components/guest-demo-banner.php';
        ?>
    <?php endif; ?>

    <!-- Hero: photo slideshow + what's on now / next today (filled by JS, live),
         with the category filter and the timetable's options. z-[35] keeps its
         menus above the week (the pinned toolbar is z-30), below the app header. -->
    <section id="tt-hero" class="relative z-[35] rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <div class="absolute inset-0 overflow-hidden rounded-3xl" aria-hidden="true">
            <?php $slideshowImages = $data['slides']; include __DIR__ . '/../components/hero-slideshow.php'; ?>
            <div class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        </div>
        <div class="relative p-6 sm:px-10 sm:py-8">
            <div id="tt-hero-live" class="min-h-[12rem]"></div>

            <div class="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center gap-2">
                <!-- Category filter -->
                <div class="relative" data-menu-root>
                    <button type="button" data-menu-toggle="filter" aria-haspopup="true" aria-expanded="false" title="Filter categories"
                        class="<?= $heroBtn ?>">
                        <svg class="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                        <span data-filter-label>All categories</span>
                        <svg class="h-3.5 w-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <div data-menu="filter" class="hidden absolute left-0 z-40 mt-2 w-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-2 text-gray-900 dark:text-white">
                        <div class="flex items-center justify-between px-2 pt-1 pb-2">
                            <p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Show</p>
                            <button type="button" data-filter-all class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">Show all</button>
                        </div>
                        <div class="max-h-80 overflow-y-auto custom-scrollbar space-y-0.5" data-filter-list></div>
                    </div>
                </div>

                <!-- Options (editors) -->
                <button type="button" data-act="categories" data-edit-only class="<?= $heroBtn ?>">
                    <svg class="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                    Manage categories
                </button>
                <button type="button" data-act="copy-day" data-edit-only class="<?= $heroBtn ?>">
                    <svg class="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy a day
                </button>
                <button type="button" data-act="clear-day" data-edit-only class="<?= $heroBtn ?>">
                    <svg class="h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Clear a day…
                </button>
                <button type="button" data-act="clear-all" data-edit-only class="<?= $heroBtn ?> hover:!bg-red-500/30 hover:!ring-red-300/40">
                    <svg class="h-4 w-4 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    Clear the whole week…
                </button>
            </div>
        </div>
    </section>

    <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">

        <!-- Pinned: toolbar + day headers (stay under the app header while scrolling) -->
        <div id="tt-sticky" class="sticky top-20 z-30 rounded-t-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 pt-3.5 pb-3">
                <div class="min-w-0 mr-auto">
                    <div class="flex items-center gap-2.5">
                        <h1 class="text-xl font-bold text-gray-900 dark:text-white leading-tight">Timetable</h1>
                        <!-- Live: follow the clock when the page is left alone (per-browser setting) -->
                        <button type="button" data-act="live" aria-pressed="true"
                            class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ring-1 transition-colors text-gray-400 ring-gray-200 dark:ring-gray-700 aria-pressed:text-red-600 aria-pressed:ring-red-200 aria-pressed:bg-red-50 dark:aria-pressed:text-red-300 dark:aria-pressed:ring-red-900/60 dark:aria-pressed:bg-red-950/40">
                            <span data-live-dot class="h-1.5 w-1.5 rounded-full bg-current"></span>
                            <span data-live-label>Live</span>
                        </button>
                    </div>
                    <div class="mt-1 flex items-center gap-2 min-w-0 text-xs text-gray-500 dark:text-gray-400" data-tt-summary>&nbsp;</div>
                </div>

                <div class="flex items-center gap-2">
                    <button type="button" data-act="add" data-edit-only
                        class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                        <span>Add<span class="hidden sm:inline"> activity</span></span>
                    </button>
                </div>
            </div>

            <!-- Day headers (week grid) / day tabs (phones) — filled by JS -->
            <div id="tt-days"></div>
        </div>

        <!-- The week -->
        <div id="tt-body" class="relative" aria-live="polite"></div>
    </section>

    <script type="application/json" id="timetable-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
