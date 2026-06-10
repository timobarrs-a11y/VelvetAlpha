import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight } from 'lucide-react';
import { upsertSchedule, type ScheduleInput, type WorkType, type SchoolPickupTime } from '../services/userScheduleService';

interface Props {
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
}

type Step = 'work' | 'commute' | 'life';

interface ChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function Chip({ label, selected, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-150 select-none"
      style={{
        background: selected ? '#1a1a2e' : 'rgba(0,0,0,0.04)',
        color: selected ? '#fff' : '#555',
        border: `1.5px solid ${selected ? '#1a1a2e' : 'rgba(0,0,0,0.10)'}`,
        boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.18)' : 'none',
      }}
    >
      {selected && <Check className="w-3 h-3 flex-shrink-0" />}
      {label}
    </button>
  );
}

const WORK_TYPES: { id: WorkType; label: string; sub: string }[] = [
  { id: 'office',    label: 'Office',     sub: '9-to-5, on-site' },
  { id: 'remote',   label: 'Remote',     sub: 'Work from home' },
  { id: 'hybrid',   label: 'Hybrid',     sub: 'Mix of both' },
  { id: 'shift',    label: 'Shifts',     sub: 'Rotating schedule' },
  { id: 'freelance',label: 'Freelance',  sub: 'Self-employed' },
  { id: 'student',  label: 'Student',    sub: 'School / classes' },
  { id: 'none',     label: 'Not working',sub: 'Flexible schedule' },
];

const WORK_HOURS: { label: string; start: number; end: number }[] = [
  { label: '6am – 2pm',   start: 6,  end: 14 },
  { label: '7am – 3pm',   start: 7,  end: 15 },
  { label: '8am – 4pm',   start: 8,  end: 16 },
  { label: '9am – 5pm',   start: 9,  end: 17 },
  { label: '10am – 6pm',  start: 10, end: 18 },
  { label: 'Evening shift',start: 15, end: 23 },
  { label: 'Night shift',  start: 22, end: 6  },
];

export function WorkScheduleSetupModal({ userId, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('work');
  const [saving, setSaving] = useState(false);

  const [workType, setWorkType] = useState<WorkType>('office');
  const [workHours, setWorkHours] = useState<{ start: number; end: number } | null>({ start: 9, end: 17 });
  const [morningCommute, setMorningCommute] = useState(false);
  const [eveningCommute, setEveningCommute] = useState(false);
  const [schoolPickup, setSchoolPickup] = useState(false);
  const [pickupTime, setPickupTime] = useState<SchoolPickupTime | null>(null);
  const [hasAppointments, setHasAppointments] = useState(false);
  const [appointmentNotes, setAppointmentNotes] = useState('');

  const showHours = workType !== 'none' && workType !== 'freelance';

  const stepIndex = step === 'work' ? 0 : step === 'commute' ? 1 : 2;

  async function handleSave() {
    setSaving(true);
    const schedule: ScheduleInput = {
      work_type: workType,
      work_start_hour: showHours && workHours ? workHours.start : null,
      work_end_hour: showHours && workHours ? workHours.end : null,
      has_morning_commute: morningCommute,
      has_evening_commute: eveningCommute,
      has_school_pickup: schoolPickup,
      school_pickup_time: schoolPickup ? (pickupTime ?? 'afternoon') : null,
      has_recurring_appointments: hasAppointments,
      appointment_notes: hasAppointments ? appointmentNotes : null,
      extra_context: null,
    };
    try {
      await upsertSchedule(userId, schedule);
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '85vh', boxShadow: '0 32px 80px rgba(0,0,0,0.25)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100/80">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Your Daily Rhythm</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Helps personalize your morning brief</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 pt-3 pb-0">
          {(['work', 'commute', 'life'] as Step[]).map((s, i) => (
            <div
              key={s}
              className="rounded-full transition-all duration-200"
              style={{
                width: step === s ? 20 : 6,
                height: 6,
                background: i <= stepIndex ? '#1a1a2e' : 'rgba(0,0,0,0.12)',
              }}
            />
          ))}
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <AnimatePresence mode="wait">
            {step === 'work' && (
              <motion.div key="work" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <p className="text-[13px] font-semibold text-gray-800 mb-1">How do you spend your days?</p>
                <p className="text-[11px] text-gray-400 mb-4">Just tap the one that fits — nothing else needed.</p>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  {WORK_TYPES.map(wt => (
                    <button
                      key={wt.id}
                      onClick={() => setWorkType(wt.id)}
                      className="text-left px-3 py-2.5 rounded-xl border-2 transition-all duration-150"
                      style={{
                        borderColor: workType === wt.id ? '#1a1a2e' : 'rgba(0,0,0,0.08)',
                        background: workType === wt.id ? 'rgba(26,26,46,0.05)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <p className="text-[12px] font-semibold text-gray-800">{wt.label}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{wt.sub}</p>
                    </button>
                  ))}
                </div>

                {showHours && (
                  <>
                    <p className="text-[12px] font-semibold text-gray-700 mb-2">Typical hours?</p>
                    <div className="flex flex-wrap gap-1.5">
                      {WORK_HOURS.map(h => (
                        <Chip
                          key={h.label}
                          label={h.label}
                          selected={workHours?.start === h.start && workHours?.end === h.end}
                          onClick={() => setWorkHours({ start: h.start, end: h.end })}
                        />
                      ))}
                      <Chip
                        label="Varies"
                        selected={workHours === null}
                        onClick={() => setWorkHours(null)}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {step === 'commute' && (
              <motion.div key="commute" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <p className="text-[13px] font-semibold text-gray-800 mb-1">Any commuting?</p>
                <p className="text-[11px] text-gray-400 mb-4">We'll factor this into your morning and evening heads-up.</p>

                <div className="flex flex-col gap-2 mb-5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div
                      onClick={() => setMorningCommute(v => !v)}
                      className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-all"
                      style={{ borderColor: morningCommute ? '#1a1a2e' : 'rgba(0,0,0,0.18)', background: morningCommute ? '#1a1a2e' : 'white' }}
                    >
                      {morningCommute && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-[12.5px] text-gray-700" onClick={() => setMorningCommute(v => !v)}>Morning commute</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setEveningCommute(v => !v)}
                      className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-all"
                      style={{ borderColor: eveningCommute ? '#1a1a2e' : 'rgba(0,0,0,0.18)', background: eveningCommute ? '#1a1a2e' : 'white' }}
                    >
                      {eveningCommute && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-[12.5px] text-gray-700" onClick={() => setEveningCommute(v => !v)}>Evening commute</span>
                  </label>
                </div>

                <p className="text-[12px] font-semibold text-gray-700 mb-2 mt-4">School pickup / drop-off?</p>
                <label className="flex items-center gap-3 cursor-pointer mb-3">
                  <div
                    onClick={() => setSchoolPickup(v => !v)}
                    className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-all"
                    style={{ borderColor: schoolPickup ? '#1a1a2e' : 'rgba(0,0,0,0.18)', background: schoolPickup ? '#1a1a2e' : 'white' }}
                  >
                    {schoolPickup && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[12.5px] text-gray-700" onClick={() => setSchoolPickup(v => !v)}>I handle school pickup</span>
                </label>

                {schoolPickup && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(['morning', 'afternoon', 'both'] as SchoolPickupTime[]).map(pt => (
                      <Chip
                        key={pt}
                        label={pt === 'morning' ? 'Morning drop-off' : pt === 'afternoon' ? 'Afternoon pickup' : 'Both'}
                        selected={pickupTime === pt}
                        onClick={() => setPickupTime(pt)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {step === 'life' && (
              <motion.div key="life" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <p className="text-[13px] font-semibold text-gray-800 mb-1">Anything recurring?</p>
                <p className="text-[11px] text-gray-400 mb-4">Regular appointments, therapy, gym — the kinds of things your brief should know about.</p>

                <label className="flex items-center gap-3 cursor-pointer mb-4">
                  <div
                    onClick={() => setHasAppointments(v => !v)}
                    className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center border-2 transition-all"
                    style={{ borderColor: hasAppointments ? '#1a1a2e' : 'rgba(0,0,0,0.18)', background: hasAppointments ? '#1a1a2e' : 'white' }}
                  >
                    {hasAppointments && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[12.5px] text-gray-700" onClick={() => setHasAppointments(v => !v)}>I have recurring appointments</span>
                </label>

                {hasAppointments && (
                  <textarea
                    value={appointmentNotes}
                    onChange={e => setAppointmentNotes(e.target.value)}
                    placeholder="e.g. therapy on Tuesdays, gym most mornings, hair every 6 weeks..."
                    className="w-full text-[12px] text-gray-700 placeholder-gray-300 resize-none rounded-xl border border-gray-200 bg-gray-50 p-3 outline-none focus:border-gray-400 transition-colors"
                    rows={3}
                  />
                )}

                <div className="mt-6 p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <p className="text-[10.5px] text-gray-400 leading-relaxed">
                    This is entirely optional and stays private. It just helps make your morning brief feel less generic and more like someone who actually knows your day.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100/80 flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={() => setStep(step === 'life' ? 'commute' : 'work')}
              className="px-4 py-2.5 rounded-xl text-[12px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Back
            </button>
          )}
          <div className="flex-1" />
          {step !== 'life' ? (
            <button
              onClick={() => setStep(step === 'work' ? 'commute' : 'life')}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[12.5px] font-semibold text-white transition-all"
              style={{ background: '#1a1a2e', boxShadow: '0 2px 8px rgba(26,26,46,0.25)' }}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-[12.5px] font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: '#1a1a2e', boxShadow: '0 2px 8px rgba(26,26,46,0.25)' }}
            >
              {saving ? 'Saving...' : 'Save & close'}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
