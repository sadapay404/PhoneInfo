import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { Device } from '../data/types';
import { clearSavedPhones, deleteSavedPhone, importFiles, loadSavedPhones, SAVED_CHANGED, type ImportSummary } from '../data/savedPhones';
import { Button, Empty, Icon, PageHead, Photo, Stat } from './parts';
import { navigate } from './state';

interface Report extends ImportSummary {
  files: number;
  failed: { name: string; error: string }[];
}

function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function LibraryPage() {
  const [phones, setPhones] = useState<Device[] | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [usage, setUsage] = useState<number | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reload = () => {
    loadSavedPhones()
      .then((list) => setPhones([...list].sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model))))
      .catch(() => setPhones([]));
    navigator.storage?.estimate?.().then((e) => setUsage(e.usage ?? null)).catch(() => setUsage(null));
  };

  useEffect(() => {
    reload();
    window.addEventListener(SAVED_CHANGED, reload);
    return () => window.removeEventListener(SAVED_CHANGED, reload);
  }, []);

  const runImport = async (files: File[]) => {
    const zips = files.filter((f) => /\.(zip|json)$/i.test(f.name));
    if (zips.length === 0) {
      setReport({ phones: 0, photos: 0, prices: 0, files: 0, failed: [{ name: files[0]?.name ?? 'file', error: 'Choose a .zip from the AetherPhone extension' }] });
      return;
    }
    setBusy(true);
    setReport(null);
    try {
      setReport(await importFiles(zips));
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void runImport(Array.from(e.dataTransfer.files));
  };

  const remove = async (id: string) => {
    await deleteSavedPhone(id);
  };

  const removeAll = async () => {
    await clearSavedPhones();
    setConfirmAll(false);
  };

  return (
    <>
      <PageHead title="Library" lead="Add ZIP files from the AetherPhone extension. Phones, photos and prices are kept on this device for offline use." />

      <div
        className={`dropzone ${dragging ? 'is-dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={32} />
        <h2>{busy ? 'Saving to this device…' : 'Drop ZIP files here'}</h2>
        <p className="muted">You can select several at once. Each one is saved in full.</p>
        <Button variant="primary" onClick={() => input.current?.click()} disabled={busy}>
          Choose ZIP files
        </Button>
        <input
          ref={input}
          type="file"
          accept=".zip,.json,application/zip"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void runImport(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {report && (
        <div className={`report ${report.failed.length ? 'has-issue' : ''}`} role="status">
          <strong>
            {report.files > 0 ? `Saved ${report.files} file${report.files === 1 ? '' : 's'}` : 'Nothing was saved'}
          </strong>
          <span>
            {report.phones} phones · {report.photos} photos · {report.prices} prices
          </span>
          {report.failed.map((f) => (
            <span key={f.name} className="error">
              {f.name}: {f.error}
            </span>
          ))}
        </div>
      )}

      <section className="stats stats-wide" aria-label="Library summary">
        <Stat label="Saved phones" value={phones?.length ?? '—'} />
        <Stat label="Storage used" value={usage === null ? '—' : formatBytes(usage)} sub="By this site in this browser" />
      </section>

      <section className="block">
        <div className="block-head">
          <h2>Saved phones</h2>
          {phones && phones.length > 0 && (
            confirmAll ? (
              <span className="confirm">
                Remove all saved phones?
                <Button variant="danger" small onClick={removeAll}>
                  Yes, remove all
                </Button>
                <Button small onClick={() => setConfirmAll(false)}>
                  Cancel
                </Button>
              </span>
            ) : (
              <Button small variant="quiet" onClick={() => setConfirmAll(true)}>
                <Icon name="trash" size={16} /> Remove all
              </Button>
            )
          )}
        </div>

        {phones === null ? (
          <p className="muted">Loading…</p>
        ) : phones.length === 0 ? (
          <Empty title="No saved phones yet">
            <p>Save phones in the browser extension, export the ZIP, then add it here.</p>
          </Empty>
        ) : (
          <ul className="saved-list">
            {phones.map((d) => (
              <li key={d.id} className="saved-item">
                <Photo device={d} className="saved-photo" />
                <div className="saved-meta">
                  <strong>{d.model}</strong>
                  <span className="muted">
                    {d.brand}
                    {d.gallery?.photo_count ? ` · ${d.gallery.photo_count} photos` : ''}
                  </span>
                </div>
                <div className="saved-actions">
                  <Button small onClick={() => navigate(`phone/${encodeURIComponent(d.id)}`)}>
                    Open
                  </Button>
                  <Button small variant="quiet" onClick={() => void remove(d.id)} aria-label={`Remove ${d.model}`}>
                    <Icon name="trash" size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
