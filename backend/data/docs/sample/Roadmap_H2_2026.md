# Roadmap Produit PO.ai — H2 2026

**Vision :** Devenir l'assistant IA de référence pour les Product Owners en Europe.
**Horizon :** Juillet → Décembre 2026
**North Star Metric :** Nombre de décisions de priorisation prises avec l'aide de PO.ai par semaine

---

## Thèmes stratégiques

### 1. Enterprise Readiness (40% capacité)
Lever les blocages B2B pour ouvrir le segment ETI/Grands comptes.

- SSO multi-tenant (Azure AD, Okta, Google) — *EPIC-AUTH-014*
- Logs d'audit & conformité ISO 27001 — *EPIC-SEC-021*
- Rôles & permissions granulaires (RBAC) — *EPIC-AUTH-018*
- Export des données conforme RGPD — *EPIC-DATA-009*

### 2. Intelligence augmentée (30% capacité)
Renforcer la qualité du RAG et des agents IA.

- Agent Grooming v2 : génération d'AC + estimation story points — *EPIC-AI-031*
- Détection des doublons dans le backlog — *EPIC-AI-027*
- Suggestion de priorisation contextuelle (apprend de l'historique du PO) — *EPIC-AI-033*
- Support multi-langues (FR, EN, DE, ES) — *EPIC-I18N-007*

### 3. Intégrations (20% capacité)
S'intégrer aux outils du quotidien du PO.

- Connecteur Jira Cloud (sync bidirectionnel) — *EPIC-INT-012*
- Connecteur Azure DevOps — *EPIC-INT-014*
- Webhooks sortants vers Slack / Teams — *EPIC-INT-015*

### 4. Dette technique & perf (10% capacité)
Garder la plateforme scalable et maintenable.

- Migration ChromaDB → Postgres + pgvector — *EPIC-TECH-022*
- Cache Redis sur les embeddings — *EPIC-PERF-008*
- Réécriture du module ingestor en async — *EPIC-TECH-019*

---

## Jalons trimestriels

### Q3 2026 (Juillet-Septembre)
- ✅ Beta SSO chez 3 clients design partners
- ✅ Connecteur Jira en GA
- ✅ Agent Grooming v2 disponible
- ✅ Migration pgvector terminée

### Q4 2026 (Octobre-Décembre)
- 🎯 Certification ISO 27001 obtenue
- 🎯 Connecteur Azure DevOps en GA
- 🎯 Support multi-langues sur les 4 langues cibles
- 🎯 100 tenants entreprise actifs

---

## Hors scope H2 2026

Reporté à 2027 :
- Application mobile native
- Mode collaboratif temps réel (multi-curseurs)
- Marketplace de plugins tiers
- IA on-premise (modèles auto-hébergés)
