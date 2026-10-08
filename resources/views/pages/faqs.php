<?php
// /resources/views/pages/faqs.php
//
// FAQs: the help centre. Every published question (and, for admins, the
// archived ones) is embedded as JSON (#faqs-data) with its topic;
// resources/js/pages/faqs-page.js draws the topic tabs (grouped like the
// sidebar: Start here / Workspace / Business / Community / Help / Admin),
// the search across every answer, the questions and — for admins — the
// editor. Laid out like the app pages (photo hero, glass tiles).

declare(strict_types=1);

use Src\Controller\FaqsController;
use Src\Utils\CuratedPhotos;

/** @var string $baseUrl */
/** @var string $assetBase */

$slides = CuratedPhotos::fromHomeFolder($assetBase);
$data = FaqsController::state() + ['contact_url' => $baseUrl . 'contact'];
?>
<div id="faqs-page" class="space-y-6">

    <?php
    $breadcrumbs = [['label' => 'FAQs']];
    include __DIR__ . '/../components/breadcrumbs.php';
    ?>

    <!-- Hero: photo slideshow + search -->
    <section class="relative overflow-hidden rounded-3xl bg-secondary-900 text-white shadow-xl shadow-secondary-900/10">
        <?php $slideshowImages = $slides; include __DIR__ . '/../components/hero-slideshow.php'; ?>
        <div aria-hidden="true" class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
        <div class="relative p-6 sm:px-10 sm:py-9">
            <div class="flex flex-col lg:flex-row lg:items-end gap-6">
                <div class="min-w-0 flex-1">
                    <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">Help · FAQs</span>
                    <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">How can we help?</h1>
                    <p class="mt-2 text-base text-secondary-50 max-w-xl">Answers about every app — how things work, who can see what, and how to get the most out of each one.</p>
                    <div class="relative mt-5 max-w-2xl">
                        <svg class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        <input type="search" id="faq-search" autocomplete="off" placeholder="Search every answer — e.g. “password”, “live chat”, “photo”…"
                            class="block w-full rounded-2xl border-0 bg-white/95 dark:bg-gray-900/95 py-3.5 pl-12 pr-4 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400 shadow-lg focus:ring-4 focus:ring-primary-400/40 outline-none">
                    </div>
                </div>
                <div id="faq-tiles" class="grid grid-cols-3 gap-3 lg:w-80"></div>
            </div>
        </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] items-start">
        <!-- Topics -->
        <nav id="faq-topics" aria-label="Topics" class="lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto custom-scrollbar rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-2"></nav>

        <!-- Questions -->
        <div id="faq-body" class="min-w-0 space-y-4" aria-live="polite"></div>
    </div>

    <script type="application/json" id="faqs-data"><?= json_encode($data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE) ?></script>
</div>
