<?php
// /resources/views/components/users/social-search-item.php
//
// One row in the Social Feed sidebar's "Who to follow" list or people
// search results. @var array $data {id, name, username, avatar, is_following}
// from Src\Controller\SocialRelationsController — see
// resources/views/components/social-feed/sidebar.php for usage.

/** @var array $data */
/** @var string $assetBase */

$userId = $data['id'] ?? 0;
$name = $data['name'] ?? 'User';
$username = $data['username'] ?? '';
$avatar = $data['avatar'] ?? null;
$isFollowing = $data['is_following'] ?? false;

$avatarUrl = $avatar ? htmlspecialchars($assetBase . 'images/uploads/avatars/' . ltrim($avatar, '/')) : null;
$initials = strtoupper(substr($name ?: 'U', 0, 1));
?>
<div class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-xl" data-user-row="<?= (int) $userId ?>">
    <div class="flex items-center gap-3 min-w-0">
        <?php if ($avatarUrl): ?>
            <img src="<?= $avatarUrl ?>" class="h-9 w-9 rounded-xl object-cover border border-gray-100 dark:border-gray-700 flex-shrink-0">
        <?php else: ?>
            <div class="h-9 w-9 rounded-xl bg-primary-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0"><?= $initials ?></div>
        <?php endif; ?>

        <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-gray-900 dark:text-white truncate"><?= htmlspecialchars($name) ?></span>
            <span class="text-[11px] text-gray-500 font-medium tracking-tight truncate">@<?= htmlspecialchars($username) ?></span>
        </div>
    </div>

    <button type="button"
        data-follow-toggle="<?= (int) $userId ?>"
        data-following="<?= $isFollowing ? '1' : '0' ?>"
        class="follow-toggle-btn flex-shrink-0 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 <?= $isFollowing ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400' : 'bg-secondary-500 hover:bg-primary-500 text-white' ?>">
        <?= $isFollowing ? 'Following' : 'Follow' ?>
    </button>
</div>
