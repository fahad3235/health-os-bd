/* health-os-bd — Node unit tests for js/logic.js. Run: node tests/unit.test.js
 * Every expected value below was hand-verified independently of the code. */
'use strict';

var H = require('../js/logic.js');

var passed = 0, failed = 0;
var failures = [];

function check(name, actual, expected) {
  var ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; }
  else { failed++; failures.push(name + '\n    expected: ' + JSON.stringify(expected) + '\n    actual:   ' + JSON.stringify(actual)); }
}

function checkClose(name, actual, expected, eps) {
  eps = eps || 0.001;
  var ok = typeof actual === 'number' && Math.abs(actual - expected) <= eps;
  if (ok) { passed++; }
  else { failed++; failures.push(name + '\n    expected ~= ' + expected + '\n    actual:   ' + actual); }
}

/* ---------- BMI ---------- */
check('bmi 65kg/170cm', H.bmi(65, 170), 22.49); // 65/(1.7^2)=22.4913 -> 22.49
check('bmi 70kg/175cm', H.bmi(70, 175), 22.86); // 70/3.0625=22.8571 -> 22.86
check('bmi 0 weight', H.bmi(0, 170), null);
check('bmi category normal', H.bmiCategory(22.49), 'normal');
check('bmi category under', H.bmiCategory(17.2), 'under');
check('bmi category over', H.bmiCategory(27.5), 'over');
check('bmi category obese', H.bmiCategory(31), 'obese');
check('bmi category 18.5 edge', H.bmiCategory(18.5), 'normal');
check('bmi category 24.9 edge', H.bmiCategory(24.9), 'normal');
check('bmi category 25 edge', H.bmiCategory(25), 'over');

/* ---------- BMR (Mifflin-St Jeor) ---------- */
// male 25y, 70kg, 175cm: 10*70 + 6.25*175 - 5*25 + 5 = 700+1093.75-125+5 = 1673.75
check('bmr male 25/70/175', H.bmr('male', 70, 175, 25), 1673.75);
// female 30y, 60kg, 160cm: 600+1000-150-161 = 1289
check('bmr female 30/60/160', H.bmr('female', 60, 160, 30), 1289);
check('bmr bad input', H.bmr('male', 0, 175, 25), null);

/* ---------- TDEE ---------- */
var td = H.tdee(1673.75);
check('tdee count', td.length, 5);
check('tdee sedentary', td[0], { key: 'sedentary', factor: 1.2, kcal: 2008.5 }); // 1673.75*1.2=2008.5
check('tdee moderate', td[2], { key: 'moderate', factor: 1.55, kcal: 2594.31 }); // 1673.75*1.55=2594.3125
check('tdee extra', td[4].kcal, 3180.13); // 1673.75*1.9=3180.125 -> 3180.13
check('tdee null', H.tdee(0), null);

/* ---------- healthy weight range ---------- */
// 170cm: 18.5*2.89=53.465 -> 53.47 ; 24.9*2.89=71.961 -> 71.96
check('healthy range 170cm', H.healthyWeightRange(170), { min: 53.47, max: 71.96 });
check('healthy range bad', H.healthyWeightRange(0), null);

/* ---------- conversions ---------- */
check('154 lb -> kg', H.lbToKg(154), 69.85); // 154*0.45359237=69.8532
check('67 in -> cm', H.inToCm(67), 170.18); // 67*2.54=170.18
checkClose('round-trip kg', H.lbToKg(H.kgToLb(70)), 70);

/* ---------- sleep duration ---------- */
check('sleep 22:30->06:15', H.sleepDurationMin('22:30', '06:15'), 465); // (6*60+15)-(22*60+30)+1440 = 465
check('sleep 23:00->07:00', H.sleepDurationMin('23:00', '07:00'), 480);
check('sleep no midnight cross 01:00->06:30', H.sleepDurationMin('01:00', '06:30'), 330);
check('sleep equal times -> 0', H.sleepDurationMin('22:00', '22:00'), 0);
check('fmtDuration 465', H.fmtDuration(465), '7h 45m');
check('fmtDuration 480', H.fmtDuration(480), '8h 00m');

/* ---------- sleep points ---------- */
check('sleepPts 8h -> 25', H.sleepPts(480), 25);
check('sleepPts 7h edge -> 25', H.sleepPts(420), 25);
check('sleepPts 9h edge -> 25', H.sleepPts(540), 25);
check('sleepPts 5h -> 8.33', H.sleepPts(300), 8.33); // 25*(5-4)/3 = 8.333
check('sleepPts 10h -> 12.5', H.sleepPts(600), 12.5); // 25*(1-0.5)
check('sleepPts 3h -> 0', H.sleepPts(180), 0);
check('sleepPts 12h -> 0', H.sleepPts(720), 0);

/* ---------- BMI points ---------- */
check('bmiPts 22.49 -> 25', H.bmiPts(22.49), 25);
check('bmiPts 17.5 -> 15', H.bmiPts(17.5), 15);
check('bmiPts 26 -> 15', H.bmiPts(26), 15);
check('bmiPts 16 -> 8', H.bmiPts(16), 8);
check('bmiPts 28 -> 8', H.bmiPts(28), 8);
check('bmiPts 32 -> 4', H.bmiPts(32), 4);
check('bmiPts null -> null', H.bmiPts(null), null);

/* ---------- expiry ---------- */
var ASOF = '2026-10-12';
check('expired yesterday', H.expiryStatus('2026-10-11', ASOF), 'expired');
check('soon +10d', H.expiryStatus('2026-10-22', ASOF), 'soon');
check('soon edge +30d', H.expiryStatus('2026-11-11', ASOF), 'soon'); // 2026-10-12+30d = 2026-11-11
check('ok +31d', H.expiryStatus('2026-11-12', ASOF), 'ok');
check('expiry today -> soon', H.expiryStatus(ASOF, ASOF), 'soon');
check('daysUntilExpiry', H.daysUntilExpiry('2026-10-22', ASOF), 10);

/* ---------- water ---------- */
check('dayTotal', H.dayTotal({ '2026-10-12': { total: 750, log: [{ ml: 500 }, { ml: 250 }] } }, '2026-10-12'), 750);
check('dayTotal missing', H.dayTotal({}, '2026-10-12'), 0);
check('ringFraction 1200/2000', H.ringFraction(1200, 2000), 0.6);
check('ringFraction over goal clamps', H.ringFraction(2500, 2000), 1);
check('progressPct', H.progressPct(1200, 2000), 60);
check('validateAmount ok', H.validateAmount('250'), { ok: true, value: 250 });
check('validateAmount bn digits', H.validateAmount('২৫০'), { ok: true, value: 250 });
check('validateAmount zero fail', H.validateAmount('0'), { ok: false, value: null });
check('validateAmount too big fail', H.validateAmount('2001'), { ok: false, value: null });
check('validateGoal ok', H.validateGoal('3000'), { ok: true, value: 3000 });
check('validateGoal too big fail', H.validateGoal('99999'), { ok: false, value: null });

/* ---------- meds ---------- */
var medList = [
  { id: 'a', times: ['08:00', '20:00'] },
  { id: 'b', times: ['09:00'] }
];
check('dayDoseTotals 1/3', H.dayDoseTotals(medList, { '2026-10-12': { a: ['08:00'] } }, '2026-10-12'),
  { scheduled: 3, taken: 1 });
check('medScheduleForDay', H.medScheduleForDay(medList[0], ['08:00']),
  [{ time: '08:00', taken: true }, { time: '20:00', taken: false }]);

/* ---------- health score ---------- */
function fullState() {
  return {
    profile: { sex: 'male', ageYears: 25, heightCm: 170, weightKg: 65 },
    water: { goalMl: 2000, days: { '2026-10-12': { total: 2000, log: [{ ml: 2000 }] } } },
    sleep: { entries: { '2026-10-12': { bed: '22:30', wake: '06:30', quality: 4 } } },
    meds: { list: [{ id: 'm1', times: ['08:00'] }], taken: { '2026-10-12': { m1: ['08:00'] } } }
  };
}
var full = H.healthScore(fullState(), '2026-10-12');
check('full health score = 100', full.score, 100);
check('full parts count', full.parts.length, 4);

var empty = H.healthScore(H.defaultState(), '2026-10-12');
check('empty health score = null', empty.score, null);
check('empty parts count', empty.parts.length, 0);

var waterOnly = H.healthScore({
  profile: {}, water: { goalMl: 2000, days: { '2026-10-12': { total: 1000, log: [{ ml: 1000 }] } } },
  sleep: { entries: {} }, meds: { list: [], taken: {} }
}, '2026-10-12');
check('water-only score (12.5*4=50)', waterOnly.score, 50); // 25*0.5=12.5, one component -> round(4*12.5)=50

var badSleep = H.healthScore({
  profile: {}, water: { goalMl: 2000, days: {} },
  sleep: { entries: { '2026-10-12': { bed: '02:00', wake: '05:00', quality: 2 } } },
  meds: { list: [], taken: {} }
}, '2026-10-12');
check('3h sleep -> score 0', badSleep.score, 0);

var medsPartial = H.healthScore({
  profile: {}, water: { goalMl: 2000, days: {} }, sleep: { entries: {} },
  meds: { list: medList, taken: { '2026-10-12': { a: ['08:00'] } } }
}, '2026-10-12');
check('meds 1/3 -> score 33', medsPartial.score, 33); // round(4*round2(25/3))=round(33.33)=33

/* ---------- digits ---------- */
check('bn digits', H.fmtNum(1234567890, 'bn'), '১২৩৪৫৬৭৮৯০');
check('en digits unchanged', H.fmtNum(123, 'en'), '123');

/* ---------- dates ---------- */
check('shiftISO -1', H.shiftISO('2026-10-12', -1), '2026-10-11');
check('shiftISO +30', H.shiftISO('2026-10-12', 30), '2026-11-11');
check('isISODate ok', H.isISODate('2026-10-12'), true);
check('isISODate bad', H.isISODate('12/10/2026'), false);

/* ---------- weekly rows / sleep stats ---------- */
var wr = H.weekRows(fullState(), '2026-10-12');
check('weekRows length 7', wr.length, 7);
check('weekRows first iso', wr[0].iso, '2026-10-06');
check('weekRows last iso', wr[6].iso, '2026-10-12');
check('weekRows last score', wr[6].score, 100);
check('weekRows first water 0', wr[0].waterMl, 0);

var st = H.sleepStats(fullState(), '2026-10-12', 7);
check('sleepStats', st, { nights: 1, avgMin: 480, avgQuality: 4 }); // 22:30->06:30 = 480
check('sleepStats empty', H.sleepStats(H.defaultState(), '2026-10-12', 7),
  { nights: 0, avgMin: null, avgQuality: null });

/* ---------- import sanitizer ---------- */
check('import wrong app', H.sanitizeImport({ app: 'other', v: 1 }).ok, false);
check('import not object', H.sanitizeImport(null), { ok: false, error: 'not-object' });
var good = H.sanitizeImport({
  app: 'health-os-bd', v: 1, lang: 'bn',
  profile: { sex: 'female', ageYears: 30, heightCm: 160, weightKg: 60 },
  water: { goalMl: 3000, days: { '2026-10-12': { total: 500, log: [{ ml: 500, t: '08:00' }] } } },
  sleep: { entries: { '2026-10-12': { bed: '23:00', wake: '07:00', quality: 5, note: 'x' } } },
  meds: { list: [{ id: 'm1', name: 'Napa', expiry: '2027-01-01', times: ['08:00'], qty: 20, junk: 1 }],
          taken: { '2026-10-12': { m1: ['08:00'] } } }
});
check('import ok', good.ok, true);
check('import lang', good.state.lang, 'bn');
check('import med sanitized', good.state.meds.list[0].junk, undefined);
check('import med qty', good.state.meds.list[0].qty, 20);

/* ---------- summary ---------- */
console.log('\nhealth-os-bd unit tests: ' + passed + ' passed, ' + failed + ' failed');
if (failures.length) {
  console.log('\nFAILURES:\n' + failures.join('\n\n'));
  process.exit(1);
}
