<?php
// /server/api/chat-init.php
//
// Get-or-creates the caller's chat conversation (guest or logged-in — see
// ChatController::findOrCreateConversation) and returns the recent thread.
// JSON in/out via fetch. Called once when the floating widget panel first
// opens each page load.

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;

header('Content-Type: application/json');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'messages' => ['Method not allowed']]);
    exit;
}

if (AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Admins use the Live Chat inbox instead.']]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$guestName = trim((string) ($input['guest_name'] ?? '')) ?: null;
$guestEmail = trim((string) ($input['guest_email'] ?? '')) ?: null;

$conversation = ChatController::findOrCreateConversation($guestName, $guestEmail);
ChatController::markReadByVisitor($conversation);

$thread = ChatController::fullThread($conversation);

echo json_encode([
    'success' => true,
    'conversation_id' => $conversation->id,
    'display_name' => $conversation->displayName(),
    'needs_guest_info' => !AuthService::userId() && !$conversation->guest_name,
    'messages' => $thread->map(fn($m) => [
        'id' => $m->id,
        'role' => $m->sender_role,
        'body' => $m->body,
        'is_ai' => (bool) $m->is_ai,
        'created_at' => $m->created_at->toIso8601String(),
    ])->values(),
]);
