// static/js/dashboard/dashboard.js
import { WEEK_DAYS, rebuildNativeSelect, $ } from "./dashboard_utils.js";
import { updateFilterChips, wireFilters }    from "./filters.js";

import renderCardStrip         from "./kpi.js";
import renderCoachWorkload     from "./coachWorkload.js";
import renderCoachRadar        from "./coachRadar.js";
import renderSessionsPerDay    from "./sessionsPerDay.js";
import renderSessionsPerCourse from "./sessionsPerCourse.js";
import renderSessionsPerBranch from "./sessionsPerBranch.js";
import renderSessionsMatrix    from "./sessionsMatrix.js";
import renderTimetable         from "./timetable.js";

import { exportStats, toggleTimetable, toggleAnalytics, toggleKPI } from "./exports.js";

// ───── chart-export helpers ─────
import { addPerChartExport, wireExportAll } from "./exportCharts.js";
// ───── zoom helpers ─────
import { addZoomButton, wireZoomAll }       from "./zoomCharts.js";

window.addEventListener("DOMContentLoaded", () => {
  /* ─── Bootstrap ───────────────────────────────────────── */
  const dlModal = document.getElementById("downloadModal");
  if (dlModal && dlModal.parentElement !== document.body) {
    document.body.appendChild(dlModal);
  }
  if (window.Chart && Chart.registerables) {
    Chart.register(...Chart.registerables);
  }

  /* ─── DOM refs ────────────────────────────────────────── */
  const loader           = $("loader");
  const filtersBox       = $("filters");
  const kpiSection       = $("kpi-section");
  const kpiCards         = $("kpi-cards");
  const chartsSection    = $("charts-section");
  const chartsContent    = $("charts-content");
  const timetableSection = $("timetable-section");

  const branchSel   = $("tt-branch-select");
  const dayFilter   = $("day-filter");
  const classFilter = $("class-filter");
  const coachFilter = $("coach-filter");
  const timeFilter  = $("time-filter");

  // clear any static coach <option>
  if (coachFilter) coachFilter.innerHTML = "";

  const exportStatsBtn   = $("export-stats");
  const exportCoachesBtn = $("export-coaches");

  /* ─── Export Stats (Excel) ────────────────────────────── */
  exportStatsBtn?.addEventListener("click", () => {
    exportStats(
      branchSel.value,
      dayFilter.value,
      classFilter.value,
      coachFilter.value,
      timeFilter.value
    );
  });

  /* ─── Pager Helpers ───────────────────────────────────── */
  const pagerWrapper = $("timetable-pager");
  const pagerSelect  = $("timetable-branch-select");
  const pagerPrevBtn = $("tt-prev-branch");
  const pagerNextBtn = $("tt-next-branch");
  const pagerCounter = $("tt-branch-counter");

  let branchListForPager = [];
  let currentPagerIndex  = 0;
  window.currentTimetablePageBranch = null;

  const buildPagerBranchList = data => {
    branchListForPager = Object.keys(data || {}).sort();
    if (currentPagerIndex >= branchListForPager.length) currentPagerIndex = 0;
  };

  const syncPagerSelect = () => {
    if (!pagerSelect) return;
    rebuildNativeSelect(
      pagerSelect,
      branchListForPager,
      window.currentTimetablePageBranch || branchListForPager[0]
    );
    if (pagerCounter) {
      const i = branchListForPager.indexOf(pagerSelect.value);
      pagerCounter.textContent = `Branch ${i + 1} of ${branchListForPager.length}`;
    }
  };

  const togglePager = globalBranch => {
    if (!pagerWrapper) return;
    const show = globalBranch === "All" && branchListForPager.length;
    pagerWrapper.style.display = show ? "flex" : "none";
    if (show) {
      syncPagerSelect();
      window.currentTimetablePageBranch = pagerSelect.value;
    } else {
      window.currentTimetablePageBranch = null;
    }
  };

  const movePager = (delta, drawFn) => {
    if (!branchListForPager.length) return;
    currentPagerIndex =
      (currentPagerIndex + delta + branchListForPager.length) %
      branchListForPager.length;
    window.currentTimetablePageBranch = branchListForPager[currentPagerIndex];
    syncPagerSelect();
    drawFn(
      branchSel.value   || "All",
      dayFilter.value   || "All",
      classFilter.value || "All",
      coachFilter.value || "All",
      timeFilter.value  || "All"
    );
  };

  pagerPrevBtn?.addEventListener("click", () => {
    if (branchSel.value === "All") movePager(-1, drawAll);
  });
  pagerNextBtn?.addEventListener("click", () => {
    if (branchSel.value === "All") movePager(1, drawAll);
  });
  pagerSelect?.addEventListener("change", () => {
    if (branchSel.value !== "All") return;
    window.currentTimetablePageBranch = pagerSelect.value;
    currentPagerIndex = branchListForPager.indexOf(pagerSelect.value);
    togglePager("All");
    drawAll(
      "All",
      dayFilter.value   || "All",
      classFilter.value || "All",
      coachFilter.value || "All",
      timeFilter.value  || "All"
    );
  });

  /* ─── drawAll placeholder ───────────────────────────────── */
  let drawAll = () => {};

  /* ─── Fetch & Initialize ───────────────────────────────── */
  fetch("api/timetable/active")
    .then(r => r.json())
    .then(r => {
      const data = r.data || {};
      window.allData = data;

      // reveal UI
      [
        [loader,           "none"],
        [filtersBox,       "block"],
        [kpiSection,       "block"],
        [kpiCards,         "flex"],
        [chartsSection,    "block"],
        [chartsContent,    "grid"],
        [timetableSection, "block"]
      ].forEach(([el, d]) => el && (el.style.display = d));
      exportStatsBtn.disabled   = false;
      exportCoachesBtn.disabled = false;

      const validBranches = Object.entries(data)
        .filter(([, b]) => b && b.schedule && typeof b.schedule === "object")
        .map(([k]) => k);

      // populate branch filter
      branchSel.innerHTML =
        `<option value="All">All</option>` +
        validBranches.map(b => `<option value="${b}">${b}</option>`).join("");

      // populate class filter
      const classSet = new Set();
      validBranches.forEach(b =>
        Object.values(data[b].schedule).forEach(dayObj =>
          Object.values(dayObj || {}).flat().forEach(s => s?.name && classSet.add(s.name))
        )
      );
      classFilter.innerHTML =
        `<option value="All">All</option>` +
        [...classSet].sort().map(c => `<option value="${c}">${c}</option>`).join("");

      /* ── Implement drawAll ───────────────────────────────── */
      drawAll = (branchVal, dayVal, classVal, coachVal, timeVal) => {
        const coachToBranch = {};
        let info, label;

        if (branchVal === "All") {
          info = { coaches: [], schedule: {} };
          WEEK_DAYS.forEach(d => (info.schedule[d] = {}));

          validBranches.forEach(b => {
            (data[b].coaches || []).forEach(c => {
              coachToBranch[c] = b;
              info.coaches.push(c);
            });
            WEEK_DAYS.forEach(d => {
              Object.entries(data[b].schedule[d] || {}).forEach(([c, arr]) => {
                (info.schedule[d][c] ??= []).push(...arr);
              });
            });
          });
          info.coaches = [...new Set(info.coaches)];
          label = "All";
          buildPagerBranchList(data);
          togglePager("All");
        } else {
          info = data[branchVal] || { coaches: [], schedule: {} };
          (info.coaches || []).forEach(c => (coachToBranch[c] = branchVal));
          label = branchVal;
          togglePager(branchVal);
        }
        if (!info) return;


        // ── expose the map for filters.js ─────────────────
        window.coachToBranch = coachToBranch;
        // render all charts & KPI
        renderCardStrip(info, dayVal, classVal, coachVal, timeVal);
        renderCoachWorkload("coach-workload", info, dayVal, classVal, coachVal, timeVal, branchVal, coachToBranch);
        renderCoachRadar("coach-performance-radar", info, dayVal, classVal, coachVal, timeVal, branchVal, coachToBranch);
        renderSessionsPerDay("sessions-per-day", info, dayVal, classVal, coachVal, timeVal);
        renderSessionsPerCourse("sessions-per-course", info, dayVal, classVal, coachVal, timeVal);
        renderSessionsPerBranch("sessions-per-branch", data, branchVal, dayVal, classVal, coachVal, timeVal);
        renderSessionsMatrix("sessions-matrix-container", info, dayVal, classVal, coachVal);
        renderTimetable(info, dayVal, classVal, coachVal, timeVal, undefined, branchVal, window.allData);

        updateFilterChips(drawAll);

        // per-chart export button
        [
          "coach-workload",
          "coach-performance-radar",
          "sessions-per-day",
          "sessions-per-course",
          "sessions-per-branch",
          "sessions-matrix-container"
        ].forEach(addPerChartExport);

        // per-chart zoom button
        [
          "coach-workload",
          "coach-performance-radar",
          "sessions-per-day",
          "sessions-per-course",
          "sessions-per-branch",
          "sessions-matrix-container"
        ].forEach(addZoomButton);
      };

      /* ── Coach filter choices ───────────────────────────────── */
      function populateCoaches() {
        const ch = window.choicesInstances?.coach;
        if (!ch) return;

        // remember whatever was selected
        const prev = coachFilter.value;

        ch.clearStore?.();
        ch.clearChoices();

        const selBranch = branchSel.value || "All";
        let coachChoices;

        if (selBranch === "All") {
          const map = {};
          validBranches.forEach(b =>
            (data[b].coaches || []).forEach(c => (map[c] ??= b))
          );
          coachChoices = Object.entries(map)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([c, b]) => ({ value: c, label: `${c} (${b})` }));
        } else {
          coachChoices = (data[selBranch]?.coaches || [])
            .sort()
            .map(c => ({ value: c, label: c }));
        }

        coachChoices.unshift({ value: "All", label: "All" });
        ch.setChoices(coachChoices, "value", "label", true);

        // restore previous coach if still in the new list, else default to All
        if (prev && coachChoices.some(x => x.value === prev)) {
          ch.setChoiceByValue(prev);
        } else {
          ch.setChoiceByValue("All");
        }
      }

      /* ── Wire filters & branch change ───────────────────────── */
      wireFilters(drawAll);
      branchSel.addEventListener("change", () => {
        currentPagerIndex = 0;
        window.currentTimetablePageBranch = null;
        populateCoaches();
        drawAll(
          branchSel.value,
          dayFilter.value   || "All",
          classFilter.value || "All",
          coachFilter.value || "All",
          timeFilter.value  || "All"
        );
      });

      // initial render
      populateCoaches();
      drawAll("All", "All", "All", "All", "All");

      // global “Export All Charts” → ZIP
      wireExportAll("export-all-charts", [
        "coach-workload",
        "coach-performance-radar",
        "sessions-per-day",
        "sessions-per-course",
        "sessions-per-branch",
        "sessions-matrix-container"
      ]);

      // global “Zoom All Charts”
      wireZoomAll([
        "coach-workload",
        "coach-performance-radar",
        "sessions-per-day",
        "sessions-per-course",
        "sessions-per-branch",
        "sessions-matrix-container"
      ]);
    })
    .catch(console.error);

  /* ─── View toggles ───────────────────────────────────────── */
  $("toggle-timetable")?.addEventListener("click", toggleTimetable);
  $("toggle-analytics")?.addEventListener("click", toggleAnalytics);
  $("toggle-kpi")      ?.addEventListener("click", toggleKPI);
});
