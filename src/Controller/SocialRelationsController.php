<?php
// /src/Controller/SocialRelationsController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Follow;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * The follow graph behind the Real Estate World Social Feed — separate from
 * posts/comments/likes (SocialFeedController). Ported from the legacy
 * gonachi/ platform's api/social-relations.php.
 */
class SocialRelationsController
{
    public static function stats(int $userId): array
    {
        return [
            'following' => Follow::where('follower_id', $userId)->count(),
            'followers' => Follow::where('following_id', $userId)->count(),
        ];
    }

    /**
     * @return array<int, array{id:int, name:string, username:string, avatar:?string}>
     */
    public static function list(int $userId, string $type): array
    {
        $ids = $type === 'followers'
            ? Follow::where('following_id', $userId)->pluck('follower_id')
            : Follow::where('follower_id', $userId)->pluck('following_id');

        return self::toRows(User::whereIn('id', $ids)->get(), $userId);
    }

    /**
     * A handful of random users the viewer doesn't already follow, for the
     * "Who to follow" sidebar widget.
     */
    public static function suggestions(int $userId, int $limit = 5): array
    {
        $alreadyFollowing = Follow::where('follower_id', $userId)->pluck('following_id')->all();
        $excludeIds = array_merge($alreadyFollowing, [$userId]);

        $users = User::whereNotIn('id', $excludeIds)->inRandomOrder()->limit($limit)->get();

        return self::toRows($users, $userId);
    }

    /**
     * @return array<int, array{id:int, name:string, username:string, avatar:?string}>
     */
    public static function search(string $query, int $userId, int $limit = 10): array
    {
        $query = trim($query);
        if ($query === '') {
            return [];
        }

        $users = User::where('id', '!=', $userId)
            ->where(function ($q) use ($query) {
                $q->where('full_name', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%");
            })
            ->limit($limit)
            ->get();

        return self::toRows($users, $userId);
    }

    /**
     * Renders a list of user rows (from stats()/list()/suggestions()/search())
     * via components/users/social-search-item.php — one HTML string, ready
     * to drop straight into the sidebar or search dropdown.
     *
     * @param array<int, array{id:int, name:string, username:string, avatar:?string, is_following:bool}> $rows
     */
    public static function renderRows(array $rows): string
    {
        $assetBase = getAssetBase();
        $path = __DIR__ . '/../../resources/views/components/users/social-search-item.php';

        $html = '';
        foreach ($rows as $data) {
            ob_start();
            include $path;
            $html .= ob_get_clean() ?: '';
        }

        return $html;
    }

    /**
     * @return array{success: bool, status?: string, message?: string}
     */
    public static function toggleFollow(int $followerId, int $targetId): array
    {
        if ($followerId === $targetId) {
            return ['success' => false, 'message' => "You can't follow yourself."];
        }

        if (!User::where('id', $targetId)->exists()) {
            return ['success' => false, 'message' => 'User not found.'];
        }

        $existing = Follow::where('follower_id', $followerId)->where('following_id', $targetId)->first();

        if ($existing) {
            $existing->delete();
            return ['success' => true, 'status' => 'unfollowed'];
        }

        Follow::create(['follower_id' => $followerId, 'following_id' => $targetId]);
        return ['success' => true, 'status' => 'followed'];
    }

    /**
     * @return array<int, array{id:int, name:string, username:string, avatar:?string}>
     */
    private static function toRows(Collection $users, int $viewerId): array
    {
        $followingIds = Follow::where('follower_id', $viewerId)->pluck('following_id')->all();

        return $users->map(function (User $user) use ($followingIds) {
            return [
                'id' => (int) $user->id,
                'name' => $user->full_name,
                'username' => strtolower(str_replace(' ', '', $user->full_name)) . $user->id,
                'avatar' => $user->avatar_url,
                'is_following' => in_array((int) $user->id, $followingIds, true),
            ];
        })->values()->all();
    }
}
