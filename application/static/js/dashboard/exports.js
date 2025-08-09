/* eslint-disable no-console */

import { $, WEEK_DAYS, passClass, timePass } from "./dashboard_utils.js";
import renderTimetable from "./timetable.js";

/* ────────────────────────────────────────────────────────────
 *  Lightweight toast
 * ──────────────────────────────────────────────────────────── */
function toast(message, type = "warn") {
  console[type === "error" ? "error" : "warn"](message);

  let host = document.getElementById("export-toast-host");
  if (!host) {
    host = Object.assign(document.createElement("div"), {
      id: "export-toast-host",
      style: `
        position:fixed;top:1rem;right:1rem;z-index:9999;
        display:flex;flex-direction:column;gap:.5rem;`
    });
    document.body.appendChild(host);
  }
  const el = Object.assign(document.createElement("div"), {
    textContent: message,
    style: `
      padding:.55rem .85rem;border-radius:4px;font-size:.85rem;font-weight:600;
      background:${type === "error" ? "rgba(220,53,69,.95)" : "rgba(255,193,7,.95)"};
      color:#111;box-shadow:0 2px 6px rgba(0,0,0,.35);`
  });
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .4s,transform .4s";
    el.style.opacity = 0;
    el.style.transform = "translateY(-6px)";
    setTimeout(() => el.remove(), 450);
  }, 2400);
}

/* ────────────────────────────────────────────────────────────
 *  Small async helpers
 * ──────────────────────────────────────────────────────────── */
const wait      = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
async function ensureLibsReady(retries = 20, delay = 80) {
  for (let i = 0; i < retries; i++) {
    if (typeof html2canvas === "function" && window.jspdf?.jsPDF) return;
    await wait(delay);
  }
  throw new Error("Export libraries not loaded (html2canvas / jsPDF).");
}

/* ────────────────────────────────────────────────────────────
 *  Branch helpers
 * ──────────────────────────────────────────────────────────── */
function getCurrentDisplayedBranch() {
  if (window.currentTimetableDisplayBranch) return window.currentTimetableDisplayBranch;
  const internal = document.getElementById("timetable-branch-select")?.value;
  return internal || document.getElementById("tt-branch-select")?.value || "All";
}
function getEffectiveTimetableBranch() { return getCurrentDisplayedBranch(); }

function buildInfoForBranch(branch) {
  if (!window.allData) return null;

  if (branch === "All") {
    const info = { coaches: [], schedule: {} };
    WEEK_DAYS.forEach(d => (info.schedule[d] = {}));

    Object.values(window.allData).forEach(b => {
      (b.coaches || []).forEach(c => info.coaches.push(c));
      WEEK_DAYS.forEach(d => {
        const dayObj = b.schedule[d] || {};
        Object.entries(dayObj).forEach(([coach, arr]) => {
          (info.schedule[d][coach] ??= []).push(...arr);
        });
      });
    });
    info.coaches = [...new Set(info.coaches)];
    return info;
  }
  return window.allData[branch];
}

/* ────────────────────────────────────────────────────────────
 *  Off-screen timetable utilities
 * ──────────────────────────────────────────────────────────── */
function makeOffscreenContainer() {
  const c = Object.assign(document.createElement("div"), {
    style: `
      position:absolute;top:-100000px;left:-100000px;width:1400px;
      padding:12px;background:#fff;`
  });
  document.body.appendChild(c);
  return c;
}

function buildExportTimetable(branch, day="All", cls="All", coach="All", time="All") {
  const info = buildInfoForBranch(branch);
  if (!info || !info.schedule) return null;

  const off = makeOffscreenContainer();
  try {
    renderTimetable(info, day, cls, coach, time, off, branch, window.allData);
  } catch (e) {
    console.error("[buildExportTimetable] renderTimetable failed:", e);
    off.remove();
    return null;
  }

  const table = off.querySelector(".timetable-table");
  if (!table) { off.remove(); return null; }
  return { container: off, table };
}

async function withTempTimetable(branch, day, cls, coach, time, fn) {
  await ensureLibsReady(); await nextFrame();
  const obj = buildExportTimetable(branch, day, cls, coach, time);
  if (!obj) throw new Error("Offscreen timetable could not be created (maybe no sessions match filters).");

  try { await nextFrame(); await fn(obj.table); }
  finally { obj.container.remove(); }
}

/* ────────────────────────────────────────────────────────────
 *  Light export theme helper
 * ──────────────────────────────────────────────────────────── */
function applyExportLight(tableEl) {
  tableEl.classList.add("export-light");
  // Minimal inline enforcement for any stubborn cells:
  tableEl.querySelectorAll("th,td").forEach(td => {
    td.style.color = "#000";
    td.style.textShadow = "none";
    // Uncomment below if you want to flatten ALL backgrounds:
    // td.style.background = "#fff";
  });
}

/* ────────────────────────────────────────────────────────────
 *  UI toggles
 * ──────────────────────────────────────────────────────────── */
export function toggleTimetable() { $("timetable-wrapper")?.classList.toggle("d-none"); }
export function toggleAnalytics() { $("charts-content")?.classList.toggle("d-none"); }
export function toggleKPI()       { $("kpi-cards")   ?.classList.toggle("d-none"); }

/* ────────────────────────────────────────────────────────────
 *  Timetable → PNG
 * ──────────────────────────────────────────────────────────── */
export async function downloadTimetableAsPNG() {
  const branch = getEffectiveTimetableBranch();
  console.log("[Export PNG] branch:", branch);

  try {
    await withTempTimetable(branch, "All", "All", "All", "All", async (tableEl) => {
      const clone = tableEl.cloneNode(true);
      applyExportLight(clone);
      const shell = makeOffscreenContainer();
      shell.appendChild(clone);
      await nextFrame();

      const canvas = await html2canvas(clone, { backgroundColor:"#fff", scale:2 });
      shell.remove();

      const a = document.createElement("a");
      a.href      = canvas.toDataURL("image/png");
      a.download  = `${branch}_timetable.png`;
      a.click();
    });
  } catch (e) {
    console.error("PNG export error:", e);
    toast("Unable to export PNG: " + e.message, "error");
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
 *  Timetable → Excel
 * ──────────────────────────────────────────────────────────── */
export async function downloadTimetableAsExcel() {
  const branch = getEffectiveTimetableBranch();
  console.log("[Export Excel] branch:", branch);

  try {
    const info = buildInfoForBranch(branch);
    if (!info?.schedule) throw new Error("No timetable schedule available");

    const res = await fetch("/api/export-excel", {
      method : "POST",
      headers: { "Content-Type":"application/json" },
      body   : JSON.stringify(info.schedule)
    });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href      = url;
    a.download  = `${branch}_timetable.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Excel export error:", e);
    toast("Unable to export Excel: " + e.message, "error");
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
 *  Timetable → PDF
 * ──────────────────────────────────────────────────────────── */
export async function downloadTimetableAsPDF() {
  const branch = getEffectiveTimetableBranch();
  console.log("[Export PDF] branch:", branch);

  try {
    await withTempTimetable(branch, "All", "All", "All", "All", async (tableEl) => {
      const clone = tableEl.cloneNode(true);
      applyExportLight(clone);
      const shell = makeOffscreenContainer();
      shell.appendChild(clone);
      await nextFrame();

      const canvas = await html2canvas(clone, { backgroundColor:"#fff", scale:2 });
      shell.remove();

      const img  = canvas.toDataURL("image/png");
      const pdf  = new jspdf.jsPDF("landscape","pt","a4");
      const pw   = pdf.internal.pageSize.getWidth();
      const ph   = pdf.internal.pageSize.getHeight();
      const iw   = canvas.width;
      const ih   = canvas.height;
      const r    = Math.min(pw/iw, ph/ih);

      pdf.addImage(img,"PNG", (pw-iw*r)/2, (ph-ih*r)/2, iw*r, ih*r);
      pdf.save(`${branch}_timetable.pdf`);
    });
  } catch (e) {
    console.error("PDF export error:", e);
    toast("Unable to export PDF: " + e.message, "error");
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
 *  Per-coach PNG ZIP
 * ──────────────────────────────────────────────────────────── */
export async function downloadCoachZip() {
  const branch = getEffectiveTimetableBranch();
  console.log("[Export Coach PNG ZIP] branch:", branch);

  if (branch === "All")
    return toast("Display/select a single branch first.", "warn");

  const info = buildInfoForBranch(branch);
  if (!info?.coaches?.length)
    return toast("No coaches found for branch.", "warn");

  try {
    await ensureLibsReady();
    const zip = new JSZip();

    for (const coach of info.coaches) {
      const hasSessions = WEEK_DAYS.some(d => info.schedule[d]?.[coach]?.length);
      if (!hasSessions) {
        console.warn(`Skip ${coach} – no sessions`);
        continue;
      }

      console.log("  rendering coach:", coach);
      try {
        await withTempTimetable(branch, "All", "All", coach, "All", async (tableEl) => {
          applyExportLight(tableEl);
            // direct tableEl (no clone needed since offscreen already)
          const canvas = await html2canvas(tableEl, { backgroundColor:"#fff", scale:2 });
          zip.file(`${coach}.png`, canvas.toDataURL("image/png").split(",")[1], { base64:true });
        });
      } catch (err) {
        console.warn(`Skip ${coach} – ${err.message}`);
        continue;
      }
      await wait(30);
    }

    const blob = await zip.generateAsync({ type:"blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href      = url;
    a.download  = `${branch}_coach_timetables_png.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Coach PNG ZIP export error:", e);
    toast("Coach PNG export failed: " + e.message, "error");
    throw e;
  }
}
export { downloadCoachZip as downloadAllCoachesAsPNG };

/* ────────────────────────────────────────────────────────────
 *  Summary stats → Excel
 * ──────────────────────────────────────────────────────────── */
export async function exportStats(
  branchValue = getEffectiveTimetableBranch(),
  dayValue    = $("day-filter")?.value || "All",
  classValue  = $("class-filter")?.value || "All",
  coachValue  = $("coach-filter")?.value || "All",
  timeValue   = $("time-filter")?.value || "All"
) {
  console.log("[Export Stats] branch:", branchValue);
  if (!window.allData) {
    toast("Stats not ready – data still loading.", "warn");
    return;
  }

  const info = buildInfoForBranch(branchValue);
  if (!info) {
    toast("No data for export.", "warn");
    return;
  }

  const coaches      = info.coaches || [];
  const summaryRows  = [];
  const classRows    = [];
  const dayRows      = [];
  const timeSlotRows = [];
  const matrixMap    = new Map();

  coaches.forEach(coach => {
    if (coachValue !== "All" && coach !== coachValue) return;
    const sessions = [];

    WEEK_DAYS.forEach(day => {
      if (dayValue !== "All" && day !== dayValue) return;
      const arr = info.schedule[day]?.[coach] || [];
      arr
        .filter(s => passClass(classValue, s) && timePass(timeValue, s))
        .forEach(s => {
          const hh = +s.start_time.slice(0, 2);
          const mm = +s.start_time.slice(2);
          const startTotal = hh * 60 + mm;
          const endTotal = startTotal + s.duration * 60;
          const endHH = String(Math.floor(endTotal / 60)).padStart(2, "0");
          const endMM = String(endTotal % 60).padStart(2, "0");
          sessions.push({
            day,
            cls: s.name,
            dur: s.duration,
            start: s.start_time,
            end: `${endHH}${endMM}`
          });
        });
    });

    if (!sessions.length) return;

    const totalSessions = sessions.length;
    const totalDur = sessions.reduce((sum, x) => sum + x.dur, 0);
    const avgDur = (totalDur / totalSessions).toFixed(1);
    const minDur = Math.min(...sessions.map(s => s.dur));
    const maxDur = Math.max(...sessions.map(s => s.dur));
    const daysWorked = new Set(sessions.map(s => s.day)).size;
    const totalHrs = (totalDur / 60).toFixed(1);
    const earliest = [...sessions].sort((a, b) => a.start.localeCompare(b.start))[0].start;
    const latest = [...sessions].sort((a, b) => b.end.localeCompare(a.end))[0].end;

    const freqClass = {};
    const freqDay = {};
    sessions.forEach(s => {
      freqClass[s.cls] = (freqClass[s.cls] || 0) + 1;
      freqDay[s.day] = (freqDay[s.day] || 0) + 1;
    });

    const mostFreqClass = Object.entries(freqClass).sort((a, b) => b[1] - a[1])[0][0];
    const mostFreqDay = Object.entries(freqDay).sort((a, b) => b[1] - a[1])[0][0];

    summaryRows.push({
      Coach: coach,
      "Total Sessions": totalSessions,
      "Avg Duration (min)": avgDur,
      "Min Duration (min)": minDur,
      "Max Duration (min)": maxDur,
      "Total Duration (hrs)": totalHrs,
      "Days Worked": daysWorked,
      "Earliest Start": earliest,
      "Latest End": latest,
      "Most Frequent Class": mostFreqClass,
      "Most Frequent Day": mostFreqDay,
      "Unique Classes Taught": Object.keys(freqClass).length
    });

    Object.entries(freqClass).forEach(([cls, count]) =>
      classRows.push({ Coach: coach, Class: cls, Sessions: count })
    );
    Object.entries(freqDay).forEach(([d, count]) =>
      dayRows.push({ Coach: coach, Day: d, Sessions: count })
    );

    sessions.forEach(s => {
      let slot = "Other";
      const hour = +s.start.slice(0, 2);
      if (hour >= 8 && hour < 12) slot = "Morning (8–12)";
      else if (hour >= 12 && hour < 17) slot = "Afternoon (12–5)";
      else if (hour >= 17 && hour < 21) slot = "Evening (5–9)";
      timeSlotRows.push({ Coach: coach, "Time Slot": slot, Sessions: 1 });
    });

    sessions.forEach(s => {
      const key = `${coach}::${s.cls}`;
      if (!matrixMap.has(key)) matrixMap.set(key, { Coach: coach, Class: s.cls });
      matrixMap.get(key)[s.day] = (matrixMap.get(key)[s.day] || 0) + 1;
    });
  });

  const slotCounts = {};
  timeSlotRows.forEach(r => {
    const key = `${r.Coach}::${r["Time Slot"]}`;
    slotCounts[key] = (slotCounts[key] || 0) + 1;
  });
  const timeSlotFinal = Object.entries(slotCounts).map(([k, v]) => {
    const [coach, slot] = k.split("::");
    return { Coach: coach, "Time Slot": slot, Sessions: v };
  });

  const matrixSheet = Array.from(matrixMap.values()).map(r => {
    WEEK_DAYS.forEach(d => (r[d] = r[d] || 0));
    return r;
  });

  try {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows),  "Summary");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(classRows),    "By Class");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows),      "By Day");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timeSlotFinal),"By Time Slot");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrixSheet),  "Day-Class Matrix");
    XLSX.writeFile(wb, `${branchValue}_coach_stats.xlsx`);
  } catch (e) {
    console.error("Stats export error:", e);
    toast("Stats export failed: " + e.message, "error");
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
 *  All-coaches → Excel ZIP
 * ──────────────────────────────────────────────────────────── */
export async function downloadAllCoachesAsExcel() {
  const branch = getEffectiveTimetableBranch();
  console.log("[Export All Coaches Excel] branch:", branch);

  if (branch === "All")
    return toast("Display/select a single branch first.", "warn");

  const info = buildInfoForBranch(branch);
  if (!info?.coaches?.length)
    return toast("No coaches for this branch.", "warn");

  try {
    const zip = new JSZip();

    for (const coach of info.coaches) {
      const coachSchedule = {};
      WEEK_DAYS.forEach(day => {
        const arr = info.schedule[day]?.[coach];
        if (arr?.length) coachSchedule[day] = { [coach]: arr };
      });
      if (Object.keys(coachSchedule).length === 0) {
        console.warn(`Skip ${coach} – no sessions`);
        continue;
      }

      const res = await fetch("/api/export-coach-excel", {
        method : "POST",
        headers: { "Content-Type":"application/json" },
        body   : JSON.stringify({ schedule: coachSchedule, coaches:[coach] })
      });
      if (!res.ok) throw new Error(`Export failed for ${coach} (status ${res.status})`);
      zip.file(`${coach}.xlsx`, await res.arrayBuffer());
      await wait(20);
    }

    const blob = await zip.generateAsync({ type:"blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href      = url;
    a.download  = `${branch}_all_coaches_excel.zip`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("All coaches Excel export error:", e);
    toast("Coach Excel export failed: " + e.message, "error");
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
 *  All‑coaches → PDF ZIP  (memory‑friendly version)
 * ──────────────────────────────────────────────────────────── */
export async function downloadAllCoachesAsPDF() {
  const branch = getEffectiveTimetableBranch();
  console.log("[Export All Coaches PDF ZIP] branch:", branch);

  if (branch === "All")
    return toast("Display/select a single branch first.", "warn");

  const info = buildInfoForBranch(branch);
  if (!info?.coaches?.length)
    return toast("No coaches for this branch.", "warn");

  try {
    await ensureLibsReady();
    const zip = new JSZip();

    for (const coach of info.coaches) {
      const hasSessions = WEEK_DAYS.some(d => info.schedule[d]?.[coach]?.length);
      if (!hasSessions) {
        console.warn(`Skip ${coach} – no sessions`);
        continue;
      }

      console.log("  rendering coach:", coach);
      try {
        await withTempTimetable(branch, "All", "All", coach, "All", async (tableEl) => {
          applyExportLight(tableEl);

          /* 1️⃣   lower‑resolution canvas (scale 1) */
          const canvas = await html2canvas(tableEl, { backgroundColor:"#fff", scale:1 });

          /* 2️⃣   Canvas → JPEG‑inside‑PDF (smaller) */
          const pdf  = new jspdf.jsPDF("landscape","pt","a4");
          const img  = canvas.toDataURL("image/jpeg", 0.85);
          const pw   = pdf.internal.pageSize.getWidth();
          const ph   = pdf.internal.pageSize.getHeight();
          const iw   = canvas.width;
          const ih   = canvas.height;
          const r    = Math.min(pw/iw, ph/ih);

          pdf.addImage(img,"JPEG",(pw-iw*r)/2,(ph-ih*r)/2, iw*r, ih*r);

          /* 3️⃣   Use arraybuffer + binary flag */
          zip.file(`${coach}.pdf`, pdf.output("arraybuffer"), { binary:true });
        });
      } catch (err) {
        console.warn(`Skip ${coach} – ${err.message}`);
        continue;
      }

      /* 4️⃣   Yield to event loop to keep memory pressure down */
      await wait(80);
    }

    console.log("Generating ZIP …");
    const blob = await zip.generateAsync(
      { type:"blob", compression:"DEFLATE" },
      (meta) => {
        if ((meta.percent|0) % 10 === 0) {       // log every 10 %
          console.log(`  ${meta.percent.toFixed(1)} %`);
        }
      }
    );
    console.log("ZIP ready:", (blob.size/1e6).toFixed(1), "MB");

    const url = URL.createObjectURL(blob);
    requestAnimationFrame(() => {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${branch}_all_coaches_pdf.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  } catch (e) {
    console.error("All coaches PDF export error:", e);
    toast("Coach PDF export failed: " + e.message, "error");
    throw e;
  }
}

/* ────────────────────────────────────────────────────────────
 *  Expose helpers
 * ──────────────────────────────────────────────────────────── */
window.downloadTimetableAsPNG    = downloadTimetableAsPNG;
window.downloadTimetableAsExcel  = downloadTimetableAsExcel;
window.downloadTimetableAsPDF    = downloadTimetableAsPDF;
window.downloadAllCoachesAsPNG   = downloadCoachZip;
window.downloadAllCoachesAsExcel = downloadAllCoachesAsExcel;
window.downloadAllCoachesAsPDF   = downloadAllCoachesAsPDF;
window.exportStats               = exportStats;
window.toggleTimetable           = toggleTimetable;
window.toggleAnalytics           = toggleAnalytics;
window.toggleKPI                 = toggleKPI;
