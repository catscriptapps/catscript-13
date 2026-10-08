<?php
// /src/Controller/SocialFeedController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Post;
use App\Models\PostComment;
use App\Models\PostLike;
use App\Models\Follow;
use App\Utils\IdEncoder;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Owns the Social Feed: a follow-scoped feed (your own
 * posts + posts from people you follow — never a global stream), text/photo/
 * video posts, likes, and comments. Ported from the legacy gonachi/ platform
 * (Src\Controller\SocialFeedController) — same shape, adapted to this
 * codebase's conventions (return values instead of $GLOBALS), on the legacy
 * catscript_db posts/post_comments/post_likes/follows tables. The Gonachi version also interleaves sponsored Advert
 * cards into the feed; that's intentionally left out here since the Adverts
 * module doesn't exist in gonachi-home yet.
 */
class SocialFeedController
{
    /**
     * Feed = the viewer's own posts + posts from everyone they follow,
     * newest first. Not a global stream.
     */
    public static function feed(int $viewerId, int $perPage = 15): LengthAwarePaginator
    {
        $followedIds = Follow::where('follower_id', $viewerId)->pluck('following_id')->all();
        $authorIds = array_unique(array_merge([$viewerId], $followedIds));

        return Post::fromAuthors($authorIds)
            ->with(['user', 'likes', 'comments.user'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /** For the guest landing hero's stat counter — matches AdvertsController::totalActiveCount()'s convention. */
    public static function totalPostsCount(): int
    {
        return Post::count();
    }

    /**
     * @param array $input content, media_url, media_type (all optional individually,
     *                      but at least one of content/media_url is required)
     * @return array{success: bool, errors: string[], post: ?Post}
     */
    public static function create(array $input, int $userId): array
    {
        $content = trim((string) ($input['content'] ?? ''));
        $mediaUrl = trim((string) ($input['media_url'] ?? ''));
        $mediaType = (string) ($input['media_type'] ?? 'none');

        if ($content === '' && $mediaUrl === '') {
            return ['success' => false, 'errors' => ['Write something or attach a photo/video.'], 'post' => null];
        }

        if (!in_array($mediaType, ['image', 'video', 'none'], true)) {
            $mediaType = 'none';
        }

        $post = Post::create([
            'orig_user_id' => $userId,
            'content' => $content !== '' ? $content : null,
            // Uploads always hand back a bare filename (see post-media-upload.php /
            // post-video-upload.php) — basename() here is a defensive floor, not
            // the primary guard.
            'media_url' => $mediaUrl !== '' ? basename($mediaUrl) : null,
            'media_type' => $mediaUrl !== '' ? $mediaType : 'none',
        ]);

        $post->load(['user', 'likes', 'comments.user']);

        return ['success' => true, 'errors' => [], 'post' => $post];
    }

    /**
     * @return array{success: bool, action: string, like_count: int}|array{success: bool, message: string}
     */
    public static function toggleLike(string $encodedPostId, int $userId): array
    {
        $postId = self::decodeId($encodedPostId);
        if (!$postId || !Post::where('post_id', $postId)->exists()) {
            return ['success' => false, 'message' => 'Post not found.'];
        }

        $existing = PostLike::where('post_id', $postId)->where('orig_user_id', $userId)->first();

        if ($existing) {
            $existing->delete();
            $action = 'unliked';
        } else {
            PostLike::create(['post_id' => $postId, 'orig_user_id' => $userId]);
            $action = 'liked';
        }

        return [
            'success' => true,
            'action' => $action,
            'like_count' => PostLike::where('post_id', $postId)->count(),
        ];
    }

    /**
     * Powers the view-post modal: comments + counts for one post.
     */
    public static function postDetails(string $encodedPostId, int $viewerId): array
    {
        $postId = self::decodeId($encodedPostId);
        $post = $postId ? Post::with(['likes', 'comments.user'])->find($postId) : null;

        if (!$post) {
            return ['success' => false, 'message' => 'Post not found.'];
        }

        $commentsHtml = '';
        foreach ($post->comments as $comment) {
            $commentsHtml .= self::renderCommentHtml($comment, $viewerId);
        }

        return [
            'success' => true,
            'likes' => $post->likes->count(),
            'comments_count' => $post->comments->count(),
            'html' => $commentsHtml,
            'has_many' => $post->comments->count() > 5,
        ];
    }

    /**
     * @param array $input post_id (encoded), content
     */
    public static function addComment(array $input, int $userId): array
    {
        $postId = self::decodeId((string) ($input['post_id'] ?? ''));
        $text = trim((string) ($input['content'] ?? ''));

        if (!$postId || !Post::where('post_id', $postId)->exists()) {
            return ['success' => false, 'message' => 'Post not found.'];
        }

        if ($text === '') {
            return ['success' => false, 'message' => 'Write a comment first.'];
        }

        $comment = PostComment::create([
            'post_id' => $postId,
            'orig_user_id' => $userId,
            'comment_text' => $text,
        ]);
        $comment->load('user');

        return ['success' => true, 'commentHtml' => self::renderCommentHtml($comment, $userId)];
    }

    /**
     * Owner-only.
     */
    public static function deleteComment(int $commentId, int $userId): array
    {
        $comment = PostComment::find($commentId);

        if (!$comment) {
            return ['success' => false, 'message' => 'Comment not found.'];
        }

        if ((int) $comment->orig_user_id !== $userId) {
            return ['success' => false, 'message' => 'You can only delete your own comments.'];
        }

        $comment->delete();

        return ['success' => true];
    }

    /**
     * Owner-only. Also unlinks the attached media file from disk, if any.
     */
    public static function deletePost(string $encodedPostId, int $userId): array
    {
        $postId = self::decodeId($encodedPostId);
        $post = $postId ? Post::find($postId) : null;

        if (!$post) {
            return ['success' => false, 'message' => 'Post not found.'];
        }

        if ((int) $post->orig_user_id !== $userId) {
            return ['success' => false, 'message' => 'You can only delete your own posts.'];
        }

        if (!empty($post->media_url)) {
            $folder = $post->media_type === 'video' ? 'videos' : 'images/uploads/posts';
            $path = __DIR__ . "/../../public/{$folder}/" . basename($post->media_url);
            if (file_exists($path)) {
                @unlink($path);
            }
        }

        $post->delete();

        return ['success' => true];
    }

    /**
     * Builds the data array for one post and renders post-card.php.
     */
    public static function renderPostCard(Post $post, int $viewerId): string
    {
        $author = $post->user;
        $isLiked = $post->likes->contains(fn($like) => (int) $like->orig_user_id === $viewerId);

        $data = [
            'encoded_id' => IdEncoder::encode((int) $post->post_id),
            'author_id' => (int) $post->orig_user_id,
            'author' => $author->full_name ?? 'User',
            'author_avatar' => $author->avatar_url ?? null,
            'content' => $post->content ?? '',
            'time_ago' => $post->created_at?->diffForHumans() ?? '',
            'like_count' => $post->likes->count(),
            'comment_count' => $post->comments->count(),
            'is_liked' => $isLiked,
            'media_url' => $post->media_url,
            'media_type' => $post->media_type,
        ];

        $assetBase = getAssetBase();
        $path = __DIR__ . '/../../resources/views/components/social-feed/post-card.php';

        ob_start();
        include $path;
        return ob_get_clean() ?: '';
    }

    private static function renderCommentHtml(PostComment $comment, int $viewerId): string
    {
        $author = $comment->user;

        $data = [
            'id' => (int) $comment->comment_id,
            'author' => $author->full_name ?? 'User',
            'author_avatar' => $author->avatar_url ?? null,
            'author_id' => (int) $comment->orig_user_id,
            'comment_text' => $comment->comment_text,
            'time_ago' => $comment->created_at?->diffForHumans() ?? '',
            'is_own' => (int) $comment->orig_user_id === $viewerId,
        ];

        $assetBase = getAssetBase();
        $path = __DIR__ . '/../../resources/views/components/social-feed/comment-row.php';

        ob_start();
        include $path;
        return ob_get_clean() ?: '';
    }

    /**
     * Post IDs are obfuscated in the DOM (IdEncoder) — same convention the
     * legacy platform uses. Comment IDs are not encoded (matches legacy).
     */
    private static function decodeId(string $raw): ?int
    {
        if ($raw === '') {
            return null;
        }

        if (ctype_digit($raw)) {
            return (int) $raw;
        }

        return IdEncoder::decode($raw);
    }
}
