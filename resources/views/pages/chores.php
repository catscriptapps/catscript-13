<?php
// /resources/views/pages/chores.php
//
// Chores: who does which chore in each of the Timetable's chore slots.
// Everything (children, library, slots, plan, this week's ticks) is embedded
// as JSON (#chores-data); resources/js/pages/chores-page.js draws the photo
// hero, the Today board, the week planner, the library and the children from
// it, and patches it from each API response.

declare(strict_types=1);

use App\Models\ChoreLibraryItem;
use App\Models\TimetableActivity;
use Src\Controller\ChoresController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

// Guests get a try-it demo: everything stays in this browser (utils/chores/guest-store.js),
// with chore slots taken from the guest Timetable in the same browser.
$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Chores')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$state = $isGuest
    ? ['presets' => ChoresController::state()['library'], 'areas' => ChoreLibraryItem::AREAS]
    : ChoresController::state();
$data = $state + [
    'days'   => TimetableActivity::DAYS,
    'slides' => $slides,
    'timetable_url' => $baseUrl . 'timetable',
];
$tab = 'ch-tab px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:aria-pressed:bg-gray-800 dark:aria-pressed:text-white';
?>
<div id="chores-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Chores (guest)' : 'Chores']];
    include __DIR__ . '/../components/breadcrumbs.php';
    if ($isGuest) {
        $demoApp = 'Chores';
        $demoText = 'five sample children and a shared-out week, using the chore slots from the Timetable demo';
        $demoIdPrefix = 'ch';
        include __DIR__ . '/../components/guest-demo-banner.php';
    }
    ?>

    <!-- Hero: photo slideshow + the current chore slot + everyone's progress (filled by JS) -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/70 to-secondary-900/35"></div>
        <div id="ch-hero" class="relative p-6 sm:px-10 sm:py-8 min-h-[13rem]"></div>
    </section>

    <!-- Tabs -->
    <div class="flex flex-wrap items-center gap-3">
        <nav class="inline-flex rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1" aria-label="Chores views">
            <button type="button" class="<?= $tab ?>" data-view="today" aria-pressed="true">Today</button>
            <button type="button" class="<?= $tab ?>" data-view="plan" aria-pressed="false">The week</button>
            <button type="button" class="<?= $tab ?>" data-view="library" aria-pressed="false">Chore library</button>
            <button type="button" class="<?= $tab ?>" data-view="kids" aria-pressed="false" data-manage-only>Children</button>
        </nav>
        <div class="ml-auto flex items-center gap-2" data-manage-only>
            <button type="button" data-act="share"
                class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                Share out chores
            </button>
        </div>
    </div>

    <div id="ch-body" aria-live="polite"></div>

    <script type="application/json" id="chores-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
