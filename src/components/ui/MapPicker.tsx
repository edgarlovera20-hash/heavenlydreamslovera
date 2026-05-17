import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Crosshair, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Map, MapMarker, MarkerContent, MapControls, useMap } from './map';

interface MapPickerProps {
  coords: string;
  onCoordsChange: (coords: string) => void;
  searchAddress?: string; // auto-search this address when provided
}

function parseCoords(s: string): { lat: number; lng: number } | null {
  const m = s.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}

/** Inner controller that has access to the map context, so we can flyTo when coords change. */
function MapController({ lat, lng }: { lat: number; lng: number }) {
  const { map, isLoaded } = useMap();
  const lastRef = useRef<string>('');
  useEffect(() => {
    if (!isLoaded || !map) return;
    const key = `${lat},${lng}`;
    if (key === lastRef.current) return;
    lastRef.current = key;
    map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 800 });
  }, [lat, lng, isLoaded, map]);
  return null;
}

/** Inner component that wires up map clicks → coord changes. */
function ClickHandler({ onClick }: { onClick: (lng: number, lat: number) => void }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!isLoaded || !map) return;
    const handler = (e: any) => onClick(e.lngLat.lng, e.lngLat.lat);
    map.on('click', handler);
    return () => { map.off('click', handler); };
  }, [isLoaded, map, onClick]);
  return null;
}

export function MapPicker({ coords, onCoordsChange, searchAddress }: MapPickerProps) {
  const initial = parseCoords(coords) ?? { lat: 19.4326, lng: -99.1332 };
  const [position, setPosition] = useState(initial);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const lastAutoSearch = useRef<string>('');

  // External coords (from OCR autofill) → update marker
  useEffect(() => {
    const p = parseCoords(coords);
    if (p && (p.lat !== position.lat || p.lng !== position.lng)) {
      setPosition(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords]);

  const updateCoords = (lat: number, lng: number) => {
    setPosition({ lat, lng });
    onCoordsChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  const geocode = async (query: string) => {
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      const q = encodeURIComponent(query + ', México');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=mx`, {
        headers: { 'Accept-Language': 'es' },
      });
      const data = await res.json();
      if (!data.length) { setError('No se encontró la dirección'); return; }
      updateCoords(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch {
      setError('Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  // Auto-search when external address prop changes (e.g. from OCR)
  useEffect(() => {
    if (!searchAddress || searchAddress.length < 5) return;
    if (lastAutoSearch.current === searchAddress) return;
    lastAutoSearch.current = searchAddress;
    geocode(searchAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchAddress]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Geolocalización no soportada'); return; }
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => updateCoords(pos.coords.latitude, pos.coords.longitude),
      () => setError('No se pudo obtener la ubicación'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar dirección del cliente…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && geocode(searchQuery)}
            className="w-full bg-slate-900 border border-emerald-500/20 rounded-xl px-4 py-2.5 text-white text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder:text-slate-500"
          />
          {searching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-emerald-400 animate-spin" />}
        </div>
        <button
          type="button"
          onClick={() => geocode(searchQuery)}
          disabled={searching}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <Search className="w-4 h-4" /> Buscar
        </button>
        <button
          type="button"
          onClick={getCurrentLocation}
          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <Crosshair className="w-4 h-4" /> Ubicación actual
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Coords card — emerald accent, LIVE badge */}
      <motion.div
        className="relative overflow-hidden rounded-xl bg-slate-950/80 border border-emerald-500/20 px-4 py-3"
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="shrink-0">
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-emerald-400"
              style={{ filter: 'drop-shadow(0 0 4px rgba(52, 211, 153, 0.3))' }}
            >
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" x2="9" y1="3" y2="18" />
              <line x1="15" x2="15" y1="6" y2="21" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium tracking-tight">Ubicación GPS</p>
            <p className="text-emerald-300/80 text-xs font-mono mt-0.5 truncate">
              {coords || 'Sin coordenadas — busca, ubica o haz clic en el mapa'}
            </p>
            <motion.div
              className="h-px mt-2 bg-gradient-to-r from-emerald-500/50 via-emerald-400/30 to-transparent"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: coords ? 1 : 0.3 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 backdrop-blur-sm border border-emerald-500/20 shrink-0">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <span className="text-[10px] font-medium text-emerald-300 tracking-wide uppercase">Live</span>
          </div>
        </div>
      </motion.div>

      {/* MapLibre map — dark Carto basemap + emerald pin */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-2xl overflow-hidden border border-emerald-500/20"
        style={{ height: 360, boxShadow: '0 0 30px rgba(52, 211, 153, 0.08)' }}
      >
        <Map
          theme="dark"
          center={[position.lng, position.lat]}
          zoom={15}
          attributionControl={false}
        >
          <MapController lat={position.lat} lng={position.lng} />
          <ClickHandler onClick={(lng, lat) => updateCoords(lat, lng)} />
          <MapMarker
            longitude={position.lng}
            latitude={position.lat}
            draggable
            onDragEnd={({ lng, lat }) => updateCoords(lat, lng)}
          >
            <MarkerContent>
              <div className="relative">
                {/* Pulse halo */}
                <span className="absolute inset-0 -m-3 rounded-full bg-emerald-400/30 animate-ping" />
                <span className="relative block">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                    style={{ filter: 'drop-shadow(0 2px 10px rgba(52, 211, 153, 0.6))' }}>
                    <path
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                      fill="#34D399"
                      stroke="#064E3B"
                      strokeWidth="1"
                    />
                    <circle cx="12" cy="9" r="2.8" fill="#022C22" />
                  </svg>
                </span>
              </div>
            </MarkerContent>
          </MapMarker>
          <MapControls position="top-right" showZoom showLocate showFullscreen
            onLocate={(c) => updateCoords(c.latitude, c.longitude)}
          />
        </Map>
      </motion.div>
    </div>
  );
}
