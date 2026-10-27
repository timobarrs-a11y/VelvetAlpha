/** No name is on both lists, and names that are as common for the other gender are left out, so a name never contradicts the companion's gender. */
export const FEMALE_NAMES: string[] = [
  'Aaliyah', 'Abby', 'Adira', 'Adriana', 'Aisha', 'Alexa', 'Alicia', 'Alina',
  'Aliyah', 'Alyssa', 'Amanda', 'Amber', 'Amelia', 'Amira', 'Ana', 'Anastasia',
  'Andrea', 'Angelina', 'Aniyah', 'Anna', 'Ariana', 'Ashley', 'Ava', 'Ayanna',
  'Bella', 'Bianca', 'Bree', 'Bria', 'Briana', 'Camille', 'Carmen', 'Cassandra',
  'Celeste', 'Chloe', 'Claire', 'Crystal', 'Danika', 'Deja', 'Destiny', 'Diana',
  'Dominique', 'Elena', 'Elise', 'Eliza', 'Ella', 'Ellie', 'Elora', 'Ember',
  'Emily', 'Emma', 'Eva', 'Faith', 'Fiona', 'Gabrielle', 'Genesis', 'Grace',
  'Hailey', 'Hannah', 'Hazel', 'Hope', 'Isabella', 'Isla', 'Ivana', 'Ivy',
  'Jade', 'Jasmine', 'Jenna', 'Jessica', 'Juliana', 'Kaia', 'Kaila', 'Kara',
  'Karen', 'Karina', 'Katelyn', 'Kayla', 'Kaylee', 'Keira', 'Kiara', 'Kira',
  'Kylie', 'Laila', 'Lauren', 'Layla', 'Leah', 'Lena', 'Lexi', 'Lily',
  'Lina', 'Lola',
];

export const MALE_NAMES: string[] = [
  'Aaron', 'Adam', 'Adrian', 'Aiden', 'Alexei', 'Andre', 'Andrew', 'Anthony',
  'Antonio', 'Axel', 'Brandon', 'Brayden', 'Caleb', 'Carlos', 'Christian', 'Cole',
  'Colin', 'Connor', 'Damian', 'Daniel', 'Dante', 'Darius', 'David', 'Dean',
  'Devin', 'Diego', 'Dominic', 'Eli', 'Elijah', 'Emmanuel', 'Ethan', 'Evan',
  'Felix', 'Finn', 'Gabriel', 'Gavin', 'Grant', 'Grayson', 'Harrison', 'Ian',
  'Isaac', 'Isaiah', 'Ivan', 'Jack', 'Jackson', 'Jake', 'James', 'Jared',
  'Jason', 'Jasper', 'Javon', 'Jose', 'Joshua', 'Julian', 'Justin', 'Kaleb',
  'Kane', 'Kevin', 'Kieran', 'Kyle', 'Levi', 'Liam', 'Lincoln', 'Lucas',
  'Luis', 'Luke', 'Marcus', 'Mateo', 'Matthew', 'Max', 'Miles', 'Nathan',
  'Nicholas', 'Noah', 'Nolan', 'Oliver', 'Owen', 'Patrick', 'Rafael',
];

export function getRandomName(gender: 'male' | 'female'): string {
  const pool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
