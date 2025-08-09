// static/js/dashboard/uiToggles.js
document.addEventListener('DOMContentLoaded', () => {
  // ─── Tooltips ───────────────────────────────────────────────────
  document
    .querySelectorAll('[data-bs-toggle="tooltip"]')
    .forEach(el => new bootstrap.Tooltip(el));

  // ─── KPI / Analytics / Timetable highlight toggles ───────────────
  ['toggle-kpi', 'toggle-analytics', 'toggle-timetable'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => btn.classList.toggle('is-active'));
    }
  });

  // ─── Scroll to Top ────────────────────────────────────────────────
  const scrollBtn = document.getElementById('scrollToTopBtn');
  if (!scrollBtn) return;

  // Helper: get current scroll position (cross‑browser)
  function getScrollPos() {
    return window.pageYOffset
      || document.documentElement.scrollTop
      || document.body.scrollTop
      || 0;
  }

  // Show/hide the button when scrolled beyond 200px
  function toggleScrollBtn() {
    scrollBtn.classList.toggle('show', getScrollPos() > 200);
  }

  // On window scroll, update visibility
  window.addEventListener('scroll', toggleScrollBtn, { passive: true });

  // On click, scroll both <html> and <body> back to top
  scrollBtn.addEventListener('click', () => {
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Initialize button state
  toggleScrollBtn();
});
