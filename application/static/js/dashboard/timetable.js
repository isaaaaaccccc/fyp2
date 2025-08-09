// static/js/dashboard/timetable.js
import { $, WEEK_DAYS, CLASS_COLORS, passClass, timePass } from "./dashboard_utils.js";

/**
 * Render the timetable for ONE branch.
 * If the global branch filter = "All", the pager (currentTimetablePageBranch) decides which branch is shown.
 */
export default function renderTimetable(
  info,
  dayVal,
  clsVal,
  coachVal,
  timeVal,
  container,
  branchValue,
  allData
) {
  container = container || $("timetable-container");
  if (!container) {
    console.error("Timetable container not found.");
    return;
  }
  container.innerHTML = "";

  /* ───────────────────────────────────
   * 0 – decide which branch to show
   * ─────────────────────────────────── */
  let displayedBranch = branchValue;

  if (branchValue === "All") {
    // Use pager-selected branch if valid. Otherwise fall back to first branch.
    if (window.currentTimetablePageBranch && allData?.[window.currentTimetablePageBranch]) {
      displayedBranch = window.currentTimetablePageBranch;
    } else {
      const branches = Object.keys(allData || {}).sort();
      displayedBranch = branches[0] || "Unknown";
      window.currentTimetablePageBranch = displayedBranch; // keep pager state in sync
    }
  } else {
    // If user picked a single branch globally, force pager pointer to it
    window.currentTimetablePageBranch = displayedBranch;
  }
  window.currentTimetableDisplayBranch = displayedBranch;

  // Also keep the pager <select> (if present) visually synced
  const pagerSel = document.getElementById("timetable-branch-select");
  if (pagerSel && pagerSel.value !== displayedBranch) pagerSel.value = displayedBranch;

  const workingInfo = branchValue === "All"
    ? allData?.[displayedBranch]
    : info;

  if (!workingInfo || !workingInfo.schedule) {
    container.innerHTML = `<p class="text-muted m-0">No timetable data for branch: ${displayedBranch}</p>`;
    return;
  }

  /* ───────────────────────────────────
   * 1 – which days?
   * ─────────────────────────────────── */
  const days = dayVal === "All" ? WEEK_DAYS : [dayVal];

  /* ───────────────────────────────────
   * 2 – earliest start / latest end (minutes)
   * ─────────────────────────────────── */
  let minM = Infinity, maxM = 0;
  days.forEach(d => {
    const dayObj = workingInfo.schedule[d] || {};
    Object.entries(dayObj).forEach(([coach, sessions]) => {
      if (coachVal !== "All" && coach !== coachVal) return;
      sessions
        .filter(s => passClass(clsVal, s) && timePass(timeVal, s))
        .forEach(s => {
          if (!s.start_time) return;
          const start = +s.start_time.slice(0, 2) * 60 + +s.start_time.slice(2);
          const end   = start + s.duration * 30; // duration already in half-hour units
          minM = Math.min(minM, start);
          maxM = Math.max(maxM, end);
        });
    });
  });

  if (!isFinite(minM)) {
    container.innerHTML = `
      <div class="timetable-meta-bar mb-1">
        <div class="timetable-branch-indicator fw-semibold">Branch: ${displayedBranch}</div>
      </div>
      <p class="text-muted m-0">No sessions match the selected filters.</p>`;
    return;
  }

  /* ───────────────────────────────────
   * 3 – build 30-min slot list
   * ─────────────────────────────────── */
  minM = Math.floor(minM / 30) * 30;
  maxM = Math.ceil(maxM / 30) * 30;
  const slots = [];
  for (let t = minM; t < maxM; t += 30) slots.push(t);

  /* ───────────────────────────────────
   * 4 – build lookup day -> coach -> sessions[]
   * ─────────────────────────────────── */
  const lookup = {};
  days.forEach(d => {
    lookup[d] = {};
    const dayObj = workingInfo.schedule[d] || {};
    Object.entries(dayObj).forEach(([coach, sessions]) => {
      if (coachVal !== "All" && coach !== coachVal) return;
      const filtered = sessions
        .filter(s => passClass(clsVal, s) && timePass(timeVal, s))
        .map(s => ({
          name:   s.name,
          startM: +s.start_time.slice(0, 2) * 60 + +s.start_time.slice(2),
          span:   s.duration // in half-hours
        }));
      if (filtered.length) lookup[d][coach] = filtered;
    });
  });

  /* ───────────────────────────────────
   * 5 – header rows
   * ─────────────────────────────────── */
  let html = `<table class="table timetable-table"><thead><tr><th>Time</th>`;
  days.forEach(d => {
    const colspan = coachVal === "All"
      ? (Object.keys(lookup[d]).length || 1)
      : 1;
    html += `<th colspan="${colspan}">${d}</th>`;
  });
  html += `</tr><tr><th></th>`;
  days.forEach(d => {
    const coaches = coachVal === "All"
      ? (Object.keys(lookup[d]).length ? Object.keys(lookup[d]) : [""])
      : [coachVal];
    coaches.forEach(c => html += `<th>${c}</th>`);
  });
  html += `</tr></thead><tbody>`;

  /* ───────────────────────────────────
   * 6 – skip counters for rowspans
   * ─────────────────────────────────── */
  const skip = {};
  days.forEach(d => {
    skip[d] = {};
    Object.keys(lookup[d]).forEach(c => (skip[d][c] = 0));
  });

  /* ───────────────────────────────────
   * 7 – body rows (one per 30 minutes)
   * ─────────────────────────────────── */
  slots.forEach(startM => {
    const hour  = Math.floor(startM / 60);
    const min   = startM % 60;
    const label = `${hour % 12 || 12}:${String(min).padStart(2, "0")}${hour < 12 ? "am" : "pm"}`;
    html += `<tr><td>${label}</td>`;

    days.forEach(d => {
      const coaches = coachVal === "All"
        ? (Object.keys(lookup[d]).length ? Object.keys(lookup[d]) : [""])
        : [coachVal];

      coaches.forEach(c => {
        if (skip[d][c] > 0) {
          skip[d][c]--;
          return (html += "");
        }
        const sess = (lookup[d][c] || []).find(s => s.startM === startM);
        if (sess) {
          const bg = CLASS_COLORS[sess.name] || "#888";
          html += `
            <td class="session-cell"
                style="background:${bg};text-align:center;font-weight:bold;"
                rowspan="${sess.span}">
              ${sess.name}
            </td>`;
          skip[d][c] = sess.span - 1;
        } else {
          html += `<td></td>`;
        }
      });
    });

    html += `</tr>`;
  });

  html += `</tbody></table>`;

  /* ───────────────────────────────────
   * 8 – branch indicator + legend
   * ─────────────────────────────────── */
  const indicatorHTML = `
    <div class="timetable-meta-bar d-flex justify-content-between align-items-center mb-1">
      <div class="timetable-branch-indicator fw-semibold">Branch: ${displayedBranch}</div>
    </div>`;
  container.innerHTML = indicatorHTML + html;

  const legendContainer = $("class-legend");
  if (legendContainer) {
    legendContainer.innerHTML = Object.entries(CLASS_COLORS)
      .map(([name, color]) => `
        <span class="badge" style="background:${color};color:#000;font-weight:500;">
          ${name}
        </span>`).join("");
  }
}
