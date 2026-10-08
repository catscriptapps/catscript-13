<?php
// /resources/views/layouts/real-estate-world-app.php

declare(strict_types=1);

/**
 * CatScript Apps - Main Application Layout
 * The single shell (sidebar + header + footer) every page renders inside.
 */
?>
<!DOCTYPE html>
<html lang="en" class="h-full bg-gray-50 dark:bg-gray-950">

<head>
    <script>
        // Applies the saved theme before anything else paints, so there's no
        // light-mode flash on a dark-mode reload, and so Alpine's theme store
        // (app.js) reads the correct starting class instead of a stale one.
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
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">

    <link rel="icon" type="image/x-icon" href="<?= $assetBase ?>images/logo/favicon.ico">

    <script>
        window.APP_CONFIG = {
            baseUrl: <?= json_encode($baseUrl) ?>,
            assetBase: <?= json_encode($assetBase) ?>,
            // Changes with every build (assets/js/build.json) — busts cached page scripts
            buildId: <?= json_encode(assetBuildId()) ?>,
            appName: <?= json_encode($appName) ?>,
            protectedPaths: <?= json_encode($protectedPaths ?? []) ?>,
            mediaLimit: <?= getMediaLimit() ?>,
            isLoggedIn: <?= json_encode($isLoggedIn ?? false) ?>,
            isAdmin: <?= json_encode($isAdmin ?? false) ?>,
            // "App access" checkboxes in the admin's user form (permitted_apps)
            grantableApps: <?= json_encode(($isAdmin ?? false) ? \Src\Config\NavigationConfig::grantableApps() : []) ?>,
            // capability => the app it belongs to (shown nested under that app)
            appCapabilities: <?= json_encode(($isAdmin ?? false) ? array_flip(\Src\Service\AuthService::CAPABILITIES) : new \stdClass()) ?>,
        };
    </script>

    <link rel="stylesheet" href="<?= $assetBase ?>assets/css/app.min.css?v=<?= assetVersion('assets/css/app.min.css') ?>">
</head>

<body class="font-sans antialiased h-full overflow-x-hidden text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-950"
    x-data="{ mobileMenuOpen: false }">

    <?php include __DIR__ . '/../partials/sidebar.php'; ?>

    <!-- Mobile Sidebar Backdrop -->
    <div
        x-show="mobileMenuOpen"
        x-transition:enter="transition-opacity ease-linear duration-200" x-transition:enter-start="opacity-0" x-transition:enter-end="opacity-100"
        x-transition:leave="transition-opacity ease-linear duration-200" x-transition:leave-start="opacity-100" x-transition:leave-end="opacity-0"
        @click="mobileMenuOpen = false"
        class="fixed inset-0 z-40 bg-gray-900/50 lg:hidden"
        x-cloak></div>

    <div
        class="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950 transition-all duration-300 ease-in-out"
        :class="$store.sidebar.expanded ? 'lg:pl-64' : 'lg:pl-24'">

        <?php include __DIR__ . '/../partials/header.php'; ?>

        <main class="flex-1 py-10 px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-950 transition-colors duration-300">
            <div id="modal-zone"></div>

            <div id="main-content" class="max-w-7xl mx-auto space-y-8">

                <div class="w-full">
                    <?php include $pageFile; ?>
                </div>

            </div>
        </main>

        <?php include __DIR__ . '/../partials/image-preview-modal.php'; ?>

        <footer class="mt-auto border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-6 transition-colors duration-300">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center space-x-2">
                    <span class="text-sm font-bold tracking-tight text-gray-900 dark:text-white">CatScript Apps</span>
                    <span class="text-xs text-gray-400 dark:text-gray-500">&copy; <?= date('Y') ?> CatScript Apps. All rights reserved.</span>
                </div>
                <div class="flex space-x-6 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <a href="#" class="hover:text-primary-600 transition-colors">Terms of Service</a>
                    <a href="#" class="hover:text-primary-600 transition-colors">Privacy Policy</a>
                </div>
            </div>
        </footer>
    </div>

    <?php include __DIR__ . '/../components/scroll-top.php'; ?>
    <?php include __DIR__ . '/../components/chat-widget.php'; ?>

    <?php if ($isLoggedIn && isset($_SESSION['user_id'])): ?>
        <script>
            window.sessionUserId = <?= json_encode($_SESSION['user_id']) ?>;
        </script>
    <?php endif; ?>

    <script type="module" src="<?= $assetBase ?>assets/js/app.min.js?v=<?= assetVersion('assets/js/app.min.js') ?>"></script>
</body>

</html>
