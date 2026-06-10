export const FEMALE_NAMES: string[] = [
  'Aaliyah', 'Abby', 'Adira', 'Adriana', 'Aisha', 'Alexa', 'Alexis', 'Alicia',
  'Alina', 'Aliyah', 'Alyssa', 'Amanda', 'Amber', 'Amelia', 'Amira', 'Ana',
  'Anastasia', 'Andrea', 'Angel', 'Angelina', 'Aniyah', 'Anna', 'Ariana', 'Ariel',
  'Ashley', 'Ava', 'Avery', 'Ayanna', 'Bella', 'Bianca', 'Bree', 'Bria',
  'Briana', 'Brooklyn', 'Camille', 'Carmen', 'Cassandra', 'Cassidy', 'Celeste', 'Chloe',
  'Claire', 'Crystal', 'Danika', 'Deja', 'Destiny', 'Diana', 'Dominique', 'Elena',
  'Elise', 'Eliza', 'Ella', 'Ellie', 'Elora', 'Ember', 'Emily', 'Emma',
  'Eva', 'Faith', 'Fiona', 'Gabrielle', 'Genesis', 'Grace', 'Hailey', 'Hannah',
  'Harper', 'Hazel', 'Hope', 'Isabella', 'Isla', 'Ivana', 'Ivy', 'Jade',
  'Jasmine', 'Jayda', 'Jenna', 'Jessica', 'Jordan', 'Juliana', 'Kaia', 'Kaila',
  'Kara', 'Karen', 'Karina', 'Katelyn', 'Kayla', 'Kaylee', 'Keira', 'Kennedy',
  'Kiara', 'Kira', 'Kylie', 'Laila', 'Lauren', 'Layla', 'Leah', 'Lena',
  'Lexi', 'Lily', 'Lina', 'Lola',
];

export const MALE_NAMES: string[] = [
  'Aaron', 'Adam', 'Adrian', 'Aiden', 'Alex', 'Alexei', 'Andre', 'Andrew',
  'Angel', 'Anthony', 'Antonio', 'Ariel', 'Austin', 'Axel', 'Blake', 'Brandon',
  'Brayden', 'Caleb', 'Cameron', 'Carlos', 'Carter', 'Chase', 'Christian', 'Cole',
  'Colin', 'Connor', 'Damian', 'Daniel', 'Dante', 'Darius', 'David', 'Dean',
  'Devin', 'Diego', 'Dominic', 'Dylan', 'Eli', 'Elijah', 'Emmanuel', 'Ethan',
  'Evan', 'Felix', 'Finn', 'Gabriel', 'Gage', 'Gavin', 'Grant', 'Grayson',
  'Harrison', 'Hunter', 'Ian', 'Isaac', 'Isaiah', 'Ivan', 'Jace', 'Jack',
  'Jackson', 'Jaden', 'Jake', 'James', 'Jared', 'Jason', 'Jasper', 'Javon',
  'Jayden', 'Jesse', 'Jordan', 'Jose', 'Joshua', 'Julian', 'Justin', 'Kaiden',
  'Kaleb', 'Kane', 'Kevin', 'Kieran', 'Kyle', 'Levi', 'Liam', 'Lincoln',
  'Logan', 'Lucas', 'Luis', 'Luke', 'Marcus', 'Mason', 'Mateo', 'Matthew',
  'Max', 'Miles', 'Nathan', 'Nicholas', 'Noah', 'Nolan', 'Oliver', 'Owen',
  'Parker', 'Patrick', 'Preston', 'Rafael',
];

export function getRandomName(gender: 'male' | 'female'): string {
  const pool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}
