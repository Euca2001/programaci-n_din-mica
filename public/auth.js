'use strict';

function getAuthHeader() {
  const creds = sessionStorage.getItem('auth');
  return creds ? { Authorization: `Basic ${creds}` } : {};
}

function requireAuth() {
  if (!sessionStorage.getItem('auth')) {
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?redirect=${redirect}`;
    return false;
  }
  return true;
}

function saveAuth(user, pass) {
  sessionStorage.setItem('auth', btoa(`${user}:${pass}`));
}

function logout() {
  sessionStorage.removeItem('auth');
  window.location.href = '/login';
}

async function authFetch(url, options = {}) {
  const headers = { ...getAuthHeader(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    sessionStorage.removeItem('auth');
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?redirect=${redirect}`;
    throw new Error('No autorizado');
  }

  return res;
}

async function downloadFile(id, filename) {
  const res = await authFetch(`/api/files/${id}/download`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
