<?php
// /server/api/tasks.php
//
// GET  ?view=current|today|week|past[&q=]  -> rendered list HTML + tab counts + upcoming (hero)
// GET  ?suggest=1&q=                       -> title autocomplete
// POST {task_title, task_detail, due_date, task_time[, encoded_id]} -> create/update
// POST {_method: DELETE, id}               -> delete

declare(strict_types=1);

use Src\Controller\TasksController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Tasks')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Tasks."]], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $query = trim((string) ($_GET['q'] ?? ''));

        if (!empty($_GET['suggest'])) {
            json_response(['success' => true, 'data' => TasksController::suggestTitles($query)]);
        }

        $view = in_array($_GET['view'] ?? '', TasksController::VIEWS, true) ? $_GET['view'] : 'current';
        $list = TasksController::renderList($view, $query);

        json_response([
            'success' => true,
            'html'    => $list['html'],
            'total'   => $list['total'],
            'counts'  => TasksController::counts(),
            'upcoming' => TasksController::upcoming(), // the live hero
        ]);
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
        $controller = new TasksController();

        $result = strtoupper((string) ($input['_method'] ?? '')) === 'DELETE'
            ? $controller->delete((string) ($input['id'] ?? ''))
            : $controller->save($input, (int) $userId);

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
