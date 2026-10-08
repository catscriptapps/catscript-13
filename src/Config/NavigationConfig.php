<?php
// /src/Config/NavigationConfig.php

declare(strict_types=1);

namespace Src\Config;

use Src\Service\AuthService;

/**
 * NavigationConfig handles all static data related to the application's
 * primary navigation structure, including link URLs and associated icons.
 * The sidebar (partials/sidebar.php) renders straight from getNavLinks(),
 * so adding a rebuilt CatScript app is a one-entry change in authLinks()
 * plus an icon in getIcons().
 */
class NavigationConfig
{
    /**
     * Defines the icon mapping for each navigation link name.
     * @return array<string, string>
     */
    public static function getIcons(): array
    {
        return [
            'Home'        => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l9-9 9 9v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4H9v4a2 2 0 0 1-2 2H3v-9z" /></svg>',
            'About'       => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /></svg>',
            'FAQs'        => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            'Contact'     => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>',
            'Dashboard'   => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/></svg>',
            'Messages'    => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>',
            'Profile'     => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>',
            'Users'       => '<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75a3 3 0 11-6 0 3 3 0 016 0zM6.75 6.75a3 3 0 116 0 3 3 0 01-6 0zM3 21a6 6 0 0112 0M9 21a6 6 0 0112 0"></path></svg>',
        ];
    }

    /**
     * Returns the navigation links for the current user.
     */
    public static function getNavLinks(bool $isLoggedIn): array
    {
        return $isLoggedIn ? self::authLinks() : self::publicLinks();
    }

    /** Sidebar / dashboard groups, in display order. Unlisted apps go to Workspace. */
    public const SECTION_ORDER = ['Workspace', 'Community', 'Account', 'Admin', 'Help'];
    private const SECTION_OF = [
        'Messages' => 'Community',
        'Profile' => 'Account', 'Users' => 'Account',
        'About' => 'Help', 'FAQs' => 'Help', 'Contact' => 'Help',
    ];

    /**
     * Apps still being rebuilt, shown greyed out ("Soon") in their section to
     * people who've been given them — so a section like Business shows its
     * full shape before every app in it is live.
     */
    private const UPCOMING = [];

    public static function sectionOf(string $name): string
    {
        return self::SECTION_OF[$name] ?? 'Workspace';
    }

    /**
     * The current user's links grouped into sections (ordered), used by both
     * the sidebar and the dashboard. Sections that only hold upcoming apps
     * are included (empty) so they can show their "Soon" items.
     * @return array<string, array<string, array>>
     */
    public static function sections(bool $isLoggedIn): array
    {
        $sections = [];
        foreach (self::getNavLinks($isLoggedIn) as $name => $link) {
            $sections[self::sectionOf($name)][$name] = $link;
        }
        if ($isLoggedIn) {
            foreach (array_keys(self::upcoming()) as $section) {
                $sections[$section] ??= [];
            }
        }
        uksort($sections, fn($a, $b) => array_search($a, self::SECTION_ORDER, true) <=> array_search($b, self::SECTION_ORDER, true));
        return $sections;
    }

    /**
     * Upcoming apps the current user has been given, by section.
     * @return array<string, string[]>
     */
    public static function upcoming(): array
    {
        $out = [];
        foreach (self::UPCOMING as $name) {
            if (!isset(self::authLinks(true)[$name]) && AuthService::hasAccess($name)) {
                $out[self::sectionOf($name)][] = $name;
            }
        }
        return $out;
    }

    /**
     * Returns all auth-only links.
     * If $showAll is true, it ignores permissions (used for the route guard).
     */
    public static function authLinks(bool $showAll = false): array
    {
        $base = $_ENV['APP_BASE_PATH'] ?? '';

        $allPossibleApps = [
            'Dashboard' => [
                'url' => $base . '/dashboard',
                'title' => 'Dashboard',
                'summary' => 'Your workspace hub — every app you have access to, plus recent activity.'
            ],
            'Messages' => [
                'url' => $base . '/messages',
                'title' => 'Messages',
                'summary' => 'Messages sent in through the contact form.'
            ],
            'Profile' => [
                'url' => $base . '/profile',
                'title' => 'Profile',
                'summary' => 'Manage your account details, avatar, and password.'
            ],
            'Users' => [
                'url' => $base . '/users',
                'title' => 'User Management',
                'summary' => 'Create and manage accounts, roles, and access.'
            ],
        ];

        if ($showAll) {
            return $allPossibleApps;
        }

        $visibleLinks = [];
        foreach ($allPossibleApps as $name => $config) {
            if (AuthService::hasAccess($name)) {
                $visibleLinks[$name] = $config;
            }
        }

        return $visibleLinks;
    }

    /**
     * Permission-controlled apps that are live in this app — the "App access"
     * checkboxes an admin sees when editing a user. Grows automatically as
     * rebuilt apps are added to authLinks().
     * @return string[]
     */
    public static function grantableApps(): array
    {
        $apps = array_values(array_intersect(AuthService::PERMISSIONED_APPS, array_keys(self::authLinks(true))));

        // Capabilities that ride along with an app (shown right after it)
        $out = [];
        foreach ($apps as $app) {
            if (in_array($app, AuthService::CAPABILITIES, true)) {
                continue;
            }
            $out[] = $app;
            if (isset(AuthService::CAPABILITIES[$app])) {
                $out[] = AuthService::CAPABILITIES[$app];
            }
        }
        return $out;
    }

    /**
     * Returns all public links.
     */
    private static function publicLinks(): array
    {
        $base = $_ENV['APP_BASE_PATH'] ?? '';

        return [
            'Home' => [
                'url' => $base . '/home',
                'title' => 'Home',
                'summary' => ''
            ],
            'About' => [
                'url' => $base . '/about',
                'title' => 'About ' . ($_ENV['APP_NAME'] ?? 'Us'),
                'summary' => 'What the suite does and how the apps fit together.'
            ],
            'FAQs' => [
                'url' => $base . '/faqs',
                'title' => 'Frequently Asked Questions',
                'summary' => 'Answers to common questions about accounts and the apps.'
            ],
            'Contact' => [
                'url' => $base . '/contact',
                'title' => 'Contact Us',
                'summary' => 'Get in touch with the team.'
            ],
        ];
    }

    /**
     * Returns the protected paths for route guarding.
     */
    public static function getProtectedPaths(): array
    {
        $base = $_ENV['APP_BASE_PATH'] ?? '';

        return [
            $base . '/dashboard',
            $base . '/messages',
            $base . '/profile',
            $base . '/settings',
            $base . '/users',
            $base . '/history',
            $base . '/live-chat',
            $base . '/admin',
        ];
    }

    /**
     * Paths that require AuthService::isAdmin(), beyond the generic
     * login/app-access model in authLinks(). Checked in index.php before
     * any layout output starts (a page-level header() redirect can't work —
     * the layout already echoes the sidebar/header before including the
     * page file).
     * @return string[]
     */
    public static function getAdminOnlyPaths(): array
    {
        $base = $_ENV['APP_BASE_PATH'] ?? '';

        return [
            $base . '/live-chat',
            $base . '/admin',
        ];
    }

    /**
     * Gets display information for the currently authenticated user.
     * @return array{displayName: string, initial: string, avatarUrl: ?string}
     */
    public static function getUserDisplayInfo(): array
    {
        $displayName = 'Account';
        $initial = 'G'; // Guest initial
        $avatarUrl = null;

        $user = AuthService::isLoggedIn() ? AuthService::currentUser() : null;

        if ($user) {
            $parts = explode(' ', $user->full_name);
            $displayName = (count($parts) > 1)
                ? strtoupper(substr($parts[0], 0, 1)) . '. ' . end($parts)
                : ($parts[0] ?? 'User');
            $initial = !empty($user->full_name) ? strtoupper(substr($user->full_name, 0, 1)) : 'U';
            $avatarUrl = $user->avatar_url ?: null;
        }

        return compact('displayName', 'initial', 'avatarUrl');
    }
}
