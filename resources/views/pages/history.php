<?php
// /resources/views/pages/history.php

declare(strict_types=1);

use Src\Service\AuthService;

if (AuthService::isLoggedIn()) {
    $controller = new \Src\Controller\RecentActivitiesController();
    // Assuming index() sets $GLOBALS['historyRows'] via the paginate method
    $controller->index();

    $historyRows = $GLOBALS['historyRows'] ?? '';
?>

    <div class="space-y-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div class="flex-1">
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white font-sans">History</h1>
                <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Track system changes, user actions, and security events across the platform.
                </p>
            </div>

            <div class="mt-4 md:mt-0 flex flex-row gap-3 items-center">
                <div class="relative flex-1 md:w-64">
                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input type="text" id="history-search"
                        class="block w-full rounded-xl border-2 border-gray-400 dark:border-gray-600 bg-white dark:bg-gray-900 py-2 pl-10 pr-3 text-sm placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 text-gray-900 dark:text-white transition-all font-sans"
                        placeholder="Search history...">
                </div>

            </div>
        </div>

        <div class="bg-white dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
            <div class="overflow-x-auto overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 lg:table-fixed">
                    <thead class="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider font-sans">User / Action</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell font-sans">Entity Type</th>
                            <th class="px-6 py-4 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell font-sans">Timestamp</th>
                            <th class="relative px-6 py-4 text-right w-24 hidden md:table-cell">
                                <span class="sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody id="history-tbody" class="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900">
                        <?php if (empty($historyRows)): ?>
                            <tr>
                                <td colspan="5" class="px-6 py-12 text-center text-gray-500 dark:text-gray-400 font-sans">
                                    <div class="flex flex-col items-center">
                                        <svg class="h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p class="font-medium">No activity history found</p>
                                    </div>
                                </td>
                            </tr>
                        <?php else: ?>
                            <?= $historyRows ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>

            <?php
            $footerCountName = 'history';
            include __DIR__ . '/../components/ui/footer-count.php';
            ?>
        </div>
    </div>

<?php include __DIR__ . '/../components/history/archive-modal.php';
} else {
    if (!AuthService::isLoggedIn()) include __DIR__ . '/auth-required.php';
}
