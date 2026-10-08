<?php
// /server/api/customers.php
//
// GET                        -> {customers, countries, regions, year}
// GET  ?invoices={id}        -> one customer's invoices
// GET  ?export=csv           -> the directory as a CSV download
// POST {action, ...} (JSON):
//   save          {id?, name, email, phone, website, address, city, country_id, region_id, postal}
//   archive       {id}
//   restore       {id}
//   delete        {id}          (only customers with no invoices)
//   remove-logo   {id}
// Logo uploads go to /api/customer-logo/{id}.

declare(strict_types=1);

use Src\Controller\CustomersController;
use Src\Service\AuthService;

$userId = AuthService::userId();
if (!$userId) {
    header('Content-Type: application/json; charset=UTF-8');
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Customers')) {
    header('Content-Type: application/json; charset=UTF-8');
    json_response(['success' => false, 'messages' => ["You don't have access to Customers."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && ($_GET['export'] ?? '') === 'csv') {
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="customers-' . date('Y-m-d') . '.csv"');
    echo CustomersController::csv();
    CustomersController::logActivity('Exported the customer list (CSV)', 'Customers');
    exit;
}

header('Content-Type: application/json; charset=UTF-8');

try {
    if ($method === 'GET') {
        if (isset($_GET['invoices'])) {
            json_response(['success' => true, 'invoices' => CustomersController::invoices((string) $_GET['invoices'])]);
        }
        json_response(['success' => true] + CustomersController::state());
    }

    if ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new CustomersController();
        $id = (string) ($in['id'] ?? '');

        $result = match ((string) ($in['action'] ?? '')) {
            'save'        => $c->save($in, (int) $userId),
            'archive'     => $c->setActive($id, false),
            'restore'     => $c->setActive($id, true),
            'delete'      => $c->delete($id),
            'remove-logo' => $c->removeLogo($id),
            default       => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
