// /resources/js/forms/login-form.js

/**
 * Login form HTML for modal
 */
export const loginFormHTML = `
<form id="login-form" class="space-y-4" novalidate>
  <div class="flex flex-col">
    <label for="login-email" class="mb-1 text-gray-700 dark:text-gray-300 font-sans text-sm font-semibold">Email</label>
    <input type="email" id="login-email" name="email" placeholder="you@example.com"
      class="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" required>
  </div>

  <div class="flex flex-col">
    <div class="flex justify-between items-center mb-1">
      <label for="login-password" class="text-gray-700 dark:text-gray-300 font-sans text-sm font-semibold">Password</label>
      <a href="#" id="forgot-password-link" class="text-xs font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
        Forgot password?
      </a>
    </div>
    <div class="relative group">
      <input type="password" id="login-password" name="password" placeholder="••••••••"
        class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 pr-10" required>
      
      <button type="button" id="toggle-password" 
        class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-primary-500 transition-colors focus:outline-none"
        aria-label="Toggle password visibility">
        <svg id="eye-show" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <svg id="eye-hide" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.274-4.057 5.064-7 9.542-7 1.222 0 2.391.21 3.474.591M8.557 8.557a3.5 3.5 0 104.886 4.886M3 3l18 18" />
        </svg>
      </button>
    </div>
  </div>

  <div id="login-api-message" class="text-sm space-y-1"></div>

  <div class="flex justify-end pt-2">
    <button type="submit"
      class="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 transition-all active:scale-95">
      Sign In
    </button>
  </div>
</form>
`;