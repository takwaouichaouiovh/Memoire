"""External integrations API — GitHub Issues import / export."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthUser, require_role
from app.integrations.github import (
    GitHubExportRequest,
    GitHubExportResponse,
    GitHubImportRequest,
    GitHubImportResponse,
    export_features,
    import_issues,
)
from app.notifications_store import create_notification

router = APIRouter()


@router.post("/github/import", response_model=GitHubImportResponse)
async def api_github_import(
    req: GitHubImportRequest,
    user: Annotated[AuthUser, Depends(require_role("admin"))],
):
    try:
        result = import_issues(req)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GitHub import failed: {exc}") from exc

    create_notification(
        user_id=user.id,
        title="GitHub import complete",
        message=(
            f"{req.repo}: fetched={result.fetched}, created={result.created}, "
            f"updated={result.updated}, skipped={result.skipped}."
        ),
        kind="success" if not result.warnings else "warning",
    )
    return result


@router.post("/github/export", response_model=GitHubExportResponse)
async def api_github_export(
    req: GitHubExportRequest,
    user: Annotated[AuthUser, Depends(require_role("admin"))],
):
    """Dry-run by default. Set ``apply=true`` to actually create/update issues."""
    try:
        result = export_features(req)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GitHub export failed: {exc}") from exc

    create_notification(
        user_id=user.id,
        title="GitHub export ready" if not result.apply else "GitHub export applied",
        message=f"{req.repo}: {result.total} preview(s) generated; apply={result.apply}.",
        kind="success",
    )
    return result
