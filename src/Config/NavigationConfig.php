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
            'Tasks'       => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>',
            'Cash Flow'   => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>',
            'Pictures'    => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
            'Meals'       => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 17h18M5 17v-1a7 7 0 0114 0v1m-7-11V3m0 0a1 1 0 100 2 1 1 0 000-2zM4 21h16" /></svg>',
            'Timetable'   => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM7 15h2m2 0h2m2 0h2" /></svg>',
            'Chores'      => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>',
            'Medicals'    => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z M7.5 12h2.25l1.5-2.25 2.25 4.5 1.5-2.25h1.5" /></svg>',
            // Business — Heroicons building-storefront / document-text / receipt-percent
            'Customers'   => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" /></svg>',
            'Invoices'    => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>',
            'Receipts'    => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185zM9.75 9h.008v.008H9.75V9zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 4.5h.008v.008h-.008V13.5zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>',
            'Social Feed' => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>',
            'Messages'    => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>',
            // Heroicons film (outline)
            'Slideshow'   => '<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0118 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 016 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5" /></svg>',
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
    public const SECTION_ORDER = ['Workspace', 'Business', 'Community', 'Account', 'Admin', 'Help'];
    private const SECTION_OF = [
        'Customers' => 'Business', 'Invoices' => 'Business', 'Receipts' => 'Business',
        'Social Feed' => 'Community', 'Messages' => 'Community',
        'Profile' => 'Account', 'Users' => 'Account',
        'Slideshow' => 'Admin',
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
                'summary' => 'Your workspace hub — every CatScript app you have access to, plus recent activity.'
            ],
            'Tasks' => [
                'url' => $base . '/tasks',
                'title' => 'Tasks',
                'summary' => "Everything on the family's plate, by due date."
            ],
            'Cash Flow' => [
                'url' => $base . '/cash-flow',
                'title' => 'Cash Flow',
                'summary' => 'Money in, money out, and what’s left — live.'
            ],
            'Meals' => [
                'url' => $base . '/meals',
                'title' => 'Meals',
                'summary' => "The week's meals at a glance — breakfast to snacks, with calories."
            ],
            'Timetable' => [
                'url' => $base . '/timetable',
                'title' => 'Timetable',
                'summary' => "The family's weekly routine, hour by hour."
            ],
            'Chores' => [
                'url' => $base . '/chores',
                'title' => 'Chores',
                'summary' => "Who does what in each chore slot — and what's done today."
            ],
            'Medicals' => [
                'url' => $base . '/medicals',
                'title' => 'Medicals',
                'summary' => "The family's appointments, medications, vaccinations and health records — with reminders."
            ],
            'Customers' => [
                'url' => $base . '/customers',
                'title' => 'Customers',
                'summary' => 'Every customer, their contacts and what they’ve been billed.'
            ],
            'Invoices' => [
                'url' => $base . '/invoices',
                'title' => 'Invoices',
                'summary' => 'Itemised invoices — build, send, track what’s paid and owing.'
            ],
            'Receipts' => [
                'url' => $base . '/receipts',
                'title' => 'Receipts',
                'summary' => 'Payments received against your invoices — record, print and send receipts.'
            ],
            'Pictures' => [
                'url' => $base . '/pictures',
                'title' => 'Pictures',
                'summary' => 'Your private photo gallery, with captions and favourites.'
            ],
            'Social Feed' => [
                'url' => $base . '/social-feed',
                'title' => 'Social Feed',
                'summary' => "See what's happening across the network. Share updates, photos, and videos."
            ],
            'Messages' => [
                'url' => $base . '/messages',
                'title' => 'Messages',
                'summary' => 'Your private conversations with other CatScript Apps members.'
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
            'Slideshow' => [
                'url' => $base . '/slideshow',
                'title' => 'Slideshow',
                'summary' => 'The photos behind every banner and TV screensaver — add, reorder and remove them.'
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
            // Every app has a browser-only guest demo (the page itself decides
            // guest demo / access denied / the real app)
            'Tasks' => [
                'url' => $base . '/tasks',
                'title' => 'Tasks (try it)',
                'summary' => 'Try Tasks as a guest — tasks stay in this browser.'
            ],
            'Cash Flow' => [
                'url' => $base . '/cash-flow',
                'title' => 'Cash Flow (try it)',
                'summary' => 'Try Cash Flow as a guest — entries stay in this browser.'
            ],
            'Meals' => [
                'url' => $base . '/meals',
                'title' => 'Meals (try it)',
                'summary' => 'Try the Meal Planner as a guest — your plans stay in this browser.'
            ],
            'Timetable' => [
                'url' => $base . '/timetable',
                'title' => 'Timetable (try it)',
                'summary' => 'Try the Timetable as a guest — your week stays in this browser.'
            ],
            'Chores' => [
                'url' => $base . '/chores',
                'title' => 'Chores (try it)',
                'summary' => 'Try Chores as a guest — the plan stays in this browser.'
            ],
            'Medicals' => [
                'url' => $base . '/medicals',
                'title' => 'Medicals (try it)',
                'summary' => 'Try Medicals as a guest — the sample family stays in this browser.'
            ],
            'Customers' => [
                'url' => $base . '/customers',
                'title' => 'Customers (try it)',
                'summary' => 'Try Customers as a guest — the sample book stays in this browser.'
            ],
            'Invoices' => [
                'url' => $base . '/invoices',
                'title' => 'Invoices (try it)',
                'summary' => 'Try Invoices as a guest — the sample book stays in this browser.'
            ],
            'Receipts' => [
                'url' => $base . '/receipts',
                'title' => 'Receipts (try it)',
                'summary' => 'Try Receipts as a guest — the sample payments stay in this browser.'
            ],
            'Pictures' => [
                'url' => $base . '/pictures',
                'title' => 'Pictures (try it)',
                'summary' => 'Try Pictures as a guest — your photos never leave this browser.'
            ],
            'Social Feed' => [
                'url' => $base . '/social-feed',
                'title' => 'Social Feed (try it)',
                'summary' => 'Try the Social Feed as a guest — posts stay in this browser.'
            ],
            'About' => [
                'url' => $base . '/about',
                'title' => 'About CatScript Apps',
                'summary' => 'The philosophy and engineering behind the CatScript Apps suite.'
            ],
            'FAQs' => [
                'url' => $base . '/faqs',
                'title' => 'Frequently Asked Questions',
                'summary' => 'Answers to common questions about accounts and the apps.'
            ],
            'Contact' => [
                'url' => $base . '/contact',
                'title' => 'Contact Us',
                'summary' => 'Get in touch with the CatScript Apps team.'
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
            // Not the apps (/tasks, /cash-flow, /meals, /timetable, /chores, /medicals,
            // /customers, /invoices, /receipts, /pictures, /social-feed): guests get a
            // try-it demo there (the page itself decides guest demo /
            // access denied / the real app).
            $base . '/messages',
            $base . '/profile',
            $base . '/settings',
            $base . '/users',
            $base . '/slideshow',
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
