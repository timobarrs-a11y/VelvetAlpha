import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Type, Palette, ALargeSmall, RotateCcw } from 'lucide-react';
import { colorNameToHex, QUESTIONNAIRE_COLORS } from '../utils/colorMapping';

export interface EditorStyles {
  fontFamily: string;
  fontSize: string;
  fontColor: string;
}

interface CollaborativeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  aiColor?: string;
  editorStyles?: EditorStyles;
  onStyleChange?: (styles: EditorStyles) => void;
  userFavoriteColor?: string;
}

export interface CollaborativeEditorHandle {
  insertAtCursor: (text: string) => void;
  getCursorPosition: () => number;
  focus: () => void;
}

const FONT_FAMILIES = [
  { label: 'Serif', value: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { label: 'Sans', value: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { label: 'Casual', value: '"Comic Sans MS", "Chalkboard SE", cursive' },
];

const FONT_SIZES = ['14px', '16px', '18px', '20px', '22px', '24px'];

const EDITOR_COLORS = [
  { name: 'Black', hex: '#1A202C' },
  ...QUESTIONNAIRE_COLORS.filter(c => c !== 'Black' && c !== 'White').map(name => ({
    name,
    hex: colorNameToHex(name),
  })),
];

export const CollaborativeEditor = forwardRef<CollaborativeEditorHandle, CollaborativeEditorProps>(
  ({ value, onChange, placeholder, disabled = false, aiColor = '#3b82f6', editorStyles, onStyleChange, userFavoriteColor }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cursorPositionRef = useRef<number>(value.length);

    const currentStyles: EditorStyles = editorStyles || {
      fontFamily: FONT_FAMILIES[0].value,
      fontSize: '18px',
      fontColor: '#1A202C',
    };

    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [value]);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const handleSelect = () => {
          cursorPositionRef.current = textarea.selectionStart;
        };
        textarea.addEventListener('select', handleSelect);
        textarea.addEventListener('click', handleSelect);
        textarea.addEventListener('keyup', handleSelect);

        return () => {
          textarea.removeEventListener('select', handleSelect);
          textarea.removeEventListener('click', handleSelect);
          textarea.removeEventListener('keyup', handleSelect);
        };
      }
    }, []);

    useImperativeHandle(ref, () => ({
      insertAtCursor: (text: string) => {
        if (!textareaRef.current) return;

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = textarea.value;

        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
        onChange(newValue);

        setTimeout(() => {
          const newCursorPos = start + text.length;
          textarea.selectionStart = newCursorPos;
          textarea.selectionEnd = newCursorPos;
          textarea.focus();
          cursorPositionRef.current = newCursorPos;
        }, 0);
      },
      getCursorPosition: () => {
        return textareaRef.current?.selectionStart ?? value.length;
      },
      focus: () => {
        textareaRef.current?.focus();
      },
    }));

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.currentTarget.selectionStart;
        const end = e.currentTarget.selectionEnd;
        const newValue = value.substring(0, start) + '  ' + value.substring(end);
        onChange(newValue);

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + 2;
            textareaRef.current.selectionEnd = start + 2;
          }
        }, 0);
      }
    };

    const updateStyle = (key: keyof EditorStyles, val: string) => {
      if (onStyleChange) {
        onStyleChange({ ...currentStyles, [key]: val });
      }
    };

    const currentFontLabel = FONT_FAMILIES.find(f => f.value === currentStyles.fontFamily)?.label || 'Serif';
    const favHex = userFavoriteColor ? colorNameToHex(userFavoriteColor) : null;

    return (
      <div className="relative w-full h-full flex flex-col">
        {onStyleChange && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-t-xl border-b-0">
            <div className="flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={currentStyles.fontFamily}
                onChange={(e) => updateStyle('fontFamily', e.target.value)}
                className="text-sm bg-transparent border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
              >
                {FONT_FAMILIES.map(f => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="w-px h-5 bg-gray-200" />

            <div className="flex items-center gap-1.5">
              <ALargeSmall className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={currentStyles.fontSize}
                onChange={(e) => updateStyle('fontSize', e.target.value)}
                className="text-sm bg-transparent border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-400 cursor-pointer"
              >
                {FONT_SIZES.map(s => (
                  <option key={s} value={s}>{s.replace('px', '')}</option>
                ))}
              </select>
            </div>

            <div className="w-px h-5 bg-gray-200" />

            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex items-center gap-1">
                {EDITOR_COLORS.map(({ name, hex }) => (
                  <button
                    key={name}
                    onClick={() => updateStyle('fontColor', hex)}
                    title={name}
                    className={`w-5 h-5 rounded-full border transition-all hover:scale-125 ${
                      currentStyles.fontColor === hex
                        ? 'border-blue-500 ring-2 ring-blue-300 scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
                {favHex && !EDITOR_COLORS.some(c => c.hex === favHex) && (
                  <button
                    onClick={() => updateStyle('fontColor', favHex)}
                    title={`My Color (${userFavoriteColor})`}
                    className={`w-5 h-5 rounded-full border transition-all hover:scale-125 ${
                      currentStyles.fontColor === favHex
                        ? 'border-blue-500 ring-2 ring-blue-300 scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: favHex }}
                  />
                )}
              </div>
              {favHex && currentStyles.fontColor !== favHex && (
                <button
                  onClick={() => updateStyle('fontColor', favHex)}
                  title="Reset to my color"
                  className="ml-1 p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  <RotateCcw className="w-3 h-3 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full h-full min-h-[500px] p-8 bg-white shadow-sm border border-gray-200 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed ${
            onStyleChange ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'
          }`}
          style={{
            fontFamily: currentStyles.fontFamily,
            fontSize: currentStyles.fontSize,
            lineHeight: '1.8',
            letterSpacing: '0.01em',
            color: currentStyles.fontColor,
          }}
        />
      </div>
    );
  }
);

CollaborativeEditor.displayName = 'CollaborativeEditor';
