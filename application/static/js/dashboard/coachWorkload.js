// static/js/dashboard/coachWorkload.js
import { $, WEEK_DAYS, passClass, timePass } from "./dashboard_utils.js";

let workloadChart;

/**
 * @param {string}  id             – canvas selector
 * @param {object}  info           – { schedule: { Mon: {...}, … }, coaches: […] }
 * @param {string}  dayVal         – "All" or specific day
 * @param {string}  clsVal         – "All" or specific class filter
 * @param {string}  coachVal       – "All" or specific coach filter
 * @param {string}  timeVal        – "All" or specific time filter
 * @param {string}  branchVal      – "All" or specific branch
 * @param {object}  coachToBranch  – map coachName → branchName
 */
export default function renderCoachWorkload(
  id, info, dayVal, clsVal, coachVal, timeVal, branchVal, coachToBranch
) {
  // tally sessions
  const tally = {};
  const days = dayVal === "All" ? WEEK_DAYS : [dayVal];
  days.forEach(d => {
    const daySchedule = info.schedule?.[d] || {};
    Object.entries(daySchedule).forEach(([coach, sessions]) => {
      if (coachVal !== "All" && coach !== coachVal) return;
      const valid = sessions.filter(s => passClass(clsVal, s) && timePass(timeVal, s));
      tally[coach] = (tally[coach] || 0) + valid.length;
    });
  });

  // destroy old chart
  if (workloadChart) {
    workloadChart.destroy();
    workloadChart = null;
  }

  // prepare entries
  const allEntries = Object.entries(tally);
  const makePastelPalette = n =>
    Array.from({ length: n }, (_, i) => `hsl(${Math.round(i * 360 / n)},60%,80%)`);

  const TOP_N = 10;
  let labels, data, cfg;

  if (allEntries.length > TOP_N) {
    // ─── Bar chart for Top 10 ───────────────────────────────────────────
    const top = allEntries
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N);

    labels = top.map(([coach]) => {
      const branch = coachToBranch[coach];
      return branch ? `${coach} (${branch})` : coach;
    });
    data = top.map(([, count]) => count);

    cfg = {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Sessions",
          data,
          backgroundColor: makePastelPalette(labels.length),
          borderWidth: 1
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#fff" },
            grid: { display: true }
          },
          y: {
            ticks: { color: "#fff" },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: `Top ${TOP_N} Coach Workloads`,
            color: "#fff"
          },
          tooltip: {
            titleColor:  "#fff",
            bodyColor:   "#fff",
            footerColor: "#fff"
          }
        }
      }
    };

  } else {
    // ─── Pie chart for fewer than Top 10 ────────────────────────────────
    labels = allEntries.map(([coach]) => coach);
    data   = allEntries.map(([, count]) => count);

    cfg = {
      type: "pie",
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: makePastelPalette(labels.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#fff" } },
          title:  { display: true, text: "Coach Workload Distribution", color: "#fff" },
          tooltip: {
            titleColor:  "#fff",
            bodyColor:   "#fff",
            footerColor: "#fff"
          }
        }
      }
    };
  }

  // render
  workloadChart = new Chart($(id), cfg);
}
