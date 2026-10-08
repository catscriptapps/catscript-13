<?php
// /server/api/chat-poll.php
//
// Incremental new-messages fetch for the visitor widget — short-polled
// every ~4s while the panel is open, and less often in the background to
// drive the bubble's unread badge (see resources/js/components/chat-widget.js).
// Ownership-checked: a conversation_id alone isn't enough, it must belong
// to the caller's own session (user_id or guest_token).
//
// mark_read=0 skips marking results read — used for background polling
// while the panel is closed, so the badge count stays accurate until the
// visitor actually opens the panel and views the messages.

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;

header('Content-Type: application/json');

if (AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Admins use the Live Chat inbox instead.']]);
    exit;
}

$conversationId = (int) ($_GET['conversation_id'] ?? 0);
$afterId = (int) ($_GET['after_id'] ?? 0);

$conversation = $conversationId > 0 ? ChatController::loadOwnConversation($conversationId) : null;

if (!$conversation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'messages' => ["Couldn't find that conversation."]]);
    exit;
}

$newMessages = ChatController::threadSince($conversation, $afterId);
$markRead = ($_GET['mark_read'] ?? '1') !== '0';

if ($markRead && $newMessages->isNotEmpty()) {
    ChatController::markReadByVisitor($conversation);
}

echo json_encode([
    'success' => true,
    'unread_count' => ChatController::unreadCountForVisitor($conversation),
    'messages' => $newMessages->map(fn($m) => [
        'id' => $m->id,
        'role' => $m->sender_role,
        'body' => $m->body,
        'is_ai' => (bool) $m->is_ai,
        'created_at' => $m->created_at->toIso8601String(),
    ])->values(),
]);
