<?php
// /resources/views/pages/dashboard.php
//
// Signed-in home: a welcome card with a few real stats, the apps this user
// can open (NavigationConfig::authLinks(), permission-filtered), and their
// recent activity (admins see everyone's). Renders inside the app shell's
// normal content container like every other page.

declare(strict_types=1);

/** @var bool $isLoggedIn */
/** @var string $baseUrl */
/** @var string $assetBase */
/** @var \App\Models\User|null $currentUser */

use App\Models\Follow;
use App\Models\Post;
use App\Models\User;
use Src\Config\NavigationConfig;
use Src\Controller\RecentActivitiesController;
use Src\Service\AuthService;
use Src\Utils\ActivityIcons;

$navLinks = NavigationConfig::getNavLinks((bool) $isLoggedIn);
$icons = NavigationConfig::getIcons();
$isAdmin = AuthService::isAdmin();
$userId = (int) ($currentUser->id ?? 0);

$firstName = $currentUser?->first_name ?: 'there';
$hour = (int) date('G');
$greeting = $hour < 12 ? 'Good morning' : ($hour < 17 ? 'Good afternoon' : 'Good evening');

// Apps this user can open, minus the page they're already on.
$apps = array_filter($navLinks, fn($name) => $name !== 'Dashboard', ARRAY_FILTER_USE_KEY);

// Social stats only for people who have the Social Feed
$stats = AuthService::hasAccess('Social Feed')
    ? [
        ['label' => 'Your Posts', 'value' => Post::where('orig_user_id', $userId)->count()],
        ['label' => 'Followers', 'value' => Follow::where('following_id', $userId)->count()],
        ['label' => 'Following', 'value' => Follow::where('follower_id', $userId)->count()],
    ]
    : [['label' => 'Your Apps', 'value' => count($apps)]];
if ($isAdmin) {
    $stats[] = ['label' => 'Users', 'value' => User::count()];
}

// Legacy CatScript apps still being rebuilt (Src\Config\AppsCatalog).
$comingSoon = \Src\Config\AppsCatalog::comingSoon();
$appSections = NavigationConfig::sections(true);
$upcoming = NavigationConfig::upcoming();

$recentActivities = RecentActivitiesController::latest(8);

$avatarUrl = !empty($currentUser?->avatar_url) ? $assetBase . 'images/uploads/avatars/' . $currentUser->avatar_url : null;
?>

<div class="space-y-6">

    <!-- Welcome -->
    <section class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-secondary-600 to-secondary-900 text-white shadow-sm">
        <div class="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary-500/20 blur-3xl"></div>
        <div class="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div class="flex items-center gap-4 min-w-0">
                <?php if ($avatarUrl): ?>
                    <img src="<?= htmlspecialchars($avatarUrl) ?>" alt="" class="h-16 w-16 flex-shrink-0 rounded-2xl object-cover ring-4 ring-white/15">
                <?php else: ?>
                    <div class="h-16 w-16 flex-shrink-0 rounded-2xl bg-primary-500 flex items-center justify-center text-2xl font-bold ring-4 ring-white/15"><?= htmlspecialchars(strtoupper(substr($firstName, 0, 1))) ?></div>
                <?php endif; ?>
                <div class="min-w-0">
                    <p class="text-sm text-secondary-200"><?= date('l, F j') ?></p>
                    <h1 class="text-2xl sm:text-3xl font-bold tracking-tight"><?= $greeting ?>, <?= htmlspecialchars($firstName) ?></h1>
                    <p class="text-sm text-secondary-200 mt-0.5">Here's what's happening across your CatScript apps.</p>
                </div>
            </div>

            <div class="grid <?= count($stats) === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3' ?> gap-2 sm:gap-3 flex-shrink-0">
                <?php foreach ($stats as $stat): ?>
                    <div class="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 text-center min-w-[5.5rem]">
                        <span class="block text-2xl font-bold leading-none"><?= (int) $stat['value'] ?></span>
                        <span class="block text-[11px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5"><?= htmlspecialchars($stat['label']) ?></span>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </section>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">

        <!-- Your apps -->
        <section class="xl:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 self-start">
            <h2 class="text-base font-bold text-gray-900 dark:text-white mb-4">Your apps</h2>
            <!-- Grouped like the sidebar (NavigationConfig::sections) -->
            <div class="space-y-5">
                <?php foreach ($appSections as $sectionName => $links): ?>
                    <?php $links = array_filter($links, fn($name) => $name !== 'Dashboard', ARRAY_FILTER_USE_KEY); ?>
                    <?php if (!$links && empty($upcoming[$sectionName])) continue; ?>
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-2"><?= htmlspecialchars($sectionName) ?></p>
                        <div class="space-y-2">
                            <?php foreach ($links as $name => $app): ?>
                                <a href="<?= htmlspecialchars($app['url']) ?>" data-partial
                                    class="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-800 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                                    <span class="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400 [&>svg]:h-5 [&>svg]:w-5"><?= $icons[$name] ?? '' ?></span>
                                    <span class="min-w-0 flex-1">
                                        <span class="block text-sm font-semibold text-gray-900 dark:text-white"><?= htmlspecialchars($name) ?></span>
                                        <span class="block text-xs text-gray-500 dark:text-gray-400 truncate"><?= htmlspecialchars($app['summary'] ?? '') ?></span>
                                    </span>
                                    <svg class="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </a>
                            <?php endforeach; ?>
                            <?php foreach ($upcoming[$sectionName] ?? [] as $name): ?>
                                <div class="flex items-center gap-3 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-800" aria-disabled="true">
                                    <span class="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 [&>svg]:h-5 [&>svg]:w-5"><?= $icons[$name] ?? '' ?></span>
                                    <span class="min-w-0 flex-1">
                                        <span class="block text-sm font-semibold text-gray-500 dark:text-gray-400"><?= htmlspecialchars($name) ?></span>
                                        <span class="block text-xs text-gray-400 truncate">Being rebuilt — coming soon</span>
                                    </span>
                                    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">Soon</span>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>

            <?php $otherSoon = array_values(array_diff($comingSoon, array_merge([], ...array_values($upcoming)))); ?>
            <?php if ($otherSoon): ?>
            <div class="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Coming soon</p>
                <div class="flex flex-wrap gap-1.5">
                    <?php foreach ($otherSoon as $name): ?>
                        <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"><?= htmlspecialchars($name) ?></span>
                    <?php endforeach; ?>
                </div>
            </div>
            <?php endif; ?>
        </section>

        <!-- Recent activity -->
        <section class="xl:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm">
            <div class="flex items-center justify-between gap-4 px-6 pt-6 pb-4">
                <div>
                    <h2 class="text-base font-bold text-gray-900 dark:text-white">Recent activity</h2>
                    <p class="text-xs text-gray-500 dark:text-gray-400"><?= $isAdmin ? 'Everyone across CatScript Apps' : 'Your latest actions' ?></p>
                </div>
                <a href="<?= $baseUrl ?>history" data-partial
                    class="group inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors">
                    Full logs
                    <svg class="h-4 w-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </a>
            </div>

            <?php if (!$recentActivities || $recentActivities->isEmpty()): ?>
                <div class="px-6 pb-10 pt-4 text-center">
                    <div class="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 mb-3">
                        <?= ActivityIcons::svg('M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', 'h-6 w-6') ?>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400">No activity yet.</p>
                </div>
            <?php else: ?>
                <ul class="px-3 pb-3">
                    <?php foreach ($recentActivities as $activity): ?>
                        <?php $icon = ActivityIcons::for($activity->entity_type, $activity->category, $activity->action); ?>
                        <li class="flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <span class="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center <?= $icon['tint'] ?>">
                                <?= ActivityIcons::svg($icon['path'], 'h-[18px] w-[18px]') ?>
                            </span>
                            <div class="min-w-0 flex-1">
                                <p class="text-sm font-medium text-gray-900 dark:text-white break-words"><?= htmlspecialchars($activity->action ?? '') ?></p>
                                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <?= htmlspecialchars($icon['label']) ?>
                                    <?php if ($isAdmin): ?>
                                        <span class="mx-1">&middot;</span><?= htmlspecialchars($activity->user->full_name ?? 'System') ?>
                                    <?php endif; ?>
                                </p>
                            </div>
                            <time class="flex-shrink-0 text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap pt-0.5" datetime="<?= $activity->created_at?->toIso8601String() ?>" title="<?= $activity->created_at?->format('M j, Y g:i a') ?>">
                                <?= $activity->created_at ? $activity->created_at->diffForHumans(null, true) : 'just now' ?>
                            </time>
                        </li>
                    <?php endforeach; ?>
                </ul>
            <?php endif; ?>
        </section>
    </div>
</div>
