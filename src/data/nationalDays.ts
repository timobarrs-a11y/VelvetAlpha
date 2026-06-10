export interface NationalDay {
  name: string;
  emoji: string;
  variable?: boolean;
  note?: string;
}

// Key format: "MM-DD"
// variable: true means the date shifts year to year — treat as approximate
export const NATIONAL_DAYS: Record<string, NationalDay[]> = {
  '01-04': [{ name: 'National Trivia Day', emoji: '🧠' }],
  '01-17': [{ name: 'Martin Luther King Jr. Day', emoji: '✊', note: 'Third Monday of January', variable: true }],
  '01-23': [{ name: 'National Pie Day', emoji: '🥧' }],
  '02-02': [{ name: "Groundhog Day", emoji: '🐿️' }],
  '02-04': [{ name: 'World Nutella Day', emoji: '🍫' }],
  '02-09': [{ name: 'National Pizza Day', emoji: '🍕' }],
  '02-14': [{ name: "Valentine's Day", emoji: '❤️' }],
  '02-17': [{ name: 'Random Acts of Kindness Day', emoji: '🤝' }],
  '03-08': [{ name: "International Women's Day", emoji: '👩' }],
  '03-10': [{ name: 'Mar10 Day (Mario Day)', emoji: '🍄', note: 'March 10 = MAR10' }],
  '03-14': [{ name: 'National Pi Day', emoji: '🥧', note: '3.14159...' }],
  '03-17': [{ name: "St. Patrick's Day", emoji: '🍀' }],
  '03-20': [{ name: 'First Day of Spring', emoji: '🌸' }],
  '03-23': [{ name: 'National Puppy Day', emoji: '🐶' }],
  '03-26': [{ name: 'Make Up Your Own Holiday Day', emoji: '🎉' }],
  '03-31': [{ name: 'Trans Day of Visibility', emoji: '🏳️‍⚧️' }],
  '04-01': [{ name: "April Fools' Day", emoji: '🤡' }],
  '04-02': [{ name: 'Autism Awareness Day / World Autism Day', emoji: '♾️' }],
  '04-04': [{ name: 'National Peanut Butter and Jelly Day', emoji: '🥜' }],
  '04-09': [{ name: "Ben & Jerry's Free Cone Day", emoji: '🍦', note: 'Date varies — check scoop shops', variable: true }],
  '04-12': [{ name: 'National Grilled Cheese Day', emoji: '🧀' }],
  '04-15': [{ name: 'National Glazed Spiral Ham Day', emoji: '🍖' }],
  '04-22': [{ name: 'Earth Day', emoji: '🌍' }],
  '05-01': [{ name: 'May Day', emoji: '🌼' }],
  '05-04': [{ name: 'Star Wars Day', emoji: '⚔️', note: 'May the 4th be with you' }],
  '05-05': [{ name: 'Cinco de Mayo', emoji: '🎉' }],
  '05-25': [{ name: 'National Wine Day', emoji: '🍷' }],
  '06-01': [{ name: 'Pride Month begins', emoji: '🏳️‍🌈', note: 'June is Pride Month' }],
  '06-07': [{ name: 'National Donut Day', emoji: '🍩', note: 'First Friday of June — date varies', variable: true }],
  '06-19': [{ name: 'Juneteenth', emoji: '✊' }],
  '06-21': [{ name: 'National Selfie Day / First Day of Summer', emoji: '☀️' }],
  '07-04': [{ name: 'Independence Day', emoji: '🎆' }],
  '07-11': [{ name: 'National Slurpee Day (7-Eleven Day)', emoji: '🧋', note: '7-Eleven gives free Slurpees' }],
  '07-17': [{ name: 'World Emoji Day', emoji: '😄' }],
  '07-18': [{ name: 'Nelson Mandela International Day', emoji: '✊' }],
  '07-28': [{ name: 'National Milk Chocolate Day', emoji: '🍫' }],
  '08-10': [{ name: 'National Lazy Day', emoji: '😴' }],
  '08-26': [{ name: "National Dog Day", emoji: '🐕' }],
  '09-01': [{ name: 'Labor Day', emoji: '🔨', note: 'First Monday of September', variable: true }],
  '09-19': [{ name: 'Talk Like a Pirate Day', emoji: '🏴‍☠️' }],
  '09-22': [{ name: 'First Day of Fall', emoji: '🍂' }],
  '10-01': [{ name: 'Hispanic Heritage Month continues / Breast Cancer Awareness Month begins', emoji: '🎗️' }],
  '10-03': [{ name: 'Mean Girls Day', emoji: '💅', note: '"On Wednesdays we wear pink"' }],
  '10-04': [{ name: 'National Taco Day', emoji: '🌮' }],
  '10-10': [{ name: 'World Mental Health Day', emoji: '💙' }],
  '10-11': [{ name: 'National Coming Out Day', emoji: '🏳️‍🌈' }],
  '10-15': [{ name: 'National Disability Awareness Day / White Cane Safety Day', emoji: '♿' }],
  '10-31': [{ name: 'Halloween', emoji: '🎃' }],
  '11-01': [{ name: 'Day of the Dead', emoji: '💀' }],
  '11-11': [{ name: "Veterans Day", emoji: '🎖️' }],
  '11-17': [{ name: 'National Baklava Day', emoji: '🍯' }],
  '11-27': [{ name: 'Thanksgiving', emoji: '🦃', note: 'Fourth Thursday of November', variable: true }],
  '12-01': [{ name: 'World AIDS Day', emoji: '❤️‍🔥' }],
  '12-04': [{ name: 'National Cookie Day', emoji: '🍪' }],
  '12-10': [{ name: 'Human Rights Day', emoji: '✊' }],
  '12-21': [{ name: 'Winter Solstice / National Crossword Puzzle Day', emoji: '❄️' }],
  '12-25': [{ name: 'Christmas Day', emoji: '🎄' }],
  '12-26': [{ name: 'Kwanzaa begins', emoji: '🕯️' }],
  '12-31': [{ name: "New Year's Eve", emoji: '🥂' }],
};

// Month-level awareness events (surfaced on the 1st of each month)
export const AWARENESS_MONTHS: Record<string, { name: string; emoji: string }[]> = {
  '02': [{ name: 'Black History Month', emoji: '✊' }],
  '03': [{ name: 'Women\'s History Month', emoji: '👩' }],
  '04': [{ name: 'Autism Awareness Month', emoji: '♾️' }],
  '06': [{ name: 'Pride Month', emoji: '🏳️‍🌈' }, { name: 'LGBTQ+ Pride Month', emoji: '🏳️‍🌈' }],
  '07': [{ name: 'Disability Pride Month', emoji: '♿' }],
  '09': [{ name: 'Hispanic Heritage Month begins', emoji: '🎉' }],
  '10': [{ name: 'LGBTQ+ History Month', emoji: '🏳️‍🌈' }, { name: 'Breast Cancer Awareness Month', emoji: '🎗️' }, { name: 'Autism ADHD Awareness Month', emoji: '🧠' }],
  '11': [{ name: 'Native American Heritage Month', emoji: '🪶' }],
};

/** Returns national/fun days for a given Date, or []. */
export function getNationalDaysForDate(date: Date): NationalDay[] {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const days = [...(NATIONAL_DAYS[`${mm}-${dd}`] ?? [])];

  // Include awareness month on the 1st of each month
  if (dd === '01') {
    const monthAwareness = AWARENESS_MONTHS[mm] ?? [];
    monthAwareness.forEach(a => days.push(a));
  }

  return days;
}

/** Returns a brief-ready string or '' if no national days today. */
export function formatNationalDaysForBrief(date: Date): string {
  const days = getNationalDaysForDate(date);
  if (days.length === 0) return '';
  return days
    .map(d => `${d.name} ${d.emoji}${d.note ? ` (${d.note})` : ''}`)
    .join('; ');
}
