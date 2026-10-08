<?php
// /server/api/users.php

declare(strict_types=1);

use Src\Controller\UsersController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$input  = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $controller = new UsersController();
    $override   = strtoupper($input['_method'] ?? '');
    $userId     = AuthService::userId();

    // 1. HANDLE SEARCH / FETCH (GET) -> the user directory is admin-only
    if ($method === 'GET') {
        if (!$userId) {
            json_response(['success' => false, 'messages' => ['Authentication required']], 401);
            exit;
        }
        if (!AuthService::isAdmin()) {
            json_response(['success' => false, 'messages' => ['Only an administrator can list users.']], 403);
            exit;
        }
        // ?state=1 -> the whole directory as JSON (the Users page)
        if (!empty($_GET['state'])) {
            json_response(['success' => true] + UsersController::state());
        }
        $controller->index();
        exit;
    }

    // 2. HANDLE SAVE/DELETE (POST)
    if ($method === 'POST') {

        // --- Admin password reset: {action: reset-password, id, password, sign_out}
        //     or {action: send-reset-link, id} (UsersController) ---
        $action = (string) ($input['action'] ?? '');
        if ($action === 'reset-password' || $action === 'send-reset-link') {
            if (!$userId) {
                json_response(['success' => false, 'messages' => ['Authentication required']], 401);
            }
            if (!AuthService::isAdmin()) {
                json_response(['success' => false, 'messages' => ['Only an administrator can reset passwords.']], 403);
            }
            $result = $action === 'reset-password'
                ? $controller->resetPassword((string) ($input['id'] ?? ''), (string) ($input['password'] ?? ''), filter_var($input['sign_out'] ?? true, FILTER_VALIDATE_BOOLEAN))
                : $controller->sendResetLink((string) ($input['id'] ?? ''));
            json_response($result, $result['success'] ? 200 : 422);
        }

        // --- AUTHENTICATION LOGIC GATE ---
        $isDelete = ($override === 'DELETE');
        $isUpdate = ($override === 'PUT' || !empty($input['encoded_id']));
        $isCreate = !$isDelete && !$isUpdate;

        // Every write needs a session. There is no self-registration —
        // accounts are created by an admin (same as the legacy app).
        if (!$userId) {
            json_response(['success' => false, 'messages' => ['Authentication required to modify users']], 401);
            exit;
        }

        // Create and delete are admin-only; an update is allowed on your
        // own account, or on anyone's for an admin.
        if (($isCreate || $isDelete) && !AuthService::isAdmin()) {
            json_response(['success' => false, 'messages' => ['Only an administrator can create or delete users.']], 403);
            exit;
        }
        if ($isUpdate && !AuthService::isAdmin()
            && \App\Utils\IdEncoder::decode((string) ($input['encoded_id'] ?? '')) !== (int) $userId) {
            json_response(['success' => false, 'messages' => ['You can only edit your own account.']], 403);
            exit;
        }

        if ($isDelete) {
            $result = $controller->delete($input['id'] ?? 0);
        } else {
            // Controller handles the logic for Create (Registration) vs Update
            $result = $controller->save($input);
        }

        // Final UTF-8 Clean for JSON safety
        if (!empty($result['rowHtml'])) {
            $result['rowHtml'] = mb_convert_encoding($result['rowHtml'], 'UTF-8', 'UTF-8');
        }

        json_response($result);
    } else {
        json_response(['success' => false, 'messages' => ['Method not supported']], 405);
    }
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => [$e->getMessage()]], 500);
}
