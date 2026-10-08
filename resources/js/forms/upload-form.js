/**
 * /resources/js/components/forms/upload-form.js
 * Exports the raw HTML content for the Image Upload Modal form.
 */
export const UPLOAD_FORM_HTML = `
<form id="upload-form" class="space-y-4 overflow-visible">
    <div>
        <div class="border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-lg p-6 text-center cursor-pointer hover:bg-primary-50 dark:hover:bg-gray-700 transition-colors" onclick="document.getElementById('file-upload-input').click()">
            <input type="file" id="file-upload-input" multiple accept="image/*,.heic,.heif" class="hidden">
            <svg class="mx-auto h-12 w-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 014 4v2a4 4 0 01-2 7h-5M15 11l-3-3m0 0L9 11m3-3v8"></path></svg>
            <p class="mt-1 text-sm text-gray-600 dark:text-gray-400"><span class="font-semibold text-primary-600">Click to upload</span> or drag and drop</p>
            <p class="text-xs text-gray-500 dark:text-gray-500">JPG, PNG, HEIC (Auto-converted) - Optimized to < 50KB</p>
        </div>

        <div id="image-preview-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4"></div>
    </div>

    <div class="flex items-center justify-between">
        <button type="submit" id="upload-submit" disabled 
            class="font-medium px-5 py-2 rounded-md transition-colors duration-200 bg-blue-400 opacity-70 cursor-not-allowed text-white">
            No Files to Upload
        </button>
    </div>
</form>
`;