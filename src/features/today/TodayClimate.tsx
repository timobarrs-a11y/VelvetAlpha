import { useEffect, useState } from 'react';
import { Sun, Moon, Cloud, CloudSun, CloudMoon, CloudRain, CloudSnow, CloudLightning, CloudFog, Wind, MapPin } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { supabase } from '../../shared/supabase/client';
import {
  fetchWeather, loadSavedCoords, requestBrowserCoords, roundCoords, saveCoords,
  type Coords, type Weather, type WeatherKind,
} from '../../services/weatherService';

const OFF_KEY = 'velvet.today.weatherOff';

const ICONS: Record<WeatherKind, typeof Sun> = {
  clear: Sun, partly: CloudSun, cloudy: Cloud, rain: CloudRain, snow: CloudSnow, storm: CloudLightning, fog: CloudFog, wind: Wind,
};

/** The hour and minute on this device's clock, in its own time zone (the profile's saved zone is only a default). */
function formatClock(at: Date): string {
  return at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function readOff(): boolean {
  try { return localStorage.getItem(OFF_KEY) === '1'; } catch { return false; }
}

/**
 * " · 7:42 PM · ☁ 58°" for the Today card's date line. The time is always there. Weather shows once the device has
 * a location: from the profile if the user already set one, otherwise after one tap on "Add weather".
 */
export function TodayClimate() {
  const userId = useAuth().user?.id;
  const now = useClock();
  const [coords, setCoords] = useState<Coords | null>(loadSavedCoords);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [asking, setAsking] = useState(false);
  const [off, setOff] = useState(readOff);

  // A place they already gave Navi counts, so they aren't asked again.
  useEffect(() => {
    if (coords || !userId) return;
    let live = true;
    Promise.resolve(supabase.from('user_profiles').select('location_lat, location_lng').eq('id', userId).maybeSingle())
      .then(({ data }) => {
        if (live && typeof data?.location_lat === 'number' && typeof data?.location_lng === 'number') {
          setCoords(roundCoords(data.location_lat, data.location_lng));
        }
      })
      .catch(() => {});
    return () => { live = false; };
  }, [coords, userId]);

  useEffect(() => {
    if (!coords) return;
    let live = true;
    fetchWeather(coords).then(w => { if (live) setWeather(w); });
    return () => { live = false; };
  }, [coords, Math.floor(now.getTime() / (30 * 60 * 1000))]); // eslint-disable-line react-hooks/exhaustive-deps

  const addWeather = async () => {
    setAsking(true);
    const found = await requestBrowserCoords();
    setAsking(false);
    if (found) { saveCoords(found); setCoords(found); return; }
    try { localStorage.setItem(OFF_KEY, '1'); } catch { /* storage blocked */ }
    setOff(true);
  };

  const canAsk = !coords && !off && typeof navigator !== 'undefined' && !!navigator.geolocation;
  const Icon = weather ? (weather.kind === 'clear' && !weather.isDaytime ? Moon : weather.kind === 'partly' && !weather.isDaytime ? CloudMoon : ICONS[weather.kind]) : null;

  return (
    <>
      {' · '}{formatClock(now)}
      {weather && Icon && (
        <span className="inline-flex items-center gap-1 align-middle" title={weather.summary}>
          {' · '}<Icon className="w-3.5 h-3.5" aria-hidden="true" />{weather.tempF}°
        </span>
      )}
      {canAsk && (
        <>
          {' · '}
          <button type="button" onClick={addWeather} disabled={asking} className="inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80 align-middle">
            <MapPin className="w-3 h-3" aria-hidden="true" />{asking ? 'Finding you…' : 'Add weather'}
          </button>
        </>
      )}
    </>
  );
}
