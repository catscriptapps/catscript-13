<?php
// /server/api/pictures.php
//
// GET                                          -> the owner's whole gallery (JSON)
// POST multipart images[]                      -> upload (upload-modal.js)
// POST {_method: PATCH, id, caption?, favourite?} -> update one picture
// POST {_method: PATCH, ids[], favourite}      -> favourite / unfavourite many
// POST {_method: DELETE, ids[]}                -> delete one or more
// POST {_method: REACT, id, emoji}             -> put an emoji on / take it off
// POST {_method: COMMENT, id, body}            -> add a comment
// POST {_method: UNCOMMENT, id, comment_id}    -> delete a comment
//
// Owner-only: every write is scoped to the signed-in user's own pictures.

declare(strict_types=1);

use Src\Controller\PicturesController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Pictures')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Pictures."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_response(['success' => true, 'pictures' => PicturesController::gallery((int) $userId)]);
    }

    if ($method === 'POST') {
        // --- Upload -------------------------------------------------------
        if (!empty($_FILES['images']['tmp_name'])) {
            $result = PicturesController::upload($_FILES['images'], (int) $userId);
            json_response($result, $result['success'] ? 200 : 422);
        }

        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = strtoupper((string) ($input['_method'] ?? ''));
        $controller = new PicturesController();
        $ids = array_map('strval', (array) ($input['ids'] ?? (isset($input['id']) ? [$input['id']] : [])));

        $result = match (true) {
            $action === 'DELETE' => $controller->delete($ids, (int) $userId),
            $action === 'REACT' => $controller->react((string) ($input['id'] ?? ''), (string) ($input['emoji'] ?? ''), (int) $userId),
            $action === 'COMMENT' => $controller->comment((string) ($input['id'] ?? ''), (string) ($input['body'] ?? ''), (int) $userId),
            $action === 'UNCOMMENT' => $controller->deleteComment((string) ($input['id'] ?? ''), (string) ($input['comment_id'] ?? ''), (int) $userId),
            $action === 'PATCH' && isset($input['ids']) => $controller->favouriteMany($ids, filter_var($input['favourite'] ?? false, FILTER_VALIDATE_BOOLEAN), (int) $userId),
            $action === 'PATCH' => $controller->update((string) ($input['id'] ?? ''), array_intersect_key($input, ['caption' => 1, 'favourite' => 1]), (int) $userId),
            default => ['success' => false, 'messages' => ['No pictures received.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
