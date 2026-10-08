<?php
// /src/Utils/ActivityIcons.php

declare(strict_types=1);

namespace Src\Utils;

/**
 * Icon + colour for a recent_activities row. Legacy rows leave `category`
 * empty and put the grouping in `entity_type` (Auth, Chores, Timetable,
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
        'Timetable'   => ['path' => 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', 'tint' => 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400'],
        'Chores'      => ['path' => 'M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z', 'tint' => 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400'],
        'Users'       => ['path' => 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', 'tint' => 'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300'],
        'Cash Flow'   => ['path' => 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z', 'tint' => 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'],
        'Social Feed' => ['path' => 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z', 'tint' => 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'],
        'Tasks'       => ['path' => 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4', 'tint' => 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400'],
        'Invoices'    => ['path' => 'M9 17v-2h6v2m-6-4v-2h6v2M7 21h10a2 2 0 002-2V7l-4-4H7a2 2 0 00-2 2v14a2 2 0 002 2z', 'tint' => 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'],
        'Customers'   => ['path' => 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2', 'tint' => 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400'],
        'Receipts'    => ['path' => 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z', 'tint' => 'bg-lime-50 text-lime-700 dark:bg-lime-950/40 dark:text-lime-400'],
        'Medicals'    => ['path' => 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z M7.5 12h2.25l1.5-2.25 2.25 4.5 1.5-2.25h1.5', 'tint' => 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'],
        'Meals'       => ['path' => 'M3 17h18M5 17v-1a7 7 0 0114 0v1m-7-11V3m0 0a1 1 0 100 2 1 1 0 000-2z', 'tint' => 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'],
        'Pictures'    => ['path' => 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', 'tint' => 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400'],
        'Slideshow'   => ['path' => 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z', 'tint' => 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'],
        'Message'     => ['path' => 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', 'tint' => 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400'],
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
