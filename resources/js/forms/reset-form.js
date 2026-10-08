/**
 * Reset form HTML for the admin DB reset — applies the additive database
 * updates in scripts/migrations/ (see server/api/reset.php). Existing data
 * is never dropped or overwritten.
 */
export const resetFormHTML = `
<form id="reset-form" class="space-y-4" novalidate>
  <div id="reset-intro" class="text-sm text-gray-600 dark:text-gray-300 space-y-2">
    <p>Applies any pending database updates (new tables and columns). Existing tables and data are left untouched, and running it again is safe.</p>
    <p class="font-semibold text-amber-700 dark:text-amber-400">Back up the database before you run this.</p>
  </div>

  <div id="reset-api-message" class="hidden"></div>

  <!-- Wrap input group in a container for validation messages -->
  <div id="reset-input-group" class="flex items-center space-x-2">
    <input type="password" required id="reset-password" name="password" placeholder="Enter admin password"
      class="flex-1 px-3 py-2 border rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" required>
    <button type="submit"
      class="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-r-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900">
      Run DB Reset
    </button>
  </div>
</form>
`;
