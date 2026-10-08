<?php
// /server/api/receipts.php
//
// GET                    -> {receipts, invoices, customers, methods, next_number, …}
// GET  ?detail={id}      -> one receipt with its customer and invoice picture
// POST {action, ...} (JSON):
//   save        {id?, invoice_id, amount, date, method, note?}
//   void        {id}        (stays on file, stops counting as paid)
//   restore     {id}
//   delete      {id}
//   email       {id, to, message?}
// The PDF is /api/receipts-pdf?id={id}[&download=1].

declare(strict_types=1);

use Src\Controller\ReceiptsController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Receipts')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Receipts."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (isset($_GET['detail'])) {
            $d = ReceiptsController::detail((string) $_GET['detail']);
            json_response($d ? ['success' => true, 'receipt' => $d] : ['success' => false, 'messages' => ['Receipt not found.']], $d ? 200 : 404);
        }
        json_response(['success' => true] + ReceiptsController::state());
    }

    if ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new ReceiptsController();
        $id = (string) ($in['id'] ?? '');

        $result = match ((string) ($in['action'] ?? '')) {
            'save'    => $c->save($in, (int) $userId),
            'void'    => $c->setActive($id, false),
            'restore' => $c->setActive($id, true),
            'delete'  => $c->delete($id),
            'email'   => $c->email($id, (string) ($in['to'] ?? ''), (string) ($in['message'] ?? '')),
            default   => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
