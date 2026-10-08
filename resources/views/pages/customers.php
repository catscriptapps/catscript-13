<?php
// /resources/views/pages/customers.php
//
// Customers: the shared business directory (legacy `customers` table). The
// whole directory — with each customer's billing picture — is embedded as
// JSON (#customers-data); resources/js/pages/customers-page.js draws the
// photo hero with the business numbers, the searchable card / list views,
// the customer profile (with invoice history) and the forms from it.

declare(strict_types=1);

use Src\Controller\CustomersController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

// Guests get a try-it demo: a sample book kept in this browser (utils/business/guest-store.js)
$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Customers')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$data = $isGuest
    ? array_intersect_key(CustomersController::state(), array_flip(['countries', 'regions', 'year'])) + ['customers' => [], 'can_invoices' => true]
    : CustomersController::state() + ['can_invoices' => AuthService::hasAccess('Invoices')];
$seg = 'cu-seg px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white';
?>
<div id="customers-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Customers (guest)' : 'Customers']];
    include __DIR__ . '/../components/breadcrumbs.php';
    if ($isGuest) {
        $demoApp = 'Customers';
        $demoText = 'a sample customer book (shared with the Invoices demo)';
        $demoIdPrefix = 'cu';
        include __DIR__ . '/../components/guest-demo-banner.php';
    }
    ?>

    <!-- Hero: photo slideshow + the business at a glance (filled by JS) -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div id="cu-hero" class="relative p-6 sm:px-10 sm:py-8"></div>
    </section>

    <!-- Toolbar -->
    <div class="flex flex-col xl:flex-row xl:items-center gap-3">
        <div class="relative xl:w-80">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="search" id="cu-search" autocomplete="off" placeholder="Search name, email, phone, city…"
                class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="group" aria-label="Show">
                <button type="button" class="<?= $seg ?>" data-filter="active" aria-pressed="true">Active</button>
                <button type="button" class="<?= $seg ?>" data-filter="open" aria-pressed="false">Owing</button>
                <button type="button" class="<?= $seg ?>" data-filter="archived" aria-pressed="false">Archived</button>
                <button type="button" class="<?= $seg ?>" data-filter="all" aria-pressed="false">All</button>
            </div>
            <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="group" aria-label="Sort">
                <button type="button" class="<?= $seg ?>" data-sort="name" aria-pressed="true">A–Z</button>
                <button type="button" class="<?= $seg ?>" data-sort="billed" aria-pressed="false">Most billed</button>
                <button type="button" class="<?= $seg ?>" data-sort="newest" aria-pressed="false">Newest</button>
            </div>
            <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1" role="group" aria-label="View">
                <button type="button" class="<?= $seg ?>" data-layout="cards" aria-pressed="true" title="Cards" aria-label="Cards">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </button>
                <button type="button" class="<?= $seg ?>" data-layout="list" aria-pressed="false" title="List" aria-label="List">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            </div>
        </div>
        <div class="flex items-center gap-2 xl:ml-auto">
            <a href="<?= $baseUrl ?>api/customers?export=csv" download data-export
                class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export CSV
            </a>
            <button type="button" data-act="add"
                class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                Add customer
            </button>
        </div>
    </div>

    <div id="cu-body" aria-live="polite"></div>

    <script type="application/json" id="customers-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
