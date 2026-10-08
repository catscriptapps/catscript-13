<?php
// /server/api/account-security.php
//
// Settings → Security (Src\Controller\AccountSecurityController):
//   GET                              other signed-in devices + recent sign-ins
//   POST {action: "sign-out-others"} end every session but this one

declare(strict_types=1);

use Src\Controller\AccountSecurityController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=utf-8');

if (!AuthService::isLoggedIn()) {
    json_response(['success' => false, 'messages' => ['Please sign in.']], 401);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    json_response(['success' => true] + AccountSecurityController::state());
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    if (($input['action'] ?? '') === 'sign-out-others') {
        json_response(AccountSecurityController::signOutOthers());
    }
    json_response(['success' => false, 'messages' => ['Unknown action.']], 400);
}

json_response(['success' => false, 'messages' => ['Method not allowed.']], 405);
