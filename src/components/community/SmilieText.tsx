import { renderSmilies, smilieUrl } from '../../config/smilieRegistry';

interface SmilieTextProps {
  text: string;
  className?: string;
  smilieSize?: number;
}

export function SmilieText({ text, className, smilieSize = 20 }: SmilieTextProps) {
  const parts = renderSmilies(text);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        }
        const url = smilieUrl(part.code!);
        if (!url) return <span key={i}>:{part.code}:</span>;
        return (
          <img
            key={i}
            src={url}
            alt={`:${part.code}:`}
            title={`:${part.code}:`}
            style={{ height: smilieSize, width: 'auto', display: 'inline-block', verticalAlign: 'middle', margin: '0 1px' }}
            loading="lazy"
          />
        );
      })}
    </span>
  );
}
