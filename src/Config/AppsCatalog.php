<?php
// /src/Config/AppsCatalog.php

declare(strict_types=1);

namespace Src\Config;

/**
 * The CatScript Apps suite — one list used by the guest home page, the About
 * page, and the dashboard's "Coming soon" row. When a legacy app is rebuilt,
 * set its 'live' => true and give it a 'slug' here (and register it in
 * NavigationConfig::authLinks()); every page picks it up. 'demo' => true
 * marks an app guests can try in the browser without an account (its page
 * has a guest mode backed by localStorage).
 */
class AppsCatalog
{
    /**
     * @return array<int, array{name: string, text: string, category: string, live: bool, slug?: string, demo?: bool, highlights: string[], icon: string}>
     */
    public static function apps(): array
    {
        return [
            [
                'name' => 'Social Feed',
                'text' => "See what's happening across the network. Share updates, photos, and videos.",
                'category' => 'Memories & Community',
                'slug' => 'social-feed',
                'live' => true,
                'demo' => true,
                'highlights' => ['Posts with photos and videos', 'Likes and comments', 'A feed of the people you follow'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />',
            ],
            [
                'name' => 'Chores',
                'text' => "Share chores out among the kids in the Timetable's chore slots — and tick them off as they go.",
                'category' => 'Home & Family',
                'slug' => 'chores',
                'live' => true,
                'demo' => true,
                'highlights' => ['A library of 70 chores, with times', 'Shared out fairly to fit each chore slot', "Today's board with progress for every child"],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />',
            ],
            [
                'name' => 'Medicals',
                'text' => "Everything medical for the family — appointments to book and keep, medications and today's doses, vaccinations and check-ups, with reminders.",
                'category' => 'Home & Family',
                'slug' => 'medicals',
                'live' => true,
                'demo' => true,
                'highlights' => ['Appointments: book, remind, follow up', "Medications with today's doses to tick off", 'Vaccinations and check-ups that remind you when they’re due'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z M7.5 12h2.25l1.5-2.25 2.25 4.5 1.5-2.25h1.5" />',
            ],
            [
                'name' => 'Tasks',
                'text' => "A shared, dated to-do list for everything on the family's plate — with smart title suggestions.",
                'category' => 'Productivity',
                'slug' => 'tasks',
                'live' => true,
                'demo' => true,
                'highlights' => ['Today, next 7 days, and past views', 'Colour-coded by how soon it’s due', 'Suggests titles from earlier tasks'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 5h11M9 12h11M9 19h11M5 6l1.5 1.5L9 5M5 13l1.5 1.5L9 12M5 20l1.5 1.5L9 19" />',
            ],
            [
                'name' => 'Cash Flow',
                'text' => 'Log money in and out, with live totals, charts, and receipt photos — every number updates the moment you type.',
                'category' => 'Money',
                'slug' => 'cash-flow',
                'live' => true,
                'demo' => true,
                'highlights' => ['Totals that update as you type', 'Charts of money in, out, and running net', 'Receipt photos on any entry'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
            ],
            [
                'name' => 'Pictures',
                'text' => 'Upload, organise, and revisit your photo gallery — private to you, with captions and favourites.',
                'category' => 'Memories & Community',
                'slug' => 'pictures',
                'live' => true,
                'demo' => true,
                'highlights' => ['A private photo gallery', 'Captions and favourites', 'A full-screen viewer'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />',
            ],
            [
                'name' => 'Meals',
                'text' => "Plan the week's meals and keep your go-to dishes on hand.",
                'category' => 'Home & Family',
                'slug' => 'meals',
                'live' => true,
                'demo' => true,
                'highlights' => ['Weekly meal plans everyone at home can see', 'Breakfast, lunch, dinner, and snacks', 'Calorie totals and a printable PDF'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 17h18M5 17v-1a7 7 0 0114 0v1m-7-11V3m0 0a1 1 0 100 2 1 1 0 000-2z" />',
            ],
            [
                'name' => 'Timetable',
                'text' => 'The weekly routine and after-school flow, laid out hour by hour.',
                'category' => 'Home & Family',
                'slug' => 'timetable',
                'live' => true,
                'demo' => true,
                'highlights' => ['A week view, hour by hour', 'School, chores, reading, sports and more', 'Add to many days at once, copy a day'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zM7 15h2m2 0h2m2 0h2" />',
            ],
            [
                'name' => 'Customers',
                'text' => "Every customer's contact details, logo and billing history in one lively directory.",
                'category' => 'Business',
                'slug' => 'customers',
                'live' => true,
                'demo' => true,
                'highlights' => ['Contact and billing details', 'What each customer has been billed', 'One-tap call, email and map'],
                'icon' => '<circle cx="9" cy="8" r="3" stroke-width="1.75"/><path stroke-width="1.75" stroke-linecap="round" d="M3 20a6 6 0 0112 0"/><path stroke-width="1.75" stroke-linecap="round" d="M15 7h6M15 11h6"/>',
            ],
            [
                'name' => 'Invoices',
                'text' => 'Build itemised invoices with live totals, send them as PDFs, and see what’s paid and still owing.',
                'category' => 'Business',
                'slug' => 'invoices',
                'live' => true,
                'demo' => true,
                'highlights' => ['Rich line items and discounts, totals as you type', 'PDF download or email to the customer', 'Overdue and outstanding at a glance'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2h6v2m-6-4v-2h6v2M7 21h10a2 2 0 002-2V7l-4-4H7a2 2 0 00-2 2v14a2 2 0 002 2z" />',
            ],
            [
                'name' => 'Receipts',
                'text' => 'Record payments against your invoices, send PDF receipts, and watch what’s collected and still owing.',
                'category' => 'Business',
                'slug' => 'receipts',
                'live' => true,
                'demo' => true,
                'highlights' => ['Payments capped at what’s owing — invoice status updates itself', 'PDF download or email to the customer', 'Collected this month and year at a glance'],
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01m-.01 4h.01" />',
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
                'name' => 'Home & Family',
                'text' => 'Keep the household running — chores, meal plans, and the weekly routine in one place.',
                'accent' => 'primary',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />',
            ],
            [
                'name' => 'Productivity',
                'text' => 'Capture what needs doing and tick it off as you go.',
                'accent' => 'emerald',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5h11M9 12h11M9 19h11M5 6l1.5 1.5L9 5M5 13l1.5 1.5L9 12M5 20l1.5 1.5L9 19" />',
            ],
            [
                'name' => 'Business',
                'text' => 'Manage customers, send professional PDF invoices, and issue payment receipts.',
                'accent' => 'secondary',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />',
            ],
            [
                'name' => 'Money',
                'text' => 'Track money in and money out so you always know where things stand.',
                'accent' => 'amber',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
            ],
            [
                'name' => 'Memories & Community',
                'text' => 'Share updates with the people who matter and keep your favourite pictures safe.',
                'accent' => 'indigo',
                'icon' => '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />',
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

    /** @return string[] names of apps not rebuilt yet */
    public static function comingSoon(): array
    {
        return array_values(array_map(fn($a) => $a['name'], array_filter(self::apps(), fn($a) => !$a['live'])));
    }
}
