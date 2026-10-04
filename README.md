# ⚡ BeamDrop — ToffeeShare-style P2P file sharing (hostable on GitHub Pages)

Share files **directly from your device to anywhere**. Nothing is ever stored online, and there
is **no file size limit** — the bytes stream from the sender's disk to the receiver's disk over an
encrypted WebRTC data channel.

```
Sender browser  ──(tiny SDP/ICE handshake)──►  signalling broker  ◄──  Receiver browser
       │                                                                      ▲
       └──────────── encrypted WebRTC DataChannel (the actual file) ──────────┘
```

The broker only introduces the two tabs to each other. **No file byte ever passes through a server.**

---

## ✨ Features

| | |
|---|---|
| ♾️ **No size limit** | There's no upload step, so there's no cap. Chrome/Edge receivers stream straight to disk via the File System Access API. |
| 🔒 **End-to-end encrypted** | WebRTC data channels are DTLS-encrypted by spec. |
| ☁️ **Zero storage** | Nothing is written to any server — not even temporarily. |
| 📱 **QR + short code** | Scan with any phone camera, or dictate a 7-character code. |
| 🗂️ **Multi-file & folders** | Drop a whole folder; files are sent sequentially with live progress. |
| 📈 **Live progress** | Speed, ETA, per-receiver status (multiple receivers supported). |
| 🧾 **Static site** | Builds to a *single* `dist/index.html` — perfect for GitHub Pages. |

---

## 🚀 Quick start (local)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/index.html  (everything inlined, one file)
npm run preview  # serve the production build locally
```

Open the app in two browser windows (or your laptop + phone) to test a real transfer.

---

## 🌍 Full tutorial: hosting on GitHub Pages

### Step 0 — What you need

* A GitHub account
* Node.js 18+ (only to build; GitHub can build for you too)
* That's it. No server, no database, no paid plan.

### Step 1 — Build the site

```bash
npm install
npm run build
```

You get `dist/index.html`: HTML, CSS and JS all inlined into **one** file (thanks to
`vite-plugin-singlefile`). That's the entire website.

> Don't want a single file? Delete `viteSingleFile()` from `vite.config.ts` — you'll then get a
> normal `dist/` with `assets/`; everything below still works.

### Step 2 — Set the base path (important for project pages)

A GitHub *project* page is served from `https://<user>.github.io/<repo>/`, a sub-folder. Tell Vite
to emit relative URLs by adding `base: "./"` to `vite.config.ts`:

```ts
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
});
```

(Not needed if you use a `<user>.github.io` user page or the single-file build, but it never hurts.)

### Step 3 — Create the repository and push

```bash
git init
git add .
git commit -m "BeamDrop: P2P file sharing"
git branch -M main
git remote add origin https://github.com/<your-user>/beamdrop.git
git push -u origin main
```

### Step 4 — Turn on GitHub Pages

Pick **one** of the two options.

#### Option A — Drag & drop (fastest, 1 minute)

1. Create a new repo (e.g. `beamdrop`).
2. Click **Add file → Upload files** and drop your built `dist/index.html` in the repo root.
3. Also create an empty file named `.nojekyll` (stops Jekyll from eating `_`-prefixed folders).
4. **Settings → Pages → Build and deployment → Source:** *Deploy from a branch* →
   branch `main`, folder `/ (root)` → **Save**.
5. Wait ~60 s. Your site is live at `https://<user>.github.io/<repo>/`.

#### Option B — Automatic build on every push (recommended)

1. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

2. **Settings → Pages → Source: GitHub Actions**.
3. `git push` → the Actions tab shows the build → site deploys automatically.

### Step 5 — Test a real transfer

1. Open `https://<user>.github.io/<repo>/` on your computer (HTTPS is required for WebRTC — Pages
   gives you that for free).
2. Drop a big file, click **Create share link**.
3. Scan the QR code with your phone (mobile data is fine — it doesn't need the same Wi-Fi).
4. Tap **Accept & download** and watch the progress bar.

### Step 6 — Custom domain (optional)

Add a file named `CNAME` in the repo root containing `share.example.com`, then point a CNAME DNS
record at `<user>.github.io`. Enable **Enforce HTTPS** in Settings → Pages.

---

## 🛠️ Going production-grade (optional)

### Run your own signalling server

By default the app uses the free public **PeerJS Cloud** broker. To control it yourself:

```bash
npm i -g peer
peerjs --port 9000 --key peerjs --path /myapp
```

Then in `src/lib/useSender.ts` / `src/lib/useReceiver.ts`:

```ts
new Peer(id, { host: "signal.example.com", port: 443, secure: true, path: "/myapp" });
```

### Add a TURN server (for strict/symmetric NATs)

STUN (default) covers ~85–90% of networks. For the rest, relay through TURN:

```ts
new Peer(id, {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "turn:turn.example.com:3478", username: "user", credential: "pass" },
    ],
  },
});
```

(Self-host [coturn](https://github.com/coturn/coturn), or use a hosted TURN provider.)

---

## 🧠 How the code works

```
src/
├── lib/protocol.ts     # wire format, chunk sizes, byte/speed formatters
├── lib/useSender.ts    # creates the Peer, serves the manifest, pumps 64 KB slices with back-pressure
├── lib/useReceiver.ts  # connects, picks a save destination, writes chunks as they land
├── components/         # SendPanel (QR + link + progress), ReceivePanel, Tutorial, UI primitives
└── App.tsx             # landing page, hash routing (`#<code>` = incoming beam)
```

**Protocol** (one data channel, control objects + raw ArrayBuffers):

| Message | Direction | Meaning |
|---|---|---|
| `{t:"manifest", files, totalSize, sender}` | S → R | what's on offer |
| `{t:"accept"}` / `{t:"decline"}` | R → S | receiver's answer |
| `{t:"begin", i}` | S → R | next file starts |
| *(raw ArrayBuffer)* | S → R | a 64 KB slice |
| `{t:"end", i}` | S → R | close the current file |
| `{t:"done"}` | S → R | all files delivered |
| `{t:"cancel"}` | both | abort |

**Back-pressure:** the sender pauses slicing whenever `RTCDataChannel.bufferedAmount` exceeds 4 MB
and resumes under 1 MB — that's what keeps memory flat for a 50 GB file.

**Saving:** if the browser supports `showSaveFilePicker` / `showDirectoryPicker`, chunks are written
to disk as they arrive (truly unlimited). Otherwise they're buffered into a `Blob` and downloaded at
the end (keep it to a few GB).

---

## ⚠️ Limits & caveats

* The **sender's tab must stay open** — the file is read live from their disk.
* Streaming-to-disk needs Chrome/Edge/Opera (File System Access API). Firefox/Safari fall back to
  in-memory buffering.
* Mobile browsers may throttle background tabs; keep the screen on for huge transfers.
* A few very strict networks need TURN (see above).

## 📄 License

MIT — do whatever you like.
