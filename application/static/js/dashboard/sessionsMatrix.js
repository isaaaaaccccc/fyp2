// static/js/dashboard/sessionsMatrix.js

import { WEEK_DAYS, timePass } from "./dashboard_utils.js";

export default function renderSessionsMatrix(
  containerId,
  info,
  dayFilter,
  classFilter,
  coachFilter
) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // compute counts per [day][slot]
  const slots = ["Morning","Afternoon","Evening"];
  const counts = {};
  let maxCount = 0;

  WEEK_DAYS.forEach(day => {
    counts[day] = {};
    slots.forEach(slot => {
      const daySched = info.schedule[day] || {};
      const total = Object.values(daySched)
        .flat()
        .filter(s =>
          (dayFilter   === "All"   || day === dayFilter)   &&
          (classFilter === "All"   || s.name  === classFilter) &&
          (coachFilter === "All"   || s.coach === coachFilter) &&
          timePass(slot, s)
        )
        .length;

      counts[day][slot] = total;
      if (total > maxCount) maxCount = total;
    });
  });

  // build table
  let html = `<table class="matrix-table"><thead><tr><th>Day \\ Slot</th>`;
  slots.forEach(slot => html += `<th>${slot}</th>`);
  html += `</tr></thead><tbody>`;

  WEEK_DAYS.forEach(day => {
    html += `<tr><th>${day}</th>`;
    slots.forEach(slot => {
      const v = counts[day][slot];
      // normalize 0–1
      const intensity = maxCount>0 ? (v/maxCount)*0.8 + 0.2 : 0.2;
      const bg = `rgba(58,134,255,${intensity.toFixed(2)})`;
      html += `<td style="
        background-color: ${bg};
        color: white;
        text-align: center;
        padding: 4px;
      ">${v}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}
