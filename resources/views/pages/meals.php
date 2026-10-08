<?php
// /resources/views/pages/meals.php
//
// Meals: weekly meal plans, shared — everyone with Meals access sees every
// plan; meal planners create plans and edit their own (MealsController).
// All plans and the active plan's meals are embedded as JSON (#meals-data);
// resources/js/pages/meals-page.js
// renders the week grid (a day-by-day view on phones), the calorie figures
// and every modal from it, and patches it from each API response — so the
// grid and totals update on the spot. ?plan={encodedId} picks the plan.

declare(strict_types=1);

use App\Models\Meal;
use Src\Controller\MealsController;
use Src\Service\AuthService;

// Guests get a try-it demo: data-mode="guest" makes the page script keep
// plans in this browser (utils/meals/guest-store.js) — nothing reaches the server.
$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Meals')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$data = ($isGuest ? ['plans' => [], 'plan' => null, 'meals' => [], 'can_plan' => true] : MealsController::state((int) AuthService::userId(), (string) ($_GET['plan'] ?? ''))) + [
    'days'  => Meal::DAYS,
    'types' => Meal::TYPES,
];

$menuItem = 'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left';
?>
<div id="meals-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Meals (guest)' : 'Meals']];
    include __DIR__ . '/../components/breadcrumbs.php';
    if ($isGuest) {
        $demoApp = 'Meals';
        $demoText = 'two sample meal plans';
        $demoIdPrefix = 'meals';
        include __DIR__ . '/../components/guest-demo-banner.php';
    }
    ?>

    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div class="min-w-0">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Meals</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">The week's meals — breakfast to snacks — shared with everyone at home.</p>
            <p id="meals-owner-note" class="hidden mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300"></p>
        </div>

        <div id="meals-plan-bar" class="hidden flex items-center gap-2">
            <!-- Plan picker -->
            <div class="relative" data-menu-root>
                <button type="button" data-menu-toggle="plans" aria-haspopup="true" aria-expanded="false"
                    class="inline-flex items-center gap-2 max-w-[16rem] rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-3.5 pr-3 py-2.5 text-sm font-semibold text-gray-900 dark:text-white hover:border-primary-400 transition-colors">
                    <svg class="h-4 w-4 flex-shrink-0 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <span class="truncate" data-plan-title></span>
                    <svg class="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div data-menu="plans" class="hidden absolute right-0 md:right-auto md:left-0 z-30 mt-2 w-72 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-2">
                    <div class="max-h-80 overflow-y-auto custom-scrollbar space-y-0.5" data-plan-list></div>
                    <div class="mt-1 pt-1 border-t border-gray-100 dark:border-gray-800" data-new-plan-wrap>
                        <button type="button" data-act="new-plan" class="<?= $menuItem ?> text-primary-700 dark:text-primary-300">
                            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                            New plan
                        </button>
                    </div>
                </div>
            </div>

            <!-- Plan actions -->
            <div class="relative" data-menu-root>
                <button type="button" data-menu-toggle="actions" aria-haspopup="true" aria-expanded="false" aria-label="Plan actions" title="Plan actions"
                    class="h-[42px] w-[42px] inline-flex items-center justify-center rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-primary-400 transition-colors">
                    <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                </button>
                <div data-menu="actions" class="hidden absolute right-0 z-30 mt-2 w-56 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-xl p-2 space-y-0.5">
                    <button type="button" data-act="edit-plan" class="<?= $menuItem ?>">
                        <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        Rename plan
                    </button>
                    <button type="button" data-act="duplicate-plan" class="<?= $menuItem ?>">
                        <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        <span data-label>Duplicate plan</span>
                    </button>
                    <button type="button" data-act="pdf" class="<?= $menuItem ?>">
                        <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Export PDF
                    </button>
                    <div class="my-1 border-t border-gray-100 dark:border-gray-800" data-edit-divider></div>
                    <button type="button" data-act="clear-week" class="<?= $menuItem ?>">
                        <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Clear the week
                    </button>
                    <button type="button" data-act="delete-plan" class="<?= $menuItem ?> text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete plan
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Summary -->
    <div id="meals-summary" class="hidden grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <?php foreach ([['planned', 'Meals planned'], ['week', 'Week calories'], ['average', 'Daily average'], ['today', 'Today']] as [$key, $label]): ?>
            <div class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm px-4 sm:px-5 py-3.5 min-w-0">
                <span class="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"><?= $label ?></span>
                <span class="mt-1.5 block text-2xl font-bold leading-none text-gray-900 dark:text-white truncate" data-sum="<?= $key ?>">—</span>
                <span class="mt-1 block text-xs text-gray-500 dark:text-gray-400 truncate" data-sum-note="<?= $key ?>">&nbsp;</span>
            </div>
        <?php endforeach; ?>
    </div>

    <!-- Week -->
    <section id="meals-week" class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden" aria-live="polite"></section>

    <script type="application/json" id="meals-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
