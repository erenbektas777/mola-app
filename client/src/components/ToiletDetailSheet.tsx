import { useEffect, useState } from 'react';
import {
  Accessibility,
  AlertTriangle,
  Baby,
  Clock,
  Compass,
  KeyRound,
  MapPin,
  Navigation,
  QrCode,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { Review, Ticket, Toilet } from '../types';

interface ToiletDetailSheetProps {
  toilet: Toilet;
  userId: string;
  walletUserId?: string;
  userName: string;
  userLocation: { lat: number; lng: number };
  walletBalance: number;
  onClose: () => void;
  onTicketPurchased: (ticket: Ticket, newBalance: number) => void;
  onToiletUpdated: (updated: Toilet) => void;
}

export function ToiletDetailSheet({
  toilet,
  userId,
  walletUserId,
  userName,
  userLocation,
  walletBalance,
  onClose,
  onTicketPurchased,
  onToiletUpdated,
}: ToiletDetailSheetProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportReason, setReportReason] = useState('Kapısı Kilitli / Kapalı');
  const [reporting, setReporting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const [showHoursForm, setShowHoursForm] = useState(false);
  const [hoursInput, setHoursInput] = useState(toilet.open_hours || '07:00 - 23:00');
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingReviews(true);
    api
      .getReviews(toilet.id)
      .then((list) => {
        if (active) setReviews(list);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, [toilet.id]);

  const handleBuyTicket = async () => {
    setError(null);
    setBuying(true);
    try {
      const res = await api.buyTicket(walletUserId ?? userId, toilet.id);
      onTicketPurchased(res.ticket, res.wallet_balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bilet alınamadı.');
    } finally {
      setBuying(false);
    }
  };

  const handleReportStatus = async (reportType: 'maintenance' | 'open') => {
    setError(null);
    setReportFeedback(null);
    setReporting(true);
    try {
      const res = await api.reportStatus(toilet.id, {
        userId,
        reportType,
        reason: reportType === 'maintenance' ? reportReason : 'Tuvalet açık ve kullanılabilir',
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
      setReportFeedback(res.message);
      setShowReportPanel(false);
      onToiletUpdated({
        ...toilet,
        status: res.status,
        recent_maintenance_reports: res.recent_maintenance_reports,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirim gönderilemedi.');
    } finally {
      setReporting(false);
    }
  };

  const handleReportHours = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setReportFeedback(null);
    setSavingHours(true);
    try {
      const res = await api.reportHours(toilet.id, {
        userId,
        openHours: hoursInput,
      });
      setReportFeedback(res.message);
      setShowHoursForm(false);
      onToiletUpdated({
        ...toilet,
        open_hours: res.open_hours,
        hours_verified: res.hours_verified,
        status: res.status,
        closed_by_hours: res.closed_by_hours,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saat bildirimi gönderilemedi.');
    } finally {
      setSavingHours(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    setError(null);
    setReviewSuccess(false);
    try {
      const res = await api.addReview(toilet.id, {
        userId,
        userName,
        rating,
        comment: comment.trim(),
      });
      setReviews((prev) => [res.review, ...prev]);
      onToiletUpdated({
        ...toilet,
        rating_avg: res.rating_avg,
        rating_count: res.rating_count,
      });
      setComment('');
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yorum gönderilemedi.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lng}&travelmode=walking`;
  const isOpen = toilet.status === 'open';

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#292524]/35 backdrop-blur-[2px]">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#FFFDF9] px-5 pb-6 pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E6DFD3]" />
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#292524]">{toilet.name}</h2>
            <p className="text-xs font-medium text-[#78716C]">{toilet.category}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#EFE9DD] p-2 text-[#78716C] hover:bg-[#E6DFD3]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Info rows */}
        <div className="mb-4 space-y-2 rounded-2xl bg-[#FAF7F2] p-3.5 text-sm text-[#57504B]">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#9C948B]" />
            <span>{toilet.address}</span>
          </div>
          <div className="flex items-start justify-between gap-2 text-xs text-[#6B635C]">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-[#9C948B]" />
                {toilet.hours_verified ? (
                  <span className="font-medium text-[#3D3733]">
                    Doğrulanmış Saat: {toilet.open_hours}
                  </span>
                ) : (
                  <span className="text-amber-700">Saat bilgisi doğrulanmadı</span>
                )}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setHoursInput(toilet.open_hours || '07:00 - 23:00');
                    setShowHoursForm((v) => !v);
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:underline"
                >
                  {showHoursForm ? 'Vazgeç' : 'Çalışma saatini bildir'}
                </button>
              </div>
            </div>
          </div>

          {showHoursForm && (
            <form
              onSubmit={handleReportHours}
              className="space-y-2 rounded-xl border border-[#E6DFD3] bg-[#FFFDF9] p-2.5"
            >
              <div className="flex flex-wrap gap-1">
                {['07:00 - 23:00', '08:00 - 22:00', '06:00 - 00:00', '24 Saat Açık'].map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setHoursInput(preset)}
                      className={`rounded-lg px-2 py-1 text-[10px] font-semibold ${
                        hoursInput === preset
                          ? 'bg-[#292524] text-white'
                          : 'bg-[#EFE9DD] text-[#6B635C]'
                      }`}
                    >
                      {preset}
                    </button>
                  )
                )}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={hoursInput}
                  onChange={(e) => setHoursInput(e.target.value)}
                  placeholder="Örn: 08:00 - 22:00"
                  className="flex-1 rounded-lg border border-[#E6DFD3] px-2.5 py-1.5 text-xs focus:border-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={savingHours}
                  className="rounded-lg bg-[#292524] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                >
                  {savingHours ? '...' : 'Gönder'}
                </button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFFDF9] px-2 py-1 text-xs font-semibold text-[#3D3733] shadow-xs">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {toilet.rating_avg.toFixed(1)} ({toilet.rating_count})
            </span>
            {toilet.wheelchair_accessible && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFFDF9] px-2 py-1 text-xs font-medium text-[#57504B] shadow-xs">
                <Accessibility className="h-3.5 w-3.5 text-blue-600" />
                Engelli Erişimi
              </span>
            )}
            {toilet.baby_changing && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#FFFDF9] px-2 py-1 text-xs font-medium text-[#57504B] shadow-xs">
                <Baby className="h-3.5 w-3.5 text-pink-600" />
                Bebek Bakım
              </span>
            )}
            {toilet.type === 'business' && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                Kimseyle Konuşmadan Giriş
              </span>
            )}
          </div>
        </div>

        {/* Step-by-step indoor/area navigation hint */}
        {toilet.location_hint && (
          <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs text-emerald-950">
            <div className="mb-1.5 flex items-center gap-2">
              <Compass className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="font-bold">Adım Adım Alan / Mekan İçi Tarif</span>
            </div>
            <div className="space-y-1 pl-6 leading-relaxed text-emerald-900">
              {toilet.location_hint
                .split(/(?=\d+\)\s)/)
                .map((step) => step.trim())
                .filter(Boolean)
                .map((step, idx) => (
                  <p key={idx}>{step}</p>
                ))}
            </div>
          </div>
        )}

        {/* Business Perk Banner */}
        {toilet.perk_note && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <div>
              <span className="font-bold">İşletme Avantajı: </span>
              {toilet.perk_note}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Primary Actions */}
        <div className="mb-5 flex gap-2.5">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#E6DFD3] bg-[#FFFDF9] px-4 py-3 text-sm font-semibold text-[#3D3733] hover:bg-[#FAF7F2]"
          >
            <Navigation className="h-4 w-4 text-blue-600" />
            Yol Tarifi
          </a>

          {toilet.type === 'business' ? (
            <button
              type="button"
              disabled={!isOpen || buying}
              onClick={handleBuyTicket}
              className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {toilet.access_method === 'door_pin' ? (
                <KeyRound className="h-4 w-4" />
              ) : (
                <QrCode className="h-4 w-4" />
              )}
              {buying
                ? 'İşleniyor...'
                : !isOpen
                  ? 'Şu An Kapalı'
                  : toilet.access_method === 'door_pin'
                    ? `Kapı Şifresini Al (${toilet.price} ₺)`
                    : `QR Bilet Al (${toilet.price} ₺)`}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowReportPanel((v) => !v)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-3 text-xs font-semibold text-[#57504B] hover:bg-[#EFE9DD]"
            >
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Durum Bildir
            </button>
          )}
        </div>

        {/* Community status warning & verification panel */}
        {toilet.status === 'open' && (toilet.recent_maintenance_reports ?? 0) > 0 && (
          <div className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Son 6 saatte <strong>{toilet.recent_maintenance_reports}/3</strong> arıza bildirimi
            yapıldı. 3 farklı kullanıcı doğruladığında bakımda olarak işaretlenir.
          </div>
        )}

        {reportFeedback && (
          <div className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
            {reportFeedback}
          </div>
        )}

        {showReportPanel && (
          <div className="mb-4 space-y-2.5 rounded-2xl border border-[#E6DFD3] bg-[#FAF7F2] p-3.5">
            <p className="text-xs font-bold text-[#3D3733]">
              Konum Doğrulamalı Durum Bildirimi (En fazla 250 m)
            </p>
            <p className="text-[11px] text-[#78716C]">
              Yanlış bildirimleri önlemek için yalnızca tuvaletin yakınındayken bildirim
              yapılabilir ve 3 farklı doğrulama gerekir.
            </p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full rounded-xl border border-[#E6DFD3] bg-[#FFFDF9] px-3 py-2 text-xs text-[#3D3733]"
            >
              <option value="Kapısı Kilitli / Kapalı">Kapısı Kilitli / Kapalı</option>
              <option value="Tadilat / Arıza Var">Tadilat / Arıza Var</option>
              <option value="Su / Temizlik Sorunu">Su / Temizlik Sorunu</option>
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={reporting}
                onClick={() => handleReportStatus('maintenance')}
                className="flex-1 rounded-xl bg-amber-600 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40"
              >
                {reporting ? 'Gönderiliyor...' : 'Arızalı / Kapalı Bildir'}
              </button>
              <button
                type="button"
                disabled={reporting}
                onClick={() => handleReportStatus('open')}
                className="flex-1 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Sorun Yok, Açık
              </button>
            </div>
          </div>
        )}

        {toilet.type === 'business' && (
          <p className="mb-4 text-center text-[11px] text-[#78716C]">
            Cüzdan bakiyeniz: <strong className="text-[#57504B]">{walletBalance.toFixed(0)} ₺</strong> ·
            Bilet 15 dk geçerlidir.
          </p>
        )}

        {/* Reviews Section */}
        <div className="border-t border-[#EFE9DD] pt-4">
          <h3 className="mb-3 text-sm font-bold text-[#292524]">
            Temizlik Yorumları ({toilet.rating_count})
          </h3>

          <form onSubmit={handleSubmitReview} className="mb-4 space-y-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-0.5"
                >
                  <Star
                    className={`h-5 w-5 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-xs font-medium text-[#78716C]">Temizlik Puanın</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Yorumunuz (opsiyonel)..."
                className="flex-1 rounded-xl border border-[#E6DFD3] px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="rounded-xl bg-[#292524] px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                {submittingReview ? 'Kaydediliyor...' : 'Değerlendir'}
              </button>
            </div>
            {reviewSuccess && (
              <p className="text-xs font-semibold text-emerald-700">
                Değerlendirmen kaydedildi! Teşekkürler.
              </p>
            )}
          </form>

          {loadingReviews ? (
            <p className="text-xs text-[#9C948B]">Yorumlar yükleniyor...</p>
          ) : reviews.length === 0 ? (
            <p className="text-xs text-[#9C948B]">Henüz yorum yapılmamış.</p>
          ) : (
            <div className="space-y-2.5">
              {reviews.map((rev) => (
                <div key={rev.id} className="rounded-xl bg-[#FAF7F2] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#3D3733]">{rev.user_name}</span>
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {rev.rating} / 5
                    </span>
                  </div>
                  <p className="text-xs text-[#6B635C]">
                    {rev.comment || <span className="italic text-[#9C948B]">Yorumsuz yıldız puanı</span>}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
