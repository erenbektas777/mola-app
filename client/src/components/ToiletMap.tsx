import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import type { Toilet } from '../types';

const RATING_ZOOM_THRESHOLD = 15;
const CLUSTER_RADIUS_PX = 46;
const ISTANBUL_BOUNDS: L.LatLngBoundsExpression = [
  [40.8, 28.1],
  [41.35, 29.55],
];

interface ToiletMapProps {
  toilets: Toilet[];
  userLocation: { lat: number; lng: number };
  focusLocation?: { lat: number; lng: number } | null;
  selectedToiletId: number | null;
  onSelectToilet: (toilet: Toilet) => void;
  onLocateMe: () => void;
}

interface ToiletCluster {
  lat: number;
  lng: number;
  items: Toilet[];
}

function clusterToilets(map: L.Map, toilets: Toilet[]): ToiletCluster[] {
  const clusters: Array<ToiletCluster & { px: L.Point }> = [];

  for (const toilet of toilets) {
    const pt = map.latLngToLayerPoint([toilet.lat, toilet.lng]);
    let matched: (ToiletCluster & { px: L.Point }) | null = null;

    for (const c of clusters) {
      if (pt.distanceTo(c.px) <= CLUSTER_RADIUS_PX) {
        matched = c;
        break;
      }
    }

    if (matched) {
      const n = matched.items.length;
      matched.lat = (matched.lat * n + toilet.lat) / (n + 1);
      matched.lng = (matched.lng * n + toilet.lng) / (n + 1);
      matched.items.push(toilet);
      matched.px = map.latLngToLayerPoint([matched.lat, matched.lng]);
    } else {
      clusters.push({
        lat: toilet.lat,
        lng: toilet.lng,
        items: [toilet],
        px: pt,
      });
    }
  }

  return clusters;
}

export function ToiletMap({
  toilets,
  userLocation,
  focusLocation = null,
  selectedToiletId,
  onSelectToilet,
  onLocateMe,
}: ToiletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [zoomLevel, setZoomLevel] = useState(14);
  const [viewportTick, setViewportTick] = useState(0);
  const isZoomTransitionRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [userLocation.lat, userLocation.lng],
      zoom: 14,
      minZoom: 10,
      zoomSnap: 0,
      zoomDelta: 0.5,
      scrollWheelZoom: false,
      inertia: true,
      inertiaDeceleration: 2000,
      inertiaMaxSpeed: 1800,
      bounceAtZoomLimits: false,
      maxBounds: ISTANBUL_BOUNDS,
      maxBoundsViscosity: 0.85,
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: true,
      markerZoomAnimation: true,
      fadeAnimation: false,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri',
        maxNativeZoom: 16,
        maxZoom: 18,
        keepBuffer: 8,
        updateWhenZooming: false,
        updateWhenIdle: true,
      }
    ).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    let zoomEndTimer: ReturnType<typeof setTimeout> | null = null;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const speed = e.ctrlKey ? 0.018 : 0.006;
      const rawDelta = -e.deltaY * speed;
      const delta = Math.max(-0.65, Math.min(0.65, rawDelta));
      if (Math.abs(delta) < 0.001) return;

      const currentZoom = map.getZoom();
      const nextZoom = Math.min(18, Math.max(10, currentZoom + delta));
      const rect = container.getBoundingClientRect();
      const point = L.point(e.clientX - rect.left, e.clientY - rect.top);

      map.setZoomAround(point, nextZoom, { animate: false });

      if (zoomEndTimer) clearTimeout(zoomEndTimer);
      zoomEndTimer = setTimeout(() => {
        isZoomTransitionRef.current = true;
        setZoomLevel(map.getZoom());
        setViewportTick((t) => t + 1);
      }, 110);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });

    map.on('zoomend', () => {
      isZoomTransitionRef.current = true;
      setZoomLevel(map.getZoom());
      setViewportTick((t) => t + 1);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (zoomEndTimer) clearTimeout(zoomEndTimer);
      container.removeEventListener('wheel', handleWheel);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([userLocation.lat, userLocation.lng], Math.max(map.getZoom(), 14), {
      duration: 0.9,
    });
  }, [userLocation.lat, userLocation.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusLocation) return;
    map.flyTo([focusLocation.lat, focusLocation.lng], 15, {
      duration: 0.85,
    });
  }, [focusLocation?.lat, focusLocation?.lng]);

  const showRatings = zoomLevel >= RATING_ZOOM_THRESHOLD;

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // User location marker (pulsing GPS navigation beacon)
    const userIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;width:36px;height:36px;">
        <div class="rahatbul-user-pulse" style="position:absolute;width:28px;height:28px;border-radius:9999px;background:rgba(79,70,229,0.28);"></div>
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:#4f46e5;border:2.5px solid #ffffff;box-shadow:0 4px 12px rgba(79,70,229,0.45);">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 })
      .bindTooltip('Konumunuz', { direction: 'top' })
      .addTo(layer);

    const animateZoom = isZoomTransitionRef.current;
    isZoomTransitionRef.current = false;

    const groups: ToiletCluster[] = showRatings
      ? toilets.map((t) => ({ lat: t.lat, lng: t.lng, items: [t] }))
      : clusterToilets(map, toilets);

    for (const group of groups) {
      if (group.items.length > 1) {
        const count = group.items.length;
        const size = count >= 20 ? 44 : count >= 10 ? 40 : 36;
        const clusterIcon = L.divIcon({
          className: '',
          html: `<div class="${animateZoom ? 'rahatbul-cluster-bubble' : ''}" style="
            display:flex;align-items:center;justify-content:center;
            width:${size}px;height:${size}px;border-radius:9999px;
            background:rgba(56,189,248,0.24);
          ">
            <div style="
              position:relative;display:flex;align-items:center;justify-content:center;gap:2px;
              height:${size - 8}px;min-width:${size - 8}px;padding:0 6px;border-radius:9999px;
              background:#38bdf8;color:#ffffff;font-weight:800;font-size:11px;
              border:2px solid #FFFDF9;box-shadow:0 3px 10px rgba(41,37,36,0.22);
            ">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                <path d="M12 2.5C12 2.5 5.5 9.8 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.8 12 2.5 12 2.5Z"/>
              </svg>
              <span>${count}</span>
            </div>
          </div>`,
          iconSize: [size + 8, size],
          iconAnchor: [(size + 8) / 2, size / 2],
        });

        const clusterMarker = L.marker([group.lat, group.lng], { icon: clusterIcon });
        clusterMarker.on('click', () => {
          map.flyTo([group.lat, group.lng], Math.min(map.getZoom() + 2, 16), {
            duration: 0.6,
            easeLinearity: 0.25,
          });
        });
        clusterMarker.addTo(layer);
        continue;
      }

      const toilet = group.items[0];
      const isClosed = toilet.status !== 'open';
      const isBusiness = toilet.type === 'business';
      const isSelected = toilet.id === selectedToiletId;
      const dotCore = isClosed ? '#cbd5e1' : isBusiness ? '#d97706' : '#38bdf8';
      const dotHalo = isClosed
        ? 'rgba(203,213,225,0.28)'
        : isBusiness
          ? 'rgba(217,119,6,0.24)'
          : 'rgba(56,189,248,0.24)';
      const tierBg = isClosed
        ? '#94a3b8'
        : toilet.rating_avg >= 4
          ? '#059669'
          : toilet.rating_avg >= 1
            ? '#d97706'
            : '#dc2626';
      const tierGlow = isClosed
        ? 'rgba(148,163,184,0.28)'
        : toilet.rating_avg >= 4
          ? 'rgba(5,150,105,0.34)'
          : toilet.rating_avg >= 1
            ? 'rgba(217,119,6,0.34)'
            : 'rgba(220,38,38,0.34)';
      const ratingLabel = isBusiness
        ? `${toilet.price}₺ · <span style="color:#fde047;">★</span>${toilet.rating_avg.toFixed(1)}`
        : `<span style="color:#fde047;">★</span>${toilet.rating_avg.toFixed(1)}`;

      const icon = L.divIcon({
        className: '',
        html: `<div class="rahatbul-marker ${animateZoom ? 'rahatbul-marker--entering' : ''}">
          <div class="rahatbul-dot" style="
            display:flex;align-items:center;justify-content:center;
            width:${isSelected ? '32px' : '26px'};
            height:${isSelected ? '32px' : '26px'};
            border-radius:9999px;
            background:${dotHalo};
          ">
            <div style="
              display:flex;align-items:center;justify-content:center;
              width:${isSelected ? '24px' : '20px'};
              height:${isSelected ? '24px' : '20px'};
              border-radius:9999px;
              background:${dotCore};
              border:${isSelected ? '2.5px solid #facc15' : '2px solid #FFFDF9'};
              box-shadow:0 3px 8px rgba(41,37,36,0.22);
            ">
              <svg width="${isSelected ? '12' : '10'}" height="${isSelected ? '12' : '10'}" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
                <path d="M12 2.5C12 2.5 5.5 9.8 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 9.8 12 2.5 12 2.5Z"/>
              </svg>
            </div>
          </div>
          <div class="rahatbul-rating" style="
            --tier-bg:${tierBg};
            --tier-glow:${tierGlow};
            display:inline-flex;align-items:center;gap:3px;
            padding:3px 8px;border-radius:9999px;
            color:#ffffff;font-weight:800;font-size:11px;
            white-space:nowrap;
            border:${isSelected ? '2.5px solid #facc15' : '2px solid #ffffff'};
            ${isSelected ? 'scale:1.12;' : ''}
          ">${ratingLabel}</div>
        </div>`,
        iconSize: [52, 26],
        iconAnchor: [26, 13],
      });

      const marker = L.marker([toilet.lat, toilet.lng], {
        icon,
        zIndexOffset: isSelected ? 900 : 0,
      });
      marker.on('click', () => onSelectToilet(toilet));
      marker.addTo(layer);
    }
  }, [toilets, userLocation, selectedToiletId, showRatings, viewportTick, onSelectToilet]);

  return (
    <div
      className={`relative h-full w-full bg-[#F3EFE6] ${
        showRatings ? 'rahatbul-map--ratings' : ''
      }`}
    >
      <div ref={containerRef} className="absolute inset-0" />

      {/* Locate me button */}
      <button
        type="button"
        onClick={onLocateMe}
        title="Konumuma Git"
        className="absolute bottom-22 right-4 z-[400] flex h-10 w-10 items-center justify-center rounded-full bg-[#FFFDF9]/95 text-[#292524] shadow-lg ring-1 ring-[#D6CCB8]/70 backdrop-blur-md transition active:scale-95 hover:bg-[#FFFDF9]"
      >
        <LocateFixed className="h-4 w-4 text-[#292524]" />
      </button>
    </div>
  );
}
