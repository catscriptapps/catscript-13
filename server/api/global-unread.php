<?php
// /server/api/global-unread.php

declare(strict_types=1);

use App\Models\ChatConversation;
use Src\Controller\ChatController;
use Src\Controller\MessagesController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=utf-8');

try {
    // 1. Contact-form threads with unread messages (admins only — 0 for everyone else)
    $messagesCount = MessagesController::unreadCount();

    // 2. Get the "General Notifications" (Bell icon)
    $notificationsCount = 0;

    // 3. Live chat unread — across all open conversations for admin, or
    // just the caller's own conversation for a logged-in visitor. Guests
    // never reach this endpoint (initUnreadPolling() only runs when
    // window.sessionUserId is set) — the widget polls its own unread count
    // independently, see chat-poll.php.
    if (AuthService::isAdmin()) {
        $chatsCount = ChatController::unreadCountForAdmin();
    } else {
        $userId = AuthService::userId();
        $conversation = $userId ? ChatConversation::where('user_id', $userId)->open()->first() : null;
        $chatsCount = $conversation ? ChatController::unreadCountForVisitor($conversation) : 0;
    }

    json_response([
        'success' => true,
        'counts' => [
            'messages'      => (int)$messagesCount,
            'notifications' => (int)$notificationsCount,
            'chats'         => (int)$chatsCount
        ],
        'timestamp' => date('Y-m-d H:i:s'),
    ]);
} catch (Throwable $e) {
    // Log the error internally if you have a logger
    json_response([
        'success' => false,
        'message' => 'Heartbeat failed: ' . $e->getMessage(),
    ], 500);
}
