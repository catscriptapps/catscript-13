<?php
// /resources/views/pages/access-denied.php

/** @var string $baseUrl */
?>

<div class="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
    <div class="text-primary-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 4.407 10.125 10 10.125s10-4.533 10-10.125c0-1.323-.213-2.597-.602-3.75A11.959 11.959 0 0112 2.714z" />
        </svg>
    </div>

    <div class="space-y-2">
        <h1 class="text-3xl font-bold text-black dark:text-white">Access Restricted</h1>
        <p class="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Additional credentials or specific app permissions are required to view this page.
            If you believe this is an error, please contact your administrator.
        </p>
    </div>

    <div class="flex flex-col sm:flex-row gap-4 pt-4">
        <a href="<?= $baseUrl ?>/dashboard"
            class="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md transition-colors duration-200 font-medium">
            Return to Dashboard
        </a>

        <button onclick="window.history.back()"
            class="px-6 py-3 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors duration-200 font-medium">
            Go Back
        </button>
    </div>
</div>