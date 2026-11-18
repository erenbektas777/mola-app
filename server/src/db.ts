import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export interface UserRow {
  id: string;
  name: string;
  role: 'user' | 'business';
  wallet_balance: number;
}

export interface ToiletRow {
  id: number;
  owner_id: string | null;
  name: string;
  type: 'public' | 'business';
  category: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  perk_note: string | null;
  open_hours: string;
  hours_verified: number;
  status: 'open' | 'closed' | 'maintenance';
  access_method: 'door_pin' | 'kiosk_qr';
  door_pin: string | null;
  location_hint: string | null;
  wheelchair_accessible: number;
  baby_changing: number;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface TicketRow {
  id: number;
  user_id: string;
  toilet_id: number;
  code: string;
  amount: number;
  platform_fee: number;
  business_net: number;
  status: 'active' | 'used' | 'expired';
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export interface ReviewRow {
  id: number;
  toilet_id: number;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export function createDatabase(dbPath: string = 'rahatbul.db'): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'business')),
      wallet_balance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS toilets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('public', 'business')),
      category TEXT NOT NULL,
      address TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      perk_note TEXT,
      open_hours TEXT NOT NULL,
      hours_verified INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'maintenance')),
      access_method TEXT NOT NULL DEFAULT 'door_pin' CHECK (access_method IN ('door_pin', 'kiosk_qr')),
      door_pin TEXT,
      location_hint TEXT,
      wheelchair_accessible INTEGER NOT NULL DEFAULT 0,
      baby_changing INTEGER NOT NULL DEFAULT 0,
      rating_avg REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      toilet_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      amount REAL NOT NULL,
      platform_fee REAL NOT NULL,
      business_net REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (toilet_id) REFERENCES toilets(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toilet_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (toilet_id) REFERENCES toilets(id)
    );

    CREATE TABLE IF NOT EXISTS status_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toilet_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK (report_type IN ('maintenance', 'open')),
      reason TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (toilet_id) REFERENCES toilets(id)
    );

    CREATE TABLE IF NOT EXISTS hours_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      toilet_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      open_hours TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (toilet_id) REFERENCES toilets(id)
    );
  `);

  const columns = db.prepare('PRAGMA table_info(toilets)').all() as Array<{ name: string }>;
  const colNames = new Set(columns.map((c) => c.name));
  if (!colNames.has('access_method')) {
    db.exec("ALTER TABLE toilets ADD COLUMN access_method TEXT NOT NULL DEFAULT 'door_pin'");
  }
  if (!colNames.has('door_pin')) {
    db.exec('ALTER TABLE toilets ADD COLUMN door_pin TEXT');
  }
  if (!colNames.has('location_hint')) {
    db.exec('ALTER TABLE toilets ADD COLUMN location_hint TEXT');
  }
  if (!colNames.has('hours_verified')) {
    db.exec('ALTER TABLE toilets ADD COLUMN hours_verified INTEGER NOT NULL DEFAULT 0');
  }

  seedIfEmpty(db);
  return db;
}

function seedIfEmpty(db: DatabaseSync): void {
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (userCount.cnt > 0) return;

  const insertUser = db.prepare(
    'INSERT INTO users (id, name, role, wallet_balance) VALUES (?, ?, ?, ?)'
  );
  insertUser.run('user-1', 'Eren Yılmaz', 'user', 120.0);
  insertUser.run('owner-1', 'Kafe Ferah & Ortakları', 'business', 425.0);
  insertUser.run('owner-2', 'Bosphorus Bistro', 'business', 180.0);

  const insertToilet = db.prepare(`
    INSERT INTO toilets (
      owner_id, name, type, category, address, lat, lng,
      price, perk_note, open_hours, hours_verified, status,
      access_method, door_pin, location_hint,
      wheelchair_accessible, baby_changing, rating_avg, rating_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Seed curated European Side transit hubs + 211 real OpenStreetMap European Side public toilets
  insertToilet.run(
    null,
    'İBB Zincirlikuyu Metrobüs Altgeçit WC',
    'public',
    'Belediye / Metrobüs',
    'Zincirlikuyu Metrobüs İstasyonu Alt Geçidi, Şişli',
    41.0664,
    29.0124,
    0,
    null,
    '06:00 - 00:00',
    1,
    'open',
    'door_pin',
    null,
    '1) Zincirlikuyu Metrobüs peronundan Beşiktaş/Gayrettepe yönündeki alt geçide inin. 2) Beşiktaş çıkış merdivenlerine gelmeden sağ taraftaki yan koridora dönün. 3) İBB görevli kabininin hemen yanında yer alır.',
    1,
    0,
    3.8,
    24
  );

  insertToilet.run(
    null,
    'İBB Mecidiyeköy Meydan Park WC',
    'public',
    'Belediye / Park',
    'Mecidiyeköy Meydanı, Büyükdere Cd., Şişli',
    41.0631,
    28.9956,
    0,
    null,
    '07:00 - 23:00',
    1,
    'open',
    'door_pin',
    null,
    '1) Mecidiyeköy Meydanı’ndaki Büyükdere Caddesi kenarından park alanına girin. 2) Meydan parkının kuzey köşesindeki ağaçlık yola ilerleyin. 3) Belediye büfesinin hemen arkasında giriş kapısı bulunur.',
    1,
    1,
    3.5,
    18
  );

  insertToilet.run(
    null,
    'Zorlu Center Metro Bağlantısı WC',
    'public',
    'AVM / Metro',
    'Levazım, Koru Sk. No:2, Beşiktaş',
    41.0668,
    29.0176,
    0,
    null,
    '10:00 - 22:00',
    1,
    'open',
    'door_pin',
    null,
    '1) Gayrettepe Metro veya Zincirlikuyu alt geçidinden Zorlu Center bağlantı tüneline girin. 2) AVM alt kat cam kapılarından içeri adım atın. 3) Danışma bankosunu geçmeden hemen sol taraftaki geniş koridorda yer alır.',
    1,
    1,
    4.8,
    52
  );

  insertToilet.run(
    null,
    'Cevizlibağ Metrobüs Üstgeçit WC',
    'public',
    'Belediye / Metrobüs',
    'Cevizlibağ Metrobüs Durağı Çıkışı, Zeytinburnu',
    41.0189,
    28.9182,
    0,
    null,
    '06:30 - 23:30',
    1,
    'maintenance',
    'door_pin',
    null,
    '1) Cevizlibağ Metrobüs durağından E-5 üstgeçit merdivenlerine yönelin. 2) Tramvay durağı tarafındaki iniş merdivenlerinden aşağı inin. 3) Merdiven altındaki yaya geçidinin sağ köşesinde yer alır.',
    0,
    0,
    2.9,
    14
  );

  insertToilet.run(
    null,
    'Söğütlüçeşme Metrobüs & Marmaray WC',
    'public',
    'Belediye / İstasyon',
    'Söğütlüçeşme İstasyonu Yanı, Kadıköy',
    40.9912,
    29.0376,
    0,
    null,
    '24 Saat Açık',
    1,
    'open',
    'door_pin',
    null,
    '1) Söğütlüçeşme Metrobüs ve Marmaray aktarma çıkışından ana meydana inin. 2) Viyadük altındaki yaya geçiş koridoruna yönelin. 3) İstasyon ana çıkış kapısının sağ tarafında yer alır.',
    1,
    0,
    3.6,
    31
  );

  // Partner cafes & restaurants (zero verbal interaction, mutual benefit!)
  insertToilet.run(
    'owner-1',
    'Ferah Kahve & Kruvasan',
    'business',
    'Kafe',
    'Esentepe Mah. Büyükdere Cd. No:112, Şişli (Zincirlikuyu 2 dk)',
    41.0679,
    29.0102,
    20,
    'Biletini kullanırsan aynı gün tüm kahvelerde 20 ₺ indirim (tamamen opsiyonel).',
    '07:30 - 23:00',
    1,
    'open',
    'door_pin',
    '4829#',
    '1) Ana kapıdan içeri girip kasaya uğramadan hemen sağ koridora dönün. 2) Koridorun sonundaki tuşlu kapıya ilerleyin. 3) Uygulamadaki kapı şifresini tuşlayıp # basın.',
    1,
    1,
    4.9,
    37
  );

  insertToilet.run(
    'owner-1',
    'Levent Köşe Restoran',
    'business',
    'Restoran',
    'Nisbetiye Mah. Aytar Cd. No:14, Beşiktaş',
    41.0732,
    29.0165,
    25,
    'Temizlik garantili; kimseyle konuşmadan kapıdaki QR okuyucudan geçin.',
    '09:00 - 00:00',
    1,
    'open',
    'kiosk_qr',
    null,
    '1) Restoranın bahçe yan kapısından içeri girin. 2) Hemen sol taraftaki alt kat merdiveninden inin. 3) Kapıdaki tablet QR okuyucuya biletinizi okutun.',
    1,
    0,
    4.7,
    21
  );

  insertToilet.run(
    'owner-2',
    'Bosphorus Bistro & Bakery',
    'business',
    'Kafe & Pastane',
    'Sinanpaşa Mah. Ortabahçe Cd. No:8, Beşiktaş',
    41.0439,
    29.0054,
    20,
    'Aynı gün su veya çay alımında 10 ₺ indirim kuponu.',
    '08:00 - 23:30',
    1,
    'open',
    'door_pin',
    '1905*',
    '1) Girişten dümdüz ilerleyip arka merdivenden 1 kat aşağı inin. 2) Sağdaki şifreli kapıya yönelin. 3) Şifreyi tuşlayıp kapıyı açın.',
    0,
    1,
    4.6,
    19
  );

  insertToilet.run(
    'owner-2',
    'Kadıköy Rıhtım Kahvecisi',
    'business',
    'Kafe',
    'Caferağa Mah. Rıhtım Cd. No:34, Kadıköy',
    40.9905,
    29.0238,
    15,
    'Metrobüs ve vapur iskelesine 3 dk yürüme mesafesi; soğuk içeceklerde 15 ₺ indirim.',
    '07:00 - 01:00',
    1,
    'open',
    'door_pin',
    '3571#',
    '1) Dükkanın yanındaki cam kapıdan içeri girin. 2) Koridorun sonuna kadar ilerleyin. 3) Sağdaki kapıda şifreyi tuşlayın.',
    1,
    1,
    4.8,
    29
  );

  type SeedToilet = {
    name: string;
    category: string;
    address: string;
    lat: number;
    lng: number;
    open_hours: string;
    hours_verified?: number;
    location_hint?: string | null;
    wheelchair_accessible: number;
    baby_changing: number;
  };

  const euJsonPath = new URL('./european_toilets.json', import.meta.url);
  const anJsonPath = new URL('./anatolian_toilets.json', import.meta.url);
  const allOsmToilets = [
    ...(JSON.parse(fs.readFileSync(euJsonPath, 'utf8')) as SeedToilet[]),
    ...(JSON.parse(fs.readFileSync(anJsonPath, 'utf8')) as SeedToilet[]),
  ];

  db.exec('BEGIN IMMEDIATE');
  try {
    for (const item of allOsmToilets) {
      insertToilet.run(
        null,
        item.name,
        'public',
        item.category,
        item.address,
        item.lat,
        item.lng,
        0,
        null,
        item.open_hours,
        item.hours_verified ?? 0,
        'open',
        'door_pin',
        null,
        item.location_hint ?? null,
        item.wheelchair_accessible,
        item.baby_changing,
        4.0,
        1
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Sample reviews
  const insertReview = db.prepare(`
    INSERT INTO reviews (toilet_id, user_id, user_name, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertReview.run(1, 'seed-mert', 'Mert A.', 4, 'Ücretsiz olmasına rağmen fena değil, yoğun saatte biraz sıra oluyor.');
  insertReview.run(3, 'seed-ayse', 'Ayşe D.', 5, 'AVM içi olduğu için çok düzenli ve bebek bakım odası tertemiz.');
}
