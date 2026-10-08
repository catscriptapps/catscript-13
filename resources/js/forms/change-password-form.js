// /resources/js/forms/change-password-form.js

export function changePasswordForm() {
  return `
    <form id="change-password-form" class="space-y-5" novalidate>
      <div>
        <label for="current-password-input" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Current Password</label>
        <input type="password" id="current-password-input" name="current_password" required autocomplete="current-password"
          class="w-full rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 px-4 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-primary-500">
      </div>

      <div>
        <label for="new-password-input" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">New Password</label>
        <input type="password" id="new-password-input" name="new_password" required autocomplete="new-password" minlength="8"
          class="w-full rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 px-4 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-primary-500">
        <p class="text-[12px] text-gray-400 mt-1">At least 8 characters.</p>
      </div>

      <div>
        <label for="new-password-confirmation-input" class="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Confirm New Password</label>
        <input type="password" id="new-password-confirmation-input" name="new_password_confirmation" required autocomplete="new-password"
          class="w-full rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2.5 px-4 text-sm text-gray-900 dark:text-white focus:border-primary-500 focus:ring-primary-500">
      </div>

      <div id="change-password-message"></div>

      <button type="submit" class="w-full py-3 bg-primary-600 hover:bg-primary-500 text-white font-bold text-sm rounded-xl transition-colors">
        Update Password
      </button>
    </form>
  `;
}
