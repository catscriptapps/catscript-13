<?php
// /resources/views/components/history/data-row.php

use Src\Service\AuthService;

/** @var array $row */
/** @var string $assetBase */

// Configuration based on action type
$isDeletion = str_contains(strtolower($row['action']), 'delete');
$isCreation = str_contains(strtolower($row['action']), 'log') || str_contains(strtolower($row['action']), 'create');

$statusColor = 'text-gray-600 dark:text-gray-400';
$statusBg = 'bg-gray-50 dark:bg-gray-800/50';

if ($isDeletion) {
    $statusColor = 'text-rose-600 dark:text-rose-400';
    $statusBg = 'bg-rose-50 dark:bg-rose-500/10';
} elseif ($isCreation) {
    $statusColor = 'text-emerald-600 dark:text-emerald-400';
    $statusBg = 'bg-emerald-50 dark:bg-emerald-500/10';
}

// Data attributes for JS (Archive/Delete/Details actions)
$historyDataAttrs = [
    'id'          => $row['id'],
    'action'      => htmlspecialchars($row['action']),
    'entity-type' => htmlspecialchars($row['entity_type'] ?? 'System'),
    'entity-id'   => $row['entity_id'] ?? '',
    'user'        => htmlspecialchars($row['user_name']),
];

$dataAttrString = '';
foreach ($historyDataAttrs as $key => $value) {
    $dataAttrString .= " data-{$key}=\"{$value}\"";
}

$initial = strtoupper(substr($row['user_name'], 0, 1));
$isAdmin = (AuthService::isAdmin());

// Image SRC directory
$IMG_DIR_PREFIX = $assetBase . 'images/uploads/avatars/';
?>

<tr id="history-row-<?= $row['id'] ?>" <?= $dataAttrString ?>
    class="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-all group border-b border-gray-100 dark:border-gray-800 font-sans">

    <td class="px-6 py-4 align-top">
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <?php if (!empty($row['user_avatar'])): ?>
                    <img src="<?= $IMG_DIR_PREFIX . $row['user_avatar'] ?>"
                        class="h-10 w-10 rounded-xl object-cover border border-gray-200 dark:border-gray-700 shadow-sm" alt="User">
                <?php else: ?>
                    <div class="h-10 w-10 rounded-xl <?= $statusBg ?> flex items-center justify-center border border-gray-200 dark:border-gray-700 shadow-sm">
                        <span class="text-sm font-black <?= $statusColor ?>"><?= $initial ?></span>
                    </div>
                <?php endif; ?>
            </div>

            <div class="ml-4 flex-1">
                <div class="space-y-2 md:space-y-0">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="text-sm font-black text-gray-900 dark:text-white truncate">
                                <?= htmlspecialchars($row['user_name']) ?>
                            </span>
                            <span class="md:hidden text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                                • <?= $row['date_formatted'] ?>
                            </span>
                        </div>

                        <div class="flex md:hidden space-x-4">
                            <button type="button" data-action="delete-history"
                                class="<?= ($isAdmin) ? '' : 'hidden' ?> text-rose-500 font-black text-[11px] uppercase tracking-widest">
                                Delete
                            </button>
                        </div>
                    </div>

                    <span class="text-xs text-gray-500 dark:text-gray-400 italic line-clamp-1">
                        <?= htmlspecialchars($row['action']) ?>
                    </span>

                    <div class="md:hidden mt-2">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-lg <?= $statusBg ?> <?= $statusColor ?> border border-current/10 uppercase tracking-widest">
                            <?= $row['entity_type'] ?> <?= $row['entity_id'] ? '#' . $row['entity_id'] : '' ?>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </td>

    <td class="px-6 py-4 whitespace-nowrap hidden md:table-cell align-top">
        <span class="inline-flex items-center self-start px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-widest <?= $statusBg ?> <?= $statusColor ?> border border-current/10">
            <?= htmlspecialchars($row['entity_type'] ?? 'System') ?>
        </span>
    </td>

    <td class="px-6 py-4 whitespace-nowrap hidden md:table-cell align-top">
        <div class="flex flex-col">
            <span class="text-[12px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-tighter">
                <?= $row['date_formatted'] ?>
            </span>
            <span class="text-[11px] font-medium text-gray-400 uppercase">
                <?= $row['time_formatted'] ?>
            </span>
        </div>
    </td>

    <td class="px-6 py-4 whitespace-nowrap text-right hidden md:table-cell align-top">
        <div class="flex justify-end space-x-3 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button type="button" data-action="delete-history"
                class="<?= ($isAdmin) ? '' : 'hidden' ?> text-gray-400 hover:text-rose-600 p-1">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>
    </td>
</tr>