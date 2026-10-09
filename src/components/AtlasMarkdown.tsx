interface AtlasMarkdownProps {
  content: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only ordinary web and mail links may become an href. Anything else (javascript:,
// data:, vbscript:, protocol-relative, or a broken URL) is rendered as plain text.
function safeHref(raw: string): string | null {
  const candidate = raw.trim();
  if (!candidate || /[\s"'<>`]/.test(candidate)) return null;
  if (candidate.startsWith('//')) return null;
  if (/^(https?:\/\/|mailto:)/i.test(candidate)) return candidate;
  if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return null;
  // Relative paths are safe but must not be a scheme in disguise.
  if (candidate.startsWith('/') || candidate.startsWith('#')) return candidate;
  return null;
}

function parseInline(text: string): string {
  // The source text is model output and may contain anything, so escape first and
  // only then introduce our own markup.
  return escapeHtml(text)
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="atlas-inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      // The href was escaped above; &amp; must go back to & before it is used.
      const url = safeHref(href.replace(/&amp;/g, '&'));
      if (!url) return label;
      return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="atlas-link">${label}</a>`;
    });
}

function parseMarkdown(raw: string): string {
  const lines = raw.split('\n');
  const out: string[] = [];
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      out.push(`<ul class="atlas-ul">${listItems.map(li => `<li>${parseInline(li)}</li>`).join('')}</ul>`);
      listItems = [];
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
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang.replace(/[^a-zA-Z0-9_-]/g, ''))}"` : '';
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
