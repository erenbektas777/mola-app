import { useState } from 'react';
import { CheckCircle2, CreditCard, Lock, ShieldCheck, Smartphone, X } from 'lucide-react';
import { api } from '../api';

interface WalletTopUpModalProps {
  userId: string;
  currentBalance: number;
  onClose: () => void;
  onSuccess: (newBalance: number) => void;
}

type Step = 'amount' | 'card' | '3ds' | 'done';

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function WalletTopUpModal({
  userId,
  currentBalance,
  onClose,
  onSuccess,
}: WalletTopUpModalProps) {
  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>('100');

  // Card form
  const [cardHolder, setCardHolder] = useState('EREN YILMAZ');
  const [cardNumber, setCardNumber] = useState('4543 6012 3456 7890');
  const [expiry, setExpiry] = useState('08/29');
  const [cvv, setCvv] = useState('342');
  const [error, setError] = useState<string | null>(null);

  // 3D Secure SMS
  const [smsCode, setSmsCode] = useState('');
  const [processing, setProcessing] = useState(false);
  const [newBalance, setNewBalance] = useState<number>(currentBalance);

  const handleContinueToCard = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = Number(customAmount);
    if (!Number.isFinite(parsed) || parsed < 10 || parsed > 5000) {
      setError('Yükleme tutarı 10 ₺ ile 5.000 ₺ arasında olmalıdır.');
      return;
    }
    setAmount(parsed);
    setStep('card');
  };

  const handleContinueTo3DS = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleanDigits = cardNumber.replace(/\D/g, '');
    if (cardHolder.trim().length < 3) {
      setError('Kart üzerindeki ad soyadı girin.');
      return;
    }
    if (cleanDigits.length !== 16) {
      setError('Lütfen 16 haneli geçerli bir kart numarası girin.');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
      setError('Son kullanma tarihini AA/YY formatında girin.');
      return;
    }
    if (cvv.replace(/\D/g, '').length < 3) {
      setError('3 haneli CVV güvenlik kodunu girin.');
      return;
    }
    setSmsCode('');
    setStep('3ds');
  };

  const handleConfirm3DS = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (smsCode.replace(/\D/g, '').length !== 6) {
      setError('Lütfen 6 haneli 3D Secure doğrulama kodunu girin.');
      return;
    }
    setProcessing(true);
    try {
      const updated = await api.topUpUser(userId, amount);
      setNewBalance(updated.wallet_balance);
      onSuccess(updated.wallet_balance);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ödeme onaylanamadı.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/35 backdrop-blur-[2px]">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#FFFDF9] px-5 pb-6 pt-3 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E6DFD3]" />

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#292524] text-white">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#292524]">Güvenli Cüzdan Yükleme</h2>
              <p className="text-[11px] text-[#78716C]">
                Mevcut Bakiye: <strong>{currentBalance.toFixed(0)} ₺</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#EFE9DD] p-2 text-[#78716C] hover:bg-[#E6DFD3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator */}
        {step !== 'done' && (
          <div className="mb-4 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
            {[
              { id: 'amount', label: '1. Tutar' },
              { id: 'card', label: '2. Kart Bilgisi' },
              { id: '3ds', label: '3. 3D Secure' },
            ].map((s, idx) => {
              const activeIdx = step === 'amount' ? 0 : step === 'card' ? 1 : 2;
              const isDoneOrActive = idx <= activeIdx;
              return (
                <div
                  key={s.id}
                  className={`rounded-lg py-1.5 ${
                    isDoneOrActive
                      ? 'bg-[#292524] text-white'
                      : 'bg-[#EFE9DD] text-[#9C948B]'
                  }`}
                >
                  {s.label}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Step 1: Amount */}
        {step === 'amount' && (
          <form onSubmit={handleContinueToCard} className="space-y-3">
            <p className="text-xs font-semibold text-[#57504B]">Yüklenecek Tutarı Seçin</p>
            <div className="grid grid-cols-4 gap-2">
              {[50, 100, 200, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setCustomAmount(String(preset));
                  }}
                  className={`rounded-xl py-2.5 text-xs font-bold transition ${
                    Number(customAmount) === preset
                      ? 'bg-[#292524] text-white shadow-xs'
                      : 'bg-[#EFE9DD] text-[#57504B] hover:bg-[#E6DFD3]'
                  }`}
                >
                  {preset} ₺
                </button>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#78716C]">
                Veya Özel Tutar (₺)
              </label>
              <input
                type="number"
                min={10}
                max={5000}
                required
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 text-sm font-bold text-[#292524] focus:border-[#292524] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-xs transition hover:bg-emerald-700"
            >
              Ödeme Adımına Geç ({customAmount || 0} ₺)
            </button>
          </form>
        )}

        {/* Step 2: Card Details */}
        {step === 'card' && (
          <form onSubmit={handleContinueTo3DS} className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-[#FAF7F2] px-3 py-2 text-xs">
              <span className="text-[#78716C]">Ödenecek Tutar:</span>
              <span className="font-extrabold text-[#292524]">{amount.toFixed(2)} ₺</span>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#78716C]">
                Kart Üzerindeki Ad Soyad
              </label>
              <input
                type="text"
                required
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                placeholder="AD SOYAD"
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 text-xs font-semibold uppercase text-[#292524] focus:border-[#292524] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[#78716C]">
                <span>Kart Numarası</span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#57504B]">
                  <CreditCard className="h-3.5 w-3.5" />
                  {cardNumber.startsWith('5') ? 'Mastercard' : 'VISA'}
                </span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="0000 0000 0000 0000"
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 font-mono text-xs font-bold tracking-wider text-[#292524] focus:border-[#292524] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#78716C]">
                  Son Kullanma (AA/YY)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="AA/YY"
                  className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 font-mono text-xs font-bold text-[#292524] focus:border-[#292524] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-[#78716C]">
                  CVV / CVC
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="•••"
                  className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 font-mono text-xs font-bold text-[#292524] focus:border-[#292524] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>256-bit SSL ve 3D Secure ile korumalı ödeme simülasyonu.</span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('amount')}
                className="flex-1 rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] py-3 text-xs font-bold text-[#57504B]"
              >
                Geri
              </button>
              <button
                type="submit"
                className="flex-[1.6] rounded-xl bg-[#292524] py-3 text-xs font-bold text-white hover:opacity-90"
              >
                3D Secure ile Öde ({amount} ₺)
              </button>
            </div>
          </form>
        )}

        {/* Step 3: 3D Secure SMS Verification */}
        {step === '3ds' && (
          <form onSubmit={handleConfirm3DS} className="space-y-3">
            <div className="rounded-2xl border border-[#E6DFD3] bg-[#FAF7F2] p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Smartphone className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-[#292524]">3D Secure SMS Doğrulama</h3>
              <p className="mt-1 text-xs text-[#78716C]">
                <strong>05•• ••• •• 42</strong> numaralı telefonunuza gönderilen 6 haneli tek
                kullanımlık şifreyi girin.
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#FFFDF9] px-2.5 py-1 text-[11px] text-[#57504B] ring-1 ring-[#E6DFD3]">
                <span>Demo SMS Kodu:</span>
                <button
                  type="button"
                  onClick={() => setSmsCode('482910')}
                  className="font-mono font-extrabold text-indigo-600 underline"
                >
                  482910 (Doldur)
                </button>
              </div>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 haneli SMS kodu"
              className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] py-3 text-center font-mono text-lg font-extrabold tracking-[0.35em] text-[#292524] focus:border-[#292524] focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('card')}
                className="flex-1 rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] py-3 text-xs font-bold text-[#57504B]"
              >
                Geri
              </button>
              <button
                type="submit"
                disabled={processing}
                className="flex-[1.6] rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {processing ? 'Onaylanıyor...' : `Onayla ve ${amount} ₺ Yükle`}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 'done' && (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#292524]">Ödeme Başarılı!</h3>
              <p className="mt-1 text-xs text-[#78716C]">
                Cüzdanınıza <strong>+{amount} ₺</strong> eklendi. Yeni bakiyeniz:{' '}
                <strong className="text-emerald-700">{newBalance.toFixed(0)} ₺</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#292524] py-3 text-xs font-bold text-white hover:opacity-90"
            >
              Tamam
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
