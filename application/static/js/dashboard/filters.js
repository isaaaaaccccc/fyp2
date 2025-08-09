// static/js/dashboard/filters.js
import { $, safeChoices, WEEK_DAYS } from "./dashboard_utils.js";

/* Cache Choices instances globally so other modules can access them */
export const ci = (window.choicesInstances = {});

/* ───── constants ───── */
const TIME_SLOTS = ["All", "Morning", "Afternoon"];

/* Central list of filters so we can loop once everywhere */
const FILTERS = [
  { id: "tt-branch-select", key: "branch", label: "Branch" },
  { id: "day-filter",       key: "day",    label: "Day"    },
  { id: "class-filter",     key: "class",  label: "Class"  },
  { id: "coach-filter",     key: "coach",  label: "Coach"  },
  { id: "time-filter",      key: "time",   label: "Time"   }
];

function syncTimetablePagerVisibility() {
  const pager = $("timetable-pager");
  if (!pager) return;
  const branchVal = $("tt-branch-select")?.value ?? "All";
  pager.classList.toggle("d-none", branchVal !== "All");
}

export function applyTimeSlotNow(drawAll) {
  const now = new Date();
  let hour = now.getHours();
  let wd   = now.getDay();
  let slot;
  if      (hour < 8)  slot = "All";
  else if (hour < 12) slot = "Morning";
  else if (hour < 19) slot = "Afternoon";
  else { slot = "Morning"; wd = (wd + 1) % 7; }

  const dayName = wd === 0 ? "Sunday" : WEEK_DAYS[wd - 1];
  $("day-filter").value = dayName;
  $("time-filter").value = slot;
  ci.day ?.setChoiceByValue(dayName);
  ci.time?.setChoiceByValue(slot);

  drawAll(
    $("tt-branch-select").value,
    dayName,
    $("class-filter").value,
    $("coach-filter").value,
    slot
  );
  updateFilterChips(drawAll);
}

export function updateFilterChips(drawAll) {
  const active = FILTERS.reduce(
    (n, { id }) => n + (($(id)?.value ?? "All") !== "All"), 0
  );

  const badge = $("filter-badge");
  if (badge) {
    badge.textContent = active || "";
    badge.classList.toggle("d-none", active === 0);
  }

  const row = $("active-filters");
  if (row) row.innerHTML = "";

  FILTERS.forEach(({ id, key, label }) => {
    const sel = $(id);
    const val = sel?.value;
    if (!val || val === "All" || !row) return;

    const chip = document.createElement("span");
    chip.className = "badge bg-secondary me-2 d-inline-flex align-items-center";
    chip.innerHTML = `
      <span>${label}: ${val}</span>
      <button type="button" class="btn-close btn-close-white btn-sm ms-2"></button>
    `;
    chip.querySelector("button").onclick = () => {
      sel.value = "All";
      ci[key]?.setChoiceByValue?.("All");
      // dispatch change so branch-change listener repopulates coaches + redraws
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    };
    row.appendChild(chip);
  });

  syncTimetablePagerVisibility();
}

export function wireFilters(drawAll) {
  const branch = $("tt-branch-select"),
        day    = $("day-filter"),
        cls    = $("class-filter"),
        coach  = $("coach-filter"),
        time   = $("time-filter");

  // strip any unwanted time options
  if (time && time.options.length) {
    const wanted = new Set(TIME_SLOTS);
    [...time.options].forEach(opt => { if (!wanted.has(opt.value)) opt.remove(); });
  }

  // initialize Choices.js on each dropdown
  if (!ci.branch) ci.branch = safeChoices(branch, { searchEnabled: true });
  if (!ci.day)    ci.day    = safeChoices(day,    { searchEnabled: true, shouldSort: false });
  if (!ci.class)  ci.class  = safeChoices(cls,    { searchEnabled: true });
  if (!ci.coach)  ci.coach  = safeChoices(coach,  { searchEnabled: true });
  if (!ci.time)   ci.time   = safeChoices(time,   { searchEnabled: true, shouldSort: false });

  // whenever any filter changes, re-draw everything
  [branch, day, cls, coach, time].forEach(sel =>
    sel.addEventListener("change", () => {
      drawAll(branch.value, day.value, cls.value, coach.value, time.value);
      updateFilterChips(drawAll);
    })
  );

  // ────────────────────────────────────────────────────────────
  // NEW: if branch is “All” and user picks a coach, switch branch to that coach’s branch
  // ────────────────────────────────────────────────────────────
  coach.addEventListener("change", () => {
    // only when branch is still “All” and a real coach is selected
    if (branch.value === "All" && coach.value && coach.value !== "All") {
      const branchCode = window.coachToBranch?.[coach.value];
      if (branchCode) {
        // update the UI
        ci.branch.setChoiceByValue(branchCode);
        // fire the change so your existing branch-change logic runs
        branch.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });


  // apply current time slot button
  $("auto-time-btn")?.addEventListener("click", () => applyTimeSlotNow(drawAll));

  // clear all filters
  $("clear-filters-btn")?.addEventListener("click", () => {
    const allDropdowns = [branch, day, cls, coach, time];
    allDropdowns.forEach(s => {
      s.value = "All";
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
    Object.values(ci).forEach(inst => inst?.setChoiceByValue?.("All"));
  });

  updateFilterChips(drawAll);
  syncTimetablePagerVisibility();
}
