<?php
// /resources/views/pages/contact.php
//
// Contact: the public contact form, in the platform's own look — the photo
// hero with glass tiles (as on the app pages), and the colour-coded form
// sections + live identity card from resources/js/forms/form-kit.js (written
// out here so the form works before any JS). resources/js/pages/contact-page.js
// adds the live preview, topic chips, counter, inline errors and the
// thank-you state. Messages land in the admin's Messages inbox
// (MessagesController::submitContact).

declare(strict_types=1);

use Src\Service\AuthService;
use Src\Utils\CuratedPhotos;

/** @var string $baseUrl */
/** @var string $assetBase */

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$me = AuthService::isLoggedIn() ? AuthService::currentUser() : null;
$myName = (string) ($me->full_name ?? '');
$myEmail = (string) ($me->email ?? '');
$isAdmin = $me && AuthService::isAdmin();
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

$topics = [
    ['💡', 'Question about an app'],
    ['🔑', 'Account & sign-in'],
    ['🐞', 'Something isn’t working'],
    ['✨', 'Feature idea'],
    ['🤝', 'Business enquiry'],
];

// Same classes as form-kit.js (kitInput / kitLabel / formSection / TONE)
$kitInput = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 sm:text-sm transition-all duration-200 py-2.5 px-4 outline-none';
$kitLabel = 'block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 ml-1';
$tone = [
    'orange' => ['border-orange-100 dark:border-orange-900/40', 'bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-950/20 dark:to-gray-900', 'bg-orange-300/30', 'from-orange-400 to-rose-500'],
    'sky'    => ['border-sky-100 dark:border-sky-900/40', 'bg-gradient-to-br from-sky-50/80 to-white dark:from-sky-950/20 dark:to-gray-900', 'bg-sky-300/30', 'from-sky-400 to-indigo-500'],
];
$sectionOpen = fn(string $t, string $icon, string $title, string $hint) => '
    <section class="relative overflow-hidden rounded-2xl border ' . $tone[$t][0] . ' ' . $tone[$t][1] . ' p-4 sm:p-5">
        <div aria-hidden="true" class="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full ' . $tone[$t][2] . ' blur-2xl"></div>
        <div class="relative flex items-start gap-3 mb-4">
            <span class="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br ' . $tone[$t][3] . ' text-white flex items-center justify-center text-base shadow-md">' . $icon . '</span>
            <div class="min-w-0 flex-1">
                <h3 class="text-sm font-bold text-gray-900 dark:text-white">' . $title . '</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">' . $hint . '</p>
            </div>
        </div>
        <div class="relative">';
$sectionClose = '</div></section>';
$initials = fn(string $n) => strtoupper(implode('', array_map(fn($w) => mb_substr($w, 0, 1), array_slice(preg_split('/\s+/', trim($n)) ?: [], 0, 2))));
?>
<div id="contact-page" class="space-y-6">

    <?php
    $breadcrumbs = [['label' => 'Contact']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <!-- Hero: photo slideshow + how to reach us -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div class="relative p-6 sm:px-10 sm:py-9 grid gap-6 lg:grid-cols-5 lg:items-end">
            <div class="lg:col-span-3 min-w-0">
                <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">Help · Contact</span>
                <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">Let’s talk<?= $myName ? ', ' . $e(explode(' ', $myName)[0]) : '' ?>.</h1>
                <p class="mt-2 text-base text-secondary-50 max-w-xl">A question about an app, a problem to report, or an idea to share — send it here and a real person from CatScript Apps will reply by email.</p>
                <div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <?php foreach ([['✉️', 'By email', 'To the address you give'], ['⏱️', 'Usually within a day', 'Often sooner'], ['🙋', 'A real person', 'No bots, no ticket numbers']] as [$i, $label, $note]): ?>
                        <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-4 py-3 min-w-0">
                            <span class="block text-xl leading-none"><?= $i ?></span>
                            <span class="block text-sm font-bold mt-2"><?= $label ?></span>
                            <span class="block text-[11px] text-white/60 mt-0.5 truncate"><?= $note ?></span>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>
            <div class="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-5">
                <p class="text-xs font-bold uppercase tracking-wider text-secondary-200">Prefer to chat?</p>
                <p class="mt-1 text-sm text-white/80">The chat bubble in the corner of every page reaches us straight away.</p>
                <button type="button" data-open-chat class="mt-3 inline-flex items-center gap-2 rounded-xl bg-white text-secondary-900 hover:bg-primary-50 px-4 py-2 text-sm font-bold shadow-sm transition-colors">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    <?= $isAdmin ? 'Open the chat inbox' : 'Start a live chat' ?>
                </button>
                <div class="mt-4 pt-4 border-t border-white/10">
                    <p class="text-xs font-bold uppercase tracking-wider text-secondary-200">Or email us directly</p>
                    <a href="mailto:info@catscriptapps.com" class="mt-1 inline-block text-base font-bold text-white hover:text-primary-200 transition-colors">info@catscriptapps.com</a>
                </div>
            </div>
        </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-3 items-start">

        <!-- The form -->
        <div class="lg:col-span-2">
            <form id="contact-form" class="space-y-5" novalidate>
                <!-- Honeypot: hidden from people, filled by bots (MessagesController::submitContact) -->
                <div aria-hidden="true" style="position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;">
                    <label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
                </div>

                <!-- Live preview (form-kit identityCard) -->
                <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-800 via-secondary-900 to-secondary-950 p-5 sm:p-6 text-white shadow-xl shadow-secondary-900/20">
                    <div aria-hidden="true" class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary-500/40 blur-3xl"></div>
                    <div aria-hidden="true" class="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-fuchsia-500/25 blur-3xl"></div>
                    <div aria-hidden="true" class="pointer-events-none absolute top-6 right-1/3 h-24 w-24 rounded-full bg-sky-400/20 blur-2xl"></div>
                    <div class="relative flex items-center gap-4">
                        <div data-preview-avatar class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 via-orange-500 to-rose-500 flex items-center justify-center text-2xl font-black shadow-lg shadow-primary-500/30 ring-4 ring-white/15 transition-transform duration-300"><?= $myName ? $e($initials($myName)) : '👋' ?></div>
                        <div class="min-w-0 flex-1">
                            <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                                <span class="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse"></span>New message
                            </span>
                            <p data-preview-title class="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight truncate">What’s it about?</p>
                            <p data-preview-sub class="text-sm text-secondary-100/80 truncate"><?= $myName ? $e("From {$myName}") : 'From you' ?></p>
                        </div>
                        <div class="hidden sm:block text-right flex-shrink-0">
                            <p data-preview-count class="text-2xl font-bold tracking-tight">0</p>
                            <p class="text-[11px] font-semibold uppercase tracking-wider text-white/60">of 5,000 characters</p>
                        </div>
                    </div>
                </div>

                <?= $sectionOpen('orange', '👋', 'About you', 'So we know who we’re talking to, and where to reply.') ?>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div><label for="ct-name" class="<?= $kitLabel ?>">Your name</label>
                            <input id="ct-name" type="text" name="full_name" maxlength="120" autocomplete="name" required value="<?= $e($myName) ?>" placeholder="Alex Rivera" class="<?= $kitInput ?>"></div>
                        <div><label for="ct-email" class="<?= $kitLabel ?>">Email address</label>
                            <input id="ct-email" type="email" name="email" maxlength="255" autocomplete="email" required value="<?= $e($myEmail) ?>" placeholder="alex@example.com" class="<?= $kitInput ?>"></div>
                    </div>
                <?= $sectionClose ?>

                <?= $sectionOpen('sky', '💬', 'Your message', 'Pick a topic (or write your own subject), then tell us everything.') ?>
                    <div class="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Topic">
                        <?php foreach ($topics as [$i, $t]): ?>
                            <button type="button" data-topic="<?= $e($t) ?>" aria-pressed="false"
                                class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-sky-200 dark:border-sky-800 bg-white/80 dark:bg-gray-900 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 aria-pressed:bg-sky-600 aria-pressed:border-sky-600 aria-pressed:text-white transition-colors"><span aria-hidden="true"><?= $i ?></span><?= $e($t) ?></button>
                        <?php endforeach; ?>
                    </div>
                    <div class="space-y-4">
                        <div><label for="ct-subject" class="<?= $kitLabel ?>">Subject</label>
                            <input id="ct-subject" type="text" name="subject" maxlength="200" placeholder="What’s this about?" class="<?= $kitInput ?>"></div>
                        <div><label for="ct-message" class="<?= $kitLabel ?>">Message</label>
                            <textarea id="ct-message" name="message" rows="6" maxlength="5000" required placeholder="How can we help? If something isn’t working, tell us which app and what you were doing." class="<?= $kitInput ?> resize-y min-h-[9rem]"></textarea></div>
                    </div>
                <?= $sectionClose ?>

                <div class="api-message space-y-2" aria-live="polite"></div>

                <div class="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
                    <p class="text-xs text-gray-500 dark:text-gray-400 sm:mr-auto">We only use your email to reply to you.</p>
                    <button type="submit" id="contact-submit"
                        class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 via-orange-500 to-rose-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary-400/40 transition-all active:scale-95 disabled:opacity-60 disabled:hover:translate-y-0">
                        <svg class="h-4 w-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        <span data-label>Send message</span>
                    </button>
                </div>
            </form>

            <!-- Thank-you (shown by contact-page.js after a successful send) -->
            <div id="contact-done" class="hidden relative overflow-hidden rounded-3xl border border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-gray-900 px-6 py-12 text-center shadow-sm">
                <div aria-hidden="true" class="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-emerald-300/30 blur-3xl"></div>
                <span class="relative inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-500 text-3xl text-white shadow-lg shadow-emerald-500/30">✓</span>
                <h2 class="relative mt-4 text-2xl font-bold text-gray-900 dark:text-white">Message sent</h2>
                <p data-done-text class="relative mt-1 text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto"></p>
                <div class="relative mt-6 flex flex-wrap justify-center gap-2">
                    <button type="button" data-again class="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Send another message</button>
                    <a href="<?= $baseUrl ?>" data-partial class="px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors">Back to the apps</a>
                </div>
            </div>
        </div>

        <!-- Side: what happens next + other help -->
        <aside class="space-y-4 lg:sticky lg:top-28">
            <section class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm">
                <h2 class="text-sm font-bold text-gray-900 dark:text-white">What happens next</h2>
                <ol class="mt-4 space-y-4">
                    <?php foreach ([['1', 'It lands in our inbox', 'Straight to our team — nothing automated in between.'], ['2', 'A real person reads it', 'Usually within a day, often sooner.'], ['3', 'We reply by email', 'To the address you gave. Just reply to keep the conversation going.']] as [$n, $t, $d]): ?>
                        <li class="flex gap-3">
                            <span class="h-7 w-7 flex-shrink-0 rounded-lg bg-gradient-to-br from-primary-400 to-rose-500 text-white text-xs font-black flex items-center justify-center shadow-sm"><?= $n ?></span>
                            <div><p class="text-sm font-semibold text-gray-800 dark:text-gray-100"><?= $t ?></p><p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5"><?= $d ?></p></div>
                        </li>
                    <?php endforeach; ?>
                </ol>
            </section>

            <a href="<?= $baseUrl ?>faqs" data-partial class="group flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-primary-300 dark:hover:border-primary-800 transition-colors">
                <span class="h-10 w-10 flex-shrink-0 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </span>
                <span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-gray-900 dark:text-white">Quick answers</span><span class="block text-xs text-gray-500 dark:text-gray-400">The FAQs might already cover it.</span></span>
                <svg class="h-4 w-4 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-0.5 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </a>

            <a href="<?= $baseUrl ?>about" data-partial class="group flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm hover:border-primary-300 dark:hover:border-primary-800 transition-colors">
                <span class="h-10 w-10 flex-shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </span>
                <span class="min-w-0 flex-1"><span class="block text-sm font-semibold text-gray-900 dark:text-white">About the apps</span><span class="block text-xs text-gray-500 dark:text-gray-400">What each CatScript app does.</span></span>
                <svg class="h-4 w-4 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-0.5 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
            </a>
        </aside>
    </div>
</div>
