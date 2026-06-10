export interface VoiceNewsConfig {
  categories: string[];
  keywords: string[];
  sources: string[];
  personality_filter: string;
}

export const VOICE_NEWS_CATEGORIES: Record<string, VoiceNewsConfig> = {
  jock: {
    categories: ['sports'],
    keywords: ['NFL', 'NBA', 'MLB', 'UFC', 'ESPN', 'game', 'playoffs', 'Super Bowl', 'championship', 'trade', 'draft'],
    sources: ['espn', 'bleacher-report', 'the-sport-bible'],
    personality_filter: 'This character cares deeply about sports, fitness, competition. They have strong opinions about games, players, and athletic achievement.'
  },
  homie: {
    categories: ['entertainment', 'general'],
    keywords: ['viral', 'trending', 'hip-hop', 'rap', 'culture', 'meme', 'celebrity', 'music'],
    sources: ['complex', 'tmz', 'buzzfeed'],
    personality_filter: 'This character is plugged into pop culture, street culture, music, and social media trends. They know what is going on and have takes.'
  },
  nerd: {
    categories: ['technology', 'science'],
    keywords: ['AI', 'space', 'NASA', 'gaming', 'tech', 'startup', 'research', 'discovery'],
    sources: ['techcrunch', 'the-verge', 'wired', 'ars-technica'],
    personality_filter: 'This character is passionate about technology, science, gaming, and intellectual pursuits. They get excited about discoveries and innovations.'
  },
  artist: {
    categories: ['entertainment', 'general'],
    keywords: ['art', 'music', 'film', 'album', 'gallery', 'creative', 'design', 'fashion'],
    sources: ['rolling-stone', 'pitchfork', 'the-guardian'],
    personality_filter: 'This character lives for creative expression — art, music, film, fashion, design. They have aesthetic opinions and emotional responses to creative work.'
  },
  shakespearean: {
    categories: ['general', 'science', 'entertainment'],
    keywords: ['philosophy', 'literature', 'history', 'poetry', 'theater', 'debate', 'politics'],
    sources: ['the-new-york-times', 'bbc-news', 'the-guardian'],
    personality_filter: 'This character sees the world through a dramatic, literary, philosophical lens. They find the poetic and profound in current events.'
  },
  lawyer: {
    categories: ['general', 'business'],
    keywords: ['law', 'court', 'ruling', 'policy', 'regulation', 'case', 'legal', 'justice', 'Supreme Court'],
    sources: ['reuters', 'associated-press', 'the-new-york-times'],
    personality_filter: 'This character analyzes everything through a logical, argumentative, evidence-based lens. They love debate and have strong opinions backed by reasoning.'
  },
  sweetheart: {
    categories: ['entertainment', 'health', 'general'],
    keywords: ['wellness', 'self-care', 'relationship', 'heartwarming', 'community', 'kindness', 'feel-good'],
    sources: ['buzzfeed', 'today', 'good-morning-america'],
    personality_filter: 'This character is warm, caring, emotionally attuned. They notice the human side of every story and care about peoples wellbeing.'
  },
  adventurer: {
    categories: ['general', 'science'],
    keywords: ['travel', 'adventure', 'explore', 'nature', 'outdoor', 'expedition', 'destination', 'extreme'],
    sources: ['national-geographic', 'bbc-news', 'the-guardian'],
    personality_filter: 'This character craves new experiences, exploration, and pushing boundaries. They are restless, curious, and always planning the next adventure.'
  }
};
