<?php
// /resources/views/pages/reset-password.php

declare(strict_types=1);

/** @var string $baseUrl */

$token = $_GET['token'] ?? '';
$email = $_GET['email'] ?? '';

// If no token or email, redirect to login
if (empty($token) || empty($email)) {
    header('Location: ' . $baseUrl . 'login');
    exit;
}
?>

<div class="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 max-w-md mx-auto px-4">

    <div class="space-y-2">
        <h1 class="text-3xl font-bold text-black dark:text-white">Set New Password</h1>
        <p class="text-gray-600 dark:text-gray-400">
            Enter a secure password for <span class="font-bold text-primary-600"><?= htmlspecialchars($email) ?></span>
        </p>
    </div>

    <div id="reset-api-message" class="w-full hidden text-sm p-4 rounded-md"></div>

    <form id="new-password-form" class="w-full space-y-4 text-left" novalidate>
        <input type="hidden" name="token" value="<?= htmlspecialchars($token) ?>">
        <input type="hidden" name="email" value="<?= htmlspecialchars($email) ?>">

        <div>
            <label for="password" class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">New Password</label>
            <input id="password" name="password" type="password" required
                class="block w-full rounded-md border-gray-300 dark:border-slate-700 dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3"
                placeholder="••••••••">
        </div>

        <div>
            <label for="password_confirmation" class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
            <input id="password_confirmation" name="password_confirmation" type="password" required
                class="block w-full rounded-md border-gray-300 dark:border-slate-700 dark:bg-slate-800 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm p-3"
                placeholder="••••••••">
        </div>

        <button type="submit" id="btn-update-password"
            class="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 transition-colors">
            Update Password
        </button>
    </form>

    <div class="pt-6 border-t border-gray-200 dark:border-slate-800 w-full space-y-4">
        <p class="text-sm text-gray-500 dark:text-gray-400 italic">Wait, I remember it!</p>
        <a href="<?= $baseUrl . 'login' ?>"
            data-login-button
            id="auth-reset-back-btn"
            class="inline-block px-6 py-3 bg-secondary-950 hover:bg-black text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500 dark:focus:ring-offset-gray-900 transition-colors">
            Back to Sign In
        </a>
    </div>
</div>