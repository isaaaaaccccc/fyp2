// static/js/dashboard/coachRadar.js
import { $, WEEK_DAYS, passClass, timePass } from "./dashboard_utils.js";
let radarChart;

/**
 * Renders a radar chart of coach performance.
 *
 * @param {string} id             – The DOM selector for the canvas element.
 * @param {object} info           – The schedule info.
 * @param {string} dayVal         – "All" or a specific day.
 * @param {string} clsVal         – "All" or a specific class filter.
 * @param {string} coachVal       – "All" or a specific coach name.
 * @param {string} timeVal        – "All" or a specific time slot filter.
 * @param {string} branchVal      – "All" or a specific branch name.
 * @param {object} coachToBranch  – Map of coachName → branchName.
 */
export default function renderCoachRadar(
  id,
  info,
  dayVal,
  clsVal,
  coachVal,
  timeVal,
  branchVal,
  coachToBranch
) {
  // 1. Aggregate stats per coach
  const stats = {};
  const days = dayVal === "All" ? WEEK_DAYS : [dayVal];

  days.forEach(d => {
    const daySchedule = info.schedule?.[d] || {};
    Object.entries(daySchedule).forEach(([coach, sessions]) => {
      if (coachVal !== "All" && coach !== coachVal) return;
      const filtered = sessions.filter(s => passClass(clsVal, s) && timePass(timeVal, s));
      if (!filtered.length) return;

      if (!stats[coach]) {
        stats[coach] = { n: 0, dur: 0, days: new Set() };
      }
      stats[coach].n   += filtered.length;
      stats[coach].dur += filtered.reduce((sum, x) => sum + x.duration, 0);
      filtered.forEach(() => stats[coach].days.add(d));
    });
  });

  // 2. Sort coaches by number of sessions
  const sorted = Object.entries(stats).sort((a, b) => b[1].n - a[1].n);

  // 3. If “All” branches, take top-10; else show them all
  const entries = branchVal === "All" ? sorted.slice(0, 10) : sorted;

  // 4. Build labels (suffix branch only in the All-branches/top-10 case)
  const labels = entries.map(([coach]) => {
    if (branchVal === "All") {
      const branch = coachToBranch[coach] || "—";
      return `${coach} (${branch})`;
    }
    return coach;
  });

  const sessions   = entries.map(([, o]) => o.n);
  const avgDur     = entries.map(([, o]) => +(o.dur / o.n).toFixed(1));
  const daysWorked = entries.map(([, o]) => o.days.size);

  // 5. Destroy previous chart
  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }

  // 6. Render new radar chart
  radarChart = new Chart($(id), {
    type: "radar",
    data: {
      labels,
      datasets: [
        { label: "# Sessions",    data: sessions,   fill: true },
        { label: "Avg Duration",  data: avgDur,     fill: true },
        { label: "# Days Worked", data: daysWorked, fill: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true,
          grid:        { color: "rgba(255,255,255,0.1)" },
          angleLines:  { color: "rgba(255,255,255,0.1)" },
          pointLabels: { color: "#fff" },
          ticks:        { color: "#fff" }
        }
      },
      plugins: {
        legend: { labels: { color: "#fff" } },
        title: {
          display: true,
          text:
            branchVal === "All"
              ? "Top 10 Coach Performance"
              : `Coach Performance — ${branchVal}`,
          color: "#fff"
        },
        tooltip: {
          titleColor:  "#fff",
          bodyColor:   "#fff",
          footerColor: "#fff"
        }
      }
    }
  });
}
