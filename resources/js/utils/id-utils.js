// /resources/js/utils/id-utils.js
// --------------------------------------------------------------------------
// Utility functions for encoding and decoding numeric IDs
// into a URL-safe Base64 format (matches PHP IdEncoder behavior).
// --------------------------------------------------------------------------

function encodeId(id) {
  if (id == null) return '';
  try {
    const b64 = btoa(id.toString());
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error('Failed to encode ID:', id, e);
    return '';
  }
}

function decodeId(encodedId) {
  if (!encodedId) return null;
  try {
    const base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
    return atob(base64);
  } catch (e) {
    console.error('Failed to decode ID:', encodedId, e);
    return null;
  }
}

function safeDecodeId(id) {
  if (id == null) return '';
  if (typeof id === 'number') return id.toString();
  const decoded = decodeId(id);
  return decoded !== null ? decoded : id;
}

export const IdUtils = {
  encodeId,
  decodeId,
  safeDecodeId
};
