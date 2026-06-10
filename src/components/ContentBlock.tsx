import { useState, useRef, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { CoAuthorBlock } from '../services/coAuthorService';

interface ContentBlockProps {
  block: CoAuthorBlock;
  isAvatar: boolean;
  avatarColor?: string;
  onUpdate: (blockId: string, content: string) => void;
  onDelete: (blockId: string) => void;
  isEditing: boolean;
}

export function ContentBlock({
  block,
  isAvatar,
  avatarColor = '#3b82f6',
  onUpdate,
  onDelete,
  isEditing
}: ContentBlockProps) {
  const [content, setContent] = useState(block.content);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setContent(block.content);
  }, [block.content]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [content]);

  const handleBlur = () => {
    setIsFocused(false);
    if (content !== block.content) {
      onUpdate(block.id, content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      setContent(newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const avatarStyle = isAvatar ? {
    borderLeft: `4px solid ${avatarColor}`,
    backgroundColor: `${avatarColor}08`,
  } : {};

  return (
    <div
      className={`group relative rounded-lg transition-all ${
        isAvatar ? 'pl-4' : 'pl-6'
      } ${isFocused ? 'ring-2 ring-blue-400' : ''}`}
      style={avatarStyle}
    >
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={!isEditing}
          className="flex-1 bg-transparent border-none outline-none resize-none overflow-hidden py-3 text-gray-900 leading-relaxed disabled:cursor-default"
          style={{
            minHeight: '60px',
            fontFamily: 'inherit',
            fontSize: '16px',
            lineHeight: '1.75',
          }}
          placeholder={isAvatar ? "Avatar's response will appear here..." : "Start typing..."}
        />

        {isEditing && (
          <button
            onClick={() => onDelete(block.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg text-red-600"
            title="Delete block"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
