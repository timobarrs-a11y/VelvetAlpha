// Pictures that can hang as wallpaper: the same photos and gradients as the
// app's own wallpaper picker, so a house can wear the beach from your home
// screen. Kept here (not imported from the app's wallpaper service) so the
// game doesn't pull in the app's backend client.

export interface PictureWall {
  id: string;
  name: string;
  price: number;
  // A tone close to the picture, shown while a photo loads and used as the wall's colour.
  base: string;
  thumb: string;
  url?: string;
  stops?: Array<[number, string]>;
  tags: string[];
}

const px = (id: number, w: number) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&fit=crop`;
const photo = (key: string, name: string, pexels: number, base: string, tags: string[]): PictureWall =>
  ({ id: `photo-${key}`, name, price: 160, base, url: px(pexels, 1280), thumb: px(pexels, 200), tags });

const gradient = (key: string, name: string, stops: Array<[number, string]>, base: string, tags: string[]): PictureWall =>
  ({ id: `grad-${key}`, name, price: 110, base, stops, thumb: '', tags });

export const PICTURE_WALLS: PictureWall[] = [
  photo('beach', 'Tropical beach', 1032650, '#7FC4C9', ['natural', 'cool', 'playful']),
  photo('mountains', 'Mountains', 1287145, '#7E93A8', ['natural', 'cool', 'minimal']),
  photo('city-night', 'City at night', 315191, '#1D2236', ['modern', 'bold', 'cool']),
  photo('forest', 'Forest', 167698, '#41603F', ['natural', 'cozy', 'cool']),
  photo('starry-sky', 'Starry sky', 1252869, '#1A2140', ['bold', 'cool', 'playful']),
  photo('cherry-blossoms', 'Cherry blossoms', 931177, '#E9B8C8', ['soft', 'natural', 'playful']),
  photo('desert-dunes', 'Desert dunes', 618833, '#D9A66F', ['warm', 'natural', 'minimal']),
  photo('rainy-cafe', 'Rainy cafe', 1813466, '#6B5A4E', ['cozy', 'warm', 'vintage']),
  photo('northern-lights', 'Northern lights', 1933239, '#1E4A52', ['bold', 'cool', 'natural']),
  photo('ocean-sunset', 'Ocean sunset', 1033729, '#D9825B', ['warm', 'natural', 'soft']),
  gradient('aurora', 'Aurora night', [[0, '#0f0c29'], [0.4, '#302b63'], [0.7, '#24243e'], [1, '#0f4c35']], '#26224A', ['bold', 'cool', 'modern']),
  gradient('sunset', 'Sunset dusk', [[0, '#f97316'], [0.35, '#ec4899'], [0.65, '#8b5cf6'], [1, '#1e1b4b']], '#A24C8E', ['warm', 'bold', 'playful']),
  gradient('ocean', 'Deep ocean', [[0, '#0ea5e9'], [0.3, '#0369a1'], [0.6, '#075985'], [1, '#0c1445']], '#065E8C', ['cool', 'bold', 'natural']),
  gradient('blossom', 'Blossom haze', [[0, '#fdf2f8'], [0.25, '#fce7f3'], [0.5, '#fbcfe8'], [0.75, '#f9a8d4'], [1, '#f472b6']], '#F8C6DE', ['soft', 'warm', 'playful']),
  gradient('midnight', 'Midnight', [[0, '#0d1117'], [0.4, '#161b22'], [0.7, '#1c2128'], [1, '#21262d']], '#171C23', ['modern', 'minimal', 'bold']),
];
