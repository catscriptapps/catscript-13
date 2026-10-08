<?php
// /src/Controller/PicturesController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Picture;
use App\Models\PictureComment;
use App\Models\PictureReaction;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\ImageUploadService;

/**
 * Pictures — a private photo gallery (ported from the legacy CatScript
 * Pictures app, on the same legacy `pictures` table and the same
 * images/uploads/gallery/ folder). Pictures are private to their owner,
 * exactly as in legacy.
 *
 * The page loads the owner's whole gallery once (gallery()); filtering,
 * search, grouping and the viewer all run in the browser. Writes return the
 * changed pictures so the client can patch its copy.
 *
 * Each picture also carries its emoji reactions and comments
 * (picture_reactions / picture_comments, migration 2026_10_06_000001); until
 * those tables exist a picture simply has none.
 *
 * Uploads, caption / favourite changes, comments and deletes are written to
 * recent_activities (entity_type "Pictures").
 */
class PicturesController
{
    use RecentActivityLogger;

    public const UPLOAD_DIR = 'images/uploads/gallery/';
    private const GALLERY_LIMIT = 5000;
    private const MAX_CAPTION = 500;
    private const MAX_COMMENT = 1000;
    private const MAX_REACTIONS = 12;
    /** Longest side kept on the server (the browser already resizes to this). */
    private const MAX_DIMENSION = 2400;

    // ============================================================
    // Reads
    // ============================================================

    /**
     * @return array<int, array>
     */
    public static function gallery(int $userId): array
    {
        $pictures = Picture::ownedBy($userId)
            ->orderByDesc('created_at')
            ->orderByDesc('picture_id')
            ->limit(self::GALLERY_LIMIT)
            ->get();

        // Reactions and comments for the whole gallery in two queries
        [$reactions, $comments] = self::extrasFor($pictures->pluck('picture_id')->all());

        return $pictures
            ->map(fn(Picture $p) => self::present($p, $reactions[$p->picture_id] ?? [], $comments[$p->picture_id] ?? []))
            ->all();
    }

    /**
     * @param string[]|null $reactions emojis, oldest first (null = look them up)
     * @param array[]|null  $comments  presented comments, oldest first (null = look them up)
     */
    public static function present(Picture $p, ?array $reactions = null, ?array $comments = null): array
    {
        $taken = $p->created_at;
        if ($reactions === null || $comments === null) {
            [$r, $c] = self::extrasFor([(int) $p->picture_id]);
            $reactions ??= $r[$p->picture_id] ?? [];
            $comments ??= $c[$p->picture_id] ?? [];
        }

        return [
            'encoded_id' => IdEncoder::encode((int) $p->picture_id),
            'url'        => getAssetBase() . self::UPLOAD_DIR . rawurlencode((string) $p->pic_name),
            'caption'    => (string) ($p->pic_caption ?? ''),
            'favourite'  => (bool) $p->is_favourite,
            'date'       => $taken ? $taken->format('Y-m-d') : null,
            'reactions'  => $reactions,
            'comments'   => $comments,
        ];
    }

    /**
     * Reactions and comments grouped by picture id.
     * @param int[] $pictureIds
     * @return array{0: array<int, string[]>, 1: array<int, array[]>}
     */
    private static function extrasFor(array $pictureIds): array
    {
        if (!$pictureIds || !self::hasExtras()) {
            return [[], []];
        }

        $reactions = [];
        $comments = [];
        foreach (array_chunk($pictureIds, 1000) as $chunk) {
            PictureReaction::whereIn('picture_id', $chunk)->orderBy('id')->get(['picture_id', 'emoji'])
                ->each(function (PictureReaction $r) use (&$reactions) { $reactions[$r->picture_id][] = (string) $r->emoji; });
            PictureComment::whereIn('picture_id', $chunk)->orderBy('created_at')->orderBy('id')->get()
                ->each(function (PictureComment $c) use (&$comments) { $comments[$c->picture_id][] = self::presentComment($c); });
        }

        return [$reactions, $comments];
    }

    private static function presentComment(PictureComment $c): array
    {
        return [
            'id'   => IdEncoder::encode((int) $c->id),
            'body' => (string) $c->body,
            'at'   => $c->created_at ? $c->created_at->format(DATE_ATOM) : null,
        ];
    }

    /** Whether migration 2026_10_06_000001 has run (cached per request). */
    private static function hasExtras(): bool
    {
        static $has = null;
        if ($has === null) {
            try {
                $has = Capsule::schema()->hasTable('picture_reactions') && Capsule::schema()->hasTable('picture_comments');
            } catch (\Throwable $e) {
                $has = false;
            }
        }
        return $has;
    }

    // ============================================================
    // Writes
    // ============================================================

    /**
     * Save uploaded images (multi-file $_FILES['images']) as new pictures.
     * @return array{success: bool, messages: string[], files?: array}
     */
    public static function upload(array $images, int $userId): array
    {
        $dir = __DIR__ . '/../../public/' . self::UPLOAD_DIR;
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $uploaded = (new ImageUploadService(realpath($dir) . '/', self::MAX_DIMENSION, 88))
            ->upload($images, fn(array $files) => $files);

        if (empty($uploaded) || (isset($uploaded['success']) && $uploaded['success'] === false)) {
            return ['success' => false, 'messages' => [$uploaded['message'] ?? 'No pictures could be saved.']];
        }

        $created = [];
        foreach ($uploaded as $file) {
            $picture = new Picture([
                'pic_name'     => basename((string) $file['fileName']),
                'pic_caption'  => null,
                'is_favourite' => false,
            ]);
            $picture->orig_user_id = $userId;
            $picture->status_id = Picture::STATUS_DEFAULT;
            $picture->save();
            $created[] = self::present($picture->refresh());
        }

        $n = count($created);
        static::logActivity('Uploaded ' . $n . ' ' . ($n === 1 ? 'picture' : 'pictures') . ' to the gallery', 'Pictures');

        return [
            'success'  => true,
            'messages' => [$n === 1 ? 'Picture added.' : "{$n} pictures added."],
            // upload-modal.js hands `files` to its onComplete callback
            'files'    => $created,
        ];
    }

    /**
     * Change a picture's caption and/or favourite flag.
     */
    public function update(string $encodedId, array $data, int $userId): array
    {
        try {
            $picture = Picture::ownedBy($userId)->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$picture) {
                return ['success' => false, 'messages' => ['Picture not found.']];
            }

            if (array_key_exists('caption', $data)) {
                $caption = trim((string) $data['caption']);
                if (mb_strlen($caption) > self::MAX_CAPTION) {
                    return ['success' => false, 'messages' => ['Captions must be ' . self::MAX_CAPTION . ' characters or fewer.']];
                }
                if ($caption !== (string) ($picture->pic_caption ?? '')) {
                    $picture->pic_caption = $caption !== '' ? $caption : null;
                    $picture->save();
                    static::logActivity($caption !== '' ? "Captioned a picture: {$caption}" : 'Removed a picture caption', 'Pictures', $picture->picture_id);
                }
            }

            if (array_key_exists('favourite', $data)) {
                $favourite = filter_var($data['favourite'], FILTER_VALIDATE_BOOLEAN);
                if ($favourite !== (bool) $picture->is_favourite) {
                    $picture->is_favourite = $favourite;
                    $picture->save();
                    $label = $picture->pic_caption ? ": {$picture->pic_caption}" : '';
                    static::logActivity(($favourite ? 'Added a picture to favourites' : 'Removed a picture from favourites') . $label, 'Pictures', $picture->picture_id);
                }
            }

            return ['success' => true, 'messages' => ['Picture updated.'], 'picture' => self::present($picture->refresh())];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the picture: ' . $e->getMessage()]];
        }
    }

    /**
     * Put an emoji on a picture, or take it off again if it's already there.
     */
    public function react(string $encodedId, string $emoji, int $userId): array
    {
        try {
            $picture = Picture::ownedBy($userId)->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$picture) {
                return ['success' => false, 'messages' => ['Picture not found.']];
            }
            if (!self::hasExtras()) {
                return ['success' => false, 'messages' => ["Emojis aren't set up yet — run the database migrations."]];
            }

            $emoji = trim($emoji);
            // An emoji is a short run of symbols: no letters, digits, spaces or markup
            if ($emoji === '' || strlen($emoji) > 32 || mb_strlen($emoji) > 8 || preg_match('/[\p{L}\p{N}\s<>&"\']/u', $emoji)) {
                return ['success' => false, 'messages' => ['Pick an emoji.']];
            }

            $existing = PictureReaction::where('picture_id', $picture->picture_id)->where('user_id', $userId)->where('emoji', $emoji)->first();
            if ($existing) {
                $existing->delete();
            } else {
                if (PictureReaction::where('picture_id', $picture->picture_id)->count() >= self::MAX_REACTIONS) {
                    return ['success' => false, 'messages' => ['A picture can hold up to ' . self::MAX_REACTIONS . ' emojis — take one off first.']];
                }
                PictureReaction::create(['picture_id' => $picture->picture_id, 'user_id' => $userId, 'emoji' => $emoji]);
            }

            return ['success' => true, 'messages' => [$existing ? 'Emoji removed.' : 'Emoji added.'], 'picture' => self::present($picture)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the emoji: ' . $e->getMessage()]];
        }
    }

    /**
     * Write a comment on a picture.
     */
    public function comment(string $encodedId, string $body, int $userId): array
    {
        try {
            $picture = Picture::ownedBy($userId)->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$picture) {
                return ['success' => false, 'messages' => ['Picture not found.']];
            }
            if (!self::hasExtras()) {
                return ['success' => false, 'messages' => ["Comments aren't set up yet — run the database migrations."]];
            }

            $body = trim($body);
            if ($body === '') {
                return ['success' => false, 'messages' => ['Write something first.']];
            }
            if (mb_strlen($body) > self::MAX_COMMENT) {
                return ['success' => false, 'messages' => ['Comments must be ' . self::MAX_COMMENT . ' characters or fewer.']];
            }

            PictureComment::create(['picture_id' => $picture->picture_id, 'user_id' => $userId, 'body' => $body]);
            static::logActivity('Commented on a picture: ' . mb_strimwidth($body, 0, 80, '…'), 'Pictures', $picture->picture_id);

            return ['success' => true, 'messages' => ['Comment added.'], 'picture' => self::present($picture)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not add the comment: ' . $e->getMessage()]];
        }
    }

    /**
     * Delete one of the comments on a picture.
     */
    public function deleteComment(string $encodedId, string $encodedCommentId, int $userId): array
    {
        try {
            $picture = Picture::ownedBy($userId)->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$picture || !self::hasExtras()) {
                return ['success' => false, 'messages' => ['Picture not found.']];
            }

            $comment = PictureComment::where('picture_id', $picture->picture_id)->find(IdEncoder::decode($encodedCommentId) ?? 0);
            if (!$comment) {
                return ['success' => false, 'messages' => ['Comment not found.']];
            }
            $comment->delete();
            static::logActivity('Deleted a comment on a picture', 'Pictures', $picture->picture_id);

            return ['success' => true, 'messages' => ['Comment deleted.'], 'picture' => self::present($picture)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the comment: ' . $e->getMessage()]];
        }
    }

    /**
     * Set the favourite flag on several pictures at once.
     * @param string[] $encodedIds
     */
    public function favouriteMany(array $encodedIds, bool $favourite, int $userId): array
    {
        try {
            $pictures = $this->ownedMany($encodedIds, $userId);
            if (!$pictures) {
                return ['success' => false, 'messages' => ['No pictures found.']];
            }

            $changed = 0;
            foreach ($pictures as $picture) {
                if ((bool) $picture->is_favourite !== $favourite) {
                    $picture->is_favourite = $favourite;
                    $picture->save();
                    $changed++;
                }
            }
            if ($changed) {
                static::logActivity(($favourite ? 'Added ' : 'Removed ') . $changed . ' ' . ($changed === 1 ? 'picture' : 'pictures') . ($favourite ? ' to' : ' from') . ' favourites', 'Pictures');
            }

            return [
                'success'  => true,
                'messages' => [$favourite ? 'Added to favourites.' : 'Removed from favourites.'],
                'pictures' => array_map(fn(Picture $p) => self::present($p), $pictures),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the pictures: ' . $e->getMessage()]];
        }
    }

    /**
     * Delete one or more pictures (rows and files).
     * @param string[] $encodedIds
     */
    public function delete(array $encodedIds, int $userId): array
    {
        try {
            $pictures = $this->ownedMany($encodedIds, $userId);
            if (!$pictures) {
                return ['success' => false, 'messages' => ['Picture not found.']];
            }

            $deleted = [];
            foreach ($pictures as $picture) {
                $file = (string) $picture->pic_name;
                $deleted[] = IdEncoder::encode((int) $picture->picture_id);
                if (self::hasExtras()) {
                    PictureReaction::where('picture_id', $picture->picture_id)->delete();
                    PictureComment::where('picture_id', $picture->picture_id)->delete();
                }
                $picture->delete();
                self::unlinkFile($file);
            }

            $n = count($deleted);
            static::logActivity('Deleted ' . $n . ' ' . ($n === 1 ? 'picture' : 'pictures') . ' from the gallery', 'Pictures', $n === 1 ? IdEncoder::decode($deleted[0]) : null);

            return ['success' => true, 'messages' => [$n === 1 ? 'Picture deleted.' : "{$n} pictures deleted."], 'deleted' => $deleted];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Helpers
    // ============================================================

    /**
     * @param string[] $encodedIds
     * @return Picture[]
     */
    private function ownedMany(array $encodedIds, int $userId): array
    {
        $ids = array_values(array_filter(array_map(fn($e) => IdEncoder::decode((string) $e), array_slice($encodedIds, 0, 500))));
        if (!$ids) {
            return [];
        }
        return Picture::ownedBy($userId)->whereIn('picture_id', $ids)->get()->all();
    }

    private static function unlinkFile(string $fileName): void
    {
        $name = basename($fileName);
        if ($name === '') {
            return;
        }
        // Only delete when no other row still points at the same file
        if (Picture::where('pic_name', $name)->exists()) {
            return;
        }
        $path = __DIR__ . '/../../public/' . self::UPLOAD_DIR . $name;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
