<?php
// /server/api/post-media-upload.php

declare(strict_types=1);

use Src\Service\ImageUploadService;
use Src\Service\AuthService;

header('Content-Type: application/json');

// Auth required — this was previously falling back to user_id=1 for any
// unauthenticated request, letting anyone upload files to this project's
// disk and attributing them to another user's account.
if (!AuthService::userId()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Please sign in to upload media.']);
    exit;
}
if (!AuthService::hasAccess('Social Feed')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => "You don't have access to the Social Feed."]);
    exit;
}

// 1. Validate
if (empty($_FILES['images']) || empty($_FILES['images']['tmp_name'][0])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'No media found.']);
    exit;
}

// 2. Resolve Directories
$baseUploadDir = realpath(__DIR__ . '/../../public/images/uploads/');
$postUploadDir = $baseUploadDir . '/posts/';

if (!is_dir($postUploadDir)) {
    mkdir($postUploadDir, 0777, true);
}

// 3. Service Prep
$service = new ImageUploadService($postUploadDir, 2000, 90);
$relativePublicPathPrefix = 'images/uploads/posts/';

// Hard single-file enforcement to match avatar logic
$singleFile = [
    'name'     => [$_FILES['images']['name'][0]],
    'type'     => [$_FILES['images']['type'][0]],
    'tmp_name' => [$_FILES['images']['tmp_name'][0]],
    'error'    => [$_FILES['images']['error'][0]],
    'size'     => [$_FILES['images']['size'][0]],
];

$uploaded = $service->upload($singleFile, function (array $files) use ($relativePublicPathPrefix) {
    foreach ($files as $key => $fileInfo) {
        // fileUrl is for the Frontend Preview (needs the path) — getAssetBase(),
        // not a hardcoded leading slash, so this still resolves correctly if
        // this app is ever deployed under a subdirectory (see
        // job-request-photo-upload.php for the same convention).
        $files[$key]['fileUrl'] = getAssetBase() . $relativePublicPathPrefix . $fileInfo['fileName'];
        // resultUrl is the raw filename for the hidden input/database
        $files[$key]['resultUrl'] = $fileInfo['fileName'];
    }
    return $files;
});

if (empty($uploaded) || (isset($uploaded['success']) && $uploaded['success'] === false)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Upload failed.']);
    exit;
}

// 4. Final Response
// We return 'files' array for the Uploader Factory 
// and 'url'/'filename' for your social-modal handshake.
echo json_encode([
    'success'  => true,
    'message'  => 'Media uploaded successfully.',
    'filename' => $uploaded[0]['resultUrl'],
    'url'      => $uploaded[0]['fileUrl'],
    'files'    => [
        ['url' => $uploaded[0]['fileUrl']]
    ]
]);
