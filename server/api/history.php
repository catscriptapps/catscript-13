<?php
// /server/api/history.php

declare(strict_types=1);

use Src\Controller\RecentActivitiesController;

header('Content-Type: application/json');

/**
 * Global helper for consistent JSON output if not already defined in your index
 */
if (!function_exists('json_response')) {
    function json_response(array $data, int $code = 200): void
    {
        http_response_code($code);
        echo json_encode($data);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Merge inputs to catch query params, form-data, and raw JSON payloads
$input = array_merge($_GET, $_POST, json_decode(file_get_contents('php://input'), true) ?: []);

try {
    // --------------------------------------------------
    // GET: Search / List / Pagination
    // --------------------------------------------------
    if ($method === 'GET') {
        $search = $input['q'] ?? null;
        $page = (int)($input['page'] ?? 1);

        // We use the controller's internal pagination logic
        $paginator = RecentActivitiesController::paginate($search, false, 15);

        json_response([
            'success' => true,
            'data'    => array_map(fn($item) => ['rowHtml' => RecentActivitiesController::renderRow($item)], $paginator->items()),
            'total'   => $paginator->total(),
            'current_page' => $paginator->currentPage()
        ]);
    }

    // --------------------------------------------------
    // POST: State Changes (Archive)
    // --------------------------------------------------
    if ($method === 'POST') {
        $action = $input['action'] ?? 'archive'; // Default to archive for history context
        $id = isset($input['id']) ? (int)$input['id'] : null;

        if (!$id) {
            json_response(['success' => false, 'message' => 'Missing record ID'], 400);
        }

        switch ($action) {
            case 'archive':
                if (RecentActivitiesController::archive($id)) {
                    json_response([
                        'success' => true,
                        'message' => 'Activity moved to archives.',
                        'messages' => ['Activity moved to archives.']
                    ]);
                }
                json_response(['success' => false, 'message' => 'Archive operation failed.'], 400);
                break;

            case 'unarchive':
                if (RecentActivitiesController::unarchive($id)) {
                    json_response(['success' => true, 'message' => 'Activity restored.']);
                }
                break;

            default:
                json_response(['success' => false, 'message' => "Action '{$action}' not recognized."], 400);
                break;
        }
    }
} catch (Throwable $e) {
    error_log("History API Error: " . $e->getMessage());
    json_response([
        'success' => false,
        'message' => 'Server Error: ' . $e->getMessage()
    ], 500);
}
