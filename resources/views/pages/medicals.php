<?php
// /resources/views/pages/medicals.php
//
// Medicals: the family's health in one place — appointments (booked and to
// book), medications with today's doses, vaccinations / check-ups / tests
// with "next due" dates, everyone's health profile, and the providers.
// Everything is embedded as JSON (#medicals-data); resources/js/pages/
// medicals-page.js draws the live photo hero, the reminders, every tab and
// every form from it, and patches it from each API response. Left open on a
// TV, the page's own screensaver shows the next appointment, the doses due
// and the reminders.
//
// Three audiences (as with Tasks):
//   - guests (not signed in): a try-it demo. data-mode="guest" makes the page
//     script keep a sample family in this browser's localStorage
//     (utils/medicals/guest-store.js) — nothing reaches the server.
//   - signed in without Medicals access: access denied.
//   - signed in with access: the family's Medicals from catscript_db.

declare(strict_types=1);

use Src\Controller\MedicalsController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

/** @var string $assetBase */
/** @var string $baseUrl */

$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Medicals')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$data = ($isGuest
    ? MedicalsController::lookups() + ['today' => date('Y-m-d'), 'accounts' => []]
    : MedicalsController::state() + ['accounts' => MedicalsController::accounts()])
    + ['slides' => $slides];

$tabs = [
    'today'        => 'Today',
    'appointments' => 'Appointments',
    'medications'  => 'Medications',
    'records'      => 'Records',
    'family'       => 'Family',
    'providers'    => 'Providers',
];
$tab = 'md-tab px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:aria-pressed:bg-gray-800 dark:aria-pressed:text-white';
?>
<div id="medicals-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Medicals (guest)' : 'Medicals']];
    include __DIR__ . '/../components/breadcrumbs.php';
    if ($isGuest) {
        $demoApp = 'Medicals';
        $demoText = 'a sample family with appointments, medications and records';
        $demoIdPrefix = 'md';
        include __DIR__ . '/../components/guest-demo-banner.php';
    }
    ?>

    <!-- Hero: photo slideshow + the next appointment, today's doses and the
         reminders. Live: medicals-page.js redraws it every 30 seconds. -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div id="md-hero" class="relative p-6 sm:px-10 sm:py-8 min-h-[14rem]"></div>
    </section>

    <!-- Tabs + actions -->
    <div class="flex flex-col xl:flex-row xl:items-center gap-3">
        <nav class="inline-flex self-start max-w-full overflow-x-auto custom-scrollbar rounded-2xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-1" aria-label="Medicals views">
            <?php foreach ($tabs as $key => $label): ?>
                <button type="button" class="<?= $tab ?>" data-view="<?= $key ?>" aria-pressed="<?= $key === 'today' ? 'true' : 'false' ?>"><?= $label ?></button>
            <?php endforeach; ?>
        </nav>
        <div class="flex flex-wrap items-center gap-2 xl:ml-auto">
            <button type="button" data-act="new-appointment"
                class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                Book appointment
            </button>
            <div class="relative" data-menu-root>
                <button type="button" data-menu-toggle aria-haspopup="true" aria-expanded="false"
                    class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:border-primary-400 transition-colors">
                    Add…
                    <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div data-menu class="hidden absolute right-0 z-40 mt-2 w-56 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-2 space-y-0.5">
                    <?php foreach ([['new-medication', '💊', 'Medication'], ['new-record', '💉', 'Vaccination or record'], ['new-person', '👪', 'Family member'], ['new-provider', '🏥', 'Doctor, clinic or pharmacy']] as [$act, $icon, $label]): ?>
                        <button type="button" data-act="<?= $act ?>" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
                            <span class="text-base leading-none"><?= $icon ?></span><?= $label ?>
                        </button>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
    </div>

    <div id="md-body" aria-live="polite"></div>

    <script type="application/json" id="medicals-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
