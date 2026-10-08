// /resources/js/modals/upload-modal.js

import { showToast } from "../ui/toast";

// -------------------------------
// Modal controller (singleton)
// -------------------------------
export const uploadModal = (() => {
  let modalEl = null;

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'upload-modal';
    modalEl.className = 'fixed inset-0 hidden';
    // Modal-factory modals (e.g. the Share Post composer) sit at z-index
    // 2147483647/48 — this can be opened from inside one of those, so it
    // needs to sit at least as high or it renders behind that overlay.
    modalEl.style.zIndex = '2147483648';

    modalEl.innerHTML = `
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-backdrop></div>
      <div class="relative mx-auto mt-10 w-full max-w-4xl px-4">
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
          <header class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
            <div>
                <h2 class="font-bold text-xl text-gray-800 dark:text-gray-100 font-sans">Upload Media</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400 font-sans">HEIC Support + Auto-Optimization (< 50KB)</p>
            </div>
            <div class="flex items-center gap-3">
              <button class="text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors font-sans" data-clear>Clear All</button>
              <button class="px-5 py-2 text-sm font-bold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/30 transition-all font-sans" data-final-upload disabled>Upload (0)</button>
              <button class="p-2 text-gray-400 hover:text-red-500 transition-colors" data-close>
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          </header>

          <!-- Upload progress (shown while sending — see createUploadHandler) -->
          <div data-progress class="hidden border-b border-gray-200 dark:border-gray-700 bg-primary-50/60 dark:bg-primary-950/20 px-4 py-3 font-sans" role="status" aria-live="polite">
            <div class="flex items-center justify-between gap-3 text-sm">
              <p class="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span class="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent" data-progress-spin></span>
                <span data-progress-label>Uploading…</span>
              </p>
              <span class="font-bold tabular-nums text-primary-700 dark:text-primary-300" data-progress-pct>0%</span>
            </div>
            <div class="mt-2 h-2.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-progress-track>
              <div class="h-full w-0 rounded-full bg-primary-500 transition-[width] duration-300 ease-out" data-progress-bar></div>
            </div>
            <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400" data-progress-detail></p>
          </div>

          <section class="p-6 space-y-6 overflow-y-auto">
            <div data-drop-zone
                 class="group flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 cursor-pointer transition-all hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/10">
              <div class="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0l-4 4m4-4l4 4M17 8v12m0 0l-4-4m4 4l4-4" /></svg>
              </div>
              <p class="text-gray-700 dark:text-gray-200 font-medium text-center font-sans">Drag files here or click to browse</p>
              <input type="file" multiple accept="image/*,.heic" data-file-input class="hidden" />
            </div>
            <div data-preview-grid class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"></div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    return modalEl;
  }

  return {
    open: () => ensureModal().classList.remove('hidden'),
    close: () => {
      if (!modalEl) return;
      modalEl.classList.add('hidden');
      // 🍊 Dispatch a custom event so others can listen
      modalEl.dispatchEvent(new CustomEvent('modal:closed'));
    }
  };
})();

// -------------------------------
// Worker Pool (The Engine)
// -------------------------------
class WorkerPool {
  // quality: {maxDim, q, targetKB} — the defaults suit avatars / receipts
  // (small, ~55KB); a photo gallery passes larger values via
  // createUploadHandler's options.quality.
  constructor(size = 6, quality = {}) {
    this.size = size;
    this.quality = { maxDim: 1200, q: 0.6, targetKB: 55, ...quality };
    this.workers = [];
    this.queue = [];
    this.active = new Map();
    this.ready = false;
    this.init();
  }

  async init() {
    try {
      const response = await fetch(`${window.APP_CONFIG.baseUrl}js/heic2any.min.js`);
      const libContent = await response.text();
      const workerSource = `
        self.window = self; // CRITICAL POLYFILL FROM ROOFING REPORTS
        ${libContent}

        // HEIC LIBRARY POLYFILL
        if (!self.document) {
            self.document = { createElement: (tag) => {
                if (tag === 'canvas') {
                    const c = new OffscreenCanvas(1, 1);
                    c.toBlob = (cb, type, q) => c.convertToBlob({type, quality: q}).then(cb);
                    return c;
                }
                return {};
            }};
        }

        async function forceCompress(blob, maxDim, quality, targetBytes = 56320) {
            const bitmap = await createImageBitmap(blob);
            let w = bitmap.width, h = bitmap.height;
            const ratio = Math.min(maxDim / w, maxDim / h, 1);
            w = Math.round(w * ratio); h = Math.round(h * ratio);

            const canvas = new OffscreenCanvas(w, h);
            canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
            bitmap.close();

            let finalBlob = await canvas.convertToBlob({type: 'image/jpeg', quality: quality});
            
            // RECURSIVE CHECK: shrink until under the target size
            if (finalBlob.size > targetBytes && maxDim > 400) {
               return await forceCompress(finalBlob, maxDim * 0.8, quality * 0.8, targetBytes);
            }
            return finalBlob;
        }

        self.onmessage = async (e) => {
          const { id, file, quality } = e.data;
          let blob = new Blob([file.buffer], { type: file.type });
          try {
            // HEIC CONVERSION
            if (file.name.match(/\\.heic$/i)) {
              const converted = await heic2any({ blob, toType: 'image/jpeg', quality: 0.7 });
              blob = Array.isArray(converted) ? converted[0] : converted;
            }
            
            const finalBlob = await forceCompress(blob, quality.maxDim, quality.q, quality.targetKB * 1024);
            const previewBlob = await forceCompress(finalBlob, 300, 0.4);
            
            const fBuf = await finalBlob.arrayBuffer();
            const pBuf = await previewBlob.arrayBuffer();
            self.postMessage({ id, buffer: fBuf, previewBuffer: pBuf, size: finalBlob.size }, [fBuf, pBuf]);
          } catch (err) {
            self.postMessage({ id, error: err.message });
          }
        };
      `;
      this.workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'application/javascript' }));

      for (let i = 0; i < this.size; i++) {
        const w = new Worker(this.workerUrl);
        w.onmessage = (e) => {
          const { id, error, buffer, previewBuffer, size } = e.data;
          const callback = this.active.get(id);
          if (callback) callback({
            blob: buffer ? new Blob([buffer], { type: 'image/jpeg' }) : null,
            previewBlob: previewBuffer ? new Blob([previewBuffer], { type: 'image/jpeg' }) : null,
            error, size
          });
          this.active.delete(id);
          w.busy = false;
          this.next();
        };
        this.workers.push(w);
      }
      this.ready = true;
      this.next();
    } catch (err) { console.error(err); }
  }

  enqueue(file, id) {
    return new Promise(async (resolve) => {
      const buffer = await file.arrayBuffer();
      this.queue.push({ file: { buffer, name: file.name, type: file.type }, id, resolve });
      this.next();
    });
  }

  next() {
    if (!this.ready) return;
    const job = this.queue.shift();
    if (!job) return;
    const idle = this.workers.find(w => !w.busy);
    if (!idle) { this.queue.unshift(job); return; }
    idle.busy = true;
    this.active.set(job.id, (res) => job.resolve(res));
    idle.postMessage({ id: job.id, file: job.file, quality: this.quality }, [job.file.buffer]);
  }

  terminate() {
    this.workers.forEach(w => w.terminate());
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
  }
}

// -------------------------------
// Main Controller (Batching + Logic)
// -------------------------------
export function createUploadHandler(endpointUrl, context, onComplete, concurrency = 6, autoProcess = true, options = {}) {
  uploadModal.open();
  const modalEl = document.getElementById('upload-modal');
  let items = [];
  const pool = new WorkerPool(concurrency, options.quality);
  const BATCH_SIZE = 20; // Server Safety Limit
  const MAX_ALLOWED = options.maxFiles || 999; // CatScript Limit Enforcement

  const fileInput = modalEl.querySelector('[data-file-input]');
  const dropZone = modalEl.querySelector('[data-drop-zone]');
  const previewGrid = modalEl.querySelector('[data-preview-grid]');
  const finalBtn = modalEl.querySelector('[data-final-upload]');

  if (options.single) fileInput.removeAttribute('multiple');
  else fileInput.setAttribute('multiple', '');

  const closeHandler = () => { pool.terminate(); uploadModal.close(); };
  modalEl.querySelector('[data-close]').onclick = closeHandler;
  modalEl.querySelector('[data-backdrop]').onclick = closeHandler;

  const updateUI = () => {
    const ready = items.filter(i => i.processed && !i.error).length;
    finalBtn.textContent = `Upload (${ready})`;
    finalBtn.disabled = ready === 0 || items.some(i => !i.processed && !i.error);
  };

  const handleFiles = async (fileList) => {
    let incoming = Array.from(fileList);

    // ENFORCE LIMIT: If we already have items or incoming exceeds max, slice it.
    const currentCount = items.length;
    if (currentCount + incoming.length > MAX_ALLOWED) {
      const allowedCount = MAX_ALLOWED - currentCount;
      if (allowedCount <= 0) {
        showToast(`Limit reached. You can only upload ${MAX_ALLOWED} images in total.`, 'error');
        return;
      }
      showToast(`Limit is ${MAX_ALLOWED}. Only the first ${allowedCount} files from your selection were added.`, 'error');
      incoming = incoming.slice(0, allowedCount);
    }

    if (options.single) {
      items.forEach(i => i.tile.remove());
      items = [];
    }
    for (const file of incoming) {
      const id = crypto.randomUUID();
      const tile = document.createElement('div');
      tile.className = 'bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden relative';
      tile.innerHTML = `
        <div class="h-28 bg-gray-200 dark:bg-gray-700 preview-img flex items-center justify-center relative">
          <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
        </div>
        <div class="p-2">
          <p class="text-[11px] truncate font-medium dark:text-gray-300 font-sans">${file.name}</p>
          <div class="w-full bg-gray-200 dark:bg-gray-600 h-1 mt-1 rounded-full overflow-hidden"><div class="bg-primary-500 h-full w-0 transition-all" data-bar></div></div>
          <p class="text-[10px] text-gray-500 mt-1 font-sans" data-status>Processing...</p>
        </div>
      `;
      previewGrid.appendChild(tile);

      const item = { id, tile, processed: false, blob: null };
      items.push(item);

      pool.enqueue(file, id).then(res => {
        if (res.error) {
          tile.querySelector('[data-status]').textContent = 'Error';
          tile.querySelector('[data-status]').classList.add('text-red-500');
        } else {
          item.blob = res.blob;
          item.processed = true;
          const url = URL.createObjectURL(res.previewBlob);
          tile.querySelector('.preview-img').innerHTML = `
                <img src="${url}" class="w-full h-full object-cover">
                <button data-del class="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-xl z-10">✕</button>
            `;
          tile.querySelector('[data-del]').onclick = () => {
            tile.remove();
            items = items.filter(i => i.id !== id);
            updateUI();
          };
          tile.querySelector('[data-status]').textContent = (res.size / 1024).toFixed(1) + ' KB';
          tile.querySelector('[data-bar]').style.width = '100%';
        }
        updateUI();
      });
    }
    fileInput.value = '';
  };

  // --- Progress panel --------------------------------------
  // Real byte progress across every batch (XHR upload events), then a
  // "saving" step while the server stores each batch — so a long upload
  // never looks frozen.
  const progress = {
    el: modalEl.querySelector('[data-progress]'),
    show(on) {
      this.el.classList.toggle('hidden', !on);
      modalEl.querySelector('[data-clear]').disabled = on;
      modalEl.querySelector('[data-drop-zone]').classList.toggle('pointer-events-none', on);
      modalEl.querySelector('[data-drop-zone]').classList.toggle('opacity-50', on);
      this.lockTiles(on);
    },
    // No removing pictures mid-upload
    lockTiles(on) {
      previewGrid.querySelectorAll('[data-del]').forEach(b => b.classList.toggle('hidden', on));
    },
    set(pct, label, detail, { error = false } = {}) {
      const p = Math.max(0, Math.min(100, Math.round(pct)));
      const bar = this.el.querySelector('[data-progress-bar]');
      bar.style.width = `${p}%`;
      bar.classList.toggle('bg-primary-500', !error);
      bar.classList.toggle('bg-red-500', error);
      this.el.querySelector('[data-progress-track]').setAttribute('aria-valuenow', String(p));
      this.el.querySelector('[data-progress-pct]').textContent = `${p}%`;
      this.el.querySelector('[data-progress-label]').textContent = label;
      this.el.querySelector('[data-progress-detail]').textContent = detail;
      this.el.querySelector('[data-progress-spin]').classList.toggle('hidden', error);
      this.el.querySelector('[data-progress-label]').classList.toggle('text-red-600', error);
      ['bg-primary-50/60', 'dark:bg-primary-950/20'].forEach(c => this.el.classList.toggle(c, !error));
      ['bg-red-50', 'dark:bg-red-950/30'].forEach(c => this.el.classList.toggle(c, error));
    },
  };

  progress.show(false); // the modal is shared — clear a previous upload's panel

  /** POST one batch, reporting bytes sent; resolves with the parsed JSON. */
  const sendBatch = (fd, onBytes) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpointUrl);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onBytes(e.loaded, e.total); };
    xhr.upload.onload = () => onBytes(1, 1, true); // all sent — the server is saving now
    xhr.onload = () => {
      try {
        const text = xhr.responseText || '';
        resolve(JSON.parse(text.substring(text.indexOf('{'))));
      } catch (err) {
        reject(new Error('Unexpected server response.'));
      }
    };
    xhr.onerror = () => reject(new Error('The connection dropped.'));
    xhr.ontimeout = () => reject(new Error('The upload timed out.'));
    xhr.send(fd);
  });

  finalBtn.onclick = async () => {
    const readyItems = items.filter(i => i.processed && !i.error);
    if (!readyItems.length) return;

    finalBtn.disabled = true;
    const allUploadedFiles = [];
    let lastCardHtml = null;

    const total = readyItems.length;
    const batches = Math.ceil(total / BATCH_SIZE);
    const totalBytes = readyItems.reduce((n, it) => n + (it.blob?.size || 0), 0) || 1;
    let doneBytes = 0;
    let doneCount = 0;
    const word = (n) => (n === 1 ? 'picture' : 'pictures');
    const batchText = (b) => (batches > 1 ? ` · batch ${b} of ${batches}` : '');

    progress.show(true);
    progress.set(0, `Uploading ${total} ${word(total)}…`, batchText(1).replace(' · ', ''));
    readyItems.forEach(it => {
      it.tile.querySelector('[data-status]').textContent = 'Waiting…';
      it.tile.classList.add('opacity-60');
    });

    // BATCH PROCESSING LOOP
    for (let i = 0; i < readyItems.length; i += BATCH_SIZE) {
      const chunk = readyItems.slice(i, i + BATCH_SIZE);
      const batchNo = Math.floor(i / BATCH_SIZE) + 1;
      const chunkBytes = chunk.reduce((n, it) => n + (it.blob?.size || 0), 0);

      chunk.forEach(it => {
        it.tile.classList.remove('opacity-60');
        it.tile.querySelector('[data-status]').textContent = 'Uploading…';
        it.tile.querySelector('[data-bar]').style.width = '0%';
      });

      const fd = new FormData();
      chunk.forEach(item => fd.append('images[]', item.blob, 'img.jpg'));

      try {
        const data = await sendBatch(fd, (loaded, size, sent) => {
          const frac = sent ? 1 : loaded / size;
          // The last ~3% is held for the server's "saving" step
          const pct = ((doneBytes + chunkBytes * frac) / totalBytes) * 97;
          const showing = Math.min(total, doneCount + Math.max(1, Math.ceil(chunk.length * frac)));
          progress.set(pct,
            sent ? 'Saving on the server…' : `Uploading ${showing} of ${total} ${word(total)}…`,
            sent ? `Almost there — storing ${chunk.length} ${word(chunk.length)}${batchText(batchNo)}` : `${(((doneBytes + chunkBytes * frac)) / 1048576).toFixed(1)} of ${(totalBytes / 1048576).toFixed(1)} MB${batchText(batchNo)}`);
          finalBtn.textContent = sent ? 'Saving…' : `Uploading ${Math.round(pct)}%`;
          chunk.forEach(it => { it.tile.querySelector('[data-bar]').style.width = `${Math.round(frac * 100)}%`; });
        });

        if (!data.success) throw new Error(data.messages?.[0] || data.message || 'The server could not save these pictures.');

        // 🍊 FIX: Check for 'files' OR 'uploadedFiles' to match your PHP response
        const newFiles = data.files || data.uploadedFiles || [];
        allUploadedFiles.push(...newFiles);
        // Owner-only picture endpoints (adverts/quotations/listings) also
        // return a freshly-rendered cardHtml reflecting every picture
        // uploaded so far — the last batch's is the complete, current state.
        if (data.cardHtml) lastCardHtml = data.cardHtml;

        // Done with these: out of the grid AND the list, so a retry after a
        // later batch fails doesn't send them twice
        chunk.forEach(item => item.tile.remove());
        const sentIds = new Set(chunk.map(it => it.id));
        items = items.filter(it => !sentIds.has(it.id));
        doneBytes += chunkBytes;
        doneCount += chunk.length;
      } catch (e) {
        const left = total - doneCount;
        progress.set((doneBytes / totalBytes) * 100, 'Upload stopped',
          `${e.message} ${doneCount ? `${doneCount} ${word(doneCount)} saved; ` : ''}${left} still to go — press Retry to send ${left === 1 ? 'it' : 'them'}.`,
          { error: true });
        modalEl.querySelector('[data-clear]').disabled = false;
        progress.lockTiles(false);
        readyItems.forEach(it => { if (it.tile.isConnected) { it.tile.classList.remove('opacity-60'); it.tile.querySelector('[data-status]').textContent = 'Not sent'; } });
        // Whatever did make it is already saved — let the page show it
        if (allUploadedFiles.length) onComplete(allUploadedFiles, lastCardHtml);
        finalBtn.textContent = `Retry (${left})`;
        finalBtn.disabled = false;
        return;
      }
    }

    progress.set(100, `Done — ${total} ${word(total)} uploaded`, '');
    items.forEach(i => i.tile.remove()); // Physically remove tiles
    items = [];
    updateUI();
    onComplete(allUploadedFiles, lastCardHtml);
    // A beat on 100% so the finish registers, then close
    setTimeout(() => { progress.show(false); closeHandler(); }, 600);
  };

  dropZone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => handleFiles(e.target.files);
  modalEl.querySelector('[data-clear]').onclick = () => {
    items.forEach(i => i.tile.remove());
    items = [];
    updateUI();
  };
}