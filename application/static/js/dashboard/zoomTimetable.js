/* ---------- 1. Inject Timetable Zoom Modal (once) ---------- */
(function injectTimetableZoomModal() {
  if (document.getElementById("timetable-zoom-modal")) return;

  const modal = document.createElement("div");
  modal.id = "timetable-zoom-modal";
  Object.assign(modal.style, {
    display: "none",
    position: "fixed",
    inset: "0",
    width: "100vw",
    height: "100vh",
    background: "rgba(37,42,51,.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: "10000",
    overflow: "auto",
    padding: "1rem"
  });

  modal.innerHTML = `
    <div style="position:relative;max-width:90vw;max-height:90vh;margin:auto;">
      <button id="timetable-zoom-close"
              style="position:absolute;top:-16px;right:-16px;
                     width:32px;height:32px;
                     border:none;border-radius:50%;
                     background:#fff;font-size:1.2em;
                     cursor:pointer">
        ×
      </button>
      <img id="timetable-zoom-img" 
           style="display:block;max-width:100%;height:auto;border-radius:4px;box-shadow:0 0 10px rgba(0,0,0,0.5);" />
    </div>`;

  document.body.appendChild(modal);

  // close handler
  modal.querySelector("#timetable-zoom-close").onclick = () => {
    modal.style.display = "none";
  };
})();

/* ---------- 2. Wire Up the Zoom Button ---------- */
const zoomBtn = document.getElementById("zoom-timetable");
const modal   = document.getElementById("timetable-zoom-modal");
const img     = document.getElementById("timetable-zoom-img");

zoomBtn?.addEventListener("click", async () => {
  const node = document.getElementById("timetable-container");
  if (!node) return;

  // render the timetable node to a canvas
  const canvas = await html2canvas(node, {
    backgroundColor: "#252a33",
    scale: Math.min(window.devicePixelRatio, 2),
    useCORS: true
  });

  // put the image into our modal
  img.src = canvas.toDataURL("image/png");
  modal.style.display = "flex";
});
