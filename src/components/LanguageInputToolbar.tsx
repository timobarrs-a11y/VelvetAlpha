import { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown } from 'lucide-react';

export type LanguageCode = 'es' | 'fr' | 'de' | 'it' | 'pt';

const LANGUAGE_CHARS: Record<LanguageCode, string[]> = {
  es: ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'],
  fr: ['à', 'â', 'ç', 'é', 'è', 'ê', 'ë', 'î', 'ï', 'ô', 'û', 'ù', 'ü', 'œ', '«', '»'],
  de: ['ä', 'ö', 'ü', 'ß'],
  it: ['à', 'è', 'é', 'ì', 'ò', 'ù'],
  pt: ['á', 'â', 'ã', 'à', 'ç', 'é', 'ê', 'í', 'ó', 'ô', 'õ', 'ú'],
};

const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
};

const LANGUAGE_FLAGS: Record<LanguageCode, string> = {
  es: '🇪🇸',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  pt: '🇵🇹',
};

const LANGUAGE_ORDER: LanguageCode[] = ['es', 'fr', 'de', 'it', 'pt'];

function storageKey(companionId: string): string {
  return `language-toolbar:${companionId}`;
}

function loadLanguage(companionId: string): LanguageCode {
  try {
    const stored = localStorage.getItem(storageKey(companionId));
    if (stored && stored in LANGUAGE_CHARS) return stored as LanguageCode;
  } catch {
    // localStorage may be blocked (private browsing) — fall through to default
  }
  return 'es';
}

function saveLanguage(companionId: string, lang: LanguageCode): void {
  try {
    localStorage.setItem(storageKey(companionId), lang);
  } catch {
    // Same guard — never crash the chat over a storage write
  }
}

interface LanguageInputToolbarProps {
  companionId: string;
  onInsert: (char: string) => void;
}

export const LanguageInputToolbar = ({ companionId, onInsert }: LanguageInputToolbarProps) => {
  const [language, setLanguage] = useState<LanguageCode>(() => loadLanguage(companionId));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLanguage(loadLanguage(companionId));
  }, [companionId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [pickerOpen]);

  const selectLanguage = (lang: LanguageCode) => {
    setLanguage(lang);
    saveLanguage(companionId, lang);
    setPickerOpen(false);
  };

  const chars = LANGUAGE_CHARS[language];

  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      {/* Language picker */}
      <div ref={pickerRef} className="relative flex-shrink-0">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPickerOpen(o => !o)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:border-rose-300 hover:text-rose-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
          aria-label={`Language: ${LANGUAGE_LABELS[language]}`}
          aria-expanded={pickerOpen}
        >
          <span className="text-sm leading-none">{LANGUAGE_FLAGS[language]}</span>
          <span className="hidden sm:inline">{LANGUAGE_LABELS[language]}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {pickerOpen && (
          <div className="absolute bottom-full left-0 mb-1 bg-white rounded-xl border border-gray-200 shadow-lg py-1 min-w-[120px] z-20">
            {LANGUAGE_ORDER.map(lang => (
              <button
                key={lang}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectLanguage(lang)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 ${
                  lang === language
                    ? 'text-rose-500 bg-rose-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-sm leading-none">{LANGUAGE_FLAGS[lang]}</span>
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Character buttons */}
      <div
        className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1"
        style={{ minHeight: 32 }}
      >
        {chars.map(char => (
          <button
            key={char}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onInsert(char);
            }}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-[15px] text-gray-800 hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-200"
            aria-label={`Insert ${char}`}
          >
            {char}
          </button>
        ))}
      </div>
    </div>
  );
};
