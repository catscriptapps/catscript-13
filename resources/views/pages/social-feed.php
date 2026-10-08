<?php
// /resources/views/pages/social-feed.php

declare(strict_types=1);

/**
 * CatScript Apps - Social Feed
 *
 * Ported from the legacy gonachi/ platform (resources/views/pages/
 * social-feed.php): guests get a try-it feed that lives only in their
 * browser (utils/social-feed/guest-feed.js — see the (!$isLoggedIn) branch);
 * logged-in users get a feed scoped to their own posts + posts from people
 * they follow (never a global stream — see SocialFeedController::feed()).
 *
 * @var bool $isLoggedIn
 * @var string $baseUrl
 * @var string $assetBase
 * @var string|null $path
 */

use Src\Controller\SocialFeedController;
use Src\Service\AuthService;

// Guests get the try-it feed below; signed-in users need Social Feed
// assigned to them (Users → App Access).
if ($isLoggedIn && !AuthService::hasAccess('Social Feed')) {
    include __DIR__ . '/access-denied.php';
    return;
}

$breadcrumbs = [['label' => $isLoggedIn ? 'Social Feed' : 'Social Feed (guest)']];
$breadcrumbAccent = 'teal';

$viewerId = $isLoggedIn ? AuthService::userId() : null;
$feedHtml = '';

if ($isLoggedIn) {
    $posts = SocialFeedController::feed($viewerId);
    foreach ($posts as $post) {
        $feedHtml .= SocialFeedController::renderPostCard($post, $viewerId);
    }
}
?>
<div class="space-y-6">
    <?php include __DIR__ . '/../components/breadcrumbs.php'; ?>

    <?php if (!$isLoggedIn): ?>
        <?php
        // Guests get a try-it feed that lives only in this browser (utils/social-feed/guest-feed.js)
        $demoApp = 'Social Feed';
        $demoText = 'a few sample people and their posts';
        $demoIdPrefix = 'social';
        include __DIR__ . '/../components/guest-demo-banner.php';
        $guestSlides = \Src\Utils\CuratedPhotos::fromHomeFolder($assetBase);
        ?>
        <div id="social-guest" class="grid grid-cols-1 lg:grid-cols-12 gap-6" data-slides="<?= htmlspecialchars(json_encode(array_slice($guestSlides, 0, 6)), ENT_QUOTES) ?>">
            <div class="lg:col-span-8 space-y-6">
                <div>
                    <h1 class="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Social Feed</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 font-medium">Your posts and posts from the people you follow — never a noisy global stream.</p>
                </div>

                <form id="guest-feed-composer" class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4" novalidate>
                    <div class="flex items-start space-x-3">
                        <div class="h-10 w-10 rounded-full bg-secondary-600 flex items-center justify-center text-white font-bold flex-shrink-0">Y</div>
                        <textarea name="content" rows="2" maxlength="2000" placeholder="What's on your mind?" aria-label="What's on your mind?"
                            class="flex-1 resize-y rounded-2xl bg-gray-50 dark:bg-gray-800 border-0 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500/30 outline-none"></textarea>
                    </div>
                    <div id="guest-feed-photo" class="pl-[3.25rem]"></div>
                    <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <button type="button" data-g-add-photo class="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                            <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            Photo
                        </button>
                        <button type="submit" class="ml-auto inline-flex items-center justify-center rounded-xl bg-primary-600 px-5 py-2 text-sm font-black text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all active:scale-95">Share Post</button>
                    </div>
                </form>

                <div id="guest-feed-posts" class="space-y-4" aria-live="polite"></div>
            </div>
            <aside id="guest-feed-people" class="lg:col-span-4 lg:sticky lg:top-24 self-start space-y-6"></aside>
        </div>
    <?php else: ?>
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

        <div class="lg:col-span-8 space-y-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-black text-gray-900 dark:text-white font-sans tracking-tight">Social Feed</h1>
                    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400 font-medium">
                        See what's happening across the network. Share updates, photos, and videos.
                    </p>
                </div>
                <button type="button" id="create-post-btn"
                    class="inline-flex items-center justify-center rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-black text-white shadow-lg shadow-primary-600/20 hover:bg-primary-700 transition-all active:scale-95">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Share Post
                </button>
            </div>

            <!-- Composer Shortcut -->
            <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-4">
                <div class="flex items-center space-x-3">
                    <?php $me = AuthService::currentUser(); $meAvatar = $me->avatar_url ?? null; ?>
                    <?php if ($meAvatar): ?>
                        <img src="<?= $assetBase ?>images/uploads/avatars/<?= htmlspecialchars($meAvatar) ?>" class="h-10 w-10 rounded-full object-cover flex-shrink-0 border border-gray-100 dark:border-gray-800">
                    <?php else: ?>
                        <div class="h-10 w-10 rounded-full bg-primary-600 flex items-center justify-center text-white font-bold flex-shrink-0"><?= strtoupper(substr($me->full_name ?? 'U', 0, 1)) ?></div>
                    <?php endif; ?>
                    <button type="button" id="composer-shortcut-btn" class="flex-1 text-left px-4 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-full text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/70 transition-colors">
                        What's on your mind?
                    </button>
                </div>
                <div class="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <button type="button" id="composer-photo-btn" class="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Photo
                    </button>
                    <button type="button" id="composer-video-btn" class="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        Video
                    </button>
                </div>
            </div>

            <div id="social-feed-container" class="space-y-4">
                <?php if ($feedHtml === ''): ?>
                    <div data-empty-feed class="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl p-10 text-center">
                        <svg class="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                        <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Your feed is quiet</h4>
                        <p class="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto mt-1">
                            Share your first update, or follow people from the sidebar to see their posts here.
                        </p>
                    </div>
                <?php else: ?>
                    <?= $feedHtml ?>
                <?php endif; ?>
            </div>
        </div>

        <?php include __DIR__ . '/../components/social-feed/sidebar.php'; ?>
    </div>

    <?php include __DIR__ . '/../components/social-feed/view-post-modal.php'; ?>
    <?php endif; ?>
</div>
