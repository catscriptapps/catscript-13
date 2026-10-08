<?php
// /resources/views/pages/users.php
//
// Users (admins only): every account embedded as JSON (#users-data);
// resources/js/pages/users-page.js draws the photo hero (accounts, active,
// admins, app access at a glance), the filtered directory and each person's
// profile card. Adding and editing use the shared user form
// (modals/users-modal.js — #add-user-btn / .edit-user-btn), which fires
// "users:saved" so the page refreshes on the spot. Laid out like the app pages.

declare(strict_types=1);

use Src\Controller\UsersController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

/** @var string $baseUrl */
/** @var string $assetBase */

if (!AuthService::isAdmin()) {
    include __DIR__ . '/access-denied.php';
    return;
}

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$data = UsersController::state();
?>
<div id="users-page" class="space-y-6">

    <?php
    $breadcrumbs = [['label' => 'Admin', 'href' => $baseUrl . 'admin'], ['label' => 'Users']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <!-- Hero: photo slideshow + the accounts at a glance (filled by JS) -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div id="us-hero" class="relative p-6 sm:px-10 sm:py-8"></div>
    </section>

    <!-- Toolbar -->
    <div class="flex flex-col xl:flex-row xl:items-center gap-3">
        <div class="relative xl:w-80">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="search" id="us-search" autocomplete="off" placeholder="Search name, email, city, app…"
                class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
        </div>
        <div id="us-filters" class="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1"></div>
        <div class="flex items-center gap-2 xl:ml-auto">
            <select id="us-sort" aria-label="Sort"
                class="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-3 pr-8 text-sm font-semibold text-gray-700 dark:text-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
                <option value="name">Name A–Z</option>
                <option value="newest">Newest first</option>
                <option value="active">Recently active</option>
                <option value="apps">Most apps</option>
            </select>
            <button type="button" id="add-user-btn"
                class="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
                Add user
            </button>
        </div>
    </div>

    <div id="us-body" aria-live="polite"></div>

    <script type="application/json" id="users-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
