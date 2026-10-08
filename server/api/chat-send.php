<?php
// /server/api/chat-send.php
//
// Sends a chat message. Works for both the visitor widget and the admin
// inbox — role is auto-detected server-side (AuthService::isAdmin() ?
// 'admin' : 'visitor'), never trusted from the client. JSON in/out via
// fetch, no page reload.

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;
use Src\Service\ChatAutoResponder;

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'messages' => ['Method not allowed']]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$conversationId = (int) ($input['conversation_id'] ?? 0);
$body = (string) ($input['message'] ?? '');

if ($conversationId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'messages' => ['Invalid conversation.']]);
    exit;
}

$isAdmin = AuthService::isAdmin();

if ($isAdmin) {
    $conversation = \App\Models\ChatConversation::find($conversationId);
} else {
    $conversation = ChatController::loadOwnConversation($conversationId);
}

if (!$conversation) {
    http_response_code(404);
    echo json_encode(['success' => false, 'messages' => ["Couldn't find that conversation."]]);
    exit;
}

$result = ChatController::postMessage($conversation, $isAdmin ? 'admin' : 'visitor', $body);

if (!$result['success']) {
    echo json_encode(['success' => false, 'messages' => $result['errors']]);
    exit;
}

$message = $result['message'];

// If this was a visitor message and Autorespond is on, let the AI reply
// immediately so it can be returned in the same response — see
// ChatAutoResponder for why this stays synchronous rather than a background
// job (no queue/worker infra on this stack, and a single bounded API call
// per message is a normal request cost, unlike a held-open connection).
$aiMessage = !$isAdmin ? ChatAutoResponder::maybeRespond($conversation) : null;

$response = [
    'success' => true,
    'message' => [
        'id' => $message->id,
        'role' => $message->sender_role,
        'body' => $message->body,
        'is_ai' => false,
        'created_at' => $message->created_at->toIso8601String(),
    ],
];

if ($aiMessage) {
    $response['ai_reply'] = [
        'id' => $aiMessage->id,
        'role' => $aiMessage->sender_role,
        'body' => $aiMessage->body,
        'is_ai' => true,
        'created_at' => $aiMessage->created_at->toIso8601String(),
    ];
}

echo json_encode($response);
