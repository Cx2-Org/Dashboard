// Két token: mã hoá token GitHub bằng mật khẩu (PBKDF2-SHA256 250k vòng → AES-GCM 256), chỉ lưu bản mã trong máy người xem.
(function (root) {
'use strict';
const C = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto);
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => btoa(String.fromCharCode(...u8));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const ITER = 250000;

async function keyFrom(password, salt) {
  const base = await C.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return C.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, base,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// Trả { blob (để lưu), key (CryptoKey không xuất được — để "ghi nhớ") }.
async function seal(user, token, password) {
  const salt = C.getRandomValues(new Uint8Array(16)), iv = C.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(`${user}\n${password}`, salt);
  const ct = new Uint8Array(await C.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));
  return { blob: { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) }, key };
}

// Sai tên/mật khẩu → ném lỗi (AES-GCM kiểm toàn vẹn).
async function unlock(blob, user, password) {
  const key = await keyFrom(`${user}\n${password}`, unb64(blob.salt));
  return { token: await openWith(blob, key), key };
}

async function openWith(blob, key) {
  const pt = await C.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return dec.decode(pt);
}

const api = { seal, unlock, openWith };
if (typeof module !== 'undefined') module.exports = api; else root.Vault = api;
})(typeof window !== 'undefined' ? window : globalThis);
