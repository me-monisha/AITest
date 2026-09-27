# AIVOA — AI-Powered Deviation Intake Module

An end-to-end Deviation Management workflow for an API pharmaceutical manufacturer:

```
Deviation document / text → AI extraction → Log Deviation form → AI impact & severity → user review → save
```

Built to the assignment spec: **React + Redux** (frontend), **FastAPI** (backend),
**LangGraph + Groq** (AI), **SQLAlchemy** over **SQLite/PostgreSQL/MySQL** (database).

---

## 1. What's here

```
backend/    FastAPI app, LangGraph workflow, Groq client, SQLAlchemy models
frontend/   React + Redux Toolkit app (Vite, Tailwind), matches the reference UI
Dockerfile, render.yaml, docker-compose.prod.yml   Production deployment (see §2)
docker-compose.yml   Optional local Postgres, if you want to match the spec's DB exactly
```

### The AI workflow (LangGraph)

`backend/app/ai/graph.py` defines a two-node graph:

```
START → extract_fields → assess_impact_severity → END
```

- **extract_fields**: reads raw text (from an uploaded document or pasted notes) and
  returns structured JSON for every "Log Deviation" field (site, date, title, source,
  product, batch, description).
- **assess_impact_severity**: a second, focused call that reasons only over the
  extracted description/product/batch to recommend an Initial Impact and Initial
  Severity, with a short human-readable justification — the "AI Copilot" behavior
  from the reference video, adapted to Deviations instead of Complaints.

`backend/app/ai/chat_graph.py` is the router behind the "Ask me anything about
deviations..." box. It classifies each message into:
- **log** — the user pasted a new deviation report into chat → runs the same
  extraction graph as a file upload.
- **edit** — the user asked to change a specific field ("set severity to Critical")
  → asks the LLM for a small JSON patch and applies only that field.
- **chat** — anything else → a plain conversational answer, no field changes.

This gives you the three AI tools the assignment's deliverables call out: the PDF/
document extraction tool, the log-interaction tool, and the edit-interaction tool —
all in one panel, matching the interaction pattern in the reference demo video.

### Document parsing

`backend/app/ai/document_parser.py` extracts text from PDF, DOCX, TXT, XLSX, and
images (OCR via pytesseract, if `tesseract-ocr` is installed on the host — otherwise
it returns a clear message asking the user to paste text instead).

### Live extraction progress

Uploading a document or pasting text kicks off a background job
(`backend/app/ai/jobs.py`) and the frontend opens a Server-Sent Events stream to
show a real progress bar (`EXTRACTION PROGRESS ... 20% / 70% / 100%`), matching the
reference UI screenshot.

---

## 2. Deploying it (production)

The whole system ships as **one Docker image**: the React app is built in a first
stage and served by FastAPI at `/`, the API lives at `/api/*` on the same origin
(so no CORS or proxy setup), and `tesseract-ocr` is included for image uploads.

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: Node builds the UI → Python image runs API + UI on `$PORT` |
| `render.yaml` | Render Blueprint: web service + free managed Postgres, wired together |
| `docker-compose.prod.yml` | App + Postgres on any VPS/server with Docker |

**Environment variables**

| Variable | Required | Notes |
|----------|----------|-------|
| `GROQ_API_KEY` | yes | From https://console.groq.com/keys |
| `GROQ_MODEL` | no | Default `llama-3.3-70b-versatile` |
| `DATABASE_URL` | no | Default SQLite at `/data/deviations.db`. `postgres://…` URLs from hosts are accepted as-is |
| `PORT` | no | Set automatically by Render/Railway; default 8000 |

### Option A — Render (free, ~5 minutes)

1. Push this folder to a GitHub repository.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml`.
3. When prompted, paste your `GROQ_API_KEY`, then **Apply**.
4. After the build, open `https://aivoa-deviation-module.onrender.com` (or the URL
   Render shows). `/api/health` should return `"ai_configured": true`.

Free-tier notes: the service sleeps after 15 min idle (first request takes ~30 s
to wake), and Render's free Postgres expires after 30 days — upgrade the DB plan
to keep data longer.

### Option B — Railway / Fly.io / any Docker host

Railway: **New Project → Deploy from GitHub repo**; it detects the `Dockerfile`.
Add `GROQ_API_KEY` in Variables, and optionally add a Postgres plugin and set
`DATABASE_URL=${{Postgres.DATABASE_URL}}`. Generate a public domain under Settings.

### Option C — Your own server

```bash
GROQ_API_KEY=gsk_... docker compose -f docker-compose.prod.yml up -d --build
# open http://<server-ip>:8000
```
Put nginx/Caddy in front for HTTPS; if using nginx, keep `proxy_buffering off` for
`/api/ai/extract/` so the progress bar streams live.

### Scaling note
Extraction progress jobs are held in process memory, so run **one worker/instance**
(the Dockerfile already does). Scaling out would need Redis for the job store.

---

## 3. Running it locally

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# then edit .env and set GROQ_API_KEY to a real key from https://console.groq.com/keys
# (DATABASE_URL defaults to SQLite - zero setup - or point it at Postgres/MySQL, see below)

uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (interactive docs at `/docs`).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to
`http://localhost:8000` (see `frontend/vite.config.js`), so no CORS setup is needed
in development.

### Using Postgres or MySQL instead of SQLite

```bash
docker compose up -d          # starts a local Postgres on :5432
```

Then in `backend/.env`:
```
DATABASE_URL=postgresql+psycopg2://aivoa:aivoa@localhost:5432/aivoa_deviations
```
(or a `mysql+pymysql://...` URL if you point it at MySQL instead — the driver is
already in `requirements.txt`). Tables are created automatically on startup
(`Base.metadata.create_all`), so no migration step is needed for this assignment.

---

## 4. Using the app

1. Open the **Log Deviation** page. The right panel is the **AI Deviation
   Assistant**.
2. Either:
   - **Drag & drop / upload** a deviation report (PDF, DOCX, TXT, XLS, JPG, PNG), or
   - Click **Paste deviation details / notes** and paste an email/shift note/lab
     report as plain text, or
   - Just type the same content into the **chat box** at the bottom — it's routed
     to the same extraction pipeline.
3. Watch the **Extraction Progress** bar; the left form fills in automatically, and
   every AI-populated field is marked with a small **AI** badge.
4. The assistant also proposes an **Initial Impact** and **Initial Severity** with a
   short reason, shown in the chat.
5. **Review and edit** anything before saving — either directly in the form, or by
   telling the assistant, e.g. *"actually the batch number is XYZ-002"* or *"set
   severity to Critical"*. Only the field(s) you mention change.
6. Click **Save Deviation**. The record is persisted via `POST /api/deviations`.

---

## 5. API reference

| Method | Path                              | Purpose                                           |
|--------|-----------------------------------|----------------------------------------------------|
| POST   | `/api/ai/extract/document`        | Upload a file → returns a `job_id`                 |
| POST   | `/api/ai/extract/text`            | Submit pasted text → returns a `job_id`            |
| GET    | `/api/ai/extract/{job_id}/stream` | SSE stream of extraction progress + final result   |
| POST   | `/api/ai/chat`                    | Chat turn — log / edit / plain-chat, routed by intent |
| POST   | `/api/deviations`                 | Save a deviation record                            |
| GET    | `/api/deviations`                 | List deviations                                    |
| GET    | `/api/deviations/{id}`            | Fetch one deviation                                |
| PUT    | `/api/deviations/{id}`            | Update a deviation                                 |

---

## 6. Design notes / product decisions

- **Two-node LangGraph** rather than one big prompt: separating extraction from
  impact/severity assessment keeps each call focused, makes failures easier to
  isolate, and mirrors how a human QA reviewer actually works (read the report,
  *then* triage it).
- **Provenance tracking**: every record stores which fields were AI-generated
  (`ai_generated_fields`), and editing a field in the UI removes it from that list.
  This makes the review step meaningful and auditable — you can always tell what
  the AI wrote vs. what a human confirmed or changed.
- **One assistant, three tools**: rather than separate upload/chat/edit UIs, the
  single chat box in the AI panel intent-routes between extraction and editing,
  matching the reference demo's "one panel does it all" interaction pattern.
- **SSE for progress**, not polling: cheaper, simpler, and gives the UI a real
  progress percentage instead of a fake spinner.
- **SQLite by default**: the assignment lists Postgres/MySQL, and the app supports
  both via `DATABASE_URL` (a docker-compose is included) — but defaulting to SQLite
  means a reviewer can run the whole thing with zero infra setup.

---

## 7. Testing notes

The backend was verified end-to-end during development:
- FastAPI app import + route registration
- Full CRUD via `TestClient` (create/list a deviation)
- The LangGraph extraction pipeline (`extract_fields` → `assess_impact_severity`)
  with mocked Groq responses
- The chat intent router for both the "log" and "edit" paths

The frontend was verified by running the real Vite dev server against the FastAPI
backend (Groq calls mocked for repeatability) and driving the UI with a headless
browser: paste → extraction progress → auto-filled form with AI badges → impact/
severity suggestion → save → confirmation; and separately, a chat-based field edit
that changed only the targeted field.

For your own demo video, swap in a real `GROQ_API_KEY` and the flow is identical.
