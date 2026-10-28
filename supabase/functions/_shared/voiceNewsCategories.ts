// What each signature voice cares about in the news (daily experience, the feed's character lens). One file for the
// app and the edge functions (the app re-exports it from src/config/voiceNewsCategories.ts); a test keeps it covering
// every voice, so a new voice can't be left without one. "classic" is the fallback for any voice that is not listed.

export interface VoiceNewsConfig {
  categories: string[];
  keywords: string[];
  sources: string[];
  personality_filter: string;
}

export const VOICE_NEWS_CATEGORIES: Record<string, VoiceNewsConfig> = {
  classic_male: {
    categories: ['general'],
    keywords: ['news', 'world', 'local', 'community'],
    sources: ['bbc-news', 'the-guardian'],
    personality_filter: 'This character has balanced, thoughtful perspectives on current events and everyday life.'
  },
  classic_female: {
    categories: ['general'],
    keywords: ['news', 'world', 'local', 'community'],
    sources: ['bbc-news', 'the-guardian'],
    personality_filter: 'This character has balanced, thoughtful perspectives on current events and everyday life.'
  },
  jock: {
    categories: ['sports'],
    keywords: ['NFL', 'NBA', 'MLB', 'UFC', 'ESPN', 'game', 'playoffs', 'Super Bowl', 'championship', 'trade', 'draft'],
    sources: ['espn', 'bleacher-report', 'the-sport-bible'],
    personality_filter: 'This character cares deeply about sports, fitness, competition. They have strong opinions about games, players, and athletic achievement.'
  },
  cheerleader: {
    categories: ['sports', 'entertainment'],
    keywords: ['college', 'game day', 'rally', 'team', 'dance', 'celebrity', 'viral'],
    sources: ['espn', 'buzzfeed'],
    personality_filter: 'This character is peppy, loyal and loves a big moment. They get hyped about teams, games, viral moments and good news.'
  },
  therapist: {
    categories: ['health', 'general'],
    keywords: ['mental health', 'wellness', 'burnout', 'sleep', 'stress', 'psychology', 'self-care'],
    sources: ['the-guardian', 'bbc-news'],
    personality_filter: 'This character looks at the human side of every story: how people cope, connect and heal. They are calm, reflective and curious about why people do what they do.'
  },
  big_sister: {
    categories: ['entertainment', 'health', 'general'],
    keywords: ['relationships', 'advice', 'fashion', 'dating', 'self-care', 'family'],
    sources: ['buzzfeed', 'today'],
    personality_filter: 'This character is the protective, plain-spoken older sister. They have takes on dating, family, style and looking after yourself.'
  },
  brooklyn_native: {
    categories: ['general', 'sports', 'entertainment'],
    keywords: ['New York', 'Yankees', 'Knicks', 'subway', 'pizza', 'Brooklyn', 'food', 'neighborhood'],
    sources: ['the-new-york-times', 'espn'],
    personality_filter: 'This character is a proud New Yorker with loud opinions about the city, its teams, its food and anyone who has never been.'
  },
  french_romantic: {
    categories: ['entertainment', 'general'],
    keywords: ['film', 'fashion', 'Paris', 'wine', 'art', 'travel', 'cuisine', 'romance'],
    sources: ['the-guardian', 'bbc-news'],
    personality_filter: 'This character is a romantic who notices beauty, food, film, fashion and travel, and finds something to savor in the day.'
  },
  rnb_lover: {
    categories: ['entertainment'],
    keywords: ['R&B', 'soul', 'album', 'concert', 'Grammy', 'music', 'tour', 'slow jam'],
    sources: ['rolling-stone', 'mtv-news'],
    personality_filter: 'This character lives for smooth music and mood. They have feelings about albums, artists and what is playing tonight.'
  },
  cold_prince: {
    categories: ['business', 'general'],
    keywords: ['power', 'strategy', 'markets', 'politics', 'luxury', 'leadership'],
    sources: ['bloomberg', 'the-wall-street-journal'],
    personality_filter: 'This character is composed, guarded and strategic. They follow power, money and the moves behind the headlines, and say little about them.'
  },
  determined_hero: {
    categories: ['sports', 'general'],
    keywords: ['underdog', 'comeback', 'record', 'training', 'marathon', 'Olympics', 'championship'],
    sources: ['espn', 'bbc-news'],
    personality_filter: 'This character believes in effort and never giving up. They are moved by comebacks, records and anyone who trained their way to a win.'
  },
  playful_trickster: {
    categories: ['entertainment', 'technology'],
    keywords: ['viral', 'meme', 'prank', 'trending', 'game', 'streaming', 'internet'],
    sources: ['buzzfeed', 'the-verge'],
    personality_filter: 'This character loves mischief, memes and whatever the internet is laughing at today.'
  },
  gentle_protector: {
    categories: ['health', 'general'],
    keywords: ['community', 'rescue', 'safety', 'kindness', 'volunteer', 'weather', 'family'],
    sources: ['bbc-news', 'today'],
    personality_filter: 'This character watches over the people they care about. They notice who needs help in a story and what is being done about it.'
  },
  tsundere: {
    categories: ['entertainment', 'technology'],
    keywords: ['anime', 'manga', 'video game', 'cosplay', 'Studio Ghibli', 'streaming', 'convention'],
    sources: ['ign', 'polygon'],
    personality_filter: 'This character is prickly about caring and secretly in the know about anime, games and fandom, with opinions they pretend they do not have.'
  },
  shy_sweetheart: {
    categories: ['entertainment', 'health'],
    keywords: ['books', 'cozy', 'kindness', 'pets', 'tea', 'heartwarming', 'small joys'],
    sources: ['buzzfeed', 'today'],
    personality_filter: 'This character is gentle and quiet, drawn to cozy, heartwarming stories, books, pets and small kindnesses.'
  },
  genki_girl: {
    categories: ['entertainment', 'sports'],
    keywords: ['anime', 'festival', 'concert', 'game', 'dance', 'fun', 'travel', 'summer'],
    sources: ['buzzfeed', 'espn'],
    personality_filter: 'This character is bursting with energy and treats every news item as a reason to get excited, go somewhere or try something.'
  },
  cool_beauty: {
    categories: ['entertainment', 'business'],
    keywords: ['fashion', 'film', 'design', 'luxury', 'art', 'awards', 'style'],
    sources: ['the-guardian', 'bloomberg'],
    personality_filter: 'This character is poised and effortlessly stylish. They have an eye for fashion, film, design and what is quietly in good taste.'
  },
  homie: {
    categories: ['entertainment', 'general'],
    keywords: ['viral', 'trending', 'hip-hop', 'rap', 'culture', 'meme', 'celebrity', 'music'],
    sources: ['complex', 'tmz', 'buzzfeed'],
    personality_filter: 'This character is plugged into pop culture, street culture, music, and social media trends. They know what is going on and have takes.'
  },
  bad_boy: {
    categories: ['sports', 'entertainment'],
    keywords: ['motorcycle', 'racing', 'UFC', 'boxing', 'rock', 'tour', 'rebel', 'Formula 1'],
    sources: ['espn', 'rolling-stone'],
    personality_filter: 'This character is a rule-bender who likes speed, fights, loud music and anything with an edge.'
  },
  southern_gentleman: {
    categories: ['general', 'sports'],
    keywords: ['college football', 'SEC', 'country music', 'weather', 'farm', 'barbecue', 'hunting'],
    sources: ['espn', 'the-new-york-times'],
    personality_filter: 'This character is courteous, easy-going and rooted in the South: football, country music, weather, food and good manners.'
  },
  nerd: {
    categories: ['technology', 'science'],
    keywords: ['AI', 'space', 'NASA', 'gaming', 'tech', 'startup', 'research', 'discovery'],
    sources: ['techcrunch', 'the-verge', 'wired', 'ars-technica'],
    personality_filter: 'This character is passionate about technology, science, gaming, and intellectual pursuits. They get excited about discoveries and innovations.'
  },
  british_gentleman: {
    categories: ['general', 'business'],
    keywords: ['royal', 'Premier League', 'cricket', 'Parliament', 'London', 'tea', 'markets'],
    sources: ['bbc-news', 'the-guardian'],
    personality_filter: 'This character is dry, polite and unflappable. They follow British news, football and cricket and understate everything.'
  },
  surfer_dude: {
    categories: ['sports', 'science'],
    keywords: ['surf', 'ocean', 'waves', 'weather', 'climate', 'beach', 'travel', 'skateboard'],
    sources: ['espn', 'national-geographic'],
    personality_filter: 'This character is relaxed and sun-soaked, tuned to the ocean, the weather, surf and skate culture, and takes it all in stride.'
  },
  goth_girl: {
    categories: ['entertainment', 'science'],
    keywords: ['horror', 'film', 'album', 'art', 'night sky', 'mystery', 'tour', 'gothic'],
    sources: ['rolling-stone', 'the-guardian'],
    personality_filter: 'This character loves the dark and the strange: horror films, moody music, art, mysteries and the night sky.'
  },
  shakespearean: {
    categories: ['general', 'science', 'entertainment'],
    keywords: ['philosophy', 'literature', 'history', 'poetry', 'theater', 'debate', 'politics'],
    sources: ['the-new-york-times', 'bbc-news', 'the-guardian'],
    personality_filter: 'This character sees the world through a dramatic, literary, philosophical lens. They find the poetic and profound in current events.'
  },
  southern_belle: {
    categories: ['entertainment', 'general'],
    keywords: ['fashion', 'wedding', 'recipe', 'hospitality', 'garden', 'country music', 'charity'],
    sources: ['today', 'good-morning-america'],
    personality_filter: 'This character is gracious and warm, with views on fashion, food, weddings, gardens and what is polite.'
  },
  valley_girl: {
    categories: ['entertainment'],
    keywords: ['celebrity', 'fashion', 'shopping', 'trending', 'influencer', 'beauty', 'TikTok'],
    sources: ['buzzfeed', 'tmz'],
    personality_filter: 'This character is bubbly and always in the loop on celebrities, fashion, beauty and whatever is trending.'
  },
  bookworm: {
    categories: ['entertainment', 'general'],
    keywords: ['books', 'author', 'novel', 'library', 'prize', 'publishing', 'poetry'],
    sources: ['the-guardian', 'the-new-york-times'],
    personality_filter: 'This character is happiest with a book. They follow authors, prizes, publishing and anything that sends them back to the shelf.'
  },
};

/** The news lens for a voice: its own, else the plain classic one. */
export function voiceNewsFor(voiceId: string | null | undefined): VoiceNewsConfig {
  return (voiceId && VOICE_NEWS_CATEGORIES[voiceId]) || VOICE_NEWS_CATEGORIES.classic_male;
}
