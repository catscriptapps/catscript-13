<?php
// /server/api/chat-ai-settings.php
//
// Admin-only: read (GET) or update (POST) the live chat AI autoresponder
// settings — the on/off toggle and the business-context instructions used
// as its system prompt. See Src\Service\ChatAutoResponder.

declare(strict_types=1);

use Src\Service\AuthService;
use Src\Service\ChatAutoResponder;

header('Content-Type: application/json');

if (!AuthService::isAdmin()) {
    http_response_code(403);
    echo json_encode(['success' => false, 'messages' => ['Forbidden.']]);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $enabled = (bool) ($input['enabled'] ?? false);
    $instructions = trim((string) ($input['instructions'] ?? ''));

    if (mb_strlen($instructions) > ChatAutoResponder::maxInstructionsLength()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'messages' => ['Instructions are too long (' . ChatAutoResponder::maxInstructionsLength() . ' characters max).']]);
        exit;
    }

    if ($enabled && !ChatAutoResponder::isConfigured()) {
        http_response_code(400);
        echo json_encode(['success' => false, 'messages' => ['Add ANTHROPIC_API_KEY to your .env file before turning Autorespond on.']]);
        exit;
    }

    ChatAutoResponder::updateSettings($enabled, $instructions);
}

echo json_encode([
    'success' => true,
    'enabled' => ChatAutoResponder::isEnabled(),
    'instructions' => ChatAutoResponder::instructions(),
    'configured' => ChatAutoResponder::isConfigured(),
]);
