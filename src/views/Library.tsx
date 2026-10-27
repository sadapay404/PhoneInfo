import { useEffect, useRef, useState } from 'react';
import { db } from '../data/db';
import type { Device } from '../data/types';
import { clearSavedPhones, deleteSavedPhone, importFiles, loadSavedPhones, SAVED_CHANGED, type ImportSummary } from '../data/savedPhones';
import { DeviceImage } from '../components/DeviceImage';
import { Icon } from '../components/Icon';

export const IMPORT_EVENT = 'aether:import-files';

// Files dropped on another screen wait here until the Library mounts (the route change is asynchronous).
let pendingFiles: File[] = [];

/** Files dropped anywhere in the app are handed here. */
export function requestImport(files: File[]) {
  pendingFiles = files;
  window.dispatchEvent(new CustomEvent(IMPORT_EVENT, { detail: files }));
}

type Result = (ImportSummary & { files: number; failed: { name: string; error: string }[] }) | null;

function formatMb(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const [phones, setPhones] = useState<Device[]>([]);
  const [counts, setCounts] = useState({ photos: 0, prices: 0 });
  const [storage, setStorage] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Result>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const [list, photos, prices] = await Promise.all([loadSavedPhones(), db.photos.count(), db.prices.count()]);
    setPhones(list.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model)));
    setCounts({ photos, prices });
    try {
      const est = await navigator.storage?.estimate?.();
      setStorage(est?.usage ?? null);
    } catch {
      setStorage(null);
    }
  }

  async function runImport(files: File[]) {
    const list = files.filter((f) => /\.(zip|json)$/i.test(f.name));
    if (list.length === 0) {
      setResult({ phones: 0, photos: 0, prices: 0, files: 0, failed: [{ name: files[0]?.name ?? 'file', error: 'Choose a .zip from the AetherPhone Saver' }] });
      return;
    }
    setBusy(`Saving ${list.length} file${list.length === 1 ? '' : 's'} to this device…`);
    setResult(null);
    try {
      setResult(await importFiles(list));
    } finally {
      setBusy(null);
      await reload();
    }
  }

  useEffect(() => {
    void reload();
    const onSaved = () => void reload();
    const onImport = (e: Event) => {
      pendingFiles = [];
      void runImport((e as CustomEvent<File[]>).detail);
    };
    window.addEventListener(SAVED_CHANGED, onSaved);
    window.addEventListener(IMPORT_EVENT, onImport);
    if (pendingFiles.length) {
      const waiting = pendingFiles;
      pendingFiles = [];
      void runImport(waiting);
    }
    return () => {
      window.removeEventListener(SAVED_CHANGED, onSaved);
      window.removeEventListener(IMPORT_EVENT, onImport);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    await runImport(Array.from(files));
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="library">
      <header className="page-head">
        <div>
          <p className="eyebrow">Offline library</p>
          <h1>Your saved phones</h1>
          <p className="muted">Phones saved with the browser extension live on this device. They open without internet.</p>
        </div>
      </header>

      <section
        className={`dropzone ${dragging ? 'over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void runImport(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="dropzone-icon"><Icon name="upload" size={28} /></div>
        <div className="dropzone-text">
          <strong>Add your ZIP to save every phone for offline use</strong>
          <span className="muted">Drop the <code>aetherphone-saved.zip</code> file here, or pick it. Phones, photos and PKR prices are all saved in one step.</span>
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
          <Icon name="upload" size={16} /> Choose ZIP
        </button>
        <input ref={fileRef} type="file" multiple accept=".zip,application/zip,.json,application/json" hidden onChange={(e) => void onPick(e.target.files)} />
      </section>

      {busy && <p className="notice" role="status"><span className="spinner" aria-hidden="true" />{busy}</p>}

      {result && (
        <div className={`notice ${result.failed.length && !result.phones ? 'error' : 'ok'}`} role="status">
          {result.phones > 0 || result.prices > 0 ? (
            <>
              <strong>Saved for offline use.</strong>{' '}
              {result.phones} phone{result.phones === 1 ? '' : 's'}, {result.photos} photo{result.photos === 1 ? '' : 's'}, {result.prices} price row{result.prices === 1 ? '' : 's'}.
            </>
          ) : (
            <strong>Nothing was saved.</strong>
          )}
          {result.failed.map((f) => (
            <div key={f.name} className="notice-line">{f.name}: {f.error}</div>
          ))}
        </div>
      )}

      <div className="stat-cards">
        <div className="stat-card"><span>Phones</span><strong>{phones.length}</strong></div>
        <div className="stat-card"><span>Photos</span><strong>{counts.photos}</strong></div>
        <div className="stat-card"><span>Price rows</span><strong>{counts.prices}</strong></div>
        <div className="stat-card"><span>On this device</span><strong>{storage === null ? '—' : formatMb(storage)}</strong></div>
      </div>

      {phones.length === 0 ? (
        <div className="empty">
          <p>No saved phones yet.</p>
          <p className="muted small">Install the AetherPhone Saver extension, browse GSMArena or PriceOye, then export the ZIP.</p>
        </div>
      ) : (
        <>
          <div className="library-bar">
            <h2>{phones.length} phone{phones.length === 1 ? '' : 's'}</h2>
            <button className="link-btn danger" onClick={async () => {
              if (confirm('Delete all saved phones, photos and prices from this device?')) await clearSavedPhones();
            }}>Delete all</button>
          </div>
          <ul className="saved-grid">
            {phones.map((d) => (
              <li key={d.id} className="saved-card">
                <button className="saved-open" onClick={() => onOpen(d.id)} aria-label={`Open ${d.brand} ${d.model}`}>
                  <DeviceImage device={d} />
                  <div>
                    <span className="eyebrow">{d.brand}{d.priceoye ? ' · PriceOye' : ''}</span>
                    <strong>{d.model}</strong>
                  </div>
                </button>
                <button className="icon-btn" aria-label={`Delete ${d.model}`} title="Delete from this device" onClick={async () => {
                  if (confirm(`Delete ${d.brand} ${d.model} from this device?`)) await deleteSavedPhone(d.id);
                }}>
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
