/**
 * Converts a date string into a readable format like "Oct 30 2025 9:52 AM".
 *
 * This utility is designed for global reuse across apps and modules.
 * It ensures consistent formatting for timestamps in U.S. English locale.
 *
 * Features:
 * - Short month name (e.g., "Oct")
 * - Numeric day and full year (e.g., "30 2025")
 * - 12-hour time with AM/PM (e.g., "9:52 AM")
 * - Removes default comma after year for cleaner output
 *
 * @param {string|Date} input - A valid date string or Date object.
 * @returns {string} - Formatted date string like "Oct 30 2025 9:52 AM".
 */
export function formatDate(input) {
  const date = typeof input === 'string' ? new Date(input) : input;
  const formatted = date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  // Remove comma after year and reconstruct
  const parts = formatted.replace(',', '').split(' ');
  return `${parts[0]} ${parts[1]} ${parts[2]} ${parts.slice(3).join(' ')}`;
}
