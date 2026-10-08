<?php
// /server/api/avatar-upload.php

declare(strict_types=1);

use App\Models\User;
use Src\Service\ImageUploadService;
use Src\Controller\UsersController; // ✅ Import for logging

// JSON response header
header('Content-Type: application/json');

// --------------------------------------------------
// Auth: your own photo — or, for an admin, anyone's (?user=<encoded id>,
// from the Users page). Checked before the file is touched.
// --------------------------------------------------
$me = (int) (\Src\Service\AuthService::userId() ?? 0);
if (!$me) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in first.']);
    exit;
}
$userId = $me;
$forUser = trim((string) ($_GET['user'] ?? ''));if ($forUser !== '') {
    $target = (int) (\App\Utils\IdEncoder::decode($forUser) ?? 0);
    if ($target !== $me) {
        if (!\Src\Service\AuthService::isAdmin()) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Only an administrator can change someone else’s photo.']);
            exit;
        }
        if (!$target || !User::find($target)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'User not found.']);
            exit;
        }
        $userId = $target;
    }
}

// --------------------------------------------------
// Validate uploaded file
// --------------------------------------------------
if (
    empty($_FILES['images']) ||
    !is_array($_FILES['images']['tmp_name']) ||
    empty($_FILES['images']['tmp_name'][0])
) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'No avatar image found in request.'
    ]);
    exit;
}

// --------------------------------------------------
// Resolve upload directories
// --------------------------------------------------
$baseUploadDir = realpath(__DIR__ . '/../../public/images/uploads/');
if (!$baseUploadDir) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Base upload directory not found.'
    ]);
    exit;
}

$avatarUploadDir = $baseUploadDir . '/avatars/';
if (!is_dir($avatarUploadDir)) {
    mkdir($avatarUploadDir, 0777, true);
}

// --------------------------------------------------
// HARD single-file enforcement (like cover pages)
// --------------------------------------------------
$singleFile = [
    'name'      => [$_FILES['images']['name'][0]],
    'type'      => [$_FILES['images']['type'][0]],
    'tmp_name'  => [$_FILES['images']['tmp_name'][0]],
    'error'     => [$_FILES['images']['error'][0]],
    'size'      => [$_FILES['images']['size'][0]],
];

// --------------------------------------------------
// Upload image
// --------------------------------------------------
$service = new ImageUploadService($avatarUploadDir, 2000, 90);

// /server/api/avatar-upload.php

// Find the public-facing path (relative to /public) from the absolute disk path.
// This assumes the public/images/uploads/ directory maps to /images/uploads/ publicly.
// NOTE: We keep this for old path reconstruction/deletion, but DO NOT save it to the DB.
$relativePublicPathPrefix = 'images/uploads/avatars/';

$uploaded = $service->upload($singleFile, function (array $files) use ($relativePublicPathPrefix) {

    foreach ($files as $key => $fileInfo) {
        // CONSTRUCT THE PUBLIC URL (including directory) for the frontend response
        $publicUrlWithDir = $relativePublicPathPrefix . $fileInfo['fileName'];

        // CRITICAL FIX: Save ONLY the filename to the database via 'resultUrl'
        $files[$key]['resultUrl'] = $fileInfo['fileName'];

        // Add the full path to another key for the frontend response, which expects a full URL
        $files[$key]['fileUrl'] = $publicUrlWithDir;
    }

    return $files;
});

if (
    empty($uploaded) ||
    (isset($uploaded['success']) && $uploaded['success'] === false)
) {
    $message = $uploaded['message'] ?? 'Avatar upload failed.';
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $message
    ]);
    exit;
}

// --------------------------------------------------
// Persist avatar to DB
// --------------------------------------------------
try {
    $user = User::find($userId);
    if (!$user) {
        throw new RuntimeException('User not found.');
    }

    // 1. Get the new filename. 
    // We use basename() to FORCE it to be just "image.jpg" 
    // even if the service tried to prepend a path.
    $newFileName = basename($uploaded[0]['resultUrl']);

    // 2. Delete old avatar if exists
    if (!empty($user->avatar_url)) {
        // We use basename here too, just in case the DB currently has a dirty path
        $oldFileNameOnly = basename($user->avatar_url);
        $oldFilePath = $relativePublicPathPrefix . $oldFileNameOnly;

        $oldPath = realpath(__DIR__ . '/../../public/' . $oldFilePath);
        if (
            $oldPath &&
            strpos($oldPath, realpath($baseUploadDir)) === 0 &&
            file_exists($oldPath)
        ) {
            unlink($oldPath);
        }
    }

    // 3. Save new avatar (GUARANTEED to be just the filename now)
    $user->avatar_url = $newFileName;
    $user->save();

    // ✅ LOG THE ACTIVITY
    UsersController::logActivity($userId === $me ? 'Updated profile avatar' : "Updated the profile photo for {$user->full_name}", 'Users', $userId === $me ? null : $userId);
} catch (\Throwable $e) {
    error_log('Avatar DB update failed: ' . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Avatar uploaded but database update failed.'
    ]);
    exit;
}

// Final response (frontend-safe)
echo json_encode([
    'success' => true,
    'message' => 'Avatar uploaded successfully.',
    'files' => [ // Changed from 'uploadedFiles' to 'files'
        [
            'url' => $uploaded[0]['fileUrl']
        ]
    ]
]);
