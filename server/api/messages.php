<?php
// /server/api/messages.php
//
// Admins only (the contact form posts to /api/contact instead).
// GET                   -> {threads, counts, can_email, me}
// GET  ?thread={key}    -> one thread with its messages (marks them read)
// POST {action, key, ...} (JSON):
//   reply      {key, body}     emailed to the visitor, then saved
//   archive    {key}
//   restore    {key}
//   unread     {key}
//   delete     {key}           the whole thread

declare(strict_types=1);

use Src\Controller\MessagesController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

if (!AuthService::userId()) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::isAdmin()) {
    json_response(['success' => false, 'messages' => ['Only admins can read messages.']], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (isset($_GET['thread'])) {
            $t = MessagesController::thread((string) $_GET['thread']);
            json_response($t ? ['success' => true, 'thread' => $t, 'unread' => MessagesController::unreadCount()] : ['success' => false, 'messages' => ['That conversation no longer exists.']], $t ? 200 : 404);
        }
        json_response(['success' => true] + MessagesController::state());
    }

    if ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new MessagesController();
        $key = (string) ($in['key'] ?? '');

        $result = match ((string) ($in['action'] ?? '')) {
            'reply'   => $c->reply($key, (string) ($in['body'] ?? ''), (int) AuthService::userId()),
            'archive' => $c->setArchived($key, true),
            'restore' => $c->setArchived($key, false),
            'unread'  => $c->markUnread($key),
            'delete'  => $c->deleteThread($key),
            default   => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
