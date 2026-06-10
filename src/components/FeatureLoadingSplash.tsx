import { type LucideIcon } from 'lucide-react';

interface FeatureLoadingSplashProps {
  icon: LucideIcon;
  label: string;
  accentColor: string;
  bgColor?: string;
}

export function FeatureLoadingSplash({
  icon: Icon,
  label,
  accentColor,
  bgColor = '#0a0a0f',
}: FeatureLoadingSplashProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: bgColor }}
    >
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div
            className="absolute inset-0 rounded-full animate-ping"
            style={{ border: `2px solid ${accentColor}33` }}
          />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: `${accentColor}18` }}
          >
            <Icon className="w-7 h-7" style={{ color: accentColor }} />
          </div>
        </div>
        <p className="text-white/50 text-sm">{label}</p>
      </div>
    </div>
  );
}
