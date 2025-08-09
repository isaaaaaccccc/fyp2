// static/js/dashboard/sessionsPerDay.js
import { $, WEEK_DAYS, passClass, timePass } from "./dashboard_utils.js";
let dayChart;

export default function renderSessionsPerDay(branch, info, dayVal, clsVal, coachVal, timeVal) {
  const daysArr = dayVal === "All" ? WEEK_DAYS : [dayVal];
  const counts  = daysArr.map(d =>
    Object.values(info.schedule[d] || {})
      .flat()
      .filter(s => 
        (coachVal === "All" || s.coach === coachVal) &&
         passClass(clsVal, s) &&
         timePass(timeVal, s)
      ).length
  );

  $("day-chart-title").textContent =
    `${branch} Sessions per Day${coachVal !== "All" ? ` – ${coachVal}` : ""}`;

  if (dayChart) dayChart.destroy();
  dayChart = new Chart($("sessions-per-day"), {
    type: "bar",
    data: {
      labels: daysArr,
      datasets: [{ label: "Sessions", data: counts }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });
}
