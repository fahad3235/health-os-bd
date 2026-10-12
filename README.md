# Health OS BD — হেলথ ওএস বিডি

A free, fully offline unified health dashboard. One place for your daily
health picture: a computed **health score (0–100)** with a transparent
breakdown, **BMI/BMR/TDEE** calculator, **water** tracking, **sleep**
logging, and a **medicine cabinet** with expiry and stock alerts — in
English or বাংলা. No accounts, no servers, no network requests.

## Problem

Health data lives in scattered places: a water reminder app, a sleep
notebook, a BMI calculator tab, medicine strips buried in a drawer.
Nobody sees the whole picture, and nobody remembers whether today's
evening dose was taken or whether that strip expired last month.
Health OS BD puts water, sleep, body metrics, and medicines on one
offline dashboard with a single daily score that explains itself.

## Features

- **Dashboard**: daily health score (0–100) computed transparently from
  today's inputs — water vs goal, sleep hours vs the 7–9h band, BMI in
  the normal range, doses taken vs scheduled. Full per-component
  breakdown with the formula printed on the page; weekly score mini-chart.
- **Body (BMI/BMR/TDEE)**: BMI with WHO category gauge, BMR via
  Mifflin-St Jeor (sex-specific), TDEE across 5 activity levels,
  healthy weight range for your height, metric/imperial toggle
  (canonical storage stays metric).
- **Water**: quick-add ml buttons (250/500/750/1000), custom amounts,
  daily goal ring, today's log with per-entry delete, 7-day bar history.
- **Sleep**: bedtime/wake entry with automatic duration (midnight
  crossing handled), 1–5 star quality rating, notes, 7-day stats
  (average, nights logged, average quality), edit/delete.
- **Medicine**: cabinet with name/strength/quantity/expiry/owner, dose
  times, and low-stock threshold; expired (red) / expiring-within-30-days
  (amber) badges; today's schedule with taken checkmarks that decrement
  stock by 1; low-stock alerts.
- **Trends**: cross-module 7-day table (water, sleep, score).
- **Data**: JSON export/import of *all* modules, localStorage
  persistence, full reset, Bengali-digit rendering in বাংলা mode.
- **Not medical advice** disclaimer shown prominently in the header and
  footer (both languages).
- Responsive mobile (≤640px) + desktop; empty states; inline
  validation; zero console errors.

## Stack

Vanilla HTML/CSS/JS. No build step, no dependencies, no frameworks, no
network requests. All health math lives in `js/logic.js` as pure
functions (no DOM, no hidden `Date.now()` — "today" is always passed in
explicitly), shared by the browser app and the Node unit tests.

## Prerequisites

Any modern browser (Chrome, Firefox, Safari, Edge). Nothing to install.
Node.js (any recent version) only if you want to run the unit tests.

## Install

No install. Open `index.html` directly in a browser, or serve the
folder:

```bash
cd health-os-bd
python3 -m http.server 8000
# then open http://localhost:8000
```

## Dev commands

```bash
node tests/unit.test.js   # 88 Node unit tests (no dependencies)
```

The browser suite needs the repo's CDP harness (system Chromium); see
Testing.

## Env

None. There are no API keys, backends, or `.env` files. The app makes
zero network requests; all data stays in the browser's localStorage
under the key `healthosbd.v1`.

## Testing

Two suites, both green:

**Node unit tests — 88/88** (`node tests/unit.test.js`, no deps).
Every expected value hand-verified independently of the code: BMI
65kg/170cm → 22.49; BMR male 25y/70kg/175cm → 1673.75; TDEE ×1.55 →
2594.31; healthy range 170cm → 53.47–71.96; 154 lb → 69.85 kg;
sleep 22:30→06:15 → 465 min; sleep-point ramps (5h → 8.33, 10h → 12.5,
3h/12h → 0); health-score formula boundaries (all-max → 100, empty →
null, water-only 12.5pts → 50, 3h sleep → 0, meds 1/3 → 33); expiry
status edges (yesterday → expired, +30d → soon, +31d → ok); water
ring/pct/validation incl. Bengali-digit input; import sanitizer
rejects wrong app / non-objects and strips unknown fields.

**Headless-Chrome UI tests — 57/57, 0 console/page errors** (CDP-driven
system Chromium over `file://`, deterministic via `?asof=2026-10-12`):
dashboard score updates as modules get data (BMI-only → 100; full flow
water+sleep+BMI+meds → 58 with 4 breakdown rows); full per-module flows
— body save/validation/imperial toggle (143.3 lb round-trip), water
quick-add/custom/goal/remove + invalid-input rejection, sleep entry
7h 45m/8h 00m stats + zero-duration rejection, meds add with soon/
expired/low-stock badges, dose checkmark 20→19 stock decrement, empty-
name rejection; trends 7-row table; EN→বাংলা toggle with Bengali
digits and back; export JSON contains all modules; clear → score "—";
import round-trip restores score 58; reload persistence across all
modules; 390px mobile — no horizontal overflow on any tab (desktop +
mobile screenshots inspected).

## Deployment

Static files — deploy anywhere. GitHub Pages compatible: repo Settings →
Pages → Deploy from branch → `main` / `(root)`. Nothing to build.

## Limitations

- **Not medical advice.** This is a personal organizer. BMI/BMR/TDEE
  are standard estimates, not diagnoses — always follow your doctor.
- Data lives in one browser's localStorage (no sync); JSON export is
  the backup path. Clearing site data deletes everything.
- Sleep entries are keyed by bedtime date; the "last night" quick stat
  reads the entry keyed yesterday.
- Marking a dose "taken" decrements stock by 1 — a convention, not a
  scale. Expiry math uses the device's local calendar; dose reminders
  are manual checkmarks, not push notifications.
- The health score weights its four components equally and only counts
  components with data — the exact formula is printed in the app.

## Status

Built and tested 2026-10-12. 88/88 Node unit tests + 57/57
headless-Chrome checks pass, zero console/page errors. Secrets and
network scans clean. Staged only — not published.
