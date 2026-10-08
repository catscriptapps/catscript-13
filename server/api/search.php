<?php
// /server/api/search.php

declare(strict_types=1);

use Src\Controller\GlobalSearchController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

// Security Check
if (!AuthService::userId()) {
    echo json_encode(['success' => false, 'messages' => ['Sign in required']]);
    exit;
}

try {
    $controller = new GlobalSearchController();
    $controller->search();
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'messages' => [$e->getMessage()]]);
}
