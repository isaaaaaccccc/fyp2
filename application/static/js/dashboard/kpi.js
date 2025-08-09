// static/js/dashboard/kpi.js
import { $, WEEK_DAYS, passClass, timePass } from "./dashboard_utils.js";

export default function renderCardStrip(info, dayVal, clsVal, coachVal, timeVal) {
  const holder = $("kpi-cards"),
        days   = dayVal === "All" ? WEEK_DAYS : [dayVal];

  const coachSet = new Set();
  days.forEach(d =>
    Object.entries(info.schedule[d] || {}).forEach(([c, arr]) => {
      if ((coachVal === "All" || c === coachVal) &&
          arr.some(s => passClass(clsVal, s) && timePass(timeVal, s))) {
        coachSet.add(c);
      }
    })
  );

  const dailyCounts = days.map(d =>
    Object.entries(info.schedule[d] || {})
      .filter(([c]) => coachVal === "All" || c === coachVal)
      .flatMap(([, arr]) => arr)
      .filter(s => passClass(clsVal, s) && timePass(timeVal, s))
      .length
  );
  const total      = dailyCounts.reduce((a, b) => a + b, 0),
        busiestIdx = dailyCounts.length ? dailyCounts.indexOf(Math.max(...dailyCounts)) : -1,
        busiestStr = busiestIdx > -1
          ? `${days[busiestIdx]} – ${dailyCounts[busiestIdx]}`
          : "—";

  const counts = {};
  days.forEach(d =>
    Object.entries(info.schedule[d] || {})
      .filter(([c]) => coachVal === "All" || c === coachVal)
      .flatMap(([, arr]) => arr)
      .filter(s => passClass(clsVal, s) && timePass(timeVal, s))
      .forEach(s => counts[s.name] = (counts[s.name] || 0) + 1)
  );
  const [popCourse = "—", popCount = 0] = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0] || [];

  const makeCard = (t, b, s) => `
    <div class=\"card-strip-item\">\n      <div class=\"card text-center h-100 bg-light\">\n        <div class=\"card-body\">\n          <h6 class=\"card-title text-muted\">${t}</h6>\n          <p class=\"display-6 mb-0\">${b}</p>\n          <small class=\"text-muted\">${s}</small>\n        </div>\n      </div>\n    </div>`;

  holder.innerHTML =
    makeCard("Coaches", coachSet.size, "unique") +
    makeCard("Total Sessions", total, "within filters") +
    makeCard("Busiest Day", busiestStr, "peak load") +
    makeCard("Most-Popular Course", popCourse, `${popCount} sessions`);
}