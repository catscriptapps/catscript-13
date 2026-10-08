<?php
// /server/api/change-password.php
//
// Authenticated "Change Password" — requires the user's current password
// (unlike the token-based forgot/reset-password flow), then updates it.

declare(strict_types=1);

use Src\Service\AuthService;
use Src\Controller\UsersController;

header('Content-Type: application/json');

$user = AuthService::currentUser();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'messages' => ['Please sign in.']]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'messages' => ['Method not allowed.']]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$currentPassword = (string) ($input['current_password'] ?? '');
$newPassword = (string) ($input['new_password'] ?? '');
$confirmPassword = (string) ($input['new_password_confirmation'] ?? '');

if ($currentPassword === '' || $newPassword === '' || $confirmPassword === '') {
    http_response_code(422);
    echo json_encode(['success' => false, 'messages' => ['All fields are required.']]);
    exit;
}

if (!password_verify($currentPassword, (string) $user->password)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Your current password is incorrect.']]);
    exit;
}

if (strlen($newPassword) < 8) {
    http_response_code(422);
    echo json_encode(['success' => false, 'messages' => ['New password must be at least 8 characters.']]);
    exit;
}

if ($newPassword !== $confirmPassword) {
    http_response_code(422);
    echo json_encode(['success' => false, 'messages' => ['New password and confirmation do not match.']]);
    exit;
}

if (password_verify($newPassword, (string) $user->password)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'messages' => ['New password must be different from your current password.']]);
    exit;
}

$user->password = password_hash($newPassword, PASSWORD_BCRYPT);
$user->save();

UsersController::logActivity('Changed account password', 'Users');

echo json_encode(['success' => true, 'message' => 'Password updated successfully.']);
