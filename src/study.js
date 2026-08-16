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
