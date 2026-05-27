# POSTIE — Product Owner Studio (AI-powered)

> An AI copilot for Product Owners. Chat with your docs, prioritize your backlog with 7 algorithms, plan sprints, and groom epics — all in one place.

POSTIE combines a Retrieval-Augmented Generation (RAG) chatbot trained on Agile / PO knowledge with a multi-algorithm feature prioritization engine, a knapsack-based sprint planner, an INVEST-compliant epic-grooming agent, and a retrospective analyzer.

Built as an M2 thesis project at Centrale Lille (M2 MIAS), 2026.

---

## ✨ Features

| Module                | What it does                                                                                                  | Tech                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **Chat (RAG)**        | Ask anything about your PO knowledge base — sources cited.                                                    | GPT-4o · ChromaDB · LangChain       |
| **ReAct agent**       | Tool-calling assistant that can add features, re-score, and search docs in one conversational turn.           | LangChain ReAct · max 5 iterations  |
| **Prioritization**    | 7 algorithms: RICE v2, WSJF, ICE, Kano, Value/Effort, AI Blend, ML Hybrid — all normalized 0–100, transparent. | NumPy · scikit-learn · LLM ensemble |
| **Sprint Planner**    | 0/1 knapsack picks the optimal feature set for your sprint capacity.                                          | Pure DP, O(n × C)                   |
| **Epic Grooming**     | LangGraph agent splits an epic into INVEST-compliant stories with acceptance criteria + RICE scores.          | LangGraph self-correction loop      |
| **Retrospective**     | Paste meeting notes (or fill structured fields) → get actions, risks, wins, blockers.                         | One-shot structured LLM call        |
| **Documents**         | Upload PDF / DOCX / MD / TXT, indexed into the vector store.                                                  | pypdf · docx2txt · unstructured     |

---

## 🏗 Architecture

```
┌───────────────────────────────────────────────────────────┐
│                        Next.js 15 UI                       │
│   chat │ prio │ sprint │ retro │ documents │ settings      │
└──────────────────────────────┬────────────────────────────┘
                               │ REST (fetch)
┌──────────────────────────────▼────────────────────────────┐
│                       FastAPI backend                      │
│ ┌─────────┬───────────┬────────────┬───────────┬────────┐ │
│ │  /chat  │  /prio    │  /sprint   │  /retro   │ /docs  │ │
│ └────┬────┴─────┬─────┴──────┬─────┴─────┬─────┴────┬───┘ │
│      │          │            │           │          │     │
│   RAG chain  Prio algos  Knapsack DP  Retro LLM  Loader  │
│      │          │            │           │          │     │
└──────┼──────────┼────────────┼───────────┼──────────┼─────┘
       ▼          ▼            ▼           ▼          ▼
    ChromaDB   sklearn      pure py      LLM       Chroma
   (vectors)   (ML model)              (Mistral)  (vectors)
```

**Stack**
- **Backend**: Python 3.11, FastAPI, LangChain, ChromaDB, scikit-learn, Pydantic v2
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, lucide-react
- **LLMs**: OpenAI GPT-4o (reasoning, RAG, story generation) + Mistral Large (scoring, classification)

---

## 🚀 Quick start

### Prerequisites

- Python 3.11+
- Node.js 20+
- OpenAI API key + Mistral API key

### Local install

```powershell
# 1. Clone
git clone https://github.com/<your-user>/postie.git
cd postie

# 2. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1     # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env             # fill in OPENAI_API_KEY and MISTRAL_API_KEY
uvicorn app.main:app --reload

# 3. Frontend (in another terminal)
cd frontend
npm install --legacy-peer-deps
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

### Docker

```bash
docker-compose up --build
```

Backend → `http://localhost:8000` · Frontend → `http://localhost:3000`

---

## 🧪 Tests

```powershell
cd backend
python -m pytest tests -v
```

Covers all 7 prioritization algorithms (range invariants, behaviour) and the knapsack sprint planner.

---

## ⌨️ Keyboard shortcuts

Vim-style: press `g` then a letter.

| Combo | Action          |
| ----- | --------------- |
| `g c` | Open Chat       |
| `g p` | Open Prioritization |
| `g s` | Open Sprint Planner |
| `g r` | Open Retrospective  |
| `g d` | Open Documents      |
| `g ,` | Open Settings       |

---

## 📁 Project structure

```
postie/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI routes (one file per domain)
│   │   ├── agents/           # ReAct assistant, epic grooming, retro
│   │   ├── prioritization/   # 7 algorithms + knapsack sprint planner
│   │   ├── rag/              # ChromaDB + RAG chain
│   │   ├── models/           # Shared Pydantic schemas
│   │   └── main.py           # FastAPI app
│   ├── data/                 # backlog.json, chroma/, docs/
│   ├── tests/                # pytest
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js App Router (landing, workspace, documents)
│   │   ├── components/       # chat/, priority/, retro/, layout/, ui/, …
│   │   ├── hooks/            # useChat, usePrioritization, useTheme, useKeyboardShortcuts
│   │   └── lib/              # api.ts, workspace.ts, utils.ts
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🔧 Configuration

All backend settings live in `backend/.env` (see [.env.example](backend/.env.example)).

| Variable           | Default                      | Purpose                              |
| ------------------ | ---------------------------- | ------------------------------------ |
| `OPENAI_API_KEY`   | —                            | GPT-4o + embeddings                  |
| `MISTRAL_API_KEY`  | —                            | Mistral Large                        |
| `OPENAI_MODEL`     | `gpt-4o`                     | Reasoning model                      |
| `MISTRAL_MODEL`    | `mistral-large-latest`       | Scoring / routing model              |
| `EMBED_MODEL`      | `text-embedding-3-small`     | Vector embeddings                    |
| `CHROMA_PATH`      | `./data/chroma`              | Persistent vector store              |
| `CHUNK_SIZE`       | `800`                        | Token chunk size for ingestion       |
| `CHUNK_OVERLAP`    | `120`                        | Token overlap                        |
| `RETRIEVAL_K`      | `6`                          | Documents retrieved per query (MMR)  |

Frontend uses `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`).

---

## 🧑‍🎓 Author

**Aouichaoui Takwa** — M2 MIAS, Centrale Lille — 2026

## 📄 License

[MIT](LICENSE)
# PO.ai — AI Assistant for Product Owners

> M2 Master — Management de l'Intelligence Artificielle  
> RAG chatbot + Feature Prioritization Engine · GPT-4o + Mistral Large

---

## Architecture

```
poai/
├── backend/                  # FastAPI + LangChain + ChromaDB
│   ├── app/
│   │   ├── main.py           # FastAPI app entry point
│   │   ├── api/
│   │   │   ├── chat.py       # /api/chat — RAG chat endpoint
│   │   │   ├── prioritization.py  # /api/prioritization
│   │   │   └── documents.py  # /api/documents — file upload & indexing
│   │   ├── rag/
│   │   │   ├── engine.py     # RAG chain, model routing, LLM factory
│   │   │   └── ingestor.py   # Document ingestion pipeline
│   │   └── prioritization/
│   │       └── algorithms.py # RICE, WSJF, MoSCoW, AI Blend
│   ├── data/
│   │   ├── chroma/           # ChromaDB vector store (auto-created)
│   │   └── docs/             # Drop your PDFs/DOCX here for indexing
│   └── requirements.txt
│
├── frontend/                 # Next.js 15 + Tailwind + TypeScript
│   └── src/components/
│       ├── chat/ChatPanel.tsx
│       └── priority/PrioritizationPanel.tsx
│
└── .github/
  └── copilot-instructions.md   # ← Copilot integration prompt
```

---

## Quick start

### 1 — Clone & configure

```bash
git clone <your-repo>
cp .env.example backend/.env
cp .env.example frontend/.env.local
# Fill in OPENAI_API_KEY and MISTRAL_API_KEY
```

### 2 — Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3 — Index your knowledge base

```bash
# Drop PDFs / DOCX into backend/data/docs/
# Then run:
python -c "from app.rag.ingestor import ingest_directory; print(ingest_directory())"

# Or via API (with server running):
curl -X POST http://localhost:8000/api/documents/upload \
  -F "file=@/path/to/ScrumGuide.pdf"
```

### 4 — Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/` | RAG chat with model auto-routing |
| `POST` | `/api/chat/stream` | Streaming SSE chat response |
| `POST` | `/api/prioritization/` | Score & rank feature list |
| `POST` | `/api/prioritization/quick-score` | Single feature scoring |
| `POST` | `/api/documents/upload` | Upload & index a document |
| `GET`  | `/api/documents/` | List indexed documents |
| `GET`  | `/health` | Health check |

### Chat request example

```json
POST /api/chat/
{
  "message": "How should I write acceptance criteria for a payment feature?",
  "session_id": "user-123",
  "model": null
}
```

### Prioritization request example

```json
POST /api/prioritization/
{
  "algorithm": "rice",
  "use_ai_blend": false,
  "features": [
    {
      "id": "feat_1",
      "name": "AI sprint planner",
      "reach": 8, "impact": 9, "confidence": 0.8, "effort": 5,
      "business_value": 9, "time_criticality": 8, "risk_reduction": 6, "job_size": 5,
      "moscow": "must",
      "tags": ["Epic"],
      "epic": "AI Features",
      "description": "Auto-generate sprint plans from backlog"
    }
  ]
}
```

---

## Prioritization algorithms

| Algorithm | Formula | Best for |
|-----------|---------|----------|
| **RICE** | (Reach × Impact × Confidence) / Effort | Data-driven backlog grooming |
| **WSJF** | (BV + TC + RR) / Job Size | SAFe PI planning |
| **MoSCoW** | Must / Should / Could / Won't | Stakeholder sprint reviews |
| **AI Blend** | Mistral holistic scoring | Complex trade-off decisions |

---

## Copilot integration

Use `.github/copilot-instructions.md` as the repository-level Copilot instruction file.  
GitHub Copilot will automatically use it as context for all suggestions in this repo.

This prompt teaches Copilot:
- The project architecture and file naming conventions
- PO/Agile domain vocabulary (RICE, WSJF, user stories…)
- Coding conventions (typed Python, TypeScript, no `any`)
- Which model to use for which task
- What NOT to generate (hardcoded keys, frontend API calls…)

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI 0.115 |
| AI Orchestration | LangChain 0.3 |
| Vector Store | ChromaDB |
| Embeddings | OpenAI text-embedding-3-small |
| LLM 1 | GPT-4o (reasoning, RAG) |
| LLM 2 | Mistral Large (scoring, classification) |
| Frontend | Next.js 15 + React 19 |
| Styling | Tailwind CSS |
| Language | Python 3.11 + TypeScript 5 |
