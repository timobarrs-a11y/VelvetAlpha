export interface Avatar {
  id: string;
  name: string;
  age: number;
  location: string;
  bio: string;
  personality: string[];
  archetype: string;
  imageUrl?: string;
}

export const AVATARS: Record<string, Avatar> = {
  riley: {
    id: 'riley',
    name: 'Riley',
    age: 22,
    location: 'Detroit, MI',
    bio: 'Always down for deep convos or late night adventures 💕',
    personality: ['bubbly', 'flirty', 'bold', 'energetic', 'outgoing'],
    archetype: 'life_of_the_party',
    imageUrl: '/images/riley-positive.jpg'
  },
  raven: {
    id: 'raven',
    name: 'Raven',
    age: 23,
    location: 'Portland, OR',
    bio: "Books, music, and deep thoughts. Let's talk about what matters 🖤",
    personality: ['calm', 'collected', 'reserved', 'mysterious', 'introspective'],
    archetype: 'mysterious_deep',
    imageUrl: '/images/raven-positive.jpg'
  },
  jake: {
    id: 'jake',
    name: 'Jake',
    age: 24,
    location: 'Austin, TX',
    bio: 'Football, fitness, and good vibes. Let\'s make some memories together 💪⚡',
    personality: ['confident', 'athletic', 'energetic', 'charismatic', 'adventurous'],
    archetype: 'athletic_confident',
    imageUrl: '/images/jake-positive.jpg'
  }
};

export function getAvatar(id: string): Avatar {
  return AVATARS[id] || AVATARS.riley;
}
