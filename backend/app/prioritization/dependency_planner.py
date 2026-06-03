"""
Dependency-aware Sprint Planner.

Extends the classic 0/1 knapsack with precedence constraints:
    if feature B depends on feature A, then  select(B) → select(A)

This becomes the *Precedence-Constrained Knapsack Problem* (PCKP), which is
NP-hard. We implement two complementary strategies and compare them:

1. **ILP** (exact) — PuLP / CBC formulation.
       max  Σ vᵢ · xᵢ
       s.t. Σ wᵢ · xᵢ ≤ C
            xⱼ ≤ xᵢ        ∀ (i precedes j)   (dependency constraint)
            xᵢ ∈ {0,1}

2. **Greedy heuristic** (fast baseline) — topological sort + bundle-ratio:
   walk the DAG in topo order and consider each *closure* (a feature plus all
   its unmet ancestors) as one bundle scored by (Σvalue) / (Σeffort), inserting
   greedily while the budget allows.

If PuLP is unavailable, the API gracefully falls back to the heuristic.
The response always reports `solver` so the caller knows which path ran and
can present both for thesis-grade comparisons.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.prioritization.algorithms import (
    AlgoName,
    Feature,
    ScoredFeature,
    prioritize,
)
from app.prioritization.sprint_planner import SprintPlan, SprintPlanItem


# ── IO ───────────────────────────────────────────────────────────────────────

Solver = Literal["ilp", "greedy", "auto"]


class DependencyPlanRequest(BaseModel):
    features: list[Feature]
    velocity: float = Field(default=20.0, gt=0)
    algorithm: AlgoName = "rice"
    use_ai_blend: bool = False
    solver: Solver = Field(
        default="auto",
        description="auto = ILP if available, otherwise greedy",
    )
    time_limit_seconds: int = Field(default=10, ge=1, le=60)


class DependencyDiagnostics(BaseModel):
    cycles: list[list[str]] = Field(default_factory=list)
    missing_dependencies: list[str] = Field(
        default_factory=list,
        description="Feature ids referenced in depends_on but absent from the input list",
    )
    n_features: int = 0
    n_edges: int = 0


class DependencySprintPlan(SprintPlan):
    solver: Literal["ilp", "greedy"] = "greedy"
    optimal: bool = False
    diagnostics: DependencyDiagnostics = Field(default_factory=DependencyDiagnostics)


# ── Graph helpers ────────────────────────────────────────────────────────────

def _build_graph(features: list[Feature]) -> tuple[dict[str, list[str]], DependencyDiagnostics]:
    """Return (adjacency: feature_id -> list of prerequisite ids), diagnostics."""
    ids = {f.id for f in features}
    adj: dict[str, list[str]] = {}
    diag = DependencyDiagnostics(n_features=len(features))
    missing: set[str] = set()
    edges = 0
    for f in features:
        clean: list[str] = []
        for dep in f.depends_on or []:
            if dep == f.id:
                continue  # ignore self-loops silently
            if dep not in ids:
                missing.add(dep)
                continue
            clean.append(dep)
            edges += 1
        adj[f.id] = clean
    diag.missing_dependencies = sorted(missing)
    diag.n_edges = edges
    diag.cycles = _find_cycles(adj)
    return adj, diag


def _find_cycles(adj: dict[str, list[str]]) -> list[list[str]]:
    """Return one representative cycle per strongly-connected component (size > 1)."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {n: WHITE for n in adj}
    stack: list[str] = []
    cycles: list[list[str]] = []

    def dfs(node: str) -> None:
        color[node] = GRAY
        stack.append(node)
        for nb in adj.get(node, []):
            if color.get(nb) == GRAY:
                # Found back-edge: extract cycle from stack
                if nb in stack:
                    i = stack.index(nb)
                    cycles.append(stack[i:] + [nb])
            elif color.get(nb) == WHITE:
                dfs(nb)
        stack.pop()
        color[node] = BLACK

    for n in list(adj.keys()):
        if color[n] == WHITE:
            dfs(n)
    return cycles


def _transitive_closure(adj: dict[str, list[str]], node: str) -> set[str]:
    """Return all ancestors (transitive prerequisites) of `node`, excluding itself."""
    seen: set[str] = set()
    stack = list(adj.get(node, []))
    while stack:
        cur = stack.pop()
        if cur in seen:
            continue
        seen.add(cur)
        stack.extend(adj.get(cur, []))
    return seen


def _topological_order(adj: dict[str, list[str]]) -> list[str]:
    """Kahn's algorithm. Assumes acyclic input (cycles broken upstream)."""
    indeg = {n: 0 for n in adj}
    for n, deps in adj.items():
        for _d in deps:
            # n depends on d, so edge d -> n in topo sense; indegree of n increases
            indeg[n] += 1
    queue = [n for n, d in indeg.items() if d == 0]
    order: list[str] = []
    children: dict[str, list[str]] = {n: [] for n in adj}
    for n, deps in adj.items():
        for d in deps:
            children.setdefault(d, []).append(n)
    while queue:
        n = queue.pop(0)
        order.append(n)
        for c in children.get(n, []):
            indeg[c] -= 1
            if indeg[c] == 0:
                queue.append(c)
    return order


# ── Solvers ──────────────────────────────────────────────────────────────────

def _solve_greedy(
    scored: list[ScoredFeature],
    adj: dict[str, list[str]],
    capacity: float,
) -> set[str]:
    """Bundle-ratio heuristic: walk topo order, take closures while they fit."""
    by_id = {s.feature.id: s for s in scored}
    order = _topological_order(adj)
    chosen: set[str] = set()
    used = 0.0
    # Process in topo order — but score order matters for *picking*, so:
    # generate candidate bundles, sort by value/effort, then add greedily.
    bundles: list[tuple[float, float, set[str]]] = []  # (ratio, value, members)
    for fid in order:
        sf = by_id.get(fid)
        if sf is None:
            continue
        closure = _transitive_closure(adj, fid) | {fid}
        members = closure
        value = sum(max(by_id[m].final_score, 0.0) for m in members if m in by_id)
        effort = sum(max(by_id[m].feature.effort, 0.0) for m in members if m in by_id)
        if effort <= 0:
            continue
        bundles.append((value / effort, value, members))
    bundles.sort(reverse=True)
    for _ratio, _value, members in bundles:
        new_members = members - chosen
        if not new_members:
            continue
        added_effort = sum(by_id[m].feature.effort for m in new_members if m in by_id)
        if used + added_effort <= capacity + 1e-9:
            chosen.update(new_members)
            used += added_effort
    return chosen


def _solve_ilp(
    scored: list[ScoredFeature],
    adj: dict[str, list[str]],
    capacity: float,
    time_limit: int,
) -> tuple[set[str], bool] | None:
    """Exact PCKP via PuLP+CBC. Returns (chosen_ids, optimal) or None if PuLP missing."""
    try:
        import pulp  # type: ignore
    except ImportError:
        return None

    prob = pulp.LpProblem("pckp", pulp.LpMaximize)
    x = {s.feature.id: pulp.LpVariable(f"x_{i}", cat="Binary") for i, s in enumerate(scored)}

    # Objective
    prob += pulp.lpSum(max(s.final_score, 0.0) * x[s.feature.id] for s in scored)

    # Capacity constraint
    prob += pulp.lpSum(s.feature.effort * x[s.feature.id] for s in scored) <= capacity

    # Precedence: x_child <= x_parent
    for child_id, parents in adj.items():
        if child_id not in x:
            continue
        for p in parents:
            if p in x:
                prob += x[child_id] <= x[p]

    solver = pulp.PULP_CBC_CMD(msg=False, timeLimit=time_limit)
    status = prob.solve(solver)
    chosen = {fid for fid, var in x.items() if var.value() and var.value() > 0.5}
    optimal = pulp.LpStatus[status] == "Optimal"
    return chosen, optimal


# ── Public entry point ───────────────────────────────────────────────────────

def plan_sprint_with_dependencies(req: DependencyPlanRequest) -> DependencySprintPlan:
    scored: list[ScoredFeature] = prioritize(req.features, req.algorithm, req.use_ai_blend)
    adj, diag = _build_graph(req.features)

    # If cycles exist we cannot honor precedence; break them by dropping
    # offending edges (keep the first encountered) and surface in diagnostics.
    if diag.cycles:
        adj = _break_cycles(adj, diag.cycles)

    used_solver: Literal["ilp", "greedy"] = "greedy"
    optimal = False
    chosen: set[str] = set()

    if req.solver in ("auto", "ilp"):
        ilp_result = _solve_ilp(scored, adj, req.velocity, req.time_limit_seconds)
        if ilp_result is not None:
            chosen, optimal = ilp_result
            used_solver = "ilp"
        elif req.solver == "ilp":
            # User explicitly asked for ILP but PuLP missing — degrade to greedy
            used_solver = "greedy"

    if used_solver == "greedy" or (req.solver == "greedy"):
        chosen = _solve_greedy(scored, adj, req.velocity)
        used_solver = "greedy"
        optimal = False

    # Build response objects
    selected: list[SprintPlanItem] = []
    deferred: list[SprintPlanItem] = []
    for s in scored:
        item = SprintPlanItem(
            feature=s.feature,
            score=s.final_score,
            effort=s.feature.effort,
            rank=s.final_rank,
        )
        (selected if s.feature.id in chosen else deferred).append(item)

    total_effort = round(sum(i.effort for i in selected), 2)
    total_value = round(sum(i.score for i in selected), 2)
    utilization = round((total_effort / req.velocity) * 100, 1) if req.velocity else 0.0

    return DependencySprintPlan(
        algorithm=req.algorithm,
        velocity=req.velocity,
        selected=selected,
        deferred=deferred,
        total_effort=total_effort,
        total_value=total_value,
        utilization=utilization,
        strategy="knapsack",
        solver=used_solver,
        optimal=optimal,
        diagnostics=diag,
    )


def _break_cycles(adj: dict[str, list[str]], cycles: list[list[str]]) -> dict[str, list[str]]:
    """Remove one edge per detected cycle so the topo sort / ILP succeed."""
    cleaned = {k: list(v) for k, v in adj.items()}
    for cycle in cycles:
        if len(cycle) < 2:
            continue
        # Drop the edge that closes the cycle (cycle[-2] -> cycle[-1] in adjacency
        # semantics where cycle[-1] depends on cycle[-2]). We invert: cycle[-1] is
        # the node whose dependency list includes cycle[-2]? Actually our edges are
        # "node depends on parent". The detected cycle node sequence is along
        # dependency edges; remove dependency from last node on parent.
        a, b = cycle[-2], cycle[-1]
        if b in cleaned and a in cleaned[b]:
            cleaned[b].remove(a)
    return cleaned
