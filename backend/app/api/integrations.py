"""External integrations API — GitHub Issues import / export."""

from fastapi import APIRouter, HTTPException

from app.integrations.github import (
    GitHubExportRequest,
    GitHubExportResponse,
    GitHubImportRequest,
    GitHubImportResponse,
    export_features,
    import_issues,
)

router = APIRouter()


@router.post("/github/import", response_model=GitHubImportResponse)
async def api_github_import(req: GitHubImportRequest):
    try:
        return import_issues(req)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GitHub import failed: {exc}") from exc


@router.post("/github/export", response_model=GitHubExportResponse)
async def api_github_export(req: GitHubExportRequest):
    """Dry-run by default. Set ``apply=true`` to actually create/update issues."""
    try:
        return export_features(req)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"GitHub export failed: {exc}") from exc
