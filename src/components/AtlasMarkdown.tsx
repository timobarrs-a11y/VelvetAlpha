interface AtlasMarkdownProps {
  content: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseInline(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="atlas-inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="atlas-link">$1</a>');
}

function parseMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let inList = false;
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      out.push(`<ul class="atlas-ul">${listItems.map(li => `<li>${parseInline(li)}</li>`).join('')}</ul>`);
      listItems = [];
      inList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        flushList();
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        const langClass = codeLang ? ` class="language-${codeLang}"` : '';
        out.push(`<div class="atlas-code-block"><div class="atlas-code-lang">${escapeHtml(codeLang || 'code')}</div><pre><code${langClass}>${escapeHtml(codeLines.join('\n'))}</code></pre></div>`);
        inCode = false;
        codeLines = [];
        codeLang = '';
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^#{1,6}\s/.test(line)) {
      flushList();
      const level = line.match(/^(#{1,6})\s/)![1].length;
      const text = line.slice(level + 1);
      const cls = ['atlas-h1', 'atlas-h2', 'atlas-h3', 'atlas-h4', 'atlas-h5', 'atlas-h6'][level - 1];
      out.push(`<h${level} class="${cls}">${parseInline(text)}</h${level}>`);
      continue;
    }

    if (/^[-*+]\s/.test(line)) {
      inList = true;
      listItems.push(line.slice(2));
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushList();
      const text = line.replace(/^\d+\.\s/, '');
      out.push(`<p class="atlas-ol-item">${parseInline(text)}</p>`);
      continue;
    }

    if (line.trim() === '') {
      flushList();
      out.push('<div class="atlas-spacer"></div>');
      continue;
    }

    if (line.startsWith('---') || line.startsWith('***') || line.startsWith('___')) {
      flushList();
      out.push('<hr class="atlas-hr" />');
      continue;
    }

    flushList();
    out.push(`<p class="atlas-p">${parseInline(line)}</p>`);
  }

  if (inCode && codeLines.length) {
    out.push(`<div class="atlas-code-block"><pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre></div>`);
  }

  flushList();

  return out.join('');
}

export function AtlasMarkdown({ content }: AtlasMarkdownProps) {
  const html = parseMarkdown(content);
  return (
    <div
      className="atlas-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
