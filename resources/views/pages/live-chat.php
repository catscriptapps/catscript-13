<?php
// /resources/views/pages/live-chat.php
//
// Admin-only inbox for the live chat widget (see
// resources/views/components/chat-widget.php / src/Controller/ChatController.php).
// Two-pane layout: conversation list (left) + active thread & reply box
// (right) — same list+detail shape as contractor-claims-review.php /
// landlord-report-review.php, adapted for a live, polled thread instead of
// an approve/reject queue.
//
// @var bool $isLoggedIn
// @var string $baseUrl
// @var string $assetBase

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;

// Defense in depth: the real gate is index.php's admin-only route check.
if (!AuthService::isAdmin()) {
?>
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
        <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Access Denied</h4>
        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">This area is restricted to administrators.</p>
    </div>
<?php
    return;
}

$conversations = ChatController::openConversations(20);
?>
<div class="space-y-6" data-base-url="<?= $baseUrl ?>">
    <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Live Chat</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Conversations from guests and signed-in visitors.</p>
    </div>

    <!-- AI Autorespond settings -->
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3">
        <div class="flex items-center justify-between gap-4">
            <div>
                <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">AI Autorespond</h4>
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">When on, Claude replies to new visitor messages immediately. Reply to a conversation yourself and the AI stops responding there — you've taken over.</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input type="checkbox" id="chat-ai-toggle" class="sr-only peer" />
                <div class="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-primary-600 transition-colors"></div>
                <div class="absolute left-1 top-1 h-4 w-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
            </label>
        </div>
        <p id="chat-ai-not-configured" class="hidden text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
            Add <code>ANTHROPIC_API_KEY</code> to your <code>.env</code> file to enable this.
        </p>
        <div>
            <textarea id="chat-ai-instructions" rows="3" placeholder="Tell the AI about your business and how to help visitors (tone, common questions, what to escalate to a human)..." class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900 dark:text-white"></textarea>
            <div class="flex justify-end mt-2">
                <button type="button" id="chat-ai-save" class="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs rounded-lg transition-colors shadow-sm">Save Instructions</button>
            </div>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[70vh] min-h-[32rem]">

        <!-- Conversation list -->
        <div class="lg:col-span-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col">
            <div class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                    <button type="button" data-live-chat-tab="open" class="px-3 py-1 text-xs font-bold rounded-md transition-colors bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 shadow-sm">Open</button>
                    <button type="button" data-live-chat-tab="closed" class="px-3 py-1 text-xs font-bold rounded-md transition-colors text-gray-500 dark:text-gray-400">Closed</button>
                </div>
                <span id="live-chat-total" class="text-xs text-gray-400"><?= $conversations->total() ?></span>
            </div>
            <div id="live-chat-list" class="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                <?php if ($conversations->isEmpty()): ?>
                    <p class="text-xs text-gray-400 text-center p-6">No open conversations yet.</p>
                <?php else: ?>
                    <?php foreach ($conversations as $c): ?>
                        <button type="button" data-conversation-id="<?= $c->id ?>" class="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors" data-live-chat-item>
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate"><?= htmlspecialchars($c->displayName()) ?></span>
                                <?php if ($c->unread_count > 0): ?>
                                    <span class="flex-shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center"><?= $c->unread_count ?></span>
                                <?php endif; ?>
                            </div>
                            <span class="text-xs text-gray-400"><?= $c->last_message_at ? htmlspecialchars($c->last_message_at->diffForHumans()) : '' ?></span>
                        </button>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

        <!-- Active thread -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl flex flex-col overflow-hidden">
            <div id="live-chat-thread-header" class="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
                <span id="live-chat-thread-name" class="text-sm font-bold text-gray-700 dark:text-gray-300">Select a conversation</span>
                <button type="button" id="live-chat-close-btn" class="hidden text-xs font-semibold text-gray-500 hover:text-red-600 dark:text-gray-400">Close Conversation</button>
            </div>
            <div id="live-chat-thread" class="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                <p class="text-xs text-gray-400 text-center mt-6">Pick a conversation on the left to view its messages.</p>
            </div>
            <form id="live-chat-composer" class="hidden flex-shrink-0 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 p-3">
                <input type="text" id="live-chat-input" autocomplete="off" placeholder="Type a reply..." class="flex-1 px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900 dark:text-white" />
                <button type="submit" class="flex-shrink-0 px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm rounded-lg transition-colors shadow-sm">Send</button>
            </form>
        </div>

    </div>
</div>
