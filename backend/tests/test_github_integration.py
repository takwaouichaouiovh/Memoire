"""Tests for GitHub integration mapping helpers (no network)."""

from __future__ import annotations

from app.integrations.github import (
    GitHubExportRequest,
    _feature_to_issue_payload,
    _issue_to_feature,
    _parse_dependencies,
)
from app.prioritization.algorithms import Feature


def test_parse_dependencies_basic():
    body = "Some context.\nBlocked by: #12, #34\nMore text."
    assert _parse_dependencies(body) == ["12", "34"]


def test_parse_dependencies_alt_wording():
    assert _parse_dependencies("depends on #7") == ["7"]


def test_parse_dependencies_none():
    assert _parse_dependencies("nothing here") == []
    assert _parse_dependencies(None) == []


def test_issue_to_feature_full_mapping():
    issue = {
        "number": 42,
        "title": "Add SSO",
        "body": "do the thing. Blocked by: #10",
        "html_url": "https://github.com/x/y/issues/42",
        "labels": [
            {"name": "epic:auth"},
            {"name": "sp:5"},
            {"name": "priority:high"},
            {"name": "frontend"},
        ],
    }
    feat = _issue_to_feature(issue)
    assert feat.id == "gh-42"
    assert feat.name == "Add SSO"
    assert feat.epic == "auth"
    assert feat.effort == 5.0
    assert feat.moscow == "must"
    assert "frontend" in feat.tags
    assert feat.depends_on == ["gh-10"]
    assert feat.external_source == "github"
    assert feat.external_id == "42"


def test_feature_to_issue_payload_round_trip_labels():
    f = Feature(
        id="x",
        name="Build foo",
        description="desc",
        epic="auth",
        effort=5.0,
        moscow="must",
        tags=["frontend"],
        depends_on=["gh-10"],
    )
    payload = _feature_to_issue_payload(f, label_prefix="postie")
    assert payload["title"] == "Build foo"
    assert "epic:auth" in payload["labels"]
    assert "priority:must" in payload["labels"]
    assert "postie" in payload["labels"]
    assert "Blocked by: #10" in payload["body"]


def test_export_request_validates_repo_format():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        GitHubExportRequest(repo="not-a-repo")
    # valid case should not raise
    GitHubExportRequest(repo="owner/repo")
