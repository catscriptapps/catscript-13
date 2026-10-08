<?php
// /resources/views/layouts/db-reset.php

declare(strict_types=1);

/** @var string $title */
/** @var string $appName */
/** @var string $assetBase */
/** @var string $baseUrl */
/** @var array<string, mixed>|null $protectedPaths */
/** @var bool $isLoggedIn */

/**
 * DB Reset Layout (Maintenance Mode)
 * Mimics app.php to maintain JS compatibility but focuses on the Reset Action.
 */

// Define necessary variables that the standard header/footer expect
$title = $title ?? 'Database Reset';
$isLoggedIn = false; // We force this for the reset screen
?>
<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50 dark:bg-gray-950">

<head>
    <script>
        // Same anti-flash guard as the other layouts, kept in sync with
        // dark-mode.js's STORAGE_KEY ('user-theme'), which this layout's
        // #dark-toggle button already writes to correctly.
        (function () {
            if (localStorage.getItem('user-theme') === 'dark') {
                document.documentElement.classList.add('dark');
            }
        })();
    </script>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title><?= htmlspecialchars($title) . ' | ' . htmlspecialchars($appName); ?></title>

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/x-icon" href="<?= $assetBase ?>images/logo/favicon.ico">

    <script>
        window.APP_CONFIG = {
            baseUrl: <?= json_encode($baseUrl) ?>,
            assetBase: <?= json_encode($assetBase) ?>,
            // Changes with every build (assets/js/build.json) — busts cached page scripts
            buildId: <?= json_encode(assetBuildId()) ?>,
            appName: <?= json_encode($appName) ?>,
            protectedPaths: <?= json_encode($protectedPaths ?? []) ?>,
        };
    </script>

    <link rel="stylesheet" href="<?= $assetBase ?>assets/css/app.min.css?v=<?= assetVersion('assets/css/app.min.css') ?>">
</head>

<body class="font-sans antialiased h-full overflow-x-hidden text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950"
    x-data="{ mobileMenuOpen: false }">

    <div class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 transition-all duration-300 ease-in-out lg:pl-0">

        <header class="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-8 dark:bg-gray-900/80 dark:border-gray-800 transition-colors duration-300">
            <div class="flex flex-1 items-center gap-x-3">
                <a href="<?= $baseUrl ?>" class="lg:hidden flex items-center">
                    <img class="h-8 w-8 rounded-lg shadow-sm" src="<?= $assetBase ?>images/logo/favicon.ico" alt="Logo">
                </a>

                <div class="hidden sm:flex items-center">
                    <span class="text-xl font-bold tracking-tight text-gray-900 dark:text-white font-sans">
                        <span class="text-primary-600"><?= $appName ?></span>
                    </span>
                </div>
            </div>

            <div class="flex flex-1 justify-end items-center gap-x-1 lg:gap-x-2">
                <button data-reset-button data-reset-mode="maintenance" data-tooltip="DB Reset"
                    class="group p-3 rounded-2xl bg-white dark:bg-secondary-900 border border-secondary-100 dark:border-secondary-800 hover:border-primary-400 transition-all duration-300 shadow-sm text-secondary-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>

                <button id="dark-toggle"
                    class="group relative p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-secondary-400 dark:hover:border-primary-400 transition-all duration-300 shadow-sm"
                    title="Toggle Theme">
                    <svg class="w-6 h-6 text-secondary-500 block dark:hidden" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
                    </svg>
                    <svg class="w-6 h-6 text-primary-400 hidden dark:block" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        </header>

        <main class="flex-1 py-10 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950">
            <div id="modal-zone"></div>

            <div id="main-content" class="max-w-7xl mx-auto h-full flex flex-col items-center justify-center min-h-[60vh]">

                <div class="max-w-md w-full p-8 bg-white dark:bg-gray-900 rounded-3xl shadow-xl border-t-8 border-primary-500 text-center animate-fade-in">
                    <div class="w-20 h-20 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-10 h-10">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </div>

                    <?php if (!empty($needsInstall)): ?>
                        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Not Installed Yet</h2>
                        <p class="text-gray-600 dark:text-gray-400 mb-8">
                            The database is empty (or can't be reached — check the <strong>DB_*</strong> settings in .env). Set <strong>ADMIN_EMAIL</strong> and <strong>ADMIN_RESET_PASSWORD</strong> in .env, then click the <strong>trash icon in the header</strong> and enter that password to install.
                        </p>
                    <?php else: ?>
                        <h2 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Reset Mode Active</h2>
                        <p class="text-gray-600 dark:text-gray-400 mb-8">
                            The system is currently locked for maintenance. Click the <strong>trash icon in the header</strong> to install or update the database.
                        </p>
                    <?php endif; ?>

                    <p class="text-amber-700 dark:text-amber-400 font-bold mb-8">
                        An empty database gets the full install (tables, starter data and the first admin from .env); existing data is never touched — only missing tables and columns are added.<br> Back up the database first.
                    </p>

                    <p class="mt-8 text-xs font-medium text-primary-600 uppercase tracking-widest">
                        <?= $appName ?> Project
                    </p>
                </div>

            </div>
        </main>

        <footer class="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8 mt-auto">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex flex-col md:flex-row items-center justify-between gap-6">

                    <div class="hidden lg:block">
                        <span class="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-600">
                            Powered by CatScript-13
                        </span>
                    </div>
                </div>
            </div>
        </footer>
    </div>

    <?php include __DIR__ . '/../components/scroll-top.php'; ?>

    <script type="module" src="<?= $assetBase ?>assets/js/app.min.js?v=<?= assetVersion('assets/js/app.min.js') ?>"></script>
</body>

</html>