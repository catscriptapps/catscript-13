<?php
// /server/api/slideshow.php
//
// The site-wide slideshow (SlideshowController) — admins, and anyone granted
// the "Slideshow" app.
// GET                                   -> {photos[], ready}
// POST multipart images[]               -> upload (upload-modal.js), added at the end
// POST {action: 'caption', id, caption}
// POST {action: 'reorder', ids[]}       first to last
// POST {action: 'delete', ids[]}        one or many

declare(strict_types=1);

use Src\Controller\SlideshowController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Slideshow')) {
    json_response(['success' => false, 'messages' => ["You don't have access to the Slideshow."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_response(['success' => true] + SlideshowController::state());
    }

    if ($method === 'POST') {
        if (!empty($_FILES['images']['tmp_name'])) {
            $result = SlideshowController::upload($_FILES['images'], (int) $userId);
            json_response($result, $result['success'] ? 200 : 422);
        }

        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new SlideshowController();
        $ids = (array) ($in['ids'] ?? (isset($in['id']) ? [$in['id']] : []));

        $result = match ((string) ($in['action'] ?? '')) {
            'caption' => $c->caption((int) ($in['id'] ?? 0), (string) ($in['caption'] ?? '')),
            'reorder' => $c->reorder($ids),
            'delete'  => $c->delete($ids),
            default   => ['success' => false, 'messages' => ['No photos received.']],
        };
        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
