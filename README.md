# ET NewsEra

Full-stack MERN app for live business news search, AI summaries, and contextual chat.

## Stack

- React + Vite + Tailwind CSS
- Node.js + Express
- MongoDB (`mongodb://127.0.0.1:27017/ai_news`)
- Multi-provider AI fallback: OpenAI, Gemini, xAI, OpenRouter
- GNews API

## Run

1. Install dependencies from the repo root:

```bash
cmd /c npm install
```

2. Add your provider keys in [server/.env](server/.env).

The app uses:
- `OPENAI`, `Gemini`, `xAI`, and `OpenRouter` for text fallback
- `OpenAI`, `Gemini`, and `xAI` for image fallback

3. Start the backend:

```bash
cmd /c npm start
```

4. In a second terminal, start the frontend:

```bash
cmd /c npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to `http://localhost:5000`.
