<?php
// /server/api/chores.php
//
// GET                                   -> the whole chores state (see ChoresController::state)
// POST {action, ...} (JSON):
//   toggle-done    {plan_id, date}                     — anyone with Chores access
//   assign         {slot, child_id, chore_id}          — Chores Manager from here down
//   unassign       {id}
//   share-out      {slots[], chore_ids[], replace}
//   clear-slot     {slot}
//   save-chore     {id?, title, area, minutes, best_time, detail?}
//   delete-chore   {id}
//   save-child     {id?, first_name, last_name, color, user_id?}
//   remove-child   {id}

declare(strict_types=1);

use Src\Controller\ChoresController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Chores')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Chores."]], 403);
}

$userId = (int) $userId;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        json_response(['success' => true] + ChoresController::state());
    }

    if ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true) ?: [];
        $c = new ChoresController();

        $result = match ((string) ($in['action'] ?? '')) {
            'toggle-done'  => $c->toggleDone((int) ($in['plan_id'] ?? 0), (string) ($in['date'] ?? ''), $userId),
            'assign'       => $c->assign((string) ($in['slot'] ?? ''), (int) ($in['child_id'] ?? 0), (int) ($in['chore_id'] ?? 0), $userId),
            'unassign'     => $c->unassign((int) ($in['id'] ?? 0)),
            'share-out'    => $c->shareOut(array_map('strval', (array) ($in['slots'] ?? [])), array_map('intval', (array) ($in['chore_ids'] ?? [])), filter_var($in['replace'] ?? false, FILTER_VALIDATE_BOOLEAN), $userId),
            'clear-slot'   => $c->clearSlot((string) ($in['slot'] ?? '')),
            'save-chore'   => $c->saveChore($in),
            'delete-chore' => $c->deleteChore((int) ($in['id'] ?? 0)),
            'save-child'   => $c->saveChild($in),
            'remove-child' => $c->removeChild((int) ($in['id'] ?? 0)),
            default        => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
