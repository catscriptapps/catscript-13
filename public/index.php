<?php

/**
 * Project:         CatScript 13
 * Platform:        CatScript-13
 * Version:         1.0.1
 * Author:          Chigozie (Cat) Nduanya
 * Date-Created:    2026-10-07
 */

// /public/index.php

declare(strict_types=1);

require_once __DIR__ . '/../server/bootstrap.php';
require_once __DIR__ . '/../server/helpers.php';

use Src\Service\AuthService;
use Src\Config\NavigationConfig;

// ------------------------------------------------------------
// Config & Environment
// ------------------------------------------------------------
$basePath = trim($_ENV['APP_BASE_PATH'] ?? '', '/');
$appName = $_ENV['APP_NAME'] ?? 'CatScript-13';
$isPartial = ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') === 'XMLHttpRequest';

// ------------------------------------------------------------
// Main Execution
// ------------------------------------------------------------
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$path = normalizePath($uri, $basePath);

// Auth check
$isAdminReset = filter_var($_ENV['ADMIN_RESET'] ?? false, FILTER_VALIDATE_BOOLEAN); // Convert the string "true" from .env into a real boolean true

// Not installed yet (empty database): behave like maintenance mode so the
// first visit lands on the install screen instead of a database error.
$needsInstall = !isDatabaseInstalled();
$isAdminReset = $isAdminReset || $needsInstall;

if ($isAdminReset === true) {
    $isLoggedIn = false;
    $currentUser = null;
    $isAdmin = false;
} else {
    $isLoggedIn = AuthService::isLoggedIn();
    $currentUser = $isLoggedIn ? AuthService::currentUser() : null;
    $isAdmin = $isLoggedIn && AuthService::isAdmin();
}

// Serve static assets directly
$assetFile = __DIR__ . $path;
if (is_file($assetFile)) {
    return false;
}

// API route handling
resolveApiRoute($path);

$untrimmedBasePath = $_ENV['APP_BASE_PATH'] ?? '';
$baseUrl = '/' . (trim($untrimmedBasePath, '/') ? trim($untrimmedBasePath, '/') . '/' : '');
$assetBase = $baseUrl;
$baseUrl = rtrim($baseUrl, '/') . '/';
$assetBase = rtrim($assetBase, '/') . '/';

// ------------------------------------------------------------
// Layout resolution — CatScript Apps has a single shell (sidebar + header),
// resolved once up front so every early-exit branch below (auth-required,
// etc.) renders inside the same chrome as a normal page.
// ------------------------------------------------------------
$resolvedLayout = __DIR__ . '/../resources/views/layouts/app.php';

// ------------------------------------------------------------
// Maintenance mode (ADMIN_RESET=true): every page is the DB reset screen —
// nobody is signed in and nothing below touches the database, so this also
// works on a brand-new, empty database (the first install).
// ------------------------------------------------------------
if ($isAdminReset) {
    $title = 'Database Reset';
    include __DIR__ . '/../resources/views/layouts/db-reset.php';
    exit;
}

// ------------------------------------------------------------
// Protected route handling (The Security Guard)
// ------------------------------------------------------------
$protectedPaths = NavigationConfig::getProtectedPaths();
$fullPath = $untrimmedBasePath . $path;

if (in_array($fullPath, $protectedPaths, true)) {

    // 1. If not logged in at all
    if (!$isLoggedIn) {
        [$pageFile, $title] = [__DIR__ . '/../resources/views/pages/auth-required.php', 'Not Authenticated'];
        $pageMeta = ['icon' => '<svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M4.93 4.93a10 10 0 0114.14 0 10 10 0 010 14.14 10 10 0 01-14.14 0 10 10 0 010-14.14z" /></svg>'];

        if ($isPartial) {
            header('X-Page-Title: ' . $title);
            include $pageFile;
            exit;
        }
        include $resolvedLayout;
        exit;
    }

    // 2. Check App-specific Permission
    $allApps = NavigationConfig::authLinks(true);
    // authLinks() maps name => [url, title, summary], so match on the url.
    $currentAppName = array_search($fullPath, array_map(fn($app) => $app['url'], $allApps), true);

    if ($currentAppName && !AuthService::hasAccess((string)$currentAppName)) {
        // Boot unauthorized users to dashboard
        header("Location: " . $baseUrl . "access-denied");
        exit;
    }
}

// Admin-only route guard (separate from the generic app-access model above,
// since these paths aren't registered in NavigationConfig::authLinks()).
if (in_array($fullPath, NavigationConfig::getAdminOnlyPaths(), true) && !AuthService::isAdmin()) {
    header("Location: " . $baseUrl . "access-denied");
    exit;
}

// ------------------------------------------------------------
// Page route handling
// ------------------------------------------------------------
[$pageFile, $title] = resolvePageRoute($path);
$pageMeta = resolvePageMeta($title, $isLoggedIn);
$pageIcon = $pageMeta['icon'];

// Partial request handling (AJAX)
if ($isPartial) {
    // rawurlencode keeps header values safe (and readable by the SPA router as a
    // fallback title/summary source when a partial load has no clicked <a data-partial> trigger)
    header('X-Page-Title: ' . rawurlencode($title));
    header('X-Page-Summary: ' . rawurlencode($GLOBALS['pageSummary'] ?? ''));
    include $pageFile;
    exit;
}

// Final Step: Full layout rendering — $resolvedLayout was already computed
// up front (see "Layout resolution" above).
include $resolvedLayout;
