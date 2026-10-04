/**
 * BeamDrop wire protocol
 * ----------------------
 * Everything travels over a single WebRTC DataChannel (via PeerJS).
 * Control messages are plain objects, file payloads are raw ArrayBuffers.
 * Nothing is ever uploaded to a server — the signalling server only helps
 * the two browsers find each other, then it is out of the loop.
 */

export type FileMeta = {
  name: string;
  size: number;
  type: string;
};

export type ControlMessage =
  | { t: "manifest"; files: FileMeta[]; totalSize: number; sender: string }
  | { t: "accept" }
  | { t: "decline" }
  | { t: "begin"; i: number }
  | { t: "end"; i: number }
  | { t: "done" }
  | { t: "ack"; bytes: number }
  | { t: "cancel"; reason?: string };

/** 64 KiB payload slices — a good balance of throughput vs. latency. */
export const CHUNK_SIZE = 64 * 1024;
/** Pause slicing when the channel has this much data still queued. */
export const BUFFER_HIGH = 4 * 1024 * 1024;
export const BUFFER_LOW = 1 * 1024 * 1024;

export const ID_PREFIX = "beamdrop-";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeCode(len = 7): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function toUint8(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

export function shareUrlFor(code: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${code}`;
}

export function fileIcon(meta: FileMeta): string {
  const n = meta.name.toLowerCase();
  const t = meta.type || "";
  if (t.startsWith("image/")) return "🖼️";
  if (t.startsWith("video/")) return "🎬";
  if (t.startsWith("audio/")) return "🎵";
  if (t.includes("pdf") || n.endsWith(".pdf")) return "📕";
  if (/\.(zip|rar|7z|tar|gz|xz)$/.test(n)) return "🗜️";
  if (/\.(exe|dmg|apk|msi|iso|deb|appimage)$/.test(n)) return "💿";
  if (/\.(doc|docx|odt|rtf|txt|md)$/.test(n)) return "📄";
  if (/\.(xls|xlsx|csv|ods)$/.test(n)) return "📊";
  if (/\.(js|ts|tsx|jsx|py|java|c|cpp|rs|go|html|css|json)$/.test(n)) return "🧩";
  return "📦";
}
