<?php
// /server/helpers.php

use App\Models\Country;
use Src\Config\NavigationConfig;
use App\Models\UserType;

/**
 * Sends a successful JSON response and logs the API call.
 *
 * @param array $data The response payload to return to the client.
 * @param int   $code Optional HTTP status code (default is 200).
 */
function json_response(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    log_api_call($_SERVER['REQUEST_URI'] ?? '', $code, $_SERVER['REQUEST_METHOD']);
    exit;
}

/**
 * Logs details about each API call to a file.
 */
function log_api_call(string $path, int $status, string $method, ?string $error = null): void {}

/**
 * Returns the asset base for either DEV or PRODUCTION.
 */
function getAssetBase()
{
    $untrimmedBasePath = $_ENV['APP_BASE_PATH'] ?? '';
    $baseUrl = '/' . (trim($untrimmedBasePath, '/') ? trim($untrimmedBasePath, '/') . '/' : '');
    $assetBase = $baseUrl;

    return rtrim($assetBase, '/') . '/';
}

/**
 * Cache-busting query value for a built asset (assets/js/app.min.js,
 * assets/css/app.min.css, etc). Browsers keep serving a stale bundle from
 * cache after a rebuild since these filenames never change — appending
 * `?v=<mtime>` forces a fresh fetch whenever the file on disk changes.
 */
function assetVersion(string $relativePath): string
{
    $full = __DIR__ . '/../public/' . ltrim($relativePath, '/');
    $mtime = @filemtime($full);
    return $mtime !== false ? (string)$mtime : '1';
}

/**
 * The build id Vite writes to assets/js/build.json — a hash of every built
 * script, so it changes whenever any of them do. app.js appends it to the
 * page scripts it loads (their file names never change). Falls back to the
 * page manifest's mtime on builds from before build.json existed.
 */
function assetBuildId(): string
{
    static $id = null;
    if ($id === null) {
        $json = @file_get_contents(__DIR__ . '/../public/assets/js/build.json');
        $data = $json ? json_decode($json, true) : null;
        $id = is_array($data) && !empty($data['id']) ? (string) $data['id'] : assetVersion('assets/js/page-manifest.json');
    }
    return $id;
}

/**
 * "A", "A and B", "A, B and C" — for lists in running text. Items are used
 * as given (escape them first if they go into HTML).
 * @param string[] $items
 */
function human_list(array $items): string
{
    $items = array_values($items);
    $last = array_pop($items);
    return $items ? implode(', ', $items) . ' and ' . $last : (string) $last;
}

/**
 * Returns the limit for media upload.
 */
function getMediaLimit()
{
    return 12;
}

/**
 * Generates the HTML status badge for an entry based on its current state.
 * * Maps internal status strings to Tailwind CSS styled span elements.
 * - 'active'   => Green (Active)
 * - 'pending'  => Yellow (Pending)
 * - 'inactive' => Red (Expired)
 * - 'rejected' => Slate (Rejected)
 * - default    => Gray (Archived)
 *
 * @param string|null $status The status key to match (active, pending, inactive, rejected).
 * @return string The complete HTML string for the status badge.
 */
function getStatusBadgeHtml($status)
{
    return match ($status) {
        'active'   => '<span class="inline-flex items-center rounded-full bg-green-50 dark:bg-green-900/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-green-600 dark:text-green-400 border border-green-100 dark:border-green-800/30">Active</span>',
        'pending'  => '<span class="inline-flex items-center rounded-full bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-yellow-600 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-800/30">Pending</span>',
        'inactive' => '<span class="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/20 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/30">Expired</span>',
        'rejected' => '<span class="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">Rejected</span>',
        default    => '<span class="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">Archived</span>'
    };
}

/**
 * Returns the human‑readable role names for a given owner's user type IDs.
 *
 * This function loads all user types once and caches them in $GLOBALS['allUserTypes']
 * to avoid repeated lookups. It then maps the owner's `user_type_ids` to their
 * corresponding role names. If a type ID does not exist in the cached list,
 * the fallback role name "User" is used.
 *
 * @param object $owner  An object containing a `user_type_ids` array property.
 *
 * @return string  JSON‑encoded array of role names associated with the owner.
 */
function getUserRoles($owner)
{
    if (!isset($GLOBALS['allUserTypes'])) {
        $types = \Src\Controller\UserTypesController::list();
        $GLOBALS['allUserTypes'] = [];
        if ($types) {
            foreach ($types as $t) {
                $GLOBALS['allUserTypes'][$t->user_type_id] = $t->user_type;
            }
        }
    }

    $typeIds = $owner->user_type_ids ?? [];

    return json_encode(array_map(function ($tid) {
        return $GLOBALS['allUserTypes'][$tid] ?? 'User';
    }, $typeIds));
}

/**
 * Has the DB reset built the core schema yet? False on a brand-new, empty
 * database (or one that can't be reached) — index.php then shows the DB
 * reset screen instead of pages that would fail, and api/reset accepts the
 * ADMIN_RESET_PASSWORD so the first install can run without flipping
 * ADMIN_RESET first.
 */
function isDatabaseInstalled(): bool
{
    static $installed = null;
    if ($installed === null) {
        try {
            $installed = \Illuminate\Database\Capsule\Manager::schema()->hasTable('users');
        } catch (\Throwable $e) {
            $installed = false;
        }
    }
    return $installed;
}

/**
 * Normalize the incoming URI by removing the base path (if present).
 */
function normalizePath(string $uri, string $basePath): string
{
    $uri = '/' . ltrim($uri, '/');

    if ($basePath && str_starts_with($uri, '/' . $basePath)) {
        $uri = substr($uri, strlen('/' . $basePath));
    }

    $path = '/' . ltrim($uri, '/');
    return $path === '/' ? '/home' : $path;
}

/**
 * Handle API route resolution and execution.
 */
function resolveApiRoute(string $path): bool
{
    if (!str_starts_with($path, '/api/')) return false;

    $segments = explode('/', ltrim($path, '/'));
    $apiFile = __DIR__ . '/../server/api/' . ($segments[1] ?? 'index') . '.php';

    if (file_exists($apiFile)) {
        try {
            include $apiFile;
        } catch (\Throwable $e) {
            // An endpoint without its own try/catch would otherwise die with an
            // empty 500 (display_errors is off in production), which the
            // browser can only report as "Unexpected end of JSON input". Log
            // the real error for the server's PHP error log and answer in
            // JSON with a short, non-sensitive clue (SQLSTATE / error type).
            error_log(sprintf('[api %s] %s: %s in %s:%d', $segments[1] ?? '?', get_class($e), $e->getMessage(), $e->getFile(), $e->getLine()));
            $clue = $e instanceof \PDOException || $e instanceof \Illuminate\Database\QueryException
                ? 'database error ' . (is_array($e->errorInfo ?? null) ? ($e->errorInfo[0] ?? '') : $e->getCode())
                : (new \ReflectionClass($e))->getShortName();
            if (!headers_sent()) {
                http_response_code(500);
                header('Content-Type: application/json; charset=UTF-8');
            }
            echo json_encode(['success' => false, 'messages' => ["Something went wrong on the server ({$clue})."]]);
        }
        exit;
    }

    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'API endpoint not found']);
    exit;
}

/**
 * Resolve metadata (icon + URL) for a given page title.
 */
function resolvePageMeta(string $pageTitle, bool $isLoggedIn = false): array
{
    $icons = NavigationConfig::getIcons();
    $links = NavigationConfig::getNavLinks($isLoggedIn);

    return [
        'icon' => $icons[$pageTitle] ?? '',
        'url'  => $links[$pageTitle] ?? '',
    ];
}

/**
 * Resolve a page route and derive a human-friendly title.
 */
function resolvePageRoute(string $path): array
{
    if (preg_match('#^/([^/]+)/([^/]+)$#', $path, $m)) {
        $resource = $m[1];
        $id = urldecode($m[2]);

        $detailFile = __DIR__ . "/../resources/views/pages/{$resource}/detail.php";

        if (file_exists($detailFile)) {
            $GLOBALS['encodedId'] = $id;

            // Detail-route pages are dynamic and can't be matched by NavigationConfig,
            // so the layout header can't compute a title/summary for them on its own.
            // Give the resource a chance to supply one here, before the layout renders.
            $dynamicMeta = resolveDynamicPageMeta($resource, $id);
            if ($dynamicMeta) {
                $GLOBALS['pageSummary'] = $dynamicMeta['summary'];
                return [$detailFile, $dynamicMeta['title']];
            }

            return [$detailFile, ucfirst($resource) . ' Details'];
        }
    }

    $pageFile = __DIR__ . '/../resources/views/pages/' . ltrim($path, '/') . '.php';

    if (!file_exists($pageFile)) {
        http_response_code(404);
        $pageFile = __DIR__ . '/../resources/views/pages/404.php';
        $title = 'Page Not Found';
    } else {
        $slug = basename($path);
        $title = ucwords(str_replace(['-', '_'], ' ', $slug));
    }

    return [$pageFile, $title];
}

/**
 * Resource-specific title/summary lookups for detail-route pages, consumed
 * by resolvePageRoute() before the layout header renders.
 *
 * @return array{title: string, summary: string}|null
 */
function resolveDynamicPageMeta(string $resource, string $id): ?array
{
    // No detail-route resources yet — add per-resource lookups here as you
    // build apps with detail pages (e.g. /reports/{id}).
    return null;
}

/**
 * Validate a `?redirect=` target before it's echoed into a Location header —
 * only bare internal path segments are allowed (no scheme, no protocol-
 * relative `//host`), otherwise this would be an open-redirect vector.
 */
function sanitizeRedirectTarget(string $target): string
{
    $target = ltrim(trim($target), '/');

    if ($target === '' || !preg_match('#^[a-zA-Z0-9\-_/]+$#', $target)) {
        return 'home';
    }

    return $target;
}

/**
 * Recursively delete a directory and its contents.
 */
function rrmdir(string $dir): bool
{
    if (!is_dir($dir)) return false;

    $items = scandir($dir);
    if ($items === false) return false;

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . DIRECTORY_SEPARATOR . $item;

        if (is_dir($path)) {
            if (!rrmdir($path)) return false;
        } else {
            if (!unlink($path)) return false;
        }
    }
    return rmdir($dir);
}

/**
 * Render a PHP view file with provided variables and return the output as a string.
 */
function renderView(string $path, array $vars = []): string
{
    if (!file_exists($path)) return "<p>View not found: {$path}</p>";

    ob_start();
    extract($vars);
    include $path;
    return ob_get_clean();
}
