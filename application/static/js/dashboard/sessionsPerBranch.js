// static/js/dashboard/sessionsPerBranch.js

import { timePass } from "./dashboard_utils.js";

let sessionsPerBranchChart = null;

export default function renderSessionsPerBranch(
  canvasId,
  data,
  branchFilter,
  day,
  cls,
  coach,
  timeSlot
) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;

  // destroy previous instance
  if (sessionsPerBranchChart) {
    sessionsPerBranchChart.destroy();
    sessionsPerBranchChart = null;
  }

  // build counts per branch
  const branchCounts = {};
  const branches = branchFilter === "All"
    ? Object.entries(data)
    : data[branchFilter]
      ? [[branchFilter, data[branchFilter]]]
      : [];

  for (const [branchName, info] of branches) {
    if (!info || !info.schedule) continue;
    let count = 0;

    // walk each day in that branch
    for (const [d, sched] of Object.entries(info.schedule)) {
      if (day !== "All" && d !== day) continue;
      // each coach key in that day's schedule
      for (const sessions of Object.values(sched)) {
        sessions.forEach(s => {
          if (
            s &&
            typeof s === "object" &&
            (cls === "All"   || s.name  === cls)   &&
            (coach === "All" || s.coach === coach) &&
            (timeSlot === "All" || timePass(timeSlot, s))
          ) {
            count++;
          }
        });
      }
    }

    branchCounts[branchName] = count;
  }

  // sort branches by ascending session count
  const entries = Object.entries(branchCounts)
    .sort((a, b) => a[1] - b[1]);  // [ [branchName, count], ... ]
  const labels = entries.map(([branch]) => branch);
  const values = entries.map(([, count]) => count);

  if (labels.length === 0) return; // nothing to draw

  // render bar chart
  sessionsPerBranchChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sessions",
        data: values,
        backgroundColor: "#A0C4FF",
        borderColor:     "#3A86FF",
        borderWidth: 1,
        categoryPercentage: 0.6,
        barPercentage:      0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: { enabled: true },
        legend:  { display: false },
        title: {
          display: true,
          text: "Sessions per Branch"
        }
      },
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 }
        }
      }
    }
  });
}
