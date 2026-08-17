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
    }
  };
