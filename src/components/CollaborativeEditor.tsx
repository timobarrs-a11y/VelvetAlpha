import { useRef, useEffect, forwardRef, useImperativeHandle, useState, useCallback } from 'react';
import { Type, Palette, ALargeSmall, RotateCcw, Wand2, Loader } from 'lucide-react';
import { colorNameToHex, QUESTIONNAIRE_COLORS } from '../utils/colorMapping';

export interface EditorStyles {
  fontFamily: string;
  fontSize: string;
  fontColor: string;
}

export type InlineAction = 'rewrite_concise' | 'rewrite_expand' | 'rewrite_funny' | 'rewrite_formal' | 'fix_grammar' | 'continue';

interface CollaborativeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  aiColor?: string;
  editorStyles?: EditorStyles;
  onStyleChange?: (styles: EditorStyles) => void;
  userFavoriteColor?: string;
  onInlineAction?: (action: InlineAction, selectedText: string, selectionStart: number, selectionEnd: number) => void;
  isActionLoading?: boolean;
}

export interface CollaborativeEditorHandle {
  insertAtCursor: (text: string) => void;
  getCursorPosition: () => number;
  focus: () => void;
  replaceRange: (start: number, end: number, text: string) => void;
  getSelectedText: () => { text: string; start: number; end: number } | null;
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

const INLINE_ACTIONS: { action: InlineAction; label: string }[] = [
  { action: 'rewrite_concise', label: 'Concise' },
  { action: 'rewrite_expand', label: 'Expand' },
  { action: 'rewrite_funny', label: 'Funnier' },
  { action: 'rewrite_formal', label: 'More Formal' },
  { action: 'fix_grammar', label: 'Fix Grammar' },
  { action: 'continue', label: 'Continue' },
];

export const CollaborativeEditor = forwardRef<CollaborativeEditorHandle, CollaborativeEditorProps>(
  ({ value, onChange, placeholder, disabled = false, editorStyles, onStyleChange, userFavoriteColor, onInlineAction, isActionLoading }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const cursorPositionRef = useRef<number>(value.length);
    const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(null);

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

    const checkSelection = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      if (start !== end) {
        setSelection({ start, end, text: textarea.value.substring(start, end) });
      } else {
        setSelection(null);
      }
      cursorPositionRef.current = start;
    }, []);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const handleSelect = () => checkSelection();
      const handleMouseUp = () => setTimeout(checkSelection, 10);

      textarea.addEventListener('select', handleSelect);
      textarea.addEventListener('click', handleSelect);
      textarea.addEventListener('keyup', handleSelect);
      textarea.addEventListener('mouseup', handleMouseUp);

      return () => {
        textarea.removeEventListener('select', handleSelect);
        textarea.removeEventListener('click', handleSelect);
        textarea.removeEventListener('keyup', handleSelect);
        textarea.removeEventListener('mouseup', handleMouseUp);
      };
    }, [checkSelection]);

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
      replaceRange: (start: number, end: number, text: string) => {
        const currentValue = textareaRef.current?.value ?? value;
        const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
        onChange(newValue);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = start + text.length;
            textareaRef.current.selectionEnd = start + text.length;
            textareaRef.current.focus();
          }
        }, 0);
      },
      getSelectedText: () => {
        const textarea = textareaRef.current;
        if (!textarea) return null;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) return null;
        return { text: textarea.value.substring(start, end), start, end };
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

    const handleInlineAction = (action: InlineAction) => {
      if (!onInlineAction || !selection) return;
      onInlineAction(action, selection.text, selection.start, selection.end);
    };

    const favHex = userFavoriteColor ? colorNameToHex(userFavoriteColor) : null;

    return (
      <div className="relative w-full h-full flex flex-col">
        {onStyleChange && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-t-xl border-b-0 flex-wrap">
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

        {/* Inline AI Actions Toolbar — appears when text is selected */}
        {selection && selection.text.trim().length > 0 && onInlineAction && (
          <div className="flex items-center gap-1 px-3 py-1.5 bg-violet-50 border border-violet-200 border-b-0 rounded-t-lg flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-1 text-violet-600 mr-1">
              <Wand2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">AI:</span>
            </div>
            {INLINE_ACTIONS.map(({ action, label }) => (
              <button
                key={action}
                onClick={() => handleInlineAction(action)}
                disabled={isActionLoading}
                className="px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-100 hover:bg-violet-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {label}
              </button>
            ))}
            {isActionLoading && (
              <Loader className="w-3.5 h-3.5 animate-spin text-violet-500" />
            )}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onSelect={checkSelection}
          onMouseUp={() => setTimeout(checkSelection, 10)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full h-full min-h-[500px] p-8 bg-white shadow-sm border border-gray-200 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:cursor-not-allowed ${
            onStyleChange ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'
          } ${selection && selection.text.trim().length > 0 && onInlineAction ? 'rounded-t-none' : ''}`}
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
