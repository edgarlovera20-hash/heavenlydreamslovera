import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Crosshair, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

interface MapPickerProps {
  coords: string;
  onCoordsChange: (coords: string) => void;
  searchAddress?: string; // auto-search this address when provided
}

export function MapPicker({ coords, onCoordsChange, searchAddress }: MapPickerProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);

  const parseCoords = (s: string): [number, number] | null => {
    const m = s.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
    if (m) return [parseFloat(m[1]), parseFloat(m[2])];
    return null;
  };

  // Init map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import('leaflet').then((L) => {
      // Fix default icon paths for Vite
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initial = parseCoords(coords) ?? [19.4326, -99.1332];
      const map = L.map(containerRef.current!, { zoomControl: true, scrollWheelZoom: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      map.setView(initial, 16);

      const marker = L.marker(initial, { draggable: true }).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLatLng();
        onCoordsChange(`${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`);
      });
      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        onCoordsChange(`${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
      });

      mapRef.current = map;
      markerRef.current = marker;
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync external coords → map
  useEffect(() => {
    if (!mapReady || !markerRef.current) return;
    const p = parseCoords(coords);
    if (p) {
      markerRef.current.setLatLng(p);
      mapRef.current.setView(p, mapRef.current.getZoom());
    }
  }, [coords, mapReady]);

  // Auto-search when address prop changes
  useEffect(() => {
    if (!mapReady || !searchAddress || searchAddress.length < 5) return;
    geocode(searchAddress);
  }, [searchAddress, mapReady]);

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
      const { lat, lon } = data[0];
      const p: [number, number] = [parseFloat(lat), parseFloat(lon)];
      markerRef.current?.setLatLng(p);
      mapRef.current?.setView(p, 17);
      onCoordsChange(`${p[0].toFixed(6)}, ${p[1].toFixed(6)}`);
    } catch {
      setError('Error al buscar');
    } finally {
      setSearching(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Geolocalización no soportada'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        markerRef.current?.setLatLng(p);
        mapRef.current?.setView(p, 17);
        onCoordsChange(`${p[0].toFixed(6)}, ${p[1].toFixed(6)}`);
        setLocating(false);
      },
      () => { setError('No se pudo obtener la ubicación'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      {/* Search bar — emerald theme */}
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
          disabled={locating}
          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors"
        >
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crosshair className="w-4 h-4" />}
          {locating ? 'Localizando…' : 'Ubicación actual'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Coords card — animated, emerald accent, live badge */}
      <motion.div
        className="relative overflow-hidden rounded-xl bg-slate-950/80 border border-emerald-500/20 px-4 py-3"
        whileHover={{ scale: 1.005 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Map icon w/ glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{
              filter: 'drop-shadow(0 0 8px rgba(52, 211, 153, 0.6))',
            }}
            className="shrink-0"
          >
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
          </motion.div>

          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium tracking-tight">Ubicación GPS</p>
            <p className="text-emerald-300/80 text-xs font-mono mt-0.5 truncate">
              {coords || 'Sin coordenadas — haz clic en el mapa o usa los botones de arriba'}
            </p>
            {/* Animated underline */}
            <motion.div
              className="h-px mt-2 bg-gradient-to-r from-emerald-500/50 via-emerald-400/30 to-transparent"
              initial={{ scaleX: 0, originX: 0 }}
              animate={{ scaleX: coords ? 1 : 0.3 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>

          {/* Live badge */}
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

      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Map container — emerald border + glow */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-2xl overflow-hidden border border-emerald-500/20"
        style={{ boxShadow: '0 0 30px rgba(52, 211, 153, 0.08)' }}
      >
        {/* Subtle gradient overlay (pointer-events-none so it doesn't block map clicks) */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] via-transparent to-emerald-500/[0.05] pointer-events-none z-[400]" />
        <div
          ref={containerRef}
          className="w-full"
          style={{ height: 360 }}
        />
      </motion.div>
    </div>
  );
}
