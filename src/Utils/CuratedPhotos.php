<?php
// /src/Utils/CuratedPhotos.php

declare(strict_types=1);

namespace Src\Utils;

use Illuminate\Database\Capsule\Manager as Capsule;

/**
 * Shared source for the slideshow photos used by every hero banner and the
 * TV screensavers (Timetable, Chores, Tasks…).
 *
 * The photos are managed on the Slideshow page (SlideshowController) and
 * listed, in order, in the slideshow_photos table; the files live in
 * public/images/home/. Until that table exists (before the 2026_10_01
 * migration has run), it falls back to the numerically-named files in the
 * folder (1.jpg, 2.jpg, … — not the news-* stock photos kept alongside).
 */
class CuratedPhotos
{
    public const DIR = 'images/home/';

    /** @var string[]|null Per-request cache (many pages ask more than once). */
    private static ?array $files = null;

    /**
     * @return string[] URLs, in slideshow order
     */
    public static function fromHomeFolder(string $assetBase): array
    {
        return array_map(fn($f) => $assetBase . self::DIR . rawurlencode($f), self::files());
    }

    /** @return string[] file names, in order — only ones that exist on disk */
    public static function files(): array
    {
        if (self::$files !== null) {
            return self::$files;
        }
        $path = __DIR__ . '/../../public/' . self::DIR;

        try {
            if (Capsule::schema()->hasTable('slideshow_photos')) {
                $rows = Capsule::table('slideshow_photos')->orderBy('sort_order')->orderBy('id')->pluck('file_name')->all();
                return self::$files = array_values(array_filter($rows, fn($f) => is_file($path . $f)));
            }
        } catch (\Throwable $e) {
            // No database to ask — use the folder
        }

        $files = is_dir($path) ? array_values(array_filter(scandir($path) ?: [], fn($f) => preg_match('/^\d+\.(jpe?g|png|webp|gif)$/i', $f))) : [];
        natcasesort($files); // 2.jpg before 10.jpg
        return self::$files = array_values($files);
    }

    /**
     * Each photo's caption from the Slideshow page, in the same order as
     * fromHomeFolder() ('' when it has none) — e.g. for the home page's TV
     * screensaver.
     * @return string[]
     */
    public static function captions(): array
    {
        $files = self::files();
        try {
            if (Capsule::schema()->hasTable('slideshow_photos')) {
                $byFile = Capsule::table('slideshow_photos')->pluck('caption', 'file_name')->all();
                return array_map(fn($f) => trim((string) ($byFile[$f] ?? '')), $files);
            }
        } catch (\Throwable $e) {
            // No database — no captions
        }
        return array_fill(0, count($files), '');
    }

    /** Forget the cached list (after the Slideshow page changes it). */
    public static function forget(): void
    {
        self::$files = null;
    }
}
