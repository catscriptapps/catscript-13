<?php
// /resources/views/pages/admin.php
//
// Unified admin hub — a single, discoverable landing point for every
// admin-only tool (Users, Live Chat). The "tabs" below are real page links
// (data-partial, so navigation is instant via the SPA router) rather than
// client-side panel switching — this reuses each tool's existing,
// already-working page and JS module instead of duplicating them inline.
// As the CatScript apps are rebuilt, add their admin queues here.
//
// @var bool $isLoggedIn
// @var string $baseUrl

declare(strict_types=1);

use App\Models\User;
use Src\Controller\ChatController;
use Src\Service\AuthService;

if (!AuthService::isAdmin()) {
?>
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
        <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Access Denied</h4>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">This area is restricted to administrators.</p>
    </div>
<?php
    return;
}

$currentPath = $path ?? '';

$openConversations = ChatController::openConversations()->total();
$unreadChats = ChatController::unreadCountForAdmin();
$totalUsers = User::count();

$tabs = [
    ['label' => 'Overview', 'href' => 'admin'],
    ['label' => 'Users', 'href' => 'users'],
    ['label' => 'Live Chats', 'href' => 'live-chat', 'badge' => $unreadChats],
    ['label' => 'Slideshow', 'href' => 'slideshow'],
];
$slideCount = count(\Src\Utils\CuratedPhotos::files());

$statCards = [
    [
        'label' => 'Open Conversations',
        'value' => $openConversations,
        'sub' => $unreadChats > 0 ? "{$unreadChats} unread" : 'All caught up',
        'href' => 'live-chat',
        'accent' => 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />',
    ],
    [
        'label' => 'Registered Users',
        'value' => $totalUsers,
        'sub' => 'All accounts',
        'href' => 'users',
        'accent' => 'text-secondary-600 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-950/40',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />',
    ],
    [
        'label' => 'Slideshow Photos',
        'value' => $slideCount,
        'sub' => 'Banners & TV screensavers',
        'href' => 'slideshow',
        'accent' => 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40',
        'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />',
    ],
];
?>
<div class="space-y-6">
    <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Admin Dashboard</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Everything across CatScript Apps that needs your attention, in one place.</p>
    </div>

    <!-- Tabs -->
    <div class="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        <?php foreach ($tabs as $tab): ?>
            <?php $isActive = $currentPath === '/' . $tab['href']; ?>
            <a href="<?= $baseUrl . $tab['href'] ?>" data-partial
                class="relative flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors <?= $isActive
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200' ?>">
                <?= htmlspecialchars($tab['label']) ?>
                <?php if (!empty($tab['badge'])): ?>
                    <span class="min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"><?= $tab['badge'] > 99 ? '99+' : $tab['badge'] ?></span>
                <?php endif; ?>
            </a>
        <?php endforeach; ?>
    </div>

    <!-- Overview stat cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <?php foreach ($statCards as $card): ?>
            <a href="<?= $baseUrl . $card['href'] ?>" data-partial class="group bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center <?= $card['accent'] ?>">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><?= $card['icon'] ?></svg>
                </div>
                <div class="mt-4 text-3xl font-bold text-gray-900 dark:text-white"><?= $card['value'] ?></div>
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-300 mt-1"><?= htmlspecialchars($card['label']) ?></div>
                <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5"><?= htmlspecialchars($card['sub']) ?></div>
            </a>
        <?php endforeach; ?>
    </div>

    <?php if ($openConversations === 0): ?>
        <div class="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl p-10 text-center">
            <svg class="h-10 w-10 text-emerald-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">All caught up</h4>
            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">No open live chats right now.</p>
        </div>
    <?php endif; ?>
</div>
