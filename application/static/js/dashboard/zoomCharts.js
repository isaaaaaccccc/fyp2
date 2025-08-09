/* ============================================================================
   Zoom / Full-screen helper for Chart.js canvases
   - If a .zoom-btn already exists in the chart-box (new HTML template),
     we only attach the click handler.
   - Otherwise we create one, place it inside .chart-actions, and wire it up.
   ========================================================================== */

/* ---------- 1. Modal skeleton (inserted once) ---------- */
(function injectZoomModal() {
  const modal = document.createElement("div");
  modal.id = "chart-zoom-modal";
  Object.assign(modal.style, {
    display: "none",
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(37,42,51,.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "10000"
  });
  modal.innerHTML = `
    <div style="position:relative;max-width:90vw;max-height:90vh;">
      <button id="zoom-close-btn"
              style="position:absolute;top:-16px;right:-16px;width:32px;height:32px;
                     border:none;border-radius:50%;background:#fff;font-size:1.2em;cursor:pointer">
        ×
      </button>
      <canvas id="zoom-canvas"></canvas>
    </div>`;
  document.body.appendChild(modal);
  /** close handler */
  modal.querySelector("#zoom-close-btn").onclick = () => (modal.style.display = "none");
})();

/* ---------- 2. Core zoom renderer ---------- */
function showZoom(canvas) {
  const zoomCanvas = document.getElementById("zoom-canvas");
  const modal      = document.getElementById("chart-zoom-modal");
  const ctx        = zoomCanvas.getContext("2d");

  const scale = window.devicePixelRatio || 1;
  const w     = canvas.width;
  const h     = canvas.height;

  zoomCanvas.width  = w * scale;
  zoomCanvas.height = h * scale;
  Object.assign(zoomCanvas.style, { width: `${w}px`, height: `${h}px` });

  ctx.fillStyle = "#252a33";
  ctx.fillRect(0, 0, zoomCanvas.width, zoomCanvas.height);
  ctx.drawImage(canvas, 0, 0, w, h, 0, 0, zoomCanvas.width, zoomCanvas.height);

  modal.style.display = "flex";
}

/* ---------- 3. Public helpers (safe idempotent) ---------- */
export function addZoomButton(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const wrapper     = canvas.parentElement;
  const actionBar   = wrapper.querySelector(".chart-actions") || wrapper;
  let   btn         = wrapper.querySelector(".zoom-btn");

  if (!btn) {
    btn           = document.createElement("button");
    btn.className = "btn-chart zoom-btn";
    btn.innerHTML = `<i class="bi bi-search"></i>`;
    actionBar.appendChild(btn);
  }

  /* prevent duplicate listeners */
  if (!btn.dataset.bound) {
    btn.addEventListener("click", () => showZoom(canvas));
    btn.dataset.bound = "1";
  }
}

export function wireZoomAll(chartIds = []) {
  chartIds.forEach(addZoomButton);
}

/* ---------- 4. Auto-bind any buttons already in the HTML ---------- */
document.querySelectorAll(".zoom-btn").forEach(btn => {
  const canvas = btn.closest(".chart-box")?.querySelector("canvas");
  if (canvas && !btn.dataset.bound) {
    btn.addEventListener("click", () => showZoom(canvas));
    btn.dataset.bound = "1";
  }
});
