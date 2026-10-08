<?php
// /resources/views/pages/cash-flow.php
//
// Cash Flow app. The owner's ledger is embedded as JSON (#cf-data) and
// everything on the page — totals, charts, the list — is computed from it in
// the browser by resources/js/pages/cash-flow-page.js, so filters, search,
// saves and deletes all update on the spot with no page reload.
//
// Three audiences:
//   - guests (not signed in): a try-it demo. data-mode="guest" makes the page
//     script keep the ledger in this browser's localStorage (seeded with
//     sample entries) — nothing is sent to the server or the database.
//   - signed in without Cash Flow access: access denied.
//   - signed in with access: the real, private ledger from catscript_db.

declare(strict_types=1);

use Src\Controller\CashFlowController;
use Src\Service\AuthService;

$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Cash Flow')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$ledger = $isGuest ? [] : CashFlowController::ledger((int) AuthService::userId());
// TV screensaver backdrop (cash-flow-page.js) — the Slideshow photos
$slides = \Src\Utils\CuratedPhotos::fromHomeFolder($assetBase);

$periods = [
    'month'      => 'This month',
    'last-month' => 'Last month',
    'quarter'    => '3 months',
    'year'       => 'This year',
    'all'        => 'All time',
];
$types = ['all' => 'All', 'income' => 'Money in', 'expense' => 'Money out'];

$seg = 'cf-seg px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white';
?>

<div id="cash-flow-page" class="cf-root space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>" data-slides="<?= htmlspecialchars(json_encode($slides), ENT_QUOTES) ?>">

    <?php $breadcrumbs = [['label' => $isGuest ? 'Cash Flow (guest)' : 'Cash Flow']]; ?>

    <!-- Compact header: pinned under the site header once the page header
         (#cf-header) scrolls away — shown/hidden by cash-flow-page.js. Zero
         height (and -mb-6 cancels the space-y gap), so it never moves the page. -->
    <div class="sticky top-20 z-30 h-0 -mb-6">
        <div id="cf-mini-header" aria-hidden="true" inert
            class="absolute inset-x-0 top-0 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg shadow-gray-900/5 px-4 py-2 opacity-0 -translate-y-2 pointer-events-none transition duration-200 [&_nav]:mb-0 min-w-0">
            <div class="min-w-0 truncate"><?php include __DIR__ . '/../components/breadcrumbs.php'; ?></div>
            <button type="button" data-cf-add
                class="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                Record entry
            </button>
        </div>
    </div>

    <?php include __DIR__ . '/../components/breadcrumbs.php'; ?>

    <?php if ($isGuest): ?>
        <?php
        $demoApp = 'Cash Flow';
        $demoText = 'sample entries';
        $demoIdPrefix = 'cf';
        include __DIR__ . '/../components/guest-demo-banner.php';
        ?>
    <?php endif; ?>

    <!-- Header -->
    <div id="cf-header" class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Cash Flow</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Money in, money out, and what's left — updated the moment anything changes.</p>
        </div>
        <button type="button" id="cf-add-btn"
            class="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
            Record entry
        </button>
    </div>

    <!-- Filters: one row, scoping everything below -->
    <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <div class="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/70 overflow-x-auto" role="group" aria-label="Period" id="cf-periods">
            <?php foreach ($periods as $key => $label): ?>
                <button type="button" class="<?= $seg ?>" data-period="<?= $key ?>" aria-pressed="<?= $key === 'month' ? 'true' : 'false' ?>"><?= $label ?></button>
            <?php endforeach; ?>
        </div>
        <div class="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/70" role="group" aria-label="Type" id="cf-types">
            <?php foreach ($types as $key => $label): ?>
                <button type="button" class="<?= $seg ?>" data-type="<?= $key ?>" aria-pressed="<?= $key === 'all' ? 'true' : 'false' ?>"><?= $label ?></button>
            <?php endforeach; ?>
        </div>
        <div class="relative lg:ml-auto lg:w-72">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="search" id="cf-search" autocomplete="off" placeholder="Search entries…"
                class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition">
        </div>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <!-- Hero: net -->
        <section class="md:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary-600 to-secondary-900 text-white p-6 shadow-sm">
            <div aria-hidden="true" class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary-500/25 blur-3xl"></div>
            <div class="relative">
                <p class="text-sm font-medium text-secondary-200"><span id="cf-net-label">Net</span></p>
                <p id="cf-net" class="mt-1 text-5xl font-bold tracking-tight leading-none">$0.00</p>
                <p id="cf-net-delta" class="mt-3 text-sm text-secondary-200"></p>

                <!-- Kept-of-income meter -->
                <div class="mt-5">
                    <div class="flex items-center justify-between text-xs text-secondary-200 mb-1.5">
                        <span id="cf-kept-label">Spent of what came in</span>
                        <span id="cf-kept-value" class="font-semibold text-white">—</span>
                    </div>
                    <div class="h-2 rounded-full bg-white/15 overflow-hidden" role="meter" aria-valuemin="0" aria-valuemax="100" id="cf-kept-meter" aria-label="Share of money in that went out">
                        <div id="cf-kept-bar" class="h-full rounded-full bg-primary-400 transition-[width] duration-500" style="width: 0%"></div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Money in -->
        <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-sm" style="background: var(--cf-in)"></span>
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Money in</p>
            </div>
            <p id="cf-in" class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">$0.00</p>
            <p id="cf-in-sub" class="mt-1 text-xs text-gray-500 dark:text-gray-400"></p>
        </section>

        <!-- Money out -->
        <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-sm" style="background: var(--cf-out)"></span>
                <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Money out</p>
            </div>
            <p id="cf-out" class="mt-2 text-3xl font-bold text-gray-900 dark:text-white">$0.00</p>
            <p id="cf-out-sub" class="mt-1 text-xs text-gray-500 dark:text-gray-400"></p>
        </section>
    </div>

    <!-- Charts -->
    <div id="cf-charts" class="grid grid-cols-1 xl:grid-cols-3 gap-4 transition-opacity">
        <section class="xl:col-span-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <div class="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                    <h2 class="text-base font-bold text-gray-900 dark:text-white">Money in vs money out</h2>
                    <p id="cf-flow-sub" class="text-xs text-gray-500 dark:text-gray-400"></p>
                </div>
                <div class="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300" aria-label="Legend">
                    <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background: var(--cf-in)"></span>Money in</span>
                    <span class="inline-flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background: var(--cf-out)"></span>Money out</span>
                    <span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" style="background: var(--cf-net)"></span>Net</span>
                </div>
            </div>
            <div id="cf-flow-chart" class="relative h-72"></div>
        </section>

        <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h2 class="text-base font-bold text-gray-900 dark:text-white">Where the money went</h2>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">Biggest money-out entries, grouped by title</p>
            <div id="cf-top-chart" class="relative"></div>
        </section>

        <section class="xl:col-span-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-5 shadow-sm">
            <h2 class="text-base font-bold text-gray-900 dark:text-white">Running net</h2>
            <p id="cf-balance-sub" class="text-xs text-gray-500 dark:text-gray-400 mb-3">Money in minus money out, accumulated across the period</p>
            <div id="cf-balance-chart" class="relative h-56"></div>
        </section>
    </div>

    <!-- Ledger (also the charts' table view) -->
    <section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div class="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
            <div>
                <h2 class="text-base font-bold text-gray-900 dark:text-white">Entries</h2>
                <p id="cf-list-sub" class="text-xs text-gray-500 dark:text-gray-400"></p>
            </div>
        </div>
        <div id="cf-list" class="px-2 sm:px-3 pb-3" aria-live="polite"></div>
    </section>

    <script type="application/json" id="cf-data"><?= json_encode($ledger, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) ?></script>
</div>
