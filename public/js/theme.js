(function () {
  const key = 'bella_theme';
  let theme = 'light';
  try { theme = localStorage.getItem(key) === 'dark' ? 'dark' : 'light'; } catch { /* Theme still works when storage is unavailable. */ }
  const icons = {
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>'
  };
  function apply(value) {
    theme = value;
    document.documentElement.dataset.theme = value;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', value === 'light' ? '#FFFFFF' : '#0D0908');
    const button = document.getElementById('theme-toggle');
    if (!button) return;
    let arabic = document.documentElement.lang === 'ar';
    try { arabic = localStorage.getItem('bella_language') === 'ar'; } catch {}
    const label = value === 'light'
      ? (arabic ? 'تفعيل الوضع الداكن' : 'Switch to dark mode')
      : (arabic ? 'تفعيل الوضع الفاتح' : 'Switch to light mode');
    button.innerHTML = icons[value === 'light' ? 'dark' : 'light'];
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(value === 'light'));
  }
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    apply(theme);
    document.getElementById('theme-toggle')?.addEventListener('click', () => {
      apply(theme === 'dark' ? 'light' : 'dark');
      try { localStorage.setItem(key, theme); } catch {}
    });
  });
  window.addEventListener('storage', event => { if (event.key === key) apply(event.newValue === 'light' ? 'light' : 'dark'); });
})();
