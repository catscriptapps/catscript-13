<?php
// /resources/views/components/guest-demo-banner.php
//
// "You're trying <app> as a guest" banner for the browser-only demos
// (every app). The page script wires the two buttons by id.
//
// @var string $demoApp      App name, e.g. 'Tasks'
// @var string $demoText     What it starts with, e.g. 'sample entries'
// @var string $demoIdPrefix Button id prefix, e.g. 'cf' → #cf-guest-sample / #cf-guest-clear
// @var string $baseUrl
?>
<div class="relative overflow-hidden rounded-2xl border border-primary-200 dark:border-primary-900/60 bg-gradient-to-r from-primary-50 via-amber-50 to-white dark:from-primary-950/40 dark:via-gray-900 dark:to-gray-900 p-4 sm:p-5">
    <div class="flex flex-col lg:flex-row lg:items-center gap-4">
        <div class="flex items-start gap-3 min-w-0 flex-1">
            <span class="h-10 w-10 flex-shrink-0 rounded-xl bg-primary-500 text-white flex items-center justify-center shadow-md shadow-primary-500/30">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </span>
            <div class="min-w-0">
                <p class="text-sm font-bold text-gray-900 dark:text-white">You're trying <?= htmlspecialchars($demoApp) ?> as a guest</p>
                <p class="text-sm text-gray-600 dark:text-gray-300">Add, edit and delete as much as you like — it's all saved <strong>only in this browser</strong>, never on our servers. It starts with <?= htmlspecialchars($demoText) ?> so you can see it in action.</p>
            </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
            <button type="button" id="<?= $demoIdPrefix ?>-guest-sample" class="px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-white dark:hover:bg-gray-700 transition-colors">Reload sample data</button>
            <button type="button" id="<?= $demoIdPrefix ?>-guest-clear" class="px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white/80 dark:bg-gray-800 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-white dark:hover:bg-gray-700 transition-colors">Start empty</button>
            <a href="<?= $baseUrl ?>login" data-login-button class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors">Sign in to use your account</a>
        </div>
    </div>
</div>
