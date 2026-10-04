import { useState } from "react";
import { Card, Code, Pill } from "@/components/ui";

const workflow = `name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

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
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4`;

const viteConfig = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // "./" makes every asset path relative, so the site works at
  // https://<user>.github.io/<repo>/ without any extra config.
  base: "./",
  plugins: [react(), tailwindcss()],
});`;

const peerServer = `# Run your own signalling server (optional, ~5 MB of RAM)
npm i -g peer
peerjs --port 9000 --key peerjs --path /myapp

# Then point the app at it:
# new Peer(id, { host: "signal.example.com", port: 443, secure: true, path: "/myapp" })`;

const steps = [
  {
    title: "1 · Get the built site",
    body: (
      <>
        <p>
          This project builds into a <strong>single self-contained</strong> <code className="text-cyan-200">dist/index.html</code>{" "}
          (HTML + CSS + JS inlined). That is the only file GitHub Pages needs.
        </p>
        <Code>{`npm install\nnpm run build   # → dist/index.html`}</Code>
        <p className="text-slate-400">
          Prefer multi-file output? Remove <code className="text-cyan-200">vite-plugin-singlefile</code> from{" "}
          <code className="text-cyan-200">vite.config.ts</code> — everything below still works.
        </p>
      </>
    ),
  },
  {
    title: "2 · Create the GitHub repository",
    body: (
      <>
        <p>
          Make a new public repo, e.g. <code className="text-cyan-200">beamdrop</code>, then push your code:
        </p>
        <Code>{`git init
git add .
git commit -m "BeamDrop: P2P file sharing"
git branch -M main
git remote add origin https://github.com/<your-user>/beamdrop.git
git push -u origin main`}</Code>
      </>
    ),
  },
  {
    title: "3 · Fix the base path",
    body: (
      <>
        <p>
          Project pages live under a sub-path (<code className="text-cyan-200">/beamdrop/</code>), so set a relative
          base in <code className="text-cyan-200">vite.config.ts</code>:
        </p>
        <Code>{viteConfig}</Code>
      </>
    ),
  },
  {
    title: "4a · Deploy — the one-minute way",
    body: (
      <>
        <p>
          Create a repo containing just your built <code className="text-cyan-200">index.html</code> (drag &amp; drop
          it into the GitHub web UI), then open{" "}
          <strong>Settings → Pages → Build and deployment → Source: Deploy from a branch</strong>, pick{" "}
          <code className="text-cyan-200">main</code> + <code className="text-cyan-200">/ (root)</code> and save.
        </p>
        <p className="text-slate-400">
          Your site goes live at <code className="text-cyan-200">https://&lt;user&gt;.github.io/&lt;repo&gt;/</code>{" "}
          within a minute. Add an empty <code className="text-cyan-200">.nojekyll</code> file so GitHub serves
          folders starting with an underscore.
        </p>
      </>
    ),
  },
  {
    title: "4b · Deploy — automatic on every push",
    body: (
      <>
        <p>
          Add <code className="text-cyan-200">.github/workflows/deploy.yml</code>, then set{" "}
          <strong>Settings → Pages → Source: GitHub Actions</strong>. Every push to <code className="text-cyan-200">main</code>{" "}
          rebuilds and redeploys.
        </p>
        <Code>{workflow}</Code>
      </>
    ),
  },
  {
    title: "5 · Check it works",
    body: (
      <>
        <ul className="list-disc space-y-1 pl-5 text-slate-300">
          <li>Pages is served over HTTPS — mandatory for WebRTC and the File System Access API. ✅</li>
          <li>Open the site on your laptop, pick a file, hit “Create share link”.</li>
          <li>Scan the QR code with your phone (mobile data works too, not just same Wi-Fi).</li>
          <li>Accept on the phone, watch the bytes fly — nothing touched a server.</li>
        </ul>
      </>
    ),
  },
  {
    title: "6 · Optional: own your signalling",
    body: (
      <>
        <p>
          By default the app uses the free public PeerJS cloud broker. It only exchanges tiny “here's how to reach
          me” messages (SDP/ICE) — <strong>no file bytes ever pass through it</strong>. For full control or heavy
          use, run your own, or add a TURN server so transfers also work behind strict corporate/symmetric NATs.
        </p>
        <Code>{peerServer}</Code>
      </>
    ),
  },
];

export default function Tutorial() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="space-y-4">
      <div className="text-center">
        <Pill>Deployment guide</Pill>
        <h2 className="mt-4 text-3xl font-bold text-white sm:text-4xl">Host it yourself on GitHub Pages</h2>
        <p className="mx-auto mt-2 max-w-2xl text-slate-400">
          BeamDrop is 100% static — no backend, no database, no storage bill. Six steps and it's yours.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((s, i) => (
          <Card key={s.title} className="p-0">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
            >
              <span className="font-semibold text-white">{s.title}</span>
              <span className={`text-slate-400 transition-transform ${open === i ? "rotate-45" : ""}`}>✚</span>
            </button>
            {open === i && (
              <div className="space-y-3 border-t border-white/10 px-6 py-5 text-sm leading-relaxed text-slate-300">
                {s.body}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
