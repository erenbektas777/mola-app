import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { ReviewRow, TicketRow, ToiletRow, UserRow } from './db.js';

const PLATFORM_FEE_RATE = 0.15;

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function generateTicketCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

export function getIstanbulMinutesNow(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

export function isOpenAtIstanbulTime(openHours: string, nowMinutes: number): boolean | null {
  const normalized = openHours.trim().toLowerCase();
  if (normalized.includes('24/7') || normalized.includes('24 saat')) {
    return true;
  }
  const match = openHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const openMin = Number(match[1]) * 60 + Number(match[2]);
  let closeMin = Number(match[3]) * 60 + Number(match[4]);
  if (closeMin === 0) closeMin = 1440; // 00:00 means end of day (24:00)

  if (closeMin > openMin) {
    return nowMinutes >= openMin && nowMinutes < closeMin;
  }
  // Overnight range (e.g. 07:00 - 01:00)
  return nowMinutes >= openMin || nowMinutes < closeMin;
}

function computeEffectiveStatus(
  dbStatus: 'open' | 'closed' | 'maintenance',
  openHours: string,
  hoursVerified: number,
  nowMinutes: number
): { status: 'open' | 'closed' | 'maintenance'; closedByHours: boolean } {
  if (dbStatus === 'maintenance' || dbStatus === 'closed') {
    return { status: dbStatus, closedByHours: false };
  }
  if (hoursVerified === 1) {
    const openNow = isOpenAtIstanbulTime(openHours, nowMinutes);
    if (openNow === false) {
      return { status: 'closed', closedByHours: true };
    }
  }
  return { status: 'open', closedByHours: false };
}

export function createApp(db: DatabaseSync): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'rahatbul-api' });
  });

  // Get user profile & wallet balance
  app.get('/api/users/:userId', (req: Request, res: Response) => {
    const user = db
      .prepare('SELECT id, name, role, wallet_balance FROM users WHERE id = ?')
      .get(String(req.params.userId)) as UserRow | undefined;

    if (!user) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }
    res.json(user);
  });

  // Top up user wallet
  app.post('/api/users/:userId/topup', (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const amount = Number(req.body?.amount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > 5000) {
      res.status(400).json({ error: 'Geçerli bir yükleme tutarı girin (1 - 5000 ₺).' });
      return;
    }

    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }

    db.prepare('UPDATE users SET wallet_balance = ROUND(wallet_balance + ?, 2) WHERE id = ?').run(
      amount,
      userId
    );
    const updated = db
      .prepare('SELECT id, name, role, wallet_balance FROM users WHERE id = ?')
      .get(userId) as unknown as UserRow;
    res.json(updated);
  });

  // List toilets with optional geolocation & filters
  app.get('/api/toilets', (req: Request, res: Response) => {
    const { type, onlyOpen, wheelchair, babyChanging, minRating, search, lat, lng } = req.query;

    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (type === 'public' || type === 'business') {
      conditions.push('type = ?');
      params.push(type);
    }
    if (wheelchair === 'true') {
      conditions.push('wheelchair_accessible = 1');
    }
    if (babyChanging === 'true') {
      conditions.push('baby_changing = 1');
    }
    if (minRating && Number.isFinite(Number(minRating))) {
      conditions.push('rating_avg >= ?');
      params.push(Number(minRating));
    }
    if (typeof search === 'string' && search.trim().length > 0) {
      conditions.push('(LOWER(name) LIKE ? OR LOWER(address) LIKE ? OR LOWER(category) LIKE ?)');
      const q = `%${search.trim().toLowerCase()}%`;
      params.push(q, q, q);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM toilets ${where} ORDER BY id DESC`)
      .all(...params) as unknown as ToiletRow[];

    const reportCountsRows = db
      .prepare(
        `SELECT toilet_id, COUNT(DISTINCT user_id) as cnt
         FROM status_reports
         WHERE report_type = 'maintenance' AND created_at >= datetime('now', '-6 hours')
         GROUP BY toilet_id`
      )
      .all() as unknown as Array<{ toilet_id: number; cnt: number }>;
    const reportCountsMap = new Map(reportCountsRows.map((r) => [r.toilet_id, r.cnt]));

    const userLat = lat !== undefined ? Number(lat) : NaN;
    const userLng = lng !== undefined ? Number(lng) : NaN;
    const hasCoords = Number.isFinite(userLat) && Number.isFinite(userLng);

    const nowMinutes = getIstanbulMinutesNow();

    let enriched = rows.map((row) => {
      const distance_meters = hasCoords ? haversineMeters(userLat, userLng, row.lat, row.lng) : null;
      const walk_minutes =
        distance_meters !== null ? Math.max(1, Math.round(distance_meters / 75)) : null;
      const effective = computeEffectiveStatus(
        row.status,
        row.open_hours,
        row.hours_verified,
        nowMinutes
      );
      return {
        ...row,
        status: effective.status,
        closed_by_hours: effective.closedByHours,
        hours_verified: Boolean(row.hours_verified),
        door_pin: undefined,
        wheelchair_accessible: Boolean(row.wheelchair_accessible),
        baby_changing: Boolean(row.baby_changing),
        recent_maintenance_reports: reportCountsMap.get(row.id) ?? 0,
        distance_meters,
        walk_minutes,
      };
    });

    if (onlyOpen === 'true') {
      enriched = enriched.filter((item) => item.status === 'open');
    }

    if (hasCoords) {
      enriched.sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));
    }

    res.json(enriched);
  });

  // Create a new business or public toilet
  app.post('/api/toilets', (req: Request, res: Response) => {
    const {
      owner_id,
      name,
      type = 'business',
      category,
      address,
      lat,
      lng,
      price = 0,
      perk_note = null,
      open_hours = '09:00 - 22:00',
      access_method = 'door_pin',
      door_pin = null,
      location_hint = null,
      wheelchair_accessible = false,
      baby_changing = false,
    } = req.body ?? {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'İşletme / tuvalet adı en az 2 karakter olmalıdır.' });
      return;
    }
    if (!address || typeof address !== 'string' || address.trim().length < 4) {
      res.status(400).json({ error: 'Geçerli bir adres girin.' });
      return;
    }
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
      res.status(400).json({ error: 'Geçerli enlem ve boylam koordinatları gereklidir.' });
      return;
    }
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 500) {
      res.status(400).json({ error: 'Ücret 0 ile 500 ₺ arasında olmalıdır.' });
      return;
    }
    if (type !== 'public' && type !== 'business') {
      res.status(400).json({ error: 'Geçersiz tuvalet tipi.' });
      return;
    }
    if (access_method !== 'door_pin' && access_method !== 'kiosk_qr') {
      res.status(400).json({ error: 'Geçersiz erişim yöntemi.' });
      return;
    }
    const cleanDoorPin = typeof door_pin === 'string' && door_pin.trim() ? door_pin.trim() : null;
    if (type === 'business' && access_method === 'door_pin' && !cleanDoorPin) {
      res.status(400).json({ error: 'Temassız kapı şifresi yöntemi için kapı şifresi girmelisiniz.' });
      return;
    }
    if (type === 'business') {
      if (!owner_id || typeof owner_id !== 'string') {
        res.status(400).json({ error: 'İşletme kaydı için owner_id gereklidir.' });
        return;
      }
      const ownerExists = db.prepare('SELECT id FROM users WHERE id = ?').get(owner_id);
      if (!ownerExists) {
        res.status(404).json({ error: 'İşletme sahibi bulunamadı.' });
        return;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO toilets (
          owner_id, name, type, category, address, lat, lng,
          price, perk_note, open_hours, hours_verified, status,
          access_method, door_pin, location_hint,
          wheelchair_accessible, baby_changing
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'open', ?, ?, ?, ?, ?)`
      )
      .run(
        type === 'business' ? owner_id : null,
        name.trim(),
        type,
        typeof category === 'string' && category.trim() ? category.trim() : 'Kafe / Restoran',
        address.trim(),
        parsedLat,
        parsedLng,
        type === 'public' ? 0 : parsedPrice,
        typeof perk_note === 'string' && perk_note.trim() ? perk_note.trim() : null,
        typeof open_hours === 'string' && open_hours.trim() ? open_hours.trim() : '09:00 - 22:00',
        access_method,
        type === 'business' && access_method === 'door_pin' ? cleanDoorPin : null,
        typeof location_hint === 'string' && location_hint.trim() ? location_hint.trim() : null,
        wheelchair_accessible ? 1 : 0,
        baby_changing ? 1 : 0
      );

    const created = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as unknown as ToiletRow;

    res.status(201).json({
      ...created,
      wheelchair_accessible: Boolean(created.wheelchair_accessible),
      baby_changing: Boolean(created.baby_changing),
    });
  });

  // Crowdsourced: suggest a missing public toilet in Istanbul
  app.post('/api/toilets/suggest', (req: Request, res: Response) => {
    const {
      name,
      category = 'Halka Açık WC',
      address,
      lat,
      lng,
      wheelchair_accessible = false,
      baby_changing = false,
    } = req.body ?? {};

    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      res.status(400).json({ error: 'Tuvalet / mekan adı en az 3 karakter olmalıdır.' });
      return;
    }
    if (!address || typeof address !== 'string' || address.trim().length < 4) {
      res.status(400).json({ error: 'Lütfen geçerli bir adres veya semt girin.' });
      return;
    }
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (
      !Number.isFinite(parsedLat) ||
      !Number.isFinite(parsedLng) ||
      parsedLat < 40.8 ||
      parsedLat > 41.35 ||
      parsedLng < 28.1 ||
      parsedLng > 29.55
    ) {
      res.status(400).json({ error: 'Önerilen konum İstanbul sınırları içinde olmalıdır.' });
      return;
    }

    // Prevent duplicates within 40 meters
    const existingAll = db
      .prepare('SELECT id, name, lat, lng FROM toilets')
      .all() as unknown as Array<{ id: number; name: string; lat: number; lng: number }>;
    for (const item of existingAll) {
      if (haversineMeters(parsedLat, parsedLng, item.lat, item.lng) <= 40) {
        res.status(409).json({
          error: `Bu konumun hemen yakınında zaten "${item.name}" kayıtlı.`,
        });
        return;
      }
    }

    const result = db
      .prepare(
        `INSERT INTO toilets (
          owner_id, name, type, category, address, lat, lng,
          price, perk_note, open_hours, hours_verified, status,
          access_method, door_pin, location_hint,
          wheelchair_accessible, baby_changing, rating_avg, rating_count
        ) VALUES (NULL, ?, 'public', ?, ?, ?, ?, 0, NULL, '07:00 - 23:00', 0, 'open', 'door_pin', NULL, NULL, ?, ?, 4.0, 1)`
      )
      .run(
        name.trim(),
        typeof category === 'string' && category.trim() ? category.trim() : 'Halka Açık WC',
        address.trim(),
        Number(parsedLat.toFixed(6)),
        Number(parsedLng.toFixed(6)),
        wheelchair_accessible ? 1 : 0,
        baby_changing ? 1 : 0
      );

    const created = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(Number(result.lastInsertRowid)) as unknown as ToiletRow;

    res.status(201).json({
      ...created,
      hours_verified: false,
      closed_by_hours: false,
      recent_maintenance_reports: 0,
      wheelchair_accessible: Boolean(created.wheelchair_accessible),
      baby_changing: Boolean(created.baby_changing),
      distance_meters: null,
      walk_minutes: null,
    });
  });

  // Update toilet availability status (open | closed | maintenance)
  app.patch('/api/toilets/:id/status', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { status } = req.body ?? {};

    if (!['open', 'closed', 'maintenance'].includes(status)) {
      res.status(400).json({ error: 'Durum open, closed veya maintenance olmalıdır.' });
      return;
    }

    const existing = db.prepare('SELECT id FROM toilets WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    db.prepare('UPDATE toilets SET status = ? WHERE id = ?').run(status, id);
    const updated = db.prepare('SELECT * FROM toilets WHERE id = ?').get(id) as unknown as ToiletRow;

    res.json({
      ...updated,
      wheelchair_accessible: Boolean(updated.wheelchair_accessible),
      baby_changing: Boolean(updated.baby_changing),
    });
  });

  // Crowdsourced status report with proximity, cooldown, and 3-user quorum verification
  app.post('/api/toilets/:id/report', (req: Request, res: Response) => {
    const toiletId = Number(req.params.id);
    const { userId, reportType, reason = '', lat, lng } = req.body ?? {};

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'Kullanıcı kimliği (userId) gereklidir.' });
      return;
    }
    if (reportType !== 'maintenance' && reportType !== 'open') {
      res.status(400).json({ error: 'Bildirim tipi maintenance veya open olmalıdır.' });
      return;
    }

    const userLat = Number(lat);
    const userLng = Number(lng);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      res.status(400).json({ error: 'Konum doğrulaması için enlem ve boylam gereklidir.' });
      return;
    }

    const toilet = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(toiletId) as unknown as ToiletRow | undefined;
    if (!toilet) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    const distance = haversineMeters(userLat, userLng, toilet.lat, toilet.lng);
    if (distance > 250) {
      res.status(400).json({
        error: `Doğrulama için tuvaletin yakınında (en fazla 250 m) olmalısınız. Mevcut mesafe: ${distance} m.`,
      });
      return;
    }

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (reportType === 'maintenance' && cleanReason.length < 3) {
      res.status(400).json({ error: 'Lütfen arıza veya kapanma sebebini seçin.' });
      return;
    }

    // Prevent same user from spamming reports within 6 hours
    const alreadyReported = db
      .prepare(
        `SELECT id FROM status_reports
         WHERE toilet_id = ? AND user_id = ? AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId, userId.trim());

    if (alreadyReported) {
      res.status(429).json({
        error: 'Bu tuvalet için son 6 saat içinde zaten bir durum bildirimi yaptınız.',
      });
      return;
    }

    db.prepare(
      `INSERT INTO status_reports (toilet_id, user_id, report_type, reason, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      toiletId,
      userId.trim(),
      reportType,
      cleanReason || 'Tuvalet açık ve kullanılabilir',
      userLat,
      userLng
    );

    const maintRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM status_reports
         WHERE toilet_id = ? AND report_type = 'maintenance' AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId) as { cnt: number };

    const openRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM status_reports
         WHERE toilet_id = ? AND report_type = 'open' AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId) as { cnt: number };

    const MAINTENANCE_THRESHOLD = 3;
    const OPEN_THRESHOLD = 2;
    let nextStatus = toilet.status;

    if (maintRow.cnt >= MAINTENANCE_THRESHOLD && maintRow.cnt > openRow.cnt) {
      nextStatus = 'maintenance';
    } else if (openRow.cnt >= OPEN_THRESHOLD && openRow.cnt >= maintRow.cnt) {
      nextStatus = 'open';
    }

    if (nextStatus !== toilet.status) {
      db.prepare('UPDATE toilets SET status = ? WHERE id = ?').run(nextStatus, toiletId);
    }

    const message =
      reportType === 'maintenance'
        ? nextStatus === 'maintenance'
          ? '3 farklı kullanıcı doğruladı. Tuvalet geçici olarak "Bakımda" işaretlendi.'
          : `Bildiriminiz alındı (${maintRow.cnt}/${MAINTENANCE_THRESHOLD}). 3 farklı kullanıcı doğruladığında "Bakımda" olarak güncellenecek.`
        : nextStatus === 'open'
          ? 'Teşekkürler! Tuvaletin açık olduğu doğrulandı.'
          : `Açık olduğu yönündeki bildiriminiz alındı (${openRow.cnt}/${OPEN_THRESHOLD}).`;

    res.status(201).json({
      status: nextStatus,
      recent_maintenance_reports: maintRow.cnt,
      threshold: MAINTENANCE_THRESHOLD,
      message,
    });
  });

  // Crowdsourced opening hours contribution (2-user consensus verifies & updates hours)
  app.post('/api/toilets/:id/hours', (req: Request, res: Response) => {
    const toiletId = Number(req.params.id);
    const { userId, openHours } = req.body ?? {};

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'Kullanıcı kimliği (userId) gereklidir.' });
      return;
    }
    if (typeof openHours !== 'string' || !openHours.trim()) {
      res.status(400).json({ error: 'Çalışma saati bilgisi gereklidir.' });
      return;
    }

    const cleanHours = openHours.trim();
    const isValidFormat =
      cleanHours.toLowerCase().includes('24 saat') ||
      cleanHours.toLowerCase().includes('24/7') ||
      /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(cleanHours);

    if (!isValidFormat) {
      res.status(400).json({
        error: 'Saat formatı "08:00 - 22:00" veya "24 Saat Açık" şeklinde olmalıdır.',
      });
      return;
    }

    const toilet = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(toiletId) as unknown as ToiletRow | undefined;
    if (!toilet) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    const duplicate = db
      .prepare(
        `SELECT id FROM hours_reports
         WHERE toilet_id = ? AND user_id = ? AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId, userId.trim());
    if (duplicate) {
      res.status(429).json({
        error: 'Bu tuvalet için son 6 saat içinde zaten çalışma saati bildirdiniz.',
      });
      return;
    }

    db.prepare(
      'INSERT INTO hours_reports (toilet_id, user_id, open_hours) VALUES (?, ?, ?)'
    ).run(toiletId, userId.trim(), cleanHours);

    const sameCountRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt
         FROM hours_reports
         WHERE toilet_id = ? AND open_hours = ?`
      )
      .get(toiletId, cleanHours) as { cnt: number };

    const HOURS_THRESHOLD = 2;
    let hoursVerified = Boolean(toilet.hours_verified);
    let finalHours = toilet.open_hours;

    if (sameCountRow.cnt >= HOURS_THRESHOLD) {
      db.prepare('UPDATE toilets SET open_hours = ?, hours_verified = 1 WHERE id = ?').run(
        cleanHours,
        toiletId
      );
      hoursVerified = true;
      finalHours = cleanHours;
    }

    const effective = computeEffectiveStatus(
      toilet.status,
      finalHours,
      hoursVerified ? 1 : 0,
      getIstanbulMinutesNow()
    );

    res.status(201).json({
      open_hours: finalHours,
      hours_verified: hoursVerified,
      status: effective.status,
      closed_by_hours: effective.closedByHours,
      confirmations: sameCountRow.cnt,
      threshold: HOURS_THRESHOLD,
      message:
        sameCountRow.cnt >= HOURS_THRESHOLD
          ? `Çalışma saati (${finalHours}) 2 kullanıcı tarafından doğrulandı ve güncellendi.`
          : `Saat öneriniz alındı (${sameCountRow.cnt}/${HOURS_THRESHOLD}). Bir kullanıcı daha onayladığında resmi saat olarak güncellenecektir.`,
    });
  });

  // Update contactless door PIN, indoor location hint, price, or perk note
  app.patch('/api/toilets/:id/access', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const { door_pin, location_hint, price, perk_note } = req.body ?? {};

    const existing = db.prepare('SELECT * FROM toilets WHERE id = ?').get(id) as unknown as
      | ToiletRow
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    const nextPin =
      door_pin !== undefined
        ? typeof door_pin === 'string' && door_pin.trim()
          ? door_pin.trim()
          : null
        : existing.door_pin;
    const nextHint =
      location_hint !== undefined
        ? typeof location_hint === 'string' && location_hint.trim()
          ? location_hint.trim()
          : null
        : existing.location_hint;
    const nextPerk =
      perk_note !== undefined
        ? typeof perk_note === 'string' && perk_note.trim()
          ? perk_note.trim()
          : null
        : existing.perk_note;
    let nextPrice = existing.price;
    if (price !== undefined) {
      const parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 5 || parsedPrice > 500) {
        res.status(400).json({ error: 'Ücret 5 ile 500 ₺ arasında olmalıdır.' });
        return;
      }
      nextPrice = parsedPrice;
    }

    db.prepare(
      'UPDATE toilets SET door_pin = ?, location_hint = ?, price = ?, perk_note = ? WHERE id = ?'
    ).run(nextPin, nextHint, nextPrice, nextPerk, id);

    const updated = db.prepare('SELECT * FROM toilets WHERE id = ?').get(id) as unknown as ToiletRow;
    res.json({
      ...updated,
      wheelchair_accessible: Boolean(updated.wheelchair_accessible),
      baby_changing: Boolean(updated.baby_changing),
    });
  });

  // Crowdsourced status report with proximity, cooldown, and 3-user quorum verification
  app.post('/api/toilets/:id/report', (req: Request, res: Response) => {
    const toiletId = Number(req.params.id);
    const { userId, reportType, reason = '', lat, lng } = req.body ?? {};

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'Kullanıcı kimliği (userId) gereklidir.' });
      return;
    }
    if (reportType !== 'maintenance' && reportType !== 'open') {
      res.status(400).json({ error: 'Bildirim tipi maintenance veya open olmalıdır.' });
      return;
    }

    const userLat = Number(lat);
    const userLng = Number(lng);
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
      res.status(400).json({ error: 'Konum doğrulaması için enlem ve boylam gereklidir.' });
      return;
    }

    const toilet = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(toiletId) as unknown as ToiletRow | undefined;
    if (!toilet) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    const distance = haversineMeters(userLat, userLng, toilet.lat, toilet.lng);
    if (distance > 250) {
      res.status(400).json({
        error: `Doğrulama için tuvaletin yakınında (en fazla 250 m) olmalısınız. Mevcut mesafe: ${distance} m.`,
      });
      return;
    }

    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    if (reportType === 'maintenance' && cleanReason.length < 3) {
      res.status(400).json({ error: 'Lütfen arıza veya kapanma sebebini seçin.' });
      return;
    }

    // Prevent same user from spamming reports within 6 hours
    const alreadyReported = db
      .prepare(
        `SELECT id FROM status_reports
         WHERE toilet_id = ? AND user_id = ? AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId, userId.trim());

    if (alreadyReported) {
      res.status(429).json({
        error: 'Bu tuvalet için son 6 saat içinde zaten bir durum bildirimi yaptınız.',
      });
      return;
    }

    db.prepare(
      `INSERT INTO status_reports (toilet_id, user_id, report_type, reason, lat, lng)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      toiletId,
      userId.trim(),
      reportType,
      cleanReason || 'Tuvalet açık ve kullanılabilir',
      userLat,
      userLng
    );

    const maintRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM status_reports
         WHERE toilet_id = ? AND report_type = 'maintenance' AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId) as { cnt: number };

    const openRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt FROM status_reports
         WHERE toilet_id = ? AND report_type = 'open' AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId) as { cnt: number };

    const MAINTENANCE_THRESHOLD = 3;
    const OPEN_THRESHOLD = 2;
    let nextStatus = toilet.status;

    if (maintRow.cnt >= MAINTENANCE_THRESHOLD && maintRow.cnt > openRow.cnt) {
      nextStatus = 'maintenance';
    } else if (openRow.cnt >= OPEN_THRESHOLD && openRow.cnt >= maintRow.cnt) {
      nextStatus = 'open';
    }

    if (nextStatus !== toilet.status) {
      db.prepare('UPDATE toilets SET status = ? WHERE id = ?').run(nextStatus, toiletId);
    }

    const message =
      reportType === 'maintenance'
        ? nextStatus === 'maintenance'
          ? '3 farklı kullanıcı doğruladı. Tuvalet geçici olarak "Bakımda" işaretlendi.'
          : `Bildiriminiz alındı (${maintRow.cnt}/${MAINTENANCE_THRESHOLD}). 3 farklı kullanıcı doğruladığında "Bakımda" olarak güncellenecek.`
        : nextStatus === 'open'
          ? 'Teşekkürler! Tuvaletin açık olduğu doğrulandı.'
          : `Açık olduğu yönündeki bildiriminiz alındı (${openRow.cnt}/${OPEN_THRESHOLD}).`;

    res.status(201).json({
      status: nextStatus,
      recent_maintenance_reports: maintRow.cnt,
      threshold: MAINTENANCE_THRESHOLD,
      message,
    });
  });

  // Crowdsourced opening hours contribution (2-user consensus verifies & updates hours)
  app.post('/api/toilets/:id/hours', (req: Request, res: Response) => {
    const toiletId = Number(req.params.id);
    const { userId, openHours } = req.body ?? {};

    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ error: 'Kullanıcı kimliği (userId) gereklidir.' });
      return;
    }
    if (typeof openHours !== 'string' || !openHours.trim()) {
      res.status(400).json({ error: 'Çalışma saati bilgisi gereklidir.' });
      return;
    }

    const cleanHours = openHours.trim();
    const isValidFormat =
      cleanHours.toLowerCase().includes('24 saat') ||
      cleanHours.toLowerCase().includes('24/7') ||
      /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(cleanHours);

    if (!isValidFormat) {
      res.status(400).json({
        error: 'Saat formatı "08:00 - 22:00" veya "24 Saat Açık" şeklinde olmalıdır.',
      });
      return;
    }

    const toilet = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(toiletId) as unknown as ToiletRow | undefined;
    if (!toilet) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    const duplicate = db
      .prepare(
        `SELECT id FROM hours_reports
         WHERE toilet_id = ? AND user_id = ? AND created_at >= datetime('now', '-6 hours')`
      )
      .get(toiletId, userId.trim());
    if (duplicate) {
      res.status(429).json({
        error: 'Bu tuvalet için son 6 saat içinde zaten çalışma saati bildirdiniz.',
      });
      return;
    }

    db.prepare(
      'INSERT INTO hours_reports (toilet_id, user_id, open_hours) VALUES (?, ?, ?)'
    ).run(toiletId, userId.trim(), cleanHours);

    const sameCountRow = db
      .prepare(
        `SELECT COUNT(DISTINCT user_id) as cnt
         FROM hours_reports
         WHERE toilet_id = ? AND open_hours = ?`
      )
      .get(toiletId, cleanHours) as { cnt: number };

    const HOURS_THRESHOLD = 2;
    let hoursVerified = Boolean(toilet.hours_verified);
    let finalHours = toilet.open_hours;

    if (sameCountRow.cnt >= HOURS_THRESHOLD) {
      db.prepare('UPDATE toilets SET open_hours = ?, hours_verified = 1 WHERE id = ?').run(
        cleanHours,
        toiletId
      );
      hoursVerified = true;
      finalHours = cleanHours;
    }

    const effective = computeEffectiveStatus(
      toilet.status,
      finalHours,
      hoursVerified ? 1 : 0,
      getIstanbulMinutesNow()
    );

    res.status(201).json({
      open_hours: finalHours,
      hours_verified: hoursVerified,
      status: effective.status,
      closed_by_hours: effective.closedByHours,
      confirmations: sameCountRow.cnt,
      threshold: HOURS_THRESHOLD,
      message:
        sameCountRow.cnt >= HOURS_THRESHOLD
          ? `Çalışma saati (${finalHours}) 2 kullanıcı tarafından doğrulandı ve güncellendi.`
          : `Saat öneriniz alındı (${sameCountRow.cnt}/${HOURS_THRESHOLD}). Bir kullanıcı daha onayladığında resmi saat olarak güncellenecektir.`,
    });
  });

  // Purchase a single-use QR/code entry ticket for a partner business toilet
  app.post('/api/tickets', (req: Request, res: Response) => {
    const { userId, toiletId } = req.body ?? {};
    const parsedToiletId = Number(toiletId);

    if (!userId || !Number.isFinite(parsedToiletId)) {
      res.status(400).json({ error: 'userId ve toiletId zorunludur.' });
      return;
    }

    const user = db
      .prepare('SELECT id, name, role, wallet_balance FROM users WHERE id = ?')
      .get(String(userId)) as UserRow | undefined;
    if (!user) {
      res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
      return;
    }

    const toilet = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(parsedToiletId) as unknown as ToiletRow | undefined;
    if (!toilet) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }
    if (toilet.type !== 'business' || toilet.price <= 0) {
      res.status(400).json({ error: 'Ücretsiz tuvaletler için bilet satın almaya gerek yoktur.' });
      return;
    }
    if (toilet.status !== 'open') {
      res.status(400).json({ error: 'Bu işletme şu anda kapalı veya bakımda.' });
      return;
    }
    if (user.wallet_balance < toilet.price) {
      res.status(400).json({
        error: `Yetersiz bakiye. Gereken: ${toilet.price} ₺, Mevcut: ${user.wallet_balance} ₺`,
      });
      return;
    }

    const platformFee = Math.round(toilet.price * PLATFORM_FEE_RATE * 100) / 100;
    const businessNet = Math.round((toilet.price - platformFee) * 100) / 100;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    let code = generateTicketCode();
    while (db.prepare('SELECT id FROM tickets WHERE code = ?').get(code)) {
      code = generateTicketCode();
    }

    const isDoorPin = toilet.access_method === 'door_pin';
    const nowIso = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE users SET wallet_balance = ROUND(wallet_balance - ?, 2) WHERE id = ?').run(
        toilet.price,
        user.id
      );

      const insertResult = db
        .prepare(
          `INSERT INTO tickets (user_id, toilet_id, code, amount, platform_fee, business_net, status, expires_at, used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          user.id,
          toilet.id,
          code,
          toilet.price,
          platformFee,
          businessNet,
          isDoorPin ? 'used' : 'active',
          expiresAt,
          isDoorPin ? nowIso : null
        );

      // For door_pin (zero verbal interaction), business is credited immediately on ticket purchase
      if (isDoorPin && toilet.owner_id) {
        db.prepare(
          'UPDATE users SET wallet_balance = ROUND(wallet_balance + ?, 2) WHERE id = ?'
        ).run(businessNet, toilet.owner_id);
      }

      db.exec('COMMIT');

      const ticket = db
        .prepare('SELECT * FROM tickets WHERE id = ?')
        .get(Number(insertResult.lastInsertRowid)) as unknown as TicketRow;
      const updatedUser = db
        .prepare('SELECT wallet_balance FROM users WHERE id = ?')
        .get(user.id) as { wallet_balance: number };

      res.status(201).json({
        ticket: {
          ...ticket,
          toilet_name: toilet.name,
          toilet_address: toilet.address,
          perk_note: toilet.perk_note,
          access_method: toilet.access_method,
          door_pin: isDoorPin ? toilet.door_pin : null,
          location_hint: toilet.location_hint,
        },
        wallet_balance: updatedUser.wallet_balance,
      });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  // Verify/redeem a ticket code at the business counter
  app.post('/api/tickets/verify', (req: Request, res: Response) => {
    const rawCode = req.body?.code;
    const ownerId = req.body?.ownerId;

    if (!rawCode || typeof rawCode !== 'string' || rawCode.trim().length < 4) {
      res.status(400).json({ error: 'Geçerli bir bilet kodu girin.' });
      return;
    }

    const code = rawCode.trim().toUpperCase();
    const ticket = db
      .prepare('SELECT * FROM tickets WHERE code = ?')
      .get(code) as unknown as TicketRow | undefined;

    if (!ticket) {
      res.status(404).json({ error: 'Bilet kodu bulunamadı.' });
      return;
    }

    const toilet = db
      .prepare('SELECT * FROM toilets WHERE id = ?')
      .get(ticket.toilet_id) as unknown as ToiletRow;

    if (ownerId && toilet.owner_id !== ownerId) {
      res.status(403).json({ error: 'Bu bilet sizin işletmenize ait değil.' });
      return;
    }

    if (ticket.status === 'used') {
      res.status(400).json({ error: 'Bu bilet daha önce kullanılmış.' });
      return;
    }

    if (ticket.status === 'expired' || new Date(ticket.expires_at).getTime() < Date.now()) {
      db.prepare("UPDATE tickets SET status = 'expired' WHERE id = ?").run(ticket.id);
      res.status(400).json({ error: 'Bu biletin 15 dakikalık kullanım süresi dolmuş.' });
      return;
    }

    const nowIso = new Date().toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare("UPDATE tickets SET status = 'used', used_at = ? WHERE id = ?").run(
        nowIso,
        ticket.id
      );

      if (toilet.owner_id) {
        db.prepare(
          'UPDATE users SET wallet_balance = ROUND(wallet_balance + ?, 2) WHERE id = ?'
        ).run(ticket.business_net, toilet.owner_id);
      }

      db.exec('COMMIT');

      const updatedTicket = db
        .prepare('SELECT * FROM tickets WHERE id = ?')
        .get(ticket.id) as unknown as TicketRow;

      res.json({
        message: 'Giriş onaylandı! Kazanç işletme cüzdanına aktarıldı.',
        ticket: updatedTicket,
        toilet_name: toilet.name,
      });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  // Get user's tickets
  app.get('/api/tickets/user/:userId', (req: Request, res: Response) => {
    const userId = String(req.params.userId);
    const rows = db
      .prepare(
        `SELECT t.*, tw.name AS toilet_name, tw.address AS toilet_address, tw.perk_note,
                tw.access_method, tw.door_pin, tw.location_hint, tw.lat, tw.lng
         FROM tickets t
         JOIN toilets tw ON tw.id = t.toilet_id
         WHERE t.user_id = ?
         ORDER BY t.id DESC`
      )
      .all(userId);
    res.json(rows);
  });

  // Get reviews for a toilet
  app.get('/api/toilets/:id/reviews', (req: Request, res: Response) => {
    const toiletId = Number(req.params.id);
    const reviews = db
      .prepare('SELECT * FROM reviews WHERE toilet_id = ? ORDER BY id DESC')
      .all(toiletId) as unknown as ReviewRow[];
    res.json(reviews);
  });

  // Add a review and recalculate toilet rating
  app.post('/api/toilets/:id/reviews', (req: Request, res: Response) => {
    const toiletId = Number(req.params.id);
    const { userId = 'user-1', userName = 'Anonim Kullanıcı', rating, comment = '' } = req.body ?? {};
    const parsedRating = Number(rating);

    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      res.status(400).json({ error: 'Puan 1 ile 5 arasında bir tam sayı olmalıdır.' });
      return;
    }

    const toilet = db
      .prepare('SELECT id, rating_avg, rating_count FROM toilets WHERE id = ?')
      .get(toiletId) as { id: number; rating_avg: number; rating_count: number } | undefined;

    if (!toilet) {
      res.status(404).json({ error: 'Tuvalet bulunamadı.' });
      return;
    }

    const recentReview = db
      .prepare(
        `SELECT id FROM reviews
         WHERE toilet_id = ? AND user_id = ? AND created_at >= datetime('now', '-24 hours')`
      )
      .get(toiletId, String(userId));

    if (recentReview) {
      res.status(429).json({
        error: 'Bu tuvalet için son 24 saat içinde zaten bir değerlendirme yaptınız.',
      });
      return;
    }

    const cleanComment = typeof comment === 'string' ? comment.trim() : '';

    db.exec('BEGIN IMMEDIATE');
    try {
      const insert = db
        .prepare(
          'INSERT INTO reviews (toilet_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)'
        )
        .run(toiletId, String(userId), String(userName), parsedRating, cleanComment);

      const newCount = toilet.rating_count + 1;
      const newAvg =
        Math.round(((toilet.rating_avg * toilet.rating_count + parsedRating) / newCount) * 10) / 10;

      db.prepare('UPDATE toilets SET rating_avg = ?, rating_count = ? WHERE id = ?').run(
        newAvg,
        newCount,
        toiletId
      );

      db.exec('COMMIT');

      const created = db
        .prepare('SELECT * FROM reviews WHERE id = ?')
        .get(Number(insert.lastInsertRowid)) as unknown as ReviewRow;

      res.status(201).json({
        review: created,
        rating_avg: newAvg,
        rating_count: newCount,
      });
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  });

  // Business owner dashboard
  app.get('/api/business/:ownerId/dashboard', (req: Request, res: Response) => {
    const ownerId = String(req.params.ownerId);
    const owner = db
      .prepare('SELECT id, name, role, wallet_balance FROM users WHERE id = ?')
      .get(ownerId) as UserRow | undefined;

    if (!owner) {
      res.status(404).json({ error: 'İşletme sahibi bulunamadı.' });
      return;
    }

    const toilets = db
      .prepare('SELECT * FROM toilets WHERE owner_id = ? ORDER BY id DESC')
      .all(ownerId) as unknown as ToiletRow[];

    const transactions = db
      .prepare(
        `SELECT t.*, tw.name AS toilet_name, u.name AS customer_name
         FROM tickets t
         JOIN toilets tw ON tw.id = t.toilet_id
         JOIN users u ON u.id = t.user_id
         WHERE tw.owner_id = ?
         ORDER BY t.id DESC
         LIMIT 25`
      )
      .all(ownerId) as unknown as (TicketRow & { toilet_name: string; customer_name: string })[];

    const reviews = db
      .prepare(
        `SELECT r.*, tw.name AS toilet_name
         FROM reviews r
         JOIN toilets tw ON tw.id = r.toilet_id
         WHERE tw.owner_id = ?
         ORDER BY r.id DESC
         LIMIT 15`
      )
      .all(ownerId);

    const usedTickets = transactions.filter((t) => t.status === 'used');
    const summary = {
      total_uses: usedTickets.length,
      gross_revenue: Math.round(usedTickets.reduce((acc, t) => acc + t.amount, 0) * 100) / 100,
      total_fees: Math.round(usedTickets.reduce((acc, t) => acc + t.platform_fee, 0) * 100) / 100,
      net_revenue: Math.round(usedTickets.reduce((acc, t) => acc + t.business_net, 0) * 100) / 100,
    };

    res.json({
      owner,
      toilets: toilets.map((t) => ({
        ...t,
        wheelchair_accessible: Boolean(t.wheelchair_accessible),
        baby_changing: Boolean(t.baby_changing),
      })),
      transactions,
      reviews,
      summary,
    });
  });

  // Business owner payout / withdraw to IBAN
  app.post('/api/business/:ownerId/withdraw', (req: Request, res: Response) => {
    const ownerId = String(req.params.ownerId);
    const { amount, iban } = req.body ?? {};
    const parsedAmount = Number(amount);
    const cleanIban = typeof iban === 'string' ? iban.replace(/\s+/g, '').toUpperCase() : '';

    if (!/^TR\d{24}$/.test(cleanIban)) {
      res.status(400).json({ error: 'Geçerli bir TR IBAN numarası girin (TR + 24 rakam).' });
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      res.status(400).json({ error: 'Geçerli bir çekim tutarı girin.' });
      return;
    }

    const owner = db
      .prepare('SELECT id, name, role, wallet_balance FROM users WHERE id = ?')
      .get(ownerId) as UserRow | undefined;
    if (!owner) {
      res.status(404).json({ error: 'İşletme sahibi bulunamadı.' });
      return;
    }
    if (parsedAmount > owner.wallet_balance) {
      res.status(400).json({
        error: `Yetersiz cüzdan bakiyesi. Çekilebilir tutar: ${owner.wallet_balance} ₺`,
      });
      return;
    }

    db.prepare('UPDATE users SET wallet_balance = ROUND(wallet_balance - ?, 2) WHERE id = ?').run(
      parsedAmount,
      ownerId
    );
    const updated = db
      .prepare('SELECT id, name, role, wallet_balance FROM users WHERE id = ?')
      .get(ownerId) as unknown as UserRow;

    res.json({
      wallet_balance: updated.wallet_balance,
      message: `${parsedAmount.toFixed(0)} ₺ tutarındaki kazanç ${cleanIban.slice(0, 6)}••••${cleanIban.slice(-4)} IBAN hesabınıza aktarıldı.`,
    });
  });

  return app;
}
