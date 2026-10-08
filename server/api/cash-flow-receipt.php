<?php
// /server/api/cash-flow-receipt.php
//
// POST multipart images[] to /api/cash-flow-receipt/{encodedId} -> attach/replace
// POST {_method: DELETE, id} (JSON)                            -> remove
//
// Owner-only: a receipt can only be attached to, or removed from, your own
// entry (the legacy endpoint didn't check this).

declare(strict_types=1);

use App\Models\Transaction;
use App\Utils\IdEncoder;
use Src\Controller\CashFlowController;
use Src\Service\AuthService;
use Src\Service\ImageUploadService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Cash Flow')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Cash Flow."]], 403);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
}

$findOwned = function (string $encodedId) use ($userId): Transaction {
    $t = Transaction::ownedBy((int) $userId)->find(IdEncoder::decode($encodedId) ?? 0);
    if (!$t) {
        json_response(['success' => false, 'messages' => ['Entry not found.']], 404);
    }
    return $t;
};

try {
    // --- Remove -------------------------------------------------------
    $json = json_decode(file_get_contents('php://input'), true);
    if (is_array($json) && strtoupper((string) ($json['_method'] ?? '')) === 'DELETE') {
        json_response(CashFlowController::removeReceipt($findOwned((string) ($json['id'] ?? ''))));
    }

    // --- Attach / replace ---------------------------------------------
    $segments = explode('/', trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
    $transaction = $findOwned((string) end($segments));

    if (empty($_FILES['images']['tmp_name'][0])) {
        json_response(['success' => false, 'messages' => ['No receipt image received.']], 400);
    }

    $dir = __DIR__ . '/../../public/' . CashFlowController::RECEIPT_DIR;
    if (!is_dir($dir)) {
        mkdir($dir, 0775, true);
    }

    $single = [
        'name'     => [$_FILES['images']['name'][0]],
        'type'     => [$_FILES['images']['type'][0]],
        'tmp_name' => [$_FILES['images']['tmp_name'][0]],
        'error'    => [$_FILES['images']['error'][0]],
        'size'     => [$_FILES['images']['size'][0]],
    ];

    $uploaded = (new ImageUploadService(realpath($dir) . '/', 2000, 90))->upload($single, fn(array $files) => $files);
    if (empty($uploaded) || (isset($uploaded['success']) && $uploaded['success'] === false)) {
        json_response(['success' => false, 'messages' => [$uploaded['message'] ?? 'Upload failed.']], 500);
    }

    $result = CashFlowController::attachReceipt($transaction, basename((string) $uploaded[0]['fileName']));

    json_response([
        'success'  => true,
        'messages' => $result['messages'],
        // upload-modal.js hands `files` to its onComplete callback
        'files'    => [['url' => $result['transaction']['receipt_url'], 'transaction' => $result['transaction']]],
    ]);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
