// static/js/dashboard/dashboard_utils.js
export const WEEK_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export const CLASS_COLORS = {
  L1:"#9FC5E8", L2:"#FCE5CD", L3:"#8E7CC3", L4:"#F6B26B",
  Flexi:"#D9EAD3", Bubbly:"#F4CCCC", Jolly:"#00FFFF",
  Tots:"#C2E7DA", Lively:"#FFF2CC"
};

export const $ = id => document.getElementById(id);

export function safeChoices(el, opts) {
  if (window.Choices && el) {
    try { return new Choices(el, opts); } catch (e) { console.warn("Choices init failed", e); }
  }
  return null;
}

export const passClass = (cls, s) => cls === "All" || (s && s.name === cls);

export function timePass(slot, s) {
  if (slot === "All") return true;
  const st = s?.start_time;
  if (typeof st !== "string" || st.length < 2) return false;
  const h = parseInt(st.slice(0, 2), 10);

  // Morning: 08:00–11:59, Afternoon: 12:00–18:59
  if (slot === "Morning")   return h >= 8  && h < 12;
  if (slot === "Afternoon") return h >= 12 && h < 19;
  return false;
}

/* ---------- helpers to rebuild <select> & Choices ---------- */
export function rebuildNativeSelect(el, values, selected) {            // <<< FIX
  if (!el) return;
  const keep = selected ?? el.value;
  el.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");
  el.value = values.includes(keep) ? keep : values[0] ?? "All";
}

export function setChoicesList(ciInstance, values, selected="All") {   // <<< FIX
  if (!ciInstance) return;
  ciInstance.clearChoices();
  ciInstance.setChoices(
    values.map(v => ({ value:v, label:v })),
    "value","label", true
  );
  ciInstance.setChoiceByValue(selected);
}
