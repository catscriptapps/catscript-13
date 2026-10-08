<?php
// /resources/views/components/users/data-row.php

/** @var array $rowItem */
/** @var string $assetBase */

// Fetch the real type names from the DB once if not already available
if (!isset($GLOBALS['allUserTypes'])) {
    $types = \Src\Controller\UserTypesController::list();
    $GLOBALS['allUserTypes'] = [];
    foreach ($types as $t) {
        $GLOBALS['allUserTypes'][$t->user_type_id] = $t->user_type;
    }
}

$hasAvatar = !empty($rowItem['avatar_url']);
$AVATAR_DIR_PREFIX = $assetBase . 'images/uploads/avatars/';
$avatarUrl = $hasAvatar ? htmlspecialchars($AVATAR_DIR_PREFIX . $rowItem['avatar_url']) : '';

$fullName = $rowItem['full_name'] ?? trim(($rowItem['first_name'] ?? '') . ' ' . ($rowItem['last_name'] ?? ''));
if (empty($fullName)) $fullName = 'Unknown User';

// Core accounts (#1 Cat, #2 Ella) can't be deleted — the real enforcement is
// UsersController::PROTECTED_USER_IDS. Only #1 is locked as Admin (the edit
// modal disables its Admin checkbox; UsersController re-adds Admin on save),
// so everyone else — Ella included — gets exactly the apps assigned to them.
$isProtectedAccount = in_array((int) ($rowItem['id'] ?? 0), [1, 2], true);
$isAdminLocked = (int) ($rowItem['id'] ?? 0) === 1;

// Prepare data attributes - user-type-ids is passed as a JSON string
$userDataAttrs = [
    'encoded-id'    => $rowItem['encoded_id'] ?? '',
    'full-name'     => $fullName,
    'first-name'    => $rowItem['first_name'] ?? '',
    'last-name'     => $rowItem['last_name'] ?? '',
    'email'         => $rowItem['email'] ?? '',
    'city'          => $rowItem['city'] ?? '',
    'country-id'    => $rowItem['country_id'] ?? 0,
    'region-id'     => $rowItem['region_id'] ?? 0,
    'region-name'   => $rowItem['region_name'] ?? 'N/A',
    'country-name'  => $rowItem['country_name'] ?? 'N/A',
    'avatar-url'    => $avatarUrl,
    'joined'        => $rowItem['created_at_formatted'] ?? 'N/A',
    'is-active'     => (int)($rowItem['status_id'] ?? 0) === 1 ? '1' : '0',
    'is-protected'  => $isAdminLocked ? '1' : '0', // locks the Admin role checkbox
    'permitted-apps' => json_encode(array_values((array) ($rowItem['permitted_apps'] ?? []))),
    'user-type-ids' => json_encode($rowItem['user_type_ids'] ?? []),
    // Pass the actual names for the View Modal badges
    'user-types'    => json_encode(array_map(function ($tid) {
        return $GLOBALS['allUserTypes'][$tid] ?? 'User';
    }, $rowItem['user_type_ids'] ?? []))
];

$editClass = 'edit-user-btn';
$deleteClass = 'delete-user-btn';

$statusBadge = (int)($rowItem['status_id'] ?? 0) === 1
    ? '<span class="inline-flex items-center rounded-full bg-primary-50 dark:bg-primary-900/20 px-2.5 py-0.5 text-xs font-bold text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/30">Current</span>'
    : '<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-bold text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">Archived</span>';

/**
 * Renders badges using the Global DB-fetched map
 */
$renderRoleBadges = function ($typeIds) {
    if (empty($typeIds)) return '<span class="text-gray-400 text-xs italic">No roles</span>';

    $html = '<div class="flex flex-wrap gap-1">';
    foreach ($typeIds as $tid) {
        $label = $GLOBALS['allUserTypes'][$tid] ?? 'User';
        $html .= '<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">' . htmlspecialchars((string)$label) . '</span>';
    }
    return $html . '</div>';
};

?>

<tr id="user-row-<?= $rowItem['id'] ?? '0' ?>"
    data-encoded-id="<?= $rowItem['encoded_id'] ?? '' ?>"
    class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group border-b border-gray-100 dark:border-gray-800 font-sans">

    <td class="px-6 py-4 min-w-0">
        <div class="flex items-start lg:items-center min-w-0">
            <?php if ($hasAvatar): ?>
                <img class="h-10 w-10 flex-shrink-0 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                    src="<?= $avatarUrl ?>" alt="<?= htmlspecialchars($fullName) ?>">
            <?php else: ?>
                <div class="h-10 w-10 flex-shrink-0 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                    <?= strtoupper(substr($rowItem['first_name'] ?? 'U', 0, 1)) ?>
                </div>
            <?php endif; ?>

            <div class="ml-4 flex-1 min-w-0">
                <div class="view-user-trigger cursor-pointer block min-w-0"
                    <?php foreach ($userDataAttrs as $key => $val): ?>
                    data-<?= $key ?>='<?= htmlspecialchars((string)$val, ENT_QUOTES) ?>'
                    <?php endforeach; ?>>

                    <div class="flex items-center justify-between lg:block">
                        <div class="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors truncate">
                            <?= htmlspecialchars($fullName) ?>
                        </div>
                        <div class="lg:hidden flex-shrink-0 ml-2">
                            <?= $statusBadge ?>
                        </div>
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 truncate">
                        <?= htmlspecialchars($rowItem['email'] ?? '') ?>
                    </div>
                </div>

                <div class="mt-3 lg:hidden flex items-center gap-2">
                    <?php
                    $isMobile = true;
                    $dataAttrs = $userDataAttrs;
                    $hideDelete = $isProtectedAccount;
                    include __DIR__ . '/../ui/action-buttons.php';
                    ?>
                </div>
            </div>
        </div>
    </td>

    <td class="px-6 py-4 hidden lg:table-cell">
        <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
            <?= htmlspecialchars($rowItem['city'] ?? 'N/A') ?>
        </div>
        <div class="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-tight mt-0.5">
            <?= htmlspecialchars($rowItem['region_name'] ?? 'N/A') ?>, <?= htmlspecialchars($rowItem['country_name'] ?? 'N/A') ?>
        </div>
    </td>

    <td class="px-6 py-4 hidden lg:table-cell">
        <?= $renderRoleBadges($rowItem['user_type_ids'] ?? []) ?>
    </td>

    <td class="px-6 py-4 hidden lg:table-cell">
        <div class="text-[12px] text-gray-600 dark:text-gray-400">
            <span class="block font-bold text-gray-400 uppercase text-[10px] tracking-widest text-secondary-400">Joined</span>
            <?= $rowItem['created_at_formatted'] ?? 'N/A' ?>
        </div>
    </td>

    <td class="px-6 py-4 hidden lg:table-cell">
        <?= $statusBadge ?>
    </td>

    <td class="px-6 py-4 text-right hidden lg:table-cell">
        <?php
        $isMobile = false;
        $dataAttrs = $userDataAttrs;
        $hideDelete = $isProtectedAccount;
        include __DIR__ . '/../ui/action-buttons.php';
        ?>
    </td>
</tr>