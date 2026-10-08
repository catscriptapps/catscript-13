<?php
// /server/api/chat-close.php
//
// Admin-only: marks a conversation closed. A visitor sending a new message
// to a closed conversation re-opens it (see ChatController::postMessage).

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;

header('Content-Type: application/json');

if (!AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Forbidden.']]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'messages' => ['Method not allowed']]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$id = (int) ($input['conversation_id'] ?? 0);

if ($id <= 0 || !ChatController::close($id)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'messages' => ["Couldn't close that conversation."]]);
    exit;
}

echo json_encode(['success' => true, 'messages' => ['Conversation closed.']]);
