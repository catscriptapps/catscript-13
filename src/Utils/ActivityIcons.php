<?php
// /src/Utils/ActivityIcons.php

declare(strict_types=1);

namespace Src\Utils;

/**
 * Icon + colour for a recent_activities row. Legacy rows leave `category`
 * empty and put the grouping in `entity_type` (Auth, Users, Message,
 * ...), so that's what this keys on. Auth rows are further split by action
 * (sign-in / sign-out / failed attempt) so they don't all look the same.
 */
class ActivityIcons
{
    /**
     * Heroicons (outline, 24px) path data + tint classes per activity type.
     * @var array<string, array{path: string, tint: string}>
     */
    private const TYPES = [
        'Users'       => ['path' => 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', 'tint' => 'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300'],
        'Message'     => ['path' => 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', 'tint' => 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400'],
        'FAQ'         => ['path' => 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'tint' => 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'],
        'Site'        => ['path' => 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', 'tint' => 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'],
        'Chats'       => ['path' => 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z', 'tint' => 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400'],
    ];

    private const AUTH_IN = ['path' => 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1', 'tint' => 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'];
    private const AUTH_OUT = ['path' => 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1', 'tint' => 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'];
    private const AUTH_FAILED = ['path' => 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z', 'tint' => 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400'];
    private const AUTH_OTHER = ['path' => 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z', 'tint' => 'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300'];
    private const FALLBACK = ['path' => 'M13 10V3L4 14h7v7l9-11h-7z', 'tint' => 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'];

    /**
     * @return array{path: string, tint: string, label: string}
     */
    public static function for(?string $entityType, ?string $category = null, ?string $action = null): array
    {
        $type = trim((string) ($entityType ?: $category ?: ''));
        $act = strtolower((string) $action);

        if ($type === 'Auth') {
            $icon = match (true) {
                str_contains($act, 'fail') => self::AUTH_FAILED,
                str_contains($act, 'logged out') || str_contains($act, 'logout') => self::AUTH_OUT,
                str_contains($act, 'login') || str_contains($act, 'signed in') => self::AUTH_IN,
                default => self::AUTH_OTHER,
            };
            return $icon + ['label' => 'Account'];
        }

        return (self::TYPES[$type] ?? self::FALLBACK) + ['label' => $type !== '' ? $type : 'General'];
    }

    /**
     * The icon as an inline <svg>.
     */
    public static function svg(string $path, string $class = 'h-5 w-5'): string
    {
        return '<svg class="' . $class . '" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">'
            . '<path stroke-linecap="round" stroke-linejoin="round" d="' . $path . '" /></svg>';
    }
}
