"""Shared helpers for agentic features."""

from __future__ import annotations

from typing import Type, TypeVar

from pydantic import BaseModel

from app.rag.engine import ModelName, get_llm

T = TypeVar("T", bound=BaseModel)


def get_structured_llm(schema: Type[T], model: ModelName = "gpt-4o"):
    """Return an LLM that produces a validated Pydantic instance of `schema`."""
    return get_llm(model).with_structured_output(schema)
