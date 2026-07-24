# Dhokha frontend

React/Vite investigation dashboard for the Dhokha fraud scoring service.

## Development

```bash
npm ci
npm run dev
```

During local development, `/api` is proxied to `http://127.0.0.1:8000`.
Start the FastAPI service from `../backend` before using Transaction Scorer.

For a deployed build, copy `.env.example` to `.env` and set:

```bash
VITE_API_URL=https://your-backend.example.com
```

## Checks

```bash
npm run lint
npm run build
```
