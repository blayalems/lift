(function () {
  "use strict";

  var root = window.LIFT_FEATURES = window.LIFT_FEATURES || {};
  var FOODS = [
    { id: "egg", name: "Egg", proteinG: 6, serving: "1 large" },
    { id: "chicken-breast", name: "Chicken breast", proteinG: 31, serving: "100 g cooked" },
    { id: "chicken-adobo", name: "Chicken adobo", proteinG: 24, serving: "1 serving" },
    { id: "tuna", name: "Tuna", proteinG: 25, serving: "1 small can" },
    { id: "sardines", name: "Sardines", proteinG: 22, serving: "1 can" },
    { id: "bangus", name: "Bangus", proteinG: 24, serving: "100 g cooked" },
    { id: "tilapia", name: "Tilapia", proteinG: 26, serving: "100 g cooked" },
    { id: "lean-pork", name: "Lean pork", proteinG: 27, serving: "100 g cooked" },
    { id: "lean-beef", name: "Lean beef", proteinG: 26, serving: "100 g cooked" },
    { id: "tokwa", name: "Tokwa", proteinG: 10, serving: "100 g" },
    { id: "monggo", name: "Monggo", proteinG: 14, serving: "1 cup cooked" },
    { id: "milk", name: "Milk", proteinG: 8, serving: "250 ml" },
    { id: "yogurt", name: "Yogurt", proteinG: 10, serving: "1 cup" },
    { id: "whey", name: "Whey protein", proteinG: 24, serving: "1 scoop" }
  ];

  function dayBucket(state, date) {
    state.nutrition = state.nutrition && typeof state.nutrition === "object" ? state.nutrition : {};
    var row = state.nutrition[date];
    if (!row || typeof row !== "object" || Array.isArray(row)) row = { entries: [] };
    row.entries = Array.isArray(row.entries) ? row.entries : [];
    state.nutrition[date] = row;
    return row;
  }

  function foodById(id) {
    return FOODS.find(function (food) { return food.id === id; }) || null;
  }

  function addFood(state, date, food, options) {
    options = options || {};
    if (!food || !food.name) throw new Error("Choose a food.");
    var servings = Math.max(0.1, Number(options.servings == null ? 1 : options.servings) || 1);
    var protein = Number(options.proteinG == null ? food.proteinG : options.proteinG);
    if (!(protein > 0)) throw new Error("Protein must be greater than zero.");
    var entry = {
      id: options.id || "food-" + Date.now() + "-" + Math.random().toString(16).slice(2),
      foodId: food.id || "custom",
      name: String(food.name),
      serving: String(options.serving || food.serving || "1 serving"),
      servings: servings,
      proteinG: Math.round(protein * servings * 10) / 10,
      meal: /^(breakfast|lunch|dinner|snack)$/.test(options.meal) ? options.meal : "meal",
      ts: Number(options.ts || Date.now())
    };
    dayBucket(state, date).entries.push(entry);
    return entry;
  }

  function totalProtein(state, date) {
    var row = state.nutrition && state.nutrition[date];
    var entries = row && Array.isArray(row.entries) ? row.entries : [];
    return Math.round(entries.reduce(function (sum, entry) {
      return sum + Math.max(0, Number(entry.proteinG) || 0);
    }, 0) * 10) / 10;
  }

  function mealDistribution(state, date) {
    var meals = {};
    var row = state.nutrition && state.nutrition[date];
    (row && Array.isArray(row.entries) ? row.entries : []).forEach(function (entry) {
      var key = entry.meal || "meal";
      meals[key] = Math.round(((meals[key] || 0) + Number(entry.proteinG || 0)) * 10) / 10;
    });
    return meals;
  }

  function setSupplement(state, date, key, value) {
    state.supplements = state.supplements && typeof state.supplements === "object" ? state.supplements : {};
    var row = state.supplements[date] = state.supplements[date] && typeof state.supplements[date] === "object" && !Array.isArray(state.supplements[date]) ? state.supplements[date] : {};
    if (key === "wheyServings") row[key] = Math.max(0, Math.min(10, Number(value) || 0));
    else row[key] = !!value;
    return row;
  }

  function setCreatineDose(state, value) {
    state.supplementSettings = state.supplementSettings && typeof state.supplementSettings === "object" ? state.supplementSettings : {};
    var dose = Number(value);
    state.supplementSettings.creatineDoseG = dose > 0 ? Math.min(25, Math.round(dose * 10) / 10) : null;
    return state.supplementSettings.creatineDoseG;
  }

  function dailyAverage(state, endDate, days) {
    days = Math.max(1, Number(days) || 7);
    var end = new Date(endDate + "T00:00:00Z");
    var sum = 0;
    for (var i = 0; i < days; i += 1) {
      var date = new Date(end);
      date.setUTCDate(end.getUTCDate() - i);
      sum += totalProtein(state, date.toISOString().slice(0, 10));
    }
    return Math.round(sum / days * 10) / 10;
  }

  function renderNutrition(ctx) {
    var date = ctx.todayId();
    var profile = ctx.state.profile || {};
    var target = Number(profile.proteinTargetG || 130);
    var min = Number(profile.proteinRangeMinG || 120);
    var max = Number(profile.proteinRangeMaxG || 145);
    var total = totalProtein(ctx.state, date);
    var remaining = Math.max(0, target - total);
    var distribution = mealDistribution(ctx.state, date);
    var supplements = (ctx.state.supplements || {})[date] || {};
    var creatineDose = ctx.state.supplementSettings && ctx.state.supplementSettings.creatineDoseG;
    var entries = dayBucket(ctx.state, date).entries.slice().reverse();
    var html = '<div class="sheet-grid"><div class="protein-hero"><span>Protein today</span><strong>' + total + ' / ' + target + ' g</strong><div class="hero-progress"><span style="width:' + Math.min(100, total / Math.max(1, target) * 100) + '%"></span></div><p>' + remaining + ' g to the convenient center target. Your flexible range is ' + min + '-' + max + ' g.</p></div>';
    html += '<div class="overview-card"><strong>Meal distribution</strong><p>Spread protein across meals when practical; this is a planning view, not a rule.</p><div class="metric-grid">' +
      mealMetric("Breakfast", distribution.breakfast) + mealMetric("Lunch", distribution.lunch) +
      mealMetric("Dinner", distribution.dinner) + mealMetric("Snack / other", Number(distribution.snack || 0) + Number(distribution.meal || 0)) +
      '</div></div>';
    html += '<div class="overview-card"><strong>Quick add</strong><p>Approximate protein per common serving - edit with a custom entry when your portion differs.</p><div class="field-block"><label for="protein-quick-meal">Add to meal</label><select id="protein-quick-meal" data-protein-quick-meal><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option><option value="meal">Unspecified</option></select></div><div class="food-preset-grid">';
    FOODS.forEach(function (food) {
      html += '<button class="qa-preset" data-action="protein-preset" data-food="' + food.id + '"><strong>' + ctx.escapeHtml(food.name) + '</strong><small>' + food.proteinG + ' g - ' + ctx.escapeHtml(food.serving) + '</small></button>';
    });
    html += '</div></div>';
    html += '<div class="overview-card"><strong>Custom food</strong><div class="measure-input-row"><div class="field-block"><label>Name</label><input data-protein-name placeholder="Home-cooked ulam"></div><div class="field-block"><label>Protein (g)</label><input data-protein-grams type="number" min="0" step="0.5"></div><div class="field-block"><label>Meal</label><select data-protein-meal><option value="meal">Unspecified meal</option><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></div></div><div class="sheet-actions"><button class="action-btn" data-action="protein-custom">Add protein</button></div></div>';
    html += '<div class="overview-card"><strong>Optional supplements</strong><p>Simple check-ins only. Store your own usual creatine dose; Lift does not reward taking more or provide dosing advice.</p><div class="supplement-list">' +
      supplementButton("creatine", "Creatine", !!supplements.creatine) +
      '<div class="settings-row"><span class="settings-copy"><strong>Usual creatine dose</strong><span>Your reminder amount, not a progression target.</span></span><label class="settings-number"><input data-action="supplement-creatine-dose" type="number" min="0" max="25" step="0.5" placeholder="Optional" value="' + (creatineDose || "") + '"><small>g</small></label></div>' +
      supplementButton("magnesium", "Magnesium glycinate", !!supplements.magnesium) +
      '<div class="settings-row"><span class="settings-copy"><strong>Whey servings</strong><span>A convenient food supplement to fill a protein gap - not magic.</span></span><label class="settings-number"><input data-action="supplement-whey" type="number" min="0" max="10" step="1" value="' + Number(supplements.wheyServings || 0) + '"><small>servings</small></label></div></div></div>';
    html += '<div class="overview-card"><strong>Food context</strong><p>Rice and carbohydrates can support training. Lift focuses on sustainable protein, body-weight and waist trends - not food guilt or crash dieting.</p></div>';
    if (entries.length) {
      html += '<div class="overview-card"><strong>Today\'s entries</strong><table class="mini-table"><tbody>';
      entries.forEach(function (entry) { html += '<tr><td>' + ctx.escapeHtml(entry.name) + '<br><small>' + ctx.escapeHtml(entry.serving || "") + '</small></td><td>' + entry.proteinG + ' g</td><td><button class="link-btn" data-action="protein-delete" data-id="' + ctx.escapeHtml(entry.id) + '">Delete</button></td></tr>'; });
      html += '</tbody></table></div>';
    }
    return html + '</div>';
  }

  function supplementButton(key, label, active) {
    return '<button class="settings-row settings-row-button" data-action="supplement-toggle" data-supplement="' + key + '" data-value="' + String(!active) + '"><span class="settings-copy"><strong>' + label + '</strong><span>Optional daily check-in</span></span><span class="switch-control" data-active="' + String(active) + '"><span></span></span></button>';
  }

  function mealMetric(label, value) {
    return '<div class="metric-card"><div class="label">' + label + '</div><div class="value">' + Math.round(Number(value || 0) * 10) / 10 + ' g</div></div>';
  }

  root.nutrition = {
    FOODS: FOODS,
    foodById: foodById,
    dayBucket: dayBucket,
    addFood: addFood,
    totalProtein: totalProtein,
    mealDistribution: mealDistribution,
    setSupplement: setSupplement,
    setCreatineDose: setCreatineDose,
    dailyAverage: dailyAverage,
    renderNutrition: renderNutrition
  };

  if (typeof module !== "undefined" && module.exports) module.exports = root.nutrition;
})();
