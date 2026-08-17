/**
 * Okul — tarayıcı duman testi.
 *   python3 build.py && node test/smoke.mjs [--shots]
 *
 * Hazır kütüphaneyi uçtan uca gezer: kurslar açılır, dersler okunur, her
 * kursun her grafiği uç değerlerinde çizdirilir, ilerleme ve yedek sınanır.
 */
import fs from "fs";
import path from "path";
import http from "http";
import crypto from "crypto";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const SHOTS = process.argv.includes("--shots");

const PW = process.env.PLAYWRIGHT_MODULE || "playwright";
const { chromium } = await import(PW);
const executablePath = process.env.CHROMIUM || undefined;

if (!fs.existsSync(path.join(ROOT, "assets", "app.js"))) {
  console.error("assets/app.js yok — önce `python3 build.py` çalıştır.");
  process.exit(1);
}

/* --- statik sunucu (fetch file:// üzerinden çalışmaz) --- */
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end("yok");
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

if (SHOTS) fs.mkdirSync(path.join(HERE, "shots"), { recursive: true });

const errors = [];
const failures = [];
const browser = await chromium.launch({ executablePath });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("pageerror", e => errors.push("pageerror: " + e.message));

const shot = async name => {
  if (SHOTS) await page.screenshot({ path: path.join(HERE, "shots", name + ".png"), fullPage: true });
};

async function step(name, fn, skipSettle) {
  const before = errors.length;
  try {
    await fn();
    if (!skipSettle) await page.waitForTimeout(100);
    if (errors.length > before) throw new Error("konsol hatası");
    console.log("✓ " + name);
  } catch (e) {
    failures.push(name + " — " + e.message);
    console.log("✗ " + name + " — " + e.message);
  }
}

await page.goto(BASE);
await page.waitForTimeout(400);

await step("varlık adresleri sürüm damgası taşıyor", async () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const [ad, dosya] of [["app.js", "assets/app.js"], ["styles.css", "assets/styles.css"]]) {
    const m = html.match(new RegExp("assets/" + ad.replace(".", "\\.") + "\\?v=([0-9a-f]{8})"));
    if (!m) throw new Error(ad + " adresinde ?v= damgası yok — tarayıcı eski kopyayı sunar");
    const beklenen = crypto.createHash("sha1")
      .update(fs.readFileSync(path.join(ROOT, dosya), "utf8"), "utf8").digest("hex").slice(0, 8);
    if (m[1] !== beklenen) throw new Error(ad + " damgası bayat: " + m[1] + " ≠ " + beklenen + " (python3 build.py çalıştır)");
  }
}, true);

await step("kütüphane yükleniyor", async () => {
  await page.waitForSelector(".course-card");
  const titles = await page.$$eval(".course-title", n => n.map(x => x.textContent));
  if (!titles.includes("İktisat Defteri")) throw new Error("İktisat kartı yok: " + titles);
  const lang = await page.evaluate(() => document.documentElement.lang);
  if (lang !== "tr") throw new Error("kök dil tr değil");
  // .block sıfırlaması kart görünümünü bastırmasın
  const cs = await page.evaluate(() => {
    const c = getComputedStyle(document.querySelector(".course-card"));
    return { bw: c.borderTopWidth, pad: c.paddingTop, bg: c.backgroundColor };
  });
  if (cs.bw === "0px" || cs.pad === "0px") throw new Error("kurs kartı sıfırlanmış: " + JSON.stringify(cs));

  // kurs isteme/üretme arayüzü kaldırıldı
  if (await page.$("input.ask")) throw new Error("konu kutusu hâlâ duruyor");
  if (/kurs oluş|konusunu iste/i.test(await page.textContent("body"))) throw new Error("kurs üretme vaadi hâlâ yazılı");

  // kütüphane kategorilere ayrılmış olmalı ve her kurs bir kümede görünmeli
  const cats = await page.evaluate(() => fetch("courses/index.json").then(r => r.json())
    .then(l => new Set(l.map(e => e.category || "gunumuz")).size));
  const heads = await page.$$eval("section p.label.muted", n => n.map(x => x.textContent));
  if (cats > 1) {
    const counted = heads.reduce((a, h) => a + Number(h.split("·").pop().trim()), 0);
    if (counted !== titles.length) {
      throw new Error("kategori sayıları toplamı kurs sayısını tutmuyor: " + counted + " / " + titles.length);
    }
  } else if (heads.length) {
    throw new Error("tek kategori varken başlık gösterilmemeli: " + heads);
  }
});
await shot("01-kutuphane");

await step("kurs açılıyor ve sekmeler geliyor", async () => {
  await page.click(".course-card");
  await page.waitForSelector("nav.tabs button");
  const tabs = await page.$$eval("nav.tabs button", n => n.map(x => x.querySelector("span:not(.dot)").textContent));
  if (tabs.join(",") !== "Kurs,Dersler,Tarih,Çalış,Ara") throw new Error("sekmeler: " + tabs);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-light").trim());
  if (accent !== "#1b6b4f") throw new Error("kurs vurgu rengi uygulanmadı: " + accent);
});
await shot("02-kurs");

await step("ders ve grafik", async () => {
  await page.click("nav.tabs li:nth-child(2) button");
  await page.locator(".lesson-title", { hasText: "Arz, talep" }).first().click();
  await page.waitForSelector(".chart");
  const before = await page.textContent(".chart-read");
  const slider = await page.$(".chart input[type=range]");
  await slider.evaluate(el => { el.value = el.getAttribute("max"); el.dispatchEvent(new Event("input", { bubbles: true })); });
  if ((await page.textContent(".chart-read")) === before) throw new Error("kaydırıcı ölü");
});

await step("ders sınavı ilerlemeyi kaydediyor", async () => {
  const answers = await page.evaluate(async () => {
    const r = await fetch("courses/iktisat.json"); const c = await r.json();
    return c.lessons.find(l => l.id === "arz-talep-ve-denge").quiz.map(q => q.answerIndex);
  });
  const qcards = page.locator(".card").filter({ has: page.locator(".q-prompt") });
  for (let i = 0; i < answers.length; i++) {
    await qcards.nth(i).locator(".opt").nth(answers[i]).click();
    await page.waitForTimeout(60);
  }
  if (!(await page.textContent("main")).includes("Ders tamamlandı")) throw new Error("tamamlanma kaydedilmedi");
});

await step("kartlar, sınav, istatistik", async () => {
  await page.click("nav.tabs li:nth-child(4) button");
  await page.waitForSelector(".flash");
  await page.click("text=Cevabı göster");
  await page.click("text=Bildim");
  await page.click("text=İstatistik");
  await page.waitForSelector(".stat-grid");
  if ((await page.$$eval(".heat-cell", n => n.length)) !== 28) throw new Error("ısı haritası eksik");
});

await step("kütüphaneye dönüş ilerlemeyi gösteriyor", async () => {
  await page.click("#back");
  await page.waitForSelector(".course-card");
  const pct = await page.textContent(".course-card .course-meta span:last-child");
  if (pct === "%0") throw new Error("kart ilerlemesi güncellenmedi");
});

/* Her hazır kursun her grafiği: başlangıç, en düşük ve en yüksek denetim
   değerinde çiziliyor mu, okuma metni üretiyor mu, NaN sızdırıyor mu.
   Kaydırıcının `def` değeri unutulduğunda grafik sessizce NaN çiziyordu;
   bu süpürme o sınıftan hataları yakalar. */
await step("bütün hazır kursların grafikleri çiziliyor", async () => {
  const plan = await page.evaluate(async () => {
    const index = await (await fetch("courses/index.json")).json();
    const out = [];
    for (const e of index) {
      const c = await (await fetch(e.file)).json();
      const charts = [];
      for (const l of c.lessons) {
        l.sections.filter(s => s.kind === "chart")
          .forEach((s, i) => charts.push({ lesson: l.title, chart: s.chartId, nth: i }));
      }
      out.push({ title: e.title, accent: e.accent, charts, lessons: c.lessons.length });
    }
    return out;
  });

  const seen = new Set();
  for (const course of plan) {
    /* hasText alt dize ve büyük-küçük harf duyarsız eşleşir; "Biyoloji" araması
       "Evrim biyolojisi" kartını da yakalıyordu. Başlığın tamamıyla eşleştir. */
    await page.locator(".course-card").filter({
      has: page.locator(".course-title", { hasText: new RegExp("^" + course.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") })
    }).first().click();
    await page.waitForSelector("nav.tabs button");
    const accent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--accent-light").trim());
    if (accent !== course.accent) throw new Error(course.title + " vurgu rengi: " + accent);

    for (const l of course.charts) {
      await page.click("nav.tabs li:nth-child(2) button");
      await page.locator(".lesson-title", { hasText: l.lesson }).first().click();
      await page.waitForFunction(n => {
        const s = document.querySelectorAll(".chart svg")[n];
        return s && s.children.length > 3;
      }, l.nth);
      seen.add(l.chart);

      const fig = page.locator(".chart").nth(l.nth);
      const texts = [await fig.locator(".chart-read").textContent()];
      const sliders = await fig.locator("input[type=range]").all();
      const segs = await fig.locator(".seg-btn").all();
      if (!sliders.length && !segs.length) throw new Error(l.chart + ": denetim yok");
      for (const bound of ["min", "max"]) {
        for (const s of sliders) {
          await s.evaluate((el, b) => {
            el.value = el.getAttribute(b);
            el.dispatchEvent(new Event("input", { bubbles: true }));
          }, bound);
        }
        await page.waitForTimeout(30);
        texts.push(await fig.locator(".chart-read").textContent());
        const svg = await fig.locator("svg").innerHTML();
        if (/NaN|Infinity/.test(svg)) throw new Error(l.chart + " (" + bound + "): çizimde NaN");
      }
      for (let i = 0; i < segs.length; i++) {
        await segs[i].click();
        await page.waitForTimeout(30);
        texts.push(await fig.locator(".chart-read").textContent());
        const svg = await fig.locator("svg").innerHTML();
        if (/NaN|Infinity/.test(svg)) throw new Error(l.chart + " (seçenek " + i + "): çizimde NaN");
      }
      if (sliders.length && new Set(texts).size === 1) throw new Error(l.chart + ": kaydırıcı ölü");
      for (const t of texts) {
        if (!t.trim()) throw new Error(l.chart + ": okuma metni boş");
        if (/NaN|Infinity|undefined/.test(t)) throw new Error(l.chart + ": okuma metninde " + t);
      }
      await page.click("#back");
    }
    await page.click("#back");
    await page.waitForSelector(".course-card");
  }
  console.log("   " + seen.size + " grafik denendi");
});

await step("finans kursu açılıyor", async () => {
  await page.locator(".course-card").filter({
    has: page.locator(".course-title", { hasText: /^Finans$/ })
  }).click();
  await page.waitForSelector("nav.tabs button");
  const course = await page.evaluate(() => fetch("courses/finans.json").then(r => r.json()));
  if (course.lessons.length !== 12) throw new Error("ders sayısı: " + course.lessons.length);
});

await step("finans kursunda tarih ve arama", async () => {
  await page.click("nav.tabs li:nth-child(3) button");
  await page.waitForSelector("ol.tl li");
  const events = await page.$$eval("ol.tl li", n => n.length);
  if (events !== 22) throw new Error("olay sayısı: " + events);
  await page.click(".chips button:has-text('Modern finans')");
  await page.waitForTimeout(80);
  const filtered = await page.$$eval("ol.tl li", n => n.length);
  if (filtered >= events || filtered === 0) throw new Error("dönem süzgeci: " + filtered);
  await page.click(".seg button:has-text('İsimler')");
  await page.waitForTimeout(80);
  if (!(await page.textContent("main")).includes("Markowitz")) throw new Error("isimler gelmedi");

  await page.click("nav.tabs li:nth-child(5) button");
  await page.fill("input[type=search]", "durasyon");
  await page.waitForTimeout(150);
  if (!(await page.textContent("main")).includes("Durasyon")) throw new Error("arama sözlüğü bulamadı");
  await page.click("#back");
  await page.waitForSelector(".course-card");
});

await step("yeniden yüklemede ilerleme duruyor", async () => {
  await page.reload();
  await page.waitForSelector(".course-card");
  const pct = await page.$$eval(".course-card .num.small:not(.muted)", n => n.map(x => x.textContent));
  if (!pct.some(x => x !== "%0")) throw new Error("ilerleme yeniden yüklemede kayboldu: " + pct);
});

await step("yedekle ve geri yükle", async () => {
  await page.click(".block.card.row:has-text('Ayarlar')");
  await page.click("text=Yedeği çıkar");
  const b = JSON.parse(await page.inputValue("textarea.mono"));
  if (b.okul !== 1 || !b.state || !b.state.courses) throw new Error("yedek beklenen biçimde değil");
  if (Object.keys(b.state.courses).length === 0) throw new Error("yedekte ilerleme yok");
  if (b.state.apiKey) throw new Error("yedeğe API anahtarı sızmış");
  if (b.state.generated) throw new Error("yedeğe üretilmiş kurs sızmış");
  /* kaldırılan üretim ekranından iz kalmamalı */
  const txt = await page.textContent("main");
  if (/API anahtar|Üretim modeli|Oluşturduğun kurslar/.test(txt)) throw new Error("ayarlarda üretim izi kaldı");
});

await step("koyu tema", async () => {
  const dark = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", deviceScaleFactor: 2 });
  const p2 = await dark.newPage();
  p2.on("pageerror", e => errors.push("pageerror: " + e.message));
  await p2.goto(BASE);
  await p2.waitForSelector(".course-card");
  const bg = await p2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const rgb = bg.match(/\d+/g).map(Number);
  if (rgb[0] + rgb[1] + rgb[2] > 200) throw new Error("koyu temada zemin açık: " + bg);
  if (SHOTS) await p2.screenshot({ path: path.join(HERE, "shots", "05-koyu.png"), fullPage: true });
  for (const w of [320, 390, 768]) {
    await p2.setViewportSize({ width: w, height: 800 });
    await p2.waitForTimeout(120);
    if (await p2.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))
      throw new Error(w + "px'te yatay taşma");
  }
  await dark.close();
}, true);

await browser.close();
server.close();

if (errors.length) console.log("\nkonsol/sayfa hataları:\n" + errors.join("\n"));
if (failures.length) { console.log("\n" + failures.length + " adım başarısız."); process.exit(1); }
console.log("\nTüm adımlar geçti, konsol hatası yok.");
