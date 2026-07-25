# ⚡ FrameFlow AI Project Instructions

**Created & Engineered by Aarav Khanal**

## Python & Backend Environment
- Always use Poetry virtualenv for backend execution: `cd backend && poetry run <command>`
- Run backend tests: `cd backend && poetry run pytest`
- Run backend type checking: `cd backend && poetry run pyright`

## Frontend Environment
- Run frontend linter: `cd frontend && pnpm lint`
- Run frontend type check: `cd frontend && ./node_modules/.bin/tsc --noEmit`
- Run dev server: `cd frontend && pnpm dev` (App runs on `http://localhost:5173`)

## Backend Services & Environment
- Backend (FastAPI + WebSockets): `cd backend && poetry run uvicorn main:app --reload --port 7001`
- Configure keys in `backend/.env`: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_KEY`, `JWT_SECRET_KEY`

---

<div align="center">

Developed by **[Aarav Khanal](https://github.com/aaravkhanal)**

</div>
