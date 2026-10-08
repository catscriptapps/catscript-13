<?php
// /resources/views/components/social-feed/comment-row.php

/** @var array $data */
/** @var string $assetBase */

$commentId = $data['id'] ?? 0;
$author = $data['author'] ?? 'User';
$avatar = $data['author_avatar'] ?? null;
$text = $data['comment_text'] ?? '';
$timeAgo = $data['time_ago'] ?? '';
$isOwn = $data['is_own'] ?? false;

$fullAvatarUrl = $avatar ? htmlspecialchars($assetBase . 'images/uploads/avatars/' . ltrim($avatar, '/')) : null;
$initials = strtoupper(substr($author ?: 'U', 0, 1));
?>
<div class="flex items-start gap-3 group" data-comment-id="<?= (int) $commentId ?>">
    <?php if ($fullAvatarUrl): ?>
        <img src="<?= $fullAvatarUrl ?>" alt="<?= htmlspecialchars($author) ?>" class="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-gray-100 dark:border-gray-800">
    <?php else: ?>
        <div class="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0"><?= $initials ?></div>
    <?php endif; ?>

    <div class="flex-1 min-w-0">
        <div class="bg-gray-50 dark:bg-gray-800 rounded-2xl px-3.5 py-2 inline-block max-w-full">
            <p class="text-xs font-bold text-gray-900 dark:text-white"><?= htmlspecialchars($author) ?></p>
            <p class="text-sm text-gray-700 dark:text-gray-300 break-words"><?= nl2br(htmlspecialchars($text)) ?></p>
        </div>
        <div class="flex items-center gap-3 mt-1 px-1">
            <span class="text-[11px] text-gray-400"><?= htmlspecialchars($timeAgo) ?></span>
            <?php if ($isOwn): ?>
                <button type="button" data-delete-comment="<?= (int) $commentId ?>" class="delete-comment-btn text-[11px] font-semibold text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Delete
                </button>
            <?php endif; ?>
        </div>
    </div>
</div>
