export type SeasonIdx = 0 | 1 | 2 | 3;

export interface FestivalDef {
  si: SeasonIdx;
  name: string;
}

export const FESTIVALS: FestivalDef[] = [
  { si: 0, name: 'First warm day' },
  { si: 1, name: 'Summer cookout' },
  { si: 2, name: 'Leaf day' },
  { si: 3, name: 'Holiday' },
];

export const SEASON_TURN_LOG: string[] = [
  'Spring is here. The snow is melting.',
  'Summer is here. Long, hot days.',
  'Fall is here. The maple is turning.',
  'Winter is here. The furnace kicked on for real.',
];

export function festivalName(seasonIdx: number): string {
  return FESTIVALS[((seasonIdx % 4) + 4) % 4].name;
}

export function isFestivalDay(seasonDayNum: number): boolean {
  return seasonDayNum === 4;
}

export function isNewSeason(seasonDayNum: number, day: number): boolean {
  return seasonDayNum === 1 && day > 1;
}

export interface HolidayGiftCheckInput {
  giftDay: number | null;
  day: number;
}

export function holidayGiftReceived(input: HolidayGiftCheckInput): boolean {
  return input.giftDay !== null && input.day - input.giftDay <= 3;
}

export interface HolidayGiftResult {
  received: boolean;
  bondChange: number;
  mood: string;
}

export function holidayGiftOutcome(input: HolidayGiftCheckInput): HolidayGiftResult {
  const received = holidayGiftReceived(input);
  return {
    received,
    bondChange: received ? 8 : -5,
    mood: received ? 'happy' : 'sad',
  };
}

export const HOLIDAY_GIFT_LOG_RECEIVED = 'Holiday morning. Maya loved her gift and gave you one back: a scarf she knitted badly and proudly.';
export const HOLIDAY_GIFT_LOG_FORGOT = "Holiday morning. Maya got you a gift. You didn't get her one. She said it's fine.";
