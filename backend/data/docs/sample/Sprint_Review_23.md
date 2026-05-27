# Compte rendu — Sprint Review 23

**Date :** 2026-05-29
**Heure :** 15h00 — 16h30
**Sprint :** 23 (du 19/05 au 29/05/2026)
**Lieu :** Visioconférence Teams
**Animateur :** Karim (PO)

---

## Participants

**Équipe Scrum :** Karim (PO), Aïcha (SM), Yacine, Nora, Tom, Léa, Sami
**Stakeholders :** Sophie (CEO), Marc (VP Sales), Julien (Head of Customer Success)
**Invités externes :** 2 représentants du design partner Acme Corp

---

## Objectif du sprint (rappel)

> Livrer un MVP de l'agent Grooming v2 capable de générer des user stories complètes
> à partir d'un epic, et lancer la collecte de feedback auprès de 3 clients beta.

## Sprint goal atteint ? ✅ Oui (partiellement)

- ✅ Agent Grooming v2 livré et déployé en staging
- ✅ Beta lancée chez 2 clients sur 3 (le 3ème reporté à S24)
- ⚠️ Génération d'AC encore imparfaite (qualité subjective 7/10)

---

## Démonstrations

### 1. Agent Grooming v2 — Yacine (15 min)

Démo live : à partir de l'epic "Authentification SSO", l'agent génère 7 user stories
complètes avec AC et estimation story points.

**Retours stakeholders :**
- 👍 Sophie (CEO) : "Impressionnant, on dirait du travail humain"
- 🤔 Marc (Sales) : "Peut-on l'utiliser en démo client ?" → oui, à partir de S25
- ⚠️ Acme Corp : "Les AC manquent de critères non-fonctionnels (perf, sécurité)"

### 2. Score RICE avec recommandations — Nora (10 min)

Nouvel onglet "Recommandations" : l'IA propose un ordre de backlog optimisé sur 3 critères.

**Retours :**
- 👍 Julien (CS) : "Les clients que je suis seraient ravis"
- 💡 Demande de pouvoir override manuellement chaque score

### 3. Dashboard analytics PO — Sami (8 min)

Maquettes finales du dashboard "Comment se porte mon produit ?".

**Retours :**
- 👍 Validation des stakeholders pour passer en développement
- 💡 Ajouter un widget "alertes" en haut

---

## Stories non terminées (carry-over)

| Story | Raison | Action |
|---|---|---|
| US-198 — Logs audit | Spec mise à jour en cours de sprint | Reportée S24 |
| US-200 — Export PDF | Bibliothèque WeasyPrint instable sous Windows | Spike technique en S24 |

---

## Décisions prises en review

1. **Onboarding beta** : Acme Corp devient design partner officiel (contrat signé)
2. **Priorité S24** : intégrer la génération de critères non-fonctionnels dans Grooming v2
3. **Communication** : article de blog "Comment l'IA aide à grooming un backlog" — Sami et Karim
4. **KPI à suivre** : qualité subjective des stories générées (sondage post-usage)

---

## Prochaines étapes (Sprint 24)

- Planning Sprint 24 : lundi 02/06 à 10h
- Goal pressenti : "SSO Azure AD opérationnel + amélioration qualité agent Grooming"
- 32 SP engagés (vélocité moyenne respectée)

---

## Annexes

- Slides démo : `/notion/sprint-23-review-slides`
- Enregistrement vidéo : `/sharepoint/sprint-reviews/2026-05-29.mp4`
- Backlog mis à jour : Jira board "PO.ai - Product"
