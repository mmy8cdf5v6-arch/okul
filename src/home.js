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
