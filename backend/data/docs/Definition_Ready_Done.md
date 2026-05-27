# Guide interne — Définition de "Ready" et "Done" (PO.ai)

**Version :** 3.0
**Validé par :** Équipe Scrum PO.ai
**Dernière révision :** 2026-04-10

---

## Definition of Ready (DoR)

Une user story est *Ready* (prête à entrer dans un sprint) si **toutes** les conditions
suivantes sont remplies :

### Conditions fonctionnelles

- [ ] Story formatée "As a [role], I want [goal], so that [benefit]"
- [ ] Au minimum 3 critères d'acceptation (AC) clairs et testables
- [ ] Maquettes Figma jointes (si UI impactée)
- [ ] Valeur business identifiée (RICE ou WSJF calculé)
- [ ] Persona impacté identifié

### Conditions techniques

- [ ] Story estimée en story points par l'équipe (Planning Poker)
- [ ] Dépendances techniques identifiées et non bloquantes
- [ ] Impact sur architecture évalué (sinon → spike préalable)
- [ ] Données de test disponibles ou créables

### Conditions organisationnelles

- [ ] PO disponible pour répondre aux questions pendant le sprint
- [ ] Story découpée pour être terminée en moins de 5 jours

### Score minimum

✅ **100% des cases cochées** pour passer en Sprint Planning.
❌ Sinon → reste dans le refinement.

---

## Definition of Done (DoD)

Une user story est *Done* (terminée) si **toutes** les conditions suivantes sont remplies :

### Code

- [ ] Code écrit et conforme aux conventions (`/.github/copilot-instructions.md`)
- [ ] Pas de `console.log`, `print()`, code commenté ou TODO non traités
- [ ] Aucun secret hardcodé (audit `git-secrets`)
- [ ] Linter ESLint / Ruff sans erreur ni warning

### Tests

- [ ] Tests unitaires écrits, couverture ≥ 80% sur le code modifié
- [ ] Tests d'intégration pour les nouvelles routes API
- [ ] Tests E2E Playwright pour les flux UI critiques
- [ ] CI verte (build + tests + lint)

### Revue

- [ ] Pull Request relue par au moins 1 autre développeur
- [ ] Commentaires de review traités
- [ ] Branch à jour avec `main`, conflits résolus

### Documentation

- [ ] README ou doc API mise à jour si l'API change
- [ ] Changelog enrichi (Keep a Changelog format)
- [ ] Captures d'écran ajoutées à la PR si UI

### Qualité & sécurité

- [ ] Aucune vulnérabilité OWASP Top 10 introduite
- [ ] Aucune régression de perf détectée (Lighthouse > 90)
- [ ] Accessibilité respectée (WCAG AA sur les nouveaux composants)

### Déploiement

- [ ] Mergée sur `main` et déployée en staging
- [ ] Validation fonctionnelle par le PO en staging
- [ ] Feature flag créé si rollout progressif
- [ ] Story déplacée en colonne "Done" sur Jira

### Post-déploiement (release)

- [ ] Monitoring / alertes configurées (Datadog)
- [ ] Mesure d'impact prévue (event Mixpanel ou KPI suivi)
- [ ] Communication équipe (Slack channel #releases)

---

## Cas particuliers

### Stories techniques (refactor, dette)

DoR allégée : pas besoin de persona/RICE. Mais critères techniques d'acceptation
obligatoires (ex : "temps de build réduit de X%").

### Bugs

- Reproduction documentée
- Cause racine identifiée
- Test de non-régression ajouté
- Lien vers ticket support si applicable

### Spikes

- Time-boxés (3 jours max)
- Livrable obligatoire : note technique avec décision/recommandation
- Pas de code de production attendu
