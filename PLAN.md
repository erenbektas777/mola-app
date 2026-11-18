# RahatBul — Ürün ve Geliştirme Planı

> **Vizyon:** Şehirde acil tuvalet ihtiyacı duyan kullanıcıları en yakın, temiz ve güvenilir tuvaletlerle (belediye/halka açık + anlaşmalı kafe/restoranlar) buluşturan, işletmelere ise tuvalet kapasitelerinden ek gelir ve yeni müşteri kazandıran iki taraflı mobil-öncelikli platform.

---

## 1. Kullanıcı (B2C) Deneyimi ve İhtiyaçları

- **Aciliyet Odaklı İlk Ekran:** Uygulama açılır açılmaz konuma göre en yakın tuvaletler haritada ve listede görünür.
  - **Yeşil Pin:** Ücretsiz / Halka Açık (Belediye, Park, Metro, AVM).
  - **Mor/Mavi Pin:** Anlaşmalı İşletme (Restoran, Kafe, Pastane).
- **Hızlı Filtreler:**
  - Tümü / Ücretsiz / Anlaşmalı İşletme
  - Şu an açık olanlar
  - Özellikler: Engelli erişimi, Bebek bakım odası, Ücretsiz Wi-Fi/Lavabo, Temizlik 4.0+
- **Şeffaf Bilgi & Güven:**
  - Mesafe (m / yürüme dk), çalışma saatleri, anlık durum (Açık / Geçici Kapalı / Bakımda), temizlik puanı ve kullanıcı yorumları.
  - İşletme avantajı: Ödenen ücretin yanında işletmenin sunduğu opsiyonel jestler (ör. "Aynı gün içeceklerde 15 ₺ indirim").
- **Tek Tıkla Ödeme & QR Giriş Bileti:**
  - Kullanıcı cüzdanından ödeme yaparak 15 dakika geçerli, tek kullanımlık **QR kod + 6 haneli giriş kodu** alır.
  - Yol tarifi (Google Maps / Apple Maps bağlantısı) ile doğrudan kapıya yönlendirilir.
- **Topluluk Geri Bildirimi:**
  - Kullanım sonrası 1-5 yıldız temizlik puanı ve yorum.
  - Halka açık tuvaletlerde "Kapalı / Arızalı Bildir" akışı.

---

## 2. İşletme (B2B) Deneyimi ve İhtiyaçları

- **Kolay Kayıt & Mekan Ekleme:**
  - İşletme adı, kategori (Kafe, Restoran, Pastane, Otel Lobisi), adres, haritadan konum seçimi, kullanım ücreti (₺), çalışma saatleri ve olanaklar.
- **Anlık Durum Kontrolü:**
  - Yoğun saatlerde veya temizlik esnasında tek tuşla `Açık ↔ Geçici Kapalı` geçişi.
- **Kasa / QR Kod Doğrulama:**
  - Gelen müşterinin 6 haneli kodunu (veya QR kodunu) girerek tek tıkla "Girişi Onayla".
  - Çift kullanım (double-redeem) ve süresi dolmuş bilet engeli.
- **Gelir & Şeffaf Komisyon Modeli:**
  - Platform komisyonu: **%15** | İşletme net kazancı: **%85**.
  - İşletme panelinde toplam kullanım, brüt gelir, net kazanç, cüzdan bakiyesi ve son işlemler.

---

## 3. Teknik Mimari

- **Frontend (`client/`):** React 19 + TypeScript + Vite + Tailwind CSS + Leaflet (OpenStreetMap) + `qrcode.react` + `lucide-react`.
  - Mobil-öncelikli (responsive bottom-nav + bottom-sheet) tasarım.
  - Tek cihazda test kolaylığı için üst barda **Kullanıcı Modu ↔ İşletme Modu** hızlı geçişi.
- **Backend (`server/`):** Node.js + Express + TypeScript + `node:sqlite` (`DatabaseSync`).
  - Kalıcı SQLite veritabanı (`rahatbul.db`).
  - İstanbul Metrobüs hattı ve merkezi noktalar (Zincirlikuyu, Mecidiyeköy, Kadıköy, Beşiktaş, Taksim, Bakırköy) için gerçekçi başlangıç verileri (seed).
- **Veri Modeli:**
  - `users`: id, name, role (`user` | `business`), wallet_balance
  - `toilets`: id, owner_id, name, type (`public` | `business`), category, address, lat, lng, price, perk_note, open_hours, status (`open` | `closed` | `maintenance`), wheelchair_accessible, baby_changing, rating_avg, rating_count, created_at
  - `tickets`: id, user_id, toilet_id, code, amount, platform_fee, business_net, status (`active` | `used` | `expired`), expires_at, used_at, created_at
  - `reviews`: id, toilet_id, user_id, user_name, rating, comment, created_at

---

## 4. Kalite ve Doğrulama Planı

1. **Backend API Testleri (`node --test`):**
   - Tuvalet listeleme, filtreleme, yeni işletme ekleme, durum güncelleme.
   - Bilet satın alma (bakiye düşümü, yetersiz bakiye reddi, ücretsiz/kapalı tuvalet reddi).
   - Bilet doğrulama (işletme net kazanç aktarımı, çift kullanım engeli).
   - Yorum ekleme ve ortalama puanın doğru güncellenmesi.
2. **Tip Güvenliği & Build:**
   - Backend ve Frontend `tsc --noEmit` sıfır hata.
   - Frontend `npm run build` sıfır hata.
3. **Uçtan Uca Çalışma Testi:**
   - Sunucu ayağa kaldırılıp canlı API ve arayüz akışları doğrulanacak.
