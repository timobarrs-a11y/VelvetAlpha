import { describe, it, expect, beforeEach, vi } from 'vitest';
import { weatherKind, parseHourly, roundCoords, fetchWeather, WEATHER_TTL_MS } from '../weatherService';

const hourly = (over: Record<string, unknown> = {}) => ({
  properties: { periods: [{ temperature: 58, temperatureUnit: 'F', shortForecast: 'Mostly Cloudy', isDaytime: false, ...over }] },
});
const COORDS = { lat: 42.33, lng: -83.05 };

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as unknown as Response;
}

describe('weatherKind', () => {
  it('reads the National Weather Service wording', () => {
    expect(weatherKind('Sunny')).toBe('clear');
    expect(weatherKind('Mostly Clear')).toBe('partly');
    expect(weatherKind('Partly Cloudy')).toBe('partly');
    expect(weatherKind('Mostly Cloudy')).toBe('cloudy');
    expect(weatherKind('Chance Rain Showers')).toBe('rain');
    expect(weatherKind('Light Snow')).toBe('snow');
    expect(weatherKind('Patchy Fog')).toBe('fog');
    expect(weatherKind('Breezy')).toBe('wind');
  });
  it('treats a thunderstorm as a storm, not just rain', () => {
    expect(weatherKind('Showers And Thunderstorms')).toBe('storm');
  });
  it('falls back to cloudy for wording it does not know', () => {
    expect(weatherKind('Something New')).toBe('cloudy');
  });
});

describe('parseHourly', () => {
  it('takes the current hour', () => {
    expect(parseHourly(hourly())).toEqual({ tempF: 58, summary: 'Mostly Cloudy', isDaytime: false, kind: 'cloudy' });
  });
  it('converts Celsius', () => {
    expect(parseHourly(hourly({ temperature: 10, temperatureUnit: 'C' }))?.tempF).toBe(50);
  });
  it('returns null for anything that is not a forecast', () => {
    expect(parseHourly(null)).toBeNull();
    expect(parseHourly({ properties: { periods: [] } })).toBeNull();
    expect(parseHourly(hourly({ temperature: 'warm' }))).toBeNull();
    expect(parseHourly(hourly({ shortForecast: '' }))).toBeNull();
  });
});

describe('roundCoords', () => {
  it('keeps about a kilometre of precision', () => {
    expect(roundCoords(42.331427, -83.045753)).toEqual({ lat: 42.33, lng: -83.05 });
  });
});

describe('fetchWeather', () => {
  beforeEach(() => localStorage.clear());

  it('looks up the grid once, then the hour, and caches for 30 minutes', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(response({ properties: { forecastHourly: 'https://api.weather.gov/gridpoints/DTX/1,2/forecast/hourly' } }))
      .mockResolvedValueOnce(response(hourly()));
    const first = await fetchWeather(COORDS, 1_000, f as unknown as typeof fetch);
    expect(first?.tempF).toBe(58);
    expect(f).toHaveBeenCalledTimes(2);

    const again = await fetchWeather(COORDS, 1_000 + WEATHER_TTL_MS - 1, f as unknown as typeof fetch);
    expect(again?.tempF).toBe(58);
    expect(f).toHaveBeenCalledTimes(2); // served from cache

    f.mockResolvedValueOnce(response(hourly({ temperature: 61 })));
    const later = await fetchWeather(COORDS, 1_000 + WEATHER_TTL_MS + 1, f as unknown as typeof fetch);
    expect(later?.tempF).toBe(61);
    expect(f).toHaveBeenCalledTimes(3); // grid remembered: one request, not two
  });

  it('returns null outside the US (no forecast grid)', async () => {
    const f = vi.fn().mockResolvedValue(response({}, false));
    expect(await fetchWeather({ lat: 48.85, lng: 2.35 }, 0, f as unknown as typeof fetch)).toBeNull();
  });

  it('returns null when offline', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'));
    expect(await fetchWeather(COORDS, 0, f as unknown as typeof fetch)).toBeNull();
  });
});
