<?php
// /src/Utils/CuratedPhotos.php

declare(strict_types=1);

namespace Src\Utils;

/**
 * Shared source for the photos behind every hero banner (Home, Contact,
 * FAQs, Users) and the home page's TV screensaver.
 *
 * Drop numerically-named photos into public/images/home/ (1.jpg, 2.jpg, …)
 * and they show up in that order; with none, the heroes fall back to a plain
 * navy card.
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

    /** @return string[] file names, in order */
    public static function files(): array
    {
        if (self::$files !== null) {
            return self::$files;
        }
        $path = __DIR__ . '/../../public/' . self::DIR;

        $files = is_dir($path) ? array_values(array_filter(scandir($path) ?: [], fn($f) => preg_match('/^\d+\.(jpe?g|png|webp|gif)$/i', $f))) : [];
        natcasesort($files); // 2.jpg before 10.jpg
        return self::$files = array_values($files);
    }

    /**
     * A caption per photo, in the same order as fromHomeFolder() ('' when it
     * has none) — e.g. for the home page's TV screensaver. Folder photos have
     * no captions; return your own here if you add a way to set them.
     * @return string[]
     */
    public static function captions(): array
    {
        return array_fill(0, count(self::files()), '');
    }
}
