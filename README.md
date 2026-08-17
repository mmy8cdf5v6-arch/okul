# Okul

Dersler, sınavlar, etkileşimli grafikler, aralıklı tekrar kartları ve zaman
çizelgesiyle Türkçe öğrenme kütüphanesi.

Sunucusu yok: statik bir site olarak çalışır ve ilerleme tarayıcıda saklanır.
Kurslar elle yazılıp depoya işlenir; uygulamanın kendisi yalnızca onları okur.

## Nasıl çalışır

**Kütüphane.** Ana ekranda kurs kartları var; her kart ilerlemeyi gösterir.
Kütüphane kategorilere ayrılır (Bugünü anlamak / Klasikler); kategori, kursun
künyesindeki `category` alanından gelir. Tek kategori kalırsa başlıklar gizlenir.

Kurslar: **İktisat Defteri** (35 ders, 105 soru, 21 grafik) ve her biri
12 ders / 36 soruluk **Finans**, **İstatistik okuryazarlığı**, **Sanat tarihi**,
**Olasılık ve karar**, **Müzik teorisi**, **Yapay zekâ okuryazarlığı**,
**Felsefe tarihi**, **İklim ve enerji**, **Astronomi**, **Medya
okuryazarlığı**, **Mimarlık tarihi**, **Sağlık okuryazarlığı**,
**Evrim biyolojisi**, **Psikoloji**, **Antropoloji**. Program ve modül
iskeletleri `content/PLAN.md` içinde.

**Ders.** Her ders metin, liste, örnek, alıntı, formül ve grafik bölümlerinden
kurulur, sonunda üç soruluk bir sınav vardır. Dersin ikide ikisi doğru
yanıtlandığında tamamlanmış sayılır.

**Çalışma.** Sözlük ve kişiler otomatik olarak karta dönüşür; kartlar beş kutulu
aralıklı tekrar takvimiyle (0, 1, 3, 7, 21 gün) gelir. Ayrıca deneme sınavı,
yanlışların istatistiği ve kurs içi arama var.

**Grafikler.** 80 etkileşimli SVG grafik elle yazılmış koddur. Hepsi gerçek bir
hesap yapar, kaydırıcıya bağlıdır ve rastgelelik kullanmaz; renkler CSS
değişkenlerinden gelir, böylece koyu temada da çalışır.

**Depolama.** İlerleme, ayarlar ve kart takvimi `localStorage`'da tutulur.
Sunucu, hesap ve çerez yoktur. Ayarlardan metin biçiminde yedek alınıp başka bir
cihaza taşınabilir.

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
│  ├─ mimarlik.json
│  ├─ saglik.json
│  ├─ evrim.json
│  ├─ psikoloji.json
│  └─ antropoloji.json
├─ content/                elle yazılan kaynak metin
│  ├─ PLAN.md              kurs programı ve modül iskeletleri
│  ├─ <kurs>-a.json        ders dizisi (b, c… diye devam eder)
│  ├─ <kurs>-refs.json     künye, modüller, sözlük, isimler, çizelge, grafik yerleşimi
│  └─ build_course.py      content/ → courses/<kurs>.json + index girdisi
├─ src/
│  ├─ core.js              durum, depolama, yönlendirme, kabuk
│  ├─ charts.js            SVG grafik motoru + 80 grafik
│  ├─ course.js            kurs özeti, dersler, ders, ders içi sınav, tarih
│  ├─ study.js             kartlar, deneme sınavı, istatistik, arama
│  ├─ home.js              kütüphane ve ayarlar
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

Test kendi statik sunucusunu ayağa kaldırır. Kütüphane, kurs açma, vurgu renginin
uygulanması, ders tamamlama, kartlar, deneme sınavı, istatistikler, tarih sekmesi,
arama, yedekleme, koyu tema ve 320/390/768 px'te yatay taşma denetlenir. En uzun
adım grafik süpürmesidir: **her kursun her grafiği** açılır, bütün kaydırıcılar
en küçük ve en büyük değerlerine sürülür, bütün seçenek düğmelerine basılır ve
hem okunan metinde hem SVG'de `NaN`/`Infinity` aranır.

## Yayın

GitHub Pages: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
`assets/` derlenmiş hâliyle depoda durduğu için ayrıca bir derleme adımı gerekmez —
ama `src/` değiştirdiğinde `python3 build.py` çalıştırıp çıktıyı da işlemen gerekir.

`build.py`, `index.html` içindeki varlık adreslerine içerik damgası basar
(`assets/app.js?v=64ab7299`). Adres değişmediği sürece tarayıcı eski kopyayı
yeniden indirmez; damga olmadan yeni sürüm yayımlansa bile kullanıcı eski
uygulamayı görmeye devam eder. Duman testi damganın güncel olduğunu doğrular.

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

Her şey tarayıcıda kalır: ilerleme ve ayarlar `okul-v1` anahtarında tutulur.
Sunucu, hesap, çerez ve dış istek yoktur; site yalnızca kendi `courses/*.json`
dosyalarını okur. **Ayarlar → Yedekle ve geri yükle** ile ilerlemeni metin olarak
dışa aktarıp başka bir cihaza taşıyabilirsin.

Daha önceki sürümde isteğe bağlı bir kurs üretme özelliği vardı ve kullanıcının
Anthropic API anahtarını `localStorage`'da saklıyordu. Özellik kaldırıldı; o
sürümü kullanmış tarayıcılarda kalan anahtar ve üretilmiş kurs verisi ilk açılışta
depodan silinir.
