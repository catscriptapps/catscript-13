<?php
// /server/api/chat-admin-list.php
//
// Admin-only conversation list for the /live-chat inbox — polled
// periodically so new conversations/messages surface without a reload.

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;

header('Content-Type: application/json');

if (!AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Forbidden.']]);
    exit;
}

$status = ($_GET['status'] ?? 'open') === 'closed' ? 'closed' : 'open';

$conversations = $status === 'closed'
    ? ChatController::closedConversations(20)
    : ChatController::openConversations(20);

echo json_encode([
    'success' => true,
    'conversations' => collect($conversations->items())->map(fn($c) => [
        'id' => $c->id,
        'display_name' => $c->displayName(),
        'is_guest' => $c->user_id === null,
        'unread_count' => (int) $c->unread_count,
        'last_message_at' => $c->last_message_at?->toIso8601String(),
        'last_message_relative' => $c->last_message_at?->diffForHumans(),
    ])->values(),
    'total' => $conversations->total(),
]);
