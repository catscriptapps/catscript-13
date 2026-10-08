<?php
// /resources/views/pages/tasks.php
//
// Tasks app. First render is server-side (current view); after that the
// tabs, search, add, edit and delete all refresh #tasks-list via
// server/api/tasks.php (see resources/js/pages/tasks-page.js).
//
// Three audiences (as with Cash Flow):
//   - guests (not signed in): a try-it demo. data-mode="guest" makes the page
//     script keep tasks in this browser's localStorage (seeded with sample
//     tasks) and render the list locally — nothing reaches the server.
//   - signed in without Tasks access: access denied.
//   - signed in with access: the shared task list from catscript_db.

declare(strict_types=1);

use Src\Controller\TasksController;
use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

$isGuest = !AuthService::isLoggedIn();

if (!$isGuest && !AuthService::hasAccess('Tasks')) {
    include __DIR__ . '/access-denied.php';
    return;
}

// Guests: empty shell; tasks-page.js fills the list and counts from localStorage.
$counts = $isGuest ? ['current' => 0, 'today' => 0, 'week' => 0, 'past' => 0] : TasksController::counts();
$list = $isGuest ? ['html' => ''] : TasksController::renderList('current');
// Live hero: today + the next 30 days (guests: built from localStorage)
$upcoming = $isGuest ? [] : TasksController::upcoming();
$slides = CuratedPhotos::fromHomeFolder($assetBase);

$tabs = [
    'current' => ['label' => 'Current', 'hint' => 'Last 10 days & upcoming'],
    'today'   => ['label' => 'Today', 'hint' => 'Due today'],
    'week'    => ['label' => 'Next 7 days', 'hint' => 'Today and the 6 days after'],
    'past'    => ['label' => 'Past', 'hint' => 'Before today'],
];
?>
<div id="tasks-page" class="space-y-6" data-mode="<?= $isGuest ? 'guest' : 'account' ?>" data-slides="<?= htmlspecialchars(json_encode($slides), ENT_QUOTES) ?>">

    <?php
    $breadcrumbs = [['label' => $isGuest ? 'Tasks (guest)' : 'Tasks']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <?php if ($isGuest): ?>
        <?php
        $demoApp = 'Tasks';
        $demoText = 'sample bills and to-dos';
        $demoIdPrefix = 'tasks';
        include __DIR__ . '/../components/guest-demo-banner.php';
        ?>
    <?php endif; ?>

    <!-- Hero: photo slideshow + what's due now, what's next, and what's coming up.
         Live: tasks-page.js redraws it every 30 seconds and re-syncs when idle. -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div id="tasks-hero" class="relative p-6 sm:px-10 sm:py-8 min-h-[14rem]"></div>
    </section>

    <!-- Toolbar -->
    <div class="flex items-center gap-3">
        <div class="relative flex-1 md:flex-none md:w-80">
            <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="search" id="tasks-search" autocomplete="off" placeholder="Search all tasks…"
                class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-9 pr-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition">
        </div>
        <button type="button" id="add-task-btn"
            class="md:ml-auto flex-shrink-0 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" /></svg>
            <span class="hidden sm:inline">Add task</span>
        </button>
    </div>

    <!-- List card -->
    <section class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
        <div class="flex items-center justify-between gap-3 px-4 sm:px-6 border-b border-gray-100 dark:border-gray-800">
            <nav id="tasks-tabs" class="flex gap-1 overflow-x-auto -mb-px" aria-label="Task views">
                <?php foreach ($tabs as $key => $tab): ?>
                    <?php $active = $key === 'current'; ?>
                    <button type="button" data-view="<?= $key ?>" title="<?= htmlspecialchars($tab['hint']) ?>"
                        aria-pressed="<?= $active ? 'true' : 'false' ?>"
                        class="tasks-tab whitespace-nowrap inline-flex items-center gap-2 px-3 py-3.5 text-sm font-semibold border-b-2 transition-colors <?= $active ? 'border-primary-600 text-primary-700 dark:text-primary-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200' ?>">
                        <?= $tab['label'] ?>
                        <span data-count="<?= $key ?>" class="text-xs font-semibold px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"><?= $counts[$key] ?></span>
                    </button>
                <?php endforeach; ?>
            </nav>
            <p id="tasks-search-status" class="hidden text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap py-3.5"></p>
        </div>

        <div id="tasks-list" class="p-2 sm:p-3 min-h-[12rem] transition-opacity" aria-live="polite">
            <?= $list['html'] ?>
        </div>
    </section>

    <script type="application/json" id="tasks-hero-data"><?= json_encode($upcoming, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
