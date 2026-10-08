// /resources/js/forms/task-form.js

import { escapeHtml } from '../utils/escape-html.js';

/** Default time for new tasks (matches TasksController::DEFAULT_TIME). */
export const DEFAULT_TASK_TIME = '00:00';

/** YYYY-MM-DD in the browser's local time zone (not UTC). */
export function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Add / edit task form.
 * @param {object} opts
 * @param {object|null} opts.task  TasksController::present() data when editing
 */
export function taskForm({ task = null, formId = 'task-form' } = {}) {
  const isEdit = !!task;
  const title = escapeHtml(task?.title ?? '');
  const detail = escapeHtml(task?.detail ?? '');
  const dueDate = task?.due_date || localDate();
  // New tasks default to 12:00 AM (when most bills are due); an existing
  // task keeps its own time, or blank if it has none ("Any time").
  const time = task ? (task.time ?? '') : DEFAULT_TASK_TIME;

  const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
  const label = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';
  const chip = 'task-date-chip px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors';

  return `
  <form id="${formId}" class="space-y-5" novalidate ${isEdit ? `data-encoded-id="${task.encoded_id}"` : ''}>
    <div>
      <label for="${formId}-title" class="${label}">Title</label>
      <div class="relative">
        <input type="text" required maxlength="255" id="${formId}-title" name="task_title" autocomplete="off"
          placeholder="e.g. Pay the hydro bill" value="${title}" class="${input}" />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label for="${formId}-date" class="${label}">Due date</label>
        <input type="date" required id="${formId}-date" name="due_date" value="${dueDate}" class="${input}" />
        <div class="mt-2 flex flex-wrap gap-1.5">
          <button type="button" class="${chip}" data-offset="0">Today</button>
          <button type="button" class="${chip}" data-offset="1">Tomorrow</button>
          <button type="button" class="${chip}" data-offset="7">In a week</button>
        </div>
      </div>
      <div>
        <label for="${formId}-time" class="${label}">Time <span class="font-normal text-gray-400">(optional)</span></label>
        <input type="time" id="${formId}-time" name="task_time" value="${time}" class="${input}" />
        <button type="button" class="task-clear-time mt-2 text-xs font-semibold text-gray-500 hover:text-primary-600 ${time ? '' : 'hidden'}">Clear time</button>
      </div>
    </div>

    <div>
      <label for="${formId}-detail" class="${label}">Details <span class="font-normal text-gray-400">(optional)</span></label>
      <textarea id="${formId}-detail" name="task_detail" rows="4" maxlength="5000"
        placeholder="Anything worth remembering…" class="${input} resize-y">${detail}</textarea>
    </div>

    <div class="api-message"></div>

    <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
      <button type="button" class="task-cancel-btn px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
      <button type="submit" class="inline-flex items-center justify-center min-w-[8rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60">
        ${isEdit ? 'Save changes' : 'Add task'}
      </button>
    </div>
  </form>`;
}
