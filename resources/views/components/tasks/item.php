<?php
// /resources/views/components/tasks/item.php
//
// One task in the list. `data-task` carries the task's display data as JSON
// for the view / edit modals (resources/js/pages/tasks-page.js).
//
// @var array $t    TasksController::present() output
// @var string $assetBase

$toneBadge = [
    'past'    => 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
    'today'   => 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
    'soon'    => 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    'neutral' => 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
][$t['status']['tone']] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';
?>
<li class="task-item group relative flex items-start gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    data-encoded-id="<?= $t['encoded_id'] ?>"
    data-task="<?= htmlspecialchars(json_encode($t, JSON_UNESCAPED_UNICODE), ENT_QUOTES) ?>">

    <!-- Date badge -->
    <div class="h-12 w-12 flex-shrink-0 rounded-xl flex flex-col items-center justify-center <?= $toneBadge ?>">
        <span class="text-[11px] font-semibold uppercase leading-none"><?= htmlspecialchars($t['month']) ?></span>
        <span class="text-lg font-bold leading-tight"><?= htmlspecialchars($t['day']) ?></span>
    </div>

    <!-- Body (click to view) -->
    <button type="button" class="task-view-btn min-w-0 flex-1 text-left focus:outline-none">
        <span class="block text-sm font-semibold text-gray-900 dark:text-white break-words group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors"><?= htmlspecialchars($t['title']) ?></span>
        <?php if ($t['detail'] !== ''): ?>
            <span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 break-words"><?= htmlspecialchars($t['detail']) ?></span>
        <?php endif; ?>
        <span class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            <span class="inline-flex items-center gap-1">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <?= htmlspecialchars($t['time_label']) ?>
            </span>
            <?php if ($t['status']['label'] !== ''): ?>
                <span class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold <?= $toneBadge ?>"><?= htmlspecialchars($t['status']['label']) ?></span>
            <?php endif; ?>
            <span class="inline-flex items-center gap-1.5" title="Added by <?= htmlspecialchars($t['author']) ?>">
                <?php if (!empty($t['author_avatar'])): ?>
                    <img src="<?= $assetBase ?>images/uploads/avatars/<?= htmlspecialchars($t['author_avatar']) ?>" alt="" class="h-4 w-4 rounded-full object-cover">
                <?php else: ?>
                    <span class="h-4 w-4 rounded-full bg-secondary-500 text-white text-[10px] font-bold flex items-center justify-center"><?= htmlspecialchars($t['author_initial']) ?></span>
                <?php endif; ?>
                <?= htmlspecialchars(explode(' ', $t['author'])[0]) ?>
            </span>
        </span>
    </button>

    <!-- Actions (always visible on touch, on hover for mouse) -->
    <div class="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button type="button" class="task-edit-btn p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors" title="Edit task" aria-label="Edit task">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        <button type="button" class="task-delete-btn p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" title="Delete task" aria-label="Delete task">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
    </div>
</li>
