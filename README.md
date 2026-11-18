# Mola — Yakındaki Tuvalet & İşletme Geçiş Ağı

**Mola**, şehir içinde acil tuvalet ihtiyacı duyulduğunda kullanıcıları en yakın **ücretsiz halka açık tuvaletlere** ve **anlaşmalı kafe/restoran tuvaletlerine** ulaştıran, aynı zamanda işletmelere temassız giriş ve ek gelir sağlayan mobil-öncelikli bir web uygulamasıdır.

---

## Uygulamanın Amacı

Şehir yaşamında temiz ve ulaşılabilir tuvalet bulmak çoğu zaman zordur. Kafeler ve restoranlar ise müşteri olmayan kişilerin tuvalet kullanımından kaçınmak ister. **Mola**, iki taraf için karşılıklı fayda sunan bir köprü kurar:

- **Kullanıcılar için:** Harita üzerinde ücretsiz belediye/park tuvaletlerini ve anlaşmalı işletmeleri anlık açık/kapalı durumu, erişilebilirlik (engelli, bebek bakım), puan ve mesafe bilgisiyle hızlıca bulma; anlaşmalı işletmelerde tek kullanımlık QR/PIN bileti ile çekinmeden, sıra veya açıklama yapmadan tuvalet kullanabilme.
- **İşletmeler için:** Tuvaletlerini platforma açarak doğrudan ek gelir elde etme (%85 işletme payı / %15 platform komisyonu), misafir avantaj notlarıyla (ör. kahve indirimi) yeni müşteriler çekme ve dijital kasa üzerinden gelir ile yorumları yönetme.

---

## Temel Özellikler

### Kullanıcı Modu
- **İnteraktif Harita & Akıllı Kümeleme:** Leaflet tabanlı harita üzerinde ücretsiz noktalar, anlaşmalı işletmeler ve durum (açık, bakımda, kapalı) göstergeleri.
- **Hızlı Filtreleme & Arama:** Semt/mekan araması; *Tümü*, *Ücretsiz*, *İşletme*, *Kapalılar*, *Engelli* ve *Bebek* filtreleri.
- **Temassız Giriş & Dijital Cüzdan:** Kart/3D Secure adımlarıyla cüzdana bakiye yükleme, tek kullanımlık **QR Bilet** veya **Kapı Şifresi (PIN)** alma ve aktif/geçmiş biletleri görüntüleme.
- **Topluluk Katkısı:** Konum doğrulamalı bakım/durum bildirimi, açılış/kapanış saati güncelleme önerisi, yeni ücretsiz tuvalet önerme ve yorum/puanlama.

### İşletme Modu
- **3 Sekmeli Yönetim Paneli:**
  - **Mekanlar:** Yeni anlaşmalı tuvalet ekleme; kapı şifresi, konum tarifi, giriş ücreti (5–500 ₺) ve misafir avantaj notunu anında düzenleme.
  - **Kasa & Gelir:** Kullanıcıların 6 haneli bilet kodlarını doğrulayarak ödemeyi işletme cüzdanına aktarma, brüt / %15 komisyon / net kazanç özetini görme ve TR IBAN doğrulamalı para çekme talebi oluşturma.
  - **Yorumlar:** İşletmeye ait mekanlara gelen son kullanıcı değerlendirmelerini ve puanları takip etme.

---

## Teknoloji Yığını

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Leaflet, Lucide Icons, `qrcode.react`
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

Tarayıcıda `http://localhost:5173` adresini açın. İlk açılışta **Kullanıcı** veya **İşletme** panelini seçebilir, üst bardan iki mod arasında istediğiniz zaman geçiş yapabilirsiniz.

---

## Test ve Derleme

```bash
# Backend API entegrasyon testlerini çalıştır
npm test

# Client ve Server production build al
npm run build
```
