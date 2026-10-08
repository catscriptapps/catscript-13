<?php
// /server/api/faqs.php
//
// GET                -> {faqs, categories, is_admin}  (anyone; archived only for admins)
// POST {action, ...} (JSON) — admins only:
//   save    {id?, question, answer, category, active}
//   move    {id, dir: -1|1}      within its topic
//   delete  {id}

declare(strict_types=1);

use Src\Controller\FaqsController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_response(['success' => true] + FaqsController::state());
    }

    if ($method === 'POST') {
        if (!AuthService::userId()) {
            json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
        }
        if (!AuthService::isAdmin()) {
            json_response(['success' => false, 'messages' => ['Only admins can change the FAQs.']], 403);
        }
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new FaqsController();
        $id = (string) ($in['id'] ?? '');

        $result = match ((string) ($in['action'] ?? '')) {
            'save'   => $c->save($in, (int) AuthService::userId()),
            'move'   => $c->move($id, (int) ($in['dir'] ?? 1)),
            'delete' => $c->delete($id),
            default  => ['success' => false, 'messages' => ['Unknown action.']],
        };
        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
