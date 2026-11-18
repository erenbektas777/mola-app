import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createDatabase } from '../src/db.ts';
import { createApp, isOpenAtIstanbulTime } from '../src/app.ts';

describe('RahatBul API (Avrupa Yakası Ücretsiz Tuvaletler)', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('lists 200+ European Side public toilets sorted by distance', async () => {
    const res = await fetch(`${baseUrl}/api/toilets?type=public&lat=41.0665&lng=29.0120`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as Array<{
      name: string;
      type: string;
      price: number;
      distance_meters: number;
    }>;
    assert.ok(data.length >= 200, `Expected >= 200 toilets, got ${data.length}`);
    assert.ok(data.every((t) => t.type === 'public' && t.price === 0));
    assert.ok(data[0].distance_meters <= data[1].distance_meters);
  });

  it('filters toilets by accessibility and search', async () => {
    const res = await fetch(`${baseUrl}/api/toilets?type=public&wheelchair=true&onlyOpen=true`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as Array<{ wheelchair_accessible: boolean; status: string }>;
    assert.ok(data.length > 0);
    assert.ok(data.every((t) => t.wheelchair_accessible && t.status === 'open'));
  });

  it('enforces proximity, cooldown, and 3-user quorum for maintenance reports', async () => {
    // 1. Far away user (>250m) is rejected
    const farRes = await fetch(`${baseUrl}/api/toilets/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'u-far',
        reportType: 'maintenance',
        reason: 'Kapısı kilitli',
        lat: 41.0,
        lng: 28.9,
      }),
    });
    assert.equal(farRes.status, 400);

    // 2. First nearby user report keeps toilet OPEN (1/3)
    const r1 = await fetch(`${baseUrl}/api/toilets/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'u-1',
        reportType: 'maintenance',
        reason: 'Kapısı kilitli',
        lat: 41.0664,
        lng: 29.0124,
      }),
    });
    assert.equal(r1.status, 201);
    const b1 = (await r1.json()) as { status: string; recent_maintenance_reports: number };
    assert.equal(b1.status, 'open');
    assert.equal(b1.recent_maintenance_reports, 1);

    // 3. Same user cannot spam a second report within 6 hours
    const dupRes = await fetch(`${baseUrl}/api/toilets/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'u-1',
        reportType: 'maintenance',
        reason: 'Kapısı kilitli',
        lat: 41.0664,
        lng: 29.0124,
      }),
    });
    assert.equal(dupRes.status, 429);

    // 4. Two more distinct nearby users reach 3/3 -> flips to maintenance
    const r2 = await fetch(`${baseUrl}/api/toilets/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'u-2',
        reportType: 'maintenance',
        reason: 'Tadilat var',
        lat: 41.0664,
        lng: 29.0124,
      }),
    });
    assert.equal(r2.status, 201);
    assert.equal(((await r2.json()) as { status: string }).status, 'open');

    const r3 = await fetch(`${baseUrl}/api/toilets/1/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'u-3',
        reportType: 'maintenance',
        reason: 'Kapalı',
        lat: 41.0664,
        lng: 29.0124,
      }),
    });
    assert.equal(r3.status, 201);
    const b3 = (await r3.json()) as { status: string; recent_maintenance_reports: number };
    assert.equal(b3.status, 'maintenance');
    assert.equal(b3.recent_maintenance_reports, 3);
  });

  it('adds a review, updates average rating, and enforces 24h cooldown', async () => {
    const revRes = await fetch(`${baseUrl}/api/toilets/1/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        userName: 'Eren',
        rating: 5,
        comment: 'Gayet temizdi.',
      }),
    });
    assert.equal(revRes.status, 201);
    const body = (await revRes.json()) as { rating_count: number; rating_avg: number };
    assert.equal(body.rating_count, 25);
    assert.ok(body.rating_avg >= 3.8);

    // Second review by same user on same toilet within 24h is blocked
    const dupRevRes = await fetch(`${baseUrl}/api/toilets/1/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        userName: 'Eren',
        rating: 1,
        comment: 'Tekrar yorum',
      }),
    });
    assert.equal(dupRevRes.status, 429);
  });

  it('computes open/closed status from Istanbul time ranges accurately', () => {
    assert.equal(isOpenAtIstanbulTime('07:00 - 23:00', 12 * 60), true);
    assert.equal(isOpenAtIstanbulTime('07:00 - 23:00', 23 * 60 + 30), false);
    assert.equal(isOpenAtIstanbulTime('06:00 - 00:00', 15), false); // 00:15 after midnight
    assert.equal(isOpenAtIstanbulTime('07:00 - 01:00', 30), true); // 00:30 overnight
    assert.equal(isOpenAtIstanbulTime('24 Saat Açık', 3 * 60), true);
  });

  it('verifies and updates opening hours after 2 distinct user reports', async () => {
    const listRes = await fetch(`${baseUrl}/api/toilets?type=public`);
    const list = (await listRes.json()) as Array<{ id: number; hours_verified: boolean }>;
    const target = list.find((t) => !t.hours_verified);
    assert.ok(target, 'Expected at least one unverified toilet');

    const badRes = await fetch(`${baseUrl}/api/toilets/${target.id}/hours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', openHours: 'invalid' }),
    });
    assert.equal(badRes.status, 400);

    const r1 = await fetch(`${baseUrl}/api/toilets/${target.id}/hours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', openHours: '08:00 - 22:00' }),
    });
    assert.equal(r1.status, 201);
    const b1 = (await r1.json()) as { hours_verified: boolean; confirmations: number };
    assert.equal(b1.confirmations, 1);
    assert.equal(b1.hours_verified, false);

    const r2 = await fetch(`${baseUrl}/api/toilets/${target.id}/hours`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u2', openHours: '08:00 - 22:00' }),
    });
    assert.equal(r2.status, 201);
    const b2 = (await r2.json()) as {
      hours_verified: boolean;
      open_hours: string;
      confirmations: number;
    };
    assert.equal(b2.confirmations, 2);
    assert.equal(b2.hours_verified, true);
    assert.equal(b2.open_hours, '08:00 - 22:00');
  });

  it('allows suggesting a missing public toilet and rejects duplicates within 40m', async () => {
    const outOfBounds = await fetch(`${baseUrl}/api/toilets/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ankara Park WC',
        category: 'Park / Meydan',
        address: 'Çankaya, Ankara',
        lat: 39.92,
        lng: 32.85,
      }),
    });
    assert.equal(outOfBounds.status, 400);

    const createdRes = await fetch(`${baseUrl}/api/toilets/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Maçka Parkı Üst Giriş WC',
        category: 'Park / Meydan',
        address: 'Vişnezade, Beşiktaş, İstanbul',
        lat: 41.0455,
        lng: 28.9935,
        wheelchair_accessible: true,
        baby_changing: false,
      }),
    });
    assert.equal(createdRes.status, 201);
    const created = (await createdRes.json()) as { id: number; name: string; type: string };
    assert.equal(created.name, 'Maçka Parkı Üst Giriş WC');
    assert.equal(created.type, 'public');

    const dupRes = await fetch(`${baseUrl}/api/toilets/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aynı Yer WC',
        category: 'Park / Meydan',
        address: 'Vişnezade, Beşiktaş',
        lat: 41.04555,
        lng: 28.99355,
      }),
    });
    assert.equal(dupRes.status, 409);
  });

  it('handles business door_pin zero-talk access and kiosk_qr verification with payout', async () => {
    const bizRes = await fetch(`${baseUrl}/api/toilets?type=business`);
    const bizList = (await bizRes.json()) as Array<{
      id: number;
      name: string;
      access_method: string;
      price: number;
    }>;
    assert.ok(bizList.length >= 4);

    const pinToilet = bizList.find((t) => t.access_method === 'door_pin' && t.price === 20);
    const qrToilet = bizList.find((t) => t.access_method === 'kiosk_qr');
    assert.ok(pinToilet && qrToilet);

    const buyPinRes = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', toiletId: pinToilet.id }),
    });
    assert.equal(buyPinRes.status, 201);
    const pinBody = (await buyPinRes.json()) as {
      ticket: { door_pin: string; status: string; business_net: number };
      wallet_balance: number;
    };
    assert.ok(pinBody.ticket.door_pin.length >= 4);
    assert.equal(pinBody.ticket.status, 'used');
    assert.equal(pinBody.ticket.business_net, 17);
    assert.equal(pinBody.wallet_balance, 100);

    const buyQrRes = await fetch(`${baseUrl}/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1', toiletId: qrToilet.id }),
    });
    assert.equal(buyQrRes.status, 201);
    const qrBody = (await buyQrRes.json()) as { ticket: { code: string; status: string } };
    assert.equal(qrBody.ticket.status, 'active');

    const verifyRes = await fetch(`${baseUrl}/api/tickets/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: qrBody.ticket.code, ownerId: 'owner-1' }),
    });
    assert.equal(verifyRes.status, 200);
  });

  it('supports business IBAN withdrawal and extended place access editing', async () => {
    const dashBeforeRes = await fetch(`${baseUrl}/api/business/owner-1/dashboard`);
    assert.equal(dashBeforeRes.status, 200);
    const dashBefore = (await dashBeforeRes.json()) as {
      owner: { wallet_balance: number };
      toilets: Array<{ id: string }>;
      reviews: unknown[];
    };
    assert.ok(Array.isArray(dashBefore.reviews));
    assert.ok(dashBefore.toilets.length > 0);

    const toiletId = dashBefore.toilets[0].id;

    // Invalid price (< 5) should fail
    const badPatchRes = await fetch(`${baseUrl}/api/toilets/${toiletId}/access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: 2 }),
    });
    assert.equal(badPatchRes.status, 400);

    // Valid extended access update (price + perk_note)
    const patchRes = await fetch(`${baseUrl}/api/toilets/${toiletId}/access`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        price: 35,
        perk_note: 'Mola misafirlerine %15 kahve indirimi',
      }),
    });
    assert.equal(patchRes.status, 200);
    const patched = (await patchRes.json()) as {
      price: number;
      perk_note: string;
    };
    assert.equal(patched.price, 35);
    assert.equal(patched.perk_note, 'Mola misafirlerine %15 kahve indirimi');

    // Invalid IBAN should return 400
    const badWithdrawRes = await fetch(`${baseUrl}/api/business/owner-1/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 50, iban: 'TR123' }),
    });
    assert.equal(badWithdrawRes.status, 400);

    // Valid withdrawal should deduct balance
    const withdrawAmount = Math.min(50, dashBefore.owner.wallet_balance);
    if (withdrawAmount > 0) {
      const withdrawRes = await fetch(`${baseUrl}/api/business/owner-1/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: withdrawAmount,
          iban: 'TR120006200000000012345678',
        }),
      });
      assert.equal(withdrawRes.status, 200);
      const withdrawBody = (await withdrawRes.json()) as {
        wallet_balance: number;
      };
      assert.equal(
        withdrawBody.wallet_balance,
        Number((dashBefore.owner.wallet_balance - withdrawAmount).toFixed(2)),
      );
    }
  });
});
