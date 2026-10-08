<?php
// /server/api/avatar-delete.php

declare(strict_types=1);

use App\Models\User;
use Src\Controller\UsersController; // ✅ Import for logging

// JSON response header
header('Content-Type: application/json');

// --------------------------------------------------
// Auth: your own photo — or, for an admin, anyone's (?user=<encoded id> or
// {"user": …}, from the Users page). It used to fall back to user 1 when
// nobody was signed in, letting anyone remove that account's photo.
// --------------------------------------------------
$me = (int) (\Src\Service\AuthService::userId() ?? 0);
$userId = $me;
$deleteInput = json_decode(file_get_contents('php://input') ?: '', true) ?: [];
$forUser = trim((string) ($_GET['user'] ?? $deleteInput['user'] ?? ''));
if ($me && $forUser !== '') {
    $target = (int) (\App\Utils\IdEncoder::decode($forUser) ?? 0);
    if ($target !== $me) {
        if (!\Src\Service\AuthService::isAdmin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Only an administrator can change someone else’s photo.']);
            exit;
        }
        $userId = $target;
    }
}

// --------------------------------------------------
// Security Checks & Initialization
// --------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

if (empty($userId)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized: User not logged in.']);
    exit;
}

$response = ['success' => false, 'message' => 'Failed to delete avatar.'];

// Resolve the base upload directory for path validation (matching avatar-upload.php)
$baseUploadDir = realpath(__DIR__ . '/../../public/images/uploads/');

if (!$baseUploadDir) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Base upload directory not found for security check.'
    ]);
    exit;
}

// CRITICAL FIX: Define the fixed public directory path
$AVATAR_DIR_PREFIX = 'images/uploads/avatars/';

// --------------------------------------------------
// ORM-based Deletion Process
// --------------------------------------------------
try {
    $user = User::find($userId);
    if (!$user) {
        throw new RuntimeException('User not found.');
    }

    // 1. Check if an avatar exists in the database
    if (empty($user->avatar_url)) {
        $response['success'] = true;
        $response['message'] = 'No avatar currently set.';
        http_response_code(200);
        echo json_encode($response);
        exit;
    }

    // --- FIX START: Reconstruct the full public path ---
    // $user->avatar_url now contains only the filename (e.g., 'image.jpg')
    $fullAvatarPath = $AVATAR_DIR_PREFIX . $user->avatar_url;

    // Now use the fully reconstructed path for realpath()
    $oldPath = realpath(__DIR__ . '/../../public/' . $fullAvatarPath);
    // --- FIX END ---

    $deletionSuccess = false;

    // 2. Safely delete the file from disk (Matching the avatar-upload.php logic)
    if (
        $oldPath &&
        strpos($oldPath, $baseUploadDir) === 0 && // Ensure path is within the allowed uploads folder
        file_exists($oldPath)
    ) {
        if (unlink($oldPath)) {
            $deletionSuccess = true;
        } else {
            // File exists but could not be deleted (e.g., permissions issue)
            error_log("Failed to delete avatar file: " . $oldPath);
            $response['message'] = 'File exists but could not be deleted (permission issue).';
            http_response_code(500);
            echo json_encode($response);
            exit;
        }
    } else {
        // Path was invalid or file didn't exist, but we still clear the DB record.
        $deletionSuccess = true;
        // Log the full attempted path for debugging
        error_log("Old avatar file not found on disk or failed path validation: " . $fullAvatarPath);
    }

    // 3. Clear the avatar_url in the database and save (ORM)
    if ($deletionSuccess) {
        $user->avatar_url = null;
        $user->save();

        // ✅ LOG THE ACTIVITY
        UsersController::logActivity($userId === $me ? 'Removed profile avatar' : "Removed the profile photo for {$user->full_name}", 'Users', $userId === $me ? null : $userId);

        $response['success'] = true;
        $response['message'] = 'Avatar successfully deleted.';
        http_response_code(200);
    }
} catch (\Throwable $e) {
    // ✅ LOG THE FAILURE (Optional but helpful for debugging)
    UsersController::logActivity("Failed to delete avatar: " . $e->getMessage(), "Users");
    error_log('Avatar deletion failed: ' . $e->getMessage());

    http_response_code(500);
    $response['message'] = 'A server error occurred during avatar deletion.';
}

echo json_encode($response);
exit;
