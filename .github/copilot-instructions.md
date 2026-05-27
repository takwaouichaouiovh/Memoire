# PO.ai — GitHub Copilot Instructions
# Place this file at: .github/copilot-instructions.md
# Copilot will automatically use this as context for every chat and suggestion in this repo.

## Project overview

PO.ai is an AI-powered assistant for Product Owners built as an M2 thesis project.
It combines a RAG (Retrieval-Augmented Generation) chatbot trained on Agile/PO knowledge
with an intelligent feature prioritization engine using RICE, WSJF, MoSCoW, and AI scoring.

**Stack:**
- Backend: FastAPI + LangChain + ChromaDB (Python 3.11+)
- Frontend: Next.js 15 + React 19 + Tailwind CSS (TypeScript)
- AI Models: OpenAI GPT-4o (reasoning/RAG) + Mistral Large (scoring/classification)
- Vector Store: ChromaDB with OpenAI text-embedding-3-small

---

## Architecture rules

### Backend (`/backend`)

- All API routes live in `app/api/`. One file per domain (chat, prioritization, documents).
- RAG logic lives in `app/rag/`. Do not mix retrieval logic with API routes.
- Prioritization algorithms live in `app/prioritization/algorithms.py`. Add new algorithms here.
- All Pydantic models use `BaseModel`. No raw dicts in API responses.
- Use `async def` for all route handlers. Use `def` for pure computation (scoring algorithms).
- Environment variables are loaded via `os.getenv()`. Never hardcode API keys.
- ChromaDB persist path is always `./data/chroma` relative to the backend directory.

### Frontend (`/frontend`)

- Components are in `src/components/{domain}/`. E.g., `chat/`, `priority/`, `layout/`.
- All components are `"use client"` unless they are pure server components.
- Tailwind only — no inline styles unless dynamically computed (e.g., score bar widths).
- Use `lucide-react` for icons. No other icon libraries.
- API base URL comes from `process.env.NEXT_PUBLIC_API_URL`.
- State management: React `useState`/`useReducer` only. No Redux or Zustand for now.

---

## Coding conventions

### Python

```python
# ✅ Good — typed, documented, single responsibility
async def chat(req: ChatRequest) -> ChatResponse:
    model = req.model or route_model(req.message)
    chain = build_rag_chain(model=model, session_id=req.session_id)
    result = chain.invoke({"question": req.message})
    return ChatResponse(answer=result["answer"], model_used=model, ...)

# ❌ Avoid — no types, mixed concerns
def chat(data):
    llm = ChatOpenAI(api_key="sk-...")
    ...
```

### TypeScript / React

```tsx
// ✅ Good — typed props, named export, no any
interface Props { messages: Message[]; onSend: (msg: string) => void; }
export default function ChatPanel({ messages, onSend }: Props) { ... }

// ❌ Avoid — untyped, default exports without interface
export default function Panel({ data }: any) { ... }
```

---

## Domain knowledge — Product Owner vocabulary

When generating code, comments, or variable names related to PO/Agile concepts, use these terms correctly:

- **User story**: "As a [role], I want [goal], so that [benefit]"
- **RICE score**: (Reach × Impact × Confidence) / Effort — range 0–100
- **WSJF**: (Business Value + Time Criticality + Risk Reduction) / Job Size — SAFe standard
- **MoSCoW**: Must have / Should have / Could have / Won't have
- **Backlog**: Ordered list of features/stories to be implemented
- **Epic**: Large body of work that can be broken into user stories
- **Sprint**: Time-boxed iteration (typically 2 weeks)
- **Velocity**: Story points completed per sprint
- **Definition of Done (DoD)**: Shared criteria for feature completion
- **Acceptance criteria**: Conditions a story must meet to be accepted

When generating prioritization logic, always normalize scores to 0–100 range.
When generating RAG prompts, always instruct the model to cite its sources.

---

## RAG & LLM guidelines

- GPT-4o is used for: complex reasoning, user story generation, long-form answers, analysis
- Mistral Large is used for: feature scoring, classification, structured JSON output, short tasks
- The `route_model()` function in `app/rag/engine.py` handles automatic routing — update it when adding new task types
- All RAG prompts must include `{context}`, `{chat_history}`, and `{question}` variables
- Chunk size for document ingestion: 800 tokens, overlap: 120 tokens
- Use MMR retrieval (Maximal Marginal Relevance) with k=6 to avoid redundant context

---

## Prioritization algorithm rules

When adding a new prioritization algorithm:
1. Add the scoring function to `app/prioritization/algorithms.py`
2. Add the algorithm name to the `AlgoName` Literal type
3. Add the sort key to the `sort_key` dict in `prioritize()`
4. Add a UI pill in `PrioritizationPanel.tsx`
5. Add the color to `SCORE_COLORS` in the frontend component

All scores must be normalized to 0–100 before returning.

---

## File naming conventions

```
backend/
  app/
    api/          → chat.py, prioritization.py, documents.py
    rag/          → engine.py, ingestor.py
    prioritization/ → algorithms.py
    models/       → shared Pydantic models

frontend/
  src/
    components/
      chat/       → ChatPanel.tsx, MessageBubble.tsx, SourceChips.tsx
      priority/   → PrioritizationPanel.tsx, ScoreBar.tsx, AlgoPills.tsx
      layout/     → Sidebar.tsx, NavBar.tsx, RightPanel.tsx
    hooks/        → useChat.ts, usePrioritization.ts
    lib/          → api.ts (all fetch calls), utils.ts
```

---

## What NOT to generate

- Do not generate code that hardcodes API keys
- Do not use `any` type in TypeScript
- Do not call the OpenAI or Mistral API directly from the frontend — always go through the backend
- Do not use `localStorage` or cookies for storing conversation history — use session state
- Do not mix RAG logic and prioritization logic in the same module
- Do not add new npm packages without checking if lucide-react or a Tailwind utility already covers the use case
