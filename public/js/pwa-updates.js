// Shared by browser tabs and installed desktop/mobile windows.
(() => {
  if (!('serviceWorker' in navigator)) return;
  let registration, checking = false, lastCheck = 0;
  let controlled = Boolean(navigator.serviceWorker.controller), pending = false, reloading = false, dirty = false;
  const checkInterval = 60000;
  function applyUpdate() {
    if (!pending || reloading || document.hidden || !navigator.onLine) return;
    // Navigation loads the new release naturally; never discard an order or draft.
    if (dirty || ['/checkout', '/builder'].includes(location.pathname) ||
        document.querySelector('form button[type="submit"]:disabled, #place-order:disabled')) return;
    reloading = true;
    location.reload();
  }
  for (const event of ['input', 'change']) document.addEventListener(event, e => {
    if (e.target.closest('form, [contenteditable="true"]')) dirty = true;
  }, true);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) pending = true;
    controlled = true;
    applyUpdate();
  });
  async function checkUpdate() {
    applyUpdate();
    if (!registration || checking || document.hidden || !navigator.onLine || Date.now() - lastCheck < 15000) return;
    checking = true;
    lastCheck = Date.now();
    try { await registration.update(); } catch { /* Retry after reconnect or the next check. */ }
    finally { checking = false; }
  }
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(value => {
    registration = value;
    checkUpdate();
  }).catch(() => {});
  document.addEventListener('visibilitychange', checkUpdate);
  window.addEventListener('focus', checkUpdate);
  window.addEventListener('online', checkUpdate);
  setInterval(checkUpdate, checkInterval);
})();
