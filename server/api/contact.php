<?php
// /server/api/contact.php
//
// POST {full_name, email, subject?, message, website (honeypot)} (JSON) — the
// public contact form. Only those fields are read; see
// MessagesController::submitContact() for the validation and rate limits.

declare(strict_types=1);

use Src\Controller\MessagesController;

header('Content-Type: application/json; charset=UTF-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
}

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) {
    json_response(['success' => false, 'messages' => ['Please fill in the form.']], 400);
}

$result = MessagesController::submitContact($in);
json_response($result, $result['success'] ? 200 : 422);
