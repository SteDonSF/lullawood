# CLAUDE.md — Lullawood

Project rules Claude must always follow. Read this before any deploy or build-related work.

## Deployment — Wrangler-direct ONLY

Deploy with this two-step command, run from the repo root:

```
npx @cloudflare/next-on-pages && npx wrangler pages deploy .vercel/output/static --project-name=lullawood
```

- **NEVER** rely on the Cloudflare git-integration build (the "Connect to Git" auto-build that runs on push). It is **broken** for this project. Despite what `DEPLOY.md` Step 3 describes, do not deploy that way.
- Deployment is always Wrangler-direct from the local build output.

## Build — always build clean before deploying

- Always run **both** `next build` (`npm run build`) **and** `@cloudflare/next-on-pages` (`npm run cf:build`) before deploying.
- Confirm a **clean build** (no errors) before running `wrangler pages deploy`. Never deploy on top of a failed or warning-laden build.

## Debugging — diagnose before re-architecting

- When a build or deploy fails, **diagnose the real error first**. Read the actual output and find the root cause.
- Do **not** change the architecture, framework config, or project structure as a reflexive fix. Understand the failure, then make the smallest correct change.

## Reporting — always say WHERE the work is

Claude Code sessions frequently run in a **remote container with its own clone of
this repo**. That container is not the user's machine. Work written there reaches
the user only as a pushed branch, and only after the user fetches it. Reporting
that ignores this reads as fabrication: the user runs `ls`, sees nothing, and has
no way to tell a real push from an invented one.

- **Open every report** by stating where the work landed — `working tree` (the
  user's own machine) or `remote branch only`. When it is remote-only, say so in
  the first line, before describing what was built.
- **End every report** with the branch name, the pushed commit SHA, and the real
  `git ls-remote origin refs/heads/<branch>` output for that ref. Paste the actual
  command output. A description of the output, or a SHA quoted from memory, does
  not count — the point is evidence the user can reproduce.
- **When asked to read a file** (`cat`, `open`, "show me X"), state plainly that
  the read is against the container's filesystem, not the user's. Never print file
  contents in a way that implies a shared disk.
