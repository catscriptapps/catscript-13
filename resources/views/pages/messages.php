<?php
// /resources/views/pages/messages.php
//
// Messages: the contact-form inbox (admins only). Every thread is embedded as
// JSON (#messages-data); resources/js/pages/messages-page.js draws the stats,
// the thread list and the open conversation with its reply box, and keeps the
// list fresh while the page is open.

declare(strict_types=1);

use Src\Controller\MessagesController;
use Src\Service\AuthService;

if (!AuthService::isLoggedIn()) {
    include __DIR__ . '/auth-required.php';
    return;
}
if (!AuthService::isAdmin()) {
    include __DIR__ . '/access-denied.php';
    return;
}

$data = MessagesController::state() + ['contact_url' => $baseUrl . 'contact'];
?>
<div id="messages-page" class="space-y-6">

    <?php
    $breadcrumbs = [['label' => 'Messages']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <!-- Header + stats (filled by JS) -->
    <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-800 via-secondary-900 to-secondary-950 text-white shadow-xl shadow-secondary-900/10">
        <div aria-hidden="true" class="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-primary-500/30 blur-3xl"></div>
        <div aria-hidden="true" class="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-400/15 blur-3xl"></div>
        <div id="ms-hero" class="relative p-6 sm:px-8 sm:py-7"></div>
    </section>

    <!-- Inbox: thread list + conversation -->
    <div class="grid lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[25rem_minmax(0,1fr)] rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden lg:h-[calc(100vh-13rem)] lg:min-h-[34rem]">

        <!-- List -->
        <div id="ms-list-pane" class="flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-800">
            <div class="p-3 space-y-2.5 border-b border-gray-100 dark:border-gray-800">
                <div class="relative">
                    <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input type="search" id="ms-search" autocomplete="off" placeholder="Search name, email, subject…"
                        class="block w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-primary-500/20 outline-none transition">
                </div>
                <div id="ms-filters" class="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/70" role="group" aria-label="Show"></div>
            </div>
            <div id="ms-list" class="flex-1 min-h-0 overflow-y-auto custom-scrollbar max-h-[32rem] lg:max-h-none" aria-live="polite"></div>
        </div>

        <!-- Conversation -->
        <div id="ms-thread-pane" class="hidden lg:flex flex-col min-h-[28rem] lg:min-h-0"></div>
    </div>

    <script type="application/json" id="messages-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
