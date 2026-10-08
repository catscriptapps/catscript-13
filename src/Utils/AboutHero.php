<?php
// /src/Utils/AboutHero.php

declare(strict_types=1);

namespace Src\Utils;

/**
 * The About page's hero photo. An admin can upload a custom one (kept in
 * public/images/uploads/about/ — only one file lives there at a time, and
 * that file IS the setting, so no database row is needed). With none
 * uploaded, the page falls back to the first home-page photo, then to the
 * plain navy gradient.
 */
class AboutHero
{
    public const DIR = 'images/uploads/about/';

    public static function absoluteDir(): string
    {
        return __DIR__ . '/../../public/' . self::DIR;
    }

    /** Filename of the uploaded custom photo, or null. */
    public static function customFile(): ?string
    {
        $files = glob(self::absoluteDir() . '*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', GLOB_BRACE) ?: [];
        if (!$files) {
            return null;
        }
        usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a)); // newest wins
        return basename($files[0]);
    }

    /** Public URL of the photo to show, or null for the gradient. */
    public static function url(string $assetBase): ?string
    {
        $custom = self::customFile();
        if ($custom) {
            return $assetBase . self::DIR . rawurlencode($custom) . '?v=' . filemtime(self::absoluteDir() . $custom);
        }
        return CuratedPhotos::fromHomeFolder($assetBase)[0] ?? null;
    }

    /** Remove every custom photo (e.g. before saving a new one, or on reset). */
    public static function clear(?string $keep = null): void
    {
        foreach (glob(self::absoluteDir() . '*') ?: [] as $file) {
            if (is_file($file) && basename($file) !== $keep && basename($file) !== '.gitkeep') {
                @unlink($file);
            }
        }
    }
}
