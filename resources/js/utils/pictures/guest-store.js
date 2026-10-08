// /resources/js/utils/pictures/guest-store.js
//
// Guest (try-it) mode for Pictures: the gallery lives only in this browser —
// captions / favourites / emojis / comments in localStorage, the photos themselves (resized to
// 1600px JPEGs) in IndexedDB. Nothing is uploaded. The sample gallery uses
// the site's own home-page photos. handle() answers like
// server/api/pictures.php (same validation and shapes).

const KEY = 'catscript.pictures.guest.v1';
const DB = 'catscript-guest-pictures';
const MAX_DIM = 1600;
let memory = null;
let list = null;          // [{id, src: 'sample:<url>' | 'idb', caption, favourite, date, reactions?, comments?}]
const urls = new Map();   // id -> object URL for IndexedDB photos

const uid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ok = (messages, extra = {}) => ({ success: true, messages: [].concat(messages), ...extra });
const fail = (messages) => ({ success: false, messages: [].concat(messages) });

function read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memory; } }
function write() { memory = list; try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* memory only */ } }

// --- IndexedDB (photo blobs) ---------------------------------
function db() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error('This browser can’t store photos.')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('photos');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('photos', mode);
    const out = fn(tx.objectStore('photos'));
    tx.oncomplete = () => resolve(out?.result);
    tx.onerror = () => reject(tx.error);
  });
}

async function shrink(file) {
  const bitmap = await createImageBitmap(file);
  const r = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * r);
  canvas.height = Math.round(bitmap.height * r);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.85));
}

function present(p) {
  return {
    encoded_id: p.id,
    url: p.src.startsWith('sample:') ? p.src.slice(7) : (urls.get(p.id) || ''),
    caption: p.caption || '',
    favourite: !!p.favourite,
    date: p.date,
    reactions: [...(p.reactions || [])],
    comments: (p.comments || []).map((c) => ({ ...c })),
  };
}

function sample(slides) {
  const captions = ['Morning walk', 'Backyard in bloom', 'Weekend view', 'First snow', 'Evening light', 'Neighbourhood'];
  const reactions = [['😍', '☀️'], ['🌸'], [], ['🥶', '❄️']];
  const comments = { 0: 'Best morning of the week.', 3: 'The kids were out in it for hours!' };
  return slides.slice(0, 12).map((src, i) => ({
    id: uid(), src: `sample:${src}`, caption: captions[i % captions.length], favourite: i < 2, date: ago(i * 9 + 1),
    reactions: reactions[i] || [],
    comments: comments[i] ? [{ id: uid(), body: comments[i], at: new Date(Date.now() - (i + 1) * 86400000).toISOString() }] : [],
  }));
}

export const guestPictures = {
  /** The gallery (newest first), loading any stored photos from IndexedDB. */
  async load(slides = []) {
    const saved = read();
    list = Array.isArray(saved) ? saved : sample(slides);
    if (!saved) write();
    await Promise.all(list.filter((p) => p.src === 'idb' && !urls.has(p.id)).map(async (p) => {
      try {
        const blob = await idb('readonly', (s) => s.get(p.id));
        if (blob) urls.set(p.id, URL.createObjectURL(blob));
      } catch { /* missing photo */ }
    }));
    list = list.filter((p) => p.src !== 'idb' || urls.has(p.id));
    return list.map(present);
  },

  /** Store picked files (resized) and return them as pictures. */
  async add(files) {
    const added = [];
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const blob = await shrink(file);
        const id = uid();
        await idb('readwrite', (s) => s.put(blob, id));
        urls.set(id, URL.createObjectURL(blob));
        const p = { id, src: 'idb', caption: '', favourite: false, date: today() };
        list.unshift(p);
        added.push(present(p));
      } catch { /* skip files the browser can't read */ }
    }
    write();
    return added;
  },

  async resetToSample(slides) {
    await this.clear();
    list = sample(slides);
    write();
    return list.map(present);
  },

  async clear() {
    try { await idb('readwrite', (s) => s.clear()); } catch { /* nothing stored */ }
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls.clear();
    list = [];
    write();
    return [];
  },

  /** Answer a POST body the way server/api/pictures.php would. */
  async handle(b) {
    const action = String(b._method || '').toUpperCase();
    const ids = b.ids || (b.id ? [b.id] : []);
    if (action === 'DELETE') {
      const gone = list.filter((p) => ids.includes(p.id));
      if (!gone.length) return fail('Picture not found.');
      for (const p of gone) {
        if (p.src === 'idb') { try { await idb('readwrite', (s) => s.delete(p.id)); } catch { /* already gone */ } URL.revokeObjectURL(urls.get(p.id)); urls.delete(p.id); }
      }
      list = list.filter((p) => !ids.includes(p.id));
      write();
      return ok(gone.length === 1 ? 'Picture deleted.' : `${gone.length} pictures deleted.`, { deleted: gone.map((p) => p.id) });
    }
    if (action === 'PATCH' && b.ids) {
      const hit = list.filter((p) => ids.includes(p.id));
      hit.forEach((p) => { p.favourite = !!b.favourite; });
      write();
      return ok(b.favourite ? 'Added to favourites.' : 'Removed from favourites.', { pictures: hit.map(present) });
    }
    if (action === 'PATCH') {
      const p = list.find((x) => x.id === b.id);
      if (!p) return fail('Picture not found.');
      if ('caption' in b) {
        const c = String(b.caption).trim();
        if (c.length > 500) return fail('Captions must be 500 characters or fewer.');
        p.caption = c;
      }
      if ('favourite' in b) p.favourite = !!b.favourite;
      write();
      return ok('Picture updated.', { picture: present(p) });
    }
    if (action === 'REACT' || action === 'COMMENT' || action === 'UNCOMMENT') {
      const p = list.find((x) => x.id === b.id);
      if (!p) return fail('Picture not found.');
      if (action === 'REACT') {
        const emoji = String(b.emoji || '').trim();
        if (!emoji || emoji.length > 16) return fail('Pick an emoji.');
        p.reactions = p.reactions || [];
        const had = p.reactions.includes(emoji);
        if (!had && p.reactions.length >= 12) return fail('A picture can hold up to 12 emojis — take one off first.');
        p.reactions = had ? p.reactions.filter((e) => e !== emoji) : [...p.reactions, emoji];
        write();
        return ok(had ? 'Emoji removed.' : 'Emoji added.', { picture: present(p) });
      }
      if (action === 'COMMENT') {
        const body = String(b.body || '').trim();
        if (!body) return fail('Write something first.');
        if (body.length > 1000) return fail('Comments must be 1000 characters or fewer.');
        p.comments = [...(p.comments || []), { id: uid(), body, at: new Date().toISOString() }];
        write();
        return ok('Comment added.', { picture: present(p) });
      }
      const before = (p.comments || []).length;
      p.comments = (p.comments || []).filter((c) => c.id !== b.comment_id);
      if (p.comments.length === before) return fail('Comment not found.');
      write();
      return ok('Comment deleted.', { picture: present(p) });
    }
    return fail('No pictures received.');
  },
};
