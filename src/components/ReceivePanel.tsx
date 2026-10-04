import { useEffect, useState } from "react";
import { useReceiver, diskSupported } from "@/lib/useReceiver";
import { fileIcon, formatBytes, formatEta, formatSpeed } from "@/lib/protocol";
import { Button, Card, Pill, Progress } from "@/components/ui";

export default function ReceivePanel({
  displayName,
  initialCode,
}: {
  displayName: string;
  initialCode?: string;
}) {
  const r = useReceiver(displayName);
  const [input, setInput] = useState(initialCode ?? "");
  const [preferDisk, setPreferDisk] = useState(diskSupported());

  useEffect(() => {
    if (initialCode) r.connect(initialCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);

  const pct = r.totalSize ? (r.received / r.totalSize) * 100 : 0;
  const eta = r.speed > 0 ? (r.totalSize - r.received) / r.speed : Infinity;

  if (r.status === "idle") {
    return (
      <Card>
        <h3 className="text-xl font-bold text-white">Receive a beam</h3>
        <p className="mt-1 text-sm text-slate-400">
          Paste the link you were given, or type the short code from the sender's screen.
        </p>
        <form
          className="mt-5 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const code = input.includes("#") ? input.split("#").pop()! : input;
            if (code.trim()) r.connect(code);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. k7m2xqp"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 font-mono tracking-[0.2em] text-white placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
          />
          <Button type="submit" disabled={!input.trim()}>
            Connect
          </Button>
        </form>
        <p className="mt-4 text-xs text-slate-500">
          Tip: the sender's tab must stay open — the file streams straight from their disk to yours.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {r.status === "connecting" && (
        <div className="py-10 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-3 border-white/15 border-t-cyan-300" />
          <p className="mt-5 font-semibold text-white">Punching through the network…</p>
          <p className="text-sm text-slate-400">Negotiating a direct connection with the sender.</p>
        </div>
      )}

      {(r.status === "offered" || r.status === "receiving" || r.status === "done") && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-white">
                {r.status === "done" ? "Transfer complete 🎉" : `${r.senderName} wants to send you files`}
              </h3>
              <p className="text-sm text-slate-400">
                {r.manifest.length} item{r.manifest.length > 1 ? "s" : ""} · {formatBytes(r.totalSize)}
              </p>
            </div>
            {r.status === "receiving" && <Pill tone="green">{formatSpeed(r.speed)}</Pill>}
            {r.status === "done" && <Pill tone="green">✓ {formatBytes(r.received)} received</Pill>}
          </div>

          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {r.manifest.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  r.status === "receiving" && i === r.currentIndex
                    ? "border-cyan-300/40 bg-cyan-400/10"
                    : "border-white/10 bg-white/[0.03]"
                }`}
              >
                <span className="text-lg">{fileIcon(f)}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-white">{f.name}</span>
                <span className="text-xs text-slate-400">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>

          {r.status === "offered" && (
            <>
              {diskSupported() && (
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <input
                    type="checkbox"
                    checked={preferDisk}
                    onChange={(e) => setPreferDisk(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-cyan-400"
                  />
                  <span className="text-sm text-slate-300">
                    <strong className="text-white">Stream straight to disk</strong> — pick where to save and the
                    data is written as it arrives. Required for files larger than your available RAM.
                  </span>
                </label>
              )}
              <div className="flex flex-wrap gap-3">
                <Button className="flex-1" onClick={() => void r.accept(preferDisk)}>
                  Accept & download
                </Button>
                <Button variant="danger" onClick={r.decline}>
                  Decline
                </Button>
              </div>
            </>
          )}

          {(r.status === "receiving" || r.status === "done") && (
            <>
              <Progress value={r.status === "done" ? 100 : pct} />
              <div className="flex justify-between text-xs text-slate-400">
                <span>
                  {formatBytes(r.received)} / {formatBytes(r.totalSize)} ({Math.floor(pct)}%)
                </span>
                <span>{r.status === "done" ? "Done" : `ETA ${formatEta(eta)}`}</span>
              </div>
              {r.status === "receiving" && (
                <Button variant="ghost" onClick={r.cancel}>
                  Cancel transfer
                </Button>
              )}
              {r.status === "done" && (
                <p className="text-sm text-emerald-200">
                  {r.savedTo === "disk"
                    ? "Saved directly to the location you picked."
                    : "Check your browser's Downloads folder."}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {(r.status === "error" || r.status === "closed" || r.status === "declined") && (
        <div className="py-8 text-center">
          <div className="text-4xl">{r.status === "declined" ? "🙅" : "🔌"}</div>
          <p className="mt-3 font-semibold text-white">
            {r.status === "declined" ? "Transfer declined" : "Connection closed"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            {r.error ?? "The sender's tab may have been closed, or the transfer finished early."}
          </p>
          <div className="mt-5 flex justify-center">
            <Button variant="soft" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        </div>
      )}

      {r.error && r.status === "receiving" && (
        <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          {r.error}
        </p>
      )}
    </Card>
  );
}
