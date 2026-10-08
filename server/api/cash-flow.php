<?php
// /server/api/cash-flow.php
//
// GET                          -> the signed-in owner's full ledger (JSON)
// GET  ?suggest=1&q=           -> title autocomplete (own history)
// POST {title, type, amount, transaction_date, details[, encoded_id]} -> save
// POST {_method: DELETE, id}   -> delete

declare(strict_types=1);

use Src\Controller\CashFlowController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Cash Flow')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Cash Flow."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (!empty($_GET['suggest'])) {
            json_response(['success' => true, 'data' => CashFlowController::suggestTitles((int) $userId, trim((string) ($_GET['q'] ?? '')))]);
        }
        json_response(['success' => true, 'transactions' => CashFlowController::ledger((int) $userId)]);
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $controller = new CashFlowController();

        $result = strtoupper((string) ($input['_method'] ?? '')) === 'DELETE'
            ? $controller->delete((string) ($input['id'] ?? ''), (int) $userId)
            : $controller->save($input, (int) $userId);

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
