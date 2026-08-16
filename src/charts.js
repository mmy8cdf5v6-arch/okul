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
