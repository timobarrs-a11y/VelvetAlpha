import { useState } from 'react';
import { adminConsole, AppSetting } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, panel, btnNeutral, inputClass, useLoad, act, ago } from './ui';

export function AdminSettingsPage() {
  const { data, error, loading, reload } = useLoad(() => adminConsole.listSettings(), []);

  return (
    <>
      <PageHeader
        title="Site controls"
        subtitle="Live switches and limits. Changes are logged. A setting only takes effect where the app or an edge function reads it."
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <Spinner /> : (
        <div className="space-y-3">
          {(data ?? []).map(s => <SettingRow key={s.key} setting={s} onSaved={reload} />)}
        </div>
      )}
    </>
  );
}

function SettingRow({ setting, onSaved }: { setting: AppSetting; onSaved: () => void }) {
  const kind = typeof setting.value;
  const [text, setText] = useState(kind === 'string' || kind === 'number' ? String(setting.value) : '');

  const save = async (value: unknown) => {
    if (await act(`${setting.key} updated`, () => adminConsole.setSetting(setting.key, value))) onSaved();
  };

  return (
    <div className={`${panel} p-4 flex flex-wrap items-center gap-4`}>
      <div className="flex-1 min-w-[220px]">
        <p className="text-white font-mono text-sm">{setting.key}</p>
        <p className="text-white/40 text-xs">{setting.description} · changed {ago(setting.updated_at)}</p>
      </div>
      {kind === 'boolean' ? (
        <button
          onClick={() => save(!setting.value)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium border transition ${setting.value ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/15 text-white/50'}`}
        >{setting.value ? 'ON' : 'OFF'}</button>
      ) : (
        <div className="flex gap-2">
          <input value={text} onChange={e => setText(e.target.value)} className={`${inputClass} w-64 max-w-full`} />
          <button
            className={btnNeutral}
            disabled={text === String(setting.value) || (kind === 'number' && (text.trim() === '' || Number.isNaN(Number(text))))}
            onClick={() => save(kind === 'number' ? Number(text) : text)}
          >Save</button>
        </div>
      )}
    </div>
  );
}
