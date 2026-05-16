import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Crosshair, Loader2 } from 'lucide-react';

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
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar dirección del cliente…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && geocode(searchQuery)}
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm pr-10 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500"
          />
          {searching && <Loader2 className="absolute right-3 top-2.5 w-4 h-4 text-blue-400 animate-spin" />}
        </div>
        <button
          type="button"
          onClick={() => geocode(searchQuery)}
          disabled={searching}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl flex items-center gap-1.5 text-sm font-medium transition-colors"
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

      {/* Coords display */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-white/10 rounded-lg">
        <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="font-mono text-xs text-slate-300">{coords || 'Sin coordenadas'}</span>
        <span className="text-slate-500 text-xs ml-auto">Haz clic en el mapa o arrastra el pin</span>
      </div>

      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

      {/* Map container */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-white/10"
        style={{ height: 320 }}
      />
    </div>
  );
}
