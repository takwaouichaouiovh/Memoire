# Backlog produit — Sprint 24 (PO.ai)

**Vélocité moyenne équipe :** 32 story points / sprint
**Période :** 2026-06-02 → 2026-06-16
**Scrum Master :** Aïcha
**PO :** Karim

---

## User stories prêtes (Definition of Ready ✅)

### US-201 — Connexion SSO Azure AD
**As** un utilisateur entreprise
**I want** me connecter avec mon compte Azure AD
**So that** je n'ai pas à gérer un mot de passe supplémentaire

- Priorité : Must have
- Story points : 8
- RICE : 82
- Acceptance criteria :
  - [ ] Bouton "Se connecter avec Microsoft" visible sur /login
  - [ ] Redirection OIDC fonctionnelle vers Azure AD
  - [ ] Création du user en JIT à la première connexion
  - [ ] Logs d'audit générés (login_success / login_failed)

### US-202 — Mapping rôles IdP → PO.ai
**As** un admin tenant
**I want** mapper les groupes Azure AD aux rôles PO.ai
**So that** les permissions soient gérées centralement

- Priorité : Must have
- Story points : 5
- RICE : 71
- Acceptance criteria :
  - [ ] UI admin pour définir les règles de mapping
  - [ ] Application du mapping à chaque login
  - [ ] Test : un user du groupe "PO" obtient le rôle PO

### US-203 — Détection de doublons dans le backlog
**As** un Product Owner
**I want** être alerté quand je crée une story similaire à une existante
**So that** j'évite la duplication d'effort

- Priorité : Should have
- Story points : 5
- WSJF : 12
- Acceptance criteria :
  - [ ] Embedding de la story comparé au backlog (seuil cosine 0.85)
  - [ ] Modal de confirmation si doublon détecté
  - [ ] Lien vers la story existante

### US-204 — Export backlog au format CSV
**As** un PO
**I want** exporter mon backlog en CSV
**So that** je puisse le partager avec des parties prenantes externes

- Priorité : Should have
- Story points : 3
- RICE : 45
- Acceptance criteria :
  - [ ] Bouton "Export CSV" dans PrioritizationPanel
  - [ ] Encodage UTF-8 BOM (compatible Excel FR)
  - [ ] Colonnes : ID, Titre, Score, Priorité, Effort

### US-205 — Cache Redis embeddings
**As** un développeur backend
**I want** mettre en cache les embeddings calculés
**So that** réduire la latence et les coûts OpenAI

- Priorité : Should have
- Story points : 5
- WSJF : 8
- Acceptance criteria :
  - [ ] Cache hit ratio > 60% après 1 semaine
  - [ ] TTL configurable (default 30 jours)
  - [ ] Métriques exposées (hits/miss)

### US-206 — Refonte UI Sidebar
**As** un utilisateur
**I want** une sidebar collapsible avec icônes
**So that** gagner de l'espace sur petit écran

- Priorité : Could have
- Story points : 3
- RICE : 28
- Acceptance criteria :
  - [ ] Toggle collapse/expand
  - [ ] État persisté en sessionStorage
  - [ ] Tooltips sur icônes en mode collapsed

### US-207 — Migration ChromaDB → pgvector (spike)
**As** un développeur
**I want** évaluer la faisabilité technique de pgvector
**So that** préparer la migration

- Priorité : Must have (technique)
- Story points : 3
- Acceptance criteria :
  - [ ] POC fonctionnel avec 10k vecteurs
  - [ ] Benchmark latence vs Chroma
  - [ ] Rapport technique partagé

---

## Total engagement sprint

| Catégorie | SP |
|---|---|
| Must have | 16 |
| Should have | 13 |
| Could have | 3 |
| **Total** | **32** |

✅ Aligné sur la vélocité de l'équipe.
