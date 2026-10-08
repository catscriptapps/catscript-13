<?php
// /resources/views/components/social-feed/post-card.php

/** @var array $data Received from the controller */
/** @var string $assetBase */

$postId = $data['encoded_id'] ?? '';
$author = $data['author'] ?? 'User';
$avatar = $data['author_avatar'] ?? null;
$content = $data['content'] ?? '';
$timeAgo = $data['time_ago'] ?? '';
$likeCount = $data['like_count'] ?? 0;
$commentCount = $data['comment_count'] ?? 0;
$isLiked = $data['is_liked'] ?? false;
$mediaUrl = $data['media_url'] ?? null;
$mediaType = $data['media_type'] ?? 'none';

$hasMedia = !empty($mediaUrl);

// 🍊 Directory Configuration
$POSTS_DIR_PREFIX = $assetBase . 'images/uploads/posts/';
$VIDEOS_DIR_PREFIX = $assetBase . 'videos/'; // Matches your successful upload path
$AVATAR_DIR_PREFIX = $assetBase . 'images/uploads/avatars/';

// 🍊 Path Resolution based on Media Type
$currentPrefix = ($mediaType === 'video') ? $VIDEOS_DIR_PREFIX : $POSTS_DIR_PREFIX;
$fullMediaUrl = $hasMedia ? htmlspecialchars($currentPrefix . ltrim($mediaUrl, '/')) : '';
$fullAvatarUrl = !empty($avatar) ? htmlspecialchars($AVATAR_DIR_PREFIX . ltrim($avatar, '/')) : null;

$initials = strtoupper(substr($author ?? 'U', 0, 1));

$authorId = $data['author_id'] ?? 0;
$currentUserId = \Src\Service\AuthService::userId();
$isOwnPost = ((int)$authorId === (int)$currentUserId);
?>

<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md"
    data-post-id="<?= $postId ?>">

    <div class="p-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">
            <?php if ($fullAvatarUrl): ?>
                <img src="<?= $fullAvatarUrl ?>"
                    alt="<?= htmlspecialchars($author) ?>"
                    class="h-10 w-10 rounded-full object-cover border border-gray-100 dark:border-gray-800 shadow-sm user-avatar-img">
            <?php else: ?>
                <div class="avatar-initials h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                    <?= $initials ?>
                </div>
            <?php endif; ?>

            <div>
                <h3 class="post-author-name text-sm font-bold text-gray-900 dark:text-white font-sans leading-none">
                    <?= htmlspecialchars($author) ?>
                </h3>
                <p class="post-time-ago text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <?= $timeAgo ?>
                </p>
            </div>
        </div>

        <?php if ($isOwnPost): ?>
            <div class="relative post-options-container">
                <button class="post-options-btn text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
                    data-post-id="<?= $postId ?>">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                </button>

                <div class="hidden absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 post-options-menu">
                    <div class="py-1">
                        <button class="delete-post-btn w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center space-x-2"
                            data-post-id="<?= $postId ?>">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete Post</span>
                        </button>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <div class="px-4 pb-3">
        <p class="text-gray-800 dark:text-gray-200 text-sm leading-relaxed font-sans">
            <?= nl2br(htmlspecialchars($content)) ?>
        </p>
    </div>

    <?php if ($hasMedia): ?>
        <div class="mt-2 bg-gray-100 dark:bg-gray-800 flex justify-center items-center overflow-hidden border-y border-gray-100 dark:border-gray-800">
            <?php if ($mediaType === 'image'): ?>
                <img src="<?= $fullMediaUrl ?>"
                    alt="Post Media"
                    class="max-h-96 w-full object-contain cursor-pointer hover:opacity-95 transition-opacity post-media-trigger post-main-media">
            <?php elseif ($mediaType === 'video'): ?>
                <video controls preload="metadata" class="max-h-96 w-full object-contain post-main-media bg-black">
                    <source src="<?= $fullMediaUrl ?>" type="video/mp4">
                    <source src="<?= $fullMediaUrl ?>" type="video/webm">
                    <source src="<?= $fullMediaUrl ?>" type="video/quicktime">
                    Your browser does not support the video tag.
                </video>
            <?php endif; ?>
        </div>
    <?php endif; ?>

    <div class="px-4 py-3 flex items-center justify-between border-t border-gray-50 dark:border-gray-800/50">
        <div class="flex items-center space-x-6">
            <button type="button"
                class="like-toggle-btn flex items-center space-x-2 transition-all active:scale-110 <?= $isLiked ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500' ?>"
                data-id="<?= $postId ?>">
                <svg class="w-5 h-5 <?= $isLiked ? 'fill-current' : 'fill-none' ?>" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                <span class="text-xs font-bold font-sans like-count"><?= $likeCount ?></span>
            </button>

            <button type="button"
                class="view-comments-btn flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
                data-id="<?= $postId ?>">
                <svg class="w-5 h-5 fill-none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span class="text-xs font-bold font-sans"><?= $commentCount ?></span>
            </button>
        </div>

        <button type="button"
            class="hidden share-post-btn text-gray-400 hover:text-primary-500 transition-colors"
            data-id="<?= $postId ?>">
            <svg class="w-5 h-5 fill-none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
        </button>
    </div>
</div>