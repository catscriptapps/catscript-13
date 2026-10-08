<?php
// /resources/views/components/ui/action-buttons.php

/**
 * @var string $editClass   The class for the edit button (e.g., 'edit-invoice-btn')
 * @var string $deleteClass The class for the delete button (e.g., 'delete-invoice-btn')
 * @var array  $dataAttrs   Associative array of data attributes (e.g., ['id' => 1])
 * @var bool   $isMobile    Whether to render the mobile version (with text labels)
 * @var bool   $hideDelete  Optional. When true, renders a disabled placeholder
 *                          instead of the delete button (e.g. protected core accounts).
 */

$hideDelete = $hideDelete ?? false;

$dataString = '';
foreach ($dataAttrs as $key => $value) {
    $dataString .= ' data-' . htmlspecialchars($key) . '="' . htmlspecialchars((string)$value) . '"';
}
?>

<?php if ($isMobile): ?>
    <div class="flex items-center gap-4 pt-3 lg:hidden">
        <button type="button" title="Edit card" class="<?= $editClass ?> text-xs font-bold text-primary-600 flex items-center gap-1.5 p-1" <?= $dataString ?>>
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
        </button>

        <?php if ($hideDelete): ?>
            <span title="This is a core account and cannot be deleted" class="text-xs font-bold text-gray-300 dark:text-gray-700 flex items-center gap-1.5 p-1 cursor-not-allowed">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
            </span>
        <?php else: ?>
            <button type="button" title="Delete card" class="<?= $deleteClass ?> text-xs font-bold text-red-500 flex items-center gap-1.5 p-1" <?= $dataString ?>>
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
            </button>
        <?php endif; ?>
    </div>

<?php else: ?>
    <div class="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" title="Edit row" class="<?= $editClass ?> text-primary-600 hover:text-primary-900 p-1" <?= $dataString ?>>
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        </button>

        <?php if ($hideDelete): ?>
            <span title="This is a core account and cannot be deleted" class="text-gray-300 dark:text-gray-700 p-1 cursor-not-allowed">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </span>
        <?php else: ?>
            <button type="button" title="Delete row" class="<?= $deleteClass ?> text-gray-400 hover:text-red-600 p-1" <?= $dataString ?>>
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        <?php endif; ?>
    </div>
<?php endif; ?>