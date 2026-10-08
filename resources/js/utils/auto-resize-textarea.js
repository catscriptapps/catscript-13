// /resources/js/utils/auto-resize-textarea.js

export function autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';          // reset height
    textarea.style.height = textarea.scrollHeight + 'px'; // set to scrollHeight
}