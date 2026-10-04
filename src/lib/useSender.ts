import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import {
  BUFFER_HIGH,
  BUFFER_LOW,
  CHUNK_SIZE,
  ID_PREFIX,
  type ControlMessage,
  type FileMeta,
  makeCode,
} from "./protocol";

export type ReceiverState = {
  id: string;
  label: string;
  status: "connecting" | "waiting" | "sending" | "done" | "declined" | "error" | "closed";
  sent: number;
  total: number;
  speed: number;
  error?: string;
};

type SenderStatus = "idle" | "starting" | "ready" | "error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useSender(displayName: string) {
  const [files, setFiles] = useState<File[]>([]);
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<SenderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [receivers, setReceivers] = useState<ReceiverState[]>([]);

  const peerRef = useRef<Peer | null>(null);
  const filesRef = useRef<File[]>([]);
  const nameRef = useRef(displayName);
  const cancelledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    nameRef.current = displayName;
  }, [displayName]);

  const patch = useCallback((id: string, next: Partial<ReceiverState>) => {
    setReceivers((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const list = Array.from(incoming);
    setFiles((prev) => {
      const merged = [...prev];
      for (const f of list) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size && m.lastModified === f.lastModified)) {
          merged.push(f);
        }
      }
      filesRef.current = merged;
      return merged;
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      filesRef.current = next;
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    peerRef.current?.destroy();
    peerRef.current = null;
    setCode(null);
    setReceivers([]);
    setStatus("idle");
  }, []);

  const reset = useCallback(() => {
    stop();
    setFiles([]);
    filesRef.current = [];
    setError(null);
  }, [stop]);

  const pump = useCallback(
    async (conn: DataConnection) => {
      const list = filesRef.current;
      const total = list.reduce((a, f) => a + f.size, 0);
      const dc: RTCDataChannel | undefined = (conn as unknown as { dataChannel?: RTCDataChannel }).dataChannel;
      let sent = 0;
      const startedAt = performance.now();
      let lastTick = startedAt;
      let lastSent = 0;

      patch(conn.peer, { status: "sending", total, sent: 0 });

      try {
        for (let i = 0; i < list.length; i++) {
          const file = list[i];
          conn.send({ t: "begin", i } satisfies ControlMessage);
          let offset = 0;
          while (offset < file.size) {
            if (cancelledRef.current.has(conn.peer) || !conn.open) return;
            // Back-pressure: never let the kernel buffer grow unbounded.
            if (dc && dc.bufferedAmount > BUFFER_HIGH) {
              while (dc.bufferedAmount > BUFFER_LOW && conn.open) await sleep(15);
            }
            const slice = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));
            const buffer = await slice.arrayBuffer();
            conn.send(buffer);
            offset += buffer.byteLength;
            sent += buffer.byteLength;

            const now = performance.now();
            if (now - lastTick > 250) {
              const speed = ((sent - lastSent) * 1000) / (now - lastTick);
              lastTick = now;
              lastSent = sent;
              patch(conn.peer, { sent, speed });
            }
          }
          conn.send({ t: "end", i } satisfies ControlMessage);
          // Let the queue breathe between files.
          await sleep(0);
        }
        conn.send({ t: "done" } satisfies ControlMessage);
        patch(conn.peer, { sent, status: "done", speed: 0 });
      } catch (e) {
        patch(conn.peer, { status: "error", error: (e as Error).message });
      }
    },
    [patch],
  );

  const attach = useCallback(
    (conn: DataConnection) => {
      const label = (conn.metadata as { name?: string } | undefined)?.name || "Someone";
      setReceivers((prev) => [
        ...prev.filter((r) => r.id !== conn.peer),
        { id: conn.peer, label, status: "connecting", sent: 0, total: 0, speed: 0 },
      ]);

      conn.on("open", () => {
        const list = filesRef.current;
        const meta: FileMeta[] = list.map((f) => ({ name: f.name, size: f.size, type: f.type }));
        conn.send({
          t: "manifest",
          files: meta,
          totalSize: meta.reduce((a, f) => a + f.size, 0),
          sender: nameRef.current,
        } satisfies ControlMessage);
        patch(conn.peer, { status: "waiting", total: meta.reduce((a, f) => a + f.size, 0) });
      });

      conn.on("data", (raw) => {
        const msg = raw as ControlMessage;
        if (!msg || typeof msg !== "object") return;
        if (msg.t === "accept") void pump(conn);
        if (msg.t === "decline") patch(conn.peer, { status: "declined" });
        if (msg.t === "cancel") {
          cancelledRef.current.add(conn.peer);
          patch(conn.peer, { status: "closed" });
        }
      });

      conn.on("close", () => {
        setReceivers((prev) =>
          prev.map((r) => (r.id === conn.peer && r.status !== "done" ? { ...r, status: "closed" } : r)),
        );
      });

      conn.on("error", (e) => patch(conn.peer, { status: "error", error: e.message }));
    },
    [patch, pump],
  );

  const start = useCallback(() => {
    if (!filesRef.current.length) return;
    setStatus("starting");
    setError(null);
    const newCode = makeCode();
    const peer = new Peer(ID_PREFIX + newCode, { debug: 0 });
    peerRef.current = peer;

    peer.on("open", () => {
      setCode(newCode);
      setStatus("ready");
    });
    peer.on("connection", attach);
    peer.on("error", (e) => {
      setError(e.message || "Connection error");
      setStatus("error");
    });
    peer.on("disconnected", () => {
      if (!peer.destroyed) peer.reconnect();
    });
  }, [attach]);

  useEffect(() => () => peerRef.current?.destroy(), []);

  return { files, addFiles, removeFile, code, status, error, receivers, start, stop, reset };
}
