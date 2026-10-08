<?php
// /server/api/invoices.php
//
// GET                    -> {invoices, customers, statuses, payment_terms, delivery_terms, …}
// GET  ?detail={id}      -> one invoice with its lines and payments
// POST {action, ...} (JSON):
//   save        {id?, customer_id, title, due?, currency, payment_term_id?, delivery_term_id?, status_id, items[]}
//   status      {id, status_id}
//   duplicate   {id}
//   delete      {id}        (not once payments are recorded)
//   email       {id, to, message?}
// The PDF is /api/invoices-pdf?id={id}[&download=1].

declare(strict_types=1);

use Src\Controller\InvoicesController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Invoices')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Invoices."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (isset($_GET['detail'])) {
            $d = InvoicesController::detail((string) $_GET['detail']);
            json_response($d ? ['success' => true, 'invoice' => $d] : ['success' => false, 'messages' => ['Invoice not found.']], $d ? 200 : 404);
        }
        json_response(['success' => true] + InvoicesController::state());
    }

    if ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new InvoicesController();
        $id = (string) ($in['id'] ?? '');

        $result = match ((string) ($in['action'] ?? '')) {
            'save'      => $c->save($in, (int) $userId),
            'status'    => $c->setStatus($id, (int) ($in['status_id'] ?? 0)),
            'duplicate' => $c->duplicate($id, (int) $userId),
            'delete'    => $c->delete($id),
            'email'     => $c->email($id, (string) ($in['to'] ?? ''), (string) ($in['message'] ?? '')),
            default     => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
