import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Ticket as TicketIcon,
} from 'lucide-react';
import type { Ticket } from '../types';

interface TicketsViewProps {
  tickets: Ticket[];
}

export function TicketsView({ tickets }: TicketsViewProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedCode(value);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (tickets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <TicketIcon className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-[#292524]">Henüz biletiniz yok</h3>
        <p className="mt-1 max-w-xs text-xs text-[#78716C]">
          Haritadan anlaşmalı bir kafe veya restoran seçip ödeme yaptığınızda kapı şifreniz veya
          QR kodunuz burada görünür — kimseyle konuşmanıza gerek kalmaz.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 pb-24">
      <h2 className="text-base font-bold text-[#292524]">Giriş Biletlerim ({tickets.length})</h2>
      {tickets.map((ticket) => {
        const isDoorPin = ticket.access_method === 'door_pin' && Boolean(ticket.door_pin);
        const isActive = ticket.status === 'active';
        const isStillValid = new Date(ticket.expires_at).getTime() > Date.now();
        const expiresTime = new Date(ticket.expires_at).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div
            key={ticket.id}
            className={`rounded-2xl border bg-[#FFFDF9] p-4 shadow-xs ${
              isActive || (isDoorPin && isStillValid)
                ? 'border-indigo-200'
                : 'border-[#E6DFD3] opacity-80'
            }`}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-[#292524]">{ticket.toilet_name}</h3>
                <p className="text-xs text-[#78716C]">{ticket.toilet_address}</p>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  isDoorPin
                    ? 'bg-emerald-100 text-emerald-800'
                    : isActive
                      ? 'bg-indigo-100 text-indigo-800'
                      : ticket.status === 'used'
                        ? 'bg-[#EFE9DD] text-[#57504B]'
                        : 'bg-red-100 text-red-700'
                }`}
              >
                {isDoorPin ? (
                  <>
                    <KeyRound className="h-3 w-3" /> Şifre Hazır
                  </>
                ) : isActive ? (
                  <>
                    <Clock className="h-3 w-3" /> Kiosk QR Aktif
                  </>
                ) : ticket.status === 'used' ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Kullanıldı
                  </>
                ) : (
                  'Süresi Doldu'
                )}
              </span>
            </div>

            {/* Door PIN (Zero Verbal Interaction) */}
            {isDoorPin && (
              <div className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-center">
                <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Kimseyle konuşmadan doğrudan geçin
                </div>
                <p className="mt-2 text-xs font-medium text-[#6B635C]">Tuvalet Kapısı Şifresi</p>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <span className="font-mono text-3xl font-black tracking-widest text-emerald-800">
                    {ticket.door_pin}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(ticket.door_pin!)}
                    className="rounded-lg bg-[#FFFDF9] p-1.5 text-[#6B635C] shadow-xs hover:bg-[#EFE9DD]"
                    title="Şifreyi Kopyala"
                  >
                    {copiedCode === ticket.door_pin ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Kiosk QR (Door Scanner) */}
            {!isDoorPin && isActive && (
              <div className="mb-3 flex flex-col items-center rounded-2xl bg-[#FAF7F2] p-4">
                <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Kapıdaki QR okuyucuya okutun
                </div>
                <div className="rounded-xl bg-[#FFFDF9] p-3 shadow-xs">
                  <QRCodeSVG value={`RAHATBUL:${ticket.code}`} size={136} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="font-mono text-2xl font-extrabold tracking-widest text-indigo-700">
                    {ticket.code}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(ticket.code)}
                    className="rounded-lg bg-[#FFFDF9] p-1.5 text-[#6B635C] shadow-xs hover:bg-[#EFE9DD]"
                    title="Kodu Kopyala"
                  >
                    {copiedCode === ticket.code ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#78716C]">
                  Son geçerlilik: <strong>{expiresTime}</strong>
                </p>
              </div>
            )}

            {/* Indoor directions so customer doesn't have to ask staff */}
            {ticket.location_hint && (
              <div className="mb-2 flex items-start gap-2 rounded-xl bg-[#FAF7F2] px-3 py-2 text-xs text-[#57504B]">
                <Compass className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />
                <span>
                  <strong>Mekan İçi Tarif:</strong> {ticket.location_hint}
                </span>
              </div>
            )}

            {ticket.perk_note && (
              <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                <Sparkles className="h-3.5 w-3.5 shrink-0" />
                <span>{ticket.perk_note}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-[#78716C]">
              <span>Ödenen: {ticket.amount} ₺</span>
              <span>#{ticket.code}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
