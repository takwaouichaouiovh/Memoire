"""
GitHub Issues integration — import a real backlog, optionally push features
back as new issues.

Field mapping (deliberately narrow — see thesis discussion):
    GitHub issue                  →   Feature
    ─────────────────────────────────────────────
    number (#42)                  →   external_id ("42"), external_source="github"
    html_url                      →   external_url
    title                         →   name
    body                          →   description
    labels (epic:X)               →   epic
    labels (sp:N)                 →   effort = N  (story points)
    labels (priority:high…)       →   moscow
    labels (everything else)      →   tags
    issue links "Blocked by #N"   →   depends_on  (parsed from body)
    state: open                   →   imported; closed issues are skipped

Write-back (`export`) is **dry-run by default**; the caller must explicitly
set ``apply=True`` to mutate the remote repository. This prevents accidental
mass-mutation from a buggy mapping.
"""

from __future__ import annotations

import os
import re
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field

from app.prioritization.algorithms import Feature


_GITHUB_API = "https://api.github.com"
_PER_PAGE = 100  # GitHub max
_BLOCKED_BY_RE = re.compile(
    r"(?:blocked\s*by|depends\s*on)\s*[:\-]?\s*((?:#\d+(?:\s*,\s*#\d+)*))",
    re.IGNORECASE,
)
_LABEL_EPIC_RE = re.compile(r"^epic[:/](.+)$", re.IGNORECASE)
_LABEL_SP_RE = re.compile(r"^(?:sp|story[- ]?points?)[:/](\d+(?:\.\d+)?)$", re.IGNORECASE)
_LABEL_PRIO_RE = re.compile(r"^priority[:/](must|should|could|wont|low|medium|high|critical)$", re.IGNORECASE)
_PRIO_TO_MOSCOW: dict[str, str] = {
    "critical": "must",
    "high": "must",
    "must": "must",
    "medium": "should",
    "should": "should",
    "low": "could",
    "could": "could",
    "wont": "wont",
}


# ── Public IO ────────────────────────────────────────────────────────────────

class GitHubImportRequest(BaseModel):
    repo: str = Field(..., pattern=r"^[\w.-]+/[\w.-]+$", description="owner/name")
    token: str = Field(default="", description="PAT; falls back to GITHUB_TOKEN env var")
    state: Literal["open", "closed", "all"] = "open"
    limit: int = Field(default=200, ge=1, le=1000)
    label_filter: str = Field(default="", description="Only fetch issues with this label (optional)")
    merge_strategy: Literal["replace", "upsert", "append"] = "upsert"


class GitHubImportResponse(BaseModel):
    repo: str
    fetched: int
    created: int
    updated: int
    skipped: int
    features: list[Feature]
    warnings: list[str] = Field(default_factory=list)


class GitHubExportRequest(BaseModel):
    repo: str = Field(..., pattern=r"^[\w.-]+/[\w.-]+$")
    token: str = Field(default="")
    feature_ids: list[str] = Field(default_factory=list, description="Empty = export all")
    apply: bool = Field(default=False, description="If False, only preview the changes")
    label_prefix: str = Field(default="postie", description="Tag pushed issues with this label")


class GitHubExportPreview(BaseModel):
    feature_id: str
    action: Literal["create", "update", "skip"]
    title: str
    body: str
    labels: list[str]
    existing_issue: int | None = None


class GitHubExportResponse(BaseModel):
    repo: str
    apply: bool
    total: int
    previews: list[GitHubExportPreview]
    warnings: list[str] = Field(default_factory=list)


# ── HTTP helpers ─────────────────────────────────────────────────────────────

def _client(token: str) -> httpx.Client:
    real_token = token or os.getenv("GITHUB_TOKEN", "")
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "postie-po-studio",
    }
    if real_token:
        headers["Authorization"] = f"Bearer {real_token}"
    return httpx.Client(headers=headers, timeout=20.0)


def _ensure_token(token: str) -> None:
    if not (token or os.getenv("GITHUB_TOKEN")):
        # Anonymous calls are heavily rate-limited (60 req/hr) but we still let
        # them through for public repos — only warn.
        return


# ── Mapping helpers ──────────────────────────────────────────────────────────

def _parse_dependencies(body: str | None) -> list[str]:
    """Extract '#N' references from 'Blocked by:' / 'Depends on:' lines."""
    if not body:
        return []
    deps: list[str] = []
    for m in _BLOCKED_BY_RE.finditer(body):
        for ref in re.findall(r"#(\d+)", m.group(1)):
            deps.append(ref)
    return deps


def _issue_to_feature(issue: dict[str, Any]) -> Feature:
    labels = [lab.get("name", "") for lab in issue.get("labels", [])]
    epic = ""
    effort = 5.0
    moscow = "should"
    tags: list[str] = []
    for lab in labels:
        if not lab:
            continue
        m = _LABEL_EPIC_RE.match(lab)
        if m:
            epic = m.group(1).strip()
            continue
        m = _LABEL_SP_RE.match(lab)
        if m:
            try:
                effort = max(0.5, min(float(m.group(1)), 20.0))
            except ValueError:
                pass
            continue
        m = _LABEL_PRIO_RE.match(lab)
        if m:
            moscow = _PRIO_TO_MOSCOW.get(m.group(1).lower(), "should")
            continue
        tags.append(lab)

    number = str(issue.get("number", ""))
    return Feature(
        # Stable id so subsequent imports update in place
        id=f"gh-{number}" if number else None,  # type: ignore[arg-type]
        name=issue.get("title", "")[:200] or f"Issue #{number}",
        description=(issue.get("body") or "")[:5000],
        epic=epic,
        tags=tags,
        effort=effort,
        moscow=moscow,  # type: ignore[arg-type]
        depends_on=[f"gh-{n}" for n in _parse_dependencies(issue.get("body"))],
        external_source="github",
        external_id=number,
        external_url=issue.get("html_url", ""),
    )


def _feature_to_issue_payload(feature: Feature, label_prefix: str) -> dict[str, Any]:
    labels = [f"{label_prefix}"]
    if feature.epic:
        labels.append(f"epic:{feature.epic}")
    if feature.effort:
        labels.append(f"sp:{int(feature.effort) if feature.effort.is_integer() else feature.effort}")
    if feature.moscow:
        labels.append(f"priority:{feature.moscow}")
    for tag in feature.tags:
        if tag and not tag.startswith(("epic:", "sp:", "priority:")):
            labels.append(tag)
    body_parts = [feature.description or ""]
    if feature.depends_on:
        refs = []
        for dep in feature.depends_on:
            if dep.startswith("gh-") and dep[3:].isdigit():
                refs.append(f"#{dep[3:]}")
        if refs:
            body_parts.append(f"\n\nBlocked by: {', '.join(refs)}")
    body_parts.append(
        f"\n\n_Synced from POSTIE (feature id: `{feature.id}`)_"
    )
    return {
        "title": feature.name[:250],
        "body": "".join(body_parts),
        "labels": sorted(set(labels)),
    }


# ── Import ───────────────────────────────────────────────────────────────────

def import_issues(req: GitHubImportRequest) -> GitHubImportResponse:
    _ensure_token(req.token)
    warnings: list[str] = []
    fetched: list[dict[str, Any]] = []
    with _client(req.token) as client:
        page = 1
        while len(fetched) < req.limit:
            params = {
                "state": req.state,
                "per_page": min(_PER_PAGE, req.limit - len(fetched)),
                "page": page,
            }
            if req.label_filter:
                params["labels"] = req.label_filter
            resp = client.get(f"{_GITHUB_API}/repos/{req.repo}/issues", params=params)
            if resp.status_code == 401:
                raise PermissionError("GitHub returned 401 — invalid or missing token.")
            if resp.status_code == 404:
                raise FileNotFoundError(f"Repo {req.repo} not found or private.")
            if resp.status_code == 403:
                raise PermissionError(
                    "GitHub rate-limited (403). Provide a token or wait."
                )
            resp.raise_for_status()
            batch = resp.json()
            if not batch:
                break
            # Filter PRs out — the issues endpoint returns both.
            issues_only = [it for it in batch if "pull_request" not in it]
            fetched.extend(issues_only)
            if len(batch) < params["per_page"]:
                break
            page += 1

    features = [_issue_to_feature(it) for it in fetched]

    # Merge with existing backlog
    from app.api.prioritization import _read_backlog, _write_backlog

    existing = _read_backlog()
    by_id = {f.id: f for f in existing}

    created = 0
    updated = 0
    skipped = 0

    if req.merge_strategy == "replace":
        merged = features
        created = len(features)
    elif req.merge_strategy == "append":
        existing_ids = {f.id for f in existing}
        new = [f for f in features if f.id not in existing_ids]
        created = len(new)
        skipped = len(features) - created
        merged = existing + new
    else:  # upsert
        for f in features:
            if f.id in by_id:
                # Preserve any locally edited scoring fields, but refresh
                # title/description/labels/links from upstream.
                prev = by_id[f.id]
                prev.name = f.name
                prev.description = f.description
                prev.epic = f.epic or prev.epic
                prev.tags = f.tags or prev.tags
                prev.depends_on = f.depends_on or prev.depends_on
                prev.external_source = f.external_source
                prev.external_id = f.external_id
                prev.external_url = f.external_url
                updated += 1
            else:
                existing.append(f)
                created += 1
        merged = existing

    _write_backlog(merged)

    return GitHubImportResponse(
        repo=req.repo,
        fetched=len(fetched),
        created=created,
        updated=updated,
        skipped=skipped,
        features=features,
        warnings=warnings,
    )


# ── Export ───────────────────────────────────────────────────────────────────

def export_features(req: GitHubExportRequest) -> GitHubExportResponse:
    from app.api.prioritization import _read_backlog, _write_backlog

    warnings: list[str] = []
    backlog = _read_backlog()
    if req.feature_ids:
        selected = [f for f in backlog if f.id in set(req.feature_ids)]
    else:
        selected = backlog

    previews: list[GitHubExportPreview] = []
    for f in selected:
        payload = _feature_to_issue_payload(f, req.label_prefix)
        existing_num: int | None = None
        action: Literal["create", "update", "skip"] = "create"
        if f.external_source == "github" and f.external_id.isdigit():
            existing_num = int(f.external_id)
            action = "update"
        previews.append(
            GitHubExportPreview(
                feature_id=f.id,
                action=action,
                title=payload["title"],
                body=payload["body"],
                labels=payload["labels"],
                existing_issue=existing_num,
            )
        )

    if not req.apply:
        return GitHubExportResponse(
            repo=req.repo,
            apply=False,
            total=len(previews),
            previews=previews,
            warnings=["Dry-run mode — no changes pushed. Set apply=true to push."],
        )

    if not (req.token or os.getenv("GITHUB_TOKEN")):
        raise PermissionError("apply=true requires a GitHub token.")

    # Apply mutations
    updated_features: dict[str, Feature] = {f.id: f for f in backlog}
    with _client(req.token) as client:
        for prev, feat in zip(previews, selected, strict=True):
            payload = {
                "title": prev.title,
                "body": prev.body,
                "labels": prev.labels,
            }
            if prev.action == "update" and prev.existing_issue is not None:
                resp = client.patch(
                    f"{_GITHUB_API}/repos/{req.repo}/issues/{prev.existing_issue}",
                    json=payload,
                )
            else:
                resp = client.post(
                    f"{_GITHUB_API}/repos/{req.repo}/issues",
                    json=payload,
                )
            if resp.status_code >= 400:
                warnings.append(
                    f"{feat.id}: GitHub {resp.status_code} — {resp.text[:120]}"
                )
                continue
            data = resp.json()
            feat.external_source = "github"
            feat.external_id = str(data.get("number", ""))
            feat.external_url = data.get("html_url", "")
            updated_features[feat.id] = feat

    _write_backlog(list(updated_features.values()))

    return GitHubExportResponse(
        repo=req.repo,
        apply=True,
        total=len(previews),
        previews=previews,
        warnings=warnings,
    )
