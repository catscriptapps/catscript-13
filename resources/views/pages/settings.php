<?php
// /resources/views/pages/settings.php
//
// Settings — the signed-in person's own account, security and appearance,
// plus admin shortcuts for admins. Everything applies the moment it's
// changed (no Save button): photo and password go to the server, theme and
// sidebar are saved in this browser. Tabs are plain buttons switched by
// pages/settings-page.js (deep-linkable: /settings#security).

declare(strict_types=1);

use App\Utils\IdEncoder;
use Src\Controller\MessagesController;
use Src\Service\AuthService;

/** @var string $assetBase */
/** @var string $baseUrl */

$user = AuthService::currentUser();
$isAdmin = AuthService::isAdmin();

$firstName = $user->first_name ?: 'there';
$initial = strtoupper(substr($user->first_name ?: ($user->full_name ?: 'U'), 0, 1));
$avatarUrl = !empty($user->avatar_url) ? $assetBase . 'images/uploads/avatars/' . $user->avatar_url : '';
$location = implode(', ', array_filter([$user->city, $user->region->region ?? null, $user->country->country ?? null]));
$memberSince = $user->created_at ? $user->created_at->format('F Y') : '';
$e = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');

$svg = fn(string $d, string $class = 'h-5 w-5') => '<svg class="' . $class . '" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="' . $d . '" /></svg>';
$icon = [
    'account'    => 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
    'security'   => 'M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z',
    'appearance' => 'M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z',
    'admin'      => 'M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75',
    'camera'     => 'M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z',
    'key'        => 'M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z',
    'devices'    => 'M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3',
    'chevron'    => 'M8.25 4.5l7.5 7.5-7.5 7.5',
    'pencil'     => 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
];

$tabs = [
    'account'    => ['Account', 'Photo and details'],
    'security'   => ['Security', 'Password and devices'],
    'appearance' => ['Appearance', 'Theme and layout'],
];
if ($isAdmin) {
    $tabs['admin'] = ['Admin', 'Tools for running the site'];
}

// Shared card / row styles
$card = 'rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm';
$cardHead = 'flex items-start gap-3 px-5 sm:px-6 pt-5 sm:pt-6';
$cardIcon = 'h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center';
$btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-primary-600/30 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/30 disabled:opacity-60';
$btnGhost = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-gray-400/30 disabled:opacity-60';
?>
<div id="settings-page" class="space-y-6">

    <!-- Header: who you are, at a glance -->
    <section class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-700 via-secondary-800 to-secondary-950 text-white shadow-sm">
        <div aria-hidden="true" class="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary-500/25 blur-3xl"></div>
        <div aria-hidden="true" class="pointer-events-none absolute -bottom-28 left-1/4 h-64 w-64 rounded-full bg-primary-400/10 blur-3xl"></div>
        <div aria-hidden="true" class="pointer-events-none absolute inset-0 opacity-[0.06]" style="background-image: radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px); background-size: 18px 18px;"></div>

        <div class="relative flex flex-col sm:flex-row sm:items-center gap-5 p-6 sm:p-8">
            <button type="button" data-settings-action="upload-avatar" title="Change your photo"
                class="group relative h-20 w-20 flex-shrink-0 rounded-2xl ring-4 ring-white/15 focus:outline-none focus-visible:ring-primary-400">
                <span data-settings-avatar class="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 text-3xl font-bold">
                    <?php if ($avatarUrl): ?>
                        <img src="<?= $e($avatarUrl) ?>" alt="" class="h-full w-full object-cover">
                    <?php else: ?>
                        <?= $e($initial) ?>
                    <?php endif; ?>
                </span>
                <span class="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity"><?= $svg($icon['camera'], 'h-6 w-6') ?></span>
            </button>

            <div class="min-w-0 flex-1">
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-primary-300">Settings</p>
                <h1 class="mt-1 text-2xl sm:text-3xl font-bold tracking-tight truncate"><?= $e($user->full_name) ?></h1>
                <p class="mt-0.5 text-sm text-secondary-200 truncate"><?= $e($user->email) ?></p>
            </div>

            <div class="flex flex-wrap gap-2 sm:flex-col sm:items-end">
                <span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold <?= $isAdmin ? 'bg-primary-500/20 text-primary-200 ring-1 ring-primary-400/30' : 'bg-white/10 text-white/80 ring-1 ring-white/15' ?>">
                    <?= $isAdmin ? '👑 Admin' : 'Member' ?>
                </span>
                <?php if ($memberSince): ?>
                    <span class="inline-flex items-center rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold text-white/80">Member since <?= $e($memberSince) ?></span>
                <?php endif; ?>
            </div>
        </div>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)] gap-6 items-start">

        <!-- Section menu: a row of pills on phones, a rail on desktop -->
        <nav role="tablist" aria-label="Settings sections" aria-orientation="vertical"
            class="flex lg:flex-col gap-1.5 overflow-x-auto custom-scrollbar -mx-1 px-1 pb-1 lg:pb-0 lg:sticky lg:top-24">
            <?php foreach ($tabs as $key => [$label, $hint]): ?>
                <button type="button" role="tab" id="settings-tab-<?= $key ?>" data-settings-tab="<?= $key ?>"
                    aria-controls="settings-panel-<?= $key ?>" aria-selected="<?= $key === 'account' ? 'true' : 'false' ?>"
                    class="group flex-shrink-0 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/25
                        text-gray-500 dark:text-gray-400 hover:bg-white hover:text-gray-900 dark:hover:bg-gray-900 dark:hover:text-white
                        aria-selected:bg-white aria-selected:text-gray-900 aria-selected:shadow-sm aria-selected:ring-1 aria-selected:ring-gray-200
                        dark:aria-selected:bg-gray-900 dark:aria-selected:text-white dark:aria-selected:ring-gray-800">
                    <span class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 transition-colors
                        group-aria-selected:bg-primary-500 group-aria-selected:text-white group-aria-selected:shadow-md group-aria-selected:shadow-primary-500/30"><?= $svg($icon[$key], 'h-[18px] w-[18px]') ?></span>
                    <span class="min-w-0">
                        <span class="block text-sm font-semibold whitespace-nowrap"><?= $e($label) ?></span>
                        <span class="hidden lg:block text-xs text-gray-400 dark:text-gray-500 truncate"><?= $e($hint) ?></span>
                    </span>
                </button>
            <?php endforeach; ?>
        </nav>

        <div class="min-w-0">

            <!-- ============ Account ============ -->
            <section id="settings-panel-account" role="tabpanel" aria-labelledby="settings-tab-account" data-settings-panel="account" class="space-y-6 settings-panel">

                <div class="<?= $card ?>">
                    <div class="<?= $cardHead ?>">
                        <span class="<?= $cardIcon ?> bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400"><?= $svg($icon['camera']) ?></span>
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Profile photo</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Shown in the header, the sidebar and next to your name. Pictures are resized for you.</p>
                        </div>
                    </div>
                    <div class="flex flex-col sm:flex-row sm:items-center gap-5 p-5 sm:p-6">
                        <div data-settings-avatar-large data-img-src="<?= $e($avatarUrl) ?>"
                            class="h-24 w-24 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-4xl font-bold text-white shadow-inner <?= $avatarUrl ? 'cursor-zoom-in' : '' ?>">
                            <?php if ($avatarUrl): ?>
                                <img src="<?= $e($avatarUrl) ?>" alt="Your photo" class="h-full w-full object-cover">
                            <?php else: ?>
                                <?= $e($initial) ?>
                            <?php endif; ?>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <button type="button" data-settings-action="upload-avatar" class="<?= $btnPrimary ?>"><?= $svg($icon['camera'], 'h-4 w-4') ?> <?= $avatarUrl ? 'Upload a new photo' : 'Upload a photo' ?></button>
                            <button type="button" data-settings-action="remove-avatar" data-id="<?= $e(IdEncoder::encode((int) $user->id)) ?>"
                                class="<?= $btnGhost ?> <?= $avatarUrl ? '' : 'hidden' ?>">Remove</button>
                        </div>
                    </div>
                </div>

                <div class="<?= $card ?>">
                    <div class="<?= $cardHead ?>">
                        <span class="<?= $cardIcon ?> bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300"><?= $svg($icon['account']) ?></span>
                        <div class="flex-1">
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Your details</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Your email is also how you sign in, and where password resets are sent.</p>
                        </div>
                    </div>
                    <dl class="mt-4 divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                        <?php foreach ([['Name', $user->full_name], ['Email', $user->email], ['Location', $location ?: '—'], ['Role', $isAdmin ? 'Admin — can open everything' : 'Member']] as [$label, $value]): ?>
                            <div class="grid grid-cols-3 gap-4 px-5 sm:px-6 py-3.5">
                                <dt class="text-sm text-gray-500 dark:text-gray-400"><?= $e($label) ?></dt>
                                <dd class="col-span-2 text-sm font-medium text-gray-900 dark:text-white break-words"><?= $e($value) ?></dd>
                            </div>
                        <?php endforeach; ?>
                    </dl>
                    <div class="flex justify-end border-t border-gray-100 dark:border-gray-800 px-5 sm:px-6 py-4">
                        <a href="<?= $baseUrl ?>profile" data-partial class="<?= $btnGhost ?>"><?= $svg($icon['pencil'], 'h-4 w-4') ?> Edit on your profile</a>
                    </div>
                </div>
            </section>

            <!-- ============ Security ============ -->
            <section id="settings-panel-security" role="tabpanel" aria-labelledby="settings-tab-security" data-settings-panel="security" class="space-y-6 settings-panel" hidden>

                <div class="<?= $card ?>">
                    <div class="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6">
                        <span class="<?= $cardIcon ?> bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"><?= $svg($icon['key']) ?></span>
                        <div class="flex-1">
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Password</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400">Use at least 8 characters, and one you don’t use anywhere else.</p>
                        </div>
                        <button type="button" data-action="open-change-password" class="<?= $btnPrimary ?>">Change password</button>
                    </div>
                </div>

                <div class="<?= $card ?>">
                    <div class="flex flex-col sm:flex-row sm:items-start gap-4 p-5 sm:p-6">
                        <span class="<?= $cardIcon ?> bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400"><?= $svg($icon['devices']) ?></span>
                        <div class="flex-1 min-w-0">
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Signed-in devices</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400">You stay signed in for two weeks after your last visit. Lost a phone, or used a shared computer? Sign out everywhere else.</p>
                            <div class="mt-4 flex flex-wrap items-center gap-2 text-sm">
                                <span class="inline-flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 font-semibold text-emerald-700 dark:text-emerald-300">
                                    <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                                    This device · <span data-security-this-device>…</span>
                                </span>
                                <span data-security-others class="inline-flex items-center rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1.5 font-semibold text-gray-600 dark:text-gray-300">Checking other devices…</span>
                            </div>
                        </div>
                        <button type="button" data-settings-action="sign-out-others" class="<?= $btnGhost ?> sm:self-center">Sign out other devices</button>
                    </div>
                </div>

                <div class="<?= $card ?>">
                    <div class="<?= $cardHead ?>">
                        <div>
                            <h2 class="text-base font-bold text-gray-900 dark:text-white">Recent sign-ins</h2>
                            <p class="text-sm text-gray-500 dark:text-gray-400">If one of these wasn’t you, change your password and sign out other devices.</p>
                        </div>
                    </div>
                    <ul data-security-signins class="mt-4 divide-y divide-gray-100 dark:divide-gray-800 border-t border-gray-100 dark:border-gray-800">
                        <li class="px-5 sm:px-6 py-4 text-sm text-gray-400">Loading…</li>
                    </ul>
                </div>
            </section>

            <!-- ============ Appearance ============ -->
            <section id="settings-panel-appearance" role="tabpanel" aria-labelledby="settings-tab-appearance" data-settings-panel="appearance" class="space-y-6 settings-panel" hidden>

                <div class="<?= $card ?> p-5 sm:p-6">
                    <h2 class="text-base font-bold text-gray-900 dark:text-white">Theme</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">“System” follows your device, switching with it at sunset if it does.</p>
                    <div role="radiogroup" aria-label="Theme" class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <?php
                        $mini = fn(string $bg, string $bar, string $line, string $side) =>
                            '<span class="block h-24 rounded-xl overflow-hidden ' . $bg . ' ring-1 ring-black/5">'
                            . '<span class="flex h-full"><span class="w-1/4 ' . $side . '"></span><span class="flex-1 p-2.5 space-y-1.5">'
                            . '<span class="block h-2.5 w-2/3 rounded ' . $bar . '"></span><span class="block h-1.5 w-full rounded ' . $line . '"></span>'
                            . '<span class="block h-1.5 w-5/6 rounded ' . $line . '"></span><span class="block h-4 w-1/3 rounded bg-primary-500"></span></span></span></span>';
                        $themes = [
                            'light'  => ['Light', $mini('bg-white', 'bg-gray-800', 'bg-gray-200', 'bg-secondary-800')],
                            'dark'   => ['Dark', $mini('bg-gray-900', 'bg-gray-100', 'bg-gray-700', 'bg-secondary-950')],
                            'system' => ['System', '<span class="grid grid-cols-2 h-24 rounded-xl overflow-hidden ring-1 ring-black/5">'
                                . '<span class="bg-white p-2.5 space-y-1.5"><span class="block h-2.5 w-2/3 rounded bg-gray-800"></span><span class="block h-1.5 rounded bg-gray-200"></span><span class="block h-4 w-1/2 rounded bg-primary-500"></span></span>'
                                . '<span class="bg-gray-900 p-2.5 space-y-1.5"><span class="block h-2.5 w-2/3 rounded bg-gray-100"></span><span class="block h-1.5 rounded bg-gray-700"></span><span class="block h-4 w-1/2 rounded bg-primary-500"></span></span></span>'],
                        ];
                        foreach ($themes as $value => [$label, $preview]): ?>
                            <button type="button" role="radio" aria-checked="false" data-theme-choice="<?= $value ?>"
                                class="group rounded-2xl border-2 border-gray-200 dark:border-gray-800 p-2.5 text-left transition-all hover:border-gray-300 dark:hover:border-gray-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/25
                                    aria-checked:border-primary-500 aria-checked:shadow-lg aria-checked:shadow-primary-500/10">
                                <?= $preview ?>
                                <span class="mt-2.5 flex items-center justify-between px-1">
                                    <span class="text-sm font-semibold text-gray-900 dark:text-white"><?= $label ?></span>
                                    <span class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 text-transparent group-aria-checked:border-primary-500 group-aria-checked:bg-primary-500 group-aria-checked:text-white">
                                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                </span>
                            </button>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="<?= $card ?> p-5 sm:p-6">
                    <h2 class="text-base font-bold text-gray-900 dark:text-white">Sidebar</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400">On larger screens, keep the full menu or just its icons for more room. (Phones always tuck it behind the ☰ button.)</p>
                    <div role="radiogroup" aria-label="Sidebar" class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <?php foreach (['expanded' => ['Expanded', 'w-1/3', true], 'compact' => ['Compact — icons only', 'w-[12%]', false]] as $value => [$label, $width, $labels]): ?>
                            <button type="button" role="radio" aria-checked="false" data-sidebar-choice="<?= $value ?>"
                                class="group rounded-2xl border-2 border-gray-200 dark:border-gray-800 p-2.5 text-left transition-all hover:border-gray-300 dark:hover:border-gray-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/25
                                    aria-checked:border-primary-500 aria-checked:shadow-lg aria-checked:shadow-primary-500/10">
                                <span class="flex h-20 rounded-xl overflow-hidden bg-gray-50 dark:bg-gray-800 ring-1 ring-black/5">
                                    <span class="<?= $width ?> bg-secondary-800 p-2 space-y-1.5">
                                        <?php for ($i = 0; $i < 4; $i++): ?>
                                            <span class="flex items-center gap-1"><span class="h-2 w-2 flex-shrink-0 rounded-sm <?= $i === 0 ? 'bg-primary-400' : 'bg-white/30' ?>"></span><?php if ($labels): ?><span class="h-1.5 flex-1 rounded bg-white/20"></span><?php endif; ?></span>
                                        <?php endfor; ?>
                                    </span>
                                    <span class="flex-1 p-2.5 space-y-1.5"><span class="block h-2 w-1/2 rounded bg-gray-300 dark:bg-gray-600"></span><span class="block h-1.5 rounded bg-gray-200 dark:bg-gray-700"></span><span class="block h-1.5 w-4/5 rounded bg-gray-200 dark:bg-gray-700"></span></span>
                                </span>
                                <span class="mt-2.5 flex items-center justify-between px-1">
                                    <span class="text-sm font-semibold text-gray-900 dark:text-white"><?= $label ?></span>
                                    <span class="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 dark:border-gray-600 text-transparent group-aria-checked:border-primary-500 group-aria-checked:bg-primary-500 group-aria-checked:text-white">
                                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    </span>
                                </span>
                            </button>
                        <?php endforeach; ?>
                    </div>
                </div>

                <p class="flex items-center gap-2 px-1 text-xs text-gray-400 dark:text-gray-500">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Changes apply straight away and are remembered in this browser — your other devices keep their own.
                </p>
            </section>

            <?php if ($isAdmin): ?>
                <?php
                $unread = MessagesController::unreadCount();
                $tools = [
                    ['users', 'Users', 'Accounts, roles and app access', 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', 0],
                    ['messages', 'Messages', 'The contact-form inbox', 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75', $unread],
                    ['live-chat', 'Live chats', 'Reply to visitors, AI autorespond', 'M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z', 0],
                    ['faqs', 'FAQs', 'Edit the help centre', 'M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z', 0],
                    ['history', 'History', 'Everything people have changed', 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z', 0],
                    ['admin', 'Admin hub', 'Everything that needs attention', 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z', 0],
                ];
                ?>
                <!-- ============ Admin ============ -->
                <section id="settings-panel-admin" role="tabpanel" aria-labelledby="settings-tab-admin" data-settings-panel="admin" class="space-y-6 settings-panel" hidden>
                    <div class="<?= $card ?> p-5 sm:p-6">
                        <h2 class="text-base font-bold text-gray-900 dark:text-white">Admin tools</h2>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Only admins see this section.</p>
                        <div class="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <?php foreach ($tools as [$href, $label, $hint, $path, $badge]): ?>
                                <a href="<?= $baseUrl . $href ?>" data-partial
                                    class="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 hover:border-primary-300 dark:hover:border-primary-800 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                                    <span class="h-10 w-10 flex-shrink-0 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 group-hover:bg-primary-500 group-hover:text-white transition-colors"><?= $svg($path) ?></span>
                                    <span class="min-w-0 flex-1">
                                        <span class="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                                            <?= $e($label) ?>
                                            <?php if ($badge): ?><span class="rounded-full bg-red-600 px-1.5 text-[10px] font-bold leading-4 text-white"><?= $badge > 99 ? '99+' : (int) $badge ?></span><?php endif; ?>
                                        </span>
                                        <span class="block text-xs text-gray-500 dark:text-gray-400 truncate"><?= $e($hint) ?></span>
                                    </span>
                                    <span class="text-gray-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all"><?= $svg($icon['chevron'], 'h-4 w-4') ?></span>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </section>
            <?php endif; ?>
        </div>
    </div>
</div>
