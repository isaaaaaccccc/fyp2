// static/js/dashboard/downloads.js

document.addEventListener('DOMContentLoaded', () => {
  const downloadPngBtn   = document.getElementById('download-png-btn');
  const downloadExcelBtn = document.getElementById('download-excel-btn');
  const downloadPdfBtn   = document.getElementById('download-pdf-btn');
  const downloadModalEl  = document.getElementById('downloadModal');
  const downloadModal    = bootstrap.Modal.getOrCreateInstance(downloadModalEl);
  let exportTarget = 'full', pendingFmt = null;

  document.getElementById('download-full')?.addEventListener('click', () => exportTarget = 'full');
  document.getElementById('export-coaches')?.addEventListener('click', () => exportTarget = 'coaches');

  function queueDownload(fmt) { pendingFmt = fmt; downloadModal.hide(); }
  [downloadPngBtn, downloadExcelBtn, downloadPdfBtn].forEach(el => {
    el?.addEventListener('click', () => queueDownload(el.dataset.format));
    el?.addEventListener('keypress', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        queueDownload(el.dataset.format);
      }
    });
  });

  downloadModalEl.addEventListener('hidden.bs.modal', () => {
    if (!pendingFmt) return;
    setTimeout(() => {
      const fn = exportTarget === 'full'
        ? 'downloadTimetableAs'
        : 'downloadAllCoachesAs';

      // normalize the suffix to match your exported names
      const suffixMap = {
        png:   'PNG',
        pdf:   'PDF',
        excel: 'Excel'
      };
      const suffix = suffixMap[pendingFmt] || pendingFmt;
      const methodName = fn + suffix;

      window[methodName]?.();
      pendingFmt = null;
    }, 200);
  });
});
