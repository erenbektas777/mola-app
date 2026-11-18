import { useEffect, useState } from 'react';
import {
  ArrowDownToLine,
  CheckCircle2,
  Edit3,
  KeyRound,
  MessageSquare,
  Plus,
  QrCode,
  Star,
  Store,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import type { BusinessDashboard, Toilet } from '../types';

interface BusinessDashboardViewProps {
  ownerId: string;
  userLocation: { lat: number; lng: number };
  onToiletsChanged: () => void;
}

type BizTab = 'places' | 'cashier' | 'reviews';

export function BusinessDashboardView({
  ownerId,
  userLocation,
  onToiletsChanged,
}: BusinessDashboardViewProps) {
  const [dashboard, setDashboard] = useState<BusinessDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [bizTab, setBizTab] = useState<BizTab>('places');

  // Withdraw to IBAN
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('150');
  const [withdrawIban, setWithdrawIban] = useState('TR330006100519786457841326');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Kiosk QR verify
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyMsg, setVerifyMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  // Add new toilet
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Kafe');
  const [address, setAddress] = useState('');
  const [price, setPrice] = useState('20');
  const [perkNote, setPerkNote] = useState('');
  const [openHours, setOpenHours] = useState('08:00 - 23:00');
  const [accessMethod, setAccessMethod] = useState<'door_pin' | 'kiosk_qr'>('door_pin');
  const [doorPin, setDoorPin] = useState('4580#');
  const [locationHint, setLocationHint] = useState('');
  const [lat, setLat] = useState(String(userLocation.lat));
  const [lng, setLng] = useState(String(userLocation.lng));
  const [wheelchair, setWheelchair] = useState(true);
  const [babyChanging, setBabyChanging] = useState(false);
  const [savingToilet, setSavingToilet] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Inline edit toilet (PIN, price, perk, hint)
  const [editingToiletId, setEditingToiletId] = useState<number | null>(null);
  const [editPin, setEditPin] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPerk, setEditPerk] = useState('');
  const [editHint, setEditHint] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await api.getBusinessDashboard(ownerId);
      setDashboard(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [ownerId]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawMsg(null);
    setWithdrawing(true);
    try {
      const res = await api.withdrawBusiness(ownerId, {
        amount: Number(withdrawAmount),
        iban: withdrawIban,
      });
      setWithdrawMsg({ type: 'ok', text: res.message });
      setShowWithdraw(false);
      await loadDashboard();
    } catch (err) {
      setWithdrawMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Para çekme işlemi başarısız.',
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setVerifying(true);
    setVerifyMsg(null);
    try {
      const res = await api.verifyTicket(verifyCode.trim(), ownerId);
      setVerifyMsg({ type: 'ok', text: `${res.message} (+${res.ticket.business_net} ₺)` });
      setVerifyCode('');
      await loadDashboard();
    } catch (err) {
      setVerifyMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Doğrulama başarısız.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleStatus = async (toilet: Toilet) => {
    const next = toilet.status === 'open' ? 'closed' : 'open';
    await api.updateToiletStatus(toilet.id, next);
    await loadDashboard();
    onToiletsChanged();
  };

  const handleSaveEdit = async (toilet: Toilet) => {
    setSavingEdit(true);
    try {
      await api.updateToiletAccess(toilet.id, {
        door_pin: toilet.access_method === 'door_pin' ? editPin.trim() : undefined,
        price: Number(editPrice),
        perk_note: editPerk,
        location_hint: editHint,
      });
      setEditingToiletId(null);
      await loadDashboard();
      onToiletsChanged();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateToilet = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSavingToilet(true);
    try {
      await api.createToilet({
        owner_id: ownerId,
        name,
        category,
        address,
        lat: Number(lat),
        lng: Number(lng),
        price: Number(price),
        perk_note: perkNote,
        open_hours: openHours,
        access_method: accessMethod,
        door_pin: accessMethod === 'door_pin' ? doorPin : undefined,
        location_hint: locationHint,
        wheelchair_accessible: wheelchair,
        baby_changing: babyChanging,
      });
      setName('');
      setAddress('');
      setPerkNote('');
      setLocationHint('');
      setShowAddForm(false);
      await loadDashboard();
      onToiletsChanged();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kayıt eklenemedi.');
    } finally {
      setSavingToilet(false);
    }
  };

  if (loading || !dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-[#78716C]">
        İşletme paneli yükleniyor...
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-12">
      {/* Owner Summary Card */}
      <div className="rounded-2xl bg-[#292524] p-4 text-white shadow-md">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-amber-400" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#9C948B]">İşletme Hesabı</p>
              <h2 className="text-sm font-bold">{dashboard.owner.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setWithdrawMsg(null);
              setShowWithdraw((v) => !v);
            }}
            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-emerald-700"
          >
            <ArrowDownToLine className="h-3.5 w-3.5" />
            Bankaya Çek
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/10 p-2.5">
            <div className="flex items-center gap-1 text-[11px] text-[#D6CCB8]">
              <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              Cüzdan
            </div>
            <p className="mt-1 text-base font-extrabold">{dashboard.owner.wallet_balance} ₺</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5">
            <div className="flex items-center gap-1 text-[11px] text-[#D6CCB8]">
              <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
              Net (%85)
            </div>
            <p className="mt-1 text-base font-extrabold">{dashboard.summary.net_revenue} ₺</p>
          </div>
          <div className="rounded-xl bg-white/10 p-2.5">
            <div className="flex items-center gap-1 text-[11px] text-[#D6CCB8]">
              <CheckCircle2 className="h-3.5 w-3.5 text-sky-300" />
              Kullanım
            </div>
            <p className="mt-1 text-base font-extrabold">{dashboard.summary.total_uses}</p>
          </div>
        </div>
      </div>

      {/* Withdraw Feedback */}
      {withdrawMsg && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            withdrawMsg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {withdrawMsg.text}
        </div>
      )}

      {/* IBAN Withdraw Form */}
      {showWithdraw && (
        <form
          onSubmit={handleWithdraw}
          className="space-y-2.5 rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 shadow-xs"
        >
          <h3 className="text-xs font-bold text-[#292524]">IBAN Hesabına Kazanç Çek</h3>
          <input
            type="text"
            required
            value={withdrawIban}
            onChange={(e) => setWithdrawIban(e.target.value.toUpperCase())}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 font-mono text-xs font-semibold text-[#292524]"
          />
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={dashboard.owner.wallet_balance}
              required
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Tutar (₺)"
              className="flex-1 rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs font-bold text-[#292524]"
            />
            <button
              type="submit"
              disabled={withdrawing}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              {withdrawing ? 'Aktarılıyor...' : 'Transfer Et'}
            </button>
          </div>
        </form>
      )}

      {/* Segmented B2B Sub-tabs */}
      <div className="grid grid-cols-3 rounded-xl bg-[#E6DFD3] p-1 text-[11px] font-bold">
        {[
          { key: 'places', label: `Mekanlar (${dashboard.toilets.length})` },
          { key: 'cashier', label: 'Kasa & Gelir' },
          { key: 'reviews', label: `Yorumlar (${dashboard.reviews?.length ?? 0})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setBizTab(t.key as BizTab)}
            className={`rounded-lg py-1.5 transition ${
              bizTab === t.key ? 'bg-[#FFFDF9] text-[#292524] shadow-xs' : 'text-[#78716C]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: My Places + Add + Inline Edit */}
      {bizTab === 'places' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#292524]">Kayıtlı İşletmelerim</h3>
            <button
              type="button"
              onClick={() => {
                setLat(String(userLocation.lat.toFixed(5)));
                setLng(String(userLocation.lng.toFixed(5)));
                setShowAddForm((v) => !v);
              }}
              className="inline-flex items-center gap-1 rounded-xl bg-[#292524] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              {showAddForm ? 'Vazgeç' : 'İşletme Ekle'}
            </button>
          </div>

          {showAddForm && (
            <form
              onSubmit={handleCreateToilet}
              className="space-y-3 rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 shadow-xs"
            >
              <h4 className="text-xs font-bold uppercase tracking-wide text-[#78716C]">
                Yeni Temassız İşletme Tuvaleti Ekle
              </h4>
              {formError && (
                <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                  {formError}
                </div>
              )}
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="İşletme Adı (örn: Moda Kruvasan)"
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs"
                >
                  <option value="Kafe">Kafe</option>
                  <option value="Restoran">Restoran</option>
                  <option value="Pastane">Pastane</option>
                  <option value="Otel Lobisi">Otel Lobisi</option>
                </select>
                <input
                  type="number"
                  required
                  min={5}
                  max={200}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ücret (₺)"
                  className="rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs"
                />
              </div>

              <div className="space-y-2 rounded-xl bg-[#FAF7F2] p-3">
                <label className="block text-[11px] font-bold text-[#57504B]">
                  Temassız Giriş Yöntemi (Sıfır Sözlü İletişim)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAccessMethod('door_pin')}
                    className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${
                      accessMethod === 'door_pin'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#FFFDF9] text-[#57504B] ring-1 ring-[#E6DFD3]'
                    }`}
                  >
                    🔑 Kapı Şifresi
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessMethod('kiosk_qr')}
                    className={`rounded-lg px-2.5 py-2 text-xs font-semibold ${
                      accessMethod === 'kiosk_qr'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#FFFDF9] text-[#57504B] ring-1 ring-[#E6DFD3]'
                    }`}
                  >
                    📷 Kapı QR Okuyucu
                  </button>
                </div>
                {accessMethod === 'door_pin' && (
                  <input
                    type="text"
                    required
                    value={doorPin}
                    onChange={(e) => setDoorPin(e.target.value)}
                    placeholder="Tuvalet Kapısı Şifresi (örn: 4829#)"
                    className="w-full rounded-xl border border-[#E6DFD3] bg-[#FFFDF9] px-3 py-2 font-mono text-xs font-bold"
                  />
                )}
                <input
                  type="text"
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  placeholder="Mekan içi tarif (örn: Girişten sağa dönün, alt katta)"
                  className="w-full rounded-xl border border-[#E6DFD3] bg-[#FFFDF9] px-3 py-2 text-xs"
                />
              </div>

              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Açık Adres"
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={openHours}
                  onChange={(e) => setOpenHours(e.target.value)}
                  placeholder="Çalışma Saatleri"
                  className="rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={perkNote}
                  onChange={(e) => setPerkNote(e.target.value)}
                  placeholder="Opsiyonel Müşteri İndirimi"
                  className="rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2 text-xs"
                />
              </div>
              <div className="flex gap-4 text-xs text-[#57504B]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={wheelchair}
                    onChange={(e) => setWheelchair(e.target.checked)}
                  />
                  Engelli Erişimi
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={babyChanging}
                    onChange={(e) => setBabyChanging(e.target.checked)}
                  />
                  Bebek Bakım
                </label>
              </div>
              <button
                type="submit"
                disabled={savingToilet}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {savingToilet ? 'Kaydediliyor...' : 'Haritada Yayınla'}
              </button>
            </form>
          )}

          {dashboard.toilets.map((t) => {
            const isOpen = t.status === 'open';
            const isEditing = editingToiletId === t.id;
            return (
              <div
                key={t.id}
                className="space-y-2.5 rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-3.5 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-[#292524]">{t.name}</h4>
                    <p className="text-xs text-[#78716C]">
                      {t.price} ₺ · ★ {t.rating_avg.toFixed(1)} ({t.rating_count}) ·{' '}
                      {t.access_method === 'door_pin' ? '🔑 Kapı Şifresi' : '📷 Kapı QR'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(t)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${
                      isOpen
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-[#EFE9DD] text-[#6B635C]'
                    }`}
                  >
                    {isOpen ? (
                      <>
                        <ToggleRight className="h-4 w-4" /> Açık
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-4 w-4" /> Kapalı
                      </>
                    )}
                  </button>
                </div>

                {isEditing ? (
                  <div className="space-y-2 rounded-xl bg-[#FAF7F2] p-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-bold text-[#78716C]">
                          Ücret (₺)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={500}
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full rounded-lg border border-[#E6DFD3] bg-[#FFFDF9] px-2.5 py-1.5 font-bold"
                        />
                      </div>
                      {t.access_method === 'door_pin' && (
                        <div>
                          <label className="mb-1 block text-[10px] font-bold text-[#78716C]">
                            Kapı Şifresi
                          </label>
                          <input
                            type="text"
                            value={editPin}
                            onChange={(e) => setEditPin(e.target.value)}
                            className="w-full rounded-lg border border-[#E6DFD3] bg-[#FFFDF9] px-2.5 py-1.5 font-mono font-bold"
                          />
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-[#78716C]">
                        Müşteri İndirimi / Jest Notu
                      </label>
                      <input
                        type="text"
                        value={editPerk}
                        onChange={(e) => setEditPerk(e.target.value)}
                        className="w-full rounded-lg border border-[#E6DFD3] bg-[#FFFDF9] px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-[#78716C]">
                        Mekan İçi Tarif
                      </label>
                      <input
                        type="text"
                        value={editHint}
                        onChange={(e) => setEditHint(e.target.value)}
                        className="w-full rounded-lg border border-[#E6DFD3] bg-[#FFFDF9] px-2.5 py-1.5"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingToiletId(null)}
                        className="flex-1 rounded-lg bg-[#E6DFD3] py-1.5 font-semibold text-[#57504B]"
                      >
                        İptal
                      </button>
                      <button
                        type="button"
                        disabled={savingEdit}
                        onClick={() => handleSaveEdit(t)}
                        className="flex-1 rounded-lg bg-emerald-600 py-1.5 font-bold text-white"
                      >
                        {savingEdit ? 'Kaydediliyor...' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl bg-[#FAF7F2] px-3 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-[#57504B]">
                      {t.access_method === 'door_pin' ? (
                        <>
                          <KeyRound className="h-3.5 w-3.5 text-emerald-600" />
                          Şifre: <strong className="font-mono text-[#292524]">{t.door_pin}</strong>
                        </>
                      ) : (
                        <span>QR Okuyucu Aktif</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingToiletId(t.id);
                        setEditPin(t.door_pin ?? '');
                        setEditPrice(String(t.price));
                        setEditPerk(t.perk_note ?? '');
                        setEditHint(t.location_hint ?? '');
                      }}
                      className="inline-flex items-center gap-1 font-semibold text-[#292524] hover:underline"
                    >
                      <Edit3 className="h-3 w-3" />
                      Düzenle
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: Cashier QR + Revenue Breakdown + Transactions */}
      {bizTab === 'cashier' && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 shadow-xs">
            <div className="mb-2 flex items-center gap-2">
              <QrCode className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-bold text-[#292524]">Kapı QR Okuyucu (Kiosk) Doğrulama</h3>
            </div>
            <p className="mb-3 text-xs text-[#78716C]">
              Şifreli kapılarda ödeme otomatik aktarılır. Kiosk QR kullanan mekanlar için 6 haneli
              kodu buradan onaylayabilirsiniz.
            </p>
            <form onSubmit={handleVerify} className="flex gap-2">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.toUpperCase())}
                placeholder="Örn: RB7K92"
                maxLength={8}
                className="flex-1 rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 font-mono text-sm font-bold uppercase tracking-widest focus:border-[#292524] focus:outline-none"
              />
              <button
                type="submit"
                disabled={verifying || !verifyCode.trim()}
                className="rounded-xl bg-[#292524] px-4 py-2.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
              >
                {verifying ? 'Kontrol...' : 'Kapıyı Aç'}
              </button>
            </form>
            {verifyMsg && (
              <div
                className={`mt-2.5 rounded-xl px-3 py-2 text-xs font-medium ${
                  verifyMsg.type === 'ok'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {verifyMsg.text}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-3 text-center text-xs">
            <div>
              <p className="text-[10px] text-[#9C948B]">Brüt Gelir</p>
              <p className="mt-0.5 font-extrabold text-[#292524]">
                {dashboard.summary.gross_revenue} ₺
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#9C948B]">Mola Payı (%15)</p>
              <p className="mt-0.5 font-extrabold text-amber-700">
                -{dashboard.summary.total_fees} ₺
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#9C948B]">Net Kazanç</p>
              <p className="mt-0.5 font-extrabold text-emerald-700">
                +{dashboard.summary.net_revenue} ₺
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-bold text-[#292524]">Son İşlemler</h3>
            {dashboard.transactions.length === 0 ? (
              <p className="rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 text-xs text-[#9C948B]">
                Henüz bilet işlemi bulunmuyor.
              </p>
            ) : (
              dashboard.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <p className="font-bold text-[#3D3733]">
                      {tx.customer_name} · <span className="font-mono">{tx.code}</span>
                    </p>
                    <p className="text-[11px] text-[#78716C]">{tx.toilet_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-700">+{tx.business_net} ₺</p>
                    <p className="text-[10px] text-[#9C948B]">
                      {tx.status === 'used'
                        ? 'Onaylandı'
                        : tx.status === 'active'
                          ? 'Bekliyor'
                          : 'Süresi Doldu'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Customer Reviews */}
      {bizTab === 'reviews' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-[#78716C]" />
            <h3 className="text-sm font-bold text-[#292524]">Müşteri Temizlik Yorumları</h3>
          </div>
          {!dashboard.reviews || dashboard.reviews.length === 0 ? (
            <p className="rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 text-xs text-[#9C948B]">
              Mekanlarınıza henüz yorum yapılmamış.
            </p>
          ) : (
            dashboard.reviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-3.5 text-xs"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-bold text-[#292524]">{rev.toilet_name}</span>
                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {rev.rating} / 5
                  </span>
                </div>
                <p className="text-[#57504B]">
                  {rev.comment || <span className="italic text-[#9C948B]">Yorumsuz puan</span>}
                </p>
                <p className="mt-1 text-[10px] text-[#9C948B]">— {rev.user_name}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
