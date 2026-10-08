<?php
// /server/api/meals.php
//
// GET  ?plan={encodedId}              -> {plans, plan, meals, can_plan} (plan defaults to your first)
// GET  ?suggest=1&q=&type=            -> dish autocomplete (own history)
// POST {action, ...} (JSON):
//   save-plan       {encoded_id?, title, description?}
//   duplicate-plan  {plan_id}
//   delete-plan     {plan_id}
//   clear-week      {plan_id}
//   save-meal       {plan_id, encoded_id?, day, type, description, calories?}
//   delete-meal     {id}
//
// Everyone with Meals access can read every plan; creating needs the Meal
// Planner capability, and a plan can only be changed by its owner
// (enforced in MealsController).

declare(strict_types=1);

use Src\Controller\MealsController;
use Src\Service\AuthService;

header('Content-Type: application/json; charset=UTF-8');

$userId = AuthService::userId();
if (!$userId) {
    json_response(['success' => false, 'messages' => ['Authentication required.']], 401);
}
if (!AuthService::hasAccess('Meals')) {
    json_response(['success' => false, 'messages' => ["You don't have access to Meals."]], 403);
}

$userId = (int) $userId;
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        if (!empty($_GET['suggest'])) {
            json_response(['success' => true, 'data' => MealsController::suggestDishes($userId, trim((string) ($_GET['q'] ?? '')), (string) ($_GET['type'] ?? ''))]);
        }

        json_response(['success' => true] + MealsController::state($userId, (string) ($_GET['plan'] ?? '')));
    }

    if ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = new MealsController();
        $planId = (string) ($input['plan_id'] ?? '');

        $result = match ((string) ($input['action'] ?? '')) {
            'save-plan'      => $controller->savePlan($input, $userId),
            'duplicate-plan' => $controller->duplicatePlan($planId, $userId),
            'delete-plan'    => $controller->deletePlan($planId, $userId),
            'clear-week'     => $controller->clearWeek($planId, $userId),
            'save-meal'      => $controller->saveMeal($input, $userId),
            'delete-meal'    => $controller->deleteMeal((string) ($input['id'] ?? ''), $userId),
            default          => ['success' => false, 'messages' => ['Unknown action.']],
        };

        json_response($result, $result['success'] ? 200 : 422);
    }

    json_response(['success' => false, 'messages' => ['Method not supported.']], 405);
} catch (\Throwable $e) {
    json_response(['success' => false, 'messages' => ['Server error: ' . $e->getMessage()]], 500);
}
