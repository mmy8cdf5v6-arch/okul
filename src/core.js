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
