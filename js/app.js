/* health-os-bd — UI wiring. Depends on js/logic.js (global H) and js/i18n.js (global HealthOsI18n). */
'use strict';
(function () {
  var L = window.H;
  var STR = window.HealthOsI18n;
  var STORE_KEY = 'healthosbd.v1';
  var RING_C = 326.73;   /* 2*pi*52 */
  var GAUGE_C = 282.74;  /* pi*90 */

  /* ---------------- today (?asof=YYYY-MM-DD freezes it for deterministic QA) ---------------- */
  function asofParam() {
    var m = /[?&]asof=(\d{4}-\d{2}-\d{2})/.exec(location.search);
    return (m && L.isISODate(m[1])) ? m[1] : null;
  }
  var ASOF = asofParam();
  function todayISO() {
    if (ASOF) return ASOF;
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------------- state ---------------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return L.defaultState();
      var s = JSON.parse(raw);
      var r = L.sanitizeImport(s.app ? s : Object.assign({ app: 'health-os-bd', v: 1 }, s));
      return r.ok ? r.state : L.defaultState();
    } catch (e) { return L.defaultState(); }
  }
  var state = load();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }

  /* ---------------- helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function lang() { return state.lang === 'bn' ? 'bn' : 'en'; }
  function t(k) { var s = STR[lang()] || STR.en; return s[k] !== undefined ? s[k] : STR.en[k]; }
  function n(v) { return L.fmtNum(v, lang()); }
  function tpl(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? o[k] : m; }); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function nowHHMM() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  /* accept Bengali digits in HH:MM inputs */
  function normTime(s) {
    var c = String(s || '').replace(/[০-৯]/g, function (d) { return String(L.BN_DIGITS.indexOf(d)); }).trim();
    return L.isHHMM(c) ? c : null;
  }
  function fmtDur(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return n(h) + 'h ' + n(String(m).padStart(2, '0')) + 'm';
  }
  function dayLabel(iso) {
    var wd = lang() === 'bn' ? L.weekdayNameBN(iso) : L.weekdayNameEN(iso);
    return wd + ' ' + n(L.shortDate(iso).replace(/[A-Za-z]+/, function (mo) { return mo; }));
  }
  function toast(msgId, text) {
    var el = $(msgId); el.textContent = text; el.hidden = false;
    clearTimeout(el._t); el._t = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function errBox(id, text) { var el = $(id); el.textContent = text || ''; el.hidden = !text; }

  /* two-tap confirm for destructive buttons */
  function armConfirm(btn, idleText, armedText, action) {
    if (btn._armed) { btn._armed = false; btn.textContent = idleText; action(); return; }
    btn._armed = true; btn.textContent = armedText;
    setTimeout(function () { if (btn._armed) { btn._armed = false; btn.textContent = idleText; } }, 4000);
  }

  /* ---------------- i18n: static labels ---------------- */
  function applyLang() {
    document.documentElement.lang = lang() === 'bn' ? 'bn' : 'en';
    $('langBtn').textContent = STR[lang()].langName;
    $('appTitle').textContent = t('appTitle');
    $('tagline').textContent = t('tagline');
    $('disclaimer').textContent = '⚕ ' + t('disclaimer');
    $('disclaimerFoot').textContent = '⚕ ' + t('disclaimer');
    $('footNote').textContent = t('footNote');
    var tabs = ['dashboard', 'body', 'water', 'sleep', 'meds', 'trends', 'data'];
    var keys = { dashboard: 'tabDashboard', body: 'tabBody', water: 'tabWater', sleep: 'tabSleep', meds: 'tabMeds', trends: 'tabTrends', data: 'tabData' };
    tabs.forEach(function (k) {
      document.querySelector('#tabs button[data-tab="' + k + '"]').textContent = t(keys[k]);
    });
    /* dashboard */
    $('scoreTitle').textContent = t('scoreTitle');
    $('breakdownTitle').textContent = t('breakdown');
    $('howScore').textContent = t('howScore');
    $('howScoreBody').textContent = t('howScoreBody');
    $('weeklyMiniTitle').textContent = t('weeklyMini');
    $('quickStatsTitle').textContent = t('tabDashboard');
    /* body */
    $('bodyTitle').textContent = t('bodyTitle');
    var us = document.querySelectorAll('#unitSeg button');
    us[0].textContent = t('unitMetric'); us[1].textContent = t('unitImperial');
    $('sexLabel').textContent = t('sex');
    $('fSex').options[0].textContent = t('male'); $('fSex').options[1].textContent = t('female');
    $('ageLabel').textContent = t('age');
    syncUnitLabels();
    $('saveBodyBtn').textContent = t('saveBody');
    $('bmiLabel').textContent = t('bmiLabel');
    $('bmrLabel').textContent = t('bmrLabel');
    $('tdeeLabel').textContent = t('tdeeLabel');
    $('healthyRangeLabel').textContent = t('healthyRange');
    /* water */
    $('waterTitle').textContent = t('waterTitle');
    $('quickAddTitle').textContent = t('quickAdd');
    $('customMl').placeholder = t('addCustom');
    $('addCustomBtn').textContent = t('add');
    $('goalLabel').textContent = t('goalLabel');
    $('saveGoalBtn').textContent = t('saveGoal');
    $('todayLogTitle').textContent = t('todayLog');
    $('last7Title').textContent = t('last7');
    /* sleep */
    $('sleepTitle').textContent = t('sleepTitle');
    $('bedDateLabel').textContent = t('bedDate');
    $('bedLabel').textContent = t('bedtime');
    $('wakeLabel').textContent = t('wakeTime');
    $('qualityLabel').textContent = t('quality');
    $('fNote').placeholder = t('notePh');
    $('noteLabel').textContent = t('note');
    $('midnightHint').textContent = t('midnightHint');
    $('saveSleepBtn').textContent = $('sleepEditId').value ? t('updateEntry') : t('saveEntry');
    $('cancelSleepBtn').textContent = t('cancelEdit');
    $('statsTitle').textContent = t('statsTitle');
    $('recentTitle').textContent = t('recentEntries');
    /* meds */
    $('medsTitle').textContent = t('medsTitle');
    $('scheduleTitle').textContent = t('scheduleTitle');
    $('addMedTitle').textContent = t('addMedTitle');
    $('mNameLabel').textContent = t('fName'); $('mName').placeholder = t('fNamePh');
    $('mStrengthLabel').textContent = t('fStrength'); $('mStrength').placeholder = t('fStrengthPh');
    $('mQtyLabel').textContent = t('fQty');
    $('mExpiryLabel').textContent = t('fExpiry');
    $('mTimesLabel').textContent = t('fTimes'); $('mTimes').placeholder = t('fTimesPh');
    $('mForLabel').textContent = t('fFor'); $('mFor').placeholder = t('fForPh');
    $('mLowLabel').textContent = t('fLow');
    $('addMedBtn').textContent = t('addMed');
    $('cabinetTitle').textContent = t('cabinetTitle');
    /* trends */
    $('trendsTitle').textContent = t('trendsTitle');
    $('colDay').textContent = t('colDay'); $('colWater').textContent = t('colWater');
    $('colSleep').textContent = t('colSleep'); $('colScore').textContent = t('colScore');
    /* data */
    $('dataTitle').textContent = t('dataTitle');
    $('exportBtn').textContent = t('exportBtn');
    $('importBtn').textContent = t('importBtn');
    $('storageNote').textContent = t('storageNote');
    resetBtnIdle();
    syncQualityHint();
  }

  function syncUnitLabels() {
    var imp = state.profile.unit === 'imperial';
    $('heightWrap').hidden = imp;
    $('heightImpWrap').hidden = !imp;
    $('heightLabel').textContent = t('height') + ' (' + t('cm') + ')';
    $('heightImpLabel').textContent = t('height') + ' (' + t('ft') + ' / ' + t('inch') + ')';
    $('fHeightFt').placeholder = t('ft'); $('fHeightIn').placeholder = t('inch');
    $('weightLabel').textContent = t('weight') + ' (' + (imp ? t('lb') : t('kg')) + ')';
  }

  function resetBtnIdle() { var b = $('resetBtn'); b._armed = false; b.textContent = t('resetBtn'); }

  function syncQualityHint() {
    var q = +($('stars')._q || 0);
    $('qualityHint').textContent = q ? tpl(t('starSet'), { n: n(q) }) + ' — ' + t('q' + q) : '';
  }

  /* ---------------- dashboard ---------------- */
  function renderDashboard() {
    var iso = todayISO();
    var hs = L.healthScore(state, iso);
    var ring = $('scoreRing');
    if (hs.score === null) {
      $('scoreNum').textContent = t('noDataDash');
      ring.style.strokeDashoffset = RING_C;
      $('scoreEmpty').innerHTML = '<h3>' + esc(t('scoreEmptyTitle')) + '</h3><p class="muted">' + esc(t('scoreEmptyBody')) + '</p>';
      $('breakdown').innerHTML = '';
    } else {
      $('scoreNum').textContent = n(hs.score);
      ring.style.strokeDashoffset = RING_C * (1 - hs.score / 100);
      $('scoreEmpty').innerHTML = '';
      var names = { water: t('compWater'), sleep: t('compSleep'), bmi: t('compBmi'), meds: t('compMeds') };
      $('breakdown').innerHTML = hs.parts.map(function (p) {
        return '<div class="breakrow"><span>' + esc(names[p.key]) + '</span>' +
          '<span class="breakbar"><i style="width:' + Math.round(p.pts / 25 * 100) + '%"></i></span>' +
          '<span class="pts">' + n(p.pts) + '/25</span></div>' +
          '<div class="muted small" style="margin:-.2rem 0 .4rem 7rem">' + esc(p.detail) + '</div>';
      }).join('');
    }
    /* weekly mini chart of score */
    var rows = L.weekRows(state, iso);
    $('miniChart').innerHTML = rows.map(function (r) {
      var h = r.score === null ? 2 : Math.max(4, r.score);
      var cls = r.score === null ? 'amber' : '';
      return '<div class="bar"><div class="fill ' + cls + '" style="height:' + h + '%" title="' + n(r.score === null ? 0 : r.score) + '"></div>' +
        '<div class="lbl">' + esc(dayLabel(r.iso).split(' ')[0]) + '</div></div>';
    }).join('');

    /* quick stats */
    var wTotal = L.dayTotal(state.water.days, iso);
    var goal = state.water.goalMl;
    var yest = L.sleepStats(state, L.shiftISO(iso, -1), 1);
    var dt = L.dayDoseTotals(state.meds.list, state.meds.taken, iso);
    var b = L.bmi(state.profile.weightKg, state.profile.heightCm);
    var cells = [
      [t('statWater'), n(wTotal) + ' / ' + n(goal) + ' ml'],
      [t('statSleep'), yest.nights ? fmtDur(yest.avgMin) : t('noDataDash')],
      [t('statMeds'), n(dt.taken) + ' / ' + n(dt.scheduled)],
      [t('statBmi'), b === null ? t('noDataDash') : n(b)]
    ];
    $('quickStats').innerHTML = cells.map(function (c) {
      return '<div class="stat"><div class="k">' + esc(c[0]) + '</div><div class="v">' + esc(c[1]) + '</div></div>';
    }).join('');
  }

  /* ---------------- body ---------------- */
  function renderBodyForm() {
    var p = state.profile;
    $('fSex').value = p.sex;
    $('fAge').value = p.ageYears === null ? '' : p.ageYears;
    var imp = p.unit === 'imperial';
    document.querySelectorAll('#unitSeg button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.unit === p.unit);
    });
    if (imp && p.heightCm) {
      var totalIn = p.heightCm / L.CM_PER_IN;
      $('fHeightFt').value = Math.floor(totalIn / 12);
      $('fHeightIn').value = L.round2(totalIn % 12);
      $('fWeight').value = p.weightKg === null ? '' : L.kgToLb(p.weightKg);
    } else {
      $('fHeight').value = p.heightCm === null ? '' : p.heightCm;
      $('fWeight').value = p.weightKg === null ? '' : p.weightKg;
    }
    syncUnitLabels();
    renderBodyResults();
  }

  function renderBodyResults() {
    var p = state.profile;
    var box = $('bodyResults');
    var bmi = L.bmi(p.weightKg, p.heightCm);
    if (bmi === null || p.ageYears === null) { box.hidden = true; return; }
    box.hidden = false;
    $('bmiNum').textContent = n(bmi.toFixed(2));
    var cat = L.bmiCategory(bmi);
    $('bmiCat').textContent = t('cat' + cat[0].toUpperCase() + cat.slice(1));
    /* gauge: bmi 14..34 -> 0..1 */
    var frac = Math.min(1, Math.max(0, (bmi - 14) / 20));
    $('bmiGauge').style.strokeDashoffset = GAUGE_C * (1 - frac);
    var bmr = L.bmr(p.sex, p.weightKg, p.heightCm, p.ageYears);
    $('bmrNum').textContent = n(bmr.toFixed(0)) + ' ' + t('kcalDay');
    var actKeys = { sedentary: 'actSedentary', light: 'actLight', moderate: 'actModerate', active: 'actActive', extra: 'actExtra' };
    $('tdeeList').innerHTML = L.tdee(bmr).map(function (x) {
      return '<div class="kv"><span>' + esc(t(actKeys[x.key])) + ' ×' + x.factor + '</span><b>' + n(x.kcal.toFixed(0)) + ' ' + t('kcalDay') + '</b></div>';
    }).join('');
    var r = L.healthyWeightRange(p.heightCm);
    $('healthyRangeNum').textContent = n(r.min.toFixed(1)) + ' – ' + n(r.max.toFixed(1)) + ' ' + t('kg');
  }

  function saveBody(ev) {
    ev.preventDefault();
    errBox('bodyErr');
    var imp = state.profile.unit === 'imperial';
    var age = L.parseWhole($('fAge').value);
    var heightCm, weightKg, bad = [];
    if (imp) {
      var ft = L.parseWhole($('fHeightFt').value), inch = parseFloat(String($('fHeightIn').value).trim());
      if (ft === null || isNaN(inch) || inch < 0 || inch >= 12) bad.push('h'); else heightCm = L.inToCm(ft * 12 + inch);
      var lb = parseFloat(String($('fWeight').value).trim());
      if (!(lb > 0)) bad.push('w'); else weightKg = L.lbToKg(lb);
    } else {
      heightCm = parseFloat(String($('fHeight').value).trim());
      weightKg = parseFloat(String($('fWeight').value).trim());
      if (!(heightCm > 0)) bad.push('h');
      if (!(weightKg > 0)) bad.push('w');
    }
    if (!(age >= 5 && age <= 120)) bad.push('a');
    ['fAge', 'fHeight', 'fWeight', 'fHeightFt', 'fHeightIn'].forEach(function (id) { $(id).classList.remove('bad'); });
    if (bad.length || L.validateBody({ sex: $('fSex').value, ageYears: age, heightCm: heightCm, weightKg: weightKg }).length) {
      errBox('bodyErr', t('errBody'));
      if (bad.indexOf('a') !== -1) $('fAge').classList.add('bad');
      if (bad.indexOf('h') !== -1) { $('fHeight').classList.add('bad'); $('fHeightFt').classList.add('bad'); }
      if (bad.indexOf('w') !== -1) $('fWeight').classList.add('bad');
      return;
    }
    state.profile = { sex: $('fSex').value, ageYears: age, heightCm: L.round2(heightCm), weightKg: L.round2(weightKg), unit: state.profile.unit };
    save(); renderBodyResults(); renderDashboard(); renderTrends();
    toast('bodyMsg', t('bodySaved'));
  }

  /* ---------------- water ---------------- */
  function renderWater() {
    var iso = todayISO();
    var total = L.dayTotal(state.water.days, iso);
    var goal = state.water.goalMl;
    $('waterNum').textContent = n(total);
    $('waterRing').style.strokeDashoffset = RING_C * (1 - L.ringFraction(total, goal));
    $('waterOfGoal').textContent = n(L.progressPct(total, goal)) + '% ' + t('ofGoal') + ' · ' + n(goal) + ' ml';
    $('quickBtns').innerHTML = '';
    L.QUICK_ML.forEach(function (ml) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn'; b.textContent = '+' + n(ml);
      b.onclick = function () { addWater(ml); };
      $('quickBtns').appendChild(b);
    });
    $('goalMl').value = goal;
    var day = state.water.days[iso];
    var log = (day && day.log) || [];
    $('waterLog').innerHTML = log.map(function (e, i) {
      return '<li><span class="grow">💧 ' + n(e.ml) + ' ml</span><span class="time">' + esc(e.t || '') + '</span>' +
        '<button type="button" class="btn mini" data-i="' + i + '">' + esc(t('remove')) + '</button></li>';
    }).join('');
    $('waterLogEmpty').textContent = log.length ? '' : t('emptyLog');
    Array.prototype.forEach.call($('waterLog').querySelectorAll('button'), function (b) {
      b.onclick = function () {
        var d = state.water.days[iso];
        if (d && d.log[b.dataset.i]) { d.log.splice(+b.dataset.i, 1); d.total = d.log.reduce(function (s, e) { return s + e.ml; }, 0); }
        save(); renderWater(); renderDashboard(); renderTrends();
        toast('waterMsg', t('removed'));
      };
    });
    var rows = L.weekRows(state, iso);
    var anyW = rows.some(function (r) { return r.waterMl > 0; });
    $('waterHistEmpty').textContent = anyW ? '' : t('emptyHistory');
    var max = Math.max.apply(null, rows.map(function (r) { return r.waterMl; }).concat([1]));
    $('waterHist').innerHTML = rows.map(function (r) {
      var h = Math.max(3, Math.round(r.waterMl / max * 100));
      return '<div class="bar"><div class="fill blue" style="height:' + h + '%" title="' + n(r.waterMl) + ' ml"></div>' +
        '<div class="lbl">' + esc(dayLabel(r.iso).split(' ')[0]) + '</div></div>';
    }).join('');
  }

  function addWater(ml) {
    var iso = todayISO();
    var v = L.validateAmount(ml);
    if (!v.ok) { errBox('waterErr', t('invalidAmount')); return; }
    errBox('waterErr');
    var d = state.water.days[iso] || (state.water.days[iso] = { total: 0, log: [] });
    d.log.push({ ml: v.value, t: nowHHMM() });
    d.total += v.value;
    save(); renderWater(); renderDashboard(); renderTrends();
    toast('waterMsg', '+' + n(v.value) + ' ml ' + t('added'));
  }

  /* ---------------- sleep ---------------- */
  var QUALITY = 0;
  function renderSleep() {
    var iso = todayISO();
    if (!$('sleepEditId').value) $('fBedDate').value = iso;
    var rows = [];
    for (var i = 0; i < 14; i++) {
      var d = L.shiftISO(iso, -i);
      var e = state.sleep.entries[d];
      if (e) rows.push({ iso: d, e: e });
    }
    $('sleepList').innerHTML = rows.map(function (r) {
      var mins = L.sleepDurationMin(r.e.bed, r.e.wake);
      return '<li><span class="grow">🛏 ' + esc(dayLabel(r.iso)) +
        '<br><span class="time">' + n(r.e.bed) + ' → ' + n(r.e.wake) + ' · ' + fmtDur(mins) +
        (r.e.quality ? ' · ' + '★'.repeat(r.e.quality) : '') +
        (r.e.note ? ' · ' + esc(r.e.note) : '') + '</span></span>' +
        '<button type="button" class="btn mini" data-edit="' + r.iso + '">' + esc(t('edit')) + '</button>' +
        '<button type="button" class="btn mini" data-del="' + r.iso + '">' + esc(t('del')) + '</button></li>';
    }).join('');
    $('sleepEmpty').textContent = rows.length ? '' : t('emptySleep');
    Array.prototype.forEach.call($('sleepList').querySelectorAll('button[data-edit]'), function (b) {
      b.onclick = function () { editSleep(b.dataset.edit); };
    });
    Array.prototype.forEach.call($('sleepList').querySelectorAll('button[data-del]'), function (b) {
      b.onclick = function () { armConfirm(b, t('del'), t('confirmDelete'), function () { delSleep(b.dataset.del); }); };
    });
    var st = L.sleepStats(state, iso, 7);
    $('sleepStats').innerHTML =
      stat(t('nightsLogged'), st.nights ? n(st.nights) : t('noDataDash')) +
      stat(t('avgSleep'), st.avgMin === null ? t('noDataDash') : fmtDur(st.avgMin)) +
      stat(t('avgQuality'), st.avgQuality === null ? t('noDataDash') : n(st.avgQuality.toFixed(1)) + ' ★');
  }
  function stat(k, v) { return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + '</div></div>'; }

  function editSleep(iso) {
    var e = state.sleep.entries[iso];
    if (!e) return;
    $('sleepEditId').value = iso;
    $('fBedDate').value = iso; $('fBed').value = e.bed; $('fWake').value = e.wake;
    $('fNote').value = e.note || '';
    QUALITY = e.quality || 0; paintStars(); syncQualityHint();
    $('saveSleepBtn').textContent = t('updateEntry');
    $('cancelSleepBtn').hidden = false;
    window.scrollTo(0, 0);
  }

  function delSleep(iso) {
    delete state.sleep.entries[iso];
    save(); renderSleep(); renderDashboard(); renderTrends();
    toast('sleepMsg', t('entryDeleted'));
  }

  function cancelSleepEdit() {
    $('sleepEditId').value = '';
    $('fBed').value = ''; $('fWake').value = ''; $('fNote').value = '';
    QUALITY = 0; paintStars(); syncQualityHint();
    $('fBedDate').value = todayISO();
    $('saveSleepBtn').textContent = t('saveEntry');
    $('cancelSleepBtn').hidden = true;
  }

  function paintStars() {
    Array.prototype.forEach.call($('stars').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', +b.dataset.q <= QUALITY);
    });
    $('stars')._q = QUALITY;
  }

  function saveSleep(ev) {
    ev.preventDefault();
    errBox('sleepErr');
    var iso = $('fBedDate').value;
    var bed = normTime($('fBed').value), wake = normTime($('fWake').value);
    if (!L.isISODate(iso) || !bed || !wake) { errBox('sleepErr', t('errSleepInvalid')); return; }
    if (L.sleepDurationMin(bed, wake) === 0) { errBox('sleepErr', t('errSleepZero')); return; }
    var editId = $('sleepEditId').value;
    state.sleep.entries[iso] = { bed: bed, wake: wake, quality: QUALITY || null, note: $('fNote').value.trim().slice(0, 280) };
    if (editId && editId !== iso) delete state.sleep.entries[editId];
    save(); cancelSleepEdit(); renderSleep(); renderDashboard(); renderTrends();
    toast('sleepMsg', editId ? t('entryUpdated') : t('entrySaved'));
  }

  /* ---------------- meds ---------------- */
  function renderMeds() {
    var iso = todayISO();
    var list = state.meds.list;
    /* alerts */
    var nExp = 0, nSoon = 0, nLow = 0;
    list.forEach(function (m) {
      var st = L.expiryStatus(m.expiry, iso);
      if (st === 'expired') nExp++;
      else if (st === 'soon') nSoon++;
      if (m.qty <= m.low) nLow++;
    });
    var al = [];
    if (nExp) al.push('<span class="alert red">' + esc(tpl(t('alertExpired'), { n: n(nExp) })) + '</span>');
    if (nSoon) al.push('<span class="alert amber">' + esc(tpl(t('alertSoon'), { n: n(nSoon) })) + '</span>');
    if (nLow) al.push('<span class="alert orange">' + esc(tpl(t('alertLow'), { n: n(nLow) })) + '</span>');
    $('medAlerts').innerHTML = al.join('');

    /* today's schedule */
    var taken = state.meds.taken[iso] || {};
    var items = [];
    list.forEach(function (m) {
      (m.times || []).forEach(function (tm) {
        var isTaken = (taken[m.id] || []).indexOf(tm) !== -1;
        items.push({ med: m, time: tm, taken: isTaken });
      });
    });
    items.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
    $('scheduleList').innerHTML = items.map(function (it) {
      return '<li class="' + (it.taken ? 'done' : '') + '">' +
        '<input type="checkbox" class="check" data-mid="' + esc(it.med.id) + '" data-time="' + it.time + '"' + (it.taken ? ' checked' : '') +
        ' aria-label="' + esc(it.med.name + ' ' + it.time) + '">' +
        '<span class="grow">💊 ' + esc(it.med.name) + (it.med.strength ? ' <span class="muted small">' + esc(it.med.strength) + '</span>' : '') +
        '</span><span class="time">' + n(it.time) + '</span></li>';
    }).join('');
    $('scheduleEmpty').textContent = items.length ? '' : t('scheduleEmpty');
    Array.prototype.forEach.call($('scheduleList').querySelectorAll('input.check'), function (c) {
      c.onchange = function () { toggleDose(c.dataset.mid, c.dataset.time, c.checked); };
    });

    /* cabinet */
    var sorted = list.slice().sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; });
    var badgeCls = { expired: 'expired', soon: 'soon', ok: 'ok' };
    var badgeTxt = { expired: t('badgeExpired'), soon: t('badgeSoon'), ok: t('badgeOk') };
    $('medList').innerHTML = sorted.map(function (m) {
      var st = L.expiryStatus(m.expiry, iso);
      var dLeft = L.daysUntilExpiry(m.expiry, iso);
      var expNote = st === 'expired' ? t('expiredOn') + ' ' + m.expiry
        : t('expiresIn') + ' ' + n(Math.max(0, dLeft)) + ' ' + t('daysWord');
      return '<li><span class="grow">💊 <b>' + esc(m.name) + '</b>' +
        (m.strength ? ' <span class="muted small">' + esc(m.strength) + '</span>' : '') +
        '<br><span class="time">' + n(m.qty) + ' ' + t('stockLeft') + ' · ' + esc(expNote) +
        (m.forWhom ? ' · ' + esc(m.forWhom) : '') + '</span> ' +
        '<span class="badge ' + badgeCls[st] + '">' + esc(badgeTxt[st]) + '</span>' +
        (m.qty <= m.low ? ' <span class="badge low">' + esc(t('lowStock')) + '</span>' : '') +
        '</span><button type="button" class="btn mini" data-delmed="' + esc(m.id) + '">' + esc(t('del')) + '</button></li>';
    }).join('');
    $('medEmpty').textContent = list.length ? '' : t('emptyMeds');
    Array.prototype.forEach.call($('medList').querySelectorAll('button[data-delmed]'), function (b) {
      b.onclick = function () { armConfirm(b, t('del'), t('confirmDelete'), function () { delMed(b.dataset.delmed); }); };
    });
  }

  function toggleDose(mid, time, checked) {
    var iso = todayISO();
    var day = state.meds.taken[iso] || (state.meds.taken[iso] = {});
    var arr = day[mid] || (day[mid] = []);
    var med = null;
    state.meds.list.forEach(function (m) { if (m.id === mid) med = m; });
    if (checked) {
      if (arr.indexOf(time) === -1) {
        arr.push(time);
        if (med && med.qty > 0) med.qty -= 1; /* marking taken reduces stock by 1 */
      }
    } else {
      var i = arr.indexOf(time);
      if (i !== -1) { arr.splice(i, 1); if (med) med.qty += 1; }
      if (!arr.length) delete day[mid];
    }
    save(); renderMeds(); renderDashboard(); renderTrends();
  }

  function delMed(id) {
    state.meds.list = state.meds.list.filter(function (m) { return m.id !== id; });
    save(); renderMeds(); renderDashboard(); renderTrends();
    toast('medMsg', t('medDeleted'));
  }

  function saveMed(ev) {
    ev.preventDefault();
    errBox('medErr');
    var name = $('mName').value.trim();
    var qty = L.parseWhole($('mQty').value);
    var expiry = $('mExpiry').value;
    var times = String($('mTimes').value).split(',').map(normTime).filter(Boolean);
    if (!name) { errBox('medErr', t('errMedName')); return; }
    if (qty === null || qty < 0) { errBox('medErr', t('errMedQty')); return; }
    if (!L.isISODate(expiry)) { errBox('medErr', t('errMedExpiry')); return; }
    var low = L.parseWhole($('mLow').value);
    state.meds.list.push({
      id: 'm' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: name.slice(0, 120),
      strength: $('mStrength').value.trim().slice(0, 60),
      qty: qty, expiry: expiry, times: times,
      forWhom: $('mFor').value.trim().slice(0, 60),
      low: low === null ? 5 : low
    });
    save(); renderMeds(); renderDashboard(); renderTrends();
    ['mName', 'mStrength', 'mQty', 'mExpiry', 'mTimes', 'mFor'].forEach(function (id) { $(id).value = ''; });
    $('mLow').value = '5';
    toast('medMsg', t('medAdded'));
  }

  /* ---------------- trends ---------------- */
  function renderTrends() {
    var iso = todayISO();
    var rows = L.weekRows(state, iso);
    var goal = state.water.goalMl;
    var anyData = rows.some(function (r) { return r.waterMl > 0 || r.sleepMin !== null || r.score !== null; });
    $('trendsEmpty').textContent = anyData ? '' : t('trendsEmpty');
    var maxW = Math.max.apply(null, rows.map(function (r) { return r.waterMl; }).concat([1]));
    var tb = $('trendTable').querySelector('tbody');
    tb.innerHTML = rows.map(function (r) {
      var wb = '<span class="tbar" style="width:' + Math.max(2, Math.round(r.waterMl / maxW * 70)) + 'px"></span> ' + n(r.waterMl);
      var sb = r.sleepMin === null ? t('noDataDash')
        : '<span class="tbar teal" style="width:' + Math.max(2, Math.round(r.sleepMin / 660 * 70)) + 'px"></span> ' + fmtDur(r.sleepMin);
      var sc = r.score === null ? t('noDataDash') : '<span class="tscore">' + n(r.score) + '</span>';
      return '<tr><td>' + esc(dayLabel(r.iso)) + '</td><td>' + wb + '</td><td>' + sb + '</td><td>' + sc + '</td></tr>';
    }).join('');
  }

  /* ---------------- data ---------------- */
  function doExport() {
    var blob = new Blob([JSON.stringify(L.buildExport(state), null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'health-os-bd-' + todayISO() + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function doImport(file) {
    var rd = new FileReader();
    rd.onload = function () {
      errBox('dataErr');
      try {
        var parsed = JSON.parse(rd.result);
        var r = L.sanitizeImport(parsed);
        if (!r.ok) throw new Error(r.error);
        state = r.state; save();
        applyLang(); renderAll();
        toast('dataMsg', t('importOk'));
      } catch (e) {
        errBox('dataErr', tpl(t('importErr'), { err: e.message }));
      }
    };
    rd.readAsText(file);
  }

  /* ---------------- tabs ---------------- */
  function showTab(name) {
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab').forEach(function (s) {
      s.classList.toggle('active', s.id === 'tab-' + name);
    });
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }

  function renderAll() {
    renderDashboard(); renderBodyForm(); renderWater(); renderSleep(); renderMeds(); renderTrends();
  }

  /* ---------------- boot ---------------- */
  function boot() {
    applyLang();
    var h = (location.hash || '').replace('#', '');
    var known = ['dashboard', 'body', 'water', 'sleep', 'meds', 'trends', 'data'];
    showTab(known.indexOf(h) !== -1 ? h : 'dashboard');

    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.onclick = function () { showTab(b.dataset.tab); };
    });
    $('langBtn').onclick = function () {
      state.lang = state.lang === 'bn' ? 'en' : 'bn';
      save(); applyLang(); renderAll();
    };
    document.querySelectorAll('#unitSeg button').forEach(function (b) {
      b.onclick = function () {
        if (state.profile.unit === b.dataset.unit) return;
        state.profile.unit = b.dataset.unit; save(); renderBodyForm();
      };
    });
    $('bodyForm').addEventListener('submit', saveBody);
    $('addCustomBtn').onclick = function () { addWater($('customMl').value); $('customMl').value = ''; };
    $('saveGoalBtn').onclick = function () {
      errBox('waterErr');
      var v = L.validateGoal($('goalMl').value);
      if (!v.ok) { errBox('waterErr', t('invalidGoal')); return; }
      state.water.goalMl = v.value; save(); renderWater(); renderDashboard(); renderTrends();
      toast('waterMsg', t('goalSaved'));
    };
    $('sleepForm').addEventListener('submit', saveSleep);
    $('cancelSleepBtn').onclick = cancelSleepEdit;
    Array.prototype.forEach.call($('stars').querySelectorAll('button'), function (b) {
      b.onclick = function () { QUALITY = +b.dataset.q; paintStars(); syncQualityHint(); };
    });
    $('medForm').addEventListener('submit', saveMed);
    $('exportBtn').onclick = doExport;
    $('importBtn').onclick = function () { $('importFile').click(); };
    $('importFile').addEventListener('change', function () {
      if (this.files[0]) doImport(this.files[0]);
      this.value = '';
    });
    $('resetBtn').onclick = function () {
      armConfirm($('resetBtn'), t('resetBtn'), t('resetConfirm'), function () {
        var langKeep = state.lang;
        state = L.defaultState(); state.lang = langKeep;
        save(); resetBtnIdle(); applyLang(); renderAll();
        toast('dataMsg', t('resetDone'));
      });
    };
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
