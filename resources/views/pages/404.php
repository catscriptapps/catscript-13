<?php
// /resources/views/pages/404.php

declare(strict_types=1);

/** @var string $title */
/** @var string $appName */
/** @var string $baseUrl */

// This page displays a standard 404 Not Found error.
$title = '404 Not Found'; // used in layout
// Assuming $appName is available from the main application scope.
?>
<!-- Page Container: Full screen center alignment for the error message -->
<div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 font-sans">
    <!-- 404 Content Card -->
    <div class="max-w-md w-full text-center py-12 px-6 bg-white dark:bg-gray-800 rounded-xl shadow-2xl">

        <!-- Error Code -->
        <p class="text-9xl font-extrabold text-primary-600 dark:text-primary-500 opacity-90 mb-4 tracking-tight">
            404
        </p>

        <!-- Main Title -->
        <h1 class="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl mb-3">
            Page Not Found
        </h1>

        <!-- Error Message -->
        <p class="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Oops! It looks like you've navigated to a page that doesn't exist on <span class="font-semibold"><?= $appName ?></span>.
            The link may be broken, or the page may have been moved.
        </p>

        <!-- Action Button -->
        <div class="mt-8">
            <!-- Link back to the assumed homepage path '/' -->
            <a href="<?= $baseUrl ?>" class="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition duration-150 ease-in-out transform hover:scale-[1.02]">
                Go back to Homepage
            </a>
        </div>
    </div>
</div>