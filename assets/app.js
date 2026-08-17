(function () {
  "use strict";

  /* text-transform:uppercase'in i → İ dönüşümü için dil bilgisi şart */
  document.documentElement.lang = "tr";

  var KEY = "okul-v1";
  var COURSE_PREFIX = "okul-course-";
  var PASS = 2 / 3;
  var DAY = 86400000;
  var BOX_DAYS = [0, 1, 3, 7, 21];

  /* ---------- durum ---------- */
  function defaults() {
    return {
      v: 1,
      prefs: { goal: 15, dir: "ileri", typed: false, limit: 15, model: "claude-opus-5" },
      apiKey: "",
      days: {}, streak: { last: null, current: 0, best: 0 },
      courses: {}, generated: []
    };
  }

  var state = load();

  function load() {
    var s = defaults();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return s;
      var p = JSON.parse(raw);
      if (p.prefs) Object.keys(s.prefs).forEach(function (k) {
        if (p.prefs[k] !== undefined && p.prefs[k] !== null) s.prefs[k] = p.prefs[k];
      });
      s.apiKey = p.apiKey || "";
      s.days = p.days || {};
      if (p.streak) s.streak = { last: p.streak.last || null, current: p.streak.current || 0, best: p.streak.best || 0 };
      s.courses = p.courses || {};
      s.generated = Array.isArray(p.generated) ? p.generated : [];
    } catch (e) {}
    return s;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (e) { return false; }
  }

  function progress(courseId) {
    if (!state.courses[courseId]) {
      state.courses[courseId] = { lessons: {}, cards: {}, wrong: {}, qstats: {}, exams: [], custom: [], last: null };
    }
    var p = state.courses[courseId];
    p.lessons = p.lessons || {}; p.cards = p.cards || {}; p.wrong = p.wrong || {};
    p.qstats = p.qstats || {}; p.exams = p.exams || []; p.custom = p.custom || [];
    return p;
  }

  /* ---------- tarih ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function today() { return dayKey(new Date()); }
  function shiftKey(n) { var d = new Date(); d.setDate(d.getDate() + n); return dayKey(d); }

  function touch(n) {
    var t = today();
    state.days[t] = (state.days[t] || 0) + (n || 1);
    var s = state.streak;
    if (s.last !== t) {
      s.current = s.last === shiftKey(-1) ? s.current + 1 : 1;
      s.last = t;
      if (s.current > s.best) s.best = s.current;
    }
    save();
  }
  function streakNow() {
    var s = state.streak;
    if (!s.last) return 0;
    return (s.last === today() || s.last === shiftKey(-1)) ? s.current : 0;
  }
  function todayCount() { return state.days[today()] || 0; }

  /* ---------- DOM ---------- */
  function el(tag, attrs, kids) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") node.className = attrs[k];
      else if (k === "text") node.textContent = attrs[k];
      else if (k === "html") node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (kid) {
      if (kid) node.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  var TR = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };
  function norm(s) {
    return String(s == null ? "" : s).toLocaleLowerCase("tr")
      .split("").map(function (ch) { return TR[ch] || ch; }).join("").trim();
  }
  function slug(s) {
    return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "kurs";
  }
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) { j = Math.floor(Math.random() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function icon(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + "</svg>";
  }
  var ICONS = {
    kurs: icon('<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    dersler: icon('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'),
    tarih: icon('<path d="M3 21h18M5 21V10m4.5 11V10M14.5 21V10M19 21V10M3 10h18L12 3z"/>'),
    calis: icon('<path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5"/>'),
    ara: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')
  };
  var CHECK = '<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4 10-10"/></svg>';

  /* ---------- kurs deposu ---------- */
  var library = [];        // kütüphane girdileri
  var course = null;       // açık kurs
  var loadError = null;

  function generatedKey(id) { return COURSE_PREFIX + id; }

  function readGenerated(id) {
    try {
      var raw = localStorage.getItem(generatedKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeGenerated(c) {
    try {
      localStorage.setItem(generatedKey(c.id), JSON.stringify(c));
      return true;
    } catch (e) { return false; }
  }

  function removeGenerated(id) {
    try { localStorage.removeItem(generatedKey(id)); } catch (e) {}
    state.generated = state.generated.filter(function (g) { return g.id !== id; });
    delete state.courses[id];
    save();
  }

  function libraryEntries() {
    return library.concat(state.generated.slice().reverse());
  }

  function entryById(id) {
    var all = libraryEntries();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function loadLibrary() {
    return fetch("courses/index.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (list) { library = list.map(function (e) { e.source = "builtin"; return e; }); })
      .catch(function (e) { library = []; loadError = e.message; });
  }

  function loadCourse(id) {
    var entry = entryById(id);
    if (!entry) return Promise.reject(new Error("Kurs bulunamadı: " + id));
    if (entry.source === "generated") {
      var c = readGenerated(id);
      return c ? Promise.resolve(c) : Promise.reject(new Error("Kurs verisi bu tarayıcıda bulunamadı."));
    }
    return fetch(entry.file, { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }

  /* ---------- kurs türevleri ---------- */
  var orderedLessons = [], lessonById = {}, allQuestions = [], questionByKey = {}, cards = [], lessonIndex = [];

  function indexCourse() {
    if (!course) { orderedLessons = []; lessonById = {}; allQuestions = []; questionByKey = {}; cards = []; lessonIndex = []; return; }
    orderedLessons = course.modules.flatMap(function (m) {
      return course.lessons.filter(function (l) { return l.moduleId === m.id; })
        .sort(function (a, b) { return a.order - b.order; });
    });
    lessonById = {};
    orderedLessons.forEach(function (l) { lessonById[l.id] = l; });
    allQuestions = orderedLessons.flatMap(function (l) {
      return (l.quiz || []).map(function (q) { return { key: l.id + ":" + q.id, q: q, lesson: l }; });
    });
    questionByKey = {};
    allQuestions.forEach(function (x) { questionByKey[x.key] = x; });
    refreshDeck();
    lessonIndex = orderedLessons.map(function (l) {
      var parts = [l.title, l.subtitle].concat(l.keyTerms || []);
      (l.sections || []).forEach(function (s) {
        if (s.title) parts.push(s.title);
        if (s.body) parts.push(s.body);
        if (s.text) parts.push(s.text);
        if (s.items) parts = parts.concat(s.items);
        if (s.note) parts.push(s.note);
      });
      var raw = parts.filter(Boolean).join(" · ");
      return { lesson: l, hay: norm(raw), raw: raw };
    });
  }

  function deck() {
    if (!course) return [];
    var base = (course.glossary || []).map(function (g) {
      return { id: "t-" + g.id, kind: "Kavram", front: g.term, back: g.definition, lesson: g.lessonId };
    }).concat((course.figures || []).map(function (f) {
      return { id: "d-" + f.id, kind: course.figuresLabel ? course.figuresLabel.replace(/ler$|lar$/, "") : "Kişi",
        front: f.name, back: f.oneLiner + (f.lifespan ? " (" + f.lifespan + (f.tag ? ", " + f.tag : "") + ")" : ""),
        lesson: f.lessonId };
    }));
    progress(course.id).custom.forEach(function (c) {
      base.push({ id: c.id, kind: "Kendi kartın", front: c.front, back: c.back, lesson: null, own: true });
    });
    return base;
  }
  function refreshDeck() { cards = deck(); }
  function cardById(id) {
    for (var i = 0; i < cards.length; i++) if (cards[i].id === id) return cards[i];
    return null;
  }

  function lessonDone(id) {
    var e = progress(course.id).lessons[id];
    return !!(e && e.read && e.count > 0 && e.best / e.count >= PASS);
  }
  function doneCount(ids) { return ids.filter(lessonDone).length; }
  function moduleLessons(mid) {
    return course.lessons.filter(function (l) { return l.moduleId === mid; })
      .sort(function (a, b) { return a.order - b.order; });
  }
  function dueCards() {
    var now = Date.now(), st = progress(course.id).cards;
    return cards.filter(function (c) { var s = st[c.id]; return !s || s.dueAt <= now; })
      .sort(function (a, b) { return (st[a.id] ? st[a.id].dueAt : 0) - (st[b.id] ? st[b.id].dueAt : 0); });
  }
  function learnedCards() {
    var st = progress(course.id).cards;
    return cards.filter(function (c) { return st[c.id] && st[c.id].box >= 4; }).length;
  }

  /* ---------- yönlendirme ---------- */
  var route = {
    screen: "kutuphane",   // kutuphane | ayarlar | kurs
    courseId: null, tab: "kurs", lesson: null,
    histTab: "cizelge", era: "hepsi", query: "", open: null, study: "kartlar"
  };
  var view, busy = false;

  var TABS = [
    { id: "kurs", label: "Kurs" },
    { id: "dersler", label: "Dersler" },
    { id: "tarih", label: "Tarih" },
    { id: "calis", label: "Çalış" },
    { id: "ara", label: "Ara" }
  ];

  function activeTabs() {
    var hasHistory = course && ((course.timeline && course.timeline.length) || (course.figures && course.figures.length));
    return TABS.filter(function (t) { return t.id !== "tarih" || hasHistory; });
  }

  function go(screen, opts) {
    route.screen = screen;
    if (opts) Object.keys(opts).forEach(function (k) { route[k] = opts[k]; });
    window.scrollTo(0, 0);
    render();
  }

  function openCourse(id) {
    if (course && course.id === id) { go("kurs", { tab: "kurs", lesson: null }); return; }
    busy = true;
    route.screen = "kurs"; route.courseId = id; route.tab = "kurs"; route.lesson = null;
    route.query = ""; route.open = null; route.study = "kartlar"; route.era = "hepsi";
    render();
    loadCourse(id).then(function (c) {
      course = c; indexCourse(); resetStudy(); busy = false;
      applyAccent(c);
      window.scrollTo(0, 0);
      render();
    }).catch(function (e) {
      busy = false; course = null; loadError = e.message; render();
    });
  }

  function leaveCourse() {
    course = null; loadError = null; applyAccent(null); resetStudy();
    go("kutuphane", { courseId: null, lesson: null, query: "" });
  }

  function openLesson(id) {
    if (!lessonById[id]) return;
    route.screen = "kurs"; route.tab = "dersler"; route.lesson = id;
    var p = progress(course.id);
    var e = p.lessons[id] || { read: false, best: 0, count: 0 };
    e.read = true; p.lessons[id] = e; p.last = id;
    save();
    window.scrollTo(0, 0);
    render();
  }

  function applyAccent(c) {
    var root = document.documentElement;
    if (c && c.accent) { root.style.setProperty("--accent-light", c.accent); root.style.setProperty("--accent-dark", c.accentDark || c.accent); }
    else { root.style.removeProperty("--accent-light"); root.style.removeProperty("--accent-dark"); }
  }

  function head(eyebrow, title, sub) {
    document.getElementById("eyebrow").textContent = eyebrow || "";
    document.getElementById("title").textContent = title || "";
    var s = document.getElementById("subtitle");
    s.textContent = sub || "";
    s.style.display = sub ? "" : "none";
    /* üretim sürerken geri çıkışı gizle; kütüphanede zaten gerekmez */
    var generating = route.screen === "uret" && job && !job.done && !job.error;
    var back = document.getElementById("back");
    back.style.display = (route.screen === "kutuphane" || generating) ? "none" : "";
    back.textContent = route.screen === "kurs" && route.lesson ? "← Dersler" : "← Kütüphane";
  }

  function render() {
    view = document.getElementById("view");
    view.textContent = "";
    if (route.screen === "kutuphane") renderLibrary();
    else if (route.screen === "ayarlar") renderAppSettings();
    else if (route.screen === "uret") renderGenerating();
    else renderCourseScreen();
    renderTabs();
  }

  function renderCourseScreen() {
    if (busy) {
      head("Yükleniyor", "Kurs açılıyor", null);
      view.appendChild(el("div", { class: "card center" }, [el("p", { class: "muted small", style: "margin:0", text: "Bir saniye…" })]));
      return;
    }
    if (!course) {
      head("Hata", "Kurs açılamadı", loadError || "Bilinmeyen hata");
      view.appendChild(el("button", { class: "btn", text: "Kütüphaneye dön", onclick: leaveCourse }));
      return;
    }
    if (route.lesson) return renderLesson();
    if (route.tab === "kurs") return renderCourseHome();
    if (route.tab === "dersler") return renderLessons();
    if (route.tab === "tarih") return renderHistory();
    if (route.tab === "calis") return renderStudy();
    return renderSearch();
  }

  function renderTabs() {
    var nav = document.getElementById("tabbar");
    var ul = document.getElementById("tabs");
    ul.textContent = "";
    if (route.screen !== "kurs" || !course) { nav.style.display = "none"; return; }
    nav.style.display = "";
    activeTabs().forEach(function (t) {
      var btn = el("button", {
        type: "button",
        "aria-current": route.tab === t.id ? "page" : null,
        onclick: function () { route.tab = t.id; route.lesson = null; window.scrollTo(0, 0); render(); }
      });
      btn.innerHTML = ICONS[t.id] + "<span>" + t.label + "</span>";
      if (t.id === "calis" && dueCards().length > 0) btn.appendChild(el("span", { class: "dot", "aria-hidden": "true" }));
      ul.appendChild(el("li", null, [btn]));
    });
  }

  /* ---------- ortak parçalar ---------- */
  function segmented(items, current, onPick) {
    var box = el("div", { class: "seg" });
    items.forEach(function (pair) {
      box.appendChild(el("button", {
        type: "button", class: "seg-btn" + (current === pair[0] ? " on" : ""),
        "aria-pressed": current === pair[0] ? "true" : "false",
        text: pair[1], onclick: function () { onPick(pair[0]); }
      }));
    });
    return box;
  }
  function meter(pct, color) {
    return el("div", { class: "meter" }, [
      el("i", { style: "width:" + Math.max(0, Math.min(100, pct)) + "%" + (color ? ";background:" + color : "") })
    ]);
  }
  function statTile(value, label, color) {
    return el("div", { class: "stat" }, [
      el("p", { class: "num stat-val", style: color ? "color:" + color : null, text: value }),
      el("p", { class: "label", style: "margin:0", text: label })
    ]);
  }
  function toggleRow(title, desc, on, onChange) {
    return el("div", { class: "row", style: "align-items:flex-start;gap:.9rem" }, [
      el("div", null, [
        el("p", { style: "margin:0;font-weight:600;font-size:.95rem", text: title }),
        el("p", { class: "small muted", style: "margin:.15rem 0 0", text: desc })
      ]),
      el("button", {
        type: "button", class: "switch" + (on ? " on" : ""), "aria-pressed": on ? "true" : "false",
        "aria-label": title, onclick: function () { onChange(!on); }
      }, [el("span", { class: "knob" })])
    ]);
  }
  function moduleColor(idx) {
    var palette = ["var(--accent)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
    return palette[idx % palette.length];
  }
  function moduleIndex(mid) {
    for (var i = 0; i < course.modules.length; i++) if (course.modules[i].id === mid) return i;
    return 0;
  }

  /* ================= grafik motoru ================= */

  var CW = 320, CH = 208, PL = 40, PR = 14, PT = 18, PB = 30;
  function px(t) { return (PL + t * (CW - PL - PR)).toFixed(2); }
  function py(t) { return ((CH - PB) - t * (CH - PB - PT)).toFixed(2); }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pctS(v) { return "%" + v; }
  function r0(v) { return Math.round(v); }
  function r1(v) { return (Math.round(v * 10) / 10).toFixed(1); }

  function gLine(x1, y1, x2, y2, o) {
    o = o || {};
    return '<line x1="' + px(x1) + '" y1="' + py(y1) + '" x2="' + px(x2) + '" y2="' + py(y2) +
      '" stroke="' + (o.c || "var(--rule)") + '" stroke-width="' + (o.w || 1.6) +
      '" stroke-linecap="round"' + (o.d ? ' stroke-dasharray="' + o.d + '"' : "") + "/>";
  }
  function gPoly(pts, o) {
    o = o || {};
    if (!pts.length) return "";
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + px(p[0]) + " " + py(p[1]); }).join(" ");
    return '<path d="' + d + '" fill="none" stroke="' + (o.c || "var(--accent)") +
      '" stroke-width="' + (o.w || 2.2) + '" stroke-linejoin="round" stroke-linecap="round"' +
      (o.d ? ' stroke-dasharray="' + o.d + '"' : "") + "/>";
  }
  function gArea(pts, o) {
    o = o || {};
    if (!pts.length) return "";
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + px(p[0]) + " " + py(p[1]); }).join(" ") + " Z";
    return '<path d="' + d + '" fill="' + (o.c || "var(--accent)") + '" fill-opacity="' + (o.o || 0.18) +
      '" stroke="none"/>';
  }
  function gRect(x0, y0, x1, y1, o) {
    o = o || {};
    var X = Math.min(+px(x0), +px(x1)), Y = Math.min(+py(y0), +py(y1));
    var W = Math.abs(+px(x1) - +px(x0)), H = Math.abs(+py(y1) - +py(y0));
    return '<rect x="' + X + '" y="' + Y + '" width="' + W + '" height="' + H +
      '" rx="' + (o.r === undefined ? 1.5 : o.r) + '" fill="' + (o.c || "var(--accent)") +
      '" fill-opacity="' + (o.o === undefined ? 1 : o.o) + '"' +
      (o.s ? ' stroke="' + o.s + '" stroke-width="' + (o.sw || 1.5) + '"' + (o.d ? ' stroke-dasharray="' + o.d + '"' : "") : "") + "/>";
  }
  function gDot(x, y, o) {
    o = o || {};
    return '<circle cx="' + px(x) + '" cy="' + py(y) + '" r="' + (o.r || 4) +
      '" fill="' + (o.c || "var(--accent)") + '" stroke="var(--surface)" stroke-width="1.5"/>';
  }
  function gTxt(x, y, s, o) {
    o = o || {};
    return '<text x="' + px(x) + '" y="' + py(y) + '" dx="' + (o.dx || 0) + '" dy="' + (o.dy || 0) +
      '" text-anchor="' + (o.a || "start") + '" font-size="' + (o.s || 9.5) +
      '" font-weight="' + (o.b ? 650 : 400) + '" fill="' + (o.c || "var(--muted)") +
      '" font-family="var(--sans)">' + esc(s) + "</text>";
  }
  function frame(xlab, ylab) {
    return '<line x1="' + PL + '" y1="' + (CH - PB) + '" x2="' + (CW - PR) + '" y2="' + (CH - PB) +
      '" stroke="var(--rule)" stroke-width="1.2"/>' +
      '<line x1="' + PL + '" y1="' + PT + '" x2="' + PL + '" y2="' + (CH - PB) +
      '" stroke="var(--rule)" stroke-width="1.2"/>' +
      '<text x="' + (CW - PR) + '" y="' + (CH - PB + 15) + '" text-anchor="end" font-size="9.5" fill="var(--muted)" font-family="var(--sans)">' + esc(xlab) + "</text>" +
      '<text x="' + (PL - 33) + '" y="' + (PT - 5) + '" text-anchor="start" font-size="9.5" fill="var(--muted)" font-family="var(--sans)">' + esc(ylab) + "</text>";
  }
  function curve(f, from, to, steps) {
    var pts = [], i, n = steps || 60;
    for (i = 0; i <= n; i++) {
      var t = from + (to - from) * (i / n), y = f(t);
      if (y >= -0.002 && y <= 1.002) pts.push([t, Math.max(0, Math.min(1, y))]);
    }
    return pts;
  }

  function chartBlock(id) {
    var spec = CHARTS[id];
    if (!spec) return null;
    var p = {};
    (spec.controls || []).forEach(function (c) { p[c.key] = c.def; });

    var fig = el("figure", { class: "chart" });
    fig.appendChild(el("figcaption", { class: "chart-head" }, [
      el("span", { class: "label", text: "Grafik" }),
      el("h3", { text: spec.title })
    ]));

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 " + CW + " " + CH);
    svg.setAttribute("role", "img");
    fig.appendChild(el("div", { class: "chart-svg" }, [svg]));

    var ctl = el("div", { class: "chart-ctl" });
    var outs = {};
    (spec.controls || []).forEach(function (c) {
      if (c.type === "choice") {
        var seg = el("div", { class: "seg tiny" });
        c.options.forEach(function (o) {
          seg.appendChild(el("button", {
            type: "button", class: "seg-btn" + (p[c.key] === o[0] ? " on" : ""), text: o[1],
            onclick: function () {
              p[c.key] = o[0];
              Array.prototype.forEach.call(seg.children, function (ch, i) {
                ch.className = "seg-btn" + (c.options[i][0] === p[c.key] ? " on" : "");
              });
              paint();
            }
          }));
        });
        ctl.appendChild(el("div", { class: "ctl" }, [el("span", { class: "ctl-label", text: c.label }), seg]));
      } else {
        var out = el("span", { class: "ctl-val num" });
        outs[c.key] = [out, c];
        var inp = el("input", {
          type: "range", min: c.min, max: c.max, step: c.step || 1, value: c.def, "aria-label": c.label
        });
        inp.addEventListener("input", function (e) { p[c.key] = Number(e.target.value); paint(); });
        ctl.appendChild(el("div", { class: "ctl" }, [
          el("div", { class: "ctl-top" }, [el("span", { class: "ctl-label", text: c.label }), out]),
          inp
        ]));
      }
    });
    fig.appendChild(ctl);

    var read = el("p", { class: "chart-read" });
    fig.appendChild(read);
    if (spec.note) fig.appendChild(el("p", { class: "chart-note", text: spec.note }));

    function paint() {
      var r = spec.draw(p);
      svg.innerHTML = r.svg;
      svg.setAttribute("aria-label", spec.title + ". " + r.text);
      read.textContent = r.text;
      Object.keys(outs).forEach(function (k) {
        outs[k][0].textContent = outs[k][1].fmt ? outs[k][1].fmt(p[k]) : p[k];
      });
    }
    paint();
    return fig;
  }

  /* ================= grafik tanımları ================= */

  var CHARTS = {

    "poe": {
      title: "Üretim olanakları eğrisi",
      note: "Eğrinin eğimi fırsat maliyetidir: bir maldan daha fazla üretmek, diğerinden vazgeçmeyi gerektirir.",
      controls: [{ key: "k", label: "Kaynaklar ve teknoloji", min: 70, max: 130, step: 2, def: 100, fmt: pctS }],
      draw: function (p) {
        var k = p.k / 100;
        var pts = curve(function (t) { return k * Math.sqrt(Math.max(0, 1 - t * t)); }, 0, 1);
        var base = curve(function (t) { return Math.sqrt(Math.max(0, 1 - t * t)); }, 0, 1);
        var ax = 0.55, ay = 0.72, cap = k * Math.sqrt(1 - ax * ax);
        var s = frame("Tüketim malı", "Sermaye malı");
        if (Math.abs(k - 1) > 0.001) s += gPoly(base, { c: "var(--rule)", w: 1.4, d: "3 3" });
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.08 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gDot(ax, ay, { c: ay > cap ? "var(--no)" : "var(--ok)" });
        s += gTxt(ax, ay, "A", { a: "middle", dy: -9, c: "var(--ink)", b: 1, s: 10.5 });
        var t = ay > cap + 0.015
          ? "A noktası eğrinin dışında: bugünkü kaynak ve teknolojiyle bu bileşim üretilemez."
          : ay < cap - 0.015
            ? "A noktası eğrinin içinde: kaynaklar tam kullanılmıyor, atıl kapasite ya da işsizlik var."
            : "A noktası eğrinin üzerinde: kaynaklar tam kullanılıyor, bir maldan fazlası ancak diğerinden vazgeçerek üretilir.";
        return { svg: s, text: t };
      }
    },

    "arz-talep": {
      title: "Arz, talep ve denge",
      note: "Eğriyi kaydıran fiyat dışı etkenlerdir: gelir, zevkler, girdi maliyeti, teknoloji, vergi.",
      controls: [
        { key: "d", label: "Talep kayması", min: -25, max: 25, step: 5, def: 0,
          fmt: function (v) { return v > 0 ? "artış +" + v : v < 0 ? "azalış " + v : "başlangıç"; } },
        { key: "s", label: "Arz kayması", min: -25, max: 25, step: 5, def: 0,
          fmt: function (v) { return v > 0 ? "artış +" + v : v < 0 ? "azalış " + v : "başlangıç"; } }
      ],
      draw: function (p) {
        var dd = p.d / 100, ss = -p.s / 100;
        var dF = function (q) { return 0.90 + dd - 0.70 * q; };
        var sF = function (q) { return 0.15 + ss + 0.70 * q; };
        var Q = (0.75 + dd - ss) / 1.40, P = dF(Q);
        var Q0 = 0.75 / 1.40, P0 = 0.90 - 0.70 * Q0;
        var s = frame("Miktar", "Fiyat");
        if (p.d || p.s) {
          s += gPoly(curve(function (q) { return 0.90 - 0.70 * q; }, 0, 1), { c: "var(--rule)", w: 1.3, d: "3 3" });
          s += gPoly(curve(function (q) { return 0.15 + 0.70 * q; }, 0, 1), { c: "var(--rule)", w: 1.3, d: "3 3" });
          s += gDot(Q0, P0, { c: "var(--rule)", r: 3 });
        }
        s += gPoly(curve(dF, 0, 1), { c: "var(--accent)", w: 2.3 });
        s += gPoly(curve(sF, 0, 1), { c: "var(--makro)", w: 2.3 });
        s += gLine(0, P, Q, P, { c: "var(--muted)", w: 1, d: "2 3" });
        s += gLine(Q, 0, Q, P, { c: "var(--muted)", w: 1, d: "2 3" });
        s += gDot(Q, P, { c: "var(--ink)" });
        s += gTxt(1, dF(1), "Talep", { a: "end", dy: -6, c: "var(--accent)", b: 1 });
        s += gTxt(1, Math.min(0.98, sF(1)), "Arz", { a: "end", dy: 12, c: "var(--makro)", b: 1 });
        var dp = P - P0, dq = Q - Q0;
        var w = function (v) { return Math.abs(v) < 0.004 ? "değişmedi" : v > 0 ? "yükseldi" : "düştü"; };
        return { svg: s, text: "Denge fiyatı " + w(dp) + ", denge miktarı " + w(dq) + ". " +
          (p.d === 0 && p.s === 0 ? "Kaydırıcıları oynatarak fiyat dışı etkenlerin dengeyi nasıl taşıdığını gör."
            : "Fiyat başlangıca göre %" + r0(Math.abs(dp / P0) * 100) + ", miktar %" + r0(Math.abs(dq / Q0) * 100) + " değişti.") };
      }
    },

    "marjinal-fayda": {
      title: "Azalan marjinal fayda",
      note: "Su elmastan ucuzdur çünkü değeri belirleyen toplam fayda değil, son birimin faydasıdır.",
      controls: [{ key: "n", label: "Tüketilen birim", min: 1, max: 8, step: 1, def: 3,
        fmt: function (v) { return v + " birim"; } }],
      draw: function (p) {
        var mu = function (i) { return Math.pow(0.64, i - 1); };
        var s = frame("Birim", "Marjinal fayda"), total = 0, i;
        for (i = 1; i <= 8; i++) {
          var h = mu(i), x0 = (i - 1) / 8 + 0.014, x1 = i / 8 - 0.014, on = i <= p.n;
          if (on) total += h;
          s += gRect(x0, 0, x1, h, { c: on ? "var(--accent)" : "var(--surface-2)", o: on ? 0.85 : 1 });
          s += gTxt((x0 + x1) / 2, 0, "" + i, { a: "middle", dy: 12, s: 9 });
        }
        s += gPoly(curve(function (t) { return Math.pow(0.64, t * 8 - 0.5); }, 0.06, 0.94, 40), { c: "var(--makro)", w: 1.4, d: "3 3" });
        return { svg: s, text: p.n + ". birimin marjinal faydası " + r0(mu(p.n) * 100) + " birim, toplam fayda " +
          r0(total * 100) + " birim. Ek birim geldikçe toplam artıyor ama artış hızı düşüyor." };
      }
    },

    "esneklik": {
      title: "Esneklik ve toplam hasılat",
      note: "Zam hasılatı ancak talep inelastikse artırır. Sigara ve akaryakıt vergilerinin cazibesi buradan gelir.",
      controls: [{ key: "e", label: "Talebin fiyat esnekliği", min: 2, max: 25, step: 1, def: 6,
        fmt: function (v) { return (v / 10).toFixed(1); } }],
      draw: function (p) {
        var e = p.e / 10, P0 = 0.48, Q0 = 0.50, P1 = P0 * 1.10, Q1 = Q0 * Math.pow(1.10, -e);
        var s = frame("Miktar", "Fiyat");
        s += gPoly(curve(function (q) { return P0 * Math.pow(q / Q0, -1 / e); }, 0.07, 1), { c: "var(--accent)", w: 2.3 });
        s += gRect(0, 0, Q0, P0, { c: "var(--rule)", o: 0, s: "var(--muted)", sw: 1.2, d: "3 3" });
        s += gRect(0, 0, Q1, P1, { c: "var(--accent)", o: 0.16, s: "var(--accent)", sw: 1.4 });
        s += gDot(Q0, P0, { c: "var(--muted)", r: 3.2 });
        s += gDot(Q1, P1, { c: "var(--ink)" });
        var R0 = Q0 * P0, R1 = Q1 * P1, ch = (R1 / R0 - 1) * 100, dq = (1 - Q1 / Q0) * 100;
        return { svg: s, text: "%10 zam miktarı %" + r1(dq) + " azaltır. Toplam hasılat %" + r1(Math.abs(ch)) +
          (ch >= 0 ? " artar" : " azalır") + ": talep " + (e < 1 ? "inelastik" : e > 1 ? "esnek" : "birim esnek") + "." };
      }
    },

    "vergi-yansimasi": {
      title: "Vergiyi gerçekte kim öder?",
      note: "Yasal yükümlü kim olursa olsun, ekonomik yük esnekliği düşük olan tarafta kalır.",
      controls: [{ key: "b", label: "Talebin inelastikliği", min: 2, max: 30, step: 2, def: 10,
        fmt: function (v) { return v < 8 ? "esnek" : v > 16 ? "çok inelastik" : "orta"; } }],
      draw: function (p) {
        var b = p.b / 10, C = 0.12, t = 0.20, A = C + 0.5 + 0.5 * b;
        var Q1 = (A - C - t) / (b + 1), Pc = A - b * Q1, Pp = Pc - t, Q0 = 0.5, P0 = C + 0.5;
        var s = frame("Miktar", "Fiyat");
        s += gPoly(curve(function (q) { return A - b * q; }, 0, 1), { c: "var(--accent)", w: 2.2 });
        s += gPoly(curve(function (q) { return C + q; }, 0, 1), { c: "var(--makro)", w: 2.2 });
        s += gPoly(curve(function (q) { return C + t + q; }, 0, 1), { c: "var(--makro)", w: 1.6, d: "4 3" });
        s += gRect(0, Pp, Q1, Pc, { c: "var(--no)", o: 0.16 });
        s += gLine(0, P0, Q0, P0, { c: "var(--muted)", w: 1, d: "2 3" });
        s += gDot(Q1, Pc, { c: "var(--no)" });
        s += gDot(Q1, Pp, { c: "var(--makro)" });
        var side = Q1 > 0.55 ? -1 : 1, an = side < 0 ? "end" : "start";
        s += gTxt(Q1, Pc, "alıcı fiyatı", { a: an, dx: 7 * side, dy: -4, s: 9 });
        s += gTxt(Q1, Pp, "satıcıya kalan", { a: an, dx: 7 * side, dy: 11, s: 9 });
        var share = b / (b + 1);
        return { svg: s, text: "Verginin %" + r0(share * 100) + "'ini alıcı, %" + r0((1 - share) * 100) +
          "'ini satıcı üstlenir. Talep ne kadar inelastikse yük o kadar alıcıya kayar." };
      }
    },

    "karsilastirmali": {
      title: "Ticaretin kazançlı olduğu aralık",
      note: "Ricardo'nun katkısı: belirleyici olan mutlak verimlilik değil, vazgeçilen üretimdir.",
      controls: [{ key: "t", label: "Değişim oranı: 1 kumaş = ? şarap", min: 20, max: 200, step: 5, def: 100,
        fmt: function (v) { return (v / 100).toFixed(2); } }],
      draw: function (p) {
        var T = p.t / 100, a = 0.5, b = 1.5, y = 0.58;
        var X = function (v) { return v / 2; };
        var s = "";
        s += gRect(X(a), y - 0.10, X(b), y + 0.10, { c: "var(--ok)", o: 0.15, r: 4 });
        s += gLine(0, y, 1, y, { c: "var(--rule)", w: 1.6 });
        [0, 0.5, 1, 1.5, 2].forEach(function (v) {
          s += gLine(X(v), y - 0.04, X(v), y, { c: "var(--rule)", w: 1.2 });
          s += gTxt(X(v), y - 0.04, v.toFixed(1), { a: "middle", dy: 13, s: 9 });
        });
        s += gLine(X(a), y, X(a), y + 0.22, { c: "var(--mikro)", w: 1.8 });
        s += gTxt(X(a), y + 0.22, "Portekiz'in", { a: "middle", dy: -14, c: "var(--mikro)", s: 9, b: 1 });
        s += gTxt(X(a), y + 0.22, "fırsat maliyeti", { a: "middle", dy: -4, c: "var(--mikro)", s: 9 });
        s += gLine(X(b), y, X(b), y + 0.22, { c: "var(--tarih)", w: 1.8 });
        s += gTxt(X(b), y + 0.22, "İngiltere'nin", { a: "middle", dy: -14, c: "var(--tarih)", s: 9, b: 1 });
        s += gTxt(X(b), y + 0.22, "fırsat maliyeti", { a: "middle", dy: -4, c: "var(--tarih)", s: 9 });
        s += gDot(X(T), y, { c: "var(--ink)", r: 5 });
        s += gTxt(X(T), y, T.toFixed(2), { a: "middle", dy: 22, c: "var(--ink)", b: 1, s: 10 });
        s += gTxt(0.5, 0.06, "1 kumaşın şarap cinsinden değeri", { a: "middle", s: 9 });
        var t = T < a ? "Bu oranda Portekiz ticarete girmez: kumaşı kendi üretmesi daha ucuza gelir."
          : T > b ? "Bu oranda İngiltere ticarete girmez: kumaşı satmak yerine kendi tüketmesi daha iyidir."
            : "Yeşil aralıktasın: bu değişim oranında iki ülke de uzmanlaşıp takas ederek kazanır.";
        return { svg: s, text: t };
      }
    },

    "tekel": {
      title: "Tekel ve ölü yük kaybı",
      note: "Kırmızı üçgen, gerçekleşmeyen karşılıklı kazançlı alışverişlerdir; kimsenin kazancı değildir.",
      controls: [{ key: "m", label: "Piyasa gücü", min: 0, max: 100, step: 10, def: 100,
        fmt: function (v) { return v === 0 ? "tam rekabet" : v === 100 ? "tam tekel" : "%" + v; } }],
      draw: function (p) {
        var c = 0.20, Qc = 1 - c, Qm = (1 - c) / 2, Q = Qc - (Qc - Qm) * (p.m / 100), P = 1 - Q;
        var s = frame("Miktar", "Fiyat");
        s += gPoly([[0, 1], [1, 0]], { c: "var(--accent)", w: 2.3 });
        s += gPoly([[0, 1], [0.5, 0]], { c: "var(--tarih)", w: 1.5, d: "4 3" });
        s += gLine(0, c, 1, c, { c: "var(--makro)", w: 1.8 });
        if (Q < Qc - 0.005) s += gArea([[Q, P], [Q, c], [Qc, c]], { c: "var(--no)", o: 0.22 });
        s += gLine(0, P, Q, P, { c: "var(--muted)", w: 1, d: "2 3" });
        s += gDot(Q, P, { c: "var(--ink)" });
        s += gTxt(0.98, c, "MM", { a: "end", dy: -5, c: "var(--makro)", b: 1 });
        s += gTxt(0.52, 0.02, "MH", { a: "start", dy: -2, c: "var(--tarih)", b: 1 });
        var dwl = 0.5 * (Qc - Q) * (P - c);
        return { svg: s, text: p.m === 0
          ? "Tam rekabette fiyat marjinal maliyete eşittir; ölü yük kaybı yoktur."
          : "Üretim rekabetçi düzeyin %" + r0(((Qc - Q) / Qc) * 100) + " altında, fiyat marjinal maliyetin %" +
            r0(((P - c) / c) * 100) + " üstünde. Ölü yük kaybı " + r1(dwl * 100) + " birim." };
      }
    },

    "dissallik": {
      title: "Negatif dışsallık ve aşırı üretim",
      note: "Pigou'nun önerisi, dışsal maliyet kadar bir vergiyle özel maliyeti sosyal maliyete eşitlemektir.",
      controls: [{ key: "e", label: "Dışsal maliyet", min: 0, max: 45, step: 5, def: 25,
        fmt: function (v) { return v === 0 ? "yok" : (v / 100).toFixed(2); } }],
      draw: function (p) {
        var ext = p.e / 100, C = 0.15;
        var Qm = (1 - C) / 2, Qs = (1 - C - ext) / 2, Pm = 1 - Qm;
        var s = frame("Miktar", "Fiyat / maliyet");
        s += gPoly(curve(function (q) { return 1 - q; }, 0, 1), { c: "var(--accent)", w: 2.3 });
        s += gPoly(curve(function (q) { return C + q; }, 0, 1), { c: "var(--makro)", w: 2.2 });
        if (ext > 0) s += gPoly(curve(function (q) { return C + ext + q; }, 0, 1), { c: "var(--no)", w: 2, d: "4 3" });
        if (ext > 0) s += gArea([[Qs, 1 - Qs], [Qm, 1 - Qm], [Qm, C + ext + Qm]], { c: "var(--no)", o: 0.22 });
        s += gDot(Qm, Pm, { c: "var(--muted)", r: 3.4 });
        s += gDot(Qs, 1 - Qs, { c: "var(--ok)" });
        s += gTxt(0.99, C + 1, "özel maliyet", { a: "end", dy: 12, c: "var(--makro)", s: 9 });
        if (ext > 0) s += gTxt(0.99, Math.min(0.99, C + ext + 1), "sosyal maliyet", { a: "end", dy: -4, c: "var(--no)", s: 9 });
        return { svg: s, text: ext === 0
          ? "Dışsallık yokken piyasa dengesi etkindir: özel maliyet sosyal maliyete eşittir."
          : "Piyasa " + r0(((Qm - Qs) / Qs) * 100) + "% fazla üretiyor. Etkin sonuç için gereken vergi " +
            ext.toFixed(2) + " birim; taralı üçgen refah kaybıdır." };
      }
    },

    "kayip": {
      title: "Kayıptan kaçınma",
      note: "Kahneman ve Tversky'nin değer fonksiyonu: eğri kayıp bölgesinde daha diktir.",
      controls: [{ key: "l", label: "Kayıptan kaçınma katsayısı", min: 10, max: 30, step: 1, def: 22,
        fmt: function (v) { return (v / 10).toFixed(1) + "×"; } }],
      draw: function (p) {
        var lam = p.l / 10;
        var MX = function (x) { return (x + 1) / 2; };
        var MY = function (v) { return (v + 3) / 4; };
        var pts = [], i;
        for (i = -30; i <= 30; i++) {
          var x = i / 30;
          var v = x >= 0 ? Math.pow(x, 0.88) : -lam * Math.pow(-x, 0.88);
          pts.push([MX(x), Math.max(0, Math.min(1, MY(v)))]);
        }
        var s = "";
        s += gLine(0, MY(0), 1, MY(0), { c: "var(--rule)", w: 1.2 });
        s += gLine(MX(0), 0, MX(0), 1, { c: "var(--rule)", w: 1.2 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gDot(MX(1), MY(1), { c: "var(--ok)", r: 3.6 });
        s += gDot(MX(-1), MY(-lam), { c: "var(--no)", r: 3.6 });
        s += gLine(MX(1), MY(0), MX(1), MY(1), { c: "var(--ok)", w: 1, d: "2 3" });
        s += gLine(MX(-1), MY(-lam), MX(-1), MY(0), { c: "var(--no)", w: 1, d: "2 3" });
        s += gTxt(0.99, MY(0), "kazanç", { a: "end", dy: 13, s: 9, c: "var(--ok)" });
        s += gTxt(0.01, MY(0), "kayıp", { a: "start", dy: -6, s: 9, c: "var(--no)" });
        return { svg: s, text: "Aynı büyüklükteki kayıp, kazançtan " + lam.toFixed(1) +
          " kat daha güçlü hissediliyor. 1.000 TL kazanmanın sevinci, 1.000 TL kaybetmenin acısını karşılamıyor; " +
          "insanlar bu yüzden mevcut durumu korumaya eğilimli." };
      }
    },

    "nominal-reel": {
      title: "Nominal ve reel GSYH",
      note: "Büyümeyi konuşurken kastedilen daima reel büyümedir; nominal artışın bir kısmı yalnızca fiyattır.",
      controls: [
        { key: "g", label: "Reel büyüme", min: -4, max: 10, step: 1, def: 3, fmt: pctS },
        { key: "i", label: "Enflasyon", min: 0, max: 60, step: 5, def: 20, fmt: pctS }
      ],
      draw: function (p) {
        var g = p.g / 100, inf = p.i / 100, N = 6;
        var nomEnd = Math.pow((1 + g) * (1 + inf), N), realEnd = Math.pow(1 + g, N);
        var top = Math.max(nomEnd, realEnd, 1.2);
        var s = frame("Yıl", "Endeks"), i;
        var nom = [], re = [];
        for (i = 0; i <= N; i++) {
          nom.push([i / N, Math.pow((1 + g) * (1 + inf), i) / top]);
          re.push([i / N, Math.pow(1 + g, i) / top]);
        }
        s += gArea(nom.concat(re.slice().reverse()), { c: "var(--makro)", o: 0.14 });
        s += gPoly(nom, { c: "var(--makro)", w: 2.3 });
        s += gPoly(re, { c: "var(--accent)", w: 2.3 });
        s += gTxt(1, nom[N][1], "nominal", { a: "end", dy: -6, c: "var(--makro)", b: 1 });
        s += gTxt(1, re[N][1], "reel", { a: "end", dy: 13, c: "var(--accent)", b: 1 });
        for (i = 0; i <= N; i += 2) s += gTxt(i / N, 0, "" + i, { a: "middle", dy: 12, s: 9 });
        return { svg: s, text: N + " yıl sonunda nominal GSYH " + r1(nomEnd) + " katına, reel GSYH " + r1(realEnd) +
          " katına çıkıyor. Aradaki fark üretim değil, yalnızca fiyat artışıdır." };
      }
    },

    "satinalma": {
      title: "Paranın alım gücü",
      note: "Enflasyon bir vergi gibi çalışır: nominal geliri geç ayarlanan kesim faturayı öder.",
      controls: [{ key: "i", label: "Yıllık enflasyon", min: 2, max: 80, step: 2, def: 30, fmt: pctS }],
      draw: function (p) {
        var inf = p.i / 100, N = 10, i;
        var pts = [];
        for (i = 0; i <= N * 4; i++) {
          var t = i / 4;
          pts.push([t / N, 1 / Math.pow(1 + inf, t)]);
        }
        var s = frame("Yıl", "100 TL'nin gücü");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--no)", o: 0.12 });
        s += gPoly(pts, { c: "var(--no)", w: 2.4 });
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.2, d: "3 3" });
        s += gTxt(0.02, 0.5, "yarıya iner", { a: "start", dy: -5, s: 9 });
        for (i = 0; i <= N; i += 2) s += gTxt(i / N, 0, "" + i, { a: "middle", dy: 12, s: 9 });
        var half = Math.log(2) / Math.log(1 + inf);
        var end = 100 / Math.pow(1 + inf, N);
        return { svg: s, text: "Yıllık %" + p.i + " enflasyonda bugünkü 100 TL, 10 yıl sonra " + r1(end) +
          " TL'lik mal alır. Alım gücü yaklaşık " + r1(half) + " yılda yarıya iner." };
      }
    },

    "phillips": {
      title: "Phillips eğrisi: kısa ve uzun dönem",
      note: "Uzun dönemde eğri dikeydir: enflasyonu kalıcı yükseltmek işsizliği kalıcı düşürmez.",
      controls: [{ key: "pe", label: "Beklenen enflasyon", min: 0, max: 14, step: 1, def: 2, fmt: pctS }],
      draw: function (p) {
        var pe = p.pe, un = 5, a = 1.3;
        var MX = function (u) { return (u - 1) / 11; };
        var MY = function (v) { return (v + 3) / 21; };
        var pts = [], u;
        for (u = 1.5; u <= 12; u += 0.25) {
          var pi = pe + a * (un - u);
          if (pi >= -3 && pi <= 18) pts.push([MX(u), MY(pi)]);
        }
        var s = frame("İşsizlik %", "Enflasyon %");
        if (pe > 0) {
          var base = [];
          for (u = 1.5; u <= 12; u += 0.25) {
            var p0 = a * (un - u);
            if (p0 >= -3 && p0 <= 18) base.push([MX(u), MY(p0)]);
          }
          s += gPoly(base, { c: "var(--rule)", w: 1.4, d: "3 3" });
        }
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(MX(un), 0, MX(un), 1, { c: "var(--tarih)", w: 1.8, d: "5 3" });
        s += gLine(0, MY(0), 1, MY(0), { c: "var(--rule)", w: 1 });
        s += gDot(MX(un), MY(pe), { c: "var(--ink)" });
        s += gTxt(MX(un), 1, "doğal oran", { a: "middle", dy: 2, c: "var(--tarih)", s: 9, b: 1 });
        [2, 5, 8, 11].forEach(function (v) { s += gTxt(MX(v), 0, "" + v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Beklenen enflasyon %" + pe + " olduğunda kısa dönem eğrisi yukarı kayar. " +
          "İşsizlik doğal orana (%5) döndüğünde geriye yalnızca %" + pe + " enflasyon kalır: takas kalıcı değildir." };
      }
    },

    "para-carpani": {
      title: "Kaydi para çarpanı",
      note: "Gerçekte nakit tercihi ve fazla rezervler nedeniyle çarpan bu teorik üst sınırın altında kalır.",
      controls: [{ key: "r", label: "Zorunlu karşılık oranı", min: 1, max: 40, step: 1, def: 10, fmt: pctS }],
      draw: function (p) {
        var r = p.r / 100, N = 8, i, s = frame("Kredi turu", "Yaratılan mevduat");
        for (i = 0; i < N; i++) {
          var h = Math.pow(1 - r, i), x0 = i / N + 0.012, x1 = (i + 1) / N - 0.012;
          s += gRect(x0, 0, x1, h, { c: "var(--accent)", o: 0.9 - i * 0.09 });
          s += gTxt((x0 + x1) / 2, 0, "" + (i + 1), { a: "middle", dy: 12, s: 9 });
        }
        var mult = 1 / r;
        var shown = (1 - Math.pow(1 - r, N)) / r;
        s += gTxt(0.99, 0.95, "toplam → " + r1(mult) + "×", { a: "end", c: "var(--ink)", b: 1, s: 10.5 });
        return { svg: s, text: "Zorunlu karşılık %" + p.r + " iken 1 TL rezerv en fazla " + r1(mult) +
          " TL mevduata dönüşür. İlk 8 turda bunun " + r1(shown) + " TL'si yaratılmış olur." };
      }
    },

    "laffer": {
      title: "Laffer eğrisi",
      note: "Eğrinin varlığı tartışmasız, tepe noktasının yeri değildir. Çoğu ampirik tahmin tepeyi yüksek oranlarda bulur; hangi ülkenin eğrinin hangi tarafında olduğu veri sorusudur.",
      controls: [{ key: "t", label: "Vergi oranı", min: 0, max: 100, step: 5, def: 30, fmt: pctS }],
      draw: function (p) {
        var f = function (t) { return 4 * t * (1 - t); };
        var pts = curve(function (t) { return f(t); }, 0, 1, 60);
        var tt = p.t / 100;
        var s = frame("Vergi oranı", "Vergi geliri");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(0.5, 0, 0.5, 1, { c: "var(--rule)", w: 1.2, d: "3 3" });
        s += gLine(0, f(tt), tt, f(tt), { c: "var(--muted)", w: 1, d: "2 3" });
        s += gDot(tt, f(tt), { c: "var(--ink)" });
        [0, 50, 100].forEach(function (v) { s += gTxt(v / 100, 0, "%" + v, { a: "middle", dy: 12, s: 9 }); });
        var t = p.t === 0 ? "Oran sıfırken gelir de sıfırdır." : p.t === 100 ? "Oran %100 iken kimse beyan etmez; gelir yine sıfırdır."
          : tt < 0.5 ? "Bu noktada oranı artırmak vergi gelirini artırır: eğrinin yükselen tarafındasın."
            : "Bu noktada oranı artırmak geliri düşürür: eğrinin inen tarafındasın.";
        return { svg: s, text: t + " Gelir, tepe noktasının %" + r0(f(tt) * 100) + "'i düzeyinde." };
      }
    },

    "bilesik": {
      title: "Bileşik büyümenin gücü",
      note: "70 kuralı: ikiye katlanma süresi yaklaşık 70 bölü yıllık büyüme oranıdır.",
      controls: [
        { key: "g", label: "Yıllık büyüme", min: 1, max: 10, step: 1, def: 3, fmt: pctS },
        { key: "y", label: "Süre", min: 10, max: 50, step: 5, def: 35, fmt: function (v) { return v + " yıl"; } }
      ],
      draw: function (p) {
        var g = p.g / 100, Y = p.y, top = Math.pow(1 + g, Y), i;
        var pts = [];
        for (i = 0; i <= 60; i++) {
          var t = (Y * i) / 60;
          pts.push([t / Y, Math.pow(1 + g, t) / top]);
        }
        var s = frame("Yıl", "Kaç katına çıktı");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        var dbl = Math.log(2) / Math.log(1 + g);
        if (dbl <= Y) {
          s += gLine(0, 2 / top, dbl / Y, 2 / top, { c: "var(--makro)", w: 1.3, d: "3 3" });
          s += gLine(dbl / Y, 0, dbl / Y, 2 / top, { c: "var(--makro)", w: 1.3, d: "3 3" });
          s += gTxt(dbl / Y, 2 / top, "2×", { a: "start", dx: 5, dy: -4, c: "var(--makro)", b: 1, s: 10 });
        }
        s += gDot(1, 1, { c: "var(--ink)" });
        [0, 0.5, 1].forEach(function (v) { s += gTxt(v, 0, r0(v * Y) + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Yılda %" + p.g + " büyüyen bir ekonomi " + Y + " yılda " + r1(top) +
          " katına çıkar. İkiye katlanma süresi yaklaşık 70/" + p.g + " = " + r1(dbl) + " yıl." };
      }
    },

    "imkansiz-ucleme": {
      title: "İmkânsız üçleme",
      note: "Üç hedeften ancak ikisi aynı anda tutulabilir. Hangi ikisi seçileceği bir tercih, üçünü birden istemek bir hatadır.",
      controls: [{ key: "c", type: "choice", label: "Hangisinden vazgeçiliyor?", def: "para", options: [
        ["para", "Bağımsız para"], ["kur", "Sabit kur"], ["sermaye", "Serbest sermaye"]
      ] }],
      draw: function (p) {
        var A = [0.5, 0.94], B = [0.08, 0.16], C = [0.92, 0.16];
        var lost = p.c;
        var col = function (id) { return lost === id ? "var(--rule)" : "var(--accent)"; };
        var s = "";
        var pairs = [["kur", "para", A, B], ["kur", "sermaye", A, C], ["para", "sermaye", B, C]];
        pairs.forEach(function (pr) {
          var dead = lost === pr[0] || lost === pr[1];
          s += gLine(pr[2][0], pr[2][1], pr[3][0], pr[3][1], { c: dead ? "var(--rule)" : "var(--accent)", w: dead ? 1.4 : 3, d: dead ? "4 3" : "" });
        });
        s += gDot(A[0], A[1], { c: col("kur"), r: 6 });
        s += gDot(B[0], B[1], { c: col("para"), r: 6 });
        s += gDot(C[0], C[1], { c: col("sermaye"), r: 6 });
        s += gTxt(A[0], A[1], "Sabit kur", { a: "middle", dy: -11, c: lost === "kur" ? "var(--muted)" : "var(--ink)", b: 1, s: 10 });
        s += gTxt(B[0], B[1], "Bağımsız", { a: "start", dy: 16, c: lost === "para" ? "var(--muted)" : "var(--ink)", b: 1, s: 10 });
        s += gTxt(B[0], B[1], "para politikası", { a: "start", dy: 26, c: lost === "para" ? "var(--muted)" : "var(--ink)", s: 9.5 });
        s += gTxt(C[0], C[1], "Serbest", { a: "end", dy: 16, c: lost === "sermaye" ? "var(--muted)" : "var(--ink)", b: 1, s: 10 });
        s += gTxt(C[0], C[1], "sermaye hareketi", { a: "end", dy: 26, c: lost === "sermaye" ? "var(--muted)" : "var(--ink)", s: 9.5 });
        var t = lost === "para"
          ? "Sabit kur ve serbest sermaye seçilirse para politikası bağımsızlığı kaybedilir: faiz, kuru savunmak zorundadır. Para kurulu düzenleri ve euro üyeliği bu köşededir."
          : lost === "kur"
            ? "Bağımsız para politikası ve serbest sermaye seçilirse kur dalgalanmak zorundadır. Bugün çoğu büyük ekonominin tercihi budur."
            : "Sabit kur ve bağımsız para politikası seçilirse sermaye hareketleri kısıtlanmak zorundadır. Bretton Woods düzeni ve bazı gelişmekte olan ülkeler bu köşededir.";
        return { svg: s, text: t };
      }
    },

    "mahkum-ikilemi": {
      title: "Mahkûm ikilemi: iki firma",
      note: "Hücrelerdeki sayılar kârdır; ilk sayı A firmasının, ikincisi B firmasınındır.",
      controls: [
        { key: "a", type: "choice", label: "A firması", def: "y", options: [["y", "Yüksek fiyat"], ["k", "Fiyat kır"]] },
        { key: "b", type: "choice", label: "B firması", def: "y", options: [["y", "Yüksek fiyat"], ["k", "Fiyat kır"]] }
      ],
      draw: function (p) {
        var PAY = { yy: [10, 10], yk: [2, 14], ky: [14, 2], kk: [6, 6] };
        var cells = [
          { k: "yy", cx: [0.30, 0.65], cy: [0.52, 0.86] },
          { k: "yk", cx: [0.65, 1.00], cy: [0.52, 0.86] },
          { k: "ky", cx: [0.30, 0.65], cy: [0.16, 0.50] },
          { k: "kk", cx: [0.65, 1.00], cy: [0.16, 0.50] }
        ];
        var sel = p.a + p.b;
        var s = "";
        s += gTxt(0.475, 0.88, "B: yüksek", { a: "middle", dy: -4, s: 9.5, b: 1 });
        s += gTxt(0.825, 0.88, "B: kırar", { a: "middle", dy: -4, s: 9.5, b: 1 });
        s += gTxt(0.14, 0.69, "A: yüksek", { a: "middle", s: 9.5, b: 1 });
        s += gTxt(0.14, 0.33, "A: kırar", { a: "middle", s: 9.5, b: 1 });
        cells.forEach(function (c) {
          var on = c.k === sel, nash = c.k === "kk";
          s += gRect(c.cx[0], c.cy[0], c.cx[1], c.cy[1], {
            c: on ? "var(--accent)" : "var(--surface-2)", o: on ? 0.20 : 1, r: 5,
            s: nash ? "var(--no)" : (on ? "var(--accent)" : "var(--rule)"), sw: nash ? 2 : 1.3, d: nash ? "4 3" : ""
          });
          var v = PAY[c.k];
          s += gTxt((c.cx[0] + c.cx[1]) / 2, (c.cy[0] + c.cy[1]) / 2, v[0] + " , " + v[1],
            { a: "middle", dy: 5, c: on ? "var(--ink)" : "var(--muted)", b: 1, s: 12 });
        });
        s += gTxt(0.995, 0.03, "kesikli kırmızı: Nash dengesi", { a: "end", s: 8.5 });
        var t;
        if (sel === "yy") t = "İkisi de yüksek fiyat tutarsa toplam kâr en yüksek (10, 10). Ama bu bir denge değil: her ikisinin de kırmak için nedeni var.";
        else if (sel === "kk") t = "Nash dengesi burası (6, 6). İkisi de baskın stratejisini oynadı ve ikisi de iş birliğine göre daha az kazandı.";
        else t = "Kıran taraf 14, sadık kalan 2 kazanıyor. Bu asimetri, karşı tarafı da kırmaya iten şeydir.";
        return { svg: s, text: t };
      }
    },

    "balon": {
      title: "Balon: fiyat ve temel değer",
      note: "Balonu tanımlayan yükselişin kendisi değil, fiyatın dayandığı nakit akışlarından kopmasıdır.",
      controls: [{ key: "a", label: "Coşku ve kaldıraç", min: 0, max: 100, step: 10, def: 60,
        fmt: function (v) { return v === 0 ? "yok" : "%" + v; } }],
      draw: function (p) {
        var A = p.a / 100;
        var fund = function (t) { return 0.22 + 0.26 * t; };
        var bump = function (t) {
          if (t < 0.15) return 0;
          if (t <= 0.62) return Math.pow((t - 0.15) / 0.47, 2);
          var k = Math.exp(-(t - 0.62) / 0.055);
          return k - 0.20 * (1 - k);
        };
        var pts = [], fpts = [], i;
        for (i = 0; i <= 90; i++) {
          var t = i / 90;
          fpts.push([t, fund(t)]);
          pts.push([t, Math.max(0, Math.min(1, fund(t) + A * 0.6 * bump(t)))]);
        }
        var s = frame("Zaman", "Fiyat");
        s += gPoly(fpts, { c: "var(--rule)", w: 1.8, d: "4 3" });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        var peak = fund(0.62) + A * 0.6;
        s += gDot(0.62, Math.min(1, peak), { c: "var(--no)" });
        s += gTxt(0.99, fund(1), "temel değer", { a: "end", dy: 14, s: 9 });
        return { svg: s, text: A === 0
          ? "Coşku yokken fiyat temel değeri izler; dalgalanma vardır ama kopuş yoktur."
          : "Tepede fiyat, temel değerin " + r1(peak / fund(0.62)) + " katına çıkıyor. Kredi akışı durunca " +
            "kaldıraç ters yönde çalışır ve fiyat temel değerin altına sarkar." };
      }
    },

    "lorenz": {
      title: "Lorenz eğrisi ve Gini",
      note: "Gini tek sayıya indirger; en üst yüzde 1'in payı gibi ölçüler onu tamamlar.",
      controls: [{ key: "k", label: "Eşitsizlik", min: 10, max: 55, step: 1, def: 22,
        fmt: function (v) { var k = v / 10; return "Gini " + ((k - 1) / (k + 1)).toFixed(2); } }],
      draw: function (p) {
        var k = p.k / 10;
        var pts = curve(function (t) { return Math.pow(t, k); }, 0, 1, 60);
        var s = frame("Nüfusun kümülatif payı", "Gelirin payı");
        s += gArea(pts.concat([[1, 1], [0, 0]]), { c: "var(--no)", o: 0.16 });
        s += gLine(0, 0, 1, 1, { c: "var(--rule)", w: 1.6, d: "4 3" });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gTxt(0.62, 0.30, "eşitsizlik alanı", { a: "middle", s: 9, c: "var(--no)" });
        var gini = (k - 1) / (k + 1);
        var bottom40 = Math.pow(0.4, k) * 100, top10 = (1 - Math.pow(0.9, k)) * 100;
        return { svg: s, text: "Gini " + gini.toFixed(2) + ". Nüfusun en yoksul %40'ı toplam gelirin %" + r1(bottom40) +
          "'ini, en zengin %10'u %" + r1(top10) + "'ini alıyor." };
      }
    },

    "yakinsama": {
      title: "Yakınsama otomatik mi?",
      note: "Solow modelinin öngördüğü yakınsama, veride yalnızca benzer kurumlara sahip ülkeler arasında görülür.",
      controls: [{ key: "q", label: "Kurum kalitesi", min: 0, max: 100, step: 5, def: 50, fmt: pctS }],
      draw: function (p) {
        var ss = 0.15 + 0.75 * (p.q / 100), y0 = 0.12, N = 50, i;
        var pts = [];
        for (i = 0; i <= 60; i++) {
          var t = (N * i) / 60;
          pts.push([t / N, ss - (ss - y0) * Math.exp(-0.055 * t)]);
        }
        var s = frame("Yıl", "Zengin ülkeye oran");
        s += gLine(0, 0.95, 1, 0.95, { c: "var(--makro)", w: 2 });
        s += gTxt(0.99, 0.95, "zengin ülke", { a: "end", dy: -5, c: "var(--makro)", s: 9 });
        s += gLine(0, ss, 1, ss, { c: "var(--rule)", w: 1.3, d: "3 3" });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gDot(1, pts[60][1], { c: "var(--ink)" });
        [0, 25, 50].forEach(function (v) { s += gTxt(v / N, 0, "" + v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Kurum kalitesi %" + p.q + " iken yoksul ülke 50 yılda zengin ülkenin %" +
          r0((pts[60][1] / 0.95) * 100) + " düzeyine ulaşıyor ve %" + r0((ss / 0.95) * 100) +
          " düzeyinde duruyor. Sermaye tek başına yetmiyor; durağan durumu belirleyen kurumlar." };
      }
    },

    "karbon": {
      title: "Karbon fiyatı ve azaltım",
      note: "Fiyat, azaltımı kimin yapacağını merkezî bir planlayıcının bilmesine gerek kalmadan belirler.",
      controls: [{ key: "p", label: "Karbon fiyatı", min: 0, max: 100, step: 5, def: 40,
        fmt: function (v) { return v + " birim"; } }],
      draw: function (p) {
        var price = p.p / 100, a = Math.sqrt(price);
        var mac = curve(function (t) { return t * t; }, 0, 1, 60);
        var s = frame("Azaltım oranı", "Marjinal azaltım maliyeti");
        if (a > 0) s += gArea(curve(function (t) { return t * t; }, 0, a, 40).concat([[a, 0], [0, 0]]), { c: "var(--ok)", o: 0.22 });
        s += gPoly(mac, { c: "var(--accent)", w: 2.4 });
        s += gLine(0, price, 1, price, { c: "var(--makro)", w: 2, d: "5 3" });
        s += gTxt(0.02, price, "karbon fiyatı", { a: "start", dy: -5, c: "var(--makro)", s: 9 });
        if (a > 0) {
          s += gLine(a, 0, a, price, { c: "var(--muted)", w: 1, d: "2 3" });
          s += gDot(a, price, { c: "var(--ink)" });
        }
        [0, 50, 100].forEach(function (v) { s += gTxt(v / 100, 0, "%" + v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: p.p === 0
          ? "Fiyat sıfırken hiçbir azaltım yapılmaz: salımın maliyeti kimsenin defterinde görünmez."
          : "Bu fiyatta salımın %" + r0(a * 100) + "'i azaltılır; maliyeti fiyatın üstünde olan azaltımlar yapılmaz. " +
            "Yeşil alan toplam azaltım maliyetidir." };
      }
    }
  };

  /* ================= kurs özeti ================= */
  function renderCourseHome() {
    var p = progress(course.id);
    var ids = orderedLessons.map(function (l) { return l.id; });
    var done = doneCount(ids);
    var pct = ids.length ? Math.round((done / ids.length) * 100) : 0;
    var pending = orderedLessons.find(function (l) { return !lessonDone(l.id); });
    var resume = pending || lessonById[p.last] || orderedLessons[0];
    var due = dueCards().length;
    var goal = state.prefs.goal, todayN = todayCount(), streak = streakNow();
    var terms = course.glossary || [];
    var term = terms.length ? terms[dayIndex() % terms.length] : null;

    head(course.eyebrow || "Kurs", course.title, course.description);

    var out = el("div", { class: "stack" });

    out.appendChild(el("section", { class: "card stack" }, [
      el("div", { class: "row" }, [
        el("div", null, [
          el("p", { class: "label", text: "Bugünün hedefi" }),
          el("p", { class: "num big", text: todayN + " / " + goal })
        ]),
        el("div", { class: "center" }, [
          el("p", { class: "num big", style: "color:var(--accent)", text: streak + "" }),
          el("p", { class: "label", style: "margin:0", text: "gün seri" })
        ])
      ]),
      meter(Math.round((Math.min(todayN, goal) / goal) * 100)),
      el("p", { class: "small muted", style: "margin:0",
        text: "Her yanıtlanan soru ve çalışılan kart bir sayılır. Seri tüm kurslarda ortaktır." })
    ]));

    out.appendChild(el("section", { class: "card stack" }, [
      el("div", { class: "row" }, [
        el("div", null, [
          el("p", { class: "label", text: "İlerleme" }),
          el("p", { class: "num big", text: done + " / " + ids.length + " ders" })
        ]),
        el("p", { class: "num big", style: "color:var(--accent)", text: "%" + pct })
      ]),
      meter(pct),
      el("p", { class: "small muted", style: "margin:0",
        text: "Bir ders, sınavının en az üçte ikisini doğru yanıtlayınca tamamlanmış sayılır." }),
      resume ? el("button", { class: "block resume", onclick: function () { openLesson(resume.id); } }, [
        el("span", { class: "label", style: "color:var(--accent)",
          text: done === 0 ? "Buradan başla" : "Kaldığın yerden devam et" }),
        el("span", { class: "resume-title", text: resume.title })
      ]) : null
    ]));

    out.appendChild(el("section", { class: "card row" }, [
      el("div", null, [
        el("p", { class: "label", text: "Bugünün tekrarı" }),
        el("p", { class: "small muted", style: "margin:.25rem 0 0",
          text: due > 0
            ? Math.min(due, state.prefs.limit) + " kart hazır · " + learnedCards() + "/" + cards.length + " kart öğrenildi"
            : "Bugünlük tekrar yok. Yarın yeni kartlar açılır." })
      ]),
      el("button", { class: "btn", text: due > 0 ? "Başla" : "Deste",
        onclick: function () { route.study = "kartlar"; go("kurs", { tab: "calis" }); } })
    ]));

    out.appendChild(el("section", { class: "card row" }, [
      el("div", null, [
        el("p", { class: "label", text: "Deneme sınavı" }),
        el("p", { class: "small muted", style: "margin:.25rem 0 0",
          text: allQuestions.length + " soruluk havuzdan karışık sınav. Yanlışların ayrı bir havuzda birikir." })
      ]),
      el("button", { class: "btn ghost", text: "Sınav",
        onclick: function () { route.study = "sinav"; go("kurs", { tab: "calis" }); } })
    ]));

    var mods = el("section", { class: "stack" }, [el("p", { class: "label", text: "Modüller" })]);
    course.modules.forEach(function (m, i) {
      var mids = moduleLessons(m.id).map(function (l) { return l.id; });
      var mp = mids.length ? Math.round((doneCount(mids) / mids.length) * 100) : 0;
      mods.appendChild(el("button", { class: "block card", onclick: function () { go("kurs", { tab: "dersler" }); } }, [
        el("div", { class: "row", style: "align-items:baseline" }, [
          el("h2", { text: m.title }),
          el("span", { class: "num small", style: "color:" + moduleColor(i), text: "%" + mp })
        ]),
        el("p", { class: "small muted", style: "margin:.1rem 0 .7rem", text: m.description }),
        meter(mp, moduleColor(i)),
        el("p", { class: "small muted", style: "margin:.5rem 0 0", text: mids.length + " ders" })
      ]));
    });
    out.appendChild(mods);

    if (term) {
      out.appendChild(el("section", { class: "card" }, [
        el("p", { class: "label", style: "color:var(--accent)", text: "Günün kavramı" }),
        el("h2", { style: "margin-top:.35rem", text: term.term }),
        el("p", { class: "small muted", style: "margin:.2rem 0 0", text: term.definition }),
        term.lessonId && lessonById[term.lessonId]
          ? el("button", { class: "btn quiet", text: "İlgili ders →", onclick: function () { openLesson(term.lessonId); } })
          : null
      ]));
    }

    out.appendChild(el("button", { class: "block card row", onclick: function () { route.study = "istatistik"; go("kurs", { tab: "calis" }); } }, [
      el("div", null, [
        el("p", { class: "label", text: "İstatistikler" }),
        el("p", { class: "small muted", style: "margin:.25rem 0 0", text: "Doğruluk oranın, zayıf konuların ve çalışma geçmişin." })
      ]),
      el("span", { class: "chev", text: "→" })
    ]));

    view.appendChild(out);
  }

  function dayIndex() {
    var now = new Date();
    return Math.floor((now - new Date(now.getFullYear(), 0, 0)) / DAY);
  }

  /* ================= ders listesi ================= */
  function renderLessons() {
    head(course.title, "Dersler",
      course.lessons.length + " ders, " + course.modules.length + " modül. Sırayla ilerle ya da istediğin dersten başla.");

    var out = el("div", { class: "stack", style: "gap:1.8rem" });
    course.modules.forEach(function (m) {
      var list = moduleLessons(m.id);
      if (!list.length) return;
      var section = el("section", null, [
        el("h2", { text: m.title }),
        el("p", { class: "small muted", style: "margin:0 0 .7rem", text: m.description })
      ]);
      var ul = el("ul", { class: "plain card", style: "padding:.2rem 1.1rem" });
      list.forEach(function (l) {
        var done = lessonDone(l.id);
        var tick = el("span", { class: "tick" + (done ? " done" : "") });
        if (done) tick.innerHTML = CHECK;
        var hasChart = (l.sections || []).some(function (s) { return s.kind === "chart"; });
        ul.appendChild(el("li", null, [
          el("button", { class: "block lesson-row", onclick: function () { openLesson(l.id); } }, [
            tick,
            el("span", null, [
              el("span", { class: "lesson-title", text: l.title }),
              el("span", { class: "meta", style: "display:block;margin-top:.15rem",
                text: (l.minutes || 8) + " dk · " + (l.quiz || []).length + " soru" +
                  (hasChart ? " · grafik" : "") + (done ? " · tamamlandı" : "") })
            ])
          ])
        ]));
      });
      section.appendChild(ul);
      out.appendChild(section);
    });
    view.appendChild(out);
  }

  /* ================= ders ================= */
  function renderLesson() {
    var lesson = lessonById[route.lesson];
    var mod = course.modules.find(function (m) { return m.id === lesson.moduleId; }) || { title: course.title };
    var idx = orderedLessons.findIndex(function (l) { return l.id === lesson.id; });

    head(mod.title, lesson.title, lesson.subtitle);

    var back = el("button", { class: "btn quiet", text: "← Dersler",
      onclick: function () { go("kurs", { tab: "dersler", lesson: null }); } });

    var chips = el("div", { class: "chips" },
      [el("span", { class: "chip", text: (lesson.minutes || 8) + " dk" })].concat(
        (lesson.keyTerms || []).map(function (t) { return el("span", { class: "chip", text: t }); })
      ));

    var prose = el("div", { class: "prose" });
    (lesson.sections || []).forEach(function (s) {
      if (s.kind === "text") {
        if (s.title) prose.appendChild(el("h2", { text: s.title }));
        prose.appendChild(el("p", { text: s.body }));
      } else if (s.kind === "list") {
        if (s.title) prose.appendChild(el("h2", { text: s.title }));
        var ul = el("ul");
        (s.items || []).forEach(function (i) { ul.appendChild(el("li", { text: i })); });
        prose.appendChild(ul);
      } else if (s.kind === "formula") {
        prose.appendChild(el("div", { class: "formula" }, [
          el("p", { class: "label", style: "margin:0", text: s.title }),
          el("p", { class: "expr", text: s.expression }),
          el("p", { class: "note", style: "margin:0", text: s.note })
        ]));
      } else if (s.kind === "example") {
        prose.appendChild(el("div", { class: "example" }, [
          el("p", { class: "label", style: "margin:0", text: s.title }),
          el("p", { style: "margin:.35rem 0 0", text: s.body })
        ]));
      } else if (s.kind === "quote") {
        prose.appendChild(el("blockquote", null, [
          el("p", { style: "margin:0 0 .3rem", text: "“" + s.text + "”" }),
          el("footer", { text: s.source })
        ]));
      } else if (s.kind === "chart") {
        var c = chartBlock(s.chartId);
        if (c) prose.appendChild(c);
      }
    });

    view.appendChild(el("div", null, [back, chips, prose, quizBlock(lesson), navBlock(idx)]));
  }

  function recordQuestion(lesson, q, chosen) {
    var p = progress(course.id);
    var key = lesson.id + ":" + q.id;
    var st = p.qstats[key] || { ok: 0, no: 0 };
    if (chosen === q.answerIndex) { st.ok += 1; delete p.wrong[key]; }
    else { st.no += 1; p.wrong[key] = (p.wrong[key] || 0) + 1; }
    p.qstats[key] = st;
    touch(1);
  }

  function quizBlock(lesson) {
    var answers = {};
    var wrap = el("section", { style: "margin-top:2.2rem" });
    var quiz = lesson.quiz || [];
    if (!quiz.length) return wrap;

    function paint() {
      wrap.textContent = "";
      var answered = Object.keys(answers).length;
      var score = quiz.filter(function (q) { return answers[q.id] === q.answerIndex; }).length;

      wrap.appendChild(el("div", { class: "row", style: "margin-bottom:.9rem" }, [
        el("h2", { text: "Kendini sına" }),
        el("span", { class: "num small muted", text: answered + "/" + quiz.length })
      ]));

      quiz.forEach(function (q, qi) {
        var chosen = answers[q.id];
        var card = el("div", { class: "card", style: "margin-bottom:.8rem" }, [
          el("p", { class: "q-prompt", text: (qi + 1) + ". " + q.prompt })
        ]);
        q.options.forEach(function (opt, oi) {
          var isRight = oi === q.answerIndex;
          var reveal = chosen !== undefined && (isRight || oi === chosen);
          card.appendChild(el("button", {
            class: "opt" + (reveal ? (isRight ? " ok" : " no") : ""),
            disabled: chosen !== undefined ? "" : null,
            onclick: function () {
              if (answers[q.id] !== undefined) return;
              answers[q.id] = oi;
              recordQuestion(lesson, q, oi);
              if (Object.keys(answers).length === quiz.length) {
                var sc = quiz.filter(function (x) { return answers[x.id] === x.answerIndex; }).length;
                var p = progress(course.id);
                var e = p.lessons[lesson.id] || { read: true, best: 0, count: 0 };
                e.read = true; e.best = Math.max(e.best || 0, sc); e.count = quiz.length;
                p.lessons[lesson.id] = e;
              }
              save();
              paint();
            }
          }, [
            el("span", { class: "mark", text: reveal ? (isRight ? "✓" : "✕") : "·" }),
            el("span", { text: opt })
          ]));
        });
        if (chosen !== undefined) card.appendChild(el("p", { class: "why", text: q.explanation }));
        wrap.appendChild(card);
      });

      if (answered === quiz.length) {
        wrap.appendChild(el("div", { class: "card row" }, [
          el("p", { style: "margin:0" }, [
            el("strong", { class: "num", text: score + "/" + quiz.length + " doğru. " }),
            el("span", { class: "muted small",
              text: score / quiz.length >= PASS ? "Ders tamamlandı." : "Tamamlanması için üçte iki gerekiyor." })
          ]),
          el("button", { class: "btn ghost", text: "Tekrar", onclick: function () { answers = {}; paint(); } })
        ]));
      }
    }
    paint();
    return wrap;
  }

  function navBlock(idx) {
    var prev = orderedLessons[idx - 1], next = orderedLessons[idx + 1];
    var row = el("div", { class: "navrow" });
    if (prev) row.appendChild(el("button", { class: "block card", style: "flex:1",
      onclick: function () { openLesson(prev.id); } }, [
      el("span", { class: "label", text: "← Önceki" }),
      el("span", { class: "nav-title", text: prev.title })
    ]));
    if (next) row.appendChild(el("button", { class: "block card", style: "flex:1;text-align:right",
      onclick: function () { openLesson(next.id); } }, [
      el("span", { class: "label", style: "color:var(--accent)", text: "Sonraki →" }),
      el("span", { class: "nav-title", text: next.title })
    ]));
    return row;
  }

  /* ================= tarih ================= */
  function renderHistory() {
    head(course.title, course.timelineTitle || "Zaman çizelgesi", course.timelineIntro || null);

    var hasTimeline = course.timeline && course.timeline.length;
    var hasFigures = course.figures && course.figures.length;

    if (hasTimeline && hasFigures) {
      view.appendChild(segmented(
        [["cizelge", course.timelineLabel || "Zaman çizelgesi"], ["kisiler", course.figuresLabel || "Kişiler"]],
        route.histTab, function (v) { route.histTab = v; render(); }
      ));
    }
    var tab = !hasTimeline ? "kisiler" : (!hasFigures ? "cizelge" : route.histTab);

    if (tab === "cizelge") {
      var labels = course.eraLabels || {};
      var eras = [["hepsi", "Tümü"]].concat(Object.keys(labels).map(function (k) { return [k, labels[k]]; }));
      if (eras.length > 1) {
        var filters = el("div", { class: "chips", style: "margin-top:1rem" });
        eras.forEach(function (pair) {
          filters.appendChild(el("button", {
            type: "button", class: "chip tap" + (route.era === pair[0] ? " on" : ""), text: pair[1],
            onclick: function () { route.era = pair[0]; render(); }
          }));
        });
        view.appendChild(filters);
      }
      var ol = el("ol", { class: "tl" });
      course.timeline
        .filter(function (e) { return route.era === "hepsi" || e.era === route.era; })
        .forEach(function (e) {
          var fig = e.figureId && (course.figures || []).find(function (f) { return f.id === e.figureId; });
          ol.appendChild(el("li", null, [
            el("p", { class: "year", style: "margin:0", text: e.yearLabel }),
            el("h3", { style: "margin:.1rem 0 .2rem", text: e.title }),
            el("p", { class: "small muted", style: "margin:0", text: e.body }),
            fig ? el("p", { style: "margin:.4rem 0 0" }, [el("span", { class: "chip", text: fig.name })]) : null
          ]));
        });
      view.appendChild(ol);
    } else {
      var list = el("ul", { class: "plain stack", style: "margin-top:1rem;gap:.7rem" });
      (course.figures || []).forEach(function (f) { list.appendChild(figureCard(f)); });
      view.appendChild(list);
    }
  }

  function figureCard(f) {
    var open = route.open === f.id;
    var card = el("li", { class: "card" }, [
      el("button", { class: "block", "aria-expanded": open ? "true" : "false",
        onclick: function () { route.open = open ? null : f.id; render(); } }, [
        el("span", { style: "display:flex;gap:.5rem;align-items:baseline;flex-wrap:wrap" }, [
          el("span", { class: "thinker-name", text: f.name }),
          f.lifespan ? el("span", { class: "num small muted", text: f.lifespan }) : null
        ]),
        el("span", { class: "small muted", style: "display:block;margin-top:.2rem", text: f.oneLiner })
      ])
    ]);
    if (open) {
      var body = el("div", { style: "margin-top:.8rem" }, [f.tag ? el("span", { class: "chip", text: f.tag }) : null]);
      if (f.contributions && f.contributions.length) {
        var ul = el("ul", { style: "margin:.7rem 0 0;padding-left:1.1rem" });
        f.contributions.forEach(function (c) { ul.appendChild(el("li", { class: "small", style: "margin-bottom:.35rem", text: c })); });
        body.appendChild(ul);
      }
      if (f.quote) body.appendChild(el("blockquote", { style: "margin-top:.8rem;border-color:var(--c3)" }, [
        el("p", { class: "small", style: "margin:0", text: "“" + f.quote.text + "”" }),
        el("footer", { text: f.quote.source })
      ]));
      if (f.lessonId && lessonById[f.lessonId]) body.appendChild(el("button", { class: "btn quiet", text: "İlgili ders →",
        onclick: function () { openLesson(f.lessonId); } }));
      card.appendChild(body);
    }
    return card;
  }

  /* ================= Çalış ================= */
  var session = null, pos = 0, revealed = false, reviewed = 0, typedValue = "", typedResult = null;
  var exam = null;

  function resetStudy() { session = null; exam = null; pos = 0; revealed = false; reviewed = 0; typedValue = ""; typedResult = null; }

  function renderStudy() {
    head(course.title, "Çalış", null);
    view.appendChild(segmented(
      [["kartlar", "Kartlar"], ["sinav", "Sınav"], ["istatistik", "İstatistik"], ["ayarlar", "Ayarlar"]],
      route.study, function (v) { route.study = v; window.scrollTo(0, 0); render(); }
    ));
    var box = el("div", { style: "margin-top:1.1rem" });
    view.appendChild(box);
    if (route.study === "kartlar") renderCards(box);
    else if (route.study === "sinav") renderExam(box);
    else if (route.study === "istatistik") renderStats(box);
    else renderCourseSettings(box);
  }

  /* ---------- kartlar ---------- */
  function buildSession() {
    var due = dueCards().slice(0, state.prefs.limit);
    session = due.map(function (c) {
      var flip = state.prefs.typed ? true
        : state.prefs.dir === "geri" ? true
          : state.prefs.dir === "karisik" ? Math.random() < 0.5 : false;
      return { id: c.id, flip: flip };
    });
    pos = 0; revealed = false; reviewed = 0; typedValue = ""; typedResult = null;
  }

  function renderCards(box) {
    if (!session) buildSession();
    var item = session[pos];
    var card = item && cardById(item.id);

    if (!card) {
      var next = dueCards().length;
      box.appendChild(el("div", { class: "card center stack" }, [
        el("p", { class: "num", style: "font-size:2rem;font-weight:600;margin:0;color:var(--accent)",
          text: learnedCards() + "/" + cards.length }),
        el("h2", { style: "margin:0", text: reviewed > 0 ? "Tekrar tamamlandı" : "Bugünlük tekrar yok" }),
        el("p", { class: "small muted", style: "margin:0",
          text: reviewed > 0
            ? "Bu oturumda " + reviewed + " kart çalıştın. Doğru bilinenler 1, 3, 7 ve 21 gün sonra dönecek."
            : "Kartlar aralıklı tekrar takvimine göre açılır. Yarın yeniden bak." }),
        next > 0 ? el("button", { class: "btn", text: "Yeni oturum", onclick: function () { session = null; render(); } }) : null,
        el("button", { class: "btn ghost", text: "Derslere dön", onclick: function () { go("kurs", { tab: "dersler" }); } })
      ]));
      return;
    }

    var front = item.flip ? card.back : card.front;
    var back = item.flip ? card.front : card.back;

    box.appendChild(el("div", { class: "row", style: "margin-bottom:.8rem" }, [
      el("span", { class: "chip", text: card.kind + (item.flip ? " · ters" : "") }),
      el("span", { class: "num small muted", text: (pos + 1) + " / " + session.length })
    ]));

    box.appendChild(el("div", { class: "card flash" }, [
      el("p", { class: item.flip ? "back big-back" : "front", text: front }),
      revealed ? el("p", { class: item.flip ? "front" : "back", text: back }) : null
    ]));

    if (state.prefs.typed && !revealed) {
      var inp = el("input", { type: "text", class: "typed", placeholder: "Kavramı yaz",
        "aria-label": "Cevabını yaz", value: typedValue, autocomplete: "off", autocapitalize: "off" });
      inp.addEventListener("input", function (e) { typedValue = e.target.value; });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") checkTyped(back); });
      box.appendChild(inp);
      box.appendChild(el("button", { class: "btn wide", text: "Kontrol et", onclick: function () { checkTyped(back); } }));
    } else if (!revealed) {
      box.appendChild(el("button", { class: "btn wide", text: "Cevabı göster",
        onclick: function () { revealed = true; render(); } }));
    } else {
      if (typedResult) {
        box.appendChild(el("p", { class: typedResult.ok ? "typed-ok" : "typed-no",
          text: typedResult.ok ? "Doğru: " + typedValue : "Yazdığın: " + (typedValue || "—") }));
      }
      box.appendChild(el("div", { class: "grid2" }, [
        el("button", { class: "btn ghost danger", text: "✕  Bilemedim", onclick: function () { answerCard(false); } }),
        el("button", { class: "btn", text: "✓  Bildim", onclick: function () { answerCard(true); } })
      ]));
    }

    if (card.lesson && lessonById[card.lesson]) {
      box.appendChild(el("button", { class: "btn quiet", text: "İlgili ders →",
        onclick: function () { openLesson(card.lesson); } }));
    }
  }

  function checkTyped(expected) {
    var a = norm(typedValue), b = norm(expected);
    typedResult = { ok: a.length > 1 && (a === b || (b.indexOf(a) === 0 && a.length >= b.length - 2)) };
    revealed = true;
    render();
  }

  function answerCard(ok) {
    var p = progress(course.id);
    var id = session[pos].id;
    var s = p.cards[id] || { box: 1, dueAt: 0, seen: 0, correct: 0 };
    var box = ok ? Math.min(s.box + 1, 5) : 1;
    p.cards[id] = { box: box, dueAt: Date.now() + BOX_DAYS[box - 1] * DAY, seen: s.seen + 1, correct: s.correct + (ok ? 1 : 0) };
    reviewed += 1; pos += 1; revealed = false; typedValue = ""; typedResult = null;
    touch(1);
    render();
  }

  /* ---------- sınav ---------- */
  function examPool(scope) {
    var p = progress(course.id);
    if (scope === "yanlis") return Object.keys(p.wrong).map(function (k) { return questionByKey[k]; }).filter(Boolean);
    if (scope === "eksik") return allQuestions.filter(function (x) { return !lessonDone(x.lesson.id); });
    if (scope === "hepsi") return allQuestions.slice();
    return allQuestions.filter(function (x) { return x.lesson.moduleId === scope; });
  }

  function renderExam(box) {
    if (exam && !exam.done) return examRun(box);
    if (exam && exam.done) return examResult(box);

    var p = progress(course.id);
    var scope = "hepsi", count = 10;
    var wrongN = Object.keys(p.wrong).length;

    var scopes = [["hepsi", "Tüm müfredat"], ["eksik", "Tamamlanmamış dersler"]]
      .concat(course.modules.map(function (m) { return [m.id, m.title]; }));
    if (wrongN > 0) scopes.push(["yanlis", "Yanlışlarım (" + wrongN + ")"]);

    var info = el("p", { class: "small muted", style: "margin:.8rem 0 0" });
    function updateInfo() {
      var n = examPool(scope).length;
      info.textContent = n === 0 ? "Bu kapsamda soru yok."
        : n + " soruluk havuzdan " + Math.min(count, n) + " soru karışık sırayla sorulacak.";
    }

    var scopeBox = el("div", { class: "pills" });
    scopes.forEach(function (pair) {
      scopeBox.appendChild(el("button", {
        type: "button", class: "chip tap" + (scope === pair[0] ? " on" : ""), text: pair[1],
        onclick: function () {
          scope = pair[0];
          Array.prototype.forEach.call(scopeBox.children, function (ch, i) {
            ch.className = "chip tap" + (scopes[i][0] === scope ? " on" : "");
          });
          updateInfo();
        }
      }));
    });

    var counts = [5, 10, 20, 40];
    var countBox = el("div", { class: "pills" });
    counts.forEach(function (n) {
      countBox.appendChild(el("button", {
        type: "button", class: "chip tap" + (count === n ? " on" : ""), text: n + " soru",
        onclick: function () {
          count = n;
          Array.prototype.forEach.call(countBox.children, function (ch, i) {
            ch.className = "chip tap" + (counts[i] === count ? " on" : "");
          });
          updateInfo();
        }
      }));
    });
    updateInfo();

    box.appendChild(el("div", { class: "card stack" }, [
      el("p", { class: "label", text: "Kapsam" }), scopeBox,
      el("p", { class: "label", style: "margin-top:.5rem", text: "Soru sayısı" }), countBox,
      info,
      el("button", { class: "btn wide", text: "Sınavı başlat", onclick: function () {
        var pool = examPool(scope);
        if (!pool.length) return;
        exam = { items: shuffle(pool).slice(0, Math.min(count, pool.length)), i: 0, answers: {}, scope: scope, done: false };
        window.scrollTo(0, 0); render();
      } })
    ]));

    if (p.exams.length) {
      var hist = el("section", { style: "margin-top:1.6rem" }, [el("p", { class: "label", text: "Son sınavlar" })]);
      var ul = el("ul", { class: "plain card", style: "padding:.2rem 1.1rem;margin-top:.5rem" });
      p.exams.slice(-5).reverse().forEach(function (e) {
        ul.appendChild(el("li", { class: "hist-row" }, [
          el("span", { class: "small", text: scopeLabel(e.scope) }),
          el("span", { class: "num small", style: "color:" + (e.correct / e.total >= PASS ? "var(--ok)" : "var(--no)"),
            text: e.correct + "/" + e.total })
        ]));
      });
      hist.appendChild(ul);
      box.appendChild(hist);
    }
  }

  function scopeLabel(s) {
    if (s === "hepsi") return "Tüm müfredat";
    if (s === "eksik") return "Tamamlanmamış dersler";
    if (s === "yanlis") return "Yanlışlarım";
    var m = course.modules.find(function (x) { return x.id === s; });
    return m ? m.title : s;
  }

  function examRun(box) {
    var it = exam.items[exam.i];
    var chosen = exam.answers[it.key];

    box.appendChild(el("div", { class: "row", style: "margin-bottom:.5rem" }, [
      el("span", { class: "num small muted", text: (exam.i + 1) + " / " + exam.items.length }),
      el("button", { class: "btn quiet small", text: "Bitir", onclick: function () { finishExam(); } })
    ]));
    box.appendChild(meter(Math.round((exam.i / exam.items.length) * 100)));

    var card = el("div", { class: "card", style: "margin-top:1rem" }, [
      el("p", { class: "label", style: "color:var(--accent)", text: it.lesson.title }),
      el("p", { class: "q-prompt", style: "margin-top:.5rem", text: it.q.prompt })
    ]);
    it.q.options.forEach(function (opt, oi) {
      var isRight = oi === it.q.answerIndex;
      var reveal = chosen !== undefined && (isRight || oi === chosen);
      card.appendChild(el("button", {
        class: "opt" + (reveal ? (isRight ? " ok" : " no") : ""),
        disabled: chosen !== undefined ? "" : null,
        onclick: function () {
          if (exam.answers[it.key] !== undefined) return;
          exam.answers[it.key] = oi;
          recordQuestion(it.lesson, it.q, oi);
          save(); render();
        }
      }, [
        el("span", { class: "mark", text: reveal ? (isRight ? "✓" : "✕") : "·" }),
        el("span", { text: opt })
      ]));
    });
    if (chosen !== undefined) card.appendChild(el("p", { class: "why", text: it.q.explanation }));
    box.appendChild(card);

    if (chosen !== undefined) {
      box.appendChild(el("button", {
        class: "btn wide", text: exam.i + 1 < exam.items.length ? "Sonraki soru" : "Sınavı bitir",
        onclick: function () {
          if (exam.i + 1 < exam.items.length) { exam.i += 1; window.scrollTo(0, 0); render(); }
          else finishExam();
        }
      }));
    }
  }

  function finishExam() {
    var p = progress(course.id);
    var answered = exam.items.filter(function (x) { return exam.answers[x.key] !== undefined; });
    var correct = answered.filter(function (x) { return exam.answers[x.key] === x.q.answerIndex; }).length;
    exam.done = true;
    exam.stats = { total: answered.length, correct: correct };
    if (answered.length) {
      p.exams.push({ at: Date.now(), scope: exam.scope, total: answered.length, correct: correct });
      if (p.exams.length > 20) p.exams = p.exams.slice(-20);
      save();
    }
    window.scrollTo(0, 0); render();
  }

  function examResult(box) {
    var st = exam.stats;
    var ratio = st.total ? st.correct / st.total : 0;
    var wrongs = exam.items.filter(function (x) {
      return exam.answers[x.key] !== undefined && exam.answers[x.key] !== x.q.answerIndex;
    });

    box.appendChild(el("div", { class: "card center stack" }, [
      el("p", { class: "num", style: "font-size:2.4rem;font-weight:600;margin:0;color:" + (ratio >= PASS ? "var(--ok)" : "var(--no)"),
        text: st.correct + "/" + st.total }),
      el("h2", { style: "margin:0", text: ratio >= PASS ? "Geçtin" : "Biraz daha tekrar gerek" }),
      el("p", { class: "small muted", style: "margin:0",
        text: "Doğruluk %" + Math.round(ratio * 100) + " · Kapsam: " + scopeLabel(exam.scope) }),
      el("div", { class: "grid2", style: "width:100%" }, [
        el("button", { class: "btn ghost", text: "Yeni sınav", onclick: function () { exam = null; render(); } }),
        wrongs.length
          ? el("button", { class: "btn", text: "Yanlışları çöz", onclick: function () {
              exam = { items: shuffle(wrongs), i: 0, answers: {}, scope: "yanlis", done: false };
              window.scrollTo(0, 0); render();
            } })
          : el("button", { class: "btn", text: "Kartlara geç", onclick: function () { exam = null; route.study = "kartlar"; render(); } })
      ])
    ]));

    if (wrongs.length) {
      var sec = el("section", { style: "margin-top:1.6rem" }, [
        el("p", { class: "label", text: "Yanlış yanıtladıkların" }),
        el("p", { class: "small muted", style: "margin:.3rem 0 .8rem",
          text: "Bunlar yanlışlar havuzuna eklendi; doğru yanıtladığında havuzdan çıkar." })
      ]);
      wrongs.forEach(function (x) {
        sec.appendChild(el("div", { class: "card", style: "margin-bottom:.7rem" }, [
          el("p", { class: "q-prompt", text: x.q.prompt }),
          el("p", { class: "small", style: "margin:.5rem 0 0;color:var(--ok)", text: "Doğru: " + x.q.options[x.q.answerIndex] }),
          el("p", { class: "why", style: "margin-top:.5rem", text: x.q.explanation }),
          el("button", { class: "btn quiet", text: x.lesson.title + " →",
            onclick: function () { exam = null; openLesson(x.lesson.id); } })
        ]));
      });
      box.appendChild(sec);
    }
  }

  /* ---------- istatistik ---------- */
  function renderStats(box) {
    var p = progress(course.id);
    var ids = orderedLessons.map(function (l) { return l.id; });
    var done = doneCount(ids);
    var ok = 0, no = 0;
    Object.keys(p.qstats).forEach(function (k) { ok += p.qstats[k].ok || 0; no += p.qstats[k].no || 0; });
    var acc = ok + no ? Math.round((ok / (ok + no)) * 100) : null;

    box.appendChild(el("div", { class: "stat-grid" }, [
      statTile(streakNow() + "", "gün seri", "var(--accent)"),
      statTile(state.streak.best + "", "en uzun seri"),
      statTile(done + "/" + ids.length, "ders tamam"),
      statTile(acc === null ? "—" : "%" + acc, "soru doğruluğu", acc === null ? null : (acc >= 67 ? "var(--ok)" : "var(--no)")),
      statTile(learnedCards() + "", "kart öğrenildi"),
      statTile(Object.keys(state.days).length + "", "çalışma günü")
    ]));

    var grid = el("div", { class: "heat" }), i;
    for (i = 27; i >= 0; i--) {
      var key = shiftKey(-i), val = state.days[key] || 0;
      var lvl = val === 0 ? 0 : val >= state.prefs.goal ? 4 : Math.max(1, Math.ceil((val / state.prefs.goal) * 3));
      grid.appendChild(el("span", { class: "heat-cell l" + lvl, title: key + ": " + val }));
    }
    var totalActs = Object.keys(state.days).reduce(function (a, k) { return a + state.days[k]; }, 0);
    box.appendChild(el("section", { class: "card", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Son 28 gün" }), grid,
      el("p", { class: "small muted", style: "margin:.6rem 0 0",
        text: "Toplam " + totalActs + " çalışma hareketi (tüm kurslar). Koyu kareler günlük hedefin tamamlandığı günlerdir." })
    ]));

    var mods = el("section", { class: "card stack", style: "margin-top:1.1rem" }, [el("p", { class: "label", text: "Modül ilerlemesi" })]);
    course.modules.forEach(function (m, i2) {
      var mids = moduleLessons(m.id).map(function (l) { return l.id; });
      var mp = mids.length ? Math.round((doneCount(mids) / mids.length) * 100) : 0;
      mods.appendChild(el("div", null, [
        el("div", { class: "row", style: "margin-bottom:.3rem" }, [
          el("span", { class: "small", text: m.title }),
          el("span", { class: "num small", style: "color:" + moduleColor(i2), text: doneCount(mids) + "/" + mids.length })
        ]),
        meter(mp, moduleColor(i2))
      ]));
    });
    box.appendChild(mods);

    var byLesson = {};
    Object.keys(p.wrong).forEach(function (k) {
      var lid = k.split(":")[0];
      byLesson[lid] = (byLesson[lid] || 0) + p.wrong[k];
    });
    var weak = Object.keys(byLesson).filter(function (id) { return lessonById[id]; })
      .sort(function (a, b) { return byLesson[b] - byLesson[a]; }).slice(0, 5);

    var weakSec = el("section", { style: "margin-top:1.1rem" }, [el("p", { class: "label", text: "Zayıf konular" })]);
    if (!weak.length) {
      weakSec.appendChild(el("p", { class: "small muted card", style: "margin-top:.5rem",
        text: "Şu an yanlış havuzunda ders yok. Sınav çözdükçe zayıf konular burada listelenir." }));
    } else {
      var ul = el("ul", { class: "plain card", style: "padding:.2rem 1.1rem;margin-top:.5rem" });
      weak.forEach(function (id) {
        ul.appendChild(el("li", null, [
          el("button", { class: "block hist-row", onclick: function () { openLesson(id); } }, [
            el("span", { class: "small", text: lessonById[id].title }),
            el("span", { class: "num small", style: "color:var(--no)", text: byLesson[id] + " yanlış" })
          ])
        ]));
      });
      weakSec.appendChild(ul);
    }
    box.appendChild(weakSec);

    var boxes = [0, 0, 0, 0, 0], untouched = 0;
    cards.forEach(function (c) {
      var s = p.cards[c.id];
      if (!s) untouched += 1; else boxes[s.box - 1] += 1;
    });
    var peak = Math.max(1, Math.max.apply(null, boxes));
    var bar = el("div", { class: "boxes" });
    boxes.forEach(function (n, idx) {
      bar.appendChild(el("div", { class: "box-col" }, [
        el("span", { class: "box-bar", style: "height:" + Math.max(3, (n / peak) * 88) + "px" }),
        el("span", { class: "num small muted", text: n + "" }),
        el("span", { class: "label", style: "font-size:.6rem", text: "K" + (idx + 1) })
      ]));
    });
    box.appendChild(el("section", { class: "card", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Kart kutuları" }), bar,
      el("p", { class: "small muted", style: "margin:.5rem 0 0",
        text: untouched + " kart henüz hiç çalışılmadı. Kutu numarası büyüdükçe kartın tekrar aralığı uzar." })
    ]));
  }

  /* ---------- kurs ayarları ---------- */
  function renderCourseSettings(box) {
    var p = progress(course.id);

    var goalOut = el("span", { class: "ctl-val num", text: state.prefs.goal + "" });
    var goal = el("input", { type: "range", min: 5, max: 40, step: 5, value: state.prefs.goal, "aria-label": "Günlük hedef" });
    goal.addEventListener("input", function (e) {
      state.prefs.goal = Number(e.target.value); goalOut.textContent = state.prefs.goal; save();
    });
    box.appendChild(el("section", { class: "card stack" }, [
      el("p", { class: "label", text: "Günlük hedef" }),
      el("div", { class: "ctl" }, [
        el("div", { class: "ctl-top" }, [el("span", { class: "ctl-label", text: "Günde kaç hareket" }), goalOut]), goal
      ]),
      el("p", { class: "small muted", style: "margin:0", text: "Her yanıtlanan soru ve çalışılan kart bir hareket sayılır." })
    ]));

    var dirBox = el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Kart tekrarı" }),
      segmented([["ileri", "Kavram → tanım"], ["geri", "Tanım → kavram"], ["karisik", "Karışık"]],
        state.prefs.dir, function (v) { state.prefs.dir = v; session = null; save(); render(); }),
      toggleRow("Yazarak cevapla", "Tanımı görüp kavramı klavyeyle yazarsın; yanıt otomatik denetlenir.",
        state.prefs.typed, function (v) { state.prefs.typed = v; session = null; save(); render(); })
    ]);
    var limits = [10, 15, 20, 30];
    var limitBox = el("div", { class: "pills" });
    limits.forEach(function (n) {
      limitBox.appendChild(el("button", {
        type: "button", class: "chip tap" + (state.prefs.limit === n ? " on" : ""), text: n + " kart",
        onclick: function () { state.prefs.limit = n; session = null; save(); render(); }
      }));
    });
    dirBox.appendChild(el("p", { class: "label", style: "margin-top:.4rem", text: "Oturum uzunluğu" }));
    dirBox.appendChild(limitBox);
    box.appendChild(dirBox);

    var front = el("input", { type: "text", class: "typed", placeholder: "Ön yüz: kavram ya da soru", "aria-label": "Kart ön yüzü" });
    var back = el("textarea", { class: "typed", rows: "3", placeholder: "Arka yüz: tanım ya da cevap", "aria-label": "Kart arka yüzü" });
    var own = el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Kendi kartların" }), front, back,
      el("button", { class: "btn wide", text: "Kart ekle", onclick: function () {
        var f = front.value.trim(), b = back.value.trim();
        if (!f || !b) return;
        p.custom.push({ id: "u-" + Date.now().toString(36) + Math.floor(Math.random() * 1000), front: f, back: b });
        save(); refreshDeck(); session = null; render();
      } })
    ]);
    if (p.custom.length) {
      var ul = el("ul", { class: "plain", style: "margin-top:.3rem" });
      p.custom.slice().reverse().forEach(function (c) {
        ul.appendChild(el("li", { class: "own-row" }, [
          el("span", { class: "small", text: c.front }),
          el("button", { class: "btn quiet danger small", text: "Sil", onclick: function () {
            p.custom = p.custom.filter(function (x) { return x.id !== c.id; });
            delete p.cards[c.id];
            save(); refreshDeck(); session = null; render();
          } })
        ]));
      });
      own.appendChild(ul);
    } else {
      own.appendChild(el("p", { class: "small muted", style: "margin:0",
        text: "Henüz kendi kartın yok. Eklediklerin aynı aralıklı tekrar takvimine girer." }));
    }
    box.appendChild(own);

    box.appendChild(el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Bu kurs" }),
      el("p", { class: "small muted", style: "margin:0",
        text: "İlerleme yalnızca bu tarayıcıda saklanır. Uygulama genelindeki ayarlar ve yedekleme için kütüphanedeki Ayarlar bölümüne bak." }),
      el("button", { class: "btn ghost danger", text: "Bu kursun ilerlemesini sıfırla", onclick: function () {
        if (!window.confirm(course.title + " kursundaki tüm ilerleme silinsin mi?")) return;
        delete state.courses[course.id];
        resetStudy(); save(); refreshDeck(); go("kurs", { tab: "kurs" });
      } })
    ]));
  }

  /* ================= Ara ================= */
  function snippet(raw, q) {
    var h = norm(raw), i = h.indexOf(q);
    if (i < 0) return raw.slice(0, 90) + "…";
    var start = Math.max(0, i - 40), end = Math.min(raw.length, i + q.length + 60);
    return (start > 0 ? "…" : "") + raw.slice(start, end).trim() + (end < raw.length ? "…" : "");
  }

  function renderSearch() {
    head(course.title, "Ara", "Ders metinleri, kavramlar, kişiler ve zaman çizelgesinde arar. Türkçe karakter kullanmadan da yazabilirsin.");

    var input = el("input", { type: "search", placeholder: "Kavram, kişi ya da konu ara",
      "aria-label": "Kursta ara", value: route.query });
    var results = el("div", { style: "margin-top:.9rem" });

    function group(title, n) {
      return el("p", { class: "label", style: "margin:1.4rem 0 .5rem", text: title + " · " + n });
    }

    function paint() {
      var q = norm(route.query);
      results.textContent = "";
      var glossary = course.glossary || [];

      if (!q) {
        results.appendChild(el("p", { class: "small muted", style: "margin:.6rem 0 0",
          text: glossary.length
            ? "Sözlükteki " + glossary.length + " kavram aşağıda. Aramaya başlayınca dersler ve kişiler de listelenir."
            : "Bu kursta sözlük yok. Aramaya başla." }));
        var ul = el("ul", { class: "plain stack", style: "margin-top:.8rem" });
        glossary.forEach(function (g) { ul.appendChild(glossaryCard(g)); });
        results.appendChild(ul);
        return;
      }

      var gl = glossary.filter(function (g) { return norm(g.term).indexOf(q) >= 0 || norm(g.definition).indexOf(q) >= 0; });
      var fg = (course.figures || []).filter(function (f) {
        return norm(f.name).indexOf(q) >= 0 || norm(f.oneLiner).indexOf(q) >= 0 || norm(f.tag).indexOf(q) >= 0;
      });
      var ls = lessonIndex.filter(function (x) { return x.hay.indexOf(q) >= 0; });
      var tl = (course.timeline || []).filter(function (e) {
        return norm(e.title).indexOf(q) >= 0 || norm(e.body).indexOf(q) >= 0 || norm(e.yearLabel).indexOf(q) >= 0;
      });

      var total = gl.length + fg.length + ls.length + tl.length;
      results.appendChild(el("p", { class: "small muted", style: "margin:.6rem 0 0", text: total + " sonuç" }));
      if (!total) {
        results.appendChild(el("p", { class: "card center small muted", style: "margin-top:.8rem",
          text: "Bu aramaya uyan sonuç yok. Farklı bir sözcük dene." }));
        return;
      }

      if (gl.length) {
        results.appendChild(group("Kavramlar", gl.length));
        var u1 = el("ul", { class: "plain stack" });
        gl.forEach(function (g) { u1.appendChild(glossaryCard(g)); });
        results.appendChild(u1);
      }
      if (ls.length) {
        results.appendChild(group("Dersler", ls.length));
        var u2 = el("ul", { class: "plain stack" });
        ls.forEach(function (x) {
          u2.appendChild(el("li", { class: "card" }, [
            el("button", { class: "block", onclick: function () { openLesson(x.lesson.id); } }, [
              el("span", { class: "lesson-title", text: x.lesson.title }),
              el("span", { class: "small muted", style: "display:block;margin-top:.3rem", text: snippet(x.raw, q) })
            ])
          ]));
        });
        results.appendChild(u2);
      }
      if (fg.length) {
        results.appendChild(group(course.figuresLabel || "Kişiler", fg.length));
        var u3 = el("ul", { class: "plain stack" });
        fg.forEach(function (f) { u3.appendChild(figureCard(f)); });
        results.appendChild(u3);
      }
      if (tl.length) {
        results.appendChild(group(course.timelineLabel || "Zaman çizelgesi", tl.length));
        var u4 = el("ul", { class: "plain stack" });
        tl.forEach(function (e) {
          u4.appendChild(el("li", { class: "card" }, [
            el("p", { class: "year", style: "margin:0", text: e.yearLabel }),
            el("h3", { style: "margin:.1rem 0 .2rem", text: e.title }),
            el("p", { class: "small muted", style: "margin:0", text: e.body })
          ]));
        });
        results.appendChild(u4);
      }
    }

    input.addEventListener("input", function (e) { route.query = e.target.value; paint(); });
    paint();
    view.appendChild(el("div", null, [input, results]));
  }

  function glossaryCard(g) {
    return el("li", { class: "card" }, [
      el("h3", { text: g.term }),
      el("p", { class: "small muted", style: "margin:.25rem 0 0", text: g.definition }),
      g.lessonId && lessonById[g.lessonId]
        ? el("button", { class: "btn quiet", text: "İlgili ders →", onclick: function () { openLesson(g.lessonId); } })
        : null
    ]);
  }

  /* ================= üretim ================= */

  var API_URL = "https://api.anthropic.com/v1/messages";
  var API_VERSION = "2023-06-01";

  /* $ / milyon token — kaba maliyet tahmini için */
  var PRICES = {
    "claude-opus-5": [5, 25],
    "claude-sonnet-5": [3, 15]
  };
  var MODELS = [
    ["claude-opus-5", "Opus 5 — en iyi içerik"],
    ["claude-sonnet-5", "Sonnet 5 — daha hızlı ve ucuz"]
  ];

  var SYSTEM = [
    "Sen Türkçe ders içeriği yazan bir editörsün. 'Okul' adlı öğrenme uygulaması için kurs üretiyorsun.",
    "",
    "Yazım ilkeleri:",
    "- Türkçe yaz. Açık, akıcı, ders kitabı ciddiyetinde ama kuru olmayan bir dil kullan.",
    "- Somut ol: her soyut kavramı bir örnekle, tarihle, sayıyla ya da isimle bağla.",
    "- Uydurma. Emin olmadığın tarihi, sayıyı ya da alıntıyı yazma; onun yerine daha genel ama doğru bir ifade kullan.",
    "- Tartışmalı konularda tartışmanın kendisini anlat, taraf tutma.",
    "- Paragraf yaz; liste yalnızca gerçekten liste olan şeyler için.",
    "- Klişe açılışlardan kaçın ('Bu derste', 'Sonuç olarak', 'Görüldüğü gibi').",
    "- Kimlikler (id alanları) yalnızca küçük harf, rakam ve tire içerir; Türkçe karakter kullanma."
  ].join("\n");

  var S_LESSON_SECTION = {
    type: "object", additionalProperties: false,
    required: ["kind", "title", "body", "items", "expression", "note", "text", "source"],
    properties: {
      kind: { type: "string", enum: ["text", "list", "example", "quote", "formula"] },
      title: { type: "string" },
      body: { type: "string" },
      items: { type: "array", items: { type: "string" } },
      expression: { type: "string" },
      note: { type: "string" },
      text: { type: "string" },
      source: { type: "string" }
    }
  };

  var SCHEMAS = {
    plan: {
      type: "object", additionalProperties: false,
      required: ["title", "eyebrow", "subtitle", "description", "icon", "accent", "figuresLabel", "timelineTitle", "timelineIntro", "modules"],
      properties: {
        title: { type: "string" }, eyebrow: { type: "string" }, subtitle: { type: "string" },
        description: { type: "string" }, icon: { type: "string" }, accent: { type: "string" },
        figuresLabel: { type: "string" }, timelineTitle: { type: "string" }, timelineIntro: { type: "string" },
        modules: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["id", "title", "description", "lessons"],
            properties: {
              id: { type: "string" }, title: { type: "string" }, description: { type: "string" },
              lessons: {
                type: "array",
                items: {
                  type: "object", additionalProperties: false,
                  required: ["id", "title", "subtitle", "minutes", "keyTerms"],
                  properties: {
                    id: { type: "string" }, title: { type: "string" }, subtitle: { type: "string" },
                    minutes: { type: "integer" }, keyTerms: { type: "array", items: { type: "string" } }
                  }
                }
              }
            }
          }
        }
      }
    },
    lesson: {
      type: "object", additionalProperties: false,
      required: ["sections", "quiz"],
      properties: {
        sections: { type: "array", items: S_LESSON_SECTION },
        quiz: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["id", "prompt", "options", "answerIndex", "explanation"],
            properties: {
              id: { type: "string" }, prompt: { type: "string" },
              options: { type: "array", items: { type: "string" } },
              answerIndex: { type: "integer" }, explanation: { type: "string" }
            }
          }
        }
      }
    },
    reference: {
      type: "object", additionalProperties: false,
      required: ["glossary", "figures"],
      properties: {
        glossary: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["id", "term", "definition", "lessonId"],
            properties: { id: { type: "string" }, term: { type: "string" }, definition: { type: "string" }, lessonId: { type: "string" } }
          }
        },
        figures: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["id", "name", "lifespan", "tag", "oneLiner", "contributions", "lessonId"],
            properties: {
              id: { type: "string" }, name: { type: "string" }, lifespan: { type: "string" },
              tag: { type: "string" }, oneLiner: { type: "string" },
              contributions: { type: "array", items: { type: "string" } }, lessonId: { type: "string" }
            }
          }
        }
      }
    },
    timeline: {
      type: "object", additionalProperties: false,
      required: ["eras", "events"],
      properties: {
        eras: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["id", "label"],
            properties: { id: { type: "string" }, label: { type: "string" } }
          }
        },
        events: {
          type: "array",
          items: {
            type: "object", additionalProperties: false,
            required: ["id", "year", "yearLabel", "title", "body", "era", "figureId"],
            properties: {
              id: { type: "string" }, year: { type: "integer" }, yearLabel: { type: "string" },
              title: { type: "string" }, body: { type: "string" }, era: { type: "string" }, figureId: { type: "string" }
            }
          }
        }
      }
    }
  };

  var usageTotal = { input: 0, output: 0 };

  function apiError(status, body) {
    var msg = (body && body.error && body.error.message) || "";
    if (status === 401) return "API anahtarı geçersiz. Ayarlar bölümünden kontrol et.";
    if (status === 403) return "Bu anahtarın bu modele erişimi yok. Farklı bir model dene ya da anahtarın iznini kontrol et.";
    if (status === 429) return "Hız sınırına takıldık. Bir dakika bekleyip yeniden dene.";
    if (status === 400 && /credit|balance/i.test(msg)) {
      return "Anthropic hesabında API kredisi yok. console.anthropic.com → Settings → Billing bölümünden kredi yükleyip “Yeniden dene” de. " +
        "Not: Claude.ai aboneliği (Pro/Max) API kredisi içermez, ikisi ayrı hesaplanır.";
    }
    if (status === 529 || status === 500) return "Anthropic tarafında geçici bir sorun var. Birazdan yeniden dene.";
    return "API hatası (" + status + ")" + (msg ? ": " + msg : "");
  }

  function callModel(prompt, schema, maxTokens, signal, onProgress) {
    var body = {
      model: state.prefs.model,
      max_tokens: maxTokens,
      stream: true,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: "medium", format: { type: "json_schema", schema: schema } }
    };

    return fetch(API_URL, {
      method: "POST",
      signal: signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": state.apiKey,
        "anthropic-version": API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          var parsed = null;
          try { parsed = JSON.parse(t); } catch (e) {}
          var err = new Error(apiError(res.status, parsed));
          /* API'nin kendi metnini gizleme — teşhis için gerekiyor */
          err.detail = (parsed && parsed.error && parsed.error.message) || t.slice(0, 300);
          err.status = res.status;
          throw err;
        });
      }
      return readStream(res, onProgress);
    });
  }

  function readStream(res, onProgress) {
    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "", text = "", stop = null;

    function handle(payload) {
      var ev;
      try { ev = JSON.parse(payload); } catch (e) { return; }
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") {
        text += ev.delta.text;
        if (onProgress) onProgress(text.length);
      } else if (ev.type === "message_start" && ev.message && ev.message.usage) {
        usageTotal.input += ev.message.usage.input_tokens || 0;
      } else if (ev.type === "message_delta") {
        if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        if (ev.usage) usageTotal.output += ev.usage.output_tokens || 0;
      } else if (ev.type === "error") {
        throw new Error((ev.error && ev.error.message) || "Akış hatası");
      }
    }

    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return finish();
        buffer += decoder.decode(r.value, { stream: true });
        var parts = buffer.split("\n\n");
        buffer = parts.pop();
        parts.forEach(function (block) {
          block.split("\n").forEach(function (line) {
            if (line.indexOf("data:") === 0) handle(line.slice(5).trim());
          });
        });
        return pump();
      });
    }

    function finish() {
      if (stop === "refusal") throw new Error("Model bu konuda içerik üretmeyi reddetti. Farklı bir konu dene.");
      if (stop === "max_tokens") throw new Error("Yanıt sınıra takıldı ve yarım kaldı. Yeniden dene ya da daha dar bir konu seç.");
      var t = text.trim();
      if (!t) throw new Error("Model boş yanıt döndü.");
      try { return JSON.parse(t); }
      catch (e) { throw new Error("Model geçerli olmayan bir yanıt döndü."); }
    }

    return pump();
  }

  /* ---------- istekler ---------- */
  function planPrompt(topic) {
    return [
      "Konu: " + topic,
      "",
      "Bu konu için bir kursun planını çıkar.",
      "- 3 ya da 4 modül kur; modüller konuyu mantıklı bir sırayla (temeller → derinleşme → bağlam/tarih) böler.",
      "- Toplam 10-14 ders olsun, her modülde en az 3.",
      "- Her ders için: kısa ve somut bir başlık, tek cümlelik bir alt başlık, tahmini okuma süresi (7-10 dakika) ve 3-5 anahtar terim.",
      "- 'icon': konuyu temsil eden tek bir emoji.",
      "- 'accent': konuya yakışan, koyu ve okunaklı bir vurgu rengi; #rrggbb biçiminde.",
      "- 'figuresLabel': bu alandaki önemli kişilerin ortak adı (örneğin 'Düşünürler', 'Sanatçılar', 'Bilim insanları').",
      "- 'timelineTitle' ve 'timelineIntro': konunun tarihsel çizelgesi için bir başlık ve tek cümlelik giriş.",
      "- 'eyebrow': alanın adı (örneğin 'Sanat tarihi'). 'subtitle': kursun tek cümlelik iddiası.",
      "- Ders ve modül kimlikleri kısa, tireli ve Türkçe karaktersiz olsun."
    ].join("\n");
  }

  function lessonPrompt(plan, mod, lesson) {
    return [
      "Kurs: " + plan.title + " — " + plan.subtitle,
      "Modül: " + mod.title + " (" + mod.description + ")",
      "Ders: " + lesson.title,
      "Alt başlık: " + lesson.subtitle,
      "Anahtar terimler: " + (lesson.keyTerms || []).join(", "),
      "",
      "Bu dersin tam içeriğini yaz.",
      "",
      "sections: 5-7 bölüm. Her bölümün 'kind' alanı şunlardan biri:",
      "- text: bir paragraf. İlk bölüm başlıksız olsun (title boş bırak), sonrakiler kısa bir başlık taşısın. body 90-160 kelime.",
      "- list: title ve items (3-6 madde, her madde tam cümle).",
      "- example: title 'Örnek: ...' ile başlar, body somut ve sayısal/tarihsel bir vaka anlatır.",
      "- quote: text (gerçek ve doğruluğundan emin olduğun bir alıntı), source (kim, hangi eser, hangi yıl). Emin değilsen quote kullanma.",
      "- formula: title, expression (kısa formül ya da ilişki), note (formülün ne anlattığı). Yalnızca konuya gerçekten uygunsa kullan.",
      "En az 3 tanesi 'text' olsun. Kullanmadığın alanları boş string ya da boş dizi olarak bırak.",
      "",
      "quiz: 3 soru. Her soruda 4 seçenek, doğru seçeneğin sırası (answerIndex, 0'dan başlar) ve neden doğru olduğunu anlatan bir açıklama.",
      "Sorular ezber değil kavrayış ölçsün. Yanlış seçenekler de makul görünsün. Soru kimlikleri q1, q2, q3."
    ].join("\n");
  }

  function referencePrompt(plan, lessonList) {
    return [
      "Kurs: " + plan.title,
      "Dersler (kimlik — başlık):",
      lessonList.map(function (l) { return "- " + l.id + " — " + l.title; }).join("\n"),
      "",
      "İki liste üret.",
      "",
      "glossary: 24-32 kavram. Her biri: kısa tanım (1-2 cümle) ve hangi derse ait olduğu (lessonId, yukarıdaki kimliklerden biri).",
      "Kavramlar derslere dengeli dağılsın; en temel ve en çok kullanılan terimleri seç.",
      "",
      "figures: bu alanın 10-14 önemli kişisi. Her biri: adı, yaşam yılları (bilmiyorsan boş bırak), tag (ekol/dönem/uzmanlık),",
      "oneLiner (tek cümlede neden önemli), contributions (2-4 madde) ve ilgili ders kimliği.",
      "Yalnızca gerçekten var olan ve doğruluğundan emin olduğun kişileri yaz."
    ].join("\n");
  }

  function timelinePrompt(plan, figures) {
    return [
      "Kurs: " + plan.title,
      figures.length ? "Kişi kimlikleri: " + figures.map(function (f) { return f.id; }).join(", ") : "",
      "",
      "Bu alanın tarihsel çizelgesini üret.",
      "eras: 3-5 dönem (id ve Türkçe etiket), kronolojik sırada.",
      "events: 16-24 olay. Her olay: yıl (year, sayı; milattan önce ise negatif), yearLabel (görünecek etiket, örneğin '1789' ya da 'MÖ 350'),",
      "kısa başlık, 1-2 cümlelik açıklama, ait olduğu dönem (era) ve varsa ilgili kişinin kimliği (figureId; yoksa boş bırak).",
      "Yalnızca doğruluğundan emin olduğun tarihleri yaz; emin değilsen olayı yazma."
    ].join("\n");
  }

  /* ---------- boru hattı ---------- */
  var job = null;

  function startGeneration(topic) {
    var ctrl = new AbortController();
    job = {
      topic: topic, steps: [], done: false, error: null, course: null,
      abort: function () { ctrl.abort(); },
      cancelled: false
    };
    usageTotal = { input: 0, output: 0 };

    function step(label) {
      var s = { label: label, state: "run" };
      job.steps.push(s);
      render();
      return s;
    }
    function ok(s, note) { s.state = "ok"; if (note) s.note = note; render(); }

    var plan, lessons = [], reference = { glossary: [], figures: [] }, timeline = { eras: [], events: [] };
    var s1 = step("Kurs planı çıkarılıyor");

    callModel(planPrompt(topic), SCHEMAS.plan, 8000, ctrl.signal)
      .then(function (p) {
        plan = normalizePlan(p, topic);
        ok(s1, plan.modules.length + " modül · " + plan.stubs.length + " ders");

        var queue = plan.stubs.slice();
        var total = queue.length;
        var sL = step("Dersler yazılıyor (0/" + total + ")");
        var written = 0;

        function runOne(stub) {
          return callModel(lessonPrompt(plan, stub.module, stub.lesson), SCHEMAS.lesson, 16000, ctrl.signal)
            .then(function (r) {
              lessons.push(buildLesson(stub, r));
              written += 1;
              sL.label = "Dersler yazılıyor (" + written + "/" + total + ")";
              render();
            });
        }
        function worker() {
          if (!queue.length) return Promise.resolve();
          return runOne(queue.shift()).then(worker);
        }
        return Promise.all([worker(), worker()]).then(function () {
          ok(sL, lessons.length + " ders yazıldı");
        });
      })
      .then(function () {
        var s3 = step("Sözlük ve kişiler hazırlanıyor");
        return callModel(referencePrompt(plan, lessons), SCHEMAS.reference, 12000, ctrl.signal)
          .then(function (r) {
            reference = r;
            ok(s3, (r.glossary || []).length + " kavram · " + (r.figures || []).length + " kişi");
          });
      })
      .then(function () {
        var s4 = step("Zaman çizelgesi kuruluyor");
        return callModel(timelinePrompt(plan, reference.figures || []), SCHEMAS.timeline, 10000, ctrl.signal)
          .then(function (r) { timeline = r; ok(s4, (r.events || []).length + " olay"); })
          .catch(function () { ok(s4, "atlandı"); });
      })
      .then(function () {
        var c = assembleCourse(plan, lessons, reference, timeline);
        if (!writeGenerated(c)) throw new Error("Tarayıcı depolama alanı doldu. Ayarlar'dan eski kurslardan birini sil.");
        state.generated.push({
          id: c.id, title: c.title, subtitle: c.subtitle, description: c.description,
          icon: c.icon, accent: c.accent, accentDark: c.accentDark,
          lessons: c.lessons.length, questions: c.lessons.reduce(function (a, l) { return a + l.quiz.length; }, 0),
          charts: 0, source: "generated", createdAt: Date.now()
        });
        save();
        job.done = true;
        job.course = c;
        job.usage = { input: usageTotal.input, output: usageTotal.output, cost: estimateCost() };
        render();
      })
      .catch(function (e) {
        if (ctrl.signal.aborted) { job.cancelled = true; job.error = "Üretim iptal edildi."; }
        else { job.error = e.message || String(e); job.detail = e.detail || ""; }
        render();
      });
  }

  function estimateCost() {
    var p = PRICES[state.prefs.model] || PRICES["claude-opus-5"];
    return (usageTotal.input / 1e6) * p[0] + (usageTotal.output / 1e6) * p[1];
  }

  /* ---------- normalleştirme ---------- */
  function uniqueId(base, used) {
    var id = slug(base) || "x", n = 2;
    while (used[id]) { id = slug(base) + "-" + n; n += 1; }
    used[id] = true;
    return id;
  }

  function normalizePlan(p, topic) {
    var usedM = {}, usedL = {}, stubs = [];
    var modules = (p.modules || []).filter(function (m) { return m && m.title; }).map(function (m) {
      var mid = uniqueId(m.id || m.title, usedM);
      var lessons = (m.lessons || []).filter(function (l) { return l && l.title; });
      lessons.forEach(function (l, i) {
        var lid = uniqueId(l.id || l.title, usedL);
        var stub = {
          module: { id: mid, title: m.title, description: m.description || "" },
          lesson: {
            id: lid, moduleId: mid, order: i + 1, title: l.title, subtitle: l.subtitle || "",
            minutes: Math.max(4, Math.min(20, l.minutes || 8)),
            keyTerms: (l.keyTerms || []).filter(Boolean).slice(0, 6)
          }
        };
        stubs.push(stub);
      });
      return { id: mid, title: m.title, description: m.description || "" };
    }).filter(function (m) { return stubs.some(function (s) { return s.module.id === m.id; }); });

    if (!modules.length || !stubs.length) throw new Error("Model kullanılabilir bir plan üretemedi. Konuyu biraz daha netleştirip yeniden dene.");

    var accent = /^#[0-9a-fA-F]{6}$/.test(p.accent || "") ? p.accent : "#1b6b4f";
    return {
      title: (p.title || topic).trim(),
      eyebrow: (p.eyebrow || topic).trim(),
      subtitle: (p.subtitle || "").trim(),
      description: (p.description || "").trim(),
      icon: (p.icon || "📘").trim().slice(0, 4),
      accent: accent,
      figuresLabel: (p.figuresLabel || "Kişiler").trim(),
      timelineTitle: (p.timelineTitle || "Zaman çizelgesi").trim(),
      timelineIntro: (p.timelineIntro || "").trim(),
      modules: modules,
      stubs: stubs
    };
  }

  function buildLesson(stub, r) {
    var sections = (r.sections || []).map(function (s) {
      var kind = s.kind;
      if (kind === "list") {
        var items = (s.items || []).filter(Boolean);
        return items.length ? { kind: "list", title: s.title || "", items: items } : null;
      }
      if (kind === "quote") return s.text ? { kind: "quote", text: s.text, source: s.source || "" } : null;
      if (kind === "formula") return s.expression ? { kind: "formula", title: s.title || "", expression: s.expression, note: s.note || "" } : null;
      if (kind === "example") return s.body ? { kind: "example", title: s.title || "Örnek", body: s.body } : null;
      if (!s.body) return null;
      var t = { kind: "text", body: s.body };
      if (s.title) t.title = s.title;
      return t;
    }).filter(Boolean);

    var quiz = (r.quiz || []).filter(function (q) {
      return q && q.prompt && Array.isArray(q.options) && q.options.length >= 2 &&
        q.answerIndex >= 0 && q.answerIndex < q.options.length;
    }).map(function (q, i) {
      return { id: q.id || ("q" + (i + 1)), prompt: q.prompt, options: q.options,
        answerIndex: q.answerIndex, explanation: q.explanation || "" };
    });

    var l = stub.lesson;
    return {
      id: l.id, moduleId: l.moduleId, order: l.order, title: l.title, subtitle: l.subtitle,
      minutes: l.minutes, keyTerms: l.keyTerms, sections: sections, quiz: quiz
    };
  }

  function assembleCourse(plan, lessons, reference, timeline) {
    lessons.sort(function (a, b) {
      var ma = plan.modules.findIndex(function (m) { return m.id === a.moduleId; });
      var mb = plan.modules.findIndex(function (m) { return m.id === b.moduleId; });
      return ma - mb || a.order - b.order;
    });
    var lessonIds = {};
    lessons.forEach(function (l) { lessonIds[l.id] = true; });

    var usedG = {};
    var glossary = (reference.glossary || []).filter(function (g) { return g && g.term && g.definition; })
      .map(function (g) {
        return { id: uniqueId(g.id || g.term, usedG), term: g.term, definition: g.definition,
          lessonId: lessonIds[g.lessonId] ? g.lessonId : null };
      });

    var usedF = {}, figureIds = {};
    var figures = (reference.figures || []).filter(function (f) { return f && f.name && f.oneLiner; })
      .map(function (f) {
        var id = uniqueId(f.id || f.name, usedF);
        figureIds[id] = true;
        return { id: id, name: f.name, lifespan: f.lifespan || "", tag: f.tag || "",
          oneLiner: f.oneLiner, contributions: (f.contributions || []).filter(Boolean),
          lessonId: lessonIds[f.lessonId] ? f.lessonId : null };
      });

    var eraLabels = {};
    (timeline.eras || []).forEach(function (e) { if (e && e.id && e.label) eraLabels[slug(e.id)] = e.label; });
    var usedE = {};
    var events = (timeline.events || []).filter(function (e) { return e && e.title && e.yearLabel; })
      .map(function (e) {
        var era = slug(e.era || "");
        return { id: uniqueId(e.id || e.title, usedE), year: typeof e.year === "number" ? e.year : 0,
          yearLabel: e.yearLabel, title: e.title, body: e.body || "",
          era: eraLabels[era] ? era : Object.keys(eraLabels)[0] || "donem",
          figureId: figureIds[e.figureId] ? e.figureId : null };
      })
      .sort(function (a, b) { return a.year - b.year; });
    if (!Object.keys(eraLabels).length && events.length) eraLabels = { donem: "Tümü" };

    var used = {};
    libraryEntries().forEach(function (e) { used[e.id] = true; });
    var id = uniqueId(plan.title, used);

    return {
      id: id, title: plan.title, eyebrow: plan.eyebrow, subtitle: plan.subtitle,
      description: plan.description, icon: plan.icon,
      accent: plan.accent, accentDark: lighten(plan.accent),
      figuresLabel: plan.figuresLabel, timelineLabel: "Zaman çizelgesi",
      timelineTitle: plan.timelineTitle, timelineIntro: plan.timelineIntro,
      source: "generated", hasCharts: false, createdAt: Date.now(),
      topic: job ? job.topic : plan.title, model: state.prefs.model,
      modules: plan.modules, lessons: lessons, glossary: glossary,
      figures: figures, timeline: events, eraLabels: eraLabels
    };
  }

  /* koyu vurgu renginin koyu temada okunur karşılığı */
  function lighten(hex) {
    var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    var rgb = [1, 2, 3].map(function (i) { return parseInt(m[i], 16) / 255; });
    var max = Math.max.apply(null, rgb), min = Math.min.apply(null, rgb);
    var l = (max + min) / 2, d = max - min, h = 0, s = 0;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === rgb[0]) h = ((rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0));
      else if (max === rgb[1]) h = (rgb[2] - rgb[0]) / d + 2;
      else h = (rgb[0] - rgb[1]) / d + 4;
      h /= 6;
    }
    return hsl(h, Math.min(0.62, Math.max(0.35, s)), 0.68);
  }
  function hsl(h, s, l) {
    function f(n) {
      var k = (n + h * 12) % 12;
      var a = s * Math.min(l, 1 - l);
      var v = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      return Math.round(v * 255).toString(16).padStart(2, "0");
    }
    return "#" + f(0) + f(8) + f(4);
  }

  /* ---------- üretim ekranı ---------- */
  function renderGenerating() {
    head("Okul", "Kurs oluşturuluyor", job ? "“" + job.topic + "”" : null);

    if (!job) { go("kutuphane"); return; }

    var out = el("div", { class: "stack" });

    var list = el("ol", { class: "steps" });
    job.steps.forEach(function (s) {
      list.appendChild(el("li", { class: "step " + s.state }, [
        el("span", { class: "step-dot", "aria-hidden": "true" }),
        el("span", null, [
          el("span", { class: "step-label", text: s.label }),
          s.note ? el("span", { class: "small muted", style: "display:block", text: s.note }) : null
        ])
      ]));
    });
    out.appendChild(el("section", { class: "card" }, [list]));

    if (job.error) {
      out.appendChild(el("section", { class: "card stack" }, [
        el("p", { class: "label", style: "color:var(--no)", text: job.cancelled ? "İptal edildi" : "Üretim durdu" }),
        el("p", { style: "margin:0", text: job.error }),
        job.detail ? el("p", { class: "small muted", style: "margin:0", text: "API yanıtı: " + job.detail }) : null,
        el("div", { class: "grid2" }, [
          el("button", { class: "btn ghost", text: "Kütüphaneye dön", onclick: function () { job = null; go("kutuphane"); } }),
          el("button", { class: "btn", text: "Yeniden dene", onclick: function () { var t = job.topic; job = null; startGeneration(t); go("uret"); } })
        ])
      ]));
    } else if (job.done) {
      var u = job.usage;
      out.appendChild(el("section", { class: "card center stack" }, [
        el("p", { style: "font-size:2.4rem;margin:0", text: job.course.icon }),
        el("h2", { style: "margin:0", text: job.course.title }),
        el("p", { class: "small muted", style: "margin:0",
          text: job.course.lessons.length + " ders · " +
            job.course.lessons.reduce(function (a, l) { return a + l.quiz.length; }, 0) + " soru · " +
            job.course.glossary.length + " kavram" }),
        el("p", { class: "small muted", style: "margin:0",
          text: "Yaklaşık maliyet: $" + u.cost.toFixed(2) + " · " +
            (u.input / 1000).toFixed(1) + "k girdi, " + (u.output / 1000).toFixed(1) + "k çıktı token" }),
        el("button", { class: "btn wide", text: "Kursu aç", onclick: function () { var id = job.course.id; job = null; openCourse(id); } }),
        el("button", { class: "btn quiet", text: "Kütüphaneye dön", onclick: function () { job = null; go("kutuphane"); } })
      ]));
    } else {
      out.appendChild(el("section", { class: "card stack" }, [
        el("p", { class: "small muted", style: "margin:0",
          text: "Bu birkaç dakika sürer. Sekmeyi açık tut — üretim bu tarayıcıda çalışıyor." }),
        el("button", { class: "btn ghost danger", text: "İptal et", onclick: function () { job.abort(); } })
      ]));
    }

    view.appendChild(out);
  }

  /* ================= kütüphane ================= */
  function renderLibrary() {
    head("Okul", "Ne öğrenmek istiyorsun?",
      "Bir konu yaz, kurs oluşsun. Oluşturduğun her kurs kütüphanende kalır.");

    var out = el("div", { class: "stack" });
    var entries = libraryEntries();

    /* --- konu kutusu --- */
    var input = el("input", { type: "text", class: "ask", placeholder: "örneğin: sanat tarihi",
      "aria-label": "Öğrenmek istediğin konu", value: route.query, autocomplete: "off" });
    var action = el("div", { class: "ask-action" });
    var matches = el("div", { class: "stack", style: "margin-top:.9rem" });

    function paintBox() {
      var q = norm(route.query);
      action.textContent = "";
      matches.textContent = "";

      if (!q) {
        action.appendChild(el("p", { class: "small muted", style: "margin:.7rem 0 0",
          text: state.apiKey
            ? "Konuyu yazıp Enter'a bas."
            : "Kurs oluşturmak için Ayarlar'dan kendi Anthropic API anahtarını eklemen gerekiyor." }));
        return;
      }

      var hits = entries.filter(function (e) {
        return norm(e.title).indexOf(q) >= 0 || norm(e.description || "").indexOf(q) >= 0 ||
          norm(e.subtitle || "").indexOf(q) >= 0;
      });

      if (hits.length) {
        matches.appendChild(el("p", { class: "label", style: "margin:.2rem 0 0", text: "Kütüphanende var" }));
        hits.forEach(function (e) { matches.appendChild(courseCard(e)); });
      }

      /* Anahtar yoksa düğme kurs oluşturmaz, Ayarlar'a götürür — etiketi bunu söylesin. */
      action.appendChild(el("button", {
        class: "btn wide",
        text: state.apiKey
          ? "“" + route.query.trim() + "” için kurs oluştur"
          : "Kurs oluşturmak için API anahtarı ekle →",
        onclick: function () { requestGeneration(route.query.trim()); }
      }));
      if (!state.apiKey) {
        action.appendChild(el("p", { class: "small muted", style: "margin:.6rem 0 0",
          text: "Üretim, senin Anthropic hesabından doğrudan bu tarayıcıdan yapılır — bu sitenin sunucusu yok. Anahtarı bir kez ekle, sonra istediğin konuyu yaz." }));
      }
    }

    input.addEventListener("input", function (e) { route.query = e.target.value; paintBox(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && route.query.trim()) requestGeneration(route.query.trim());
    });
    paintBox();

    out.appendChild(el("section", { class: "card ask-card" }, [input, action, matches]));

    /* --- kütüphane --- */
    var lib = el("section", { style: "margin-top:1.6rem" }, [
      el("div", { class: "row", style: "margin-bottom:.8rem" }, [
        el("p", { class: "label", style: "margin:0", text: "Kütüphane · " + entries.length }),
        streakNow() > 0 ? el("span", { class: "chip", text: streakNow() + " gün seri" }) : null
      ])
    ]);

    if (!entries.length) {
      lib.appendChild(el("p", { class: "card center small muted",
        text: loadError ? "Kurs listesi yüklenemedi: " + loadError : "Kütüphane boş. Yukarıya bir konu yazarak başla." }));
    } else {
      var grid = el("div", { class: "grid" });
      entries.forEach(function (e) { grid.appendChild(courseCard(e)); });
      lib.appendChild(grid);
    }
    out.appendChild(lib);

    out.appendChild(el("button", { class: "block card row", style: "margin-top:1.6rem",
      onclick: function () { go("ayarlar"); } }, [
      el("div", null, [
        el("p", { class: "label", text: "Ayarlar" }),
        el("p", { class: "small muted", style: "margin:.25rem 0 0",
          text: state.apiKey ? "API anahtarı ekli · " + modelLabel() : "API anahtarı yok · yedekleme ve kurs yönetimi" })
      ]),
      el("span", { class: "chev", text: "→" })
    ]));

    view.appendChild(out);
  }

  function modelLabel() {
    var m = MODELS.find(function (x) { return x[0] === state.prefs.model; });
    return m ? m[1].split(" — ")[0] : state.prefs.model;
  }

  function courseCard(e) {
    var p = state.courses[e.id];
    var doneN = 0;
    if (p) {
      Object.keys(p.lessons || {}).forEach(function (k) {
        var x = p.lessons[k];
        if (x && x.read && x.count > 0 && x.best / x.count >= PASS) doneN += 1;
      });
    }
    var pct = e.lessons ? Math.round((doneN / e.lessons) * 100) : 0;
    var accent = e.accent || "#1b6b4f";

    var card = el("button", { class: "block course-card", onclick: function () { openCourse(e.id); } }, [
      el("div", { class: "course-top" }, [
        el("span", { class: "course-icon", style: "background:" + accent + "1f;color:" + accent, text: e.icon || "📘" }),
        el("div", { style: "min-width:0" }, [
          el("span", { class: "course-title", text: e.title }),
          el("span", { class: "small muted", style: "display:block;margin-top:.1rem", text: e.subtitle || "" })
        ])
      ]),
      el("p", { class: "small muted course-desc", text: e.description || "" }),
      el("div", { class: "course-meta" }, [
        el("span", { class: "num small muted", text: e.lessons + " ders · " + e.questions + " soru" +
          (e.charts ? " · " + e.charts + " grafik" : "") }),
        el("span", { class: "num small", style: "color:" + accent, text: "%" + pct })
      ]),
      meter(pct, accent)
    ]);
    if (e.source === "generated") {
      card.appendChild(el("span", { class: "badge", text: "senin oluşturdun" }));
    }
    return card;
  }

  function requestGeneration(topic) {
    if (!topic) return;
    if (!state.apiKey) { go("ayarlar", { query: route.query }); return; }
    startGeneration(topic);
    go("uret");
  }

  /* ================= uygulama ayarları ================= */
  function renderAppSettings() {
    head("Okul", "Ayarlar", null);
    var out = el("div", { class: "stack" });

    /* --- API anahtarı --- */
    var keyInput = el("input", {
      type: "password", class: "typed", placeholder: "sk-ant-...", value: state.apiKey,
      "aria-label": "Anthropic API anahtarı", autocomplete: "off", spellcheck: "false"
    });
    var keyMsg = el("p", { class: "small muted", style: "margin:.5rem 0 0" });
    var shown = false;
    var pending = (route.query || "").trim();

    /* Üretim denemesinden buraya yönlendirildiyse, döngüyü burada kapat. */
    if (pending && !state.apiKey) {
      out.appendChild(el("section", { class: "card" }, [
        el("p", { class: "label", style: "color:var(--accent)", text: "Sıradaki adım" }),
        el("p", { style: "margin:.35rem 0 0",
          text: "“" + pending + "” için kurs oluşturmak üzeresin. Aşağıya kendi Anthropic API anahtarını ekle; kaydedince buradan doğrudan başlatabilirsin." })
      ]));
    }

    out.appendChild(el("section", { class: "card stack" }, [
      el("p", { class: "label", text: "Anthropic API anahtarı" }),
      el("p", { class: "small muted", style: "margin:0",
        text: "Kurs üretimi bu anahtarla, doğrudan senin tarayıcından Anthropic'e yapılır. Bu sitenin sunucusu yok; anahtar hiçbir yere gönderilmez, yalnızca bu tarayıcıda saklanır." }),
      keyInput,
      el("div", { class: "grid2" }, [
        el("button", { class: "btn ghost", text: "Göster / gizle", onclick: function () {
          shown = !shown; keyInput.type = shown ? "text" : "password";
        } }),
        el("button", { class: "btn", text: "Kaydet", onclick: function () {
          var v = keyInput.value.trim();
          state.apiKey = v; save();
          keyMsg.textContent = v ? "Anahtar kaydedildi." : "Anahtar silindi.";
          render();
        } })
      ]),
      keyMsg,
      pending && state.apiKey
        ? el("button", { class: "btn wide", text: "“" + pending + "” için kurs oluştur",
            onclick: function () { requestGeneration(pending); } })
        : null,
      el("p", { class: "small muted", style: "margin:0" }, [
        el("span", { text: "Anahtarı " }),
        el("a", { href: "https://console.anthropic.com/settings/keys", target: "_blank", rel: "noopener noreferrer",
          text: "console.anthropic.com" }),
        el("span", { text: " adresinden oluşturabilirsin. Ortak kullanılan bir bilgisayarda anahtar bırakma." })
      ])
    ]));

    /* --- model --- */
    out.appendChild(el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Üretim modeli" }),
      segmented(MODELS.map(function (m) { return [m[0], m[1].split(" — ")[0]]; }), state.prefs.model,
        function (v) { state.prefs.model = v; save(); render(); }),
      el("p", { class: "small muted", style: "margin:0",
        text: (MODELS.find(function (m) { return m[0] === state.prefs.model; }) || [])[1] +
          ". Bir kursun kaba maliyeti Opus 5 ile birkaç dolar, Sonnet 5 ile bunun yarısından az." })
    ]));

    /* --- oluşturulan kurslar --- */
    var mine = state.generated.slice().reverse();
    var gen = el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Oluşturduğun kurslar" })
    ]);
    if (!mine.length) {
      gen.appendChild(el("p", { class: "small muted", style: "margin:0",
        text: "Henüz kurs oluşturmadın. Kütüphanedeki kutuya bir konu yaz." }));
    } else {
      var ul = el("ul", { class: "plain" });
      mine.forEach(function (e) {
        ul.appendChild(el("li", { class: "own-row" }, [
          el("span", { class: "small", text: (e.icon || "") + " " + e.title }),
          el("button", { class: "btn quiet danger small", text: "Sil", onclick: function () {
            if (!window.confirm(e.title + " kursu ve ilerlemesi silinsin mi?")) return;
            removeGenerated(e.id);
            if (course && course.id === e.id) { course = null; applyAccent(null); }
            render();
          } })
        ]));
      });
      gen.appendChild(ul);
      gen.appendChild(el("p", { class: "small muted", style: "margin:0",
        text: "Oluşturduğun kurslar yalnızca bu tarayıcıda saklanır. Başka cihaza taşımak için aşağıdaki yedeği kullan." }));
    }
    out.appendChild(gen);

    /* --- yedekleme --- */
    var ta = el("textarea", { class: "typed mono", rows: "4", "aria-label": "Yedek verisi",
      placeholder: "Buraya bir yedek yapıştırıp geri yükleyebilirsin" });
    var msg = el("p", { class: "small muted", style: "margin:.5rem 0 0" });

    out.appendChild(el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Yedekle ve geri yükle" }),
      el("p", { class: "small muted", style: "margin:0",
        text: "Yedek; ilerlemeni, ayarlarını ve oluşturduğun kursları içerir. API anahtarı yedeğe konmaz." }),
      ta,
      el("div", { class: "grid2" }, [
        el("button", { class: "btn ghost", text: "Yedeği çıkar", onclick: function () {
          var copy = JSON.parse(JSON.stringify(state));
          copy.apiKey = "";
          var bundle = { okul: 1, state: copy, courses: {} };
          state.generated.forEach(function (g) {
            var c = readGenerated(g.id);
            if (c) bundle.courses[g.id] = c;
          });
          ta.value = JSON.stringify(bundle);
          ta.focus(); ta.select();
          msg.textContent = "Yedek hazır. Kopyalayıp güvenli bir yere kaydet.";
        } }),
        el("button", { class: "btn ghost", text: "Geri yükle", onclick: function () {
          try {
            var b = JSON.parse(ta.value);
            if (!b || b.okul !== 1 || !b.state) throw new Error("bad");
            if (!window.confirm("Mevcut ilerleme ve kursların üzerine yazılsın mı?")) return;
            var keep = state.apiKey;
            Object.keys(b.courses || {}).forEach(function (id) { writeGenerated(b.courses[id]); });
            state = b.state; state.apiKey = keep;
            save(); course = null; applyAccent(null); resetStudy();
            msg.textContent = "Yedek geri yüklendi.";
            go("kutuphane");
          } catch (e) {
            msg.textContent = "Bu metin geçerli bir Okul yedeği değil.";
          }
        } })
      ]),
      msg
    ]));

    /* --- uygulama --- */
    out.appendChild(el("section", { class: "card stack", style: "margin-top:1.1rem" }, [
      el("p", { class: "label", text: "Uygulama" }),
      el("p", { class: "small muted", style: "margin:0",
        text: "iPhone ve iPad'de Safari'de Paylaş menüsünden Ana Ekrana Ekle dersen tam ekran çalışır." }),
      el("button", { class: "btn ghost danger", text: "Her şeyi sıfırla", onclick: function () {
        if (!window.confirm("Tüm ilerleme, ayarlar ve oluşturduğun kurslar silinsin mi?")) return;
        state.generated.forEach(function (g) { try { localStorage.removeItem(COURSE_PREFIX + g.id); } catch (e) {} });
        state = defaults(); save();
        course = null; applyAccent(null); resetStudy();
        go("kutuphane");
      } })
    ]));

    out.appendChild(el("button", { class: "btn quiet", style: "margin-top:1.2rem", text: "Kütüphaneye dön",
      onclick: function () { go("kutuphane"); } }));

    view.appendChild(out);
  }

  /* ================= başlatma ================= */
  document.getElementById("back").addEventListener("click", function () {
    if (route.screen === "kurs" && route.lesson) { go("kurs", { tab: "dersler", lesson: null }); return; }
    if (route.screen === "kurs") { leaveCourse(); return; }
    go("kutuphane");
  });

  view = document.getElementById("view");
  render();

  loadLibrary().then(function () { render(); });
})();
