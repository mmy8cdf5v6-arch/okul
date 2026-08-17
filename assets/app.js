(function () {
  "use strict";

  /* text-transform:uppercase'in i → İ dönüşümü için dil bilgisi şart */
  document.documentElement.lang = "tr";

  var KEY = "okul-v1";
  var COURSE_PREFIX = "okul-course-";   // yalnızca eski sürüm artıklarını temizlemek için
  var PASS = 2 / 3;
  var DAY = 86400000;
  var BOX_DAYS = [0, 1, 3, 7, 21];

  /* ---------- durum ---------- */
  function defaults() {
    return {
      v: 1,
      prefs: { goal: 15, dir: "ileri", typed: false, limit: 15 },
      days: {}, streak: { last: null, current: 0, best: 0 },
      courses: {}
    };
  }

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      var p = JSON.parse(raw);
      var s = adopt(p);
      if (temizle(p)) setTimeout(save, 0);
      return s;
    } catch (e) { return defaults(); }
  }

  /* Ham bir nesneden temiz bir durum kurar. Hem depodan okurken hem yedek geri
     yüklerken kullanılır; tanımadığı alanlar sessizce düşer. */
  function adopt(p) {
    var s = defaults();
    if (!p || typeof p !== "object") return s;
    if (p.prefs) Object.keys(s.prefs).forEach(function (k) {
      if (p.prefs[k] !== undefined && p.prefs[k] !== null) s.prefs[k] = p.prefs[k];
    });
    s.days = p.days || {};
    if (p.streak) s.streak = { last: p.streak.last || null, current: p.streak.current || 0, best: p.streak.best || 0 };
    s.courses = p.courses || {};
    return s;
  }

  /* Kurs üretimi kaldırıldı. Eski sürümü kullanmış tarayıcılarda depoda kalan
     API anahtarını ve üretilmiş kurs verisini temizle; kullanılmayan bir
     anahtarın localStorage'da durmasını istemiyoruz. */
  function temizle(p) {
    var vardi = false;
    if (p.apiKey) vardi = true;
    if (Array.isArray(p.generated) && p.generated.length) {
      p.generated.forEach(function (g) {
        try { localStorage.removeItem(COURSE_PREFIX + g.id); } catch (e) {}
      });
      vardi = true;
    }
    return vardi;
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

  function libraryEntries() { return library; }

  function entryById(id) {
    for (var i = 0; i < library.length; i++) if (library[i].id === id) return library[i];
    return null;
  }

  function loadLibrary() {
    return fetch("courses/index.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (list) { library = list; })
      .catch(function (e) { library = []; loadError = e.message; });
  }

  function loadCourse(id) {
    var entry = entryById(id);
    if (!entry) return Promise.reject(new Error("Kurs bulunamadı: " + id));
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
    route.query = ""; route.open = null; route.study = "kartlar";
    route.era = "hepsi"; route.histTab = "cizelge";
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
    var back = document.getElementById("back");
    back.style.display = route.screen === "kutuphane" ? "none" : "";
    back.textContent = route.screen === "kurs" && route.lesson ? "← Dersler" : "← Kütüphane";
  }

  function render() {
    view = document.getElementById("view");
    view.textContent = "";
    if (route.screen === "kutuphane") renderLibrary();
    else if (route.screen === "ayarlar") renderAppSettings();
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
  function r2(v) { return (Math.round(v * 100) / 100).toFixed(2); }

  /* Standart normal dağılımın birikimli olasılığı (Abramowitz & Stegun 26.2.17,
     mutlak hatası 7.5e-8). Güven aralığı ve p-değeri grafikleri kullanıyor. */
  function ncdf(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989422804014327 * Math.exp((-z * z) / 2);
    var p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
      t * (-1.821255978 + t * 1.330274429))));
    return z > 0 ? 1 - p : p;
  }

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

  /* Anakol yıldızları: kütle (Güneş = 1), yüzey sıcaklığı (K), parlaklık
     (Güneş = 1). Formül yerine tablo kullanılıyor, çünkü tek bir üs yasası
     hem cüce hem dev kütlelerde aynı anda tutmuyor. Ara değerler log-log
     doğrusal aradeğerlemeyle bulunur. */
  var ANAKOL = [
    [0.10, 2800, 0.0008], [0.20, 3300, 0.005], [0.50, 3800, 0.04],
    [0.80, 5000, 0.40], [1.00, 5800, 1.0], [1.50, 7000, 5],
    [2.00, 9000, 16], [3.00, 11000, 80], [5.00, 17000, 600],
    [10.0, 25000, 8000], [20.0, 35000, 55000], [30.0, 40000, 150000]
  ];
  function anakol(M) {
    var i = 0, L10 = Math.log(10);
    while (i < ANAKOL.length - 2 && ANAKOL[i + 1][0] < M) i++;
    var a = ANAKOL[i], b = ANAKOL[i + 1];
    var t = (Math.log(M) - Math.log(a[0])) / (Math.log(b[0]) - Math.log(a[0]));
    var lt = Math.log(a[1]) / L10 + t * (Math.log(b[1]) - Math.log(a[1])) / L10;
    var ll = Math.log(a[2]) / L10 + t * (Math.log(b[2]) - Math.log(a[2])) / L10;
    return { T: Math.pow(10, lt), L: Math.pow(10, ll) };
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
    },

    "iskonto": {
      title: "Bugünkü değer: zaman parayı eritir",
      note: "İskonto oranı, o parayı beklerken vazgeçtiğiniz getiridir. Oran yükseldikçe gelecek bugünde daha az yer kaplar.",
      controls: [
        { key: "r", label: "İskonto oranı", min: 2, max: 40, step: 2, def: 10, fmt: pctS },
        { key: "y", label: "Vade", min: 5, max: 40, step: 5, def: 20, fmt: function (v) { return v + " yıl"; } }
      ],
      draw: function (p) {
        var r = p.r / 100, Y = p.y, i, pts = [];
        for (i = 0; i <= 60; i++) {
          var t = (Y * i) / 60;
          pts.push([t / Y, Math.pow(1 + r, -t)]);
        }
        var end = Math.pow(1 + r, -Y);
        var half = Math.log(2) / Math.log(1 + r);
        var s = frame("Yıl", "100 lira bugün ne eder");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        if (half <= Y) {
          s += gLine(0, 0.5, half / Y, 0.5, { c: "var(--makro)", w: 1.3, d: "3 3" });
          s += gLine(half / Y, 0, half / Y, 0.5, { c: "var(--makro)", w: 1.3, d: "3 3" });
          s += gTxt(half / Y, 0.5, "yarıya iner", { a: "start", dx: 5, dy: -4, c: "var(--makro)", b: 1, s: 9 });
        }
        s += gDot(1, end, { c: "var(--ink)" });
        s += gTxt(1, end, r0(end * 100) + " TL", { a: "end", dy: -9, c: "var(--ink)", b: 1, s: 10 });
        [0, 0.5].forEach(function (v) { s += gTxt(v, 0, r0(v * Y) + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Yıllık %" + p.r + " iskonto oranıyla, " + Y + " yıl sonra elinize geçecek 100 lira " +
          "bugün " + r0(end * 100) + " lira eder. Değerin yarıya inmesi yaklaşık " + r1(half) + " yıl sürer." };
      }
    },

    "reel-getiri": {
      title: "Nominal getiri, reel alım gücü",
      note: "Cebinizdeki rakam değil, o rakamla alabildiğiniz mal artarsa zenginleşirsiniz.",
      controls: [
        { key: "n", label: "Nominal getiri", min: 0, max: 60, step: 5, def: 30, fmt: pctS },
        { key: "e", label: "Enflasyon", min: 0, max: 60, step: 5, def: 25, fmt: pctS }
      ],
      draw: function (p) {
        var n = p.n / 100, e = p.e / 100, Y = 10, i;
        var real = (1 + n) / (1 + e) - 1;
        var end = Math.pow(1 + real, Y);
        var top = Math.max(end, 1.6);
        var pts = [];
        for (i = 0; i <= 60; i++) {
          var t = (Y * i) / 60;
          pts.push([t / Y, Math.min(1, Math.pow(1 + real, t) / top)]);
        }
        var base = 1 / top;
        var up = real >= 0;
        var s = frame("Yıl", "Alım gücü (başlangıç = 1)");
        s += gPoly(pts, { c: up ? "var(--ok)" : "var(--no)", w: 2.4 });
        s += gLine(0, base, 1, base, { c: "var(--rule)", w: 1.4, d: "4 3" });
        // Etiket, eğrinin gittiği yönün tersine konur; yoksa çizgiyle çakışır.
        s += gTxt(0.02, base, "başlangıç", { a: "start", dy: up ? 12 : -6, s: 9 });
        s += gDot(1, Math.min(1, end / top), { c: "var(--ink)" });
        s += gTxt(1, Math.min(1, end / top), r1(end) + "×", { a: "end", dy: up ? -9 : 13, c: "var(--ink)", b: 1, s: 10 });
        [0, 5].forEach(function (v) { s += gTxt(v / Y, 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Nominal %" + p.n + ", enflasyon %" + p.e + " ise reel getiri yılda %" + r1(real * 100) + ". " +
          (Math.abs(real) < 0.001
            ? "Alım gücünüz yerinde sayıyor: kazandığınız her kuruşu fiyatlar geri alıyor."
            : "On yılın sonunda alım gücünüz " + r1(end) + " katına " + (up ? "çıkar." : "iner.")) };
      }
    },

    "cesitlendirme": {
      title: "Çeşitlendirme riski nereye kadar düşürür?",
      note: "Şirkete özgü riski dağıtabilirsiniz; herkesi aynı anda vuran piyasa riskini dağıtamazsınız.",
      controls: [{ key: "k", label: "Varlıklar arası korelasyon", min: 0, max: 90, step: 10, def: 30, fmt: pctS }],
      draw: function (p) {
        var rho = p.k / 100, N = 30, i;
        var vol = function (n) { return Math.sqrt(1 / n + (1 - 1 / n) * rho); };
        var pts = [];
        for (i = 1; i <= N; i++) pts.push([(i - 1) / (N - 1), vol(i)]);
        var floorV = Math.sqrt(rho);
        var s = frame("Hisse sayısı", "Oynaklık (tek hisse = 1)");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        if (floorV > 0.02) {
          s += gLine(0, floorV, 1, floorV, { c: "var(--no)", w: 1.6, d: "5 3" });
          s += gTxt(0.98, floorV, "dağıtılamayan risk", { a: "end", dy: 13, c: "var(--no)", s: 9 });
        }
        s += gDot(0, 1, { c: "var(--ink)" });
        s += gDot((20 - 1) / (N - 1), vol(20), { c: "var(--ok)" });
        s += gTxt((20 - 1) / (N - 1), vol(20), "20 hisse", { a: "middle", dy: -9, c: "var(--ok)", b: 1, s: 9 });
        [1, 15].forEach(function (v) { s += gTxt((v - 1) / (N - 1), 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "20 hisselik bir portföyün oynaklığı, tek hissenin oynaklığının %" + r0(vol(20) * 100) +
          "'ine iner. " + (rho < 0.05
            ? "Korelasyon sıfıra yakınken risk neredeyse tümüyle dağıtılabilir; asıl zorluk gerçekten bağımsız varlık bulmaktır."
            : "Ne kadar hisse eklerseniz ekleyin %" + r0(floorV * 100) + "'in altına inemezsiniz: kalan kısım piyasa riskidir.") };
      }
    },

    "ucret-yuku": {
      title: "Ücretin bileşik yükü",
      note: "Getiri belirsiz, ücret kesin. Yüzde birlik fark on yıllarda birikimin beşte birine kadar çıkabilir.",
      controls: [
        { key: "f", label: "Yıllık ücret", min: 0, max: 250, step: 25,
          fmt: function (v) { return "%" + (v / 100).toFixed(2); }, def: 100 },
        { key: "y", label: "Süre", min: 10, max: 40, step: 5, def: 30, fmt: function (v) { return v + " yıl"; } }
      ],
      draw: function (p) {
        var f = p.f / 10000, g = 0.07, Y = p.y, i;
        var top = Math.pow(1 + g, Y);
        var gross = [], net = [];
        for (i = 0; i <= 60; i++) {
          var t = (Y * i) / 60;
          gross.push([t / Y, Math.pow(1 + g, t) / top]);
          net.push([t / Y, Math.pow(1 + g - f, t) / top]);
        }
        var gEnd = Math.pow(1 + g, Y), nEnd = Math.pow(1 + g - f, Y);
        var loss = (1 - nEnd / gEnd) * 100;
        var s = frame("Yıl", "Birikim (başlangıç = 1)");
        if (f > 0) {
          s += gArea(gross.concat(net.slice().reverse()), { c: "var(--no)", o: 0.20 });
        }
        s += gPoly(gross, { c: "var(--rule)", w: 1.8, d: "4 3" });
        s += gPoly(net, { c: "var(--accent)", w: 2.4 });
        s += gDot(1, nEnd / top, { c: "var(--ink)" });
        s += gTxt(0.62, Math.pow(1 + g, 0.62 * Y) / top, "ücretsiz", { a: "end", dy: -7, s: 9 });
        s += gTxt(1, nEnd / top, r1(nEnd) + "×", { a: "end", dy: 13, c: "var(--ink)", b: 1, s: 10 });
        [0, 0.5].forEach(function (v) { s += gTxt(v, 0, r0(v * Y) + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: f === 0
          ? "Ücret yokken paranız brüt getirinin tamamını tutar: " + Y + " yılda " + r1(gEnd) + " katına çıkar."
          : "Yılda %7 brüt getiride birikim " + Y + " yılda " + r1(gEnd) + " katına çıkardı; %" +
            (p.f / 100).toFixed(2) + " ücretle " + r1(nEnd) + " katına çıkıyor. Ücret birikimin %" +
            r1(loss) + "'ini götürüyor: kırmızı alan onun payı." };
      }
    },

    "eksen-hilesi": {
      title: "Aynı veri, kesilmiş eksen",
      note: "Sütun grafiğinde eksen sıfırdan başlamalıdır. Başlamıyorsa, ilk bakılacak yer verinin kendisi değil eksenin dibidir.",
      controls: [{ key: "t", label: "Y ekseni nereden başlıyor", min: 0, max: 99, step: 3, def: 0,
        fmt: function (v) { return v === 0 ? "sıfırdan" : v + "'den"; } }],
      draw: function (p) {
        var vals = [100, 101, 102, 103, 104, 106], lo = p.t, hi = 108, i;
        var s = frame("Aylar", "Satış");
        for (i = 0; i < vals.length; i++) {
          var x = 0.09 + i * 0.164, h = (vals[i] - lo) / (hi - lo);
          s += gRect(x - 0.055, 0, x + 0.055, h, { c: "var(--accent)", o: 0.85 });
          s += gTxt(x, h, r0(vals[i]) + "", { a: "middle", dy: -5, s: 8.5, c: "var(--muted)" });
        }
        s += gTxt(0, 0, r0(lo) + "", { a: "end", dx: -5, dy: 3, s: 9 });
        var real = vals[5] / vals[0], seen = (vals[5] - lo) / (vals[0] - lo);
        return { svg: s, text: lo === 0
          ? "Eksen sıfırdan başlıyor: son ay ilk ayın " + r2(real) + " katı ve grafik de bunu gösteriyor."
          : "Gerçekte artış %" + r0((real - 1) * 100) + ". Ama eksen " + r0(lo) + "'den başladığı için son sütun " +
            "ilkinin " + r1(seen) + " katı görünüyor: göze çarpan büyüklük gerçek farkın " +
            r1(seen / real) + " katı." };
      }
    },

    "ortalama-medyan": {
      title: "Ortalama mı, medyan mı?",
      note: "Çarpık dağılımlarda ortalama uçtaki birkaç değerin peşinden gider; medyan yerinde durur. Gelir haberlerinde hangisinin verildiğine bak.",
      controls: [{ key: "z", label: "En yüksek gelir", min: 1, max: 30, step: 1, def: 1,
        fmt: function (v) { return v === 1 ? "diğerleri gibi" : v + "× daha yüksek"; } }],
      draw: function (p) {
        var base = [22, 24, 25, 26, 28, 29, 30, 31, 32, 34, 35, 36, 38, 40, 42, 45, 48, 52, 58, 70];
        var vals = base.slice(0, 19).concat([70 * p.z]), i;
        var sum = 0;
        for (i = 0; i < vals.length; i++) sum += vals[i];
        var mean = sum / vals.length, med = (vals[9] + vals[10]) / 2;
        var below = vals.filter(function (v) { return v < mean; }).length;
        var ceil = 120;                       // tavan: uçtaki sütun kırpılır ve etiketlenir
        var s = frame("20 hane, gelire göre sıralı", "Bin lira");
        for (i = 0; i < vals.length; i++) {
          var x = 0.03 + i * 0.0495, over = vals[i] > ceil;
          var h = Math.min(1, vals[i] / ceil);
          s += gRect(x - 0.019, 0, x + 0.019, h, { c: over ? "var(--no)" : "var(--accent)", o: over ? 0.75 : 0.55 });
          if (over) s += gTxt(x, h, r0(vals[i]) + "↑", { a: "end", dy: -5, s: 8.5, b: 1, c: "var(--no)" });
        }
        s += gLine(0, mean / ceil, 1, mean / ceil, { c: "var(--no)", w: 1.6, d: "5 3" });
        s += gTxt(0.01, mean / ceil, "ortalama " + r0(mean), { a: "start", dy: -5, c: "var(--no)", s: 9, b: 1 });
        s += gLine(0, med / ceil, 1, med / ceil, { c: "var(--ok)", w: 1.6, d: "5 3" });
        s += gTxt(0.99, med / ceil, "medyan " + r1(med), { a: "end", dy: 12, c: "var(--ok)", s: 9, b: 1 });
        return { svg: s, text: p.z === 1
          ? "Dağılım dengeliyken ortalama (" + r0(mean) + ") ile medyan (" + r1(med) + ") birbirine yakın; ikisi de aynı hikâyeyi anlatır."
          : "Tek hane " + p.z + " kat kazanınca ortalama " + r0(mean) + " bin liraya çıkıyor, medyan " + r1(med) +
            " bin lirada kalıyor. Hanelerin %" + r0((below / vals.length) * 100) + "'i ortalamanın altında." };
      }
    },

    "guven-araligi": {
      title: "Örneklem büyüdükçe belirsizlik daralır",
      note: "Belirsizlik örneklemin kareköküyle azalır: hatayı yarıya indirmek için örneklemi dört katına çıkarmak gerekir.",
      controls: [
        { key: "n", label: "Kaç kişiye soruldu", min: 25, max: 2000, step: 25, def: 1000,
          fmt: function (v) { return v + " kişi"; } },
        { key: "p", label: "Ölçülen oran", min: 5, max: 50, step: 5, def: 50, fmt: pctS }
      ],
      draw: function (p) {
        var pr = p.p / 100, N = 2000, i;
        var half = function (n) { return 1.96 * Math.sqrt((pr * (1 - pr)) / n); };
        var yc = 0.5, scale = 2.2;            // grafik ekseni: oranın ±%22'lik bandı
        var up = [], dn = [];
        for (i = 0; i <= 70; i++) {
          var n = 25 + ((N - 25) * i) / 70;
          up.push([(n - 25) / (N - 25), Math.min(1, yc + half(n) * scale)]);
          dn.push([(n - 25) / (N - 25), Math.max(0, yc - half(n) * scale)]);
        }
        var s = frame("Örneklem büyüklüğü", "Ölçülen oran");
        s += gArea(up.concat(dn.slice().reverse()), { c: "var(--accent)", o: 0.20 });
        s += gLine(0, yc, 1, yc, { c: "var(--accent)", w: 2 });
        var xn = (p.n - 25) / (N - 25), h = half(p.n);
        s += gLine(xn, Math.max(0, yc - h * scale), xn, Math.min(1, yc + h * scale), { c: "var(--ink)", w: 2 });
        s += gDot(xn, Math.min(1, yc + h * scale), { c: "var(--ink)", r: 3 });
        s += gDot(xn, Math.max(0, yc - h * scale), { c: "var(--ink)", r: 3 });
        s += gTxt(0.99, yc, "%" + p.p, { a: "end", dy: -5, c: "var(--accent)", b: 1, s: 9 });
        [500, 1000].forEach(function (v) {
          s += gTxt((v - 25) / (N - 25), 0, v + "", { a: "middle", dy: 12, s: 9 });
        });
        return { svg: s, text: p.n + " kişiye sorulduğunda %" + p.p + "'lik bir oran ±" + r1(h * 100) +
          " puanlık belirsizlik taşır: gerçek değer %" + r1((pr - h) * 100) + " ile %" + r1((pr + h) * 100) +
          " arasında bir yerde. Bu aralık, ölçümün kendi hatası; ankete katılmayanların farkı bunun dışında." };
      }
    },

    "p-degeri": {
      title: "p-değeri ne söyler, ne söylemez",
      note: "p-değeri, gerçekte fark yokken bu kadar büyük bir fark görme olasılığıdır. Farkın gerçek olma olasılığı değildir.",
      controls: [
        { key: "d", label: "Ölçülen fark", min: 0, max: 20, step: 1, def: 5,
          fmt: function (v) { return v + " puan"; } },
        { key: "n", label: "Grup başına kişi", min: 50, max: 1500, step: 50, def: 500,
          fmt: function (v) { return v + " kişi"; } }
      ],
      draw: function (p) {
        var se = Math.sqrt(0.5 / p.n), z = (p.d / 100) / se;
        var pv = 2 * (1 - ncdf(Math.abs(z)));
        var X = 4, i;                         // yatay eksen: -4σ … +4σ
        var toX = function (v) { return (v + X) / (2 * X); };
        var dens = function (v) { return Math.exp((-v * v) / 2); };
        var pts = [];
        for (i = 0; i <= 90; i++) {
          var v = -X + (2 * X * i) / 90;
          pts.push([toX(v), dens(v) * 0.92]);
        }
        var s = frame("", "Fark yokken beklenen sonuçların dağılımı");
        var zc = Math.min(z, X);
        if (zc < X) {
          var tail = pts.filter(function (q) { return q[0] >= toX(zc); });
          var tail2 = pts.filter(function (q) { return q[0] <= toX(-zc); });
          s += gArea(tail.concat([[1, 0], [toX(zc), 0]]), { c: "var(--no)", o: 0.35 });
          s += gArea([[0, 0], [toX(-zc), 0]].concat(tail2.slice().reverse()), { c: "var(--no)", o: 0.35 });
        }
        s += gPoly(pts, { c: "var(--accent)", w: 2.2 });
        s += gLine(toX(zc), 0, toX(zc), 0.98, { c: "var(--ink)", w: 1.8, d: "4 3" });
        s += gTxt(toX(zc), 0.98, "ölçülen", { a: zc > 2.4 ? "end" : "start", dx: zc > 2.4 ? -4 : 4, dy: 2, c: "var(--ink)", b: 1, s: 9 });
        s += gTxt(toX(-2), 0, "−2σ", { a: "middle", dy: 12, s: 9 });
        s += gTxt(toX(0), 0, "fark yok", { a: "middle", dy: 12, s: 9 });
        s += gTxt(toX(2), 0, "+2σ", { a: "middle", dy: 12, s: 9 });
        return { svg: s, text: p.d === 0
          ? "Fark sıfırken p = 1: bu sonuç, fark yokken görülmesi en beklenen sonuçtur."
          : "Grup başına " + p.n + " kişiyle " + p.d + " puanlık fark, p = " + (pv < 0.001 ? "0.001'in altı" : r0(pv * 1000) / 1000) +
            ". " + (pv < 0.05
              ? "Kırmızı alan küçük: fark yokken böyle bir sonuç nadirdir. Ama bu, farkın önemli olduğunu değil, rastlantıyla kolay açıklanamadığını söyler."
              : "Kırmızı alan geniş: fark yokken de bu sonuç rahatlıkla çıkabilirdi. Örneklemi büyütmek aynı farkı 'anlamlı' hâle getirir.") };
      }
    },

    "simpson": {
      title: "Simpson paradoksu",
      note: "Böbrek taşı tedavilerinde gerçekten görülmüş bir örnek. Gruplar birleştirilirken hasta karmasının farkı gizlenir.",
      controls: [{ key: "k", label: "Ağır vakaların A'ya yönlendirilme oranı", min: 0, max: 100, step: 10, def: 80, fmt: pctS }],
      draw: function (p) {
        var k = p.k / 100, T = 350;
        var rate = { aKolay: 0.93, bKolay: 0.87, aAgir: 0.73, bAgir: 0.69 };
        var aAgir = T * k, aKolay = T - aAgir, bAgir = T * (1 - k), bKolay = T - bAgir;
        var aAll = (rate.aAgir * aAgir + rate.aKolay * aKolay) / T;
        var bAll = (rate.bAgir * bAgir + rate.bKolay * bKolay) / T;
        var groups = [
          ["Kolay vaka", rate.aKolay, rate.bKolay],
          ["Ağır vaka", rate.aAgir, rate.bAgir],
          ["Toplam", aAll, bAll]
        ];
        var lo = 0.6;                          // başarı oranları %60-%100 aralığında
        var h = function (v) { return (v - lo) / (1 - lo); };
        var s = frame("", "Başarı oranı");
        groups.forEach(function (g, i) {
          var cx = 0.17 + i * 0.33;
          s += gRect(cx - 0.115, 0, cx - 0.015, h(g[1]), { c: "var(--accent)", o: 0.85 });
          s += gRect(cx + 0.015, 0, cx + 0.115, h(g[2]), { c: "var(--makro)", o: 0.85 });
          s += gTxt(cx - 0.065, h(g[1]), "%" + r0(g[1] * 100), { a: "middle", dy: -5, s: 8.5, c: "var(--muted)" });
          s += gTxt(cx + 0.065, h(g[2]), "%" + r0(g[2] * 100), { a: "middle", dy: -5, s: 8.5, c: "var(--muted)" });
          s += gTxt(cx, 0, g[0], { a: "middle", dy: 12, s: 9, b: i === 2 ? 1 : 0 });
        });
        s += gTxt(0.02, 0.94, "A yöntemi", { a: "start", dy: 2, c: "var(--accent)", b: 1, s: 9 });
        s += gTxt(0.98, 0.94, "B yöntemi", { a: "end", dy: 2, c: "var(--makro)", b: 1, s: 9 });
        s += gTxt(0, 0, "%" + r0(lo * 100), { a: "end", dx: -5, dy: 3, s: 9 });
        return { svg: s, text: "A yöntemi her iki grupta da B'den başarılı: kolay vakada %93'e %87, ağır vakada %73'e %69. " +
          (aAll >= bAll
            ? "Toplamda da öyle görünüyor (%" + r0(aAll * 100) + "'e %" + r0(bAll * 100) + "), çünkü ağır vakalar iki yönteme benzer dağılmış."
            : "Ama toplamda B önde görünüyor: %" + r0(bAll * 100) + "'e %" + r0(aAll * 100) + ". Sebep A'nın kötü olması değil, ağır vakaların %" +
              p.k + "'inin A'ya gitmesi.") };
      }
    },

    "perspektif": {
      title: "Tek kaçış noktalı perspektif",
      note: "Aynı boydaki iki figürün ekranda farklı büyüklükte çıkması bir kural değil, bir hesabın sonucudur. Brunelleschi'nin bulduğu şey bu hesaptı.",
      controls: [
        { key: "h", label: "Ufuk çizgisi (göz hizası)", min: 30, max: 80, step: 5, def: 55, fmt: pctS },
        { key: "d", label: "İzleyici mesafesi", min: 15, max: 90, step: 5, def: 35,
          fmt: function (v) { return v < 30 ? "yakın" : v > 65 ? "uzak" : "orta"; } }
      ],
      draw: function (p) {
        var H = p.h / 100, d = p.d / 10, i;
        /* Tek kaçış noktalı izdüşüm: z derinliğindeki bir zemin noktası
           ekranda kaçış noktasına d/(d+z) oranında yaklaşır. */
        var yz = function (z) { return H * (1 - d / (d + z)); };
        var xz = function (x0, z) { return 0.5 + (x0 - 0.5) * (d / (d + z)); };
        var s = gRect(0, H, 1, 1, { c: "var(--makro)", o: 0.07, r: 0 });   // arka duvar
        s += gRect(0, 0, 1, H, { c: "var(--accent)", o: 0.09, r: 0 });     // zemin
        for (i = 0; i <= 6; i++) {                       // zemine dik çizgiler
          s += gLine(i / 6, 0, 0.5, H, { c: "var(--rule)", w: 1.1 });
        }
        [1.2, 3, 6, 11, 20, 40].forEach(function (z) {   // enine çizgiler
          var y = yz(z);
          s += gLine(xz(0, z), y, xz(1, z), y, { c: "var(--rule)", w: 1.1 });
        });
        s += gLine(0, H, 1, H, { c: "var(--makro)", w: 1.6, d: "5 3" });
        s += gTxt(0.02, H, "ufuk çizgisi", { a: "start", dy: -5, c: "var(--makro)", s: 9 });

        /* İki figür de göz hizasıyla aynı boyda. Bu durumda tepe noktaları
           yz(z) + H·d/(d+z) = H olur: mesafe ne olursa olsun başları ufuk
           çizgisine değer. Perspektifin en çok işe yarayan tek kuralı budur. */
        var near = 1.2, far = 14;
        [[near, 0.20], [far, 0.66]].forEach(function (f) {
          var z = f[0], k = d / (d + z), fx = xz(f[1], z), fy = yz(z);
          s += gRect(fx - 0.05 * k, fy, fx + 0.05 * k, H, { c: "var(--accent)", o: 0.85, r: 1 });
        });
        var ratio = ((d / (d + near)) / (d / (d + far)));
        s += gDot(0.5, H, { c: "var(--ink)", r: 3.5 });
        s += gTxt(0.5, H, "kaçış noktası", { a: "middle", dy: -9, c: "var(--ink)", b: 1, s: 9 });
        return { svg: s, text: "İki figür de göz hizanızla aynı boyda, bu yüzden ikisinin de başı " +
          "ufuk çizgisine değiyor — mesafeden bağımsız olarak. Yakındaki, uzaktakinin " + r1(ratio) +
          " katı görünüyor. " + (p.d < 30
            ? "İzleyici yaklaştıkça derinlik abartılır: zemin hızla daralır, mekân dramatikleşir."
            : p.d > 65
              ? "İzleyici uzaklaştıkça izdüşüm düzleşir; kareler neredeyse eşit aralıklı görünür."
              : "Ufuk çizgisini yükseltirseniz sahneye tepeden, alçaltırsanız aşağıdan bakarsınız.") };
      }
    },

    "esz-zamanli-karsitlik": {
      title: "Aynı gri, iki farklı zemin",
      note: "Renkler burada bilerek sabit değerlerde çizilir; kurstaki diğer grafiklerin aksine temaya göre değişmezler, çünkü gösterilen şey karşılaştırmanın kendisi.",
      controls: [
        { key: "k", label: "Zeminler arası karşıtlık", min: 0, max: 100, step: 10, def: 90, fmt: pctS },
        { key: "b", type: "choice", label: "Bağlantı şeridi", def: "yok",
          options: [["yok", "Kapalı"], ["var", "Açık"]] }
      ],
      draw: function (p) {
        var k = p.k / 100, L1 = 50 + 42 * k, L2 = 50 - 42 * k, G = "hsl(0 0% 50%)";
        var bg = function (L) { return "hsl(0 0% " + r0(L) + "%)"; };
        var s = gRect(0, 0, 0.5, 1, { c: bg(L2), r: 0 });
        s += gRect(0.5, 0, 1, 1, { c: bg(L1), r: 0 });
        if (p.b === "var") s += gRect(0, 0.44, 1, 0.56, { c: G, r: 0 });
        s += gRect(0.13, 0.3, 0.37, 0.7, { c: G, r: 2 });
        s += gRect(0.63, 0.3, 0.87, 0.7, { c: G, r: 2 });
        s += gTxt(0.25, 0.06, "koyu zemin", { a: "middle", c: bg(L2 > 50 ? 20 : 88), s: 9, b: 1 });
        s += gTxt(0.75, 0.06, "açık zemin", { a: "middle", c: bg(L1 > 50 ? 20 : 88), s: 9, b: 1 });
        return { svg: s, text: k === 0
          ? "Zeminler eşitken iki kare de aynı görünüyor — çünkü gerçekten aynılar."
          : "İki kare de tam olarak aynı gri. Koyu zemindeki açık, açık zemindeki koyu görünüyor. " +
            (p.b === "var"
              ? "Bağlantı şeridi ikisini birleştirince yanılsama çöküyor: göz artık tek bir yüzey görüyor."
              : "Bağlantı şeridini açıp ikisini birleştirin; yanılsama anında dağılır. Göz mutlak parlaklığı değil, komşusuyla farkı ölçer.") };
      }
    },

    "tarama-testi": {
      title: "Testin pozitif çıkması ne demek?",
      note: "Hastalık seyrekse, testin yanlış alarmları gerçek vakaları sayıca geçebilir. Bu, testin kötü olduğunu değil, taban oranının belirleyici olduğunu gösterir.",
      controls: [
        { key: "y", label: "Yaygınlık (1000 kişide)", min: 1, max: 100, step: 1, def: 10,
          fmt: function (v) { return v + " kişi"; } },
        { key: "d", label: "Duyarlılık", min: 70, max: 100, step: 1, def: 99, fmt: pctS },
        { key: "o", label: "Özgüllük", min: 70, max: 100, step: 1, def: 95, fmt: pctS }
      ],
      draw: function (p) {
        var N = 1000, hasta = p.y, saglam = N - hasta;
        var dp = hasta * (p.d / 100), yn = hasta - dp;          // doğru pozitif, yanlış negatif
        var yp = saglam * (1 - p.o / 100), dn = saglam - yp;    // yanlış pozitif, doğru negatif
        var poz = dp + yp, ppv = poz > 0 ? dp / poz : 0;
        var s = "", x = 0;
        var seg = function (w, c, o) {
          if (w <= 0) return;
          s += gRect(x, 0.62, x + w / N, 0.92, { c: c, o: o, r: 0 });
          x += w / N;
        };
        seg(dp, "var(--accent)", 0.9);
        seg(yn, "var(--accent)", 0.28);
        seg(yp, "var(--no)", 0.85);
        seg(dn, "var(--rule)", 0.7);
        s += gTxt(0, 0.92, "1000 kişi", { a: "start", dy: -5, s: 9, b: 1 });

        // Alt şerit yalnızca testi pozitif çıkanları gösterir; genişliği doğrudan
        // pozitif kestirim değerini okutur.
        var w1 = poz > 0 ? dp / poz : 0;
        s += gRect(0, 0.12, w1, 0.42, { c: "var(--accent)", o: 0.9, r: 0 });
        s += gRect(w1, 0.12, 1, 0.42, { c: "var(--no)", o: 0.85, r: 0 });
        s += gTxt(0, 0.42, "test pozitif çıkanlar (" + r0(poz) + " kişi)", { a: "start", dy: -5, s: 9, b: 1 });
        s += gLine(0, 0.6, 0, 0.44, { c: "var(--rule)", w: 1, d: "2 3" });
        s += gLine(poz / N, 0.6, 1, 0.44, { c: "var(--rule)", w: 1, d: "2 3" });
        if (w1 > 0.14) s += gTxt(w1 / 2, 0.27, "gerçek", { a: "middle", dy: 3, c: "var(--surface)", b: 1, s: 9 });
        if (1 - w1 > 0.18) s += gTxt((1 + w1) / 2, 0.27, "yanlış alarm", { a: "middle", dy: 3, c: "var(--surface)", b: 1, s: 9 });
        return { svg: s, text: "1000 kişide " + hasta + " hasta var. Test " + r0(poz) + " kişiyi pozitif buluyor; " +
          "bunların " + r0(dp) + " tanesi gerçekten hasta, " + r0(yp) + " tanesi değil. " +
          "Pozitif çıkan birinin gerçekten hasta olma olasılığı %" + r1(ppv * 100) + "." };
      }
    },

    "buyuk-sayilar": {
      title: "Büyük sayılar yasası ne söyler, ne söylemez",
      note: "Yasa oranın dengeleneceğini söyler, farkın kapanacağını değil. 'Artık tura gelmeli' sezgisi tam bu ayrımı kaçırır.",
      controls: [
        { key: "n", label: "Atış sayısı", min: 10, max: 1000, step: 10, def: 200,
          fmt: function (v) { return v + " atış"; } },
        { key: "g", type: "choice", label: "Bakılan büyüklük", def: "oran",
          options: [["oran", "Yazı oranı"], ["fark", "Yazı fazlası"]] }
      ],
      draw: function (p) {
        /* Sabit tohumlu doğrusal eşleme: her çizimde aynı dizi üretilir,
           böylece kaydırıcıyı oynatmak geçmişi değiştirmez. */
        var seed = 20250817, i, run = 0, cum = [0];
        for (i = 1; i <= 1000; i++) {
          seed = (seed * 1664525 + 1013904223) % 4294967296;
          run += seed / 4294967296 < 0.5 ? 1 : 0;
          cum.push(run);
        }
        var N = p.n, pts = [], step = Math.max(1, Math.floor(N / 110));
        var s;
        if (p.g === "oran") {
          var up = [], dn = [];
          for (i = 5; i <= 1000; i += Math.max(1, Math.floor(1000 / 110))) {
            var e = Math.min(0.5, 1 / Math.sqrt(i));
            up.push([i / 1000, 0.5 + e]);
            dn.push([i / 1000, 0.5 - e]);
          }
          s = frame("Atış sayısı", "Yazı oranı");
          s += gArea(up.concat(dn.slice().reverse()), { c: "var(--rule)", o: 0.5 });
          s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.4, d: "4 3" });
          for (i = 5; i <= N; i += step) pts.push([i / 1000, cum[i] / i]);
          pts.push([N / 1000, cum[N] / N]);
          s += gPoly(pts, { c: "var(--accent)", w: 2 });
          s += gDot(N / 1000, cum[N] / N, { c: "var(--ink)", r: 3.5 });
          s += gTxt(0.99, 0.5, "%50", { a: "end", dy: -5, s: 9 });
        } else {
          var top = 40;                                  // ±40 yazı fazlası
          var y = function (v) { return 0.5 + v / (2 * top); };
          var eu = [], ed = [];
          for (i = 5; i <= 1000; i += Math.max(1, Math.floor(1000 / 110))) {
            var sd = Math.sqrt(i) / 2;
            eu.push([i / 1000, Math.min(1, y(2 * sd))]);
            ed.push([i / 1000, Math.max(0, y(-2 * sd))]);
          }
          s = frame("Atış sayısı", "Yazı − beklenen");
          s += gArea(eu.concat(ed.slice().reverse()), { c: "var(--rule)", o: 0.5 });
          s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.4, d: "4 3" });
          for (i = 5; i <= N; i += step) pts.push([i / 1000, Math.max(0, Math.min(1, y(cum[i] - i / 2)))]);
          pts.push([N / 1000, Math.max(0, Math.min(1, y(cum[N] - N / 2)))]);
          s += gPoly(pts, { c: "var(--makro)", w: 2 });
          s += gDot(N / 1000, Math.max(0, Math.min(1, y(cum[N] - N / 2))), { c: "var(--ink)", r: 3.5 });
          s += gTxt(0.99, 0.5, "0", { a: "end", dy: -5, s: 9 });
        }
        [250, 500].forEach(function (v) { s += gTxt(v / 1000, 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        var oran = cum[N] / N, fark = cum[N] - N / 2;
        return { svg: s, text: p.g === "oran"
          ? N + " atıştan sonra yazı oranı %" + r1(oran * 100) + ". Atış sayısı arttıkça oran %50'ye yaklaşıyor: " +
            "gri bant, beklenen sapmanın 1/√n ile daralışını gösteriyor."
          : N + " atıştan sonra yazı sayısı beklenenden " + (fark >= 0 ? "+" : "") + r0(fark) + " farklı. " +
            "Oran dengelenirken bu fark küçülmüyor, ortalamada √n hızıyla büyüyor. Yazı tura geçmişi hatırlamaz." };
      }
    },

    "beklenen-deger": {
      title: "Beklenen değer",
      note: "Beklenen değer tek bir oyunun sonucunu söylemez; aynı bahis çok kez oynanırsa oyun başına ortalamanın nereye oturacağını söyler.",
      controls: [
        { key: "p", label: "Kazanma olasılığı", min: 5, max: 95, step: 5, def: 40, fmt: pctS },
        { key: "k", label: "Kazanırsan", min: 50, max: 500, step: 25, def: 200,
          fmt: function (v) { return "+" + v + " TL"; } }
      ],
      draw: function (p) {
        var pr = p.p / 100, K = p.k, L = 100;            // kaybedersen −100 TL
        var ev = pr * K - (1 - pr) * L;
        var top = Math.max(K, L, Math.abs(ev)) * 1.15;
        var y0 = 0.42, y = function (v) { return y0 + (v / top) * (v >= 0 ? (1 - y0) : y0); };
        var bars = [["Kazanırsan", K, "var(--ok)"], ["Kaybedersen", -L, "var(--no)"],
                    ["Beklenen değer", ev, ev >= 0 ? "var(--accent)" : "var(--no)"]];
        var s = frame("", "Lira");
        s += gLine(0, y0, 1, y0, { c: "var(--rule)", w: 1.4 });
        bars.forEach(function (b, i) {
          var cx = 0.17 + i * 0.33;
          s += gRect(cx - 0.1, y0, cx + 0.1, y(b[1]), { c: b[2], o: i === 2 ? 0.95 : 0.6 });
          s += gTxt(cx, y(b[1]), (b[1] > 0 ? "+" : "") + r0(b[1]), {
            a: "middle", dy: b[1] >= 0 ? -5 : 12, s: 9.5, b: i === 2 ? 1 : 0,
            c: i === 2 ? "var(--ink)" : "var(--muted)" });
          s += gTxt(cx, y0, b[0], { a: "middle", dy: b[1] >= 0 ? 12 : -5, s: 9, b: i === 2 ? 1 : 0 });
        });
        var basabas = (L / (K + L)) * 100;
        return { svg: s, text: "Beklenen değer " + (ev >= 0 ? "+" : "") + r1(ev) + " lira. " +
          (Math.abs(ev) < 0.5
            ? "Oyun tam adil: uzun vadede ne kazanır ne kaybedersiniz."
            : ev > 0
              ? "Bu bahis uzun vadede oyun başına " + r1(ev) + " lira kazandırır."
              : "Bu bahis uzun vadede oyun başına " + r1(-ev) + " lira kaybettirir.") +
          " Başa baş noktası %" + r1(basabas) + ": kazanma olasılığı bunun altındaysa oyun aleyhinizedir." };
      }
    },

    "fayda-egrisi": {
      title: "Neden adil bahsi reddederiz?",
      note: "Fayda eğrisi içbükeydir: kazanılan liranın kattığı mutluluk, kaybedilen liranın götürdüğünden azdır. Sigortanın da, çeşitlendirmenin de temeli budur.",
      controls: [
        { key: "s", label: "Servet", min: 20, max: 500, step: 20, def: 100,
          fmt: function (v) { return v + " bin" ; } },
        { key: "b", label: "Bahis büyüklüğü", min: 10, max: 90, step: 10, def: 50,
          fmt: function (v) { return "servetin %" + v + "'i"; } }
      ],
      draw: function (p) {
        var W = p.s, B = (W * p.b) / 100, lo = W - B, hi = W + B;
        var u = function (w) { return Math.log(w); };
        var eu = 0.5 * u(lo) + 0.5 * u(hi), ce = Math.exp(eu), prim = W - ce;
        var xmax = W * 2.1, xmin = xmax * 0.02;
        var umin = u(xmin), umax = u(xmax);
        var X = function (w) { return (w - xmin) / (xmax - xmin); };
        var Y = function (v) { return (v - umin) / (umax - umin); };
        var pts = [], i;
        for (i = 0; i <= 70; i++) {
          var w = xmin + ((xmax - xmin) * i) / 70;
          pts.push([X(w), Y(u(w))]);
        }
        var s = frame("Servet", "Fayda");
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(X(lo), Y(u(lo)), X(hi), Y(u(hi)), { c: "var(--no)", w: 1.6, d: "4 3" });
        s += gDot(X(lo), Y(u(lo)), { c: "var(--muted)", r: 3 });
        s += gDot(X(hi), Y(u(hi)), { c: "var(--muted)", r: 3 });
        s += gDot(X(W), Y(eu), { c: "var(--no)", r: 3.5 });
        s += gDot(X(W), Y(u(W)), { c: "var(--ok)", r: 3.5 });
        s += gTxt(X(W), Y(u(W)), "bahse girmemek", { a: "end", dx: -6, dy: -6, c: "var(--ok)", b: 1, s: 9 });
        s += gTxt(X(W), Y(eu), "bahsin faydası", { a: "start", dx: 5, dy: 12, c: "var(--no)", b: 1, s: 9 });
        s += gLine(X(ce), 0, X(ce), Y(eu), { c: "var(--rule)", w: 1.2, d: "2 3" });
        s += gTxt(X(ce), 0, r0(ce) + "", { a: "middle", dy: 12, s: 9, b: 1 });
        return { svg: s, text: "Yazı tura ile servetinizin %" + p.b + "'ini kazanma ya da kaybetme bahsi, parasal olarak " +
          "tam adil: beklenen serveti " + W + " binde bırakır. Ama faydası " + r0(ce) + " bin liralık garantili bir servete " +
          "denk. Aradaki " + r1(prim) + " binlik fark, bu bahsi almamak için ödemeye razı olduğunuz risk primidir." };
      }
    },

    "dogum-gunu": {
      title: "Doğum günü paradoksu",
      note: "Soru 'birinin doğum günü seninkiyle aynı mı' değil, 'herhangi iki kişininki çakışıyor mu'. Karşılaştırma sayısı kişi sayısıyla değil, karesiyle artar.",
      controls: [{ key: "n", label: "Grup büyüklüğü", min: 2, max: 70, step: 1, def: 23,
        fmt: function (v) { return v + " kişi"; } }],
      draw: function (p) {
        var pr = function (n) {
          var q = 1, i;
          for (i = 0; i < n; i++) q *= (365 - i) / 365;
          return 1 - q;
        };
        var pts = [], i;
        for (i = 2; i <= 70; i++) pts.push([(i - 2) / 68, pr(i)]);
        var here = pr(p.n), cift = (p.n * (p.n - 1)) / 2;
        var s = frame("Kişi sayısı", "Çakışma olasılığı");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.3, d: "4 3" });
        s += gTxt(0.02, 0.5, "%50", { a: "start", dy: -5, s: 9 });
        s += gDot((p.n - 2) / 68, here, { c: "var(--ink)" });
        s += gTxt((p.n - 2) / 68, here, "%" + r0(here * 100), {
          a: p.n > 45 ? "end" : "start", dx: p.n > 45 ? -6 : 6, dy: 4, c: "var(--ink)", b: 1, s: 10 });
        [10, 30, 50].forEach(function (v) { s += gTxt((v - 2) / 68, 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: p.n + " kişilik bir grupta en az iki kişinin doğum gününün aynı olma olasılığı %" +
          r1(here * 100) + ". Sezgiyi şaşırtan şey şu: grupta " + r0(cift) + " ayrı kişi çifti var ve her biri " +
          "ayrı bir çakışma şansı taşıyor." };
      }
    },

    "armonik-seri": {
      title: "Armonik seri",
      note: "Tek bir telden çıkan ses aslında bir yığındır. Majör akorun üç sesi, doğada bu yığının içinde zaten durur.",
      controls: [
        { key: "n", label: "Kaç armonik", min: 1, max: 12, step: 1, def: 6,
          fmt: function (v) { return v + " ses"; } },
        { key: "d", label: "Üst seslerin gücü", min: 0, max: 100, step: 10, def: 50,
          fmt: function (v) { return v < 30 ? "yumuşak" : v > 70 ? "parlak" : "orta"; } },
        { key: "g", type: "choice", label: "Görünüm", def: "spektrum",
          options: [["spektrum", "Spektrum"], ["dalga", "Dalga"]] }
      ],
      draw: function (p) {
        var ADLAR = ["temel", "oktav", "beşli", "oktav", "bü. üçlü", "beşli", "~yedili",
                     "oktav", "bü. ikili", "bü. üçlü", "—", "beşli"];
        var e = 2 - 1.5 * (p.d / 100), N = p.n, i, k;
        var amp = [];
        for (k = 1; k <= N; k++) amp.push(Math.pow(k, -e));
        var s;
        if (p.g === "spektrum") {
          s = frame("", "Güç");
          for (k = 1; k <= N; k++) {
            var cx = (k - 0.5) / N, w = Math.min(0.055, 0.4 / N);
            s += gRect(cx - w, 0, cx + w, amp[k - 1], { c: k === 1 ? "var(--ink)" : "var(--accent)", o: k === 1 ? 0.9 : 0.75 });
            if (N <= 8) s += gTxt(cx, amp[k - 1], ADLAR[k - 1], { a: "middle", dy: -5, s: 8, c: "var(--muted)" });
            s += gTxt(cx, 0, k + "", { a: "middle", dy: 12, s: 9 });
          }
        } else {
          var pts = [], tot = 0;
          for (k = 1; k <= N; k++) tot += amp[k - 1];
          for (i = 0; i <= 260; i++) {
            var t = (2 * i) / 260, v = 0;
            for (k = 1; k <= N; k++) v += amp[k - 1] * Math.sin(2 * Math.PI * k * t);
            pts.push([i / 260, 0.5 + (v / (2 * tot)) * 0.92]);
          }
          s = frame("İki periyot", "Basınç");
          s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.2, d: "4 3" });
          s += gPoly(pts, { c: "var(--accent)", w: 2 });
        }
        return { svg: s, text: N === 1
          ? "Tek bir saf sinüs: doğada neredeyse hiç duyulmaz. Üst armonikleri ekledikçe ses bir enstrümana benzemeye başlar."
          : "İlk " + N + " armonik: " + ADLAR.slice(0, Math.min(N, 6)).join(", ") + (N > 6 ? "…" : "") +
            ". Perde temel frekansla, tını ise üst armoniklerin güç dağılımıyla belirlenir — aynı notayı çalan flüt ile keman " +
            "bu yüzden farklı duyulur." };
      }
    },

    "konsonans": {
      title: "Basit oranlar neden uyumlu duyulur",
      note: "Kulağın 'uyum' dediği şey, iki sesin birleşik dalgasının kısa bir örüntüde tekrar etmesidir. Oran ne kadar basitse örüntü o kadar kısadır.",
      controls: [{ key: "c", label: "İkinci sesin aralığı", min: 0, max: 12, step: 1, def: 7,
        fmt: function (v) {
          var A = ["unison", "kü. ikili", "bü. ikili", "kü. üçlü", "bü. üçlü", "dörtlü", "artık dörtlü",
                   "beşli", "kü. altılı", "bü. altılı", "kü. yedili", "bü. yedili", "oktav"];
          return A[v];
        } }],
      draw: function (p) {
        var SAF = [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [45, 32],
                   [3, 2], [8, 5], [5, 3], [9, 5], [15, 8], [2, 1]];
        var r = Math.pow(2, p.c / 12), saf = SAF[p.c], oran = saf[0] / saf[1];
        var sent = 1200 * (Math.log(r / oran) / Math.log(2));
        var pts = [], i;
        for (i = 0; i <= 300; i++) {
          var t = (4 * i) / 300;
          pts.push([i / 300, 0.5 + (Math.sin(2 * Math.PI * t) + Math.sin(2 * Math.PI * r * t)) / 4.4]);
        }
        var s = frame("Zaman", "Birleşik dalga");
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.2, d: "4 3" });
        s += gPoly(pts, { c: "var(--accent)", w: 1.9 });
        if (saf[1] <= 8) {                                  // basit oranda örüntü kısa: tekrarı işaretle
          var per = saf[1] / 4;
          for (i = 1; i * per < 1; i++) s += gLine(i * per, 0.06, i * per, 0.94, { c: "var(--ok)", w: 1, d: "3 3" });
        }
        return { svg: s, text: "Eşit tamperede bu aralığın oranı " + r2(r) + "; en yakın saf oran " +
          saf[0] + ":" + saf[1] + " = " + r2(oran) + ". Fark " + (sent > 0 ? "+" : "") + r0(sent) + " sent. " +
          (saf[1] <= 4
            ? "Payda küçük olduğu için birleşik dalga kısa aralıklarla tekrar ediyor — yeşil çizgiler tekrarı gösteriyor. Kulak bunu uyum olarak duyar."
            : saf[1] <= 8
              ? "Orta karmaşıklıkta bir oran: örüntü var ama daha uzun. Batı armonisi bu aralıkları renk için kullanır."
              : "Payda büyük: birleşik dalga uzun bir çevrimde tekrar ediyor, kulak düzenli bir örüntü yakalayamıyor. Gerilim duygusu buradan gelir.") };
      }
    },

    "akort-sistemleri": {
      title: "Akort: kaçınılmaz bir uzlaşma",
      note: "Saf oranlar bir tonda kusursuzdur ama başka bir tona geçince bozulur. Eşit tampere, her aralığı biraz bozarak her tonu eşit derecede kullanılabilir kılar.",
      controls: [{ key: "s", type: "choice", label: "Karşılaştırılan düzen", def: "dogal",
        options: [["dogal", "Saf düzen"], ["pisagor", "Pisagor"]] }],
      draw: function (p) {
        var AD = ["do", "do♯", "re", "mi♭", "mi", "fa", "fa♯", "sol", "sol♯", "la", "si♭", "si"];
        var SAF = [0, 111.73, 203.91, 315.64, 386.31, 498.04, 590.22, 701.96, 813.69, 884.36, 1017.60, 1088.27];
        var PIS = [0, 90.22, 203.91, 294.13, 407.82, 498.04, 611.73, 701.96, 792.18, 905.87, 996.09, 1109.78];
        var v = p.s === "dogal" ? SAF : PIS, top = 22, i;
        var y = function (c) { return 0.5 + c / (2 * top); };
        var s = frame("", "Sent farkı");
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1.4 });
        s += gTxt(0.005, 0.5, "eşit tampere", { a: "start", dy: -4, s: 8.5 });
        var enBuyuk = 0, enAd = "";
        for (i = 0; i < 12; i++) {
          var d = v[i] - 100 * i, cx = (i + 0.5) / 12;
          if (Math.abs(d) > Math.abs(enBuyuk)) { enBuyuk = d; enAd = AD[i]; }
          s += gRect(cx - 0.028, 0.5, cx + 0.028, Math.max(0.02, Math.min(0.98, y(d))),
            { c: Math.abs(d) > 10 ? "var(--no)" : "var(--accent)", o: 0.8 });
          s += gTxt(cx, 0, AD[i], { a: "middle", dy: 12, s: 8 });
        }
        return { svg: s, text: (p.s === "dogal"
          ? "Saf düzende aralıklar küçük tamsayı oranlarına oturur; üçlüler pürüzsüzdür. "
          : "Pisagor düzeni her şeyi saf beşliler üstüne kurar; beşliler kusursuz, üçlüler ise belirgin biçimde tiz kalır. ") +
          "Eşit tampereye göre en büyük sapma " + enAd + " sesinde: " + (enBuyuk > 0 ? "+" : "") + r0(enBuyuk) +
          " sent. On sentin üstündeki farklar kırmızı; eğitimli bir kulak bu farkı duyar." };
      }
    },

    "modlar": {
      title: "Aynı yedi ses, yedi ayrı renk",
      note: "Modlar yeni notalar getirmez; aynı diziyi farklı bir sesten başlatır. Değişen şey, tam ve yarım seslerin sırasıdır.",
      controls: [{ key: "k", label: "Mod", min: 1, max: 7, step: 1, def: 1,
        fmt: function (v) {
          return ["İyonyen", "Dorien", "Frigyen", "Lidyen", "Miksolidyen", "Aeolyen", "Lokrien"][v - 1];
        } }],
      draw: function (p) {
        var ADLAR = ["İyonyen", "Dorien", "Frigyen", "Lidyen", "Miksolidyen", "Aeolyen", "Lokrien"];
        var RENK = ["parlak", "hüzünlü ama yumuşak", "koyu ve gergin", "en parlak",
                    "neşeli ama çözülmeyen", "hüzünlü", "kararsız"];
        var TEMEL = [2, 2, 1, 2, 2, 2, 1], adim = [], i;
        for (i = 0; i < 7; i++) adim.push(TEMEL[(i + p.k - 1) % 7]);
        var derece = [0], t = 0;
        for (i = 0; i < 7; i++) { t += adim[i]; derece.push(t); }
        var siyah = [1, 3, 6, 8, 10];
        var s = "";
        for (i = 0; i <= 12; i++) {
          var x = i / 12, ic = derece.indexOf(i) >= 0;
          s += gRect(x - 0.036, 0.30, x + 0.036, 0.72, {
            c: ic ? "var(--accent)" : (siyah.indexOf(i) >= 0 ? "var(--ink)" : "var(--rule)"),
            o: ic ? 0.9 : 0.22, r: 2 });
          if (ic) s += gTxt(x, 0.72, (derece.indexOf(i) + 1) + "", { a: "middle", dy: -5, s: 8.5, b: 1, c: "var(--ink)" });
        }
        s += gLine(0, 0.24, 1, 0.24, { c: "var(--rule)", w: 1.2 });
        for (i = 0; i < 7; i++) {
          var a = derece[i] / 12, b = derece[i + 1] / 12;
          s += gTxt((a + b) / 2, 0.24, adim[i] === 1 ? "Y" : "T", {
            a: "middle", dy: 13, s: 9, b: adim[i] === 1 ? 1 : 0,
            c: adim[i] === 1 ? "var(--no)" : "var(--muted)" });
        }
        s += gTxt(0, 0.86, ADLAR[p.k - 1], { a: "start", s: 11, b: 1, c: "var(--ink)" });
        return { svg: s, text: ADLAR[p.k - 1] + ": " + adim.map(function (a) { return a === 1 ? "yarım" : "tam"; }).join("-") +
          ". Karakteri " + RENK[p.k - 1] + ". Yarım seslerin dizideki yeri (kırmızı Y'ler) modun rengini belirleyen tek şeydir." };
      }
    },

    "usuller": {
      title: "Eşit ve aksak usuller",
      note: "Aksak usullerde ölçü, eşit olmayan iki ve üçlü gruplardan kurulur. Türkü ve halk dansı repertuvarının büyük kısmı bu usullerdedir.",
      controls: [{ key: "u", type: "choice", label: "Usul", def: "98",
        options: [["44", "4/4"], ["68", "6/8"], ["78", "7/8"], ["98", "9/8"]] }],
      draw: function (p) {
        var U = {
          "44": { g: [2, 2, 2, 2], ad: "4/4", not: "Eşit ölçü: dört vuruş, ikişer sekizlik. Pop ve rock repertuvarının varsayılanı." },
          "68": { g: [3, 3], ad: "6/8", not: "Altı sekizlik iki üçlü grup hâlinde. Eşit ama üçlü nabızlı; yürüyüş değil salınım verir." },
          "78": { g: [2, 2, 3], ad: "7/8", not: "Aksak: iki kısa bir uzun. Sondaki üçlü grup, ölçüye o tanıdık topallamayı verir." },
          "98": { g: [2, 2, 2, 3], ad: "9/8", not: "Karşılama ve pek çok Roman havasının usulü. Üç kısa grubun ardından gelen uzun grup ölçüyü sürükler." }
        }[p.u];
        var n = U.g.reduce(function (a, b) { return a + b; }, 0), i, j, at = 0;
        var s = "";
        U.g.forEach(function (uzun) {
          var x0 = at / n, x1 = (at + uzun) / n;
          // Grup kutusu sütunların arkasında durur; vurgu sırası böyle okunuyor.
          s += gRect(x0 + 0.004, 0.22, x1 - 0.004, 0.9, { c: "var(--accent)", o: 0.09, r: 2 });
          s += gTxt((x0 + x1) / 2, 0.22, uzun + "", { a: "middle", dy: 13, s: 10, b: 1,
            c: uzun === 3 ? "var(--no)" : "var(--muted)" });
          for (j = 0; j < uzun; j++) {
            var cx = (at + j + 0.5) / n, vurgu = j === 0;
            s += gRect(cx - 0.03, 0.26, cx + 0.03, vurgu ? 0.84 : 0.55, {
              c: vurgu ? (uzun === 3 ? "var(--no)" : "var(--accent)") : "var(--rule)",
              o: vurgu ? 0.9 : 0.8, r: 2 });
          }
          at += uzun;
        });
        s += gTxt(0, 0.99, U.ad + "  ·  " + U.g.join("+"), { a: "start", s: 11, b: 1, c: "var(--ink)" });
        return { svg: s, text: U.ad + " = " + U.g.join("+") + ". Uzun sütunlar grup başlarındaki vurguları gösteriyor. " + U.not };
      }
    },

    "sonraki-sozcuk": {
      title: "Sonraki sözcük: bir olasılık dağılımı",
      note: "Dil modeli bir cevap seçmez, bir dağılım üretir. Sıcaklık, o dağılımdan nasıl örneklendiğini belirler: aynı kaydırıcı hem yaratıcılığı hem saçmalamayı yönetir.",
      controls: [{ key: "t", label: "Sıcaklık", min: 10, max: 150, step: 10, def: 70,
        fmt: function (v) { return (v / 100).toFixed(1); } }],
      draw: function (p) {
        var W = ["uyudu", "kaçtı", "atladı", "geldi", "havladı", "eridi"];
        var P0 = [0.40, 0.22, 0.17, 0.12, 0.06, 0.03];
        var T = p.t / 100, i, tot = 0, q = [];
        for (i = 0; i < P0.length; i++) { q.push(Math.pow(P0[i], 1 / T)); tot += q[i]; }
        for (i = 0; i < q.length; i++) q[i] /= tot;
        var s = frame("", "Olasılık");
        s += gTxt(0.99, 1, "\u201cKedi ___\u201d", { a: "end", dy: 2, s: 10.5, b: 1, c: "var(--ink)" });
        for (i = 0; i < W.length; i++) {
          var cx = (i + 0.5) / W.length;
          s += gRect(cx - 0.055, 0, cx + 0.055, q[i] * 0.88, { c: i > 3 ? "var(--no)" : "var(--accent)", o: i === 0 ? 0.9 : 0.65 });
          s += gTxt(cx, q[i] * 0.88, "%" + r0(q[i] * 100), { a: "middle", dy: -5, s: 8.5, c: "var(--muted)" });
          s += gTxt(cx, 0, W[i], { a: "middle", dy: 12, s: 8.5, c: i > 3 ? "var(--no)" : "var(--muted)" });
        }
        return { svg: s, text: T <= 0.3
          ? "Sıcaklık düşükken dağılım tek bir seçeneğe çöküyor: model neredeyse her zaman \u201c" + W[0] + "\u201d diyor (%" +
            r0(q[0] * 100) + "). Metin tutarlı ama tekdüze olur."
          : T >= 1.2
            ? "Sıcaklık yüksekken dağılım düzleşiyor. \u201chavladı\u201d ve \u201ceridi\u201d gibi bağlama uymayan seçenekler toplamda %" +
              r0((q[4] + q[5]) * 100) + " paya çıkıyor — bu ayarda üretim şaşırtıcı olduğu kadar tutarsız da olur."
            : "Bu ayarda en olası sözcük %" + r0(q[0] * 100) + " paya sahip, ama alternatifler de canlı. " +
              "Modelin \u201cbildiği\u201d şey bir cevap değil, bu dağılımın kendisidir." };
      }
    },

    "gomme": {
      title: "Anlamı yer olarak düşünmek",
      note: "Model sözcükleri sayı dizilerine çevirir. Bu uzayda yakınlık anlam yakınlığıdır — burada iki boyut var, gerçekte binlerce.",
      controls: [
        { key: "x", label: "Sorgu — yatay", min: 0, max: 100, step: 5, def: 50, fmt: function (v) { return v + ""; } },
        { key: "y", label: "Sorgu — dikey", min: 0, max: 100, step: 5, def: 50, fmt: function (v) { return v + ""; } }
      ],
      draw: function (p) {
        var K = [
          ["kedi", 0.18, 0.80], ["köpek", 0.30, 0.88], ["kuş", 0.10, 0.66],
          ["elma", 0.80, 0.84], ["üzüm", 0.90, 0.70], ["armut", 0.70, 0.74],
          ["korku", 0.16, 0.22], ["sevinç", 0.30, 0.30], ["öfke", 0.08, 0.36],
          ["tren", 0.78, 0.18], ["uçak", 0.90, 0.30], ["araba", 0.68, 0.28]
        ];
        var qx = p.x / 100, qy = p.y / 100, i;
        var d = K.map(function (k, i2) {
          return { i: i2, ad: k[0], m: Math.sqrt(Math.pow(k[1] - qx, 2) + Math.pow(k[2] - qy, 2)) };
        }).sort(function (a, b) { return a.m - b.m; });
        var yakin = [d[0].i, d[1].i, d[2].i];
        var s = frame("", "");
        for (i = 0; i < 3; i++) s += gLine(qx, qy, K[yakin[i]][1], K[yakin[i]][2], { c: "var(--accent)", w: 1.2, d: "3 3" });
        K.forEach(function (k, i2) {
          var on = yakin.indexOf(i2) >= 0;
          s += gDot(k[1], k[2], { c: on ? "var(--accent)" : "var(--rule)", r: on ? 4 : 3 });
          s += gTxt(k[1], k[2], k[0], { a: "middle", dy: -7, s: 8.5, b: on ? 1 : 0,
            c: on ? "var(--ink)" : "var(--muted)" });
        });
        s += gDot(qx, qy, { c: "var(--no)", r: 5 });
        return { svg: s, text: "Sorguya en yakın üç sözcük: " + d[0].ad + ", " + d[1].ad + ", " + d[2].ad +
          ". Sözcükler anlamlarına göre öbekleniyor — hayvanlar, meyveler, duygular, taşıtlar. " +
          "Arama, öneri ve benzerlik hesaplarının tamamı bu geometri üzerinde çalışır." };
      }
    },

    "hata-birikimi": {
      title: "Çok adımlı işlerde hata birikir",
      note: "Tek bir adımda yüksek görünen doğruluk, adımlar zincirlendiğinde hızla erir. Otomatik iş akışlarında asıl sınav budur.",
      controls: [
        { key: "p", label: "Adım başına doğruluk", min: 80, max: 100, step: 1, def: 95, fmt: pctS },
        { key: "n", label: "Adım sayısı", min: 1, max: 30, step: 1, def: 10,
          fmt: function (v) { return v + " adım"; } }
      ],
      draw: function (p) {
        var a = p.p / 100, N = 30, i, pts = [], ref = [];
        for (i = 1; i <= N; i++) {
          pts.push([(i - 1) / (N - 1), Math.pow(a, i)]);
          ref.push([(i - 1) / (N - 1), Math.pow(0.99, i)]);
        }
        var here = Math.pow(a, p.n);
        var s = frame("Adım sayısı", "Baştan sona başarı");
        s += gPoly(ref, { c: "var(--rule)", w: 1.6, d: "4 3" });
        s += gTxt(0.99, Math.pow(0.99, N), "%99'luk adım", { a: "end", dy: -5, s: 8.5 });
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine((p.n - 1) / (N - 1), 0, (p.n - 1) / (N - 1), here, { c: "var(--rule)", w: 1.1, d: "2 3" });
        s += gDot((p.n - 1) / (N - 1), here, { c: "var(--ink)" });
        s += gTxt((p.n - 1) / (N - 1), here, "%" + r0(here * 100), {
          a: p.n > 20 ? "end" : "start", dx: p.n > 20 ? -6 : 6, dy: -5, c: "var(--ink)", b: 1, s: 10 });
        [10, 20].forEach(function (v) { s += gTxt((v - 1) / (N - 1), 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Adım başına %" + p.p + " doğruluk, " + p.n + " adımlık bir işte baştan sona %" +
          r0(here * 100) + " başarı demek. " + (here < 0.5
            ? "Zincir yarıdan fazla vakada bir yerde kırılıyor; ara kontrol noktası koymadan böyle bir akış çalışmaz."
            : "Adım sayısını artırmadan önce, her adımın bağımsız olarak doğrulanıp doğrulanamayacağına bakmak gerekir.") };
      }
    },

    "esik": {
      title: "Eşiği nereye koyarsanız, hatayı seçersiniz",
      note: "Bir sınıflandırıcı 'doğru' ya da 'yanlış' değildir; bir eşikle kullanılır. Eşiği kaydırmak hatayı yok etmez, türünü değiştirir.",
      controls: [
        { key: "e", label: "Karar eşiği", min: 20, max: 80, step: 2, def: 50, fmt: function (v) { return v + ""; } },
        { key: "f", label: "İki grubun ayrışması", min: 10, max: 60, step: 5, def: 30,
          fmt: function (v) { return v < 20 ? "zayıf" : v > 45 ? "güçlü" : "orta"; } }
      ],
      draw: function (p) {
        var sd = 0.12, m0 = 0.5 - p.f / 200, m1 = 0.5 + p.f / 200, t = p.e / 100, i;
        var yog = function (x, m) { return Math.exp(-Math.pow((x - m) / sd, 2) / 2); };
        var A = [], B = [];
        for (i = 0; i <= 120; i++) {
          var x = i / 120;
          A.push([x, yog(x, m0) * 0.82]);
          B.push([x, yog(x, m1) * 0.82]);
        }
        var yp = 1 - ncdf((t - m0) / sd);      // yanlış pozitif oranı
        var yn = ncdf((t - m1) / sd);          // yanlış negatif oranı
        var s = frame("Modelin verdiği puan", "Sıklık");
        s += gArea(A.filter(function (q) { return q[0] >= t; }).concat([[1, 0], [t, 0]]), { c: "var(--no)", o: 0.32 });
        s += gArea([[0, 0], [t, 0]].concat(B.filter(function (q) { return q[0] <= t; }).reverse()), { c: "var(--makro)", o: 0.30 });
        s += gPoly(A, { c: "var(--muted)", w: 1.8 });
        s += gPoly(B, { c: "var(--accent)", w: 2.2 });
        s += gLine(t, 0, t, 0.96, { c: "var(--ink)", w: 1.8, d: "4 3" });
        s += gTxt(t, 0.96, "eşik", { a: t > 0.55 ? "end" : "start", dx: t > 0.55 ? -5 : 5, dy: 2, c: "var(--ink)", b: 1, s: 9 });
        s += gTxt(0.02, 0.62, "uygun değil", { a: "start", s: 8.5, c: "var(--muted)" });
        s += gTxt(0.98, 0.62, "uygun", { a: "end", s: 8.5, c: "var(--accent)", b: 1 });
        return { svg: s, text: "Bu eşikte uygun olmayanların %" + r0(yp * 100) + "'i yanlışlıkla kabul ediliyor, " +
          "uygun olanların %" + r0(yn * 100) + "'i ise gereksiz yere eleniyor. " +
          (p.f < 20
            ? "İki grup birbirine bu kadar karışmışken hiçbir eşik iyi değildir; sorun eşikte değil, modelin ayırt etme gücünde."
            : "Eşiği yükseltmek birinci hatayı azaltır ve ikincisini büyütür. Hangisinin daha pahalı olduğu teknik değil, kurumsal bir karardır.") };
      }
    },

    "yigin": {
      title: "Kaç tane kum bir yığın eder?",
      note: "İki öncül de tek tek makul: bir tane yığın değildir, bir tane eklemek yığın olmayanı yığın yapmaz. Yine de sonuç kabul edilemez. Sorun mantıkta değil, sınırı belirsiz kavramlarda.",
      controls: [{ key: "n", label: "Kum tanesi", min: 1, max: 210, step: 1, def: 5,
        fmt: function (v) { return v + " tane"; } }],
      draw: function (p) {
        var n = p.n, R = Math.ceil((Math.sqrt(8 * n + 1) - 1) / 2), i, r, kalan = n;
        var s = gLine(0.02, 0.03, 0.98, 0.03, { c: "var(--rule)", w: 1.2 });
        for (r = 0; r < R && kalan > 0; r++) {
          var kap = R - r, bu = Math.min(kap, kalan);
          for (i = 0; i < bu; i++) {
            var x = 0.5 + (i - (bu - 1) / 2) * (0.9 / R);
            s += gDot(x, 0.06 + r * (0.82 / R), { c: "var(--accent)", r: Math.max(1.6, 46 / R), o: 1 });
          }
          kalan -= bu;
        }
        return { svg: s, text: n === 1
          ? "Bir tane kum yığın değil. Bunda kimse itiraz etmiyor."
          : n < 12
            ? n + " tane kum. Hâlâ yığın demiyoruz — ama tam olarak neden demediğimizi söylemek şimdiden zor."
            : n < 60
              ? n + " tane. Kimi yığın der, kimi demez. Belirsizlik bölgesi burası; kavramın kendisinde keskin bir sınır yok."
              : n + " tane kum: buna herkes yığın der. Oysa yolun her adımında yalnızca bir tane eklendi ve hiçbir adımda 'işte şimdi yığın oldu' denebilecek bir an geçmedi." };
      }
    },

    "fayda-ve-adalet": {
      title: "Toplamı mı büyütmeli, en kötüyü mü korumalı?",
      note: "Aynı politikayı iki ölçüt zıt yönde değerlendiriyor. Bu bir hesap hatası değil; hangi şeyin maksimize edileceğine dair ahlaki bir tercih.",
      controls: [{ key: "e", label: "İzin verilen eşitsizlik", min: 0, max: 100, step: 10, def: 40, fmt: pctS }],
      draw: function (p) {
        var e = p.e, i;
        var toplam = 100 + 0.5 * e, enDusuk = 20 - 0.12 * e;
        var ust = toplam - 4 * enDusuk;
        var pay = [enDusuk, enDusuk, enDusuk, enDusuk, ust];
        var tavan = 130;
        var s = frame("Beş kişilik toplum", "Refah");
        for (i = 0; i < 5; i++) {
          var cx = (i + 0.5) / 5, h = Math.min(0.92, pay[i] / tavan);
          s += gRect(cx - 0.07, 0, cx + 0.07, h, { c: "var(--accent)", o: i === 4 ? 0.9 : 0.45 });
          s += gTxt(cx, h, r0(pay[i]) + "", { a: "middle", dy: -5, s: 9, c: "var(--muted)" });
        }
        s += gLine(0, enDusuk / tavan, 1, enDusuk / tavan, { c: "var(--no)", w: 1.6, d: "5 3" });
        s += gTxt(0.01, 1, "toplam refah " + r0(toplam), { a: "start", dy: 2, s: 10, b: 1, c: "var(--ink)" });
        s += gTxt(0.01, 0.9, "en kötü durumdaki " + r0(enDusuk), { a: "start", dy: 2, s: 10, b: 1, c: "var(--no)" });
        return { svg: s, text: "Bu düzeyde toplam refah " + r0(toplam) + ", en kötü durumdakinin payı " + r0(enDusuk) + ". " +
          (e === 0
            ? "Tam eşitlikte toplam en düşük seviyede ama kimse geride kalmıyor: Rawlsçı ölçütün seçtiği nokta burası."
            : e === 100
              ? "Toplam en yüksek noktasında — faydacı ölçüt burayı seçer. Ama en kötü durumdaki kişi başlangıçtakinin çok altında."
              : "Kaydırıcıyı sağa itmek toplamı büyütüyor ve en alttakini aşağı çekiyor. İki ölçüt aynı veriden iki farklı 'doğru' çıkarır; hangisinin geçerli olduğu veriyle çözülemez.") };
      }
    },

    "sera-etkisi": {
      title: "Sera etkisi: tek katmanlı hesap",
      note: "Basitleştirilmiş bir denge modeli: gelen güneş enerjisi ile giden kızılötesi eşitlenir. Gerçek iklim modelleri çok daha karmaşıktır ama büyüklük mertebesi budur.",
      controls: [
        { key: "f", label: "Atmosferin kızılötesi tutma oranı", min: 0, max: 90, step: 1, def: 77, fmt: pctS },
        { key: "a", label: "Yansıtma (albedo)", min: 20, max: 40, step: 1, def: 30, fmt: pctS }
      ],
      draw: function (p) {
        var S = 1361, SIG = 5.67e-8, alb = p.a / 100, i;
        var Ts = function (fr) {
          var Te = Math.pow((S * (1 - alb)) / (4 * SIG), 0.25);
          return Te / Math.pow(1 - fr / 2, 0.25) - 273.15;
        };
        var LO = -40, HI = 40, Y = function (c) { return (c - LO) / (HI - LO); };
        var pts = [];
        for (i = 0; i <= 90; i++) pts.push([i / 90, Math.max(0, Math.min(1, Y(Ts(i / 100))))]);
        var simdi = Ts(p.f / 100), cip = Ts(0);
        var s = frame("Kızılötesi tutma oranı", "Yüzey sıcaklığı");
        s += gLine(0, Y(0), 1, Y(0), { c: "var(--rule)", w: 1.2, d: "3 3" });
        s += gTxt(0.01, Y(0), "0 °C", { a: "start", dy: -4, s: 8.5 });
        s += gLine(0, Y(15), 1, Y(15), { c: "var(--ok)", w: 1.3, d: "5 3" });
        s += gTxt(0.01, Y(15), "bugünkü ortalama", { a: "start", dy: -4, c: "var(--ok)", s: 8.5 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gDot(p.f / 90, Math.max(0, Math.min(1, Y(simdi))), { c: "var(--ink)" });
        s += gTxt(p.f / 90, Math.max(0, Math.min(1, Y(simdi))), r1(simdi) + " °C", {
          a: p.f > 60 ? "end" : "start", dx: p.f > 60 ? -6 : 6, dy: -5, c: "var(--ink)", b: 1, s: 10 });
        [0, 45].forEach(function (v) { s += gTxt(v / 90, 0, "%" + v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: p.f === 0
          ? "Atmosfer kızılötesini hiç tutmasaydı yüzey ortalaması " + r1(cip) + " °C olurdu: okyanuslar donardı. " +
            "Sera etkisi bir arıza değil, hayatın ön koşulu."
          : "Bu tutma oranında yüzey ortalaması " + r1(simdi) + " °C. Atmosfersiz durumla arasındaki " +
            r1(simdi - cip) + " derecelik fark sera etkisidir. Sorun etkinin varlığı değil, sanayi devriminden bu yana " +
            "tutma oranının artırılmış olması." };
      }
    },

    "karbon-butcesi": {
      title: "Kalan karbon bütçesi",
      note: "Sıcaklık artışını belirleyen şey yıllık salım değil, toplam birikimdir. Bu yüzden geç başlayan bir azaltım, aynı hedefe ulaşmak için çok daha dik olmak zorundadır.",
      controls: [{ key: "r", label: "Yıllık azaltım hızı", min: 0, max: 20, step: 1, def: 3, fmt: pctS }],
      draw: function (p) {
        var E0 = 40, B = 250, r = p.r / 100, N = 40, i;   // Gt CO₂/yıl, kalan bütçe Gt
        var kum = function (t) { return r === 0 ? E0 * t : (E0 * (1 - Math.pow(1 - r, t))) / r; };
        var TOP = 500, pts = [];
        for (i = 0; i <= N; i++) pts.push([i / N, Math.min(1, kum(i) / TOP)]);
        var tukenis = r === 0 ? B / E0
          : (1 - (B * r) / E0 <= 0 ? Infinity : Math.log(1 - (B * r) / E0) / Math.log(1 - r));
        var s = frame("Yıl (bugünden itibaren)", "Toplam salım (Gt CO₂)");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(0, B / TOP, 1, B / TOP, { c: "var(--no)", w: 1.6, d: "5 3" });
        s += gTxt(0.01, B / TOP, "1,5 °C bütçesi", { a: "start", dy: -5, c: "var(--no)", s: 9, b: 1 });
        if (isFinite(tukenis) && tukenis <= N) {
          s += gLine(tukenis / N, 0, tukenis / N, B / TOP, { c: "var(--ink)", w: 1.4, d: "2 3" });
          s += gDot(tukenis / N, B / TOP, { c: "var(--ink)" });
        }
        [10, 20, 30].forEach(function (v) { s += gTxt(v / N, 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: !isFinite(tukenis)
          ? "Yılda %" + p.r + " azaltımla toplam salım " + r0(E0 / r) + " Gt'ta duruyor ve bütçe hiç tükenmiyor. " +
            "Bu hızın bugüne kadar hiçbir büyük ekonomide sürdürülebilmiş olmadığını da eklemek gerekir."
          : tukenis > N
            ? "Yılda %" + p.r + " azaltımla bütçe kırk yılı aşan bir sürede tükeniyor."
            : (p.r === 0
                ? "Salım bugünkü düzeyde kalırsa kalan bütçe yaklaşık " + r1(tukenis) + " yılda biter."
                : "Yılda %" + p.r + " azaltımla bütçe yaklaşık " + r1(tukenis) + " yılda tükeniyor. " +
                  "Eğri düzleşiyor ama alan büyümeye devam ediyor: önemli olan eğrinin yüksekliği değil altında kalan alan.") };
      }
    },

    "elektrik-kaynaklari": {
      title: "Elektrik kaynakları: iki ölçüt",
      note: "Değerler yaşam döngüsü çalışmalarının yaygın olarak kullanılan ortanca tahminleridir; ülkeye, teknolojiye ve kuruluma göre belirgin biçimde değişir.",
      controls: [{ key: "o", type: "choice", label: "Ölçüt", def: "karbon",
        options: [["karbon", "gCO₂/kWh"], ["olum", "Ölüm / TWh"]] }],
      draw: function (p) {
        var K = [
          ["Kömür", 820, 24.6], ["Doğal gaz", 490, 2.8], ["Biyokütle", 230, 4.6],
          ["Güneş", 45, 0.02], ["Hidro", 24, 1.3], ["Nükleer", 12, 0.03], ["Rüzgâr", 11, 0.04]
        ];
        var karbon = p.o === "karbon", i;
        var en = karbon ? 820 : 24.6;
        var s = "";
        for (i = 0; i < K.length; i++) {
          var v = karbon ? K[i][1] : K[i][2], y = 0.94 - i * 0.135;
          s += gRect(0.30, y - 0.052, 0.30 + 0.68 * (v / en), y + 0.052,
            { c: i < 3 ? "var(--no)" : "var(--ok)", o: 0.8, r: 2 });
          s += gTxt(0.28, y, K[i][0], { a: "end", dy: 3.5, s: 9 });
          s += gTxt(0.32 + 0.68 * (v / en), y, karbon ? r0(v) + "" : (v < 1 ? v.toFixed(2) : r1(v)),
            { a: "start", dy: 3.5, s: 9, b: 1, c: "var(--muted)" });
        }
        return { svg: s, text: karbon
          ? "Yaşam döngüsü boyunca üretilen sera gazı, kilovatsaat başına gram cinsinden. Kömür ile rüzgâr arasında yaklaşık " +
            r0(820 / 11) + " kat fark var. Güneş ve rüzgârın değeri sıfır değildir: panel, türbin ve kurulum da salım üretir."
          : "Terawattsaat başına düşen ölüm — kaza, kirlilik ve madencilik dahil. Kömürün payının büyük kısmı hava kirliliğinden " +
            "gelir ve kazalardan çok daha fazladır. Nükleerin sayısı, büyük kazalar hesaba katıldığında bile en düşükler arasında." };
      }
    },

    "elektrikli-arac": {
      title: "Elektrikli araç şebekeye bağlı",
      note: "Üretim salımı ömür boyu kilometreye yayılmıştır; elektrikli araçta pil yüzünden bu pay daha yüksektir. Bu yüzden karşılaştırma egzozla değil, baştan sona yapılmalıdır.",
      controls: [
        { key: "g", label: "Şebekenin karbon yoğunluğu", min: 0, max: 900, step: 50, def: 400,
          fmt: function (v) { return v + " g/kWh"; } },
        { key: "t", label: "Benzinlinin tüketimi", min: 4, max: 10, step: 1, def: 7,
          fmt: function (v) { return v + " L/100km"; } }
      ],
      draw: function (p) {
        var G = 900, i;
        var benzin = 30 * p.t + 30;                       // yakıt + üretim, g CO₂/km
        var elek = function (g) { return 0.18 * g + 55; };
        var TOP = 400, Y = function (v) { return Math.min(1, v / TOP); };
        var pts = [];
        for (i = 0; i <= 60; i++) { var g = (G * i) / 60; pts.push([i / 60, Y(elek(g))]); }
        var esit = (benzin - 55) / 0.18;
        var s = frame("Şebeke karbon yoğunluğu", "g CO₂ / km");
        s += gLine(0, Y(benzin), 1, Y(benzin), { c: "var(--no)", w: 2.2 });
        s += gTxt(0.99, Y(benzin), "benzinli " + r0(benzin), { a: "end", dy: -5, c: "var(--no)", b: 1, s: 9 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        if (esit > 0 && esit < G) {
          s += gLine(esit / G, 0, esit / G, Y(benzin), { c: "var(--rule)", w: 1.2, d: "2 3" });
          s += gTxt(esit / G, 0, "başa baş", { a: "middle", dy: 12, s: 8.5, c: "var(--muted)" });
        }
        s += gDot(p.g / G, Y(elek(p.g)), { c: "var(--ink)" });
        s += gTxt(p.g / G, Y(elek(p.g)), "elektrikli " + r0(elek(p.g)), {
          a: p.g > 500 ? "end" : "start", dx: p.g > 500 ? -6 : 6, dy: 12, c: "var(--ink)", b: 1, s: 9 });
        s += gTxt(300 / G, 0, "300", { a: "middle", dy: 12, s: 9 });
        return { svg: s, text: "Şebeke " + p.g + " g/kWh iken elektrikli araç kilometre başına " + r0(elek(p.g)) +
          " g, benzinli " + r0(benzin) + " g CO₂ üretiyor. " + (esit <= 0
            ? "Bu tüketimdeki bir benzinli, en kirli şebekede bile elektrikliyi geçemez."
            : esit >= G
              ? "Başa baş noktası ölçeğin dışında: bu tüketimle elektrikli araç her şebekede önde."
              : "Başa baş noktası " + r0(esit) + " g/kWh. Şebeke bundan temizse elektrikli, kirliyse benzinli öne geçer — " +
                "ve şebekeler zamanla temizlendiği için aracın ömrü boyunca fark elektrikli lehine açılır.") };
      }
    },

    "geri-besleme": {
      title: "Geri besleme neden belirsizliği büyütür",
      note: "İklim duyarlılığının üst kuyruğunun uzun olmasının sebebi budur: geri besleme kazancındaki simetrik bir belirsizlik, sıcaklıkta simetrik olmayan bir belirsizliğe dönüşür.",
      controls: [{ key: "f", label: "Geri besleme kazancı", min: 0, max: 85, step: 5, def: 60,
        fmt: function (v) { return (v / 100).toFixed(2); } }],
      draw: function (p) {
        var T0 = 1.2, TOP = 10, i;                        // geri beslemesiz doğrudan etki, °C
        var dT = function (f) { return T0 / (1 - f); };
        var pts = [];
        for (i = 0; i <= 85; i++) pts.push([i / 85, Math.min(1, dT(i / 100) / TOP)]);
        var band = [], band2 = [];
        for (i = 52; i <= 70; i++) {
          band.push([i / 85, Math.min(1, dT(i / 100) / TOP)]);
          band2.push([i / 85, 0]);
        }
        var here = dT(p.f / 100);
        var s = frame("Geri besleme kazancı", "CO₂ iki katına çıkarsa ısınma");
        s += gArea(band.concat(band2.slice().reverse()), { c: "var(--accent)", o: 0.14 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(0, T0 / TOP, 1, T0 / TOP, { c: "var(--rule)", w: 1.2, d: "3 3" });
        s += gTxt(0.01, T0 / TOP, "geri besleme yok: 1,2 °C", { a: "start", dy: -4, s: 8.5 });
        s += gDot(p.f / 85, Math.min(1, here / TOP), { c: "var(--ink)" });
        s += gTxt(p.f / 85, Math.min(1, here / TOP), r1(here) + " °C", {
          a: p.f > 55 ? "end" : "start", dx: p.f > 55 ? -6 : 6, dy: -5, c: "var(--ink)", b: 1, s: 10 });
        [0.25, 0.5, 0.75].forEach(function (v) { s += gTxt(v * 100 / 85, 0, v.toFixed(2), { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Kazanç " + (p.f / 100).toFixed(2) + " iken ısınma " + r1(here) + " °C. " +
          "Gölgeli bant, bugünkü kanıtların işaret ettiği aralık. Kazanç 0,50'den 0,60'a çıkarsa ısınma " +
          r1(dT(0.5)) + " °C'den " + r1(dT(0.6)) + " °C'ye; 0,70'ten 0,80'e çıkarsa " + r1(dT(0.7)) + " °C'den " +
          r1(dT(0.8)) + " °C'ye gider. Aynı büyüklükteki belirsizlik, üst uçta çok daha pahalıya mal olur." };
      }
    },

    "mesafe-olcekleri": {
      title: "Bir'den evrene: mesafe ölçekleri",
      note: "Eksen logaritmiktir: her adım on katıdır. Ölçeği doğrusal düşünmek, gök cisimleri arasındaki mesafeler hakkındaki sezgimizi tümüyle yanıltır.",
      controls: [{ key: "k", label: "Mesafe", min: 0, max: 27, step: 1, def: 11,
        fmt: function (v) { return "10^" + v + " m"; } }],
      draw: function (p) {
        var O = [
          [0, "insan boyu"], [3, "bir kilometre"], [7.1, "Dünya çapı"], [8.58, "Ay"],
          [11.18, "Güneş"], [12.65, "Neptün"], [16.6, "en yakın yıldız"],
          [20.4, "galaksi merkezi"], [22.4, "Andromeda"], [26.6, "gözlenebilir evren"]
        ];
        var X = function (k) { return k / 27; }, i;
        var yakin = 0;
        for (i = 1; i < O.length; i++) {
          if (Math.abs(O[i][0] - p.k) < Math.abs(O[yakin][0] - p.k)) yakin = i;
        }
        var s = gLine(0, 0.42, 1, 0.42, { c: "var(--rule)", w: 1.6 });
        for (i = 0; i < O.length; i++) {
          var on = i === yakin;
          s += gLine(X(O[i][0]), 0.42, X(O[i][0]), on ? 0.56 : 0.49,
            { c: on ? "var(--accent)" : "var(--rule)", w: on ? 1.8 : 1.2 });
          s += gDot(X(O[i][0]), 0.42, { c: on ? "var(--accent)" : "var(--rule)", r: on ? 4 : 2.5 });
        }
        s += gTxt(X(O[yakin][0]), 0.56, O[yakin][1], {
          a: O[yakin][0] > 20 ? "end" : "start", dx: O[yakin][0] > 20 ? 4 : -4, dy: -4,
          c: "var(--accent)", b: 1, s: 9.5 });
        [0, 9, 18, 27].forEach(function (v) {
          s += gTxt(X(v), 0.42, "10^" + v, { a: "middle", dy: 14, s: 8.5 });
        });
        s += gLine(X(p.k), 0.16, X(p.k), 0.42, { c: "var(--ink)", w: 1.8, d: "3 3" });
        s += gDot(X(p.k), 0.42, { c: "var(--ink)", r: 4.5 });

        var m = Math.pow(10, p.k), sn = m / 2.998e8;
        var uzunluk = m < 1e4 ? r0(m) + " metre"
          : m < 1e10 ? r0(m / 1e3) + " kilometre"
            : m < 1e16 ? r1(m / 1.496e11) + " astronomi birimi"
              : m < 1e22 ? r1(m / 9.461e15) + " ışık yılı"
                : r0(m / 9.461e15 / 1e6) + " milyon ışık yılı";
        var sure = sn < 1 ? r1(sn * 1000) + " milisaniye"
          : sn < 90 ? r1(sn) + " saniye"
            : sn < 5400 ? r1(sn / 60) + " dakika"
              : sn < 8.64e4 ? r1(sn / 3600) + " saat"
                : sn < 3.15e7 ? r1(sn / 8.64e4) + " gün"
                  : sn < 3.15e13 ? r0(sn / 3.15e7) + " yıl"
                    : r1(sn / 3.15e7 / 1e9) + " milyar yıl";
        return { svg: s, text: uzunluk + ". Işık bu mesafeyi " + sure + " içinde alır. " +
          "En yakın kilometre taşı: " + O[yakin][1] + ". Bir adım sağa gitmek mesafeyi on katına çıkarır — " +
          "bu yüzden gökyüzü haritaları doğrusal çizilemez." };
      }
    },

    "paralaks": {
      title: "Paralaks: uzaklığı üçgenle ölçmek",
      note: "Dünya yörüngesinin iki ucundan bakınca yakın bir yıldız arka plana göre kayar. Kayma açısı uzaklıkla ters orantılıdır ve çok hızlı küçülür.",
      controls: [{ key: "d", label: "Yıldızın uzaklığı", min: 1, max: 100, step: 1, def: 10,
        fmt: function (v) { return v + " parsek"; } }],
      draw: function (p) {
        var i, pts = [];
        for (i = 1; i <= 100; i++) pts.push([(i - 1) / 99, 1 / i]);
        var here = 1 / p.d;
        var s = frame("Uzaklık (parsek)", "Paralaks açısı (yay saniyesi)");
        s += gArea(pts.concat([[1, 0], [0, 0]]), { c: "var(--accent)", o: 0.10 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.4 });
        s += gLine(0, 0.01, 1, 0.01, { c: "var(--no)", w: 1.4, d: "4 3" });
        s += gTxt(0.99, 0.01, "yerden gözlem sınırı ≈ 0,01″", { a: "end", dy: -5, c: "var(--no)", s: 8.5 });
        s += gLine((p.d - 1) / 99, 0, (p.d - 1) / 99, here, { c: "var(--rule)", w: 1.1, d: "2 3" });
        s += gDot((p.d - 1) / 99, here, { c: "var(--ink)" });
        s += gTxt((p.d - 1) / 99, here, here.toFixed(3) + "″", {
          a: p.d > 60 ? "end" : "start", dx: p.d > 60 ? -6 : 6, dy: -5, c: "var(--ink)", b: 1, s: 10 });
        [25, 50, 75].forEach(function (v) { s += gTxt((v - 1) / 99, 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: p.d + " parsek (" + r1(p.d * 3.26) + " ışık yılı) uzaklıktaki bir yıldızın paralaksı " +
          here.toFixed(3) + " yay saniyesi. Bu açı, " + r0(206265 / (here * 1000) / 1000) +
          " kilometre öteden bir metrelik bir cismi görmeye karşılık gelir. Yerden yapılan gözlemin sınırı " +
          "yaklaşık 0,01 yay saniyesidir; uzaydan ölçüm bunu binlerce kat aşarak galaksinin büyük kısmını ölçülebilir kıldı." };
      }
    },

    "hr-diyagrami": {
      title: "Hertzsprung-Russell diyagramı",
      note: "Yıldızlar bu düzlemde rastgele dağılmaz. Anakol üzerindeki yeri belirleyen tek şey kütledir — ve kütle aynı zamanda ömrü belirler.",
      controls: [{ key: "m", label: "Yıldızın kütlesi", min: 10, max: 3000, step: 10, def: 100,
        fmt: function (v) { return (v / 100).toFixed(1) + " Güneş"; } }],
      draw: function (p) {
        var M = p.m / 100, i;
        var XT = function (T) { return (4.7 - Math.log(T) / Math.LN10) / (4.7 - 3.4); };
        var YL = function (L) { return (Math.log(L) / Math.LN10 + 4.5) / (6 + 4.5); };
        var pts = [];
        for (i = 0; i <= 60; i++) {
          var mm = Math.exp(Math.log(0.1) + (Math.log(30) - Math.log(0.1)) * (i / 60));
          var a = anakol(mm);
          pts.push([XT(a.T), YL(a.L)]);
        }
        var s = frame("← sıcak · soğuk →", "Parlaklık");
        s += gRect(XT(5500), YL(10), XT(3000), YL(5000), { c: "var(--no)", o: 0.12, r: 3 });
        s += gTxt(XT(4000), YL(600), "devler", { a: "middle", dy: 3, s: 9, c: "var(--no)" });
        s += gRect(XT(25000), YL(0.0008), XT(9000), YL(0.04), { c: "var(--makro)", o: 0.14, r: 3 });
        s += gTxt(XT(15000), YL(0.006), "beyaz cüceler", { a: "middle", dy: 3, s: 8.5, c: "var(--muted)" });
        s += gPoly(pts, { c: "var(--accent)", w: 3 });
        s += gTxt(XT(9000), YL(30), "anakol", { a: "start", dx: 4, dy: -4, s: 9, b: 1, c: "var(--accent)" });
        var here = anakol(M);
        s += gDot(XT(here.T), YL(here.L), { c: "var(--ink)", r: 4.5 });
        var omur = (1e10 * M) / here.L;
        return { svg: s, text: (M).toFixed(1) + " Güneş kütlesindeki bir yıldızın yüzey sıcaklığı yaklaşık " +
          r0(here.T) + " K, parlaklığı Güneş'in " + (here.L < 1 ? here.L.toFixed(3) : r0(here.L)) + " katı. " +
          "Anakoldaki ömrü kabaca " + (omur > 1e10 ? r0(omur / 1e9) + " milyar yıl — evrenin yaşından uzun, yani hiçbiri henüz ölmedi."
            : omur > 1e8 ? r1(omur / 1e9) + " milyar yıl."
              : r0(omur / 1e6) + " milyon yıl. Ağır yıldızlar yakıtı çok daha hızlı tüketir: dört kat kütle, yüz kat kısa ömür.") };
      }
    },

    "kirmiziya-kayma": {
      title: "Kırmızıya kayma",
      note: "Çizgiler kaymaz, aradaki uzay genişler. Işık yolda olduğu sürece dalga boyu evrenle birlikte esner; z bu esnemenin ölçüsüdür.",
      controls: [{ key: "z", label: "Kırmızıya kayma", min: 0, max: 500, step: 10, def: 100,
        fmt: function (v) { return "z = " + (v / 100).toFixed(1); } }],
      draw: function (p) {
        var z = p.z / 100, LO = Math.log(300), HI = Math.log(4500), i;
        // Logaritmik dalga boyu ekseni: doğrusal eksende dört çizgi üst üste biniyordu.
        var X = function (nm) { return (Math.log(nm) - LO) / (HI - LO); };
        var CIZGI = [[393, "Ca"], [434, "Hγ"], [486, "Hβ"], [656, "Hα"]];
        var s = "";
        [0.62, 0.18].forEach(function (y0, band) {
          s += gRect(0, y0, 1, y0 + 0.2, { c: "var(--rule)", o: 0.35, r: 2 });
          s += gRect(X(380), y0, X(750), y0 + 0.2, { c: "var(--accent)", o: 0.22, r: 0 });
          CIZGI.forEach(function (c) {
            var nm = band === 0 ? c[0] : c[0] * (1 + z);
            if (nm > 4500) return;
            s += gLine(X(nm), y0 + 0.01, X(nm), y0 + 0.19, { c: "var(--ink)", w: 1.8 });
            if (band === 0 && (c[0] === 393 || c[0] === 656)) {
              s += gTxt(X(nm), y0 + 0.2, c[1], { a: "middle", dy: -3, s: 8.5, c: "var(--muted)" });
            }
          });
        });
        s += gTxt(1, 0.86, "laboratuvarda", { a: "end", s: 9, b: 1, c: "var(--muted)" });
        s += gTxt(1, 0.42, "gözlenen", { a: "end", s: 9, b: 1, c: "var(--ink)" });
        s += gTxt(X(530), 0.06, "görünür", { a: "middle", s: 8.5, c: "var(--accent)" });
        [1000, 2000, 4000].forEach(function (nm) {
          s += gTxt(X(nm), 0.06, (nm / 1000) + " µm", { a: "middle", s: 8, c: "var(--muted)" });
        });
        var ha = 656 * (1 + z);
        return { svg: s, text: z === 0
          ? "Kayma yokken gözlenen tayf laboratuvardakiyle aynı: kaynak bize göre durgun."
          : "z = " + z.toFixed(1) + " demek, ışık yola çıktığında evrenin bugünkünün " +
            (1 / (1 + z)).toFixed(2) + " katı büyüklüğünde olduğu anlamına gelir. Hα çizgisi 656 nm'den " +
            r0(ha) + " nm'ye kaymış" + (ha > 750 ? " — artık gözle görünmez, kızılötesinde." : ".") +
            " Uzak galaksileri kızılötesi teleskoplarla aramanın sebebi bu." };
      }
    },

    "yasanabilir-kusak": {
      title: "Yaşanabilir kuşak yıldıza göre kayar",
      note: "Kuşak, suyun sıvı kalabileceği uzaklık aralığının kaba bir tahminidir. Atmosfer, manyetik alan ve gelgit etkileri hesaba katılmaz.",
      controls: [{ key: "m", label: "Yıldızın kütlesi", min: 10, max: 200, step: 5, def: 100,
        fmt: function (v) { return (v / 100).toFixed(2) + " Güneş"; } }],
      draw: function (p) {
        var M = p.m / 100, L = anakol(M).L;
        var ic = 0.95 * Math.sqrt(L), dis = 1.37 * Math.sqrt(L);
        var LO = -2.3, HI = 1.0;                          // log10 AU
        var X = function (au) { return Math.max(0, Math.min(1, (Math.log(au) / Math.LN10 - LO) / (HI - LO))); };
        var s = gLine(0, 0.34, 1, 0.34, { c: "var(--rule)", w: 1.4 });
        s += gRect(X(ic), 0.24, X(dis), 0.44, { c: "var(--ok)", o: 0.55, r: 2 });
        s += gTxt((X(ic) + X(dis)) / 2, 0.44, "yaşanabilir kuşak", { a: "middle", dy: -5, s: 9, b: 1, c: "var(--ok)" });
        s += gDot(0, 0.34, { c: "var(--accent)", r: 6 });
        s += gTxt(0, 0.34, "yıldız", { a: "start", dy: 14, s: 8.5, c: "var(--accent)" });
        s += gLine(X(1), 0.2, X(1), 0.48, { c: "var(--ink)", w: 1.6, d: "3 3" });
        s += gTxt(X(1), 0.48, "Dünya (1 ab)", { a: "middle", dy: -5, s: 8.5, b: 1, c: "var(--ink)" });
        [0.01, 0.1, 1, 10].forEach(function (au) {
          s += gTxt(X(au), 0.24, au < 1 ? au + "" : au + " ab", { a: "middle", dy: 13, s: 8.5, c: "var(--muted)" });
        });
        var orta = Math.sqrt(ic * dis), per = Math.sqrt((orta * orta * orta) / M) * 365;
        return { svg: s, text: (M).toFixed(2) + " Güneş kütlesindeki bir yıldızın parlaklığı Güneş'in " +
          (L < 1 ? L.toFixed(3) : r1(L)) + " katı; yaşanabilir kuşak " + ic.toFixed(3) + " ile " + dis.toFixed(3) +
          " astronomi birimi arasında. Kuşağın ortasındaki bir gezegenin yılı " +
          (per < 400 ? r0(per) + " gün" : r1(per / 365) + " yıl") + " sürer. " + (M < 0.5
            ? "Yıldıza bu kadar yakın bir gezegen büyük olasılıkla gelgit kilitlidir: bir yüzü daima gündüz, diğeri daima gece."
            : "Kuşak yıldızdan uzaklaştıkça gezegen bulmak zorlaşır; geçiş yöntemi yakın yörüngeleri çok daha kolay yakalar.") };
      }
    },

    "secme-penceresi": {
      title: "Aynı veri, seçilmiş pencere",
      note: "Veri tek bir seri; değişen yalnızca hangi aralığın gösterildiği. Bir zaman serisinde başlangıç ve bitiş tarihi bir veri değil, bir argümandır.",
      controls: [
        { key: "b", label: "Başlangıç yılı", min: 0, max: 24, step: 1, def: 14,
          fmt: function (v) { return (1995 + v) + ""; } },
        { key: "u", label: "Pencere uzunluğu", min: 5, max: 30, step: 1, def: 6,
          fmt: function (v) { return v + " yıl"; } }
      ],
      draw: function (p) {
        var N = 30, i;
        var seri = function (i2) { return 50 + 1.6 * i2 + 9 * Math.sin(i2 * 0.9) + 5 * Math.sin(i2 * 2.1 + 1); };
        var b = p.b, u = Math.min(p.u, N - b);
        var lo = 20, hi = 120, Y = function (v) { return (v - lo) / (hi - lo); };
        var pts = [];
        for (i = 0; i < N; i++) pts.push([i / (N - 1), Y(seri(i))]);
        /* Pencere içindeki en küçük kareler eğimi */
        var n = u, sx = 0, sy = 0, sxy = 0, sxx = 0;
        for (i = b; i < b + u; i++) { sx += i; sy += seri(i); sxy += i * seri(i); sxx += i * i; }
        var egim = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        var kesme = (sy - egim * sx) / n;

        var s = frame("Yıl", "Ölçülen değer");
        s += gRect(b / (N - 1), 0, (b + u - 1) / (N - 1), 1, { c: "var(--accent)", o: 0.10, r: 0 });
        s += gPoly(pts, { c: "var(--rule)", w: 1.8 });
        s += gPoly(pts.slice(b, b + u), { c: "var(--accent)", w: 2.6 });
        s += gLine(b / (N - 1), Y(egim * b + kesme), (b + u - 1) / (N - 1), Y(egim * (b + u - 1) + kesme),
          { c: egim >= 0 ? "var(--ok)" : "var(--no)", w: 2.2, d: "5 3" });
        [0, 10, 20].forEach(function (v) { s += gTxt(v / (N - 1), 0, (1995 + v) + "", { a: "middle", dy: 12, s: 9 }); });
        var tum = (seri(N - 1) - seri(0)) / (N - 1);
        return { svg: s, text: (1995 + b) + "-" + (1995 + b + u - 1) + " penceresinde eğilim yılda " +
          (egim >= 0 ? "+" : "") + r1(egim) + ". Bütün seride ise yılda " + (tum >= 0 ? "+" : "") + r1(tum) + ". " +
          (egim * tum < 0
            ? "İki eğilim zıt yönde: aynı veriden birbirini çürüten iki manşet çıkarılabilir."
            : "Bu pencerede yön genel eğilimle aynı — ama pencereyi kaydırınca ters çevirmek çoğu zaman mümkün.") };
      }
    },

    "yalan-ve-duzeltme": {
      title: "Düzeltme neden yetişemez",
      note: "Şematik bir yayılma modeli; ölçülmüş veri değildir. Amaç, gecikmenin ve erişim farkının birlikte nasıl kalıcı bir açık bıraktığını göstermek.",
      controls: [
        { key: "g", label: "Düzeltmenin gecikmesi", min: 0, max: 20, step: 1, def: 6,
          fmt: function (v) { return v + " gün"; } },
        { key: "h", label: "Düzeltmenin erişim gücü", min: 10, max: 100, step: 10, def: 40,
          fmt: function (v) { return "haberin %" + v + "'i"; } }
      ],
      draw: function (p) {
        var T = 30, h = p.h / 100, i;
        var yalan = function (t) { return 1 / (1 + Math.exp(-0.55 * (t - 8))); };
        var duz = function (t) { return h / (1 + Math.exp(-0.55 * (t - 8 - p.g))); };
        var A = [], B = [];
        for (i = 0; i <= 60; i++) {
          var t = (T * i) / 60;
          A.push([i / 60, yalan(t)]);
          B.push([i / 60, duz(t)]);
        }
        var s = frame("Gün", "Ulaşılan kitle");
        s += gArea(A.concat(B.slice().reverse()), { c: "var(--no)", o: 0.16 });
        s += gPoly(A, { c: "var(--no)", w: 2.4 });
        s += gPoly(B, { c: "var(--ok)", w: 2.4 });
        s += gTxt(0.99, yalan(T), "haber", { a: "end", dy: -5, c: "var(--no)", b: 1, s: 9 });
        s += gTxt(0.99, duz(T), "düzeltme", { a: "end", dy: 12, c: "var(--ok)", b: 1, s: 9 });
        [10, 20].forEach(function (v) { s += gTxt(v / T, 0, v + "", { a: "middle", dy: 12, s: 9 }); });
        var son = duz(T) / yalan(T);
        return { svg: s, text: "Otuz günün sonunda haberi görenlerin %" + r0(son * 100) +
          "'i düzeltmeyi de görmüş. Kalan %" + r0((1 - son) * 100) + " için ilk anlatı hâlâ tek bilgi. " +
          (p.g === 0
            ? "Düzeltme aynı gün çıksa bile erişim farkı açığı kapatmıyor."
            : "Gecikmeyi sıfırlamak açığı küçültür ama kapatmaz: asıl belirleyici olan erişim gücü.") +
          " Kırmızı alan, yalnızca ilk anlatıyı görmüş kitleyi gösteriyor." };
      }
    },

    "yanki-odasi": {
      title: "Benzerini göstermek görüşü nasıl kutuplaştırır",
      note: "Şematik bir model: her adımda kişi kendi konumuna yakın içerikle karşılaşırsa o yöne biraz daha kayıyor. Gerçek platformlar çok daha karmaşıktır ama mekanizma bu.",
      controls: [{ key: "h", label: "Öneri sisteminin benzerlik tercihi", min: 0, max: 100, step: 10, def: 50, fmt: pctS }],
      draw: function (p) {
        var K = 41, ADIM = 40, hh = p.h / 100, i, t;
        var x = [];
        for (i = 0; i < K; i++) x.push(-1 + (2 * i) / (K - 1));
        for (t = 0; t < ADIM; t++) {
          for (i = 0; i < K; i++) {
            var v = x[i] + 0.12 * hh * x[i] * (1 - x[i] * x[i]) * 4;
            x[i] = Math.max(-1, Math.min(1, v));
          }
        }
        var KOVA = 21, kova = [];
        for (i = 0; i < KOVA; i++) kova.push(0);
        for (i = 0; i < K; i++) {
          var j = Math.min(KOVA - 1, Math.max(0, Math.round(((x[i] + 1) / 2) * (KOVA - 1))));
          kova[j] += 1;
        }
        var en = Math.max.apply(null, kova);
        var s = frame("", "Kişi sayısı");
        for (i = 0; i < KOVA; i++) {
          if (!kova[i]) continue;
          var cx = i / (KOVA - 1);
          s += gRect(cx - 0.019, 0, cx + 0.019, kova[i] / en, { c: "var(--accent)", o: 0.8 });
        }
        s += gLine(0.5, 0, 0.5, 1, { c: "var(--rule)", w: 1.2, d: "3 3" });
        s += gTxt(0.02, 0, "◀ bir uç", { a: "start", dy: 13, s: 8.5 });
        s += gTxt(0.5, 0, "görüş konumu", { a: "middle", dy: 13, s: 8.5 });
        s += gTxt(0.98, 0, "öbür uç ▶", { a: "end", dy: 13, s: 8.5 });
        var uc = kova[0] + kova[1] + kova[KOVA - 1] + kova[KOVA - 2];
        var orta = kova[9] + kova[10] + kova[11];
        return { svg: s, text: p.h === 0
          ? "Benzerlik tercihi yokken dağılım başladığı gibi kalıyor: her görüş konumunda insan var, orta doldurulmuş durumda."
          : "Bu ayarda kırk bir kişiden " + uc + " tanesi uçlarda, " + orta + " tanesi ortada. " +
            "Kimsenin fikri zorla değiştirilmedi; herkese yalnızca kendine benzeyen içerik gösterildi. " +
            "Kutuplaşmayı üreten şey içeriğin kendisi değil, dağıtım kuralı." };
      }
    },

    /* ---- mimarlık ---- */

    "kiris-acikligi": {
      title: "Bir kiriş kendi ağırlığıyla ne kadar açıklık geçer",
      note: "Yalnızca kirişin kendi ağırlığı hesaba katıldı; gerçek yapıda üstüne gelen yük ve sehim sınırı açıklıkları çok daha aşağı çeker. Öğretici olan mutlak sayılar değil, malzemeler arasındaki oran.",
      controls: [
        { key: "m", type: "choice", label: "Malzeme", def: "tas", options: [
          ["tas", "Taş"], ["ahsap", "Ahşap"], ["beton", "Betonarme"], ["celik", "Çelik"]] },
        { key: "d", label: "Kiriş yüksekliği", min: 2, max: 20, step: 1, def: 6,
          fmt: function (v) { return (v / 10).toFixed(1) + " m"; } }
      ],
      draw: function (p) {
        /* Basit kirişte kendi ağırlığından doğan eğilme: σ = 0,75·ρ·g·L²/d.
           Buradan L = √(σ·d / (0,75·ρ·g)). σ değerleri emniyetli çekme
           gerilmeleridir; taşın çekmeye dayanıksızlığı bütün hikâyeyi kurar. */
        var MAL = {
          tas: ["Taş", 1.0e6, 2400, "var(--no)"],
          ahsap: ["Ahşap", 8.0e6, 700, "var(--ok)"],
          beton: ["Betonarme", 12.0e6, 2500, "var(--muted)"],
          celik: ["Çelik", 160e6, 7850, "var(--accent)"]
        };
        var SIRA = ["tas", "beton", "ahsap", "celik"], TOP = 80, D0 = 0.2, D1 = 2.0, i, k;
        var L = function (key, d) {
          var m = MAL[key];
          return Math.sqrt((m[1] * d) / (0.75 * m[2] * 9.81));
        };
        var X = function (d) { return (d - D0) / (D1 - D0); };
        var s = frame("Kiriş yüksekliği", "En büyük açıklık");
        for (k = 0; k < SIRA.length; k++) {
          var key = SIRA[k], pts = [];
          for (i = 0; i <= 40; i++) {
            var d = D0 + ((D1 - D0) * i) / 40;
            pts.push([X(d), Math.min(1, L(key, d) / TOP)]);
          }
          var secili = key === p.m;
          s += gPoly(pts, { c: MAL[key][3], w: secili ? 2.6 : 1.2, d: secili ? "" : "3 3" });
          s += gTxt(1, Math.min(1, L(key, D1) / TOP), MAL[key][0],
            { a: "end", dy: -5, c: MAL[key][3], b: secili ? 1 : 0, s: 9 });
        }
        var dd = p.d / 10, LL = L(p.m, dd), yy = Math.min(1, LL / TOP);
        s += gDot(X(dd), yy, { c: "var(--ink)" });
        s += gTxt(X(dd), yy, r1(LL) + " m", {
          a: p.d > 13 ? "end" : "start", dx: p.d > 13 ? -7 : 7, dy: yy > 0.9 ? 12 : -6,
          c: "var(--ink)", b: 1, s: 10 });
        [20, 40, 60].forEach(function (v) {
          s += gLine(0, v / TOP, 1, v / TOP, { c: "var(--rule)", w: 1, d: "2 4" });
          s += gTxt(0.01, v / TOP, v + " m", { a: "start", dy: -4, s: 8.5 });
        });
        [0.5, 1.0].forEach(function (v) { s += gTxt(X(v), 0, r1(v) + " m", { a: "middle", dy: 12, s: 9 }); });
        var tas = L("tas", dd);
        return { svg: s, text: r1(dd) + " metre yüksekliğinde bir " + MAL[p.m][0].toLowerCase() +
          " kiriş kendi ağırlığıyla en çok " + r1(LL) + " metre açıklık geçebilir" +
          (p.m === "tas"
            ? ". Antik tapınakların sütun aralığının dört beş metreyi geçmemesinin sebebi budur: taş basınca çok, çekmeye çok az dayanır ve kirişin altı çekmeye çalışır. Kemer tam olarak bu sınırı aşmak için icat edildi."
            : "; aynı yükseklikte taş ancak " + r1(tas) + " metre geçerdi, yani " +
              r1(LL / tas) + " kat daha az. Malzeme değişince açıklık değişir, açıklık değişince mimarlığın söyleyebilecekleri değişir.") };
      }
    },

    "kemer-itmesi": {
      title: "Kemer yüksekliği ve yatay itme",
      note: "Yatay itme, düşey yükün yaklaşık 1/(8·yükseklik oranı) katı alınarak hesaplandı; ayak genişliği devrilme dengesinden çıkarıldı. Basitleştirilmiş bir modeldir, mertebeler doğrudur.",
      controls: [
        { key: "y", label: "Kemer yüksekliği (açıklığın oranı)", min: 25, max: 85, step: 1, def: 50, fmt: pctS },
        { key: "w", label: "Kemerin üstündeki duvar yükü", min: 0, max: 100, step: 5, def: 20, fmt: pctS }
      ],
      draw: function (p) {
        var f = p.y / 100;
        var W = 0.12 + (0.13 * p.w) / 100;          // düşey yük (birim yoğunluk, açıklık = 1)
        var H = W / (8 * f);                        // yatay itme
        var b = Math.sqrt(2 * H);                   // gereken ayak genişliği (açıklığın oranı)
        var SP = 0.48, EX = 0.5 - SP / 2, SY = 0.798;  // çizim ölçeği: 1 açıklık = 0.48 birim x
        var TAB = 0.04, OMUZ = TAB + 0.24 * SY;     // taban ve omuz (kemer başlangıcı) yüksekliği
        var X = function (u) { return EX + u * SP; };
        var Y = function (h) { return OMUZ + h * SY; };
        var egri = [], i, u, h;
        if (f <= 0.5) {
          var R = (f * f + 0.25) / (2 * f), cy = f - R;
          for (i = 0; i <= 60; i++) {
            u = i / 60;
            egri.push([X(u), Y(Math.sqrt(Math.max(0, R * R - (u - 0.5) * (u - 0.5))) + cy)]);
          }
        } else {
          var cx = 0.25 + f * f;
          for (i = 0; i <= 60; i++) {
            u = i / 60;
            var c = u <= 0.5 ? cx : 1 - cx;
            h = Math.sqrt(Math.max(0, cx * cx - (u - c) * (u - c)));
            egri.push([X(u), Y(h)]);
          }
        }
        var s = gLine(0.02, TAB, 0.98, TAB, { c: "var(--rule)", w: 1.4 });
        s += gRect(X(0) - b * SP, TAB, X(0), OMUZ, { c: "var(--ink)", o: 0.14, r: 0 });
        s += gRect(X(1), TAB, X(1) + b * SP, OMUZ, { c: "var(--ink)", o: 0.14, r: 0 });
        s += gPoly(egri, { c: "var(--accent)", w: 5 });
        var ok = Math.min(0.22, H * 1.3);
        [[X(0), -1], [X(1), 1]].forEach(function (a) {
          s += gLine(a[0], OMUZ, a[0] + a[1] * ok, OMUZ, { c: "var(--no)", w: 2 });
          s += gLine(a[0] + a[1] * ok, OMUZ, a[0] + a[1] * (ok - 0.022), OMUZ + 0.035, { c: "var(--no)", w: 2 });
          s += gLine(a[0] + a[1] * ok, OMUZ, a[0] + a[1] * (ok - 0.022), OMUZ - 0.035, { c: "var(--no)", w: 2 });
        });
        s += gTxt(0.5, Y(f), f <= 0.45 ? "basık kemer" : f <= 0.55 ? "yarım daire kemer" : "sivri kemer",
          { a: "middle", dy: -8, c: "var(--ink)", b: 1, s: 10 });
        s += gTxt(X(1) + (b * SP) / 2, (TAB + OMUZ) / 2, "ayak", { a: "middle", dy: 3, s: 8.5 });
        s += gTxt(0.02, TAB, "kırmızı ok: yanlara itme", { a: "start", dy: 12, c: "var(--no)", s: 8.5 });
        return { svg: s, text: "Yüksekliği açıklığının %" + p.y + "'i olan bu kemer, taşıdığı düşey yükün %" +
          r0((H / W) * 100) + "'i kadar bir kuvvetle iki yana itiyor; bunu karşılamak için her iki başında " +
          "açıklığın %" + r0(b * 100) + "'i genişliğinde bir ayak gerekiyor. " +
          (f > 0.55
            ? "Kemer yükseldikçe itme düşüyor: gotik katedralin sivri kemeri bir üslup tercihi değil, duvarı inceltmenin yoluydu."
            : "Kemer basıldıkça itme büyüyor; roma ve romanesk yapıların kalın duvarları bu itmeyi tutmak içindir.") +
          " Üstteki duvar yükünü artırmak itmeyi de büyütür." };
      }
    },

    "deprem-tepki": {
      title: "Bina yüksekliği, zemin ve deprem kuvveti",
      note: "Türkiye Bina Deprem Yönetmeliği'nin tasarım spektrumu sadeleştirilerek kullanıldı; zemin sınıflarına temsilî değerler verildi. Gerçek tasarım, sahaya özgü ölçümlerle yapılır.",
      controls: [
        { key: "z", type: "choice", label: "Zemin", def: "orta", options: [
          ["kaya", "Kaya"], ["orta", "Sıkı"], ["yumusak", "Yumuşak"]] },
        { key: "n", label: "Kat sayısı", min: 2, max: 30, step: 1, def: 8,
          fmt: function (v) { return v + " kat"; } }
      ],
      draw: function (p) {
        var ZEM = {
          kaya: ["kaya", 0.80, 0.25, "var(--ok)"],
          orta: ["sıkı zemin", 1.00, 0.55, "var(--accent)"],
          yumusak: ["yumuşak zemin", 1.00, 0.90, "var(--no)"]
        };
        var SIRA = ["kaya", "orta", "yumusak"], TMAX = 3, SAMAX = 1.2, i, k;
        var Sa = function (key, T) {
          var z = ZEM[key], DS = z[1], D1 = z[2], TB = D1 / DS, TA = 0.2 * TB;
          if (T < TA) return DS * (0.4 + (0.6 * T) / TA);
          if (T <= TB) return DS;
          return D1 / T;
        };
        var s = frame("Salınım süresi (sn)", "Tasarım ivmesi");
        for (k = 0; k < SIRA.length; k++) {
          var key = SIRA[k], pts = [];
          for (i = 0; i <= 80; i++) {
            var T = (TMAX * i) / 80;
            pts.push([T / TMAX, Math.min(1, Sa(key, T) / SAMAX)]);
          }
          var sec = key === p.z;
          s += gPoly(pts, { c: ZEM[key][3], w: sec ? 2.6 : 1.2, d: sec ? "" : "3 3" });
          s += gTxt(1, Math.min(1, Sa(key, TMAX) / SAMAX), ZEM[key][0].split(" ")[0],
            { a: "end", dy: -7, c: ZEM[key][3], b: sec ? 1 : 0, s: 9 });
        }
        var TT = 0.1 * p.n, aa = Sa(p.z, TT), yy = Math.min(1, aa / SAMAX);
        s += gLine(TT / TMAX, 0, TT / TMAX, yy, { c: "var(--rule)", w: 1, d: "3 3" });
        s += gDot(TT / TMAX, yy, { c: "var(--ink)" });
        s += gTxt(TT / TMAX, yy, r2(aa) + " g", {
          a: p.n > 18 ? "end" : "start", dx: p.n > 18 ? -7 : 7, dy: -6, c: "var(--ink)", b: 1, s: 10 });
        [0.5, 1, 1.5].forEach(function (v) { s += gTxt(v / TMAX, 0, r1(v), { a: "middle", dy: 12, s: 9 }); });
        var kaya = Sa("kaya", TT);
        return { svg: s, text: p.n + " katlı bir binanın doğal salınım süresi kabaca " + r1(TT) +
          " saniyedir. " + ZEM[p.z][0].charAt(0).toUpperCase() + ZEM[p.z][0].slice(1) + " üzerinde bu süreye düşen " +
          "tasarım ivmesi " + r2(aa) + " g: binaya kendi ağırlığının yaklaşık %" + r0(aa * 100) +
          "'i kadar yatay kuvvet gelir. " +
          (p.z === "yumusak" && TT > 0.8
            ? "Yumuşak zemin uzun salınımları büyütür; aynı bina kayada " + r2(kaya) +
              " g görürdü, yani " + r1(aa / kaya) + " kat azını. 1999 Adapazarı ve 2023 Hatay'da yıkımı ağırlaştıran şey bu eşleşmeydi."
            : "Zemin ile binanın salınım süresi birbirine yaklaştığında kuvvet katlanır; tehlikeli olan bina ya da zemin değil, ikisinin eşleşmesidir.") };
      }
    },

    "kent-yogunlugu": {
      title: "Aynı yoğunluk, farklı biçim",
      note: "Emsal (KAKS) toplam inşaat alanının parsel alanına oranı, taban alanı oranı (TAKS) ise zemine oturan kısmın oranıdır. İkisi arasındaki bağ tek satırlık bir bölmedir: TAKS = emsal / kat sayısı.",
      controls: [
        { key: "e", label: "Emsal (KAKS)", min: 5, max: 40, step: 1, def: 20,
          fmt: function (v) { return (v / 10).toFixed(1); } },
        { key: "k", label: "Kat sayısı", min: 1, max: 20, step: 1, def: 5,
          fmt: function (v) { return v + " kat"; } }
      ],
      draw: function (p) {
        var E = p.e / 10, KMAX = 20, i;
        var taks = function (k) { return E / k; };
        var pts = [];
        for (i = 1; i <= KMAX; i++) {
          if (taks(i) > 1) continue;
          pts.push([(i - 1) / (KMAX - 1), taks(i)]);
        }
        var s = frame("Kat sayısı", "Zemine oturan oran");
        s += gRect(0, 0.5, 1, 1, { c: "var(--no)", o: 0.08, r: 0 });
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--no)", w: 1.2, d: "4 3" });
        s += gTxt(0.99, 0.5, "parselin yarısı kapanır", { a: "end", dy: -5, c: "var(--no)", s: 8.5 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.6 });
        var T = taks(p.k), acik = 1 - T;
        var kx = (p.k - 1) / (KMAX - 1);
        if (T <= 1) {
          s += gDot(kx, T, { c: "var(--ink)" });
          s += gTxt(kx, T, "%" + r0(T * 100), {
            a: p.k > 13 ? "end" : "start", dx: p.k > 13 ? -7 : 7, dy: T > 0.9 ? 13 : -6,
            c: "var(--ink)", b: 1, s: 10 });
        } else {
          s += gTxt(kx, 0.97, "mümkün değil", { a: kx > 0.6 ? "end" : "start", dx: kx > 0.6 ? -4 : 4, c: "var(--no)", b: 1, s: 10 });
        }
        [5, 10, 15].forEach(function (v) { s += gTxt((v - 1) / (KMAX - 1), 0, v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: T > 1
          ? "Emsal " + r1(E) + ", " + p.k + " katta parsele sığmıyor: zemine oturması gereken alan parselden büyük. Bu yoğunluk ancak daha çok katla mümkün."
          : "Emsal " + r1(E) + " ve " + p.k + " kat: parselin %" + r0(T * 100) + "'i kapanıyor, %" +
            r0(acik * 100) + "'i açık kalıyor. Hektara kabaca " + r0(100 * E) +
            " konut düşüyor ve bu sayı kat sayısından bağımsızdır — yoğunluk emsalde saklıdır. " +
            "Kat sayısını artırmak yoğunluğu değil biçimi değiştirir: aynı insan sayısı ya zemini kaplar ya yükselip avlu bırakır. " +
            "Yoğunluk tartışmalarının çoğu aslında biçim tartışmasıdır." };
      }
    },

    /* ---- sağlık ---- */

    "goreli-mutlak-risk": {
      title: "Aynı manşet, iki farklı gerçek",
      note: "Göreli azalma oranı temel riskten bağımsızdır; mutlak azalma ise doğrudan temel riskle çarpılır. Haberlerde neredeyse her zaman göreli sayı verilir, çünkü daha büyük görünür.",
      controls: [
        { key: "t", label: "Tedavisiz temel risk", min: 1, max: 200, step: 1, def: 20,
          fmt: function (v) { return "binde " + v; } },
        { key: "r", label: "Göreli risk azalması", min: 5, max: 60, step: 5, def: 30, fmt: pctS }
      ],
      draw: function (p) {
        var t = p.t, kalan = t * (1 - p.r / 100), arr = t - kalan;
        var TOP = Math.max(5, t * 1.35), nnt = 1000 / arr;
        var Y = function (v) { return v / TOP; };
        var s = frame("", "Bin kişide olay sayısı");
        s += gRect(0.10, 0, 0.34, Y(t), { c: "var(--no)", o: 0.75 });
        s += gRect(0.56, 0, 0.80, Y(kalan), { c: "var(--no)", o: 0.75 });
        s += gRect(0.56, Y(kalan), 0.80, Y(t), { c: "var(--ok)", o: 0.35, s: "var(--ok)", sw: 1.2, d: "3 2" });
        s += gTxt(0.22, 0, "tedavisiz", { a: "middle", dy: 12, s: 9 });
        s += gTxt(0.68, 0, "tedaviyle", { a: "middle", dy: 12, s: 9 });
        s += gTxt(0.22, Y(t), r1(t), { a: "middle", dy: -6, c: "var(--ink)", b: 1, s: 10 });
        s += gTxt(0.68, Y(kalan), r1(kalan), { a: "middle", dy: -6, c: "var(--ink)", b: 1, s: 10 });
        s += gTxt(0.84, Y((t + kalan) / 2), "önlenen", { a: "start", dy: -2, c: "var(--ok)", b: 1, s: 9 });
        s += gTxt(0.84, Y((t + kalan) / 2), r1(arr), { a: "start", dy: 9, c: "var(--ok)", b: 1, s: 9 });
        return { svg: s, text: "Bin kişiden " + r1(t) + " tanesinin başına gelen bir olay, %" + p.r +
          " göreli azalmayla " + r1(kalan) + " tanesine iniyor. Mutlak azalma binde " + r1(arr) +
          "; yani bir olayı önlemek için " + r0(nnt) + " kişiyi tedavi etmek gerekiyor. " +
          (t <= 20
            ? "Temel risk küçükken 'riski üçte bir azaltıyor' cümlesi doğrudur ama neredeyse hiçbir şey söylemez."
            : "Temel risk büyüdükçe aynı göreli oran çok daha anlamlı hâle gelir. Göreli sayı tek başına asla yeterli değildir; mutlak sayıyı sormak gerekir.") };
      }
    },

    "fayda-zarar-dengesi": {
      title: "Tedavi etmek ne zaman doğru",
      note: "Göreli risk azalması %25 varsayıldı. Tedaviden fayda görecek kişi sayısı temel riskle değişir, zarar görecek kişi sayısı ise değişmez; bu yüzden aynı ilaç bir hastada doğru, diğerinde yanlış olabilir.",
      controls: [
        { key: "t", label: "Hastanın temel riski", min: 2, max: 200, step: 2, def: 40,
          fmt: function (v) { return "binde " + v; } },
        { key: "y", label: "Ciddi yan etki sıklığı", min: 1, max: 40, step: 1, def: 5,
          fmt: function (v) { return "binde " + v; } }
      ],
      draw: function (p) {
        var RRR = 0.25, T0 = 2, T1 = 200, i;
        var nnt = function (t) { return 1000 / (RRR * t); };
        var nnh = 1000 / p.y;
        var X = function (t) { return (Math.log(t) - Math.log(T0)) / (Math.log(T1) - Math.log(T0)); };
        var Y = function (v) { return Math.max(0, Math.min(1, Math.log(v) / Math.log(10000))); };
        var pts = [];
        for (i = 0; i <= 60; i++) {
          var t = T0 * Math.pow(T1 / T0, i / 60);
          pts.push([X(t), Y(nnt(t))]);
        }
        var esik = 1000 / (RRR * nnh);          // NNT ile NNH'nin eşitlendiği temel risk
        var s = frame("Temel risk", "Kişi sayısı");
        if (esik > T0 && esik < T1) s += gRect(0, 0, X(esik), 1, { c: "var(--no)", o: 0.07, r: 0 });
        [100, 1000].forEach(function (v) {
          s += gLine(0, Y(v), 1, Y(v), { c: "var(--rule)", w: 1, d: "2 4" });
          s += gTxt(0.01, Y(v), String(v), { a: "start", dy: 11, s: 8.5 });
        });
        s += gLine(0, Y(nnh), 1, Y(nnh), { c: "var(--no)", w: 2, d: "5 3" });
        s += gTxt(0.99, Y(nnh), "zarar görecek: " + r0(nnh), { a: "end", dy: -5, c: "var(--no)", b: 1, s: 9 });
        s += gPoly(pts, { c: "var(--ok)", w: 2.6 });
        s += gTxt(0.99, Y(nnt(T1)), "fayda görecek", { a: "end", dy: 13, c: "var(--ok)", b: 1, s: 9 });
        var yy = Y(nnt(p.t));
        s += gDot(X(p.t), yy, { c: "var(--ink)" });
        s += gTxt(X(p.t), yy, r0(nnt(p.t)), {
          a: X(p.t) > 0.6 ? "end" : "start", dx: X(p.t) > 0.6 ? -7 : 7, dy: -6, c: "var(--ink)", b: 1, s: 10 });
        [5, 30].forEach(function (v) { s += gTxt(X(v), 0, "binde " + v, { a: "middle", dy: 12, s: 8.5 }); });
        return { svg: s, text: "Temel riski binde " + p.t + " olan bir hastada bir olayı önlemek için " +
          r0(nnt(p.t)) + " kişinin tedavi edilmesi gerekiyor; aynı tedavi " + r0(nnh) +
          " kişide ciddi yan etkiye yol açıyor. " +
          (nnt(p.t) <= nnh
            ? "Fayda zarardan önce geliyor: bu hasta için tedavi makul."
            : "Zarar faydadan önce geliyor: bu risk düzeyinde tedavi etmek ortalama olarak iyilikten çok kötülük yapar.") +
          " Denge binde " + r1(esik) + " temel riskte kuruluyor. Bu yüzden 'ilaç işe yarıyor mu' sorusu eksiktir; doğru soru 'kimde işe yarıyor'dur." };
      }
    },

    "erken-teshis-yanilgisi": {
      title: "Erken teşhis sağkalımı kendiliğinden yükseltir",
      note: "Aynı hastalar, aynı ölüm tarihleri. Değişen tek şey teşhisin ne kadar erken konduğu. Beş yıllık sağkalım teşhis anından sayıldığı için teşhisi öne almak tek başına bu oranı yükseltir; buna öne alma yanlılığı denir.",
      controls: [
        { key: "l", label: "Teşhis ne kadar erkene alındı", min: 0, max: 5, step: 1, def: 3,
          fmt: function (v) { return v + " yıl"; } },
        { key: "g", label: "Tedavinin gerçekten kazandırdığı süre", min: 0, max: 30, step: 5, def: 0,
          fmt: function (v) { return (v / 10).toFixed(1) + " yıl"; } }
      ],
      draw: function (p) {
        var N = 400, i, k;
        var omur = function (j) {
          var u = j / (N - 1);
          return u < 0.75 ? 0.4 + 12 * Math.pow(u / 0.75, 1.7) : 30;
        };
        var g = p.g / 10;
        var sagkalim = function (L) {
          var c = 0;
          for (k = 0; k < N; k++) if (L + omur(k) + g > 5) c++;
          return c / N;
        };
        var olum = 0;
        for (i = 0; i < N; i++) if (omur(i) + g < 10) olum++;
        olum = olum / N;
        var pts = [];
        for (i = 0; i <= 5; i++) pts.push([i / 5, sagkalim(i)]);
        var s = frame("Erkene alma (yıl)", "Oran");
        s += gLine(0, olum, 1, olum, { c: "var(--no)", w: 2, d: "5 3" });
        s += gTxt(0.99, olum, "on yıl içinde ölenler: %" + r0(olum * 100), { a: "end", dy: 13, c: "var(--no)", b: 1, s: 9 });
        s += gPoly(pts, { c: "var(--ok)", w: 2.6 });
        s += gTxt(0.02, sagkalim(0), "beş yıllık sağkalım", { a: "start", dy: 13, c: "var(--ok)", b: 1, s: 9 });
        var yy = sagkalim(p.l);
        s += gDot(p.l / 5, yy, { c: "var(--ink)" });
        s += gTxt(p.l / 5, yy, "%" + r0(yy * 100), {
          a: p.l > 3 ? "end" : "start", dx: p.l > 3 ? -7 : 7, dy: yy > 0.9 ? 13 : -6, c: "var(--ink)", b: 1, s: 10 });
        [0, 2].forEach(function (v) { s += gTxt(v / 5, 0, v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Teşhis " + p.l + " yıl erkene alındığında beş yıllık sağkalım %" +
          r0(sagkalim(0) * 100) + "'ten %" + r0(yy * 100) + "'e çıkıyor. " +
          (p.g === 0
            ? "Oysa tedavi hiç kimseye tek bir gün bile kazandırmadı: ölüm oranı olduğu yerde duruyor. Sağkalım oranı bir tarama programının başarısını ölçmez; ölçen tek sayı ölüm oranıdır."
            : "Bu ayarda tedavi gerçekten " + (p.g / 10).toFixed(1) + " yıl kazandırıyor ve on yıl içindeki ölüm oranı %" +
              r0(olum * 100) + "'e iniyor. Sağkalımdaki artışın ne kadarının gerçek fayda olduğunu ancak ölüm oranına bakarak ayırabilirsiniz.") };
      }
    },

    "ortalamaya-donus": {
      title: "Tedavi olmadan da iyileşen hastalar",
      note: "Kimseye hiçbir şey verilmiyor. Ölçüm iki kez tekrarlanıyor ve ilk ölçümde en kötü çıkan grup ikinci ölçümde kendiliğinden daha iyi çıkıyor, çünkü kötü ölçümün bir kısmı o günkü dalgalanmadan geliyordu.",
      controls: [{ key: "g", label: "Ölçümdeki günlük dalgalanma", min: 0, max: 100, step: 5, def: 50, fmt: pctS }],
      draw: function (p) {
        /* Sabit tohumlu üreteç: kaydırıcı oynatıldığında hastalar değişmesin. */
        var N = 400, i, tohum = 20240517;
        var rnd = function () { tohum = (tohum * 1664525 + 1013904223) % 4294967296; return tohum / 4294967296; };
        var nrm = function () { return (rnd() + rnd() + rnd() + rnd() - 2) / 0.5774; };
        var T = [], z1 = [], z2 = [];
        for (i = 0; i < N; i++) { T.push(50 + 10 * nrm()); z1.push(nrm()); z2.push(nrm()); }
        var sahte = function (gur) {
          var sd = (gur / 100) * 15, m = [], j;
          for (j = 0; j < N; j++) m.push([T[j] + sd * z1[j], T[j] + sd * z2[j]]);
          m.sort(function (a, b) { return b[0] - a[0]; });
          var K = Math.round(N * 0.15), s1 = 0, s2 = 0;
          for (j = 0; j < K; j++) { s1 += m[j][0]; s2 += m[j][1]; }
          return [s1 / K, s2 / K];
        };
        var TOP = 20, pts = [];
        for (i = 0; i <= 20; i++) {
          var r = sahte((100 * i) / 20);
          pts.push([i / 20, Math.min(1, (r[0] - r[1]) / TOP)]);
        }
        var simdi = sahte(p.g), fark = simdi[0] - simdi[1];
        var s = frame("Ölçümdeki dalgalanma", "Sahte iyileşme");
        [5, 10, 15].forEach(function (v) {
          s += gLine(0, v / TOP, 1, v / TOP, { c: "var(--rule)", w: 1, d: "2 4" });
          s += gTxt(0.01, v / TOP, v + " puan", { a: "start", dy: -4, s: 8.5 });
        });
        s += gPoly(pts, { c: "var(--accent)", w: 2.6 });
        var yy = Math.min(1, fark / TOP);
        s += gDot(p.g / 100, yy, { c: "var(--ink)" });
        s += gTxt(p.g / 100, yy, r1(fark) + " puan", {
          a: p.g > 65 ? "end" : "start", dx: p.g > 65 ? -7 : 7, dy: -6, c: "var(--ink)", b: 1, s: 10 });
        [0, 50].forEach(function (v) { s += gTxt(v / 100, 0, "%" + v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: p.g === 0
          ? "Ölçüm hiç dalgalanmıyorsa kimse kendiliğinden iyileşmez: en kötü grup ikinci ölçümde de aynı çıkar. Sahte iyileşmeyi üreten şey hastalık değil, ölçümün gürültüsüdür."
          : "Hiçbir tedavi uygulanmadan, ilk ölçümde en kötü %15'lik gruba giren hastaların ortalaması ikinci ölçümde " +
            r1(fark) + " puan iyileşti (" + r1(simdi[0]) + " → " + r1(simdi[1]) + "). " +
            "İnsanlar en kötü hissettikleri gün başvurdukları için, herhangi bir tedavinin ilk gözlemi neredeyse her zaman olumlu görünür. " +
            "Kontrol grubunun varlık sebebi tam olarak bu payı ayıklamaktır." };
      }
    },

    /* ---- evrim ---- */

    "secilim-hizi": {
      title: "Küçük bir avantaj ne kadar hızlı yayılır",
      note: "Haploid bir modelde her kuşakta p' = p(1+s) / (1+sp). Gerçek popülasyonlarda baskınlık, göç ve sürüklenme işi karmaşıklaştırır ama büyüklük mertebesi budur.",
      controls: [
        { key: "s", label: "Üreme avantajı", min: 1, max: 20, step: 1, def: 5, fmt: pctS },
        { key: "b", label: "Başlangıç sıklığı", min: 1, max: 100, step: 1, def: 10,
          fmt: function (v) { return "binde " + v; } }
      ],
      draw: function (p) {
        var s0 = p.s / 100, p0 = p.b / 1000, i;
        var kus = function (hedef) {
          return Math.log((hedef / (1 - hedef)) / (p0 / (1 - p0))) / Math.log(1 + s0);
        };
        var t99 = kus(0.99);
        var GMAX = Math.max(50, Math.ceil((t99 * 1.15) / 50) * 50);
        var pt = function (t) {
          var o = (p0 / (1 - p0)) * Math.pow(1 + s0, t);
          return o / (1 + o);
        };
        var pts = [];
        for (i = 0; i <= 80; i++) pts.push([i / 80, pt((GMAX * i) / 80)]);
        var s = frame("Kuşak", "Sıklık");
        [0.5, 0.99].forEach(function (v) {
          s += gLine(0, v, 1, v, { c: "var(--rule)", w: 1, d: "2 4" });
          s += gTxt(0.01, v, "%" + r0(v * 100), { a: "start", dy: v > 0.9 ? 12 : -4, s: 8.5 });
        });
        s += gPoly(pts, { c: "var(--accent)", w: 2.6 });
        var t50 = kus(0.5);
        s += gDot(t50 / GMAX, 0.5, { c: "var(--ink)" });
        s += gTxt(t50 / GMAX, 0.5, r0(t50) + " kuşak", {
          a: t50 / GMAX > 0.6 ? "end" : "start", dx: t50 / GMAX > 0.6 ? -7 : 7, dy: -6,
          c: "var(--ink)", b: 1, s: 10 });
        [GMAX / 2].forEach(function (v) { s += gTxt(v / GMAX, 0, r0(v), { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Binde " + p.b + " sıklıkla başlayan ve taşıyıcısına %" + p.s +
          " üreme avantajı veren bir özellik, popülasyonun yarısına " + r0(t50) + " kuşakta, %99'una " +
          r0(t99) + " kuşakta ulaşıyor. " +
          "Yüzde beşlik bir avantaj bir bireyin ömründe fark edilmez; birkaç yüz kuşakta popülasyonu baştan yazar. " +
          "Evrimin sezgiye aykırı yanı büyük sıçramalar değil, küçük farkların üst üste binmesidir." };
      }
    },

    "suruklenme": {
      title: "Küçük popülasyonda şans, seçilimden güçlüdür",
      note: "Sekiz ayrı popülasyon, hepsi aynı sıklıkla başlıyor ve aynı avantaja sahip. Aradaki tek fark, her kuşakta hangi bireylerin üreyebildiği. Sabit tohumlu bir üreteç kullanıldığı için kaydırıcıyı geri aldığınızda aynı tarih tekrarlanır.",
      controls: [
        { key: "k", label: "Popülasyon büyüklüğü", min: 0, max: 30, step: 1, def: 10,
          fmt: function (v) { return r0(10 * Math.pow(10, v / 10)) + " birey"; } },
        { key: "s", label: "Üreme avantajı", min: 0, max: 5, step: 1, def: 1, fmt: pctS }
      ],
      draw: function (p) {
        var N = 10 * Math.pow(10, p.k / 10), s0 = p.s / 100, G = 150, YOL = 8, i, t, y;
        var tohum = 987654321;
        var rnd = function () { tohum = (tohum * 1664525 + 1013904223) % 4294967296; return tohum / 4294967296; };
        var nrm = function () { return (rnd() + rnd() + rnd() + rnd() - 2) / 0.5774; };
        var s = frame("Kuşak", "Sıklık");
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1, d: "2 4" });
        var sabit = 0, kayip = 0;
        for (y = 0; y < YOL; y++) {
          var f = 0.5, pts = [[0, 0.5]];
          for (t = 1; t <= G; t++) {
            if (f > 0 && f < 1) {
              f = (f * (1 + s0)) / (1 + s0 * f);
              f = f + Math.sqrt((f * (1 - f)) / (2 * N)) * nrm();
              f = Math.max(0, Math.min(1, f));
              if (f < 1 / (2 * N)) f = 0;
              if (f > 1 - 1 / (2 * N)) f = 1;
            }
            pts.push([t / G, f]);
          }
          if (f === 1) sabit++;
          if (f === 0) kayip++;
          s += gPoly(pts, { c: f === 1 ? "var(--ink)" : f === 0 ? "var(--no)" : "var(--accent)", w: 1.6 });
        }
        [50, 100].forEach(function (v) { s += gTxt(v / G, 0, v, { a: "middle", dy: 12, s: 9 }); });
        s += gTxt(0.01, 1, "yerleşti", { a: "start", dy: 11, c: "var(--ink)", b: 1, s: 8.5 });
        s += gTxt(0.01, 0, "kayboldu", { a: "start", dy: -4, c: "var(--no)", b: 1, s: 8.5 });
        var esik = 1 / (2 * N);
        return { svg: s, text: r0(N) + " bireylik sekiz popülasyonda, aynı %" + p.s +
          " avantaja sahip bir özellik 150 kuşak izlendi: " + sabit + " popülasyonda yerleşti, " +
          kayip + " popülasyonda kayboldu, " + (YOL - sabit - kayip) + " popülasyonda hâlâ yolda. " +
          (s0 > esik
            ? "Avantaj (%" + p.s + ") sürüklenme eşiğinden (%" + r2(esik * 100) + ") büyük olduğu için seçilim yönü belirliyor."
            : "Avantaj (%" + p.s + ") sürüklenme eşiğinin (%" + r2(esik * 100) + ") altında kaldığı için sonucu şans belirliyor: " +
              "küçük popülasyonda faydalı bir özellik de yok olabilir, zararlı bir özellik de yerleşebilir.") };
      }
    },

    "molekuler-saat": {
      title: "Moleküler saat ve doygunluk",
      note: "Jukes-Cantor modeli: gözlenen fark p = ¾(1 − e^(−4d/3)), d ise gerçekte biriken değişim sayısı. Dört harf olduğu için iki tamamen ilgisiz dizi bile ancak %75 farklı çıkar.",
      controls: [
        { key: "t", label: "Ayrılmadan bu yana", min: 0, max: 30, step: 1, def: 12,
          fmt: function (v) { return r0(Math.pow(10, v / 10)) + " milyon yıl"; } },
        { key: "m", label: "Değişim hızı", min: 2, max: 20, step: 1, def: 10,
          fmt: function (v) { return "milyon yılda ‰" + (v / 10).toFixed(1); } }
      ],
      draw: function (p) {
        var T0 = 1, T1 = 1000, mu = (p.m / 10) / 1000, i;   // birim: değişim/bölge/milyon yıl
        var X = function (t) { return Math.log(t / T0) / Math.log(T1 / T0); };
        var D = function (t) { return 2 * mu * t; };
        var P = function (t) { return 0.75 * (1 - Math.exp((-4 * D(t)) / 3)); };
        var ger = [], goz = [];
        for (i = 0; i <= 70; i++) {
          var t = T0 * Math.pow(T1 / T0, i / 70);
          ger.push([X(t), Math.min(1, D(t))]);
          goz.push([X(t), P(t)]);
        }
        var s = frame("Ayrılma zamanı", "Dizi farkı");
        s += gLine(0, 0.75, 1, 0.75, { c: "var(--no)", w: 1.4, d: "4 3" });
        s += gTxt(0.02, 0.75, "%75: rastgele iki dizi", { a: "start", dy: -5, c: "var(--no)", b: 1, s: 8.5 });
        s += gTxt(0.02, 0.97, "kesikli: gerçekte biriken değişim", { a: "start", c: "var(--muted)", s: 8.5 });
        s += gTxt(0.02, 0.88, "dolu: dizide görünen fark", { a: "start", c: "var(--accent)", b: 1, s: 8.5 });
        s += gPoly(ger, { c: "var(--muted)", w: 1.6, d: "3 3" });
        s += gPoly(goz, { c: "var(--accent)", w: 2.6 });
        var tt = Math.pow(10, p.t / 10);
        s += gDot(X(tt), P(tt), { c: "var(--ink)" });
        s += gTxt(X(tt), P(tt), "%" + r1(P(tt) * 100), {
          a: X(tt) > 0.6 ? "end" : "start", dx: X(tt) > 0.6 ? -7 : 7, dy: -6, c: "var(--ink)", b: 1, s: 10 });
        [3, 30].forEach(function (v) { s += gTxt(X(v), 0, v + " my", { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: r0(tt) + " milyon yıl önce ayrılmış iki soy hattında, her yüz konumda gerçekte " +
          r2(D(tt) * 100) + " değişim birikti ama dizilerin yalnızca %" + r1(P(tt) * 100) +
          "'i farklı görünüyor. " +
          (D(tt) < 0.05
            ? "Yakın akrabalarda ikisi neredeyse aynıdır; insanla şempanzenin dizilerinin %98'den fazla örtüşmesinin sebebi budur."
            : "Aynı yer ikinci kez değiştiğinde ilk değişim görünmez olur; bu yüzden gözlenen fark gerçek değişimin gerisinde kalır ve %75'te doyar. Çok eski ayrılmalar tek bir gene bakarak okunamaz.") };
      }
    },

    "akraba-secilimi": {
      title: "Fedakârlık ne zaman yayılır",
      note: "Hamilton kuralı: r·b > c. Akrabalık katsayısı r, ortak atadan gelen genlerin beklenen ortak payıdır. Kuralın söylediği şey fedakârlığın soylu olduğu değil, hangi koşulda kalıtsal olarak kârlı olduğudur.",
      controls: [
        { key: "r", type: "choice", label: "Kime yardım ediliyor", def: "kardes", options: [
          ["kardes", "Kardeş"], ["yegen", "Yeğen"], ["kuzen", "Kuzen"], ["yabanci", "Yabancı"]] },
        { key: "b", label: "Fayda / maliyet oranı", min: 1, max: 20, step: 1, def: 4,
          fmt: function (v) { return v + " kat"; } }
      ],
      draw: function (p) {
        var AKRABA = { kardes: ["kardeş", 0.5], yegen: ["yeğen", 0.25], kuzen: ["kuzen", 0.125], yabanci: ["yabancı", 0.02] };
        var R0 = 0.02, R1 = 0.8, TOP = 20, i;
        var X = function (r) { return Math.log(r / R0) / Math.log(R1 / R0); };
        var esik = function (r) { return 1 / r; };
        var pts = [];
        for (i = 0; i <= 70; i++) {
          var r = R0 * Math.pow(R1 / R0, i / 70);
          if (esik(r) <= TOP) pts.push([X(r), esik(r) / TOP]);
        }
        var s = frame("Akrabalık (r)", "Fayda / maliyet");
        if (pts.length) {
          s += gArea(pts.concat([[1, 1], [pts[0][0], 1]]), { c: "var(--ok)", o: 0.12 });
          s += gPoly(pts, { c: "var(--ok)", w: 2.2 });
        }
        s += gTxt(0.99, 0.93, "fedakârlık yayılır", { a: "end", c: "var(--ok)", b: 1, s: 9 });
        s += gTxt(0.02, 0.06, "yayılmaz", { a: "start", c: "var(--no)", b: 1, s: 9 });
        var rr = AKRABA[p.r][1], bc = p.b, gecer = rr * bc > 1;
        s += gDot(X(rr), Math.min(1, bc / TOP), { c: gecer ? "var(--ok)" : "var(--no)" });
        s += gTxt(X(rr), Math.min(1, bc / TOP), AKRABA[p.r][0], {
          a: X(rr) > 0.6 ? "end" : "start", dx: X(rr) > 0.6 ? -7 : 7, dy: -6,
          c: "var(--ink)", b: 1, s: 10 });
        [0.05, 0.25].forEach(function (v) { s += gTxt(X(v), 0, r2(v), { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Bir " + AKRABA[p.r][0] + " için (r = " + r2(rr) +
          ") fedakârlığın yayılması, kazandırdığı faydanın kendi maliyetinin " + r1(esik(rr)) +
          " katından büyük olmasını gerektiriyor. Bu ayarda oran " + bc + " kat: kural " +
          (gecer ? "sağlanıyor, davranış yayılır." : "sağlanmıyor, davranış yayılmaz.") +
          " Haldane'a atfedilen espri tam olarak bunu söyler: iki kardeşim ya da sekiz kuzenim için canımı veririm. " +
          "Kural, fedakârlığın genlerin hesabında nasıl kârlı hâle geldiğini açıklar; ahlaki bir öğüt değildir." };
      }
    },

    /* ---- psikoloji ---- */

    "unutma-egrisi": {
      title: "Unutma eğrisi ve aralıklı tekrar",
      note: "Hatırlama üstel bir sönüm olarak modellendi: R = e^(−t/S). Her tekrar S'yi iki katına çıkarır ve tekrar, hatırlama %50'ye düştüğü anda yapılır. Zaman ekseni logaritmiktir; tekrarların eşit aralıklı görünmesi tam da aralıkların katlanarak büyüdüğü anlamına gelir.",
      controls: [
        { key: "n", label: "Tekrar sayısı", min: 0, max: 6, step: 1, def: 5,
          fmt: function (v) { return v === 0 ? "tekrar yok" : v + " tekrar"; } },
        { key: "s", label: "İlk kalıcılık", min: 1, max: 5, step: 1, def: 2,
          fmt: function (v) { return v + " gün"; } }
      ],
      draw: function (p) {
        var T0 = 0.5, T1 = 120, LN2 = Math.LN2, i, k;
        var X = function (t) { return Math.log(t / T0) / Math.log(T1 / T0); };
        /* tekrar anları: her seferinde hatırlama %50'ye düştüğünde */
        var anlar = [], S = p.s, t = 0;
        for (k = 0; k < p.n; k++) { t += S * LN2; S *= 2; anlar.push([t, S]); }
        var R = function (x, kac) {
          var son = 0, kal = p.s, j;
          for (j = 0; j < kac; j++) {
            if (anlar[j][0] > x) break;
            son = anlar[j][0]; kal = anlar[j][1];
          }
          return Math.exp(-(x - son) / kal);
        };
        var yalin = [], plan = [];
        for (i = 0; i <= 200; i++) {
          var x = T0 * Math.pow(T1 / T0, i / 200);
          yalin.push([X(x), R(x, 0)]);
          plan.push([X(x), R(x, p.n)]);
        }
        var s = frame("Geçen süre", "Hatırlama");
        s += gLine(0, 0.5, 1, 0.5, { c: "var(--rule)", w: 1, d: "2 4" });
        s += gTxt(0.99, 0.5, "%50", { a: "end", dy: -4, s: 8.5 });
        anlar.forEach(function (a) {
          s += gLine(X(a[0]), 0, X(a[0]), 1, { c: "var(--accent)", w: 1, d: "2 3" });
        });
        s += gPoly(yalin, { c: "var(--muted)", w: 1.4, d: "3 3" });
        if (p.n) s += gPoly(plan, { c: "var(--accent)", w: 2.6 });
        s += gTxt(0.02, 0.06, "kesikli: hiç tekrar etmezsen", { a: "start", c: "var(--muted)", s: 8.5 });
        [[1, "1 gün"], [7, "1 hafta"], [30, "1 ay"]].forEach(function (v) {
          s += gTxt(X(v[0]), 0, v[1], { a: "middle", dy: 12, s: 8.5 });
        });
        var son = R(T1, p.n), yok = R(T1, 0);
        return { svg: s, text: p.n === 0
          ? "Tek seferlik çalışmadan sonra dört ayın sonunda geriye pratikte hiçbir şey kalmıyor. " +
            "Unutmanın hızlı olması bir kusur değil: zihin, tekrar karşılaşmadığı şeyi önemsiz sayar."
          : p.n + " tekrarla dört ayın sonunda hatırlama %" + r0(son * 100) + "; hiç tekrar etmeseydin %" +
            r0(yok * 100) + " olacaktı. Son tekrar " + r0(anlar[p.n - 1][0]) +
            ". günde ve o noktadan sonra kalıcılık " + r0(anlar[p.n - 1][1]) + " güne çıkmış durumda. " +
            "Dikey çizgiler eşit aralıklı görünüyor çünkü eksen logaritmik: gerçekte her aralık bir öncekinin iki katı. " +
            "Aynı sayıda tekrarı bir geceye sıkıştırmak bu eğriyi üretmez." };
      }
    },

    "stres-performans": {
      title: "Gerilim performansı ne zaman bozar",
      note: "Şematik bir model (Yerkes-Dodson): performans uyarılmaya göre ters U çizer ve tepe noktası görev karmaşıklaştıkça sola kayar. Sayılar ölçüm değil, ilişkinin biçimini göstermek içindir.",
      controls: [
        { key: "z", label: "Görevin karmaşıklığı", min: 0, max: 100, step: 10, def: 50, fmt: pctS },
        { key: "u", label: "Uyarılma düzeyi", min: 0, max: 100, step: 5, def: 50, fmt: pctS }
      ],
      draw: function (p) {
        var i, k;
        var tepe = function (d) { return 0.78 - 0.48 * d; };
        var genis = function (d) { return 0.32 - 0.13 * d; };
        var P = function (d, a) {
          var m = tepe(d), w = genis(d);
          return Math.exp(-((a - m) * (a - m)) / (2 * w * w));
        };
        var s = frame("Uyarılma", "Performans");
        var d0 = p.z / 100;
        [[0, "var(--muted)"], [1, "var(--muted)"], [d0, "var(--accent)"]].forEach(function (pair, idx) {
          var pts = [];
          for (i = 0; i <= 60; i++) pts.push([i / 60, P(pair[0], i / 60)]);
          s += gPoly(pts, { c: pair[1], w: idx === 2 ? 2.6 : 1.2, d: idx === 2 ? "" : "3 3" });
        });
        s += gTxt(tepe(0), 1, "kolay iş", { a: "middle", dy: -3, c: "var(--muted)", s: 8.5 });
        s += gTxt(tepe(1), 1, "zor iş", { a: "middle", dy: -3, c: "var(--muted)", s: 8.5 });
        var a0 = p.u / 100, y = P(d0, a0);
        s += gLine(tepe(d0), 0, tepe(d0), 1, { c: "var(--ok)", w: 1.2, d: "4 3" });
        s += gTxt(tepe(d0), 0, "en iyi", { a: tepe(d0) > 0.6 ? "end" : "start", dx: tepe(d0) > 0.6 ? -4 : 4, dy: -5, c: "var(--ok)", b: 1, s: 9 });
        s += gDot(a0, y, { c: "var(--ink)" });
        s += gTxt(a0, y, "%" + r0(y * 100), {
          a: a0 > 0.6 ? "end" : "start", dx: a0 > 0.6 ? -7 : 7, dy: y > 0.9 ? 13 : -6, c: "var(--ink)", b: 1, s: 10 });
        k = a0 - tepe(d0);
        return { svg: s, text: "Bu karmaşıklıkta en iyi performans %" + r0(tepe(d0) * 100) +
          " uyarılmada; sen %" + p.u + " uyarılmadasın ve performans tepe değerin %" + r0(y * 100) + "'i kadar. " +
          (Math.abs(k) < 0.08
            ? "Neredeyse tam noktadasın."
            : k > 0
              ? "Fazla gerilim, karmaşık işlerde dikkati daraltır ve işleyen belleği doldurur; sınav kaygısının başarıyı düşürmesi budur."
              : "Yetersiz uyarılma da bir sorundur: iş çok kolaysa ya da hiç önemsemiyorsan zihin devreye tam girmez.") +
          " Basit ve alışkanlık hâline gelmiş işlerde tepe sağdadır — orada gerilim yardım eder." };
      }
    },

    "korelasyon-ve-tahmin": {
      title: "Bir ilişki ne kadar şey söyler",
      note: "Sabit tohumlu 150 kişilik yapay bir örneklem. Psikolojide yayımlanan ilişkilerin çoğu 0,10 ile 0,30 arasındadır; bu, grup ortalamaları için gerçek bir bilgi, tek bir kişi için neredeyse hiçbir şeydir.",
      controls: [{ key: "r", label: "İlişkinin gücü (r)", min: 0, max: 90, step: 5, def: 25,
        fmt: function (v) { return (v / 100).toFixed(2); } }],
      draw: function (p) {
        var N = 150, r = p.r / 100, i, tohum = 424242;
        var rnd = function () { tohum = (tohum * 1664525 + 1013904223) % 4294967296; return tohum / 4294967296; };
        var nrm = function () { return (rnd() + rnd() + rnd() + rnd() - 2) / 0.5774; };
        var xs = [], es = [];
        for (i = 0; i < N; i++) { xs.push(nrm()); es.push(nrm()); }
        var M = function (v) { return Math.max(0, Math.min(1, (v + 2.6) / 5.2)); };
        var s = frame("Ölçüm A", "Ölçüm B");
        s += gLine(M(0), 0, M(0), 1, { c: "var(--rule)", w: 1, d: "2 4" });
        s += gLine(0, M(0), 1, M(0), { c: "var(--rule)", w: 1, d: "2 4" });
        var ust = 0;
        for (i = 0; i < N; i++) {
          var y = r * xs[i] + Math.sqrt(1 - r * r) * es[i];
          if (xs[i] > 0 && y > 0) ust++;
          s += gDot(M(xs[i]), M(y), { r: 2.4, c: "var(--accent)" });
        }
        s += gLine(M(-2.6), M(-2.6 * r), M(2.6), M(2.6 * r), { c: "var(--ink)", w: 2 });
        return { svg: s, text: "İlişkinin gücü r = " + (r).toFixed(2) + ". Bu, B'deki değişkenliğin %" +
          r0(r * r * 100) + "'ini açıklıyor; kalan %" + r0((1 - r * r) * 100) + " başka şeylerden geliyor. " +
          "A'da ortalamanın üstünde olan birinin B'de de üstünde olma olasılığı yaklaşık %" +
          r0((0.25 + Math.asin(r) / (2 * Math.PI)) * 200) + " — hiç ilişki olmasaydı %50 olacaktı. " +
          (r < 0.35
            ? "Bulut neredeyse yuvarlak: ilişki gerçek olabilir ama tek bir kişi hakkında tahmin yürütmeye yetmez."
            : "İlişki güçlendikçe bulut çizgiye yaklaşıyor; yine de tek tek noktaların çizgiden ne kadar uzakta olabildiğine bakın.") };
      }
    },

    "kayip-kacinma": {
      title: "Kaybetmek, kazanmaktan daha ağır basar",
      note: "Kahneman ve Tversky'nin değer işlevi: v(x) = x^0,88 kazançta, −λ(−x)^0,88 kayıpta. Fayda eğrisinden farkı, ölçünün toplam servet değil bir referans noktasına göre değişim olması ve sıfırda bir kırılma bulunmasıdır.",
      controls: [
        { key: "l", label: "Kayıp katsayısı (λ)", min: 10, max: 30, step: 1, def: 22,
          fmt: function (v) { return (v / 10).toFixed(1) + " kat"; } },
        { key: "b", label: "Riske atılan miktar", min: 10, max: 100, step: 10, def: 50,
          fmt: function (v) { return v + " birim"; } }
      ],
      draw: function (p) {
        var lam = p.l / 10, A = 0.88, M = 100, i;
        var v = function (x) { return x >= 0 ? Math.pow(x, A) : -lam * Math.pow(-x, A); };
        var VM = lam * Math.pow(M, A);
        var X = function (x) { return (x + M) / (2 * M); };
        var Y = function (y) { return (y + VM) / (2 * VM); };
        var pts = [];
        for (i = 0; i <= 80; i++) { var x = -M + (2 * M * i) / 80; pts.push([X(x), Y(v(x))]); }
        var s = frame("Değişim", "Algılanan değer");
        s += gLine(0, Y(0), 1, Y(0), { c: "var(--rule)", w: 1, d: "2 4" });
        s += gLine(X(0), 0, X(0), 1, { c: "var(--rule)", w: 1, d: "2 4" });
        s += gPoly(pts, { c: "var(--accent)", w: 2.6 });
        var b = p.b;
        s += gDot(X(b), Y(v(b)), { c: "var(--ok)" });
        s += gDot(X(-b), Y(v(-b)), { c: "var(--no)" });
        s += gTxt(X(b), Y(v(b)), "+" + b, { a: "end", dx: -6, dy: -4, c: "var(--ok)", b: 1, s: 9.5 });
        s += gTxt(X(-b), Y(v(-b)), "−" + b, { a: "start", dx: 6, dy: 10, c: "var(--no)", b: 1, s: 9.5 });
        s += gTxt(0.02, 0.14, "kayıp", { a: "start", c: "var(--no)", s: 8.5 });
        s += gTxt(0.98, 0.93, "kazanç", { a: "end", c: "var(--ok)", s: 8.5 });
        var gerek = Math.pow(lam, 1 / A) * b;
        return { svg: s, text: b + " birim kaybetmek " + r1(lam) +
          " kat daha ağır hissedildiği için, yazı tura ile " + b + " birim kazanma ihtimali bu kaybı dengelemiyor. " +
          "Bahsin kabul edilebilir olması için kazanç tarafının " + r0(gerek) +
          " birime çıkması gerekiyor. Eğri sıfırda kırılıyor: önemli olan ne kadarınız olduğu değil, " +
          "neyi başlangıç kabul ettiğiniz. Aynı sonuç 'kazanç' diye çerçevelenirse kabul, 'kayıp' diye çerçevelenirse ret üretir." };
      }
    },

    /* ---- antropoloji ---- */

    "grup-buyuklugu": {
      title: "Grup büyüdükçe izlenecek ilişki sayısı",
      note: "İlişki sayısı n(n−1)/2 ile büyür: grup iki katına çıkınca izlenecek ilişki dört katına çıkar. 150 sınırı (Dunbar sayısı) bir doğa yasası değil, beyin büyüklüğü ile grup büyüklüğü arasındaki bir eğilimden çıkarılmış, tartışmalı bir tahmindir.",
      controls: [{ key: "n", label: "Grup büyüklüğü", min: 5, max: 60, step: 1, def: 30,
        fmt: function (v) { return r0(3 * Math.pow(10, v / 20)) + " kişi"; } }],
      draw: function (p) {
        var N0 = 3, N1 = 3000, i;
        var X = function (n) { return Math.log(n / N0) / Math.log(N1 / N0); };
        var Y = function (v) { return Math.max(0, Math.min(1, Math.log(v) / Math.log(5000000))); };
        var bag = function (n) { return (n * (n - 1)) / 2; };
        var pts = [];
        for (i = 0; i <= 70; i++) {
          var n = N0 * Math.pow(N1 / N0, i / 70);
          pts.push([X(n), Y(bag(n))]);
        }
        var s = frame("Grup büyüklüğü", "İlişki sayısı");
        [[5, "yakın çevre"], [50, "aşiret"], [150, "köy"]].forEach(function (v) {
          s += gLine(X(v[0]), 0, X(v[0]), 1, { c: "var(--rule)", w: 1, d: "3 3" });
          s += gTxt(X(v[0]), 1, v[1], { a: "start", dx: 3, dy: 2, s: 8.5 });
        });
        s += gPoly(pts, { c: "var(--accent)", w: 2.6 });
        var n0 = 3 * Math.pow(10, p.n / 20), b = bag(n0);
        s += gDot(X(n0), Y(b), { c: "var(--ink)" });
        s += gTxt(X(n0), Y(b), r0(b) + " bağ", {
          a: X(n0) > 0.6 ? "end" : "start", dx: X(n0) > 0.6 ? -7 : 7, dy: -6, c: "var(--ink)", b: 1, s: 10 });
        [10, 300].forEach(function (v) { s += gTxt(X(v), 0, v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: r0(n0) + " kişilik bir grupta " + r0(b) +
          " ikili ilişki var ve her kişi yalnızca kendi " + r0(n0 - 1) +
          " bağını değil, çevresindekilerin birbiriyle olan bağlarını da izlemek zorunda. " +
          (n0 <= 160
            ? "Bu ölçekte herkes herkesi tanır; kurallar sözle yürür, denetimi dedikodu yapar ve yazılı hiçbir şeye gerek kalmaz."
            : "Bu ölçekte kimse herkesi tanıyamaz. Kurumlar, unvanlar, yazılı kurallar ve kimlik belgeleri tam olarak burada gerekli hâle gelir: tanımadığın biriyle güven kurmanın başka yolu kalmaz.") };
      }
    },

    "kultur-birikimi": {
      title: "Kültür neden kalabalık ister",
      note: "Basitleştirilmiş bir birikimli kültür modeli: her kuşakta öğrenen, gördüğü en usta kişiyi taklit eder ve biraz hata yapar. Kalabalıkta şans eseri ustayı geçen birinin çıkma olasılığı arttığı için kayıp telafi edilir. Tazmanya örneği bu modelin en çok tartışılan uygulamasıdır ve tek açıklama olmaktan uzaktır.",
      controls: [
        { key: "f", label: "Aktarımın sadakati", min: 40, max: 95, step: 5, def: 70, fmt: pctS },
        { key: "n", label: "Bağlantılı nüfus", min: 5, max: 60, step: 1, def: 30,
          fmt: function (v) { return r0(5 * Math.pow(10, v / 20)) + " kişi"; } }
      ],
      draw: function (p) {
        var kayip = 12 * (1 - p.f / 100), N0 = 5, N1 = 5000, i;
        var X = function (n) { return Math.log(n / N0) / Math.log(N1 / N0); };
        var D = function (n) { return -kayip + Math.log(n) + 0.5772; };
        var LO = -6, HI = 6, Y = function (val) { return Math.max(0, Math.min(1, (val - LO) / (HI - LO))); };
        var pts = [];
        for (i = 0; i <= 70; i++) {
          var n = N0 * Math.pow(N1 / N0, i / 70);
          pts.push([X(n), Y(D(n))]);
        }
        var s = frame("Bağlantılı nüfus", "Kuşak başına değişim");
        s += gRect(0, 0, 1, Y(0), { c: "var(--no)", o: 0.07, r: 0 });
        s += gLine(0, Y(0), 1, Y(0), { c: "var(--no)", w: 1.4, d: "4 3" });
        s += gTxt(0.99, Y(0), "beceri kayboluyor", { a: "end", dy: 12, c: "var(--no)", b: 1, s: 8.5 });
        s += gPoly(pts, { c: "var(--ok)", w: 2.6 });
        var esik = Math.exp(kayip - 0.5772);
        if (esik > N0 && esik < N1) {
          s += gLine(X(esik), 0, X(esik), 1, { c: "var(--ink)", w: 1, d: "2 3" });
          s += gTxt(X(esik), 1, "eşik", { a: "start", dx: 3, dy: 2, c: "var(--ink)", b: 1, s: 9 });
        }
        var n0 = 5 * Math.pow(10, p.n / 20), d0 = D(n0);
        s += gDot(X(n0), Y(d0), { c: "var(--ink)" });
        s += gTxt(X(n0), Y(d0), (d0 > 0 ? "+" : "") + r1(d0), {
          a: X(n0) > 0.6 ? "end" : "start", dx: X(n0) > 0.6 ? -7 : 7, dy: -6, c: "var(--ink)", b: 1, s: 10 });
        [20, 300].forEach(function (v) { s += gTxt(X(v), 0, v, { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Bu sadakatte beceri, ancak birbirine bağlı nüfus " + r0(esik) +
          " kişiyi aştığında birikmeye başlıyor. " + r0(n0) + " kişilik bir ağda kuşak başına değişim " +
          (d0 > 0 ? "+" + r1(d0) + ": birikim sürüyor." : r1(d0) + ": her kuşak biraz kaybediyor.") +
          " Buradaki sonuç sezgiye aykırıdır: bir topluluğun teknolojisini belirleyen şey yalnızca zekâsı değil, " +
          "kaç kişiyle ve ne sıklıkta bilgi alışverişi yaptığıdır. Yalıtılmış bir topluluk, hiçbir şey unutmak istemese de unutur." };
      }
    },

    "izolasyon-ve-farklilasma": {
      title: "Ne kadar alışveriş, ne kadar farklılaşma",
      note: "Wright'ın klasik yaklaşımı: Fst ≈ 1 / (1 + 4Nm). Fst, toplam genetik çeşitliliğin ne kadarının gruplar arasında bulunduğunu ölçer. İnsanda ölçülen değer, benzer yayılıma sahip memelilerde alışılmış aralığın alt ucundadır.",
      controls: [{ key: "m", label: "Kuşak başına göçmen", min: 0, max: 40, step: 1, def: 16,
        fmt: function (v) { return (0.05 * Math.pow(1000, v / 40)).toFixed(2) + " kişi"; } }],
      draw: function (p) {
        var M0 = 0.05, M1 = 50, i;
        var X = function (m) { return Math.log(m / M0) / Math.log(M1 / M0); };
        var F = function (m) { return 1 / (1 + 4 * m); };
        var pts = [];
        for (i = 0; i <= 70; i++) {
          var m = M0 * Math.pow(M1 / M0, i / 70);
          pts.push([X(m), F(m)]);
        }
        var s = frame("Göçmen / kuşak", "Gruplar arası pay");
        s += gLine(0, 0.12, 1, 0.12, { c: "var(--ok)", w: 1.4, d: "4 3" });
        s += gTxt(0.99, 0.12, "insanda ölçülen: 0,12", { a: "end", dy: -5, c: "var(--ok)", b: 1, s: 8.5 });
        s += gPoly(pts, { c: "var(--accent)", w: 2.6 });
        var m0 = M0 * Math.pow(1000, p.m / 40), f0 = F(m0);
        s += gDot(X(m0), f0, { c: "var(--ink)" });
        s += gTxt(X(m0), f0, r2(f0), {
          a: X(m0) > 0.6 ? "end" : "start", dx: X(m0) > 0.6 ? -7 : 7, dy: f0 > 0.9 ? 13 : -6,
          c: "var(--ink)", b: 1, s: 10 });
        [0.5, 5].forEach(function (v) { s += gTxt(X(v), 0, r1(v), { a: "middle", dy: 12, s: 9 }); });
        return { svg: s, text: "Kuşak başına " + r2(m0) + " göçmenlik bir alışverişte, çeşitliliğin %" +
          r0(f0 * 100) + "'i gruplar arasında, %" + r0((1 - f0) * 100) + "'i grupların içinde kalıyor. " +
          "Şaşırtıcı olan, kuşakta tek bir göçmenin bile farklılaşmayı büyük ölçüde engellemesi. " +
          "İnsanda ölçülen değer 0,12 civarındadır: çeşitliliğin yaklaşık yüzde seksen sekizi grupların içindedir. " +
          "Rastgele iki insan arasındaki genetik farkın büyük kısmı, hangi kıtadan geldiklerinden bağımsızdır." };
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

  /* ================= kütüphane ================= */

  /* Kütüphanedeki gruplar ve gösterim sırası; kurs künyesindeki `category`
     buraya bakar. Tek grup kalırsa başlıklar gizlenir. */
  var CATEGORIES = [
    ["gunumuz", "Bugünü anlamak"],
    ["klasik", "Klasikler"]
  ];

  function renderLibrary() {
    head("Okul", "Kütüphane",
      "Her kurs on iki ders, otuz altı soru ve bir sözlükten oluşur. İlerlemen bu tarayıcıda saklanır.");

    var out = el("div", { class: "stack" });
    var entries = libraryEntries();

    /* --- kütüphane --- */
    var lib = el("section", null, [
      el("div", { class: "row", style: "margin-bottom:.8rem" }, [
        el("p", { class: "label", style: "margin:0", text: entries.length + " kurs" }),
        streakNow() > 0 ? el("span", { class: "chip", text: streakNow() + " gün seri" }) : null
      ])
    ]);

    if (!entries.length) {
      lib.appendChild(el("p", { class: "card center small muted",
        text: loadError ? "Kurs listesi yüklenemedi: " + loadError : "Kütüphane boş." }));
    } else {
      /* Kurs sayısı arttıkça düz liste okunmuyor; kategorilere ayır.
         Tek küme kalıyorsa başlığa gerek yok. */
      var groups = CATEGORIES.map(function (pair) {
        return [pair[1], entries.filter(function (e) { return (e.category || "gunumuz") === pair[0]; })];
      }).filter(function (g) { return g[1].length; });

      groups.forEach(function (g, i) {
        if (groups.length > 1) {
          lib.appendChild(el("p", { class: "label muted", style: "margin:" + (i ? "1.6rem" : "0") + " 0 .6rem",
            text: g[0] + " · " + g[1].length }));
        }
        var grid = el("div", { class: "grid" });
        g[1].forEach(function (e) { grid.appendChild(courseCard(e)); });
        lib.appendChild(grid);
      });
    }
    out.appendChild(lib);

    out.appendChild(el("button", { class: "block card row", style: "margin-top:1.6rem",
      onclick: function () { go("ayarlar"); } }, [
      el("div", null, [
        el("p", { class: "label", text: "Ayarlar" }),
        el("p", { class: "small muted", style: "margin:.25rem 0 0", text: "Yedekleme ve uygulama" })
      ]),
      el("span", { class: "chev", text: "→" })
    ]));

    view.appendChild(out);
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
    return card;
  }

  /* ================= uygulama ayarları ================= */
  function renderAppSettings() {
    head("Okul", "Ayarlar", null);
    var out = el("div", { class: "stack" });

    /* --- yedekleme --- */
    var ta = el("textarea", { class: "typed mono", rows: "4", "aria-label": "Yedek verisi",
      placeholder: "Buraya bir yedek yapıştırıp geri yükleyebilirsin" });
    var msg = el("p", { class: "small muted", style: "margin:.5rem 0 0" });

    out.appendChild(el("section", { class: "card stack" }, [
      el("p", { class: "label", text: "Yedekle ve geri yükle" }),
      el("p", { class: "small muted", style: "margin:0",
        text: "Yedek; ilerlemeni ve ayarlarını içerir. Başka bir cihaza taşımak için metni kopyala." }),
      ta,
      el("div", { class: "grid2" }, [
        el("button", { class: "btn ghost", text: "Yedeği çıkar", onclick: function () {
          ta.value = JSON.stringify({ okul: 1, state: state });
          ta.focus(); ta.select();
          msg.textContent = "Yedek hazır. Kopyalayıp güvenli bir yere kaydet.";
        } }),
        el("button", { class: "btn ghost", text: "Geri yükle", onclick: function () {
          try {
            var b = JSON.parse(ta.value);
            if (!b || b.okul !== 1 || !b.state) throw new Error("bad");
            if (!window.confirm("Mevcut ilerlemenin üzerine yazılsın mı?")) return;
            /* Eski yedeklerde üretilmiş kurs verisi ve API anahtarı olabilir;
               ikisi de artık kullanılmıyor, alınmaz. */
            state = adopt(b.state);
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
        if (!window.confirm("Tüm ilerleme ve ayarlar silinsin mi?")) return;
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
