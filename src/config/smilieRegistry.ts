export interface SmilieEntry {
  code: string;
  file: string;
  label: string;
}

const SMILIE_BASE = '/smilies/';

const RAW: { code: string; file: string; label: string }[] = [
  { code: 'rofl', file: '0rofl.gif', label: 'ROFL' },
  { code: 'agreement', file: 'agreement1.gif', label: 'Agreed' },
  { code: 'dealwithit', file: 'aidealwithit.png', label: 'Deal with it' },
  { code: 'amareohdamn', file: 'amareohdamn.png', label: 'Oh damn' },
  { code: 'angry', file: 'angrysmiley030.gif', label: 'Angry' },
  { code: 'awalkerhuh', file: 'awalkerhuh.png', label: 'Huh' },
  { code: 'banxu', file: 'banxu.gif', label: 'Ban' },
  { code: 'barnesnoo', file: 'barnesnoo.png', label: 'Snoo' },
  { code: 'bawse', file: 'bawse.png', label: 'Bawse' },
  { code: 'bieberdatazz', file: 'bieberdatazzfresh.png', label: 'Dat azz' },
  { code: 'biggumswtf', file: 'biggumswtf.png', label: 'WTF' },
  { code: 'billsmug', file: 'billsmugazz.png', label: 'Smug' },
  { code: 'bronthatsnasty', file: 'bronthatsnasty.png', label: 'Thats nasty' },
  { code: 'carmeloweird', file: 'carmeloweird.png', label: 'Weird' },
  { code: 'cbaww', file: 'cbaww.gif', label: 'Aww' },
  { code: 'chrishah', file: 'chrishahfresh.png', label: 'Hah' },
  { code: 'chrispaulnoooo', file: 'chrispaulnoooo.png', label: 'Nooo' },
  { code: 'chrispaulnoway', file: 'chrispaulnoway.png', label: 'No way' },
  { code: 'chuckawyeah', file: 'chuckawyeah.png', label: 'Aw yeah' },
  { code: 'comeatmebro', file: 'comeatmebrov.png', label: 'Come at me' },
  { code: 'confused', file: 'confusedr.gif', label: 'Confused' },
  { code: 'cool', file: 'coolsmiley009.gif', label: 'Cool' },
  { code: 'cosbycmonson', file: 'cosbycmonson.png', label: "C'mon son" },
  { code: 'cubeohhellno', file: 'cubeohhellno.png', label: 'Oh hell no' },
  { code: 'davidsternehh', file: 'davidsternehhhh.png', label: 'Ehhh' },
  { code: 'dead', file: 'dead2.gif', label: 'Dead' },
  { code: 'deadh', file: 'deadh.gif', label: 'Dead H' },
  { code: 'diddydatazz', file: 'diddydatazz.png', label: 'Dat azz' },
  { code: 'digit', file: 'digit.gif', label: 'Digit' },
  { code: 'dogr', file: 'dogr.png', label: 'Dog' },
  { code: 'donnellhigh', file: 'donnellhigh.png', label: 'High' },
  { code: 'dwadecrying', file: 'dwadecrying.png', label: 'Crying' },
  { code: 'dwadedatazz', file: 'dwadedatazz1.png', label: 'Dat azz' },
  { code: 'dwighthowardshocked', file: 'dwighthowardshocked.png', label: 'Shocked' },
  { code: 'dwill', file: 'dwill.png', label: 'Dwill' },
  { code: 'eppsfriday', file: 'eppsfriday.png', label: 'Friday' },
  { code: 'ernaehrung', file: 'ernaehrung004.gif', label: 'Food' },
  { code: 'facepalm', file: 'facepalmxd.gif', label: 'Facepalm' },
  { code: 'floydthinking', file: 'floydthinking.png', label: 'Thinking' },
  { code: 'foodanddrink', file: 'foodanddrink6.gif', label: 'Food & drink' },
  { code: 'gasolnoway', file: 'gasolnoway.png', label: 'No way' },
  { code: 'gdubstupidface', file: 'gdubstupidface.png', label: 'Stupid face' },
  { code: 'gtfo', file: 'gtfoe.gif', label: 'GTFO' },
  { code: 'hah', file: 'hah3.png', label: 'Hah' },
  { code: 'iranmaybe', file: 'iranmaybe.png', label: 'Maybe' },
  { code: 'iseeu', file: 'iseeu.png', label: 'I see you' },
  { code: 'jameshardensmile', file: 'jameshardensmile.png', label: 'Smile' },
  { code: 'jarulecmonson', file: 'jarulecmonson.png', label: "C'mon son" },
  { code: 'jaypause', file: 'jaypause2.png', label: 'Pause' },
  { code: 'jayzbiglaugh', file: 'jayzbiglaugh2.png', label: 'Big laugh' },
  { code: 'jayznyhatlaugh', file: 'jayznyhatlaugh.png', label: 'Hat laugh' },
  { code: 'jimdatazz', file: 'jimdatazz.png', label: 'Dat azz' },
  { code: 'jwillidontknow', file: 'jwillidontknow.png', label: "I don't know" },
  { code: 'kanyehappy', file: 'kanyehappy.png', label: 'Happy' },
  { code: 'keenanmustache', file: 'keenanmustache.png', label: 'Mustache' },
  { code: 'kennybayless', file: 'kennybayless.gif', label: 'Kenny' },
  { code: 'kevinhartyuk', file: 'kevinhartyuk.png', label: 'Yuk' },
  { code: 'kghah', file: 'kghah.png', label: 'Hah' },
  { code: 'kobe', file: 'kobel.gif', label: 'Kobe' },
  { code: 'kobeohhhno', file: 'kobeohhhhhno.png', label: 'Oh no' },
  { code: 'kobescrunch', file: 'kobescrunch.png', label: 'Scrunch' },
  { code: 'krs', file: 'krs.gif', label: 'KRS' },
  { code: 'lachen', file: 'lachen001.gif', label: 'Laughing' },
  { code: 'laughing', file: 'laughing5.gif', label: 'Laughing' },
  { code: 'lebronhah', file: 'lebronhah.gif', label: 'Hah' },
  { code: 'lebronlaughteeth', file: 'lebronlaughteeth1.png', label: 'Laugh teeth' },
  { code: 'lebronoface', file: 'lebronoface.png', label: 'O face' },
  { code: 'lebronwhatever', file: 'lebronwhatever2.png', label: 'Whatever' },
  { code: 'maruseesu', file: 'maruseesu2.png', label: 'I see you' },
  { code: 'melodatazz', file: 'melodatazz.png', label: 'Dat azz' },
  { code: 'miketyslaugh', file: 'miketyslaugh.png', label: 'Laugh' },
  { code: 'mjchokehand', file: 'mjchokehand.png', label: 'Choke' },
  { code: 'moaz', file: 'moaz.png', label: 'Moaz' },
  { code: 'mustache', file: 'mustachevz.png', label: 'Mustache' },
  { code: 'nasdatazz', file: 'nasdatazz.png', label: 'Dat azz' },
  { code: 'nbastevenash', file: 'nbastevenashdesire20120.png', label: 'Nash' },
  { code: 'nflraylewis', file: 'nflraylewisdesire201204.png', label: 'Ray Lewis' },
  { code: 'nice', file: 'nice2.gif', label: 'Nice' },
  { code: 'obamadatazz', file: 'obamadatazz.png', label: 'Dat azz' },
  { code: 'obamadatazzpointing', file: 'obamadatazzpointing.png', label: 'Pointing' },
  { code: 'obamahmm', file: 'obamahmmw.png', label: 'Hmm' },
  { code: 'omfg', file: 'omfg.gif', label: 'OMFG' },
  { code: 'osamadead', file: 'osamadead.png', label: 'Dead' },
  { code: 'pietrushah', file: 'pietrushah.png', label: 'Pietrus' },
  { code: 'quagmire', file: 'quagmiresmiley.gif', label: 'Quagmire' },
  { code: 'raydisgusted', file: 'raydisgusted.png', label: 'Disgusted' },
  { code: 'rolllaugh', file: 'rolllaugh.gif', label: 'Roll laugh' },
  { code: 'rudywhatever', file: 'rudywhatever.png', label: 'Whatever' },
  { code: 'sadsmiley', file: 'sadsmiley028.gif', label: 'Sad' },
  { code: 'sadto', file: 'sadto.gif', label: 'Sad' },
  { code: 'salty', file: 'salty.gif', label: 'Salty' },
  { code: 'sammysosadatazz', file: 'sammysosadatazz.png', label: 'Dat azz' },
  { code: 'shaqdatazz', file: 'shaqdatazz.gif', label: 'Dat azz' },
  { code: 'shaqseriouslybro', file: 'shaqseriouslybro.png', label: 'Seriously bro' },
  { code: 'shaqwhatever', file: 'shaqwhatever.png', label: 'Whatever' },
  { code: 'sheed', file: 'sheed.png', label: 'Sheed' },
  { code: 'smugrussell', file: 'smugrussell.gif', label: 'Smug' },
  { code: 'snoopfacepalm', file: 'snoopfacepalm.png', label: 'Facepalm' },
  { code: 'snoopfunnyhat', file: 'snoopfunnyhat.png', label: 'Funny hat' },
  { code: 'stephenahand', file: 'stephenahand.png', label: 'Hand' },
  { code: 'tajgibson', file: 'tajgibson.png', label: 'Taj Gibson' },
  { code: 'thisnicca', file: 'thisnicca.png', label: 'This nicca' },
  { code: 'timduncanfoul', file: 'timduncanfoul.png', label: 'Foul' },
  { code: 'timduncanokthatsenuf', file: 'timduncanokthatsenuf.png', label: "Ok that's enuf" },
  { code: 'timmydscream', file: 'timmydscream.png', label: 'Scream' },
  { code: 'tuckerwtf', file: 'tuckerwtf.png', label: 'WTF' },
  { code: 'westbrooksmirk', file: 'westbrooksmirk.png', label: 'Smirk' },
  { code: 'whatever', file: 'whatever2jpg.png', label: 'Whatever' },
  { code: 'wilbonsmirk', file: 'wilbonsmirk.png', label: 'Smirk' },
  { code: 'willfrown', file: 'willfrown.png', label: 'Frown' },
  { code: 'wtf', file: 'wtf2q.gif', label: 'WTF' },
  { code: 'wutbh', file: 'wutbh.png', label: 'Wut' },
  { code: 'yaocmonson', file: 'yaocmonson.png', label: "C'mon son" },
];

export const SMILIES: SmilieEntry[] = RAW.map((s) => ({ ...s }));

export const SMILIE_MAP: Map<string, SmilieEntry> = new Map(
  SMILIES.map((s) => [s.code, s]),
);

export const SMILIE_REGEX = /:([a-z0-9]+):/gi;

export function smilieUrl(code: string): string | null {
  const entry = SMILIE_MAP.get(code.toLowerCase());
  return entry ? `${SMILIE_BASE}${entry.file}` : null;
}

export const REACTION_SMILIES: SmilieEntry[] = SMILIES.filter((s) =>
  [
    'rofl', 'dead', 'facepalm', 'salty', 'wtf', 'confused', 'cool', 'nice',
    'laughing', 'rolllaugh', 'sadsmiley', 'angry', 'omfg', 'hah',
    'dealwithit', 'whatever', 'gtfo', 'dwadecrying', 'dwighthowardshocked',
    'smugrussell', 'floydthinking', 'kanyehappy', 'raydisgusted', 'timmydscream',
  ].includes(s.code),
);

export function renderSmilies(text: string): { type: 'text' | 'smilie'; content: string; code?: string }[] {
  const parts: { type: 'text' | 'smilie'; content: string; code?: string }[] = [];
  let lastIndex = 0;
  const regex = new RegExp(SMILIE_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const code = match[1].toLowerCase();
    const entry = SMILIE_MAP.get(code);
    if (!entry) continue;

    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'smilie', content: entry.file, code });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: text }];
}
