import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react';

interface AgeVerificationModalProps {
  onVerified: () => void;
}

const MONTHS = [
  { value: '01', label: 'January' }, { value: '02', label: 'February' },
  { value: '03', label: 'March' }, { value: '04', label: 'April' },
  { value: '05', label: 'May' }, { value: '06', label: 'June' },
  { value: '07', label: 'July' }, { value: '08', label: 'August' },
  { value: '09', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

function StyledSelect({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl px-4 py-3 pr-10 text-sm font-medium transition-all outline-none"
        style={{
          background: value ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${value ? 'rgba(100,120,255,0.50)' : 'rgba(255,255,255,0.12)'}`,
          color: value ? 'white' : 'rgba(180,190,255,0.55)',
        }}
      >
        <option value="" disabled style={{ background: '#141a55', color: 'rgba(180,190,255,0.55)' }}>{placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: '#141a55', color: 'white' }}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'rgba(180,190,255,0.50)' }} />
    </div>
  );
}

export function AgeVerificationModal({ onVerified }: AgeVerificationModalProps) {
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [error, setError] = useState('');

  const currentYear = new Date().getFullYear();
  const dayOptions = Array.from({ length: 31 }, (_, i) => {
    const d = (i + 1).toString().padStart(2, '0');
    return { value: d, label: d };
  });
  const yearOptions = Array.from({ length: 100 }, (_, i) => {
    const y = (currentYear - i).toString();
    return { value: y, label: y };
  });

  const handleVerify = () => {
    if (!birthMonth || !birthDay || !birthYear) {
      setError('Please enter your complete date of birth.');
      return;
    }

    const birth = new Date(parseInt(birthYear), parseInt(birthMonth) - 1, parseInt(birthDay));
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

    if (age < 18) {
      setError('You must be 18 years or older to use this service.');
      return;
    }

    localStorage.setItem('ageVerified', 'true');
    localStorage.setItem('ageVerificationDate', new Date().toISOString());
    onVerified();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)' }}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`,
        }}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm rounded-3xl p-8"
        style={{
          background: 'rgba(13,15,55,0.90)',
          border: '1px solid rgba(100,120,255,0.30)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
        }}
      >
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(100,120,255,0.15)', border: '1px solid rgba(100,120,255,0.30)' }}
          >
            <ShieldCheck className="w-7 h-7 text-blue-300" />
          </div>
          <h2 className="text-2xl font-bold text-white text-center">Age Verification</h2>
          <p className="text-blue-200/60 text-sm text-center mt-1">
            This service is for adults 18 and older.
          </p>
        </div>

        <div className="space-y-3 mb-5">
          <div className="grid grid-cols-3 gap-2">
            <StyledSelect value={birthMonth} onChange={(v) => { setBirthMonth(v); setError(''); }} options={MONTHS} placeholder="Month" />
            <StyledSelect value={birthDay} onChange={(v) => { setBirthDay(v); setError(''); }} options={dayOptions} placeholder="Day" />
            <StyledSelect value={birthYear} onChange={(v) => { setBirthYear(v); setError(''); }} options={yearOptions} placeholder="Year" />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl"
              style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        <button
          onClick={handleVerify}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,107,0.90) 0%, rgba(192,80,220,0.90) 100%)',
            boxShadow: '0 4px 20px rgba(244,63,107,0.30)',
          }}
        >
          <span className="flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Confirm Age & Continue
          </span>
        </button>

        <p className="text-xs text-blue-200/35 text-center mt-4 leading-relaxed">
          Your date of birth is used only to verify eligibility and is not stored on our servers.
        </p>
      </motion.div>
    </div>
  );
}
