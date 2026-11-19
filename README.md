# Mola — Çevrimdışı Destekli Tuvalet Bulucu & İşletme Geçiş Ağı

**Mola**, şehir içinde acil tuvalet ihtiyacı duyulduğunda kullanıcıları en yakın **ücretsiz halka açık tuvaletlere** ve **anlaşmalı kafe/restoran tuvaletlerine** ulaştıran, **çevrimdışı çalışma (PWA)** desteğine sahip ve **kullanıcı ile işletmeler arasında karşılıklı fayda** kuran mobil-öncelikli bir web uygulamasıdır.

---

## Uygulamanın Amacı ve Karşılıklı Fayda Modeli

Şehir yaşamında temiz ve ulaşılabilir tuvalet bulmak çoğu zaman zordur; internet bağlantısının zayıf olduğu sokaklarda, metrolarda veya parklarda bu ihtiyaç daha da büyür. Öte yandan kafeler ve restoranlar, müşteri olmayan kişilerin tuvalet kullanımından kaynaklanan yoğunluk ve maliyet nedeniyle kapılarını kapalı tutar. **Mola**, iki taraf için de kazandıran bir ekosistem kurar:

- **Kullanıcılar İçin Fayda:**
  - Çekinmeden, sıra beklemeden veya görevliyle açıklama yapmadan **tek kullanımlık QR bilet** ya da **kapı şifresi (PIN)** ile anlaşmalı işletme tuvaletlerini kullanabilme.
  - Ücretsiz belediye/park tuvaletlerini açık/kapalı durumu, erişilebilirlik (engelli, bebek bakım), puan, mesafe ve adım adım konum tarifiyle tek haritada görme.
  - Uygulamaya ilk girişte konum izniyle anında en yakın noktaları listeleme ve anlaşmalı mekanlarda **misafir avantajlarından** (ör. kahve/ürün indirimi) yararlanma.
- **İşletmeler İçin Fayda:**
  - Mevcut tuvalet kapasitesini gelir kaynağına dönüştürme (**%85 işletme payı / %15 platform komisyonu**).
  - Tuvalet kullanımı üzerinden dükkana giren kullanıcılara indirim/avantaj notları sunarak **yeni müşteri ve ek satış** kazanma.
  - Kasa QR doğrulama, brüt/komisyon/net gelir takibi, TR IBAN ile para çekme ve müşteri yorumlarını tek panelden yönetme.

---

## Çevrimdışı Çalışma (PWA & Service Worker)

Acil bir durumda internet bağlantısı kesilse veya zayıflasa bile Mola çalışmaya devam eder:

- **App Shell Önbellekleme:** Service Worker (`sw.js`), uygulama kabuğunu, statik varlıkları ve `manifest.webmanifest` dosyasını önbellekte tutar.
- **Tuvalet Listesi Önbelleği (`/api/toilets`):** Network-first (önce ağ, hata durumunda önbellek) stratejisi sayesinde daha önce yüklenen tuvalet konumları, adresleri, kapı şifreleri ve tarifler internet yokken de görüntülenebilir.
- **Ana Ekrana Ekleme:** PWA desteği sayesinde mobil cihazlarda uygulama gibi kurulabilir.

---

## Temel Özellikler

### Kullanıcı Modu
- **İnteraktif Harita & Akıllı Kümeleme:** Leaflet tabanlı harita üzerinde ücretsiz noktalar, anlaşmalı işletmeler ve durum (açık, bakımda, kapalı) göstergeleri.
- **Hızlı Filtreleme & Arama:** Semt/mekan araması; tek satırda *Tümü*, *Ücretsiz*, *İşletme*, *Kapalılar*, *Engelli* ve *Bebek* filtreleri.
- **Temassız Giriş & Dijital Cüzdan:** Kart/3D Secure adımlarıyla cüzdana bakiye yükleme, tek kullanımlık **QR Bilet** veya **Kapı Şifresi (PIN)** alma ve aktif/geçmiş biletleri görüntüleme.
- **Topluluk Katkısı:** Konum doğrulamalı bakım/durum bildirimi, açılış/kapanış saati güncelleme önerisi, yeni ücretsiz tuvalet önerme ve yorum/puanlama.

### İşletme Modu
- **3 Sekmeli Yönetim Paneli:**
  - **Mekanlar:** Yeni anlaşmalı tuvalet ekleme; kapı şifresi, konum tarifi, giriş ücreti (5–500 ₺) ve misafir avantaj notunu anında düzenleme.
  - **Kasa & Gelir:** Kullanıcıların 6 haneli bilet kodlarını doğrulayarak ödemeyi işletme cüzdanına aktarma, brüt / %15 komisyon / net kazanç özetini görme ve TR IBAN doğrulamalı para çekme talebi oluşturma.
  - **Yorumlar:** İşletmeye ait mekanlara gelen son kullanıcı değerlendirmelerini ve puanları takip etme.

---

## Teknoloji Yığını

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet, Lucide Icons, `qrcode.react`, Service Worker (PWA)
- **Backend:** Node.js, Express 5, TypeScript, SQLite (`node:sqlite`)
- **Test:** Node.js yerleşik test runner (`node --test`)

---

## Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 22+
- npm

### 1. Bağımlılıkları Yükleyin
```bash
cd server && npm install
cd ../client && npm install
```

### 2. Geliştirme Sunucularını Başlatın

**Backend API (Port 4000):**
```bash
cd server
npm run dev
```

**Frontend (Port 5173):**
```bash
cd client
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın. İlk açılışta konum izni isteğiyle yakınınızdaki noktalar yüklenir; **Kullanıcı** veya **İşletme** panelini seçebilir, üst bardan iki mod arasında istediğiniz zaman geçiş yapabilirsiniz.

---

## Test ve Derleme

```bash
# Backend API entegrasyon testlerini çalıştır
npm test

# Client ve Server production build al
npm run build
```
