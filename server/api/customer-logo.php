<?php
// /server/api/customer-logo.php
//
// POST multipart images[] to /api/customer-logo/{encodedId} -> attach / replace
// the customer's logo (upload-modal.js). Removing it is POST api/customers
// {action: remove-logo}.

declare(strict_types=1);

use Src\Controller\CustomersController;
use Src\Service\AuthService;
use Src\Service\ImageUploadService;

header('Content-Type: application/json; charset=UTF-8');

if (!AuthService::userId()) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Customers')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Customers."]], 403);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST' || empty($_FILES['images']['tmp_name'][0])) {
    json_response(['success' => false, 'messages' => ['No logo image received.']], 400);
}

$segments = explode('/', trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH), '/'));
$encodedId = (string) end($segments);

$dir = __DIR__ . '/../../public/' . CustomersController::LOGO_DIR;
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

$uploaded = (new ImageUploadService(realpath($dir) . '/', 600, 90))->upload($single, fn(array $files) => $files);
if (empty($uploaded) || (isset($uploaded['success']) && $uploaded['success'] === false)) {
    json_response(['success' => false, 'messages' => [$uploaded['message'] ?? 'Upload failed.']], 500);
}

$result = CustomersController::attachLogo($encodedId, basename((string) $uploaded[0]['fileName']));
if (!$result['success']) {
    json_response($result, 404);
}
// upload-modal.js hands `files` to its onComplete callback
json_response(['success' => true, 'messages' => $result['messages'], 'files' => [['url' => $result['logo'], 'id' => $encodedId]]]);
