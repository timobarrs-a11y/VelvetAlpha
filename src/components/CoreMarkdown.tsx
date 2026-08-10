import { useState, Fragment } from 'react';
import { Check, Copy } from 'lucide-react';

interface CoreMarkdownProps {
  content: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inline formatting: bold, italic, inline code, links. Input is escaped first,
// so the resulting HTML only contains the tags we add.
function parseInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-slate-500/15 text-slate-200 text-[0.85em] font-mono">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline underline-offset-2 hover:text-sky-300">$1</a>');
}

function InlineHtml({ text }: { text: string }) {
  return <span dangerouslySetInnerHTML={{ __html: parseInline(text) }} />;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-white/10 bg-[#0b0d12]">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/8 bg-white/[0.03]">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400/70">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3.5 py-3 text-[13px] leading-relaxed">
        <code className="font-mono text-slate-200 whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

type Block =
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'hr' }
  | { kind: 'p'; text: string };

function parseBlocks(raw: string): Block[] {
  const lines = raw.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  let ulBuf: string[] = [];
  let olBuf: string[] = [];
  const flushLists = () => {
    if (ulBuf.length) { blocks.push({ kind: 'ul', items: ulBuf }); ulBuf = []; }
    if (olBuf.length) { blocks.push({ kind: 'ol', items: olBuf }); olBuf = []; }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      flushLists();
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push({ kind: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flushLists();
      const level = line.match(/^(#{1,6})\s/)![1].length;
      blocks.push({ kind: 'heading', level, text: line.slice(level + 1) });
      i++;
      continue;
    }

    if (/^\s*[-*+]\s/.test(line)) {
      if (olBuf.length) flushLists();
      ulBuf.push(line.replace(/^\s*[-*+]\s/, ''));
      i++;
      continue;
    }

    if (/^\s*\d+\.\s/.test(line)) {
      if (ulBuf.length) flushLists();
      olBuf.push(line.replace(/^\s*\d+\.\s/, ''));
      i++;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      flushLists();
      blocks.push({ kind: 'hr' });
      i++;
      continue;
    }

    if (line.trim() === '') {
      flushLists();
      i++;
      continue;
    }

    flushLists();
    blocks.push({ kind: 'p', text: line });
    i++;
  }

  flushLists();
  return blocks;
}

const HEADING_CLASSES = [
  'text-lg font-bold mt-4 mb-1.5',
  'text-base font-bold mt-4 mb-1.5',
  'text-sm font-bold mt-3 mb-1',
  'text-sm font-semibold mt-3 mb-1',
  'text-sm font-semibold mt-2 mb-1',
  'text-sm font-semibold mt-2 mb-1',
];

export function CoreMarkdown({ content }: CoreMarkdownProps) {
  const blocks = parseBlocks(content);

  return (
    <div className="text-slate-100/90 leading-relaxed">
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case 'code':
            return <CodeBlock key={idx} code={block.code} lang={block.lang} />;
          case 'heading': {
            const Tag = `h${Math.min(block.level, 6)}` as keyof JSX.IntrinsicElements;
            return (
              <Tag key={idx} className={HEADING_CLASSES[block.level - 1]}>
                <InlineHtml text={block.text} />
              </Tag>
            );
          }
          case 'ul':
            return (
              <ul key={idx} className="list-disc pl-5 my-2 space-y-1">
                {block.items.map((it, j) => <li key={j}><InlineHtml text={it} /></li>)}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="list-decimal pl-5 my-2 space-y-1">
                {block.items.map((it, j) => <li key={j}><InlineHtml text={it} /></li>)}
              </ol>
            );
          case 'hr':
            return <hr key={idx} className="my-4 border-white/10" />;
          case 'p':
            return (
              <p key={idx} className="my-2">
                <InlineHtml text={block.text} />
              </p>
            );
          default:
            return <Fragment key={idx} />;
        }
      })}
    </div>
  );
}
