/* ============================================================================
   Per-chart PNG exporter + “export all to ZIP” helper
   - Uses class .dl-btn if present in the HTML. If not, adds one inside
     .chart-actions so we never duplicate buttons.
   ========================================================================== */

const EXPORT_SCALE = 2;              /* higher-res multiplier */

/* ---------- 1. Single-chart saver ---------- */
export function downloadChartById(canvasId, filename = `${canvasId}.png`) {
  const src   = document.getElementById(canvasId);
  const chart = Chart.getChart(src);     // global Chart.js
  if (!chart) return;

  const w = src.width, h = src.height;

  const out = document.createElement("canvas");
  out.width  = w * EXPORT_SCALE;
  out.height = h * EXPORT_SCALE;
  const ctx = out.getContext("2d");

  ctx.fillStyle = "#252a33";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(src, 0, 0, w, h, 0, 0, out.width, out.height);

  const link = document.createElement("a");
  link.href      = out.toDataURL("image/png");
  link.download  = filename;
  link.click();
}

/* ---------- 2. Per-chart export button ---------- */
export function addPerChartExport(canvasId) {
  const canvas     = document.getElementById(canvasId);
  if (!canvas) return;

  const wrapper   = canvas.parentElement;
  const actionBar = wrapper.querySelector(".chart-actions") || wrapper;

  let btn = wrapper.querySelector(".dl-btn");
  if (!btn) {
    btn           = document.createElement("button");
    btn.className = "btn-chart dl-btn";
    btn.innerHTML = `<i class="bi bi-download"></i>`;
    actionBar.appendChild(btn);
  }

  if (!btn.dataset.bound) {
    btn.addEventListener("click", () =>
      downloadChartById(canvasId, `${canvasId}.png`)
    );
    btn.dataset.bound = "1";
  }
}

/* ---------- 3. Bulk ZIP exporter (button lives elsewhere in DOM) ---------- */
export function wireExportAll(buttonId, chartIds = []) {
  const trigger = document.getElementById(buttonId);
  if (!trigger || typeof JSZip === "undefined") return;

  trigger.addEventListener("click", async () => {
    const zip = new JSZip();

    await Promise.all(
      chartIds.map(async id => {
        const src   = document.getElementById(id);
        const chart = Chart.getChart(src);
        if (!chart) return;

        const w = src.width, h = src.height;
        const out = document.createElement("canvas");
        out.width  = w * EXPORT_SCALE;
        out.height = h * EXPORT_SCALE;
        const ctx = out.getContext("2d");

        ctx.fillStyle = "#252a33";
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(src, 0, 0, w, h, 0, 0, out.width, out.height);

        const base64 = out.toDataURL("image/png").split(",")[1];
        zip.file(`${id}.png`, base64, { base64: true });
      })
    );

    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "charts.zip";
    a.click();
    URL.revokeObjectURL(url);
  });
}

/* ---------- 4. Auto-bind existing .dl-btns ---------- */
document.querySelectorAll(".dl-btn").forEach(btn => {
  const canvas = btn.closest(".chart-box")?.querySelector("canvas");
  if (canvas && !btn.dataset.bound) {
    btn.addEventListener("click", () =>
      downloadChartById(canvas.id, `${canvas.id}.png`)
    );
    btn.dataset.bound = "1";
  }
});
