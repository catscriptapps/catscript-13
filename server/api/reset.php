<?php
// /server/api/reset.php

declare(strict_types=1);

use Src\Service\AuthService;

header('Content-Type: application/json');

// "DB Reset" — applies the database migrations in scripts/migrations/ (the
// same set `php scripts/migrate.php` runs). On an empty database that's a
// full install: the core tables, reference data, FAQs and the first admin
// (ADMIN_EMAIL / ADMIN_PASSWORD in .env). On a live one it only adds what's
// missing — it never drops, truncates, or reseeds tables and never touches
// uploaded files, so running it on production leaves existing data alone.
// Back up the database first anyway.
//
// Two ways in:
//
// 1. Maintenance mode (ADMIN_RESET=true in .env): index.php forces the whole
//    site into layouts/db-reset.php with nobody signed in, so the password
//    is checked against the ADMIN_RESET_PASSWORD secret from .env instead —
//    and only if one is actually configured (never the bootstrap fallback).
// 2. Normal mode: signed in as user #1 (the first admin — the only account
//    that sees the header trash icon), re-entering that account's own password.

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    json_response(['success' => false, 'messages' => ['Method not allowed.']], 405);
}

$isAdminReset = filter_var($_ENV['ADMIN_RESET'] ?? false, FILTER_VALIDATE_BOOLEAN);
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$password = (string) ($input['password'] ?? '');

if ($isAdminReset) {
    $secret = (string) ($_ENV['ADMIN_RESET_PASSWORD'] ?? '');
    if ($secret === '' || $secret === 'supersecret') {
        json_response(['success' => false, 'messages' => ['Set a real ADMIN_RESET_PASSWORD in .env before using maintenance mode.']], 403);
    }
    if ($password === '' || !hash_equals($secret, $password)) {
        json_response(['success' => false, 'messages' => ['Incorrect password.']], 403);
    }
} else {
    if (!AuthService::isCat()) {
        json_response(['success' => false, 'messages' => ['Forbidden.']], 403);
    }

    $currentUser = AuthService::currentUser();

    if ($password === '' || !$currentUser || !password_verify($password, (string) $currentUser->password)) {
        json_response(['success' => false, 'messages' => ['Incorrect password.']], 403);
    }
}

require_once __DIR__ . '/../../scripts/migrations/runner.php';

try {
    $result = runMigrations();
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Update failed: ' . $e->getMessage()]], 500);
}

json_response($result, $result['success'] ? 200 : 500);
