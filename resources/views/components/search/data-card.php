<?php
// /resources/views/components/search/data-card.php

/** @var object $item */
/** @var string $assetBase */

$title = $item->title ?? 'Untitled';
$location = $item->location_label ?? 'Unknown Location';
$avatar = $item->avatar_url ? $assetBase . 'images/uploads/avatars/' . $item->avatar_url : null;
$initials = strtoupper(substr($item->first_name ?? $title, 0, 1));

// Handling user types as an iterable array for the loop
$userTypes = is_string($item->user_types) ? json_decode($item->user_types, true) : $item->user_types;
$userTypes = is_array($userTypes) ? $userTypes : [];

$modalAttrs = $item->modal_attrs ?? [];
?>

<div class="group flex items-start gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-secondary-900/20 transition-all mb-3 hover:bg-primary-50 dark:hover:bg-gray-800">

    <div class="w-12 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 dark:bg-secondary-900 border border-gray-100 dark:border-secondary-800 text-primary-400 flex items-center justify-center shadow-sm">
        <?php if ($avatar): ?>
            <img src="<?= $avatar ?>" alt="<?= htmlspecialchars($title) ?>" class="w-full h-full object-cover">
        <?php else: ?>
            <span class="text-xl font-black"><?= $initials ?></span>
        <?php endif; ?>
    </div>

    <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-4 mb-0.5">
            <h4 class="text-sm font-black text-secondary-900 dark:text-white truncate uppercase tracking-tight">
                <?= htmlspecialchars((string)$title) ?>
            </h4>

            <button class="view-mentor-trigger flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary-400 text-white text-[11px] font-black uppercase tracking-wider hover:bg-secondary-500 transition-colors shadow-sm shadow-primary-400/20"
                data-from-notification="true"
                <?php foreach ($modalAttrs as $key => $value): ?>
                data-<?= $key ?>="<?= htmlspecialchars((string)$value) ?>"
                <?php endforeach; ?>>
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Contact
            </button>
        </div>

        <div class="flex items-center gap-1.5 text-gray-400 mb-2">
            <svg class="w-3.5 h-3.5 flex-shrink-0 text-primary-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
            <p class="text-[11px] truncate font-bold tracking-widest uppercase opacity-70">
                <?= htmlspecialchars($location) ?>
            </p>
        </div>

        <div class="flex flex-wrap gap-1.5">
            <?php foreach ($userTypes as $type): ?>
                <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-gray-100 dark:bg-secondary-900 text-gray-500 dark:text-gray-400 uppercase border border-gray-200 dark:border-secondary-800 shadow-sm">
                    <?= htmlspecialchars($type) ?>
                </span>
            <?php endforeach; ?>
        </div>
    </div>
</div>