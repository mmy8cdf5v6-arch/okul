/**
 * Okul — tarayıcı duman testi.
 *   python3 build.py && node test/smoke.mjs [--shots]
 *
 * Üretim akışı, api.anthropic.com'a giden fetch çağrıları sahteleştirilerek
 * uçtan uca denenir; gerçek bir API anahtarı gerekmez.
 */
import fs from "fs";
import path from "path";
import http from "http";
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

/* --- sahte Anthropic API --- */
await page.route("https://api.anthropic.com/**", async route => {
  const body = JSON.parse(route.request().postData());
  const props = Object.keys(body.output_config.format.schema.properties).sort().join(",");
  let payload;

  if (props.includes("modules")) {
    payload = {
      title: "Sanat Tarihi", eyebrow: "Sanat tarihi", subtitle: "Bakmayı öğrenmek",
      description: "Mağara resminden çağdaş sanata biçimlerin ve fikirlerin tarihi.",
      icon: "🎨", accent: "#8a3d63", figuresLabel: "Sanatçılar",
      timelineTitle: "Biçimlerin tarihi", timelineIntro: "Mağaradan müzeye.",
      modules: [
        { id: "temeller", title: "Temeller", description: "Bakmanın araçları.", lessons: [
          { id: "bicim", title: "Biçim ve kompozisyon", subtitle: "Bir resmi neye göre okuruz?", minutes: 8, keyTerms: ["kompozisyon", "denge"] },
          { id: "renk", title: "Renk ve ışık", subtitle: "Rengin taşıdığı anlam.", minutes: 7, keyTerms: ["palet", "chiaroscuro"] },
          { id: "perspektif", title: "Perspektif", subtitle: "Derinliğin icadı.", minutes: 9, keyTerms: ["kaçış noktası"] }
        ]},
        { id: "donemler", title: "Dönemler", description: "Rönesanstan moderne.", lessons: [
          { id: "ronesans", title: "Rönesans", subtitle: "İnsanın ölçü olması.", minutes: 9, keyTerms: ["hümanizm"] },
          { id: "barok", title: "Barok", subtitle: "Hareket ve karşıtlık.", minutes: 8, keyTerms: ["tenebrizm"] },
          { id: "modern", title: "Modern sanat", subtitle: "Kırılma.", minutes: 9, keyTerms: ["avangart"] }
        ]}
      ]
    };
  } else if (props === "quiz,sections") {
    payload = {
      sections: [
        { kind: "text", title: "", body: "Bir yapıtın önce biçimine bakılır: çizgi, kütle ve boşluğun düzeni.", items: [], expression: "", note: "", text: "", source: "" },
        { kind: "text", title: "Denge", body: "Simetri tek denge biçimi değildir; ağırlıklar renk ve dokuyla da kurulur.", items: [], expression: "", note: "", text: "", source: "" },
        { kind: "list", title: "Bakarken sorulacaklar", body: "", items: ["Göz nereye çekiliyor?", "Işık nereden geliyor?", "Boşluk neyi taşıyor?"], expression: "", note: "", text: "", source: "" },
        { kind: "example", title: "Örnek: Las Meninas", body: "Velázquez izleyiciyi tablonun içine yerleştirir.", items: [], expression: "", note: "", text: "", source: "" },
        { kind: "quote", title: "", body: "", items: [], expression: "", note: "", text: "Resim sessiz şiirdir.", source: "Simonides'e atfedilir" }
      ],
      quiz: [
        { id: "q1", prompt: "Kompozisyon nedir?", options: ["Renk karışımı", "Öğelerin yüzeydeki düzeni", "Tuval boyutu", "Çerçeve türü"], answerIndex: 1, explanation: "Kompozisyon, öğelerin düzenlenişidir." },
        { id: "q2", prompt: "Denge yalnızca simetriyle mi kurulur?", options: ["Evet", "Hayır, renk ve dokuyla da kurulur", "Yalnızca heykelde", "Yalnızca modern sanatta"], answerIndex: 1, explanation: "Asimetrik denge yaygındır." },
        { id: "q3", prompt: "Negatif alan nedir?", options: ["Boyanmamış tuval", "Nesneler arasındaki boşluk", "Koyu renkler", "Arka plan rengi"], answerIndex: 1, explanation: "Boşluk da kompozisyonun parçasıdır." }
      ]
    };
  } else if (props === "figures,glossary") {
    payload = {
      glossary: [
        { id: "kompozisyon", term: "Kompozisyon", definition: "Öğelerin yüzey üzerindeki düzeni.", lessonId: "bicim" },
        { id: "chiaroscuro", term: "Chiaroscuro", definition: "Işık ve gölgenin sert karşıtlığı.", lessonId: "renk" },
        { id: "perspektif", term: "Perspektif", definition: "Derinlik yanılsaması kuran çizim düzeni.", lessonId: "perspektif" }
      ],
      figures: [
        { id: "velazquez", name: "Diego Velázquez", lifespan: "1599-1660", tag: "Barok", oneLiner: "Bakışın kendisini resmetti.", contributions: ["Las Meninas", "Saray portreleri"], lessonId: "barok" },
        { id: "picasso", name: "Pablo Picasso", lifespan: "1881-1973", tag: "Kübizm", oneLiner: "Biçimi parçalayıp yeniden kurdu.", contributions: ["Avignonlu Kızlar", "Guernica"], lessonId: "modern" }
      ]
    };
  } else {
    payload = {
      eras: [{ id: "erken", label: "Erken dönem" }, { id: "modern", label: "Modern" }],
      events: [
        { id: "ronesans-baslar", year: 1400, yearLabel: "1400'ler", title: "Rönesans başlar", body: "Floransa'da yeni bir resim anlayışı doğar.", era: "erken", figureId: "" },
        { id: "guernica", year: 1937, yearLabel: "1937", title: "Guernica", body: "Picasso savaşın tanıklığını resme çevirir.", era: "modern", figureId: "picasso" }
      ]
    };
  }

  const json = JSON.stringify(payload);
  const sse = [
    `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { usage: { input_tokens: 900 } } })}\n\n`,
    ...chunk(json, 400).map(t =>
      `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })}\n\n`),
    `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 2600 } })}\n\n`
  ].join("");

  await route.fulfill({ status: 200, contentType: "text/event-stream", body: sse });
});

function chunk(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

await page.goto(BASE);
await page.waitForTimeout(400);

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

await step("anahtarsız üretim ayarlara yönlendiriyor", async () => {
  await page.fill("input.ask", "sanat tarihi");
  await page.click("text=için kurs oluştur");
  await page.waitForSelector("input[placeholder='sk-ant-...']");
});

await step("API anahtarı kaydediliyor", async () => {
  await page.fill("input[placeholder='sk-ant-...']", "sk-ant-test-anahtar");
  await page.click("text=Kaydet");
  await page.waitForTimeout(150);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("okul-v1")).apiKey);
  if (stored !== "sk-ant-test-anahtar") throw new Error("anahtar kaydedilmedi");
});

await step("kurs üretimi uçtan uca", async () => {
  await page.click(".btn.quiet:has-text('Kütüphaneye dön')");
  await page.fill("input.ask", "sanat tarihi");
  await page.click("text=için kurs oluştur");
  await page.waitForSelector("text=Kursu aç", { timeout: 30000 });
  const txt = await page.textContent("main");
  if (!/Sanat Tarihi/.test(txt)) throw new Error("üretilen kurs adı yok");
  if (!/6 ders/.test(txt)) throw new Error("ders sayısı beklenmedik: " + txt.slice(0, 200));
  if (!/\(6\/6\)/.test(txt)) throw new Error("ders sayacı yanlış: " + (txt.match(/Dersler yazılıyor [^\n]*/) || [])[0]);
  if (!/Yaklaşık maliyet/.test(txt)) throw new Error("maliyet gösterilmiyor");
});
await shot("03-uretim");

await step("üretilen kurs açılıyor ve çalışıyor", async () => {
  await page.click("text=Kursu aç");
  await page.waitForSelector("nav.tabs button");
  const title = await page.textContent("#title");
  if (title !== "Sanat Tarihi") throw new Error("başlık: " + title);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-light").trim());
  if (accent !== "#8a3d63") throw new Error("üretilen kursun rengi uygulanmadı: " + accent);
  await page.click("nav.tabs li:nth-child(2) button");
  const rows = await page.$$eval(".lesson-row", n => n.length);
  if (rows !== 6) throw new Error("ders satırı: " + rows);
  await page.locator(".lesson-title").first().click();
  await page.waitForSelector(".q-prompt");
  if ((await page.$$eval(".prose p", n => n.length)) < 2) throw new Error("ders metni boş");
  if (await page.$(".chart")) throw new Error("üretilen kursta grafik olmamalı");
});
await shot("04-uretilen-ders");

await step("üretilen kursta tarih sekmesi", async () => {
  await page.click("nav.tabs li:nth-child(3) button");
  await page.waitForSelector(".tl li");
  const n = await page.$$eval(".tl li", x => x.length);
  if (n !== 2) throw new Error("olay sayısı: " + n);
  await page.click("text=Sanatçılar");
  await page.waitForSelector(".thinker-name");
});

await step("yeniden yüklemede kurs ve ilerleme duruyor", async () => {
  await page.reload();
  await page.waitForSelector(".course-card");
  const titles = await page.$$eval(".course-title", n => n.map(x => x.textContent));
  if (!titles.includes("Sanat Tarihi")) throw new Error("üretilen kurs kayboldu: " + titles);
  if ((await page.$$eval(".badge", n => n.length)) !== 1) throw new Error("rozet yok");
});

await step("yedekle ve geri yükle", async () => {
  await page.click(".block.card.row:has-text('Ayarlar')");
  await page.click("text=Yedeği çıkar");
  const v = await page.inputValue("textarea.mono");
  const b = JSON.parse(v);
  if (!b.courses || !Object.keys(b.courses).length) throw new Error("yedek üretilen kursu içermiyor");
  if (b.state.apiKey) throw new Error("yedeğe API anahtarı sızmış");
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
