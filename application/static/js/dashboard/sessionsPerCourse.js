// static/js/dashboard/sessionsPerCourse.js
import { $, WEEK_DAYS, passClass, timePass, CLASS_COLORS } from "./dashboard_utils.js";
let courseChart;

export default function renderSessionsPerCourse(branch, info, dayVal, clsVal, coachVal, timeVal) {
  const days = dayVal === "All" ? WEEK_DAYS : [dayVal];
  const freq = {};

  days.forEach(d =>
    Object.values(info.schedule[d] || {})
      .flat()
      .filter(s => 
        (coachVal === "All" || s.coach === coachVal) &&
         passClass(clsVal, s) &&
         timePass(timeVal, s)
      )
      .forEach(s => { freq[s.name] = (freq[s.name] || 0) + 1; })
  );

  // sort courses by ascending session count
  const entries = Object.entries(freq)
    .sort((a, b) => a[1] - b[1]);       // [ [courseName, count], ... ]
  const labels = entries.map(([name]) => name),
        data   = entries.map(([, count]) => count);

  $("course-chart-title").textContent =
    `${branch} Sessions per Level${coachVal !== "All" ? ` – ${coachVal}` : ""}`;

  if (courseChart) courseChart.destroy();
  courseChart = new Chart($("sessions-per-course"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sessions",
        data,
        backgroundColor: labels.map(l => CLASS_COLORS[l] || "#888")
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}
