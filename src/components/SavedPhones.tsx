import { useEffect, useRef, useState } from 'react';
import type { Device } from '../data/types';
import { clearSavedPhones, deleteSavedPhone, importSavedPhones, loadSavedPhones, parseSavedFile, SAVED_CHANGED } from '../data/savedPhones';
import { DeviceImage } from './DeviceImage';
import { Icon } from './Icon';

/** Import the JSON exported by the AetherPhone Saver extension, and manage saved phones. */
export function SavedPhones({ onOpen }: { onOpen: (id: string) => void }) {
  const [phones, setPhones] = useState<Device[]>([]);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => void loadSavedPhones().then(setPhones);
  useEffect(() => {
    reload();
    window.addEventListener(SAVED_CHANGED, reload);
    return () => window.removeEventListener(SAVED_CHANGED, reload);
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const devices = parseSavedFile(await file.text());
      const n = await importSavedPhones(devices);
      setMessage({ kind: 'ok', text: `Imported ${n} phone${n === 1 ? '' : 's'}. They are saved on this device.` });
    } catch (e) {
      setMessage({ kind: 'error', text: `Import failed: ${e instanceof Error ? e.message : 'unknown error'}` });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <section className="saved">
      <div className="saved-bar">
        <div>
          <strong>Saved phones on this device</strong>
          <p className="muted small">
            Save phones with the AetherPhone Saver browser extension while you browse GSMArena,
            then export and import the file here. Everything stays on your device.
          </p>
        </div>
        <div className="saved-actions">
          <button className="btn" onClick={() => fileRef.current?.click()}><Icon name="plus" size={16} /> Import JSON</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          {phones.length > 0 && <button className="btn-outline" onClick={() => void clearSavedPhones()}>Delete all</button>}
        </div>
      </div>

      {message && <p className={`saved-msg ${message.kind}`}>{message.text}</p>}

      {phones.length === 0 ? (
        <p className="muted">No saved phones yet.</p>
      ) : (
        <ul className="saved-list">
          {phones.map((d) => (
            <li key={d.id}>
              <button className="saved-open" onClick={() => onOpen(d.id)}>
                <div className="saved-thumb"><DeviceImage device={d} /></div>
                <div>
                  <strong>{d.brand} {d.model}</strong>
                  <small>{d.year} · {d.soc.chipset ?? 'chipset unknown'}</small>
                </div>
              </button>
              <button className="icon-btn" aria-label={`Delete ${d.brand} ${d.model}`} onClick={() => void deleteSavedPhone(d.id)}>
                <Icon name="x" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
