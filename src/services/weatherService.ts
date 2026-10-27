// Current weather for the Today card, from the US National Weather Service (api.weather.gov): free, no key,
// no attribution needed, fine for a commercial app. It only covers the United States; anywhere else the
// lookup returns null and the card simply shows no weather.
//
// Location never leaves the device except as coordinates sent to weather.gov: it is kept in localStorage
// (rounded to about a kilometre), not saved to the account.

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'wind';

export interface Weather {
  tempF: number;
  summary: string;
  isDaytime: boolean;
  kind: WeatherKind;
}

export interface Coords { lat: number; lng: number }

const COORDS_KEY = 'velvet.today.coords';
const WEATHER_KEY = 'velvet.today.weather';
const GRID_KEY = 'velvet.today.weatherGrid';
export const WEATHER_TTL_MS = 30 * 60 * 1000;

/** "Chance Rain Showers" -> 'rain'. The order matters: a thunderstorm is also rain. */
export function weatherKind(summary: string): WeatherKind {
  const s = summary.toLowerCase();
  if (/thunder|t-storm/.test(s)) return 'storm';
  if (/snow|sleet|flurr|blizzard|freezing|ice pellets/.test(s)) return 'snow';
  if (/rain|shower|drizzle/.test(s)) return 'rain';
  if (/fog|haze|smoke|mist/.test(s)) return 'fog';
  if (/wind|breezy|gust/.test(s)) return 'wind';
  if (/partly|mostly sunny|mostly clear|few clouds/.test(s)) return 'partly';
  if (/cloud|overcast/.test(s)) return 'cloudy';
  if (/sunny|clear|fair/.test(s)) return 'clear';
  return 'cloudy';
}

/** The first hour of an api.weather.gov hourly forecast, or null if it isn't one. */
export function parseHourly(json: unknown): Weather | null {
  const periods = (json as { properties?: { periods?: Array<Record<string, unknown>> } } | null)?.properties?.periods;
  const p = periods?.[0];
  if (!p) return null;
  const temp = Number(p.temperature);
  const summary = String(p.shortForecast ?? '');
  if (!Number.isFinite(temp) || !summary) return null;
  const tempF = p.temperatureUnit === 'C' ? Math.round(temp * 9 / 5 + 32) : Math.round(temp);
  return { tempF, summary, isDaytime: p.isDaytime !== false, kind: weatherKind(summary) };
}

/** Two decimals is about a kilometre: enough for weather, not enough to find a house. */
export function roundCoords(lat: number, lng: number): Coords {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}

export function loadSavedCoords(): Coords | null {
  const c = read<Coords>(COORDS_KEY);
  return c && Number.isFinite(c.lat) && Number.isFinite(c.lng) ? c : null;
}
export function saveCoords(c: Coords) { write(COORDS_KEY, c); }
export function forgetCoords() {
  try { localStorage.removeItem(COORDS_KEY); localStorage.removeItem(WEATHER_KEY); } catch { /* ignore */ }
}

/** Asks the browser for the position once (the browser shows its own permission prompt). */
export function requestBrowserCoords(): Promise<Coords | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      pos => resolve(roundCoords(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(null),
      { timeout: 10_000, maximumAge: 60 * 60 * 1000 },
    );
  });
}

const sameSpot = (a: Coords, b: Coords) => a.lat === b.lat && a.lng === b.lng;

/** Current weather for a place, cached for 30 minutes. Null when it can't be had (outside the US, offline). */
export async function fetchWeather(coords: Coords, now = Date.now(), fetchImpl: typeof fetch = fetch): Promise<Weather | null> {
  const cached = read<{ at: number; coords: Coords; weather: Weather }>(WEATHER_KEY);
  if (cached && sameSpot(cached.coords, coords) && now - cached.at < WEATHER_TTL_MS) return cached.weather;

  try {
    const headers = { Accept: 'application/geo+json' };
    // The grid for a spot doesn't change, so look it up once.
    const grid = read<{ coords: Coords; url: string }>(GRID_KEY);
    let url = grid && sameSpot(grid.coords, coords) ? grid.url : null;
    if (!url) {
      const points = await fetchImpl(`https://api.weather.gov/points/${coords.lat},${coords.lng}`, { headers });
      if (!points.ok) return null;
      url = (await points.json())?.properties?.forecastHourly ?? null;
      if (!url) return null;
      write(GRID_KEY, { coords, url });
    }
    const hourly = await fetchImpl(url as string, { headers });
    if (!hourly.ok) return null;
    const weather = parseHourly(await hourly.json());
    if (weather) write(WEATHER_KEY, { at: now, coords, weather });
    return weather;
  } catch {
    return null;
  }
}
