"""
RAG Engine — Retrieval-Augmented Generation for PO.ai
Supports GPT-4o (OpenAI) and Mistral Large via LangChain
"""

import os
from typing import Literal
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_mistralai import ChatMistralAI
from langchain_community.vectorstores import Chroma
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferWindowMemory
from langchain.prompts import PromptTemplate
from langchain.schema import Document


# ── Model selection ──────────────────────────────────────────────────────────

ModelName = Literal["gpt-4o", "mistral-large"]


def _is_placeholder_key(value: str | None) -> bool:
    if not value:
        return True
    normalized = value.strip().lower()
    return normalized in {"demo-key", "your-api-key", "your_openai_api_key", "your_mistral_api_key"}

def get_llm(model: ModelName = "gpt-4o"):
    openai_key = os.getenv("OPENAI_API_KEY")
    mistral_key = os.getenv("MISTRAL_API_KEY")

    if model == "gpt-4o":
        if _is_placeholder_key(openai_key):
            raise RuntimeError("OPENAI_API_KEY is not configured")
        return ChatOpenAI(
            model="gpt-4o",
            temperature=0.3,
            api_key=openai_key,
            streaming=True,
        )
    if _is_placeholder_key(mistral_key):
        raise RuntimeError("MISTRAL_API_KEY is not configured")
    return ChatMistralAI(
        model="mistral-large-latest",
        temperature=0.2,
        api_key=mistral_key,
    )


# ── Vector Store (ChromaDB) ──────────────────────────────────────────────────

_CHROMA_PATH = "./data/chroma"


def get_vectorstore() -> Chroma:
    openai_key = os.getenv("OPENAI_API_KEY")
    if _is_placeholder_key(openai_key):
        raise RuntimeError("OPENAI_API_KEY is required for embeddings")

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=openai_key)
    return Chroma(
        persist_directory=_CHROMA_PATH,
        embedding_function=embeddings,
    )


# ── PO-specific system prompt ────────────────────────────────────────────────

PO_SYSTEM_PROMPT = """You are an expert AI assistant for Product Owners.
You have deep knowledge of Scrum, SAFe, Kanban, OKRs, and modern product management.

Use the retrieved context below to answer the user's question precisely.
Always ground your answer in Agile/PO best practices.
If the context doesn't cover the question, rely on your training knowledge and say so.

Context:
{context}

Chat History:
{chat_history}

Question: {question}

Respond in the same language as the question (French or English).
Be concise, structured, and actionable.

Format your response using Markdown for clarity:
- Use **bold** for key terms, titles, and important concepts.
- Use bullet lists (`- item`) or numbered lists (`1. item`) when listing multiple items.
- Use `### Subtitles` to organize long answers into clear sections.
- Use line breaks between sections — never write one giant paragraph.
- Use `code formatting` for IDs, technical terms, file names, or commands.
- Use Markdown tables when comparing items or presenting structured data.

Always cite sources from the retrieved context at the end of your answer (e.g. `**Sources:** doc1.md, doc2.md`).
If no source is available for a claim, explicitly state that it is based on general knowledge.
"""

PO_PROMPT = PromptTemplate(
    input_variables=["context", "chat_history", "question"],
    template=PO_SYSTEM_PROMPT,
)


# ── RAG Chain factory ────────────────────────────────────────────────────────

def build_rag_chain(model: ModelName = "gpt-4o", session_id: str = "default"):
    llm          = get_llm(model)
    vectorstore  = get_vectorstore()
    retriever    = vectorstore.as_retriever(
        search_type="mmr",               # Maximal Marginal Relevance — avoids redundant chunks
        search_kwargs={"k": 6, "fetch_k": 20},
    )
    memory = ConversationBufferWindowMemory(
        k=10,
        memory_key="chat_history",
        return_messages=True,
        output_key="answer",
    )
    chain = ConversationalRetrievalChain.from_llm(
        llm=llm,
        retriever=retriever,
        memory=memory,
        combine_docs_chain_kwargs={"prompt": PO_PROMPT},
        return_source_documents=True,
        verbose=False,
    )
    return chain


# ── Smart model router ───────────────────────────────────────────────────────
# Route to the best model depending on task type

def route_model(query: str) -> ModelName:
    """
    GPT-4o  → complex reasoning, long-form answers, user story generation
    Mistral → scoring, classification, short structured outputs
    """
    scoring_keywords = [
        "score", "priorit", "rice", "wsjf", "moscow", "rank",
        "classif", "catégor", "évalue", "noter",
    ]
    q = query.lower()
    mistral_key = os.getenv("MISTRAL_API_KEY")
    if any(kw in q for kw in scoring_keywords) and not _is_placeholder_key(mistral_key):
        return "mistral-large"
    return "gpt-4o"


# ── Source formatter ─────────────────────────────────────────────────────────

def format_sources(docs: list[Document]) -> list[dict]:
    seen = set()
    sources = []
    for doc in docs:
        name = doc.metadata.get("source", "Knowledge Base")
        page = doc.metadata.get("page", None)
        key  = f"{name}-{page}"
        if key not in seen:
            seen.add(key)
            sources.append({
                "name": name,
                "page": page,
                "snippet": doc.page_content[:120] + "...",
            })
    return sources
