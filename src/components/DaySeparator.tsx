import { motion } from 'framer-motion';

interface DaySeparatorProps {
  timestamp: number;
}

const formatDayLabel = (timestamp: number): { label: string; dateStr: string } => {
  const msgDate = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const dateStr = msgDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: msgDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });

  if (isSameDay(msgDate, today)) {
    return { label: 'Today', dateStr };
  }

  if (isSameDay(msgDate, yesterday)) {
    return { label: 'Yesterday', dateStr };
  }

  const weekday = msgDate.toLocaleDateString('en-US', { weekday: 'long' });
  const daysDiff = Math.floor((today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDiff <= 6) {
    return { label: weekday, dateStr };
  }

  return { label: dateStr, dateStr: '' };
};

export const DaySeparator = ({ timestamp }: DaySeparatorProps) => {
  const { label, dateStr } = formatDayLabel(timestamp);
  const isToday = label === 'Today';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex items-center gap-3 my-5 select-none"
    >
      <div className="flex-1 h-px bg-gray-200/70" />
      <div
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap ${
          isToday
            ? 'bg-rose-50 border border-rose-200/60 text-rose-500'
            : 'bg-gray-100/80 border border-gray-200/60 text-gray-400'
        }`}
      >
        <span>{label}</span>
        {dateStr && label !== dateStr && (
          <span className={`font-normal ${isToday ? 'text-rose-400' : 'text-gray-400'}`}>
            &middot; {dateStr}
          </span>
        )}
      </div>
      <div className="flex-1 h-px bg-gray-200/70" />
    </motion.div>
  );
};
