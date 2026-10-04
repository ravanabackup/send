import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { ID_PREFIX, toUint8, type ControlMessage, type FileMeta } from "./protocol";

export type ReceiverStatus =
  | "idle"
  | "connecting"
  | "offered"
  | "receiving"
  | "done"
  | "declined"
  | "error"
  | "closed";

type Sink = {
  write: (chunk: Uint8Array) => Promise<void> | void;
  close: () => Promise<void> | void;
};

type AnyWindow = Window & {
  showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
  showDirectoryPicker?: (opts?: unknown) => Promise<FileSystemDirectoryHandle>;
};

export const diskSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof (window as AnyWindow).showSaveFilePicker === "function" &&
  typeof (window as AnyWindow).showDirectoryPicker === "function";

function memorySink(meta: FileMeta, onFile: (name: string, url: string) => void): Sink {
  const parts: BlobPart[] = [];
  return {
    write: (chunk) => {
      parts.push(chunk.slice().buffer as ArrayBuffer);
    },
    close: () => {
      const blob = new Blob(parts, { type: meta.type || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      parts.length = 0;
      const a = document.createElement("a");
      a.href = url;
      a.download = meta.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      onFile(meta.name, url);
    },
  };
}

export function useReceiver(displayName: string) {
  const [status, setStatus] = useState<ReceiverStatus>("idle");
  const [senderName, setSenderName] = useState("Someone");
  const [manifest, setManifest] = useState<FileMeta[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  const [received, setReceived] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [savedTo, setSavedTo] = useState<"disk" | "memory" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const sinkRef = useRef<Sink | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const receivedRef = useRef(0);
  const manifestRef = useRef<FileMeta[]>([]);
  const modeRef = useRef<"disk" | "memory">("memory");
  const fileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const dirHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const tickRef = useRef({ time: 0, bytes: 0 });

  const connect = useCallback(
    (code: string) => {
      const clean = code.trim().toLowerCase().replace(ID_PREFIX, "");
      if (!clean) return;
      setStatus("connecting");
      setError(null);
      const peer = new Peer({ debug: 0 });
      peerRef.current = peer;

      peer.on("open", () => {
        const conn = peer.connect(ID_PREFIX + clean, {
          reliable: true,
          metadata: { name: displayName },
        });
        connRef.current = conn;

        conn.on("data", (raw) => {
          const bin = toUint8(raw);
          if (bin) {
            const sink = sinkRef.current;
            receivedRef.current += bin.byteLength;
            if (sink) chainRef.current = chainRef.current.then(() => sink.write(bin));
            const now = performance.now();
            const tick = tickRef.current;
            if (now - tick.time > 250) {
              setSpeed(((receivedRef.current - tick.bytes) * 1000) / (now - tick.time));
              tickRef.current = { time: now, bytes: receivedRef.current };
              setReceived(receivedRef.current);
            }
            return;
          }
          const msg = raw as ControlMessage;
          if (!msg || typeof msg !== "object") return;

          if (msg.t === "manifest") {
            manifestRef.current = msg.files;
            setManifest(msg.files);
            setTotalSize(msg.totalSize);
            setSenderName(msg.sender || "Someone");
            setStatus("offered");
          }

          if (msg.t === "begin") {
            setCurrentIndex(msg.i);
            const meta = manifestRef.current[msg.i];
            chainRef.current = chainRef.current.then(async () => {
              if (modeRef.current === "disk") {
                try {
                  let handle = fileHandleRef.current;
                  if (dirHandleRef.current) {
                    handle = await dirHandleRef.current.getFileHandle(
                      meta.name.replace(/[/\\]/g, "_"),
                      { create: true },
                    );
                  }
                  if (handle) {
                    const writable = await handle.createWritable();
                    sinkRef.current = {
                      write: (c) => writable.write(c as unknown as BufferSource),
                      close: () => writable.close(),
                    };
                    return;
                  }
                } catch (e) {
                  setError(`Disk write failed, buffering in memory instead (${(e as Error).message})`);
                }
              }
              sinkRef.current = memorySink(meta, () => undefined);
            });
          }

          if (msg.t === "end") {
            const sink = sinkRef.current;
            sinkRef.current = null;
            chainRef.current = chainRef.current.then(async () => {
              await sink?.close();
            });
          }

          if (msg.t === "done") {
            chainRef.current = chainRef.current.then(() => {
              setReceived(receivedRef.current);
              setSpeed(0);
              setStatus("done");
            });
          }

          if (msg.t === "cancel") setStatus("closed");
        });

        conn.on("close", () => {
          setStatus((s) => (s === "done" ? s : "closed"));
        });
        conn.on("error", (e) => {
          setError(e.message);
          setStatus("error");
        });
      });

      peer.on("error", (e) => {
        const msg = /could not connect to peer|peer-unavailable/i.test(e.message)
          ? "This link has expired or the sender closed the tab. Ask for a fresh link."
          : e.message;
        setError(msg);
        setStatus("error");
      });
    },
    [displayName],
  );

  const accept = useCallback(
    async (preferDisk: boolean) => {
      const conn = connRef.current;
      if (!conn) return;
      const w = window as AnyWindow;
      modeRef.current = "memory";
      fileHandleRef.current = null;
      dirHandleRef.current = null;

      if (preferDisk && diskSupported()) {
        try {
          if (manifestRef.current.length === 1) {
            fileHandleRef.current = await w.showSaveFilePicker!({
              suggestedName: manifestRef.current[0].name,
            });
          } else {
            dirHandleRef.current = await w.showDirectoryPicker!({ mode: "readwrite" });
          }
          modeRef.current = "disk";
        } catch {
          return; // user cancelled the picker — stay on the offer screen
        }
      }

      setSavedTo(modeRef.current);
      receivedRef.current = 0;
      tickRef.current = { time: performance.now(), bytes: 0 };
      setReceived(0);
      setStatus("receiving");
      conn.send({ t: "accept" } satisfies ControlMessage);
    },
    [],
  );

  const decline = useCallback(() => {
    connRef.current?.send({ t: "decline" } satisfies ControlMessage);
    setStatus("declined");
    peerRef.current?.destroy();
  }, []);

  const cancel = useCallback(() => {
    connRef.current?.send({ t: "cancel" } satisfies ControlMessage);
    peerRef.current?.destroy();
    setStatus("closed");
  }, []);

  useEffect(() => () => peerRef.current?.destroy(), []);

  return {
    status,
    senderName,
    manifest,
    totalSize,
    received,
    speed,
    currentIndex,
    savedTo,
    error,
    connect,
    accept,
    decline,
    cancel,
  };
}
