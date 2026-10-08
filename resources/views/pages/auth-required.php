<?php
// /resources/views/pages/auth-required.php

/** @var string $baseUrl */
?>
<div class="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
    <div class="text-red-600">
        <!-- Optional warning icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M4.93 4.93a10 10 0 0114.14 0 10 10 0 010 14.14 10 10 0 01-14.14 0 10 10 0 010-14.14z" />
        </svg>
    </div>
    <h1 class="text-3xl font-bold text-black dark:text-white">Authentication Required</h1>
    <p class="text-gray-600 dark:text-gray-300">You must be signed in to access this page.</p>
    <a href="<?= $baseUrl ?>login"
        data-login-button
        id="auth-required-signin-btn"
        class="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900">
        Sign In
    </a>
</div>