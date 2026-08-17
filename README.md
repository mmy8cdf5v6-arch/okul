# Okul

Bir konu yaz, kurs oluşsun. Dersler, sınavlar, aralıklı tekrar kartları ve zaman
çizelgesiyle Türkçe öğrenme uygulaması.

Sunucusu yok: statik bir site olarak çalışır, ilerleme tarayıcıda saklanır, kurs
üretimi kullanıcının kendi Anthropic API anahtarıyla doğrudan tarayıcıdan yapılır.

## Nasıl çalışır

**Kütüphane.** Ana ekranda bir kutu ve kurs kartları var. Kutuya bir konu
yazdığında önce kütüphanende eşleşen kurs aranır. Yoksa iki yol açılır: o konuyu
depoya bir istek olarak göndermek (kimseden anahtar istemez) ya da kendi API
anahtarınla o an üretmek. Üretilen kurslar kütüphanede kalır ve tıklanarak
yeniden açılır.

Kütüphane kategorilere ayrılır (Bugünü anlamak / Klasikler / Senin
oluşturdukların); kategori, kursun künyesindeki `category` alanından gelir.

Hazır kurslar: **İktisat Defteri** (35 ders, 105 soru, 21 grafik) ve her biri
12 ders / 36 soruluk **Finans**, **İstatistik okuryazarlığı**, **Sanat tarihi**,
**Olasılık ve karar**, **Müzik teorisi**, **Yapay zekâ okuryazarlığı**,
**Felsefe tarihi**, **İklim ve enerji**, **Astronomi**, **Medya
okuryazarlığı**, **Mimarlık tarihi**. Sıradaki kurslar
`content/PLAN.md` içinde programlandı.

**Üretim.** Dört aşamada ilerler ve her aşama ekranda görünür:

1. **Plan** — konudan 3-4 modül ve 10-14 ders başlığı çıkarılır (1 istek).
2. **Dersler** — her ders ayrı bir istekle yazılır, ikisi aynı anda çalışır
   (ders sayısı kadar istek).
3. **Sözlük ve kişiler** — kavramlar ve alanın önemli kişileri derslere bağlanır (1 istek).
4. **Zaman çizelgesi** — dönemler ve olaylar (1 istek).

Her istek [yapılandırılmış çıktı](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
kullanır (`output_config.format`), böylece model her zaman şemaya uyan JSON döner
ve ayrıştırma kırılgan olmaz. Yanıtlar akış hâlinde okunur; üretim iptal edilebilir.
Bittiğinde gerçek token kullanımına dayalı kaba bir maliyet gösterilir.

**API anahtarı.** Ayarlar bölümünde saklanır — yalnızca `localStorage`'da, yalnızca
o tarayıcıda. Siteye ait bir sunucu olmadığı için anahtar başka hiçbir yere gitmez;
istekler doğrudan tarayıcıdan `api.anthropic.com` adresine yapılır
(`anthropic-dangerous-direct-browser-access` başlığıyla).

> Bunun anlamı: **paylaştığın linki açan başka biri kurs üretemez**, çünkü onun
> anahtarı yoktur. Kendi anahtarını girerse üretebilir ve maliyeti ona yansır.
> Ortak kullanılan bir bilgisayarda anahtar bırakma.

**Grafikler.** 58 interaktif SVG grafik elle yazılmış koddur ve yalnızca hazır
kurslarda görünür. Üretilen kurslarda metin, liste, örnek, alıntı, formül
bölümleri, sınav, sözlük, kişiler ve zaman çizelgesi bulunur.

## Yapı

```
okul/
├─ index.html              site kabuğu
├─ assets/                 derlenmiş çıktı (depoya işlenir — Pages bunu sunar)
│  ├─ app.js
│  └─ styles.css
├─ courses/                sunulan kurs verisi (küçültülmüş JSON)
│  ├─ index.json           kütüphane listesi
│  ├─ iktisat.json
│  ├─ finans.json
│  ├─ istatistik.json
│  ├─ sanat-tarihi.json
│  ├─ olasilik.json
│  ├─ muzik.json
│  ├─ yapay-zeka.json
│  ├─ felsefe.json
│  ├─ iklim.json
│  ├─ astronomi.json
│  ├─ medya.json
│  └─ mimarlik.json
├─ content/                elle yazılan kaynak metin
│  ├─ PLAN.md              kurs programı ve modül iskeletleri
│  ├─ <kurs>-a.json        ders dizisi (b, c… diye devam eder)
│  ├─ <kurs>-refs.json     künye, modüller, sözlük, isimler, çizelge, grafik yerleşimi
│  └─ build_course.py      content/ → courses/<kurs>.json + index girdisi
├─ src/
│  ├─ core.js              durum, depolama, yönlendirme, kabuk
│  ├─ charts.js            SVG grafik motoru + 65 grafik
│  ├─ course.js            kurs özeti, dersler, ders, ders içi sınav, tarih
│  ├─ study.js             kartlar, deneme sınavı, istatistik, arama
│  ├─ generate.js          Anthropic API istemcisi + üretim hattı
│  ├─ home.js              kütüphane, üretim kutusu, ayarlar
│  ├─ boot.js              başlatma
│  └─ styles.css
├─ build.py                src/ → assets/
└─ test/smoke.mjs          Playwright duman testi
```

`src/` içindeki JS dosyaları tek bir IIFE'nin ardışık parçalarıdır; ayrı ayrı
çalıştırılamaz, yalnızca `build.py` tarafından bu sırayla birleştirilir.

## Geliştirme

```bash
python3 build.py                 # assets/ üretir
python3 -m http.server 8000      # sonra http://localhost:8000
```

`file://` üzerinden açma — `courses/*.json` için `fetch` çalışmaz.

## Test

```bash
python3 build.py
node test/smoke.mjs              # Playwright gerekir
node test/smoke.mjs --shots      # test/shots/ altına ekran görüntüleri
```

Playwright ya da Chromium standart yerde değilse:

```bash
PLAYWRIGHT_MODULE=/yol/playwright/index.mjs CHROMIUM=/yol/chrome node test/smoke.mjs
```

Test kendi statik sunucusunu ayağa kaldırır ve **`api.anthropic.com` çağrılarını
sahteleştirir**, böylece üretim hattı gerçek bir anahtar olmadan uçtan uca denenir:
plan → dersler → sözlük → çizelge → kaydetme → üretilen kursu açma. Ayrıca kütüphane,
kurs vurgu renginin uygulanması, grafik kaydırıcıları, ders tamamlama, kartlar,
istatistikler, yedekleme, koyu tema ve 320/390/768 px'te yatay taşma denetlenir.

## Yayın

GitHub Pages: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
`assets/` derlenmiş hâliyle depoda durduğu için ayrıca bir derleme adımı gerekmez —
ama `src/` değiştirdiğinde `python3 build.py` çalıştırıp çıktıyı da işlemen gerekir.

## Hazır kurs eklemek

`courses/` altına bir JSON koy ve `courses/index.json` listesine bir satır ekle.
Tek dosya elle bakılamayacak kadar büyürse `content/` altında parçalara ayır ve
derleyiciyle birleştir:

```bash
python3 content/build_course.py istatistik   # tek kurs
python3 content/build_course.py --all        # content/ altındaki bütün kurslar
```

Beklenen dosyalar `content/<kimlik>-refs.json` (künye, modüller, sözlük,
isimler, çizelge) ve `content/<kimlik>-a.json` (ders dizisi; b, c… diye devam
edebilir). Betik ders kimliklerinin tekilliğini, her dersin tanımlı bir modüle
bağlı olduğunu, bölüm türlerinin zorunlu alanlarını, sınav cevaplarının seçenek
aralığında olduğunu, sözlük ve isim girdilerinin var olan derslere işaret
ettiğini, çizelge olaylarının tanımlı dönem ve isimleri kullandığını denetler;
sonra `courses/<kimlik>.json` ile `courses/index.json` girdisini yazar.

Kurs nesnesi:

| Alan | Açıklama |
|---|---|
| `id`, `title`, `eyebrow`, `subtitle`, `description` | kimlik ve tanıtım metinleri |
| `icon` | kart üzerindeki emoji |
| `accent`, `accentDark` | açık ve koyu temadaki vurgu renkleri |
| `figuresLabel` | kişiler bölümünün adı (`Düşünürler`, `Sanatçılar`…) |
| `timelineTitle`, `timelineIntro` | tarih sekmesinin başlığı ve girişi |
| `modules[]` | `id`, `title`, `description` |
| `lessons[]` | `id`, `moduleId`, `order`, `title`, `subtitle`, `minutes`, `keyTerms[]`, `sections[]`, `quiz[]` |
| `glossary[]` | `id`, `term`, `definition`, `lessonId` |
| `figures[]` | `id`, `name`, `lifespan`, `tag`, `oneLiner`, `contributions[]`, `quote`, `lessonId` |
| `timeline[]` | `id`, `year`, `yearLabel`, `title`, `body`, `era`, `figureId` |
| `eraLabels` | dönem kimliği → etiket |

Ders bölümü türleri: `text` (`title?`, `body`), `list` (`title`, `items[]`),
`example` (`title`, `body`), `quote` (`text`, `source`), `formula`
(`title`, `expression`, `note`), `chart` (`chartId` — yalnızca elle yazılmış grafikler).

Yeni grafik eklemek için `src/charts.js` içindeki `CHARTS` sözlüğüne, girintisi dört
boşluk olan `"kimlik": {` satırıyla başlayan bir kayıt ekle. Koordinatlar 0–1 birim
uzayındadır ve renkler daima CSS değişkenlerinden alınır, böylece grafikler koyu
temada da çalışır. Her kaydırıcı denetimi bir `def` değeri taşımalıdır; `build.py`
hem bunu hem de derste geçen her `chartId`'nin tanımlı olduğunu doğrular. Duman
testi ayrıca her hazır kursun her grafiğini başlangıç, en düşük ve en yüksek
kaydırıcı değerinde ve her seçmeli denetim seçeneğinde çizip NaN sızıp
sızmadığına bakar.

## Veri ve gizlilik

Her şey tarayıcıda kalır: ilerleme ve ayarlar `okul-v1` anahtarında, üretilen her
kurs `okul-course-<id>` anahtarında. Sunucuya hiçbir veri gitmez. **Ayarlar →
Yedekle ve geri yükle** ile ilerlemeni ve kurslarını metin olarak dışa aktarıp başka
bir cihaza taşıyabilirsin; API anahtarı yedeğe konmaz.
