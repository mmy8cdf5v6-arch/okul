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
