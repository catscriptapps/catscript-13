<?php
// /server/api/chat-admin-unread-count.php
//
// Lightweight, fast-polled (~3s) admin-only endpoint powering the "Live
// Chat" sidebar nav badge (see resources/views/partials/layout-sidebar.php
// and resources/js/ui/live-chat-badge.js). Deliberately a plain poll, not
// SSE — a background badge count doesn't need a persistent connection,
// and this keeps the number of concurrent long-lived requests down.

declare(strict_types=1);

use Src\Controller\ChatController;
use Src\Service\AuthService;

header('Content-Type: application/json');

if (!AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false]);
    exit;
}

echo json_encode([
    'success' => true,
    'count' => ChatController::unreadCountForAdmin(),
]);
