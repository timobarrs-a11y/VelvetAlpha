/*
# Birthdays without a known year

1. Why
   - Today on the home screen shows the birthdays of the people who matter, with their age
     ("Queen's 57th birthday") when the year is known.
   - `real_people.birthday` is a date, so it always has a year. People often know a friend's
     birthday but not the year they were born.

2. Changes
   - `real_people.birthday_year_known` (boolean, default true). When false, the year in
     `birthday` is a placeholder (2000, a leap year so 29 February can be stored) and no age
     is shown.

3. Security
   - No RLS or policy changes. The existing `real_people` policies cover the new column.
*/

ALTER TABLE real_people ADD COLUMN IF NOT EXISTS birthday_year_known boolean NOT NULL DEFAULT true;
