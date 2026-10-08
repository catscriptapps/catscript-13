<?php
// /server/api/about-hero.php
//
// Admin only.
// POST multipart images[]      -> set the About page hero photo
// POST {_method: DELETE} (JSON) -> remove it (back to the default photo)

declare(strict_types=1);

use Src\Controller\UsersController;
use Src\Service\AuthService;
use Src\Service\ImageUploadService;
use Src\Utils\AboutHero;

header('Content-Type: application/json; charset=UTF-8');

if (!AuthService::isAdmin()) {
    json_response(['success' => false, 'messages' => ['Only an administrator can change the About photo.']], 403);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
}

try {
    $json = json_decode(file_get_contents('php://input'), true);
    if (is_array($json) && strtoupper((string) ($json['_method'] ?? '')) === 'DELETE') {
        AboutHero::clear();
        UsersController::logActivity('Reset the About page photo to the default', 'Site');
        json_response(['success' => true, 'messages' => ['About photo reset.'], 'url' => AboutHero::url(getAssetBase())]);
    }

    if (empty($_FILES['images']['tmp_name'][0])) {
        json_response(['success' => false, 'messages' => ['No image received.']], 400);
    }

    $dir = AboutHero::absoluteDir();
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

    // Wide hero: keep up to 2400px so it stays sharp on large screens.
    $uploaded = (new ImageUploadService(realpath($dir) . '/', 2400, 88))->upload($single, fn(array $files) => $files);
    if (empty($uploaded) || (isset($uploaded['success']) && $uploaded['success'] === false)) {
        json_response(['success' => false, 'messages' => [$uploaded['message'] ?? 'Upload failed.']], 500);
    }

    $fileName = basename((string) $uploaded[0]['fileName']);
    AboutHero::clear($fileName); // only one custom photo is ever kept
    UsersController::logActivity('Changed the About page photo', 'Site');

    $url = AboutHero::url(getAssetBase());
    json_response(['success' => true, 'messages' => ['About photo updated.'], 'files' => [['url' => $url]]]);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
