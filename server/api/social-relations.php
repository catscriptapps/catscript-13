<?php
// /server/api/social-relations.php
//
// The follow graph behind the Social Feed: stats, following/follower lists,
// "who to follow" suggestions, people search, and the follow/unfollow
// toggle. Mirrors the legacy gonachi/ platform's api/social-relations.php.

declare(strict_types=1);

use Src\Controller\SocialRelationsController;
use Src\Service\AuthService;

header('Content-Type: application/json');

$userId = AuthService::userId();

if (!$userId) {
    json_response(['success' => false, 'message' => 'Please sign in.'], 401);
}
if (!AuthService::hasAccess('Social Feed')) {
    json_response(['success' => false, 'message' => "You don't have access to the Social Feed."], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = array_merge($_GET, $_POST, json_decode(file_get_contents('php://input'), true) ?: []);
$action = (string) ($input['action'] ?? '');

if ($method === 'GET') {
    if ($action === 'get-stats') {
        json_response(['success' => true, ...SocialRelationsController::stats($userId)]);
    }

    if ($action === 'get-list') {
        $type = ($input['type'] ?? 'following') === 'followers' ? 'followers' : 'following';
        $rows = SocialRelationsController::list($userId, $type);
        json_response(['success' => true, 'users' => $rows, 'html' => SocialRelationsController::renderRows($rows), 'type' => $type]);
    }

    if ($action === 'search') {
        $rows = SocialRelationsController::search((string) ($input['q'] ?? ''), $userId);
        json_response(['success' => true, 'users' => $rows, 'html' => SocialRelationsController::renderRows($rows)]);
    }

    // Default GET: "Who to follow" suggestions.
    $rows = SocialRelationsController::suggestions($userId);
    json_response(['success' => true, 'users' => $rows, 'html' => SocialRelationsController::renderRows($rows)]);
}

if ($method === 'POST') {
    $targetId = (int) ($input['following_id'] ?? 0);
    $result = SocialRelationsController::toggleFollow($userId, $targetId);
    json_response($result, $result['success'] ? 200 : 422);
}

json_response(['success' => false, 'message' => 'Method not allowed'], 405);
