<?php
// /resources/views/pages/invoices.php
//
// Invoices: every invoice (legacy `invoices` / `invoice_items`) with its
// customer, status, payments and balance, embedded as JSON (#invoices-data).
// resources/js/pages/invoices-page.js draws the photo hero with the money
// picture (outstanding, overdue, paid this year, a 12-month chart), the
// filtered list, the paper-style invoice view and the line-item editor.

declare(strict_types=1);

use Src\Controller\InvoicesController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

// Guests get a try-it demo: a sample book kept in this browser (utils/business/guest-store.js)
$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Invoices')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$state = InvoicesController::state();
if ($isGuest) {
    // Only the lookups — the invoices and customers come from the browser
    $state = array_intersect_key($state, array_flip(['statuses', 'payment_terms', 'delivery_terms', 'currencies', 'today']))
        + ['invoices' => [], 'customers' => [], 'can_email' => false];
}
$data = $state + [
    'customers_url' => $baseUrl . 'customers',
    'can_customers' => $isGuest || AuthService::hasAccess('Customers'),
    'receipts_url'  => $baseUrl . 'receipts',
    'can_receipts'  => $isGuest || AuthService::hasAccess('Receipts'),
];
?>
<div id="invoices-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Invoices (guest)' : 'Invoices']];
    include __DIR__ . '/../components/breadcrumbs.php';
    if ($isGuest) {
        $demoApp = 'Invoices';
        $demoText = 'a sample year of invoices (shared with the Customers demo)';
        $demoIdPrefix = 'in';
        include __DIR__ . '/../components/guest-demo-banner.php';
    }
    ?>

    <!-- Hero: photo slideshow + the money picture (filled by JS) -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div id="in-hero" class="relative p-6 sm:px-10 sm:py-8"></div>
    </section>

    <!-- Toolbar -->
    <div class="flex flex-col xl:flex-row xl:items-center gap-3">
        <div class="relative xl:w-80">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="search" id="in-search" autocomplete="off" placeholder="Search number, customer, title…"
                class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
        </div>
        <div id="in-filters" class="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1"></div>
        <div class="flex items-center gap-2 xl:ml-auto">
            <select id="in-sort" aria-label="Sort"
                class="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-3 pr-8 text-sm font-semibold text-gray-700 dark:text-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
                <option value="newest">Newest first</option>
                <option value="due">Due soonest</option>
                <option value="amount">Largest first</option>
                <option value="balance">Most owing</option>
            </select>
            <button type="button" data-act="new"
                class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                New invoice
            </button>
        </div>
    </div>

    <div id="in-body" aria-live="polite"></div>

    <script type="application/json" id="invoices-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
