import { useCallback, useEffect, useState } from 'react';
import {
  Accessibility,
  Award,
  Baby,
  List,
  Map as MapIcon,
  MapPin,
  Navigation,
  Plus,
  PlusCircle,
  Search,
  Star,
  Store,
  Ticket as TicketIcon,
  User as UserIcon,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { api } from './api';
import { BusinessDashboardView } from './components/BusinessDashboardView';
import { RahatBulLogo } from './components/RahatBulLogo';
import { TicketsView } from './components/TicketsView';
import { ToiletDetailSheet } from './components/ToiletDetailSheet';
import { ToiletMap } from './components/ToiletMap';
import { WalletTopUpModal } from './components/WalletTopUpModal';
import type { Ticket, Toilet, User } from './types';

type Tab = 'map' | 'list' | 'top' | 'tickets' | 'business';

const DEFAULT_USER_ID = 'user-1';
const DEFAULT_OWNER_ID = 'owner-1';
// Default location: Zincirlikuyu Metrobus, Istanbul
const DEFAULT_LOCATION = { lat: 41.0664, lng: 29.0124 };

function getOrCreateDeviceId(): string {
  const key = 'mola_device_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev-${crypto.randomUUID()}`
        : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, generated);
    return generated;
  } catch {
    return DEFAULT_USER_ID;
  }
}

export function App() {
  const [deviceId] = useState<string>(getOrCreateDeviceId);
  const [hasSelectedRole, setHasSelectedRole] = useState(false);
  const [mode, setMode] = useState<'user' | 'business'>('user');
  const [tab, setTab] = useState<Tab>('map');
  const [user, setUser] = useState<User | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [userLocation, setUserLocation] = useState(DEFAULT_LOCATION);
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);

  // Suggest missing toilet modal state
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestName, setSuggestName] = useState('');
  const [suggestCategory, setSuggestCategory] = useState('Park / Meydan');
  const [suggestAddress, setSuggestAddress] = useState('');
  const [suggestWheelchair, setSuggestWheelchair] = useState(false);
  const [suggestBaby, setSuggestBaby] = useState(false);
  const [suggestSubmitting, setSuggestSubmitting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Filters & List Sort
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'business'>('all');
  const [showClosed, setShowClosed] = useState(false);
  const [wheelchair, setWheelchair] = useState(false);
  const [babyChanging, setBabyChanging] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [manualFocus, setManualFocus] = useState<{ lat: number; lng: number } | null>(null);
  const [listSort, setListSort] = useState<'distance' | 'rating'>('distance');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const sortedListToilets = [...toilets].sort((a, b) => {
    if (listSort === 'rating') {
      if (b.rating_avg !== a.rating_avg) return b.rating_avg - a.rating_avg;
      return b.rating_count - a.rating_count;
    }
    return (a.distance_meters ?? 0) - (b.distance_meters ?? 0);
  });
  const topRatedToilets = [...toilets].sort((a, b) => {
    if (b.rating_avg !== a.rating_avg) return b.rating_avg - a.rating_avg;
    if (b.rating_count !== a.rating_count) return b.rating_count - a.rating_count;
    return (a.distance_meters ?? 0) - (b.distance_meters ?? 0);
  });

  useEffect(() => {
    Promise.all([api.getUser(DEFAULT_USER_ID), api.getUserTickets(DEFAULT_USER_ID)])
      .then(([u, tks]) => {
        setUser(u);
        setTickets(tks);
      })
      .catch(() => {});
  }, []);

  const loadToilets = useCallback(async () => {
    try {
      const list = await api.getToilets({
        type: typeFilter,
        onlyOpen: !showClosed,
        wheelchair,
        babyChanging,
        search,
        lat: userLocation.lat,
        lng: userLocation.lng,
      });
      setToilets(list);
      if (typeFilter === 'all' && !search.trim() && !wheelchair && !babyChanging && !showClosed) {
        try {
          localStorage.setItem('mola_cached_toilets', JSON.stringify(list));
        } catch {
          // ignore storage quota errors
        }
      }
    } catch {
      try {
        const cached = localStorage.getItem('mola_cached_toilets');
        if (cached) {
          setToilets(JSON.parse(cached) as Toilet[]);
        }
      } catch {
        // ignore cache parse errors
      }
    }
  }, [typeFilter, showClosed, wheelchair, babyChanging, search, userLocation]);

  useEffect(() => {
    loadToilets().catch(() => {});
  }, [loadToilets]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        setUserLocation(DEFAULT_LOCATION);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    handleLocateMe();
  }, [handleLocateMe]);

  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const handleTopUp = () => {
    if (!user) return;
    setShowTopUpModal(true);
  };

  const handleSwitchMode = (nextMode: 'user' | 'business') => {
    setMode(nextMode);
    setSelectedToilet(null);
    if (nextMode === 'business') {
      setTab('business');
    } else if (tab === 'business') {
      setTab('map');
    }
  };

  const isMapTab = mode === 'user' && tab === 'map';
  const activeTicketsCount = tickets.filter((t) => t.status === 'active').length;

  if (!hasSelectedRole) {
    return (
      <div className="mx-auto flex h-screen max-w-md flex-col justify-between bg-[#FAF7F2] px-6 py-10 shadow-2xl">
        <div className="mt-8 flex flex-col items-center text-center">
          <RahatBulLogo size={56} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-[#292524]">Mola</h1>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-[#78716C]">
            İstanbul’da en yakın ücretsiz ve temassız tuvaleti bul, ya da işletmeni gelir ortağı
            olarak haritaya ekle.
          </p>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              handleLocateMe();
              setMode('user');
              setTab('map');
              setHasSelectedRole(true);
            }}
            className="flex w-full items-start gap-3.5 rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-[#292524]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#292524]">Kullanıcı Olarak Devam Et</h2>
              <p className="mt-0.5 text-xs text-[#78716C]">
                Yakındaki ücretsiz tuvaletleri ve kimseyle konuşmadan girilen anlaşmalı mekanları
                gör.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('business');
              setTab('business');
              setHasSelectedRole(true);
            }}
            className="flex w-full items-start gap-3.5 rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 text-left shadow-sm transition active:scale-[0.99] hover:border-[#292524]"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#292524]">İşletme Paneli</h2>
              <p className="mt-0.5 text-xs text-[#78716C]">
                Kafe veya restoran tuvaletini yayınla, kapı şifresi veya QR ile temassız ek gelir
                kazan.
              </p>
            </div>
          </button>
        </div>

        <p className="text-center text-[11px] text-[#9C948B]">
          İstediğin zaman üst bardan mod değiştirebilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex h-screen max-w-md flex-col overflow-hidden bg-[#FAF7F2] shadow-2xl">
      {/* Floating Warm-Sand Header on Map, Clean Header on List/Top/Tickets/Business */}
      <header
        className={
          isMapTab
            ? 'pointer-events-none absolute inset-x-0 top-0 z-[500] px-4 pt-3.5'
            : 'z-20 border-b border-[#E6DFD3] bg-[#FFFDF9]/95 px-4 pb-3 pt-3.5 backdrop-blur-md'
        }
      >
        <div className="pointer-events-auto flex items-center justify-between gap-2">
          <div
            className={`flex items-center gap-2 ${
              isMapTab
                ? 'rounded-2xl bg-[#FFFDF9]/92 px-2.5 py-1.5 shadow-md ring-1 ring-[#D6CCB8]/70 backdrop-blur-md'
                : ''
            }`}
          >
            <RahatBulLogo size={26} />
            <h1 className="text-[15px] font-bold tracking-tight text-[#292524]">Mola</h1>
          </div>

          <div className="flex items-center gap-1.5">
            {mode === 'user' && user && (
              <button
                type="button"
                onClick={handleTopUp}
                title="Cüzdana +50 ₺ yükle"
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 transition active:scale-95 ${
                  isMapTab ? 'bg-[#FFFDF9]/95 shadow-sm backdrop-blur-md' : 'bg-emerald-50'
                }`}
              >
                <Wallet className="h-3 w-3" />
                {user.wallet_balance.toFixed(0)} ₺
                <PlusCircle className="h-3 w-3 text-emerald-600" />
              </button>
            )}

            <div
              className={`flex rounded-full p-0.5 text-[11px] font-bold ${
                isMapTab
                  ? 'bg-[#FFFDF9]/92 shadow-sm ring-1 ring-[#D6CCB8]/70 backdrop-blur-md'
                  : 'bg-[#EFE9DD]'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSwitchMode('user')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                  mode === 'user' ? 'bg-[#292524] text-white shadow-xs' : 'text-[#78716C]'
                }`}
              >
                <UserIcon className="h-3 w-3" />
                Kullanıcı
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode('business')}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition ${
                  mode === 'business' ? 'bg-[#292524] text-white shadow-xs' : 'text-[#78716C]'
                }`}
              >
                <Store className="h-3 w-3" />
                İşletme
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filters (User Map/List/Top) */}
        {mode === 'user' && tab !== 'tickets' && (
          <div className="pointer-events-auto mt-2.5 space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#78716C]" />
              <input
                type="text"
                value={search}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setManualFocus(null);
                }}
                placeholder="Semt, durak, park veya kafe ara..."
                className={`w-full rounded-2xl py-2 pl-9 pr-8 text-xs text-[#3D3733] placeholder:text-[#9C948B] focus:outline-none focus:ring-2 focus:ring-[#D6CCB8] ${
                  isMapTab
                    ? 'bg-[#FFFDF9]/92 shadow-md ring-1 ring-[#D6CCB8]/70 backdrop-blur-md focus:bg-[#FFFDF9]'
                    : 'bg-[#EFE9DD]/90 focus:bg-[#FFFDF9]'
                }`}
              />
              {search.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setManualFocus(null);
                  }}
                  className="absolute right-2.5 top-1/2 z-10 -translate-y-1/2 rounded-full p-0.5 text-[#9C948B] hover:bg-[#E6DFD3] hover:text-[#57504B]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Google Maps-style Search Suggestions Dropdown */}
              {searchFocused && search.trim().length >= 1 && (
                <div className="absolute left-0 right-0 top-full z-[600] mt-1.5 overflow-hidden rounded-2xl bg-[#FFFDF9]/95 shadow-xl ring-1 ring-[#D6CCB8] backdrop-blur-md">
                  {toilets.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-[#9C948B]">
                      "{search.trim()}" için sonuç bulunamadı.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#EFE9DD]">
                      {toilets.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearch(item.name);
                            setSearchFocused(false);
                            setManualFocus({ lat: item.lat, lng: item.lng });
                            setSelectedToilet(item);
                            setTab('map');
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition hover:bg-[#FAF7F2]"
                        >
                          <div className="flex min-w-0 items-start gap-2">
                            <MapPin
                              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                item.type === 'business' ? 'text-amber-600' : 'text-[#9C948B]'
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-[#292524]">
                                {item.name}
                              </p>
                              <p className="truncate text-[10px] text-[#9C948B]">{item.address}</p>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600">
                              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                              {item.rating_avg.toFixed(1)}
                            </span>
                            <p className="text-[10px] font-medium text-[#9C948B]">
                              {item.type === 'business' ? `${item.price} ₺` : 'Ücretsiz'}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Centered Filter Pills */}
            <div className="flex flex-nowrap items-center justify-center gap-1 overflow-x-auto pb-0.5 sm:gap-1.5">
              {[
                { key: 'all', label: 'Tümü' },
                { key: 'public', label: 'Ücretsiz' },
                { key: 'business', label: 'İşletme' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setTypeFilter(opt.key as 'all' | 'public' | 'business')}
                  className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10.5px] font-semibold transition sm:px-2.5 sm:text-[11px] ${
                    typeFilter === opt.key
                      ? opt.key === 'business'
                        ? 'bg-amber-600 text-white shadow-md'
                        : opt.key === 'public'
                          ? 'bg-[#38bdf8] text-white shadow-md'
                          : 'bg-[#292524] text-white shadow-md'
                      : isMapTab
                        ? 'bg-[#FFFDF9]/92 text-[#57504B] shadow-sm ring-1 ring-[#D6CCB8]/70 backdrop-blur-md hover:bg-[#FFFDF9]'
                        : 'bg-[#EFE9DD]/90 text-[#6B635C] hover:bg-[#E6DFD3]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setShowClosed((v) => !v)}
                className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1 text-[10.5px] font-semibold transition sm:px-2.5 sm:text-[11px] ${
                  showClosed
                    ? 'bg-[#292524] text-white shadow-md'
                    : isMapTab
                      ? 'bg-[#FFFDF9]/92 text-[#57504B] shadow-sm ring-1 ring-[#D6CCB8]/70 backdrop-blur-md hover:bg-[#FFFDF9]'
                      : 'bg-[#EFE9DD]/90 text-[#6B635C] hover:bg-[#E6DFD3]'
                }`}
              >
                Kapalılar
              </button>

              <button
                type="button"
                onClick={() => {
                  setWheelchair((v) => {
                    const next = !v;
                    if (next) setBabyChanging(false);
                    return next;
                  });
                }}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10.5px] font-semibold transition sm:px-2.5 sm:text-[11px] ${
                  wheelchair
                    ? 'bg-[#292524] text-white shadow-md'
                    : isMapTab
                      ? 'bg-[#FFFDF9]/92 text-[#57504B] shadow-sm ring-1 ring-[#D6CCB8]/70 backdrop-blur-md hover:bg-[#FFFDF9]'
                      : 'bg-[#EFE9DD]/90 text-[#6B635C] hover:bg-[#E6DFD3]'
                }`}
              >
                <Accessibility className="h-3 w-3" />
                Engelli
              </button>

              <button
                type="button"
                onClick={() => {
                  setBabyChanging((v) => {
                    const next = !v;
                    if (next) setWheelchair(false);
                    return next;
                  });
                }}
                className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10.5px] font-semibold transition sm:px-2.5 sm:text-[11px] ${
                  babyChanging
                    ? 'bg-[#292524] text-white shadow-md'
                    : isMapTab
                      ? 'bg-[#FFFDF9]/92 text-[#57504B] shadow-sm ring-1 ring-[#D6CCB8]/70 backdrop-blur-md hover:bg-[#FFFDF9]'
                      : 'bg-[#EFE9DD]/90 text-[#6B635C] hover:bg-[#E6DFD3]'
                }`}
              >
                <Baby className="h-3 w-3" />
                Bebek
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="relative flex-1 overflow-y-auto">
        {mode === 'user' && tab === 'map' && (
          <div className="absolute inset-0">
            <ToiletMap
              toilets={toilets}
              userLocation={userLocation}
              focusLocation={
                manualFocus ??
                (search.trim().length >= 2 && toilets.length > 0
                  ? { lat: toilets[0].lat, lng: toilets[0].lng }
                  : null)
              }
              selectedToiletId={selectedToilet?.id ?? null}
              onSelectToilet={setSelectedToilet}
              onLocateMe={handleLocateMe}
            />
            {isOffline && (
              <div className="pointer-events-none absolute inset-x-4 top-32 z-[400] flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50/95 px-3 py-1 text-[11px] font-semibold text-amber-800 shadow-sm ring-1 ring-amber-200 backdrop-blur">
                  <WifiOff className="h-3 w-3" />
                  Çevrimdışı mod — önbellekten gösteriliyor
                </span>
              </div>
            )}
            {toilets.length > 0 && !selectedToilet && (
              <div className="absolute bottom-22 left-4 right-16 z-[400] flex items-center justify-between gap-2 rounded-2xl bg-[#FFFDF9]/95 p-3 shadow-lg ring-1 ring-[#D6CCB8]/70 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setSelectedToilet(toilets[0])}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        toilets[0].type === 'business' ? 'bg-amber-600' : 'bg-emerald-500'
                      }`}
                    />
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9C948B]">
                      {toilets[0].type === 'business'
                        ? `En Yakın İşletme · ${toilets[0].price} ₺`
                        : 'En Yakın Nokta'}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[13px] font-bold text-[#292524]">
                    {toilets[0].name}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#78716C]">
                    {toilets[0].distance_meters ?? '—'} m · ★ {toilets[0].rating_avg.toFixed(1)}
                  </p>
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${toilets[0].lat},${toilets[0].lng}&travelmode=walking`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-xs transition active:scale-95 hover:bg-emerald-700"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Acil Git
                </a>
              </div>
            )}
          </div>
        )}

        {mode === 'user' && tab === 'list' && (
          <div className="space-y-2.5 p-4 pb-28">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setSuggestError(null);
                  setShowSuggestModal(true);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition active:scale-95 hover:bg-emerald-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Eksik WC Öner
              </button>

              <div className="inline-flex rounded-xl bg-[#E6DFD3] p-0.5">
                {[
                  { key: 'distance', label: 'En Yakın' },
                  { key: 'rating', label: 'En Yüksek Puan' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setListSort(opt.key as 'distance' | 'rating')}
                    className={`rounded-[10px] px-2.5 py-1 text-[11px] font-semibold transition ${
                      listSort === opt.key
                        ? 'bg-[#FFFDF9] text-[#292524] shadow-xs'
                        : 'text-[#78716C] hover:text-[#57504B]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {sortedListToilets.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedToilet(t)}
                className="w-full rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-3.5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-slate-300 active:scale-[0.99]"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-[13px] font-bold text-[#292524]">{t.name}</h3>
                    <p className="text-[11px] text-[#9C948B]">{t.category}</p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EFE9DD] px-2 py-0.5 text-[11px] font-semibold text-[#57504B]">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {t.rating_avg.toFixed(1)}
                  </span>
                </div>
                <p className="mb-2 truncate text-xs text-[#78716C]">{t.address}</p>
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={`font-semibold ${
                      t.status !== 'open'
                        ? 'text-amber-600'
                        : t.type === 'business'
                          ? 'text-amber-700'
                          : 'text-emerald-600'
                    }`}
                  >
                    {t.status !== 'open'
                      ? 'Bakımda / Saat Dışı'
                      : t.type === 'business'
                        ? `Temassız Giriş · ${t.price} ₺`
                        : 'Açık · Ücretsiz'}
                  </span>
                  {t.distance_meters !== null && (
                    <span className="font-semibold text-[#6B635C]">
                      {t.distance_meters} m · {t.walk_minutes} dk
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {mode === 'user' && tab === 'top' && (
          <div className="space-y-2.5 p-4 pb-28">
            <div className="rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-4 shadow-[0_2px_8px_rgba(15,23,42,0.03)]">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-bold text-[#292524]">En Yüksek Puanlılar</h2>
              </div>
              <p className="mt-1 text-xs text-[#78716C]">
                5 yıldız üzerinden temizlik değerlendirmelerine göre sıralanır.
              </p>
            </div>

            {topRatedToilets.map((t, index) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedToilet(t)}
                className="w-full rounded-2xl border border-[#E6DFD3] bg-[#FFFDF9] p-3.5 text-left shadow-[0_2px_8px_rgba(15,23,42,0.03)] transition hover:border-slate-300 active:scale-[0.99]"
              >
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                        index < 3
                          ? 'bg-[#292524] text-white'
                          : 'bg-[#EFE9DD] text-[#78716C]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-[13px] font-bold text-[#292524]">{t.name}</h3>
                      <p className="text-[11px] text-[#9C948B]">
                        {t.rating_count} değerlendirme
                        {t.type === 'business' ? ` · ${t.price} ₺` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {t.rating_avg.toFixed(1)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#78716C]">
                  <span className="truncate pr-2">{t.address}</span>
                  {t.distance_meters !== null && (
                    <span className="shrink-0 font-semibold text-[#6B635C]">
                      {t.distance_meters} m
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {mode === 'user' && tab === 'tickets' && <TicketsView tickets={tickets} />}

        {mode === 'business' && (
          <BusinessDashboardView
            ownerId={DEFAULT_OWNER_ID}
            userLocation={userLocation}
            onToiletsChanged={loadToilets}
          />
        )}
      </main>

      {/* Floating Warm-Sand Bottom Navigation (User Mode) */}
      {mode === 'user' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
          <nav className="pointer-events-auto grid w-full grid-cols-4 rounded-2xl bg-[#FFFDF9]/92 p-1.5 shadow-xl ring-1 ring-[#D6CCB8]/70 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setTab('map')}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                tab === 'map' ? 'bg-[#292524] text-white' : 'text-[#78716C] hover:text-[#3D3733]'
              }`}
            >
              <MapIcon className="h-4 w-4" />
              Harita
            </button>
            <button
              type="button"
              onClick={() => setTab('list')}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                tab === 'list' ? 'bg-[#292524] text-white' : 'text-[#78716C] hover:text-[#3D3733]'
              }`}
            >
              <List className="h-4 w-4" />
              Liste
            </button>
            <button
              type="button"
              onClick={() => setTab('top')}
              className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                tab === 'top' ? 'bg-[#292524] text-white' : 'text-[#78716C] hover:text-[#3D3733]'
              }`}
            >
              <Award className="h-4 w-4" />
              En İyiler
            </button>
            <button
              type="button"
              onClick={() => setTab('tickets')}
              className={`relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                tab === 'tickets'
                  ? 'bg-[#292524] text-white'
                  : 'text-[#78716C] hover:text-[#3D3733]'
              }`}
            >
              <TicketIcon className="h-4 w-4" />
              Biletlerim
              {activeTicketsCount > 0 && (
                <span className="absolute right-4 top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                  {activeTicketsCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      )}

      {/* Toilet Detail Modal */}
      {selectedToilet && (
        <ToiletDetailSheet
          toilet={selectedToilet}
          userId={deviceId}
          walletUserId={user?.id ?? DEFAULT_USER_ID}
          userName={user?.name ?? 'Mola Kullanıcısı'}
          userLocation={userLocation}
          walletBalance={user?.wallet_balance ?? 0}
          onClose={() => setSelectedToilet(null)}
          onTicketPurchased={(ticket, newBalance) => {
            if (user) setUser({ ...user, wallet_balance: newBalance });
            setTickets((prev) => [ticket, ...prev]);
            setSelectedToilet(null);
            setTab('tickets');
          }}
          onToiletUpdated={(updated) => {
            setSelectedToilet(updated);
            setToilets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          }}
        />
      )}

      {/* Suggest Missing Toilet Modal */}
      {showSuggestModal && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/35 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-t-[28px] bg-[#FFFDF9] px-5 pb-6 pt-3 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#E6DFD3]" />
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#292524]">Eksik Ücretsiz WC Öner</h2>
                <p className="text-xs text-[#78716C]">
                  Mevcut konumunuzdaki ücretsiz tuvaleti haritaya ekleyin.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestModal(false)}
                className="rounded-full bg-[#EFE9DD] p-2 text-[#78716C] hover:bg-[#E6DFD3]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {suggestError && (
              <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {suggestError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSuggestError(null);
                setSuggestSubmitting(true);
                try {
                  const created = await api.suggestToilet({
                    name: suggestName,
                    category: suggestCategory,
                    address: suggestAddress,
                    lat: userLocation.lat,
                    lng: userLocation.lng,
                    wheelchair_accessible: suggestWheelchair,
                    baby_changing: suggestBaby,
                  });
                  setSuggestName('');
                  setSuggestAddress('');
                  setSuggestWheelchair(false);
                  setSuggestBaby(false);
                  setShowSuggestModal(false);
                  await loadToilets();
                  setSelectedToilet(created);
                } catch (err) {
                  setSuggestError(
                    err instanceof Error ? err.message : 'Tuvalet önerisi eklenemedi.'
                  );
                } finally {
                  setSuggestSubmitting(false);
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                required
                minLength={3}
                value={suggestName}
                onChange={(e) => setSuggestName(e.target.value)}
                placeholder="Yer / Tuvalet Adı (örn: Maçka Parkı Üst Giriş WC)"
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 text-xs text-[#292524] focus:border-[#292524] focus:outline-none"
              />
              <select
                value={suggestCategory}
                onChange={(e) => setSuggestCategory(e.target.value)}
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 text-xs text-[#292524]"
              >
                <option value="Park / Meydan">Park / Meydan</option>
                <option value="Metro / İskele">Metro / İskele</option>
                <option value="Cami / Meydan">Cami / Meydan</option>
                <option value="AVM / Çarşı">AVM / Çarşı</option>
                <option value="Halka Açık WC">Halka Açık WC</option>
              </select>
              <input
                type="text"
                required
                minLength={4}
                value={suggestAddress}
                onChange={(e) => setSuggestAddress(e.target.value)}
                placeholder="Semt / Adres (örn: Vişnezade, Beşiktaş)"
                className="w-full rounded-xl border border-[#E6DFD3] bg-[#FAF7F2] px-3 py-2.5 text-xs text-[#292524] focus:border-[#292524] focus:outline-none"
              />
              <div className="flex items-center justify-between rounded-xl bg-[#FAF7F2] px-3 py-2 text-[11px] text-[#78716C]">
                <span>
                  Konum: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
                </span>
                <button
                  type="button"
                  onClick={handleLocateMe}
                  className="font-bold text-emerald-700 hover:underline"
                >
                  Konumumu Güncelle
                </button>
              </div>
              <div className="flex gap-4 text-xs text-[#57504B]">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={suggestWheelchair}
                    onChange={(e) => setSuggestWheelchair(e.target.checked)}
                  />
                  Engelli Erişimi
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={suggestBaby}
                    onChange={(e) => setSuggestBaby(e.target.checked)}
                  />
                  Bebek Bakım
                </label>
              </div>
              <button
                type="submit"
                disabled={suggestSubmitting}
                className="w-full rounded-xl bg-[#292524] py-3 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {suggestSubmitting ? 'Ekleniyor...' : 'Haritaya Ekle'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3-Step E-Commerce Wallet Top-Up Modal */}
      {showTopUpModal && user && (
        <WalletTopUpModal
          userId={user.id}
          currentBalance={user.wallet_balance}
          onClose={() => setShowTopUpModal(false)}
          onSuccess={(newBalance) => {
            setUser({ ...user, wallet_balance: newBalance });
          }}
        />
      )}
    </div>
  );
}

export default App;
