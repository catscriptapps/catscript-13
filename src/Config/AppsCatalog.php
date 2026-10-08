<?php
// /src/Config/AppsCatalog.php

declare(strict_types=1);

namespace Src\Config;

/**
 * The app suite as the public sees it — one list used by the guest home
 * page, the About page, and the dashboard's "Coming soon" row.
 *
 * Out of the box it lists the CatScript-13 core (dashboard, accounts,
 * profile, inbox, live chat). When you build a new app: add it here (with
 * 'live' => false to announce it as "Coming soon"), then when it ships set
 * 'live' => true, give it a 'slug', and register it in
 * NavigationConfig::authLinks() — every page picks it up.
 */
class AppsCatalog
{
    /**
     * @return array<int, array{name: string, text: string, category: string, live: bool, slug?: string, highlights: string[], icon: string}>
     */
    public static function apps(): array
    {
        return [
            [
                'name' => 'Dashboard',
                'text' => 'Your home base after signing in — every app you can open, plus a live feed of recent activity.',
                'category' => 'Your Workspace',
                'slug' => 'dashboard',
                'live' => true,
                'highlights' => ['Every app you have access to, grouped', 'Recent activity at a glance', 'Full, searchable activity history'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />',
            ],
            [
                'name' => 'Profile',
                'text' => 'Your account details, photo and password — all in one place.',
                'category' => 'Your Workspace',
                'slug' => 'profile',
                'live' => true,
                'highlights' => ['Edit your details', 'Upload or remove your avatar', 'Change your password'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />',
            ],
            [
                'name' => 'Users',
                'text' => 'Create and manage accounts, roles and exactly which apps each person can open.',
                'category' => 'People & Access',
                'slug' => 'users',
                'live' => true,
                'highlights' => ['Add, edit and archive accounts', 'Roles, with admins who see everything', 'Per-person app access'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />',
            ],
            [
                'name' => 'Messages',
                'text' => 'Every note sent through the contact form lands in one inbox, threaded, with replies by email.',
                'category' => 'Stay In Touch',
                'slug' => 'contact',
                'live' => true,
                'highlights' => ['A contact form for visitors', 'Threaded inbox with unread badges', 'Reply straight from the inbox'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />',
            ],
            [
                'name' => 'Live Chat',
                'text' => 'A chat bubble on every page — visitors and members talk to an admin in real time, with optional AI answers from the FAQs.',
                'category' => 'Stay In Touch',
                'slug' => 'faqs',
                'live' => true,
                'highlights' => ['Chat from any page, signed in or not', 'Admin chat console with unread counts', 'Optional AI auto-replies from your FAQs'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />',
            ],
        ];
    }

    /**
     * Categories, in display order. Each one's app names come from apps().
     * @return array<int, array{name: string, text: string, accent: string, apps: string[], icon: string}>
     */
    public static function categories(): array
    {
        $categories = [
            [
                'name' => 'Your Workspace',
                'text' => 'One sign-in, one dashboard, one profile — the home every app plugs into.',
                'accent' => 'primary',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />',
            ],
            [
                'name' => 'People & Access',
                'text' => 'Decide who gets an account and what each person can open.',
                'accent' => 'secondary',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />',
            ],
            [
                'name' => 'Stay In Touch',
                'text' => 'A contact form, a shared inbox and live chat, so nobody waits long for an answer.',
                'accent' => 'emerald',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />',
            ],
        ];

        $apps = self::apps();
        foreach ($categories as &$c) {
            $c['apps'] = array_values(array_map(fn($a) => $a['name'], array_filter($apps, fn($a) => $a['category'] === $c['name'])));
        }
        return $categories;
    }

    /** Tailwind classes per category accent (spelled out so Tailwind keeps them). */
    public static function accentClasses(): array
    {
        return [
            'primary'   => 'bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400',
            'secondary' => 'bg-secondary-50 dark:bg-secondary-950/40 text-secondary-600 dark:text-secondary-300',
            'emerald'   => 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
            'amber'     => 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
            'indigo'    => 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
        ];
    }

    /** @return string[] names of apps announced but not live yet */
    public static function comingSoon(): array
    {
        return array_values(array_map(fn($a) => $a['name'], array_filter(self::apps(), fn($a) => !$a['live'])));
    }
}
