# Infra-bot

`Infra-bot` generates social-media-ready market analysis from Musashi's truth layer.

It reads directly from the Musashi Supabase/Postgres truth layer and produces:

- prediction-market reaction posts
- sector snapshots
- case-study threads
- market-structure / trust posts
- narrative deep-dive reports synthesized from structured market data

Outputs are deterministic Markdown + JSON files under `outputs/`.

## What it is for

This repo is not a trading bot.

It is a content/report automation layer that sits on top of Musashi infra and answers questions like:

- what did Kalshi reprice the most in politics / macro / crypto?
- what does Kalshi imply about AI / crypto / Fed / elections right now?
- how did one event cluster move over time?
- what do resolved markets suggest about trustworthiness by category / liquidity?

## Setup

1. Copy `.env.example` to `.env`
2. Fill in the DB credentials for the Musashi Supabase pooler connection
3. Install dependencies

```bash
npm install
npm run check
```

## Commands

Generate the full daily pack:

```bash
npm run generate:daily
```

Generate one LLM-synthesized deep daily report:

```bash
npm run generate:deep-daily
```

Generate one LLM-synthesized deep daily report from already-written JSON outputs:

```bash
npm run generate:deep-daily-from-cache -- --date 2026-05-13
```

Export every Markdown report for a given day to PDF:

```bash
npm run export:daily-pdfs -- --date 2026-05-13
```

Generate one LLM-synthesized event case study:

```bash
npm run generate:deep-case-study -- --event-id YOUR_EVENT_ID
```

Generate only movers:

```bash
npm run generate:movers
```

Generate a sector snapshot:

```bash
npm run generate:sector -- --sector crypto
```

Generate a case study:

```bash
npm run generate:case-study -- --event-id FED-SEP-2025
```

Generate market-structure / trust analysis:

```bash
npm run generate:market-structure
```

## Output shape

Each command writes both:

- Markdown
- JSON

to date-scoped folders under `outputs/`.

## Scheduled automation

The GitHub workflow in `.github/workflows/generate-content.yml` runs the daily pack on schedule and uploads outputs as an artifact.

This workflow needs these repo secrets:

- `SUPABASE_DB_HOST`
- `SUPABASE_DB_PORT`
- `SUPABASE_DB_NAME`
- `SUPABASE_DB_USER`
- `SUPABASE_DB_PASSWORD`

For the LLM-backed deep report path, set:

- `DEEPSEEK_API_KEY`
- optionally `DEEPSEEK_BASE_URL`
- optionally `DEEPSEEK_MODEL`

The scheduled workflow now:

1. generates the deterministic daily data pack
2. synthesizes `deep-daily-from-cache`
3. exports every Markdown report for that day to PDF
