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
