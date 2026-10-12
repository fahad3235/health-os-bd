/* health-os-bd — pure health math + data helpers (no DOM, no Date.now()).
 *
 * Shared by the browser app (classic script) and the Node unit tests
 * (module.exports). All functions take explicit inputs; "today" is always
 * passed in as an ISO date so tests and the ?asof= override stay
 * deterministic.
 *
 * HEALTH SCORE FORMULA (v1, shown transparently in the dashboard):
 *   Up to four components, each worth 0-25 points, only counted when that
 *   module has data for the day. Final score = round(sum / n_components).
 *   No data at all -> score null (shown as "—").
 *
 *   1. Water (25): 25 * min(1, totalMl / goalMl).        data: totalMl > 0
 *   2. Sleep (25): hours of last night's entry —
 *        <4h or >11h -> 0
 *        4..7h      -> 25 * (h-4)/3   (linear ramp up)
 *        7..9h      -> 25            (full)
 *        9..11h     -> 25 * (1-(h-9)/2) (linear ramp down)
 *                                           data: entry exists
 *   3. BMI (25): 18.5-24.9 -> 25; 17-18.5 or 25-27 -> 15;
 *        15-17 or 27-30 -> 8; else 4.     data: height & weight set
 *   4. Medicine (25): 25 * (doses taken today / doses scheduled today).
 *                                           data: >=1 scheduled dose
 *
 *   Final score = round(100 * sum(pts) / (25 * n)) = round(4 * sum / n).
 */
'use strict';

var H = {};

/* ---------- numbers / digits ---------- */
H.BN_DIGITS = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];

H.toBnDigits = function (s) {
  return String(s).replace(/[0-9]/g, function (d) { return H.BN_DIGITS[+d]; });
};

H.fmtNum = function (n, lang) {
  var s = String(n);
  return lang === 'bn' ? H.toBnDigits(s) : s;
};

/* ---------- dates (YYYY-MM-DD, UTC arithmetic to avoid DST drift) ---------- */
H.isISODate = function (s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !isNaN(Date.parse(s + 'T00:00:00Z'));
};

H.shiftISO = function (iso, days) {
  var t = Date.parse(iso + 'T00:00:00Z') + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
};

H.diffDays = function (fromISO, toISO) {
  return Math.round((Date.parse(toISO + 'T00:00:00Z') - Date.parse(fromISO + 'T00:00:00Z')) / 86400000);
};

H.weekdayNameEN = function (iso) {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay()];
};

H.weekdayNameBN = function (iso) {
  return ['রবি','সোম','মঙ্গল','বুধ','বৃহ','শুক্র','শনি'][new Date(Date.parse(iso + 'T00:00:00Z')).getUTCDay()];
};

H.shortDate = function (iso) { /* "Oct 12" */
  var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var p = iso.split('-');
  return M[+p[1] - 1] + ' ' + (+p[2]);
};

/* ---------- time (HH:MM) ---------- */
H.isHHMM = function (s) {
  if (typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return false;
  var h = +s.slice(0, 2), m = +s.slice(3, 5);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
};

H.hmmToMin = function (s) { return (+s.slice(0, 2)) * 60 + (+s.slice(3, 5)); };

H.minToHmm = function (mins) {
  mins = ((mins % 1440) + 1440) % 1440;
  var h = Math.floor(mins / 60), m = mins % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
};

/* Sleep duration in minutes. If wake is earlier than bed it is counted as the
 * next morning (midnight crossing). Equal times -> 0 (UI rejects it). */
H.sleepDurationMin = function (bedHHMM, wakeHHMM) {
  var bed = H.hmmToMin(bedHHMM), wake = H.hmmToMin(wakeHHMM);
  var d = wake - bed;
  if (d < 0) d += 1440;
  return d;
};

H.fmtDuration = function (mins) {
  var h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
};

/* ---------- body: BMI / BMR / TDEE ---------- */
H.round2 = function (n) { return Math.round(n * 100) / 100; };

H.bmi = function (weightKg, heightCm) {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  return H.round2(weightKg / Math.pow(heightCm / 100, 2));
};

/* Hand-verified: male 25y, 70kg, 175cm -> 1673.75 */
H.bmr = function (sex, weightKg, heightCm, ageYears) {
  if (!(weightKg > 0) || !(heightCm > 0) || !(ageYears > 0)) return null;
  var v = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  v += (sex === 'female' ? -161 : 5);
  return H.round2(v);
};

H.ACTIVITY = [
  { key: 'sedentary', factor: 1.2 },
  { key: 'light',     factor: 1.375 },
  { key: 'moderate',  factor: 1.55 },
  { key: 'active',    factor: 1.725 },
  { key: 'extra',     factor: 1.9 }
];

H.tdee = function (bmrValue) {
  if (!(bmrValue > 0)) return null;
  return H.ACTIVITY.map(function (a) {
    return { key: a.key, factor: a.factor, kcal: H.round2(bmrValue * a.factor) };
  });
};

H.bmiCategory = function (bmiValue) {
  if (bmiValue === null || bmiValue === undefined) return 'none';
  if (bmiValue < 18.5) return 'under';
  if (bmiValue < 25) return 'normal';
  if (bmiValue < 30) return 'over';
  return 'obese';
};

H.healthyWeightRange = function (heightCm) {
  if (!(heightCm > 0)) return null;
  var h2 = Math.pow(heightCm / 100, 2);
  return { min: H.round2(18.5 * h2), max: H.round2(24.9 * h2) };
};

/* unit conversion (canonical storage is metric) */
H.KG_PER_LB = 0.45359237;
H.CM_PER_IN = 2.54;

H.lbToKg = function (lb) { return H.round2(lb * H.KG_PER_LB); };
H.inToCm = function (inches) { return H.round2(inches * H.CM_PER_IN); };
H.kgToLb = function (kg) { return H.round2(kg / H.KG_PER_LB); };
H.cmToIn = function (cm) { return H.round2(cm / H.CM_PER_IN); };

H.validateBody = function (o) {
  /* o: {sex, ageYears, heightCm, weightKg} */
  var errs = [];
  if (o.sex !== 'male' && o.sex !== 'female') errs.push('sex');
  if (!(o.ageYears >= 5 && o.ageYears <= 120)) errs.push('age');
  if (!(o.heightCm >= 50 && o.heightCm <= 250)) errs.push('height');
  if (!(o.weightKg >= 15 && o.weightKg <= 400)) errs.push('weight');
  return errs;
};

/* ---------- water ---------- */
H.DEFAULT_GOAL_ML = 2000;
H.MIN_GOAL_ML = 500;
H.MAX_GOAL_ML = 10000;
H.MAX_SINGLE_ML = 2000;
H.QUICK_ML = [250, 500, 750, 1000];

H.parseWhole = function (v) {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v !== 'string') return null;
  var t = v.trim().replace(/[০-৯]/g, function (d) { return String(H.BN_DIGITS.indexOf(d)); });
  if (!/^\d+$/.test(t)) return null;
  return parseInt(t, 10);
};

H.validateAmount = function (v) {
  var n = H.parseWhole(v);
  if (n === null || n < 1 || n > H.MAX_SINGLE_ML) return { ok: false, value: null };
  return { ok: true, value: n };
};

H.validateGoal = function (v) {
  var n = H.parseWhole(v);
  if (n === null || n < H.MIN_GOAL_ML || n > H.MAX_GOAL_ML) return { ok: false, value: null };
  return { ok: true, value: n };
};

H.dayTotal = function (days, iso) {
  var d = (days || {})[iso];
  if (!d) return 0;
  if (typeof d.total === 'number') return d.total;
  var log = Array.isArray(d.log) ? d.log : [];
  return log.reduce(function (s, e) { return s + (typeof e.ml === 'number' ? e.ml : 0); }, 0);
};

H.progressPct = function (totalMl, goalMl) {
  if (!(goalMl > 0)) return 0;
  return Math.round((totalMl / goalMl) * 100);
};

H.ringFraction = function (totalMl, goalMl) {
  if (!(goalMl > 0)) return 0;
  return Math.min(1, Math.max(0, totalMl / goalMl));
};

/* ---------- medicine: expiry + schedules ---------- */
H.EXPIRING_SOON_DAYS = 30;

H.expiryStatus = function (expiryISO, todayISO) {
  if (!H.isISODate(expiryISO)) return 'unknown';
  if (expiryISO < todayISO) return 'expired';
  if (expiryISO <= H.shiftISO(todayISO, H.EXPIRING_SOON_DAYS)) return 'soon';
  return 'ok';
};

H.daysUntilExpiry = function (expiryISO, todayISO) {
  return H.diffDays(todayISO, expiryISO);
};

/* scheduled doses for a med on a day: its daily times. taken: set of "HH:MM" */
H.medScheduleForDay = function (med, takenTimes) {
  var times = Array.isArray(med.times) ? med.times : [];
  var taken = takenTimes || [];
  return times.map(function (t) {
    return { time: t, taken: taken.indexOf(t) !== -1 };
  });
};

H.dayDoseTotals = function (medList, takenMap, iso) {
  var day = (takenMap || {})[iso] || {};
  var scheduled = 0, taken = 0;
  (medList || []).forEach(function (m) {
    var times = Array.isArray(m.times) ? m.times : [];
    scheduled += times.length;
    var t = day[m.id] || [];
    times.forEach(function (x) { if (t.indexOf(x) !== -1) taken += 1; });
  });
  return { scheduled: scheduled, taken: taken };
};

H.validateMed = function (o) {
  var errs = [];
  if (!o.name || !String(o.name).trim()) errs.push('name');
  if (o.qty === null || o.qty === undefined || !Number.isInteger(+o.qty) || +o.qty < 0) errs.push('qty');
  if (!H.isISODate(o.expiry)) errs.push('expiry');
  var times = (o.times || []).filter(H.isHHMM);
  if (times.length === 0 && (o.times || []).length > 0) errs.push('times');
  return errs;
};

/* ---------- health score ---------- */
H.sleepPts = function (mins) {
  var h = mins / 60;
  if (h < 4 || h > 11) return 0;
  if (h < 7) return H.round2(25 * (h - 4) / 3);
  if (h <= 9) return 25;
  return H.round2(25 * (1 - (h - 9) / 2));
};

H.bmiPts = function (bmiValue) {
  if (bmiValue === null || bmiValue === undefined) return null;
  if (bmiValue >= 18.5 && bmiValue < 25) return 25;
  if ((bmiValue >= 17 && bmiValue < 18.5) || (bmiValue >= 25 && bmiValue < 27)) return 15;
  if ((bmiValue >= 15 && bmiValue < 17) || (bmiValue >= 27 && bmiValue < 30)) return 8;
  return 4;
};

H.healthScore = function (state, iso) {
  var parts = [];

  /* 1. water */
  var wTotal = H.dayTotal(state.water && state.water.days, iso);
  var goal = (state.water && state.water.goalMl) || H.DEFAULT_GOAL_ML;
  if (wTotal > 0) {
    parts.push({ key: 'water', pts: H.round2(25 * Math.min(1, wTotal / goal)), max: 25,
      detail: wTotal + ' / ' + goal + ' ml' });
  }

  /* 2. sleep (entry keyed by bedtime date) */
  var sEntry = (state.sleep && state.sleep.entries || {})[iso];
  if (sEntry && H.isHHMM(sEntry.bed) && H.isHHMM(sEntry.wake)) {
    var mins = H.sleepDurationMin(sEntry.bed, sEntry.wake);
    parts.push({ key: 'sleep', pts: H.sleepPts(mins), max: 25,
      detail: H.fmtDuration(mins) });
  }

  /* 3. BMI */
  var p = state.profile || {};
  var b = H.bmi(p.weightKg, p.heightCm);
  if (b !== null) {
    parts.push({ key: 'bmi', pts: H.bmiPts(b), max: 25,
      detail: 'BMI ' + b + ' (' + H.bmiCategory(b) + ')' });
  }

  /* 4. medicine */
  var dt = H.dayDoseTotals(state.meds && state.meds.list, state.meds && state.meds.taken, iso);
  if (dt.scheduled > 0) {
    parts.push({ key: 'meds', pts: H.round2(25 * dt.taken / dt.scheduled), max: 25,
      detail: dt.taken + ' / ' + dt.scheduled + ' doses' });
  }

  if (parts.length === 0) return { score: null, parts: parts };
  var sum = parts.reduce(function (s, x) { return s + x.pts; }, 0);
  return { score: Math.round((sum * 4) / parts.length), parts: parts };
};

/* ---------- export / import ---------- */
H.EXPORT_VERSION = 1;
H.EXPORT_APP = 'health-os-bd';

H.defaultState = function () {
  return {
    v: H.EXPORT_VERSION,
    app: H.EXPORT_APP,
    lang: 'en',
    profile: { sex: 'male', ageYears: null, heightCm: null, weightKg: null, unit: 'metric' },
    water: { goalMl: H.DEFAULT_GOAL_ML, days: {} },
    sleep: { entries: {} },
    meds: { list: [], taken: {} }
  };
};

/* Returns {ok, state} or {ok:false, error}. Never mutates the caller's state on failure. */
H.sanitizeImport = function (raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'not-object' };
  if (raw.app !== H.EXPORT_APP) return { ok: false, error: 'not-health-os-bd' };
  if (!raw || typeof raw.v !== 'number') return { ok: false, error: 'bad-version' };

  var s = H.defaultState();
  if (raw.lang === 'bn' || raw.lang === 'en') s.lang = raw.lang;

  /* profile */
  var pr = raw.profile || {};
  s.profile = {
    sex: pr.sex === 'female' ? 'female' : 'male',
    ageYears: (typeof pr.ageYears === 'number' && pr.ageYears >= 5 && pr.ageYears <= 120) ? Math.round(pr.ageYears) : null,
    heightCm: (typeof pr.heightCm === 'number' && pr.heightCm >= 50 && pr.heightCm <= 250) ? pr.heightCm : null,
    weightKg: (typeof pr.weightKg === 'number' && pr.weightKg >= 15 && pr.weightKg <= 400) ? pr.weightKg : null,
    unit: pr.unit === 'imperial' ? 'imperial' : 'metric'
  };

  /* water */
  var w = raw.water || {};
  var g = H.validateGoal(w.goalMl);
  s.water.goalMl = g.ok ? g.value : H.DEFAULT_GOAL_ML;
  s.water.days = {};
  Object.keys(w.days || {}).forEach(function (k) {
    if (!H.isISODate(k)) return;
    var d = w.days[k] || {};
    var log = Array.isArray(d.log) ? d.log.filter(function (e) {
      return e && typeof e.ml === 'number' && e.ml > 0 && e.ml <= H.MAX_SINGLE_ML;
    }) : [];
    if (log.length) s.water.days[k] = { total: log.reduce(function (a, e) { return a + e.ml; }, 0), log: log };
  });

  /* sleep */
  var sl = raw.sleep || {};
  s.sleep.entries = {};
  Object.keys(sl.entries || {}).forEach(function (k) {
    if (!H.isISODate(k)) return;
    var e = sl.entries[k] || {};
    if (!H.isHHMM(e.bed) || !H.isHHMM(e.wake)) return;
    if (H.sleepDurationMin(e.bed, e.wake) <= 0) return;
    s.sleep.entries[k] = {
      bed: e.bed, wake: e.wake,
      quality: (typeof e.quality === 'number' && e.quality >= 1 && e.quality <= 5) ? Math.round(e.quality) : null,
      note: typeof e.note === 'string' ? e.note.slice(0, 280) : ''
    };
  });

  /* meds */
  var md = raw.meds || {};
  s.meds.list = [];
  var seen = {};
  (Array.isArray(md.list) ? md.list : []).forEach(function (m) {
    if (!m || typeof m !== 'object') return;
    var id = String(m.id || '');
    if (!id || seen[id]) return;
    if (!m.name || !String(m.name).trim()) return;
    if (!H.isISODate(m.expiry)) return;
    var times = (Array.isArray(m.times) ? m.times : []).filter(H.isHHMM);
    seen[id] = true;
    s.meds.list.push({
      id: id,
      name: String(m.name).slice(0, 120),
      strength: typeof m.strength === 'string' ? m.strength.slice(0, 60) : '',
      qty: (typeof m.qty === 'number' && m.qty >= 0) ? Math.floor(m.qty) : 0,
      expiry: m.expiry,
      forWhom: typeof m.forWhom === 'string' ? m.forWhom.slice(0, 60) : '',
      times: times,
      low: (typeof m.low === 'number' && m.low >= 0) ? Math.floor(m.low) : 5
    });
  });
  s.meds.taken = {};
  Object.keys(md.taken || {}).forEach(function (k) {
    if (!H.isISODate(k)) return;
    var day = md.taken[k] || {};
    var clean = {};
    Object.keys(day).forEach(function (mid) {
      if (!seen[mid]) return;
      var arr = (Array.isArray(day[mid]) ? day[mid] : []).filter(H.isHHMM);
      if (arr.length) clean[mid] = arr;
    });
    if (Object.keys(clean).length) s.meds.taken[k] = clean;
  });

  return { ok: true, state: s };
};

H.buildExport = function (state) {
  var s = state || H.defaultState();
  return {
    app: H.EXPORT_APP,
    v: H.EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    lang: s.lang,
    profile: s.profile,
    water: s.water,
    sleep: s.sleep,
    meds: s.meds
  };
};

/* weekly trend rows: 7 days ending at `endISO` */
H.weekRows = function (state, endISO) {
  var rows = [];
  for (var i = 6; i >= 0; i--) {
    var d = H.shiftISO(endISO, -i);
    var hs = H.healthScore(state, d);
    var sleepE = (state.sleep && state.sleep.entries || {})[d];
    rows.push({
      iso: d,
      label: H.shortDate(d),
      waterMl: H.dayTotal(state.water && state.water.days, d),
      sleepMin: sleepE ? H.sleepDurationMin(sleepE.bed, sleepE.wake) : null,
      sleepQuality: sleepE ? sleepE.quality : null,
      score: hs.score
    });
  }
  return rows;
};

H.sleepStats = function (state, endISO, days) {
  var mins = [], quals = [], n = 0;
  for (var i = 0; i < days; i++) {
    var d = H.shiftISO(endISO, -i);
    var e = (state.sleep && state.sleep.entries || {})[d];
    if (e && H.isHHMM(e.bed) && H.isHHMM(e.wake)) {
      n++;
      mins.push(H.sleepDurationMin(e.bed, e.wake));
      if (typeof e.quality === 'number') quals.push(e.quality);
    }
  }
  if (!n) return { nights: 0, avgMin: null, avgQuality: null };
  var avgMin = Math.round(mins.reduce(function (a, b) { return a + b; }, 0) / n);
  var avgQ = quals.length ? H.round2(quals.reduce(function (a, b) { return a + b; }, 0) / quals.length) : null;
  return { nights: n, avgMin: avgMin, avgQuality: avgQ };
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = H;
}
