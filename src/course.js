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
