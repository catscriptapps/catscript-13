<?php
// /server/api/chat-admin-thread.php
//
// Admin-only: full (or incremental, via after_id) thread for one
// conversation, and marks it read-by-admin. Powers both the initial load
// and the ~4s poll of the open thread in the /live-chat inbox.

declare(strict_types=1);

use App\Models\ChatConversation;
use Src\Controller\ChatController;
use Src\Service\AuthService;

header('Content-Type: application/json');

if (!AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Forbidden.']]);
    exit;
}

$conversationId = (int) ($_GET['conversation_id'] ?? 0);
$afterId = (int) ($_GET['after_id'] ?? 0);

$conversation = $conversationId > 0 ? ChatConversation::find($conversationId) : null;

if (!$conversation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'messages' => ["Couldn't find that conversation."]]);
    exit;
}

$thread = $afterId > 0
    ? ChatController::threadSince($conversation, $afterId)
    : ChatController::fullThread($conversation);

ChatController::markReadByAdmin($conversation);

echo json_encode([
    'success' => true,
    'conversation' => [
        'id' => $conversation->id,
        'display_name' => $conversation->displayName(),
        'guest_email' => $conversation->guest_email,
        'status' => $conversation->status,
    ],
    'messages' => $thread->map(fn($m) => [
        'id' => $m->id,
        'role' => $m->sender_role,
        'body' => $m->body,
        'is_ai' => (bool) $m->is_ai,
        'created_at' => $m->created_at->toIso8601String(),
    ])->values(),
]);
