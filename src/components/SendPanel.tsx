import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { useSender } from "@/lib/useSender";
import { fileIcon, formatBytes, formatSpeed, formatEta, shareUrlFor } from "@/lib/protocol";
import { Button, Card, CopyButton, Pill, Progress } from "@/components/ui";

export default function SendPanel({ displayName }: { displayName: string }) {
  const { files, addFiles, removeFile, code, status, error, receivers, start, reset } = useSender(displayName);
  const [dragging, setDragging] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((a, f) => a + f.size, 0);
  const shareUrl = code ? shareUrlFor(code) : "";

  useEffect(() => {
    if (!shareUrl) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(shareUrl, {
      margin: 1,
      width: 420,
      color: { dark: "#0b1120", light: "#ffffff" },
    }).then(setQr, () => setQr(null));
  }, [shareUrl]);

  if (code && status === "ready") {
    return (
      <Card>
        <div className="grid gap-8 md:grid-cols-[auto_1fr]">
          <div className="mx-auto w-full max-w-[240px]">
            {qr ? (
              <img src={qr} alt="Scan to receive" className="w-full rounded-2xl ring-4 ring-white/20" />
            ) : (
              <div className="aspect-square w-full animate-pulse rounded-2xl bg-white/10" />
            )}
            <p className="mt-3 text-center text-xs text-slate-400">Scan with any phone camera</p>
          </div>

          <div className="space-y-5">
            <div>
              <Pill tone="green">● Live — keep this tab open</Pill>
              <h3 className="mt-3 text-2xl font-bold text-white">Your beam is ready</h3>
              <p className="text-sm text-slate-400">
                {files.length} file{files.length > 1 ? "s" : ""} · {formatBytes(totalSize)} · sent peer-to-peer,
                never uploaded.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-400 uppercase">Share link</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 font-mono text-sm text-cyan-200 outline-none"
                />
                <CopyButton text={shareUrl} label="Copy link" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
                Or dictate this code
              </label>
              <div className="mt-2 flex items-center gap-3">
                <span className="rounded-xl bg-gradient-to-r from-violet-500/20 to-cyan-400/20 px-5 py-2.5 font-mono text-2xl tracking-[0.3em] text-white">
                  {code}
                </span>
                <CopyButton text={code} label="Copy code" />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-300">
                Receivers {receivers.length > 0 && `(${receivers.length})`}
              </h4>
              {receivers.length === 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-5 text-sm text-slate-400">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
                  </span>
                  Waiting for someone to open the link…
                </div>
              )}
              {receivers.map((r) => {
                const pct = r.total ? (r.sent / r.total) * 100 : 0;
                const eta = r.speed > 0 ? (r.total - r.sent) / r.speed : Infinity;
                return (
                  <div key={r.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-white">{r.label}</span>
                      {r.status === "waiting" && <Pill tone="amber">Awaiting accept</Pill>}
                      {r.status === "sending" && <Pill tone="green">{formatSpeed(r.speed)}</Pill>}
                      {r.status === "done" && <Pill tone="green">✓ Delivered</Pill>}
                      {r.status === "declined" && <Pill tone="rose">Declined</Pill>}
                      {r.status === "closed" && <Pill tone="rose">Disconnected</Pill>}
                      {r.status === "error" && <Pill tone="rose">Error</Pill>}
                      {r.status === "connecting" && <Pill>Connecting…</Pill>}
                    </div>
                    {(r.status === "sending" || r.status === "done") && (
                      <>
                        <Progress value={r.status === "done" ? 100 : pct} className="mt-3" />
                        <div className="mt-2 flex justify-between text-xs text-slate-400">
                          <span>
                            {formatBytes(r.sent)} / {formatBytes(r.total)}
                          </span>
                          <span>{r.status === "done" ? "Complete" : `ETA ${formatEta(eta)}`}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button variant="danger" onClick={reset}>
                Stop sharing
              </Button>
              <Button variant="ghost" onClick={() => window.open(shareUrl, "_blank")}>
                Test link in new tab ↗
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-3xl border-2 border-dashed p-10 text-center transition-colors ${
          dragging ? "border-cyan-300 bg-cyan-400/10" : "border-white/15 bg-white/[0.02]"
        }`}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 text-3xl shadow-lg shadow-violet-500/30">
          🚀
        </div>
        <h3 className="text-xl font-bold text-white">Drop files here</h3>
        <p className="mt-1 text-sm text-slate-400">
          Any size. Any type. They never leave your device until a receiver connects.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Button onClick={() => fileInput.current?.click()}>Choose files</Button>
          <Button variant="soft" onClick={() => folderInput.current?.click()}>
            Choose a folder
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
        <input
          ref={folderInput}
          type="file"
          hidden
          /* @ts-expect-error non-standard but widely supported */
          webkitdirectory=""
          directory=""
          multiple
          onChange={(e) => e.target.files && addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span className="font-semibold">
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </span>
            <span className="text-slate-400">{formatBytes(totalSize)} total</span>
          </div>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                <span className="text-lg">{fileIcon({ name: f.name, size: f.size, type: f.type })}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                <span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
                <button
                  onClick={() => removeFile(i)}
                  className="rounded-lg px-2 text-slate-500 transition hover:text-rose-300"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="pt-3">
            <Button className="w-full py-3 text-base" onClick={start} disabled={status === "starting"}>
              {status === "starting" ? "Opening secure channel…" : "Create share link →"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>
      )}
    </Card>
  );
}
