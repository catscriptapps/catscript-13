<?php
// /server/api/social-feed.php
//
// Single dispatch endpoint for the Social Feed: create a post, toggle a
// like, load one post's comments, add/delete a comment, delete a post.
// Mirrors the legacy gonachi/ platform's api/social-feed.php action
// dispatch. JSON in/out, no page reload — matches this app's SPA
// convention (see resources/js/pages/social-feed-page.js).

declare(strict_types=1);

use Src\Controller\SocialFeedController;
use Src\Service\AuthService;

header('Content-Type: application/json');

$userId = AuthService::userId();

if (!$userId) {
    json_response(['success' => false, 'message' => 'Please sign in to use the social feed.'], 401);
}
if (!AuthService::hasAccess('Social Feed')) {
    json_response(['success' => false, 'message' => "You don't have access to the Social Feed."], 403);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$input = array_merge($_GET, $_POST, json_decode(file_get_contents('php://input'), true) ?: []);
$action = (string) ($input['action'] ?? '');

if ($method === 'GET') {
    if ($action === 'get-details') {
        $result = SocialFeedController::postDetails((string) ($input['post_id'] ?? ''), $userId);
        json_response($result, $result['success'] ? 200 : 404);
    }

    // Default GET: the feed itself (page 1, server-rendered — matches legacy).
    $posts = SocialFeedController::feed($userId);
    $html = '';
    foreach ($posts as $post) {
        $html .= SocialFeedController::renderPostCard($post, $userId);
    }
    json_response(['success' => true, 'html' => $html]);
}

if ($method === 'POST') {
    switch ($action) {
        case 'toggle-like':
            $result = SocialFeedController::toggleLike((string) ($input['post_id'] ?? ''), $userId);
            json_response($result, $result['success'] ? 200 : 404);

        case 'add-comment':
            $result = SocialFeedController::addComment($input, $userId);
            json_response($result, $result['success'] ? 200 : 422);

        case 'delete-comment':
            $result = SocialFeedController::deleteComment((int) ($input['comment_id'] ?? 0), $userId);
            json_response($result, $result['success'] ? 200 : 403);

        case 'delete-post':
            $result = SocialFeedController::deletePost((string) ($input['post_id'] ?? ''), $userId);
            json_response($result, $result['success'] ? 200 : 403);

        default:
            // No action (or 'create') = create a post.
            $result = SocialFeedController::create($input, $userId);

            if (!$result['success']) {
                json_response(['success' => false, 'errors' => $result['errors']], 422);
            }

            json_response([
                'success' => true,
                'html' => SocialFeedController::renderPostCard($result['post'], $userId),
            ]);
    }
}

json_response(['success' => false, 'message' => 'Method not allowed'], 405);
