# Infra-bot

`Infra-bot` generates grounded public market-intelligence memos from Musashi's truth layer.

It reads directly from the Musashi Supabase/Postgres truth layer and produces:

- deterministic source packets
- a strict gated publish packet
- a flagship daily memo in Markdown + JSON + PDF
- optional deep case-study memos only when an event cluster clears the publish gate

Outputs are deterministic Markdown + JSON files under `outputs/`.

## What it is for

This repo is not a trading bot.

It is a content/report automation layer that sits on top of Musashi infra and answers questions like:

- what did Kalshi reprice the most in politics / macro / crypto?
- what does Kalshi imply about AI / crypto / Fed / elections right now?
- how did one event cluster move over time?
- what do resolved markets suggest about trustworthiness by category / liquidity?

## Pipeline

Infra-bot v2 is a three-stage pipeline:

1. **Deterministic source packets**
   - `movers_packet`
   - `sector_packet`
   - `market_structure_packet`
   - `case_study_packet`
2. **Strict publish gating**
   - suppresses thin/noisy sections
   - omits sectors that do not clear minimum thresholds
   - blocks weak case studies
3. **Narrative synthesis**
   - uses validated publish packets only
   - keeps numerically sensitive section bullets deterministic
   - uses the LLM only for constrained framing/title/summary

## Setup

1. Copy `.env.example` to `.env`
2. Fill in the DB credentials for the Musashi Supabase pooler connection
3. Install dependencies

```bash
npm install
npm run check
```

## Commands

Generate the deterministic daily packet set:

```bash
npm run generate:daily
```

Generate one online flagship daily memo directly from live deterministic packets:

```bash
npm run generate:deep-daily
```

Generate one flagship daily memo from already-written JSON packets:

```bash
npm run generate:deep-daily-from-cache -- --date 2026-05-13
```

Generate one deep case-study memo. This command fails if the cluster does not clear the case-study gate:

```bash
npm run generate:deep-case-study -- --event-id YOUR_EVENT_ID
```

Export every Markdown artifact for a given day to PDF:

```bash
npm run export:daily-pdfs -- --date 2026-05-13
```

Generate only movers:

```bash
npm run generate:movers
```

Generate a sector snapshot:

```bash
npm run generate:sector -- --sector crypto
```

Generate a deterministic case-study source packet:

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

The flagship public artifact is:

- `deep-daily-YYYY-MM-DD.md`
- `deep-daily-YYYY-MM-DD.json`
- `pdf/deep-daily-YYYY-MM-DD.pdf`

Supporting packet files are internal/source artifacts and are kept primarily for validation, reuse, and debugging.

## Scheduled automation

The GitHub workflow in `.github/workflows/generate-content.yml` runs the daily pack on schedule and uploads outputs as an artifact.

This workflow needs these repo secrets:

- `SUPABASE_DB_HOST`
- `SUPABASE_DB_PORT`
- `SUPABASE_DB_NAME`
- `SUPABASE_DB_USER`
- `SUPABASE_DB_PASSWORD`

For the LLM-backed memo path, set:

- `LLM_PROVIDER=deepseek`
- `DEEPSEEK_API_KEY`
- optionally `DEEPSEEK_BASE_URL`
- optionally `DEEPSEEK_MODEL`

The scheduled workflow now:

1. generates deterministic source packets
2. synthesizes the flagship memo from cached packets
3. exports Markdown artifacts for that day to PDF

## Accuracy model

The system is intentionally split so that:

- raw numbers come from Musashi truth-layer data
- the publish gate decides what is strong enough to surface
- deterministic bullets carry numerically sensitive facts
- the LLM only writes constrained framing on top of validated facts

The daily memo is therefore a **market-implied** intelligence product, not a claim of external-world causal certainty.
