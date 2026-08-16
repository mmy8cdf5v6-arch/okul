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

      action.appendChild(el("button", {
        class: "btn wide", text: "“" + route.query.trim() + "” için kurs oluştur",
        onclick: function () { requestGeneration(route.query.trim()); }
      }));
      if (!state.apiKey) {
        action.appendChild(el("p", { class: "small muted", style: "margin:.6rem 0 0",
          text: "Bunun için önce Ayarlar'dan kendi API anahtarını eklemelisin." }));
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
