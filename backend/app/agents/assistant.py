"""
Tool-calling assistant — GPT-4o with bound tools, simple ReAct-style loop.
"""

from __future__ import annotations

from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from pydantic import BaseModel

from app.agents.tools import ALL_TOOLS, TOOL_MAP
from app.api.sessions import append_message
from app.rag.engine import get_llm

MAX_ITERATIONS = 5

SYSTEM_PROMPT = """You are PO.ai, an agentic assistant for Product Owners.
You have three tools at your disposal:
- add_feature: add a new feature to the backlog
- re_score: re-rank the backlog with RICE / WSJF / ICE / Kano / Value-Effort / AI Blend / ML Hybrid
- search_docs: query the indexed knowledge base for Agile/PO references

Be concise. Use tools when the user asks to add, score, rank, or look something up.
When you are done, give a clear summary of what you did (and the resulting ranking if relevant)."""


class ToolCallTrace(BaseModel):
    name: str
    args: dict
    result: Any


class AssistantRequest(BaseModel):
    message: str
    session_id: str = "default"


class AssistantResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallTrace] = []
    iterations: int = 0


# In-memory short-term memory per session (list of messages).
_sessions: dict[str, list] = {}


def run_assistant(req: AssistantRequest) -> AssistantResponse:
    llm = get_llm("gpt-4o").bind_tools(ALL_TOOLS)

    history = _sessions.setdefault(req.session_id, [SystemMessage(content=SYSTEM_PROMPT)])
    history.append(HumanMessage(content=req.message))

    traces: list[ToolCallTrace] = []
    iterations = 0

    while iterations < MAX_ITERATIONS:
        iterations += 1
        response: AIMessage = llm.invoke(history)
        history.append(response)

        if not response.tool_calls:
            break

        for call in response.tool_calls:
            tool = TOOL_MAP.get(call["name"])
            if tool is None:
                result = {"error": f"Unknown tool: {call['name']}"}
            else:
                try:
                    result = tool.invoke(call["args"])
                except Exception as exc:  # surface failures back to the model
                    result = {"error": str(exc)}
            traces.append(ToolCallTrace(name=call["name"], args=call["args"], result=result))
            history.append(ToolMessage(content=str(result), tool_call_id=call["id"]))

    answer = response.content if isinstance(response, AIMessage) else ""
    if isinstance(answer, list):  # content can be list[dict] for multimodal — coerce
        answer = " ".join(part.get("text", "") for part in answer if isinstance(part, dict))

    answer_str = str(answer)

    # Persist the exchange in the cross-session history store
    try:
        append_message(req.session_id, "user", req.message, mode="agent")
        append_message(
            req.session_id,
            "assistant",
            answer_str,
            mode="agent",
            model=f"Agent · {iterations} iter",
            tool_calls=[t.model_dump() for t in traces] or None,
        )
    except Exception:
        # Never fail the assistant because of a persistence error
        pass

    return AssistantResponse(answer=answer_str, tool_calls=traces, iterations=iterations)


def clear_assistant_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
