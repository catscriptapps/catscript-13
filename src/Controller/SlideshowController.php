<?php
// /src/Controller/SlideshowController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\SlideshowPhoto;
use App\Models\User;
use App\Traits\RecentActivityLogger;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\ImageUploadService;
use Src\Utils\CuratedPhotos;

/**
 * Slideshow — the photos behind every hero banner and the TV screensavers
 * (Timetable, Chores, Tasks…). One shared, ordered set; files live in
 * public/images/home/ and their order / captions in slideshow_photos.
 *
 * Open to admins and anyone granted the "Slideshow" app (Users → App
 * access). Uploads, caption changes, reordering and deletes are logged to
 * recent_activities (entity_type "Slideshow").
 */
class SlideshowController
{
    use RecentActivityLogger;

    private const MAX_DIMENSION = 2400;
    private const MAX_CAPTION = 255;
    private const MAX_PHOTOS = 200;

    private static function dir(): string
    {
        return __DIR__ . '/../../public/' . CuratedPhotos::DIR;
    }

    public static function ready(): bool
    {
        return Capsule::schema()->hasTable('slideshow_photos');
    }

    // ============================================================
    // Reads
    // ============================================================

    public static function state(): array
    {
        if (!self::ready()) {
            return ['photos' => [], 'ready' => false];
        }
        $names = User::pluck('full_name', 'id');
        $photos = SlideshowPhoto::orderBy('sort_order')->orderBy('id')->get()
            ->map(fn(SlideshowPhoto $p, int $i) => self::present($p, $i + 1, $names))->values()->all();
        return ['photos' => $photos, 'ready' => true];
    }

    private static function present(SlideshowPhoto $p, int $position, $names): array
    {
        $exists = is_file(self::dir() . $p->file_name);
        return [
            'id'       => (int) $p->id,
            'url'      => getAssetBase() . CuratedPhotos::DIR . rawurlencode($p->file_name) . ($p->updated_at ? '?v=' . $p->updated_at->timestamp : ''),
            'file'     => (string) $p->file_name,
            'caption'  => (string) ($p->caption ?? ''),
            'position' => $position,
            'width'    => $p->width,
            'height'   => $p->height,
            'bytes'    => $p->bytes,
            'missing'  => !$exists,
            'added'    => $p->created_at ? $p->created_at->format('Y-m-d') : null,
            'added_by' => $p->orig_user_id ? (string) ($names[$p->orig_user_id] ?? '') : '',
        ];
    }

    // ============================================================
    // Writes
    // ============================================================

    /** New photos (multi-file $_FILES['images']) go to the end of the slideshow. */
    public static function upload(array $images, int $userId): array
    {
        if (!self::ready()) {
            return self::notReady();
        }
        if (SlideshowPhoto::count() >= self::MAX_PHOTOS) {
            return ['success' => false, 'messages' => ['The slideshow already has ' . self::MAX_PHOTOS . ' photos — delete some first.']];
        }
        $dir = self::dir();
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }

        $uploaded = (new ImageUploadService(realpath($dir) . '/', self::MAX_DIMENSION, 86))
            ->upload($images, fn(array $files) => $files);
        if (empty($uploaded) || (isset($uploaded['success']) && $uploaded['success'] === false)) {
            return ['success' => false, 'messages' => [$uploaded['message'] ?? 'No photos could be saved.']];
        }

        $n = 0;
        Capsule::connection()->transaction(function () use ($uploaded, $userId, $dir, &$n) {
            $order = (int) SlideshowPhoto::max('sort_order');
            foreach ($uploaded as $file) {
                $name = basename((string) $file['fileName']);
                $size = @getimagesize($dir . $name) ?: [null, null];
                SlideshowPhoto::create([
                    'file_name'    => $name,
                    'sort_order'   => ++$order,
                    'width'        => $size[0],
                    'height'       => $size[1],
                    'bytes'        => @filesize($dir . $name) ?: null,
                    'orig_user_id' => $userId,
                ]);
                $n++;
            }
        });
        CuratedPhotos::forget();
        static::logActivity('Added ' . $n . ' ' . ($n === 1 ? 'photo' : 'photos') . ' to the slideshow', 'Slideshow');

        // upload-modal.js hands `files` to its onComplete callback — here, the whole updated slideshow
        $state = self::state();
        return ['success' => true, 'messages' => [$n === 1 ? 'Photo added to the slideshow.' : "{$n} photos added to the slideshow."], 'files' => $state['photos']] + $state;
    }

    public function caption(int $id, string $caption): array
    {
        $photo = self::ready() ? SlideshowPhoto::find($id) : null;
        if (!$photo) {
            return ['success' => false, 'messages' => ['That photo no longer exists.']];
        }
        $caption = trim(preg_replace('/\s+/', ' ', $caption));
        if (mb_strlen($caption) > self::MAX_CAPTION) {
            return ['success' => false, 'messages' => ['Keep the caption under ' . self::MAX_CAPTION . ' characters.']];
        }
        $photo->caption = $caption !== '' ? $caption : null;
        $photo->save();
        return ['success' => true, 'messages' => ['Caption saved.']] + self::state();
    }

    /** Save the whole order (ids, first to last). Ids not listed keep their place after these. */
    public function reorder(array $ids): array
    {
        if (!self::ready()) {
            return self::notReady();
        }
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $all = SlideshowPhoto::orderBy('sort_order')->orderBy('id')->pluck('id')->map(fn($id) => (int) $id)->all();
        $order = array_merge(array_values(array_intersect($ids, $all)), array_values(array_diff($all, $ids)));

        Capsule::connection()->transaction(function () use ($order) {
            foreach ($order as $i => $id) {
                SlideshowPhoto::where('id', $id)->where('sort_order', '<>', $i + 1)->update(['sort_order' => $i + 1]);
            }
        });
        CuratedPhotos::forget();
        static::logActivity('Reordered the slideshow', 'Slideshow');
        return ['success' => true, 'messages' => ['New order saved.']] + self::state();
    }

    /** Delete one or more photos (rows and files). */
    public function delete(array $ids): array
    {
        if (!self::ready()) {
            return self::notReady();
        }
        $photos = SlideshowPhoto::whereIn('id', array_map('intval', $ids))->get();
        if ($photos->isEmpty()) {
            return ['success' => false, 'messages' => ['Those photos no longer exist.']];
        }
        $dir = realpath(self::dir());
        foreach ($photos as $p) {
            $path = $dir ? realpath($dir . DIRECTORY_SEPARATOR . basename($p->file_name)) : false;
            if ($path && str_starts_with($path, $dir) && is_file($path)) {
                @unlink($path);
            }
            $p->delete();
        }
        // Close the gaps
        Capsule::connection()->transaction(function () {
            foreach (SlideshowPhoto::orderBy('sort_order')->orderBy('id')->pluck('id') as $i => $id) {
                SlideshowPhoto::where('id', $id)->update(['sort_order' => $i + 1]);
            }
        });
        CuratedPhotos::forget();
        $n = $photos->count();
        static::logActivity('Removed ' . $n . ' ' . ($n === 1 ? 'photo' : 'photos') . ' from the slideshow', 'Slideshow');
        return ['success' => true, 'messages' => [$n === 1 ? 'Photo deleted.' : "{$n} photos deleted."]] + self::state();
    }

    private static function notReady(): array
    {
        return ['success' => false, 'messages' => ['The slideshow needs a database update first — run the DB update from the header.']];
    }
}
