const fs = require('fs');
const appCode = fs.readFileSync('app.js', 'utf8');

const planCode = fs.readFileSync('data.js', 'utf8');

// We can just execute the whole thing by mocking window properly, but it's easier to just pull out the logic.
// We will test the specific functions.

let state = { days: {} };
let PLAN = { weeks: [] };

for(let w=1; w<=50; w++) {
    let week = { id: 'w'+w, days: [] };
    for(let d=1; d<=7; d++) {
        week.days.push({ id: 'w'+w+'_d'+d, exercises: [] });
    }
    PLAN.weeks.push(week);
}

// Old allDays
function allDays() {
  if (!PLAN || !Array.isArray(PLAN.weeks)) return [];
  var days = [];
  PLAN.weeks.forEach(function (week) {
    (week.days || []).forEach(function (day) {
      var ds = (state && state.days && state.days[day.id]) || {};
      var custom = Array.isArray(ds.customExercises) ? ds.customExercises : [];
      var mergedDay = custom.length
        ? Object.assign({}, day, { exercises: (day.exercises || []).concat(custom) })
        : day;
      days.push({ week: week, day: mergedDay });
    });
  });
  return days;
}

function getDayOld(id) {
  var found = allDays().find(function (entry) { return entry.day.id === id; });
  return found ? found.day : null;
}

function weekForDayIdOld(dayId) {
  var found = allDays().find(function (entry) { return entry.day.id === dayId; });
  return found ? found.week : null;
}


var _planDayIndex = null;
var _planWeekIndex = null;

function buildPlanIndexes() {
  if (_planDayIndex) return;
  _planDayIndex = {};
  _planWeekIndex = {};
  if (!PLAN || !Array.isArray(PLAN.weeks)) return;
  PLAN.weeks.forEach(function (week) {
    (week.days || []).forEach(function (day) {
      _planDayIndex[day.id] = day;
      _planWeekIndex[day.id] = week;
    });
  });
}

function getDay(id) {
  buildPlanIndexes();
  var baseDay = _planDayIndex[id];
  if (!baseDay) return null;

  var ds = (state && state.days && state.days[id]) || {};
  var custom = Array.isArray(ds.customExercises) ? ds.customExercises : [];
  if (custom.length) {
    return Object.assign({}, baseDay, { exercises: (baseDay.exercises || []).concat(custom) });
  }
  return baseDay;
}

function weekForDayId(dayId) {
  buildPlanIndexes();
  return _planWeekIndex[dayId] || null;
}


const start = performance.now();
for(let i=0; i<10000; i++) {
    weekForDayIdOld('w50_d7');
}
const end = performance.now();
console.log('Baseline weekForDayId (10k ops):', (end - start).toFixed(2), 'ms');


const start2 = performance.now();
for(let i=0; i<10000; i++) {
    weekForDayId('w50_d7');
}
const end2 = performance.now();
console.log('Optimized weekForDayId (10k ops):', (end2 - start2).toFixed(2), 'ms');


const start3 = performance.now();
for(let i=0; i<10000; i++) {
    getDayOld('w50_d7');
}
const end3 = performance.now();
console.log('Baseline getDay (10k ops):', (end3 - start3).toFixed(2), 'ms');


const start4 = performance.now();
for(let i=0; i<10000; i++) {
    getDay('w50_d7');
}
const end4 = performance.now();
console.log('Optimized getDay (10k ops):', (end4 - start4).toFixed(2), 'ms');
