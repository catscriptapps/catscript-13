<?php
// /resources/views/components/tasks/list.php
//
// Grouped task list (TasksController::renderList()). Rendered server-side
// both on first page load and for every AJAX refresh of the list.

use Src\Controller\TasksController;

/** @var array $groups   TasksController::groups() output */
/** @var string $view */
/** @var bool $capped    More results exist than were shown */
/** @var bool $isSearch */

$assetBase = getAssetBase();

$toneHeading = [
    'past'    => 'text-red-600 dark:text-red-400',
    'today'   => 'text-primary-600 dark:text-primary-400',
    'soon'    => 'text-amber-600 dark:text-amber-400',
    'neutral' => 'text-gray-500 dark:text-gray-400',
];

$emptyCopy = $isSearch
    ? ['No matching tasks', 'Try a different word — search covers every task, past and future.']
    : match ($view) {
        'today' => ['Nothing due today', 'Enjoy the breathing room, or add something new.'],
        'week'  => ['Nothing in the next 7 days', 'Your week is clear.'],
        'past'  => ['No past tasks', 'Tasks show up here once their date has passed.'],
        default => ['No tasks yet', 'Add your first task to get started.'],
    };
?>
<?php if (!$groups): ?>
    <div class="py-16 text-center">
        <div class="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 mb-4">
            <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        </div>
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200"><?= $emptyCopy[0] ?></p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1"><?= $emptyCopy[1] ?></p>
    </div>
<?php else: ?>
    <div class="space-y-6">
        <?php foreach ($groups as $group): ?>
            <section>
                <h3 class="px-4 mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider <?= $toneHeading[$group['tone']] ?? $toneHeading['neutral'] ?>">
                    <?= htmlspecialchars($group['label']) ?>
                    <span class="font-semibold text-gray-400 dark:text-gray-500"><?= count($group['tasks']) ?></span>
                </h3>
                <ul class="divide-y divide-gray-100 dark:divide-gray-800/70">
                    <?php foreach ($group['tasks'] as $task): ?>
                        <?php $t = TasksController::present($task);
                        include __DIR__ . '/item.php'; ?>
                    <?php endforeach; ?>
                </ul>
            </section>
        <?php endforeach; ?>

        <?php if ($capped): ?>
            <p class="px-4 text-xs text-gray-500 dark:text-gray-400">Showing the most recent results. Search to find something older.</p>
        <?php endif; ?>
    </div>
<?php endif; ?>
