// static/js/dashboard/headerTabs.js
document.addEventListener('DOMContentLoaded', () => {
  const headerTabs = document.getElementById('header-tabs');
  const tabButtons = Array.from(headerTabs.querySelectorAll('.hdr-tab'));
  const sections   = tabButtons.map(btn => document.getElementById(btn.dataset.target));

  tabButtons.forEach(btn =>
    btn.addEventListener('click', () =>
      document.getElementById(btn.dataset.target)
              .scrollIntoView({ behavior: 'smooth', block: 'start' })
    )
  );

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tabButtons.forEach(b =>
          b.classList.toggle('active', b.dataset.target === entry.target.id)
        );
      }
    });
  }, {
    root: null,
    rootMargin: '0px 0px -55% 0px',
    threshold: 0.25
  });

  sections.forEach(sec => sec && observer.observe(sec));
});
