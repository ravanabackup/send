import { useEffect, useMemo, useState } from "react";
import SendPanel from "@/components/SendPanel";
import ReceivePanel from "@/components/ReceivePanel";
import Tutorial from "@/components/Tutorial";
import { Card, Pill } from "@/components/ui";

const ADJ = ["Swift", "Cosmic", "Quiet", "Neon", "Lucky", "Turbo", "Velvet", "Solar"];
const NOUN = ["Otter", "Falcon", "Comet", "Pixel", "Badger", "Maple", "Orbit", "Koala"];

function useDisplayName() {
  const [name, setName] = useState(() => {
    const stored = localStorage.getItem("beamdrop.name");
    if (stored) return stored;
    const generated = `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${
      NOUN[Math.floor(Math.random() * NOUN.length)]
    }`;
    localStorage.setItem("beamdrop.name", generated);
    return generated;
  });
  useEffect(() => {
    localStorage.setItem("beamdrop.name", name);
  }, [name]);
  return [name, setName] as const;
}

const RESERVED = ["send", "receive", "how", "deploy", ""];

const FEATURES = [
  { icon: "♾️", title: "No size limit", text: "10 GB ISO? A 4K master? There is no upload step, so there is no cap." },
  { icon: "🔒", title: "End-to-end encrypted", text: "WebRTC data channels use DTLS by default. Only the two devices hold the keys." },
  { icon: "☁️", title: "Zero cloud storage", text: "Bytes stream disk-to-disk. Nothing is ever written to a server — not even temporarily." },
  { icon: "⚡", title: "Local-network fast", text: "On the same Wi-Fi the data takes the short path and flies at LAN speed." },
  { icon: "📱", title: "QR in one tap", text: "Scan with any phone camera. No app, no account, no sign-up, no email." },
  { icon: "🧾", title: "Free & open to host", text: "A single static HTML file you can drop on GitHub Pages in 60 seconds." },
];

const FAQ = [
  {
    q: "Is anything stored on a server?",
    a: "No. A signalling broker helps the two browsers discover each other (a few hundred bytes of connection info), then the file travels directly between devices over an encrypted WebRTC data channel.",
  },
  {
    q: "Why must the sender keep the tab open?",
    a: "Because the file lives on the sender's disk — the browser reads it in 64 KB slices while the transfer runs. Close the tab and the source disappears. That is exactly why nothing has to be stored online.",
  },
  {
    q: "What is the maximum file size?",
    a: "There is no artificial limit. In Chrome/Edge the receiver can stream straight to disk with the File System Access API, so even hundreds of gigabytes work. In other browsers the file is buffered in memory first, so stay within a few GB.",
  },
  {
    q: "Does it work across different networks?",
    a: "Yes — STUN handles most NATs, so phone-on-5G to laptop-on-Wi-Fi is fine. A tiny fraction of strict corporate/symmetric NATs need a TURN relay, which you can plug in yourself.",
  },
];

export default function App() {
  const [name, setName] = useDisplayName();
  const [hash, setHash] = useState(() => window.location.hash.replace(/^#/, ""));
  const [tab, setTab] = useState<"send" | "receive">("send");

  useEffect(() => {
    const onHash = () => setHash(window.location.hash.replace(/^#/, ""));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const incomingCode = useMemo(() => {
    const h = hash.trim().toLowerCase();
    return h && !RESERVED.includes(h) && /^[a-z0-9-]{4,40}$/.test(h) ? h : null;
  }, [hash]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-[32rem] w-[32rem] rounded-full bg-violet-600/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[34rem] w-[34rem] rounded-full bg-cyan-500/20 blur-[130px]" />
        <div className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] rounded-full bg-fuchsia-600/15 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 pb-24">
        {/* nav */}
        <header className="flex flex-wrap items-center justify-between gap-4 py-6">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xl shadow-lg shadow-violet-500/30">
              ⚡
            </div>
            <div>
              <div className="text-lg leading-tight font-extrabold tracking-tight text-white">BeamDrop</div>
              <div className="text-[11px] tracking-widest text-slate-400 uppercase">peer-to-peer file beam</div>
            </div>
          </a>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-slate-400 sm:inline">You are</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 24))}
              className="w-36 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white outline-none focus:border-cyan-300/50"
            />
          </div>
        </header>

        {incomingCode ? (
          <main className="pt-6">
            <div className="mb-6 text-center">
              <Pill tone="green">Incoming beam · {incomingCode}</Pill>
              <h1 className="mt-4 text-3xl font-extrabold text-white sm:text-4xl">Someone is sending you files</h1>
              <p className="mt-2 text-slate-400">
                Direct device-to-device. Keep this tab open until the transfer finishes.
              </p>
            </div>
            <ReceivePanel displayName={name} initialCode={incomingCode} />
            <p className="mt-6 text-center text-sm text-slate-500">
              <a href="#" onClick={() => setHash("")} className="underline hover:text-cyan-300">
                Send something back →
              </a>
            </p>
          </main>
        ) : (
          <main className="space-y-20">
            {/* hero */}
            <section className="pt-8 text-center">
              <Pill tone="green">● No uploads · No accounts · No limits</Pill>
              <h1 className="mt-5 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
                Share files straight
                <br />
                <span className="bg-gradient-to-r from-violet-400 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                  from your device
                </span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
                Send files of any size to anyone, anywhere — without ever storing anything online. Your browser
                opens an encrypted tunnel to theirs and the bytes flow disk to disk.
              </p>
            </section>

            {/* transfer widget */}
            <section>
              <div className="mx-auto mb-5 flex w-fit rounded-2xl border border-white/10 bg-white/5 p-1">
                {(["send", "receive"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
                      tab === t
                        ? "bg-gradient-to-r from-violet-500 to-cyan-400 text-slate-950"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {t === "send" ? "Send files" : "Receive files"}
                  </button>
                ))}
              </div>
              {tab === "send" ? (
                <SendPanel displayName={name} />
              ) : (
                <ReceivePanel displayName={name} />
              )}
            </section>

            {/* how it works */}
            <section>
              <div className="text-center">
                <Pill>How it works</Pill>
                <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Three steps, zero servers</h2>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  { n: "01", t: "Pick your files", d: "Drag them in. They stay on your disk — the browser only reads them while sending." },
                  { n: "02", t: "Share the link or QR", d: "A one-time code identifies your tab on the signalling broker. Text it, scan it, say it out loud." },
                  { n: "03", t: "Beam it over", d: "The moment they accept, an encrypted WebRTC channel opens and the file streams directly." },
                ].map((s) => (
                  <Card key={s.n}>
                    <div className="font-mono text-sm text-cyan-300">{s.n}</div>
                    <h3 className="mt-2 text-lg font-bold text-white">{s.t}</h3>
                    <p className="mt-1 text-sm text-slate-400">{s.d}</p>
                  </Card>
                ))}
              </div>
            </section>

            {/* features */}
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="transition hover:border-white/20 hover:bg-white/[0.07]">
                  <div className="text-2xl">{f.icon}</div>
                  <h3 className="mt-3 font-bold text-white">{f.title}</h3>
                  <p className="mt-1 text-sm text-slate-400">{f.text}</p>
                </Card>
              ))}
            </section>

            {/* tutorial */}
            <section id="deploy">
              <Tutorial />
            </section>

            {/* faq */}
            <section>
              <div className="text-center">
                <Pill>FAQ</Pill>
                <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Good questions</h2>
              </div>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {FAQ.map((f) => (
                  <Card key={f.q}>
                    <h3 className="font-bold text-white">{f.q}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.a}</p>
                  </Card>
                ))}
              </div>
            </section>
          </main>
        )}

        <footer className="mt-20 border-t border-white/10 pt-8 text-center text-sm text-slate-500">
          <p>
            BeamDrop · built with WebRTC + PeerJS · static-hosting friendly. Files never touch a server — if the
            tab closes, the beam closes.
          </p>
        </footer>
      </div>
    </div>
  );
}
