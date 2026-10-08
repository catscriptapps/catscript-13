<?php
// /resources/views/partials/image-preview-modal.php
?>

<div id="image-preview-modal" class="fixed inset-0 z-[10010] hidden bg-black/95 backdrop-blur-md flex items-center justify-center p-4" data-preview-modal>
    <div class="relative w-full max-w-5xl max-h-full flex items-center justify-center">
        <button id="preview-prev-btn" class="absolute left-0 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl px-6 py-4 z-20 transition-colors">
            &#10094;
        </button>

        <img id="preview-modal-image" src="" alt="Preview" class="max-w-full max-h-[90vh] object-contain rounded shadow-2xl transition-all duration-300" />

        <button id="preview-next-btn" class="absolute right-0 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-5xl px-6 py-4 z-20 transition-colors">
            &#10095;
        </button>

        <button class="absolute -top-12 right-0 text-white/70 hover:text-white text-4xl transition-opacity" data-close-preview>
            &times;
        </button>
    </div>
</div>