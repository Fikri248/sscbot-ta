# MovieBot Groq

React TypeScript chatbot demo using Groq Chat Completions API. The active persona is **MovieBot**, an Indonesian 2026 movie recommendation assistant.

## Project Overview

MovieBot only discusses Indonesian films listed in `src/data/film_indonesia_2026.json`. It rejects foreign movies, movies outside 2026, movies not present in the local catalog, and non-movie topics.

The app keeps the existing chat features: multi-turn chat, localStorage history, rename/delete history, markdown rendering, tables, source UI, image upload, web search controls for non-MovieBot modes, model selector, edit, regenerate, and copy response.

## Catalog

The local catalog file is:

```text
src/data/film_indonesia_2026.json
```

Each movie record contains title, 2026 release year, release status, genres, mood tags, director, actors, rating, duration, and synopsis. MovieBot uses only this catalog and must not invent movie metadata.

## Tech Stack

- React 19
- TypeScript
- Vite
- Groq Chat Completions API
- Browser `localStorage` for MovieBot chat history

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` in the project root:

```bash
VITE_GROQ_API_KEY=paste_your_groq_api_key_here
```

3. Run the development server:

```bash
npm run dev
```

4. Open the URL printed by Vite.

The `.env` file is ignored by git so local API keys are not committed.

## Health Check

To check `.env`, Groq reachability, and active chat models:

```bash
npm run health:check
```

## Build

```bash
npm run build
```

## MovieBot Rules

Main configuration lives in `src/config/chatbotConfig.ts`:

- `botName`: `MovieBot`
- `welcomeMessage`: Indonesian 2026 movie assistant greeting
- `systemInstruction`: persona, catalog-only scope, spoiler policy, response format, and compact catalog text built from `film_indonesia_2026.json`

Every normal chat request sends the system instruction first:

```ts
{ role: "system", content: chatbotConfig.systemInstruction }
```

`src/services/groqService.ts` also adds lightweight guardrails for prompt injection, foreign movie requests, non-2026 requests, unknown titles, spoiler-light defaults, and genre/mood filtering hints.

## Vercel Deployment Note

If deploying to Vercel, add this environment variable in Project Settings:

```bash
VITE_GROQ_API_KEY=your_groq_api_key
```

Redeploy after adding the variable so it is included in the Vite build.

## Security Note

This demo uses `VITE_GROQ_API_KEY` directly in the browser, which is suitable only for local/practicum use. For production, move Groq requests to a backend/API route so the API key stays private.
