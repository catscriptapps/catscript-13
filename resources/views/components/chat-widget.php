<?php
// /resources/views/components/chat-widget.php
//
// Floating live-chat bubble on every page — see src/Controller/ChatController.php.
// Guests and members get the chat panel (components/chat-widget.js). Admins
// answer from the /live-chat inbox, so theirs is a shortcut to it instead (no
// "chat with yourself" case), with the unread count kept fresh by
// ui/live-chat-badge.js.
//
// Included near the end of <body> in layouts/app.php — same spot as
// components/scroll-top.php. Positioned by #chat-widget in resources/css/app.css.

declare(strict_types=1);

use Src\Service\AuthService;

if (AuthService::isAdmin()):
    $liveChatUrl = ($_ENV['APP_BASE_PATH'] ?? '') . '/live-chat';
?>
<div id="chat-widget" data-admin="true" class="fixed right-6 z-[9998] flex flex-col items-end">
    <a href="<?= htmlspecialchars($liveChatUrl) ?>" data-partial aria-label="Open the live chat inbox" data-tooltip="Live chat inbox"
        class="relative flex-shrink-0 h-14 w-14 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-xl flex items-center justify-center transition-all hover:scale-105">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        <span data-live-chat-badge class="hidden absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-gray-950">0</span>
    </a>
</div>
<?php
    return;
endif;
?>
<!-- Bottom-right corner; lifts above the scroll-to-top button (components/scroll-top.php)
     while that's showing — positioned by #chat-widget in resources/css/app.css -->
<div id="chat-widget" class="fixed right-6 z-[9998] flex flex-col items-end">

    <!-- Panel -->
    <div id="chat-widget-panel" class="hidden mb-4 w-[22rem] max-w-[calc(100vw-3rem)] h-[30rem] max-h-[calc(100vh-11rem)] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-4 py-3 bg-primary-600 text-white flex-shrink-0">
            <div>
                <h4 class="text-sm font-bold">Chat with CatScript Apps</h4>
                <p class="text-xs text-primary-100">We typically reply within a few minutes.</p>
            </div>
            <button type="button" id="chat-widget-close" aria-label="Close chat" class="p-1 rounded-lg hover:bg-white/10 transition-colors">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>

        <!-- Pre-chat guest form (shown once, only for anonymous visitors) -->
        <div id="chat-widget-guest-form" class="hidden flex-1 flex flex-col justify-center gap-3 p-5">
            <p class="text-sm text-gray-600 dark:text-gray-400">Tell us your name so we know who we're chatting with.</p>
            <input type="text" id="chat-widget-guest-name" placeholder="Your name" class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900 dark:text-white" />
            <input type="email" id="chat-widget-guest-email" placeholder="Email (optional)" class="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900 dark:text-white" />
            <button type="button" id="chat-widget-guest-start" class="w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm rounded-lg transition-colors shadow-sm">
                Start Chat
            </button>
        </div>

        <!-- Thread -->
        <div id="chat-widget-thread" class="flex-1 overflow-y-auto px-4 py-3 space-y-3"></div>

        <!-- Composer -->
        <form id="chat-widget-composer" class="hidden flex-shrink-0 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 p-3">
            <input type="text" id="chat-widget-input" autocomplete="off" placeholder="Type a message..." class="flex-1 px-3.5 py-2.5 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none text-gray-900 dark:text-white" />
            <button type="submit" aria-label="Send" class="flex-shrink-0 p-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors shadow-sm">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
            </button>
        </form>
    </div>

    <!-- Bubble -->
    <button type="button" id="chat-widget-bubble" aria-label="Open chat" class="relative flex-shrink-0 h-14 w-14 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-xl flex items-center justify-center transition-all hover:scale-105">
        <svg id="chat-widget-bubble-icon-open" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        <svg id="chat-widget-bubble-icon-close" class="hidden h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        <span id="chat-widget-unread-badge" class="hidden absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-gray-950">0</span>
    </button>
</div>
