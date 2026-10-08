<?php
// /server/api/timetable.php
//
// GET                                 -> {categories, activities, can_edit}
// POST {action, ...} (JSON):
//   save-activity    {encoded_id?, days[] (new) | day (edit), start, end, name, category_id}
//   delete-activity  {id}
//   copy-day         {source, targets[], replace}
//   clear            {day | 'all'}
//   save-category    {id?, name, color}
//   delete-category  {id, move_to?}
//
// Everyone with Timetable access can read it; changes need the Timetable
// Editor capability (enforced in TimetableController).

declare(strict_types=1);

use Src\Controller\TimetableController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Timetable')) {
    json_response(['success' => false, 'messages' => ["You don't have access to the Timetable."]], 403);
}

$userId = (int) $userId;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_response(['success' => true] + TimetableController::state());
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = new TimetableController();

        $result = match ((string) ($input['action'] ?? '')) {
            'save-activity'   => $controller->saveActivity($input, $userId),
            'delete-activity' => $controller->deleteActivity((string) ($input['id'] ?? '')),
            'copy-day'        => $controller->copyDay((string) ($input['source'] ?? ''), array_map('strval', (array) ($input['targets'] ?? [])), filter_var($input['replace'] ?? false, FILTER_VALIDATE_BOOLEAN), $userId),
            'clear'           => $controller->clear((string) ($input['day'] ?? '')),
            'save-category'   => $controller->saveCategory($input, $userId),
            'delete-category' => $controller->deleteCategory((int) ($input['id'] ?? 0), (int) ($input['move_to'] ?? 0)),
            default           => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
