# Rétrospective Sprint 23 — Équipe PO.ai

**Date :** 2026-05-30
**Durée :** 1h30
**Participants :** 7 (4 devs, 1 PO, 1 SM, 1 designer)
**Format :** Glad / Sad / Mad
**Facilitateur :** Aïcha (SM)

---

## Métriques du sprint

| Indicateur | Valeur | Tendance |
|---|---|---|
| Vélocité prévue | 32 SP | — |
| Vélocité réalisée | 28 SP | ⬇ -12% |
| Stories terminées | 6 / 8 | ⬇ |
| Bugs introduits | 3 | ⬆ |
| Bugs résolus | 5 | ✅ |
| Couverture tests | 74% | ⬆ +2% |
| Incidents prod | 1 (mineur) | — |

---

## 😀 Glad — ce qui a bien fonctionné

- **Pair programming sur l'agent Grooming** : qualité de code excellente, 0 bug remonté
- **Démo client positive** : retours enthousiastes du design partner Acme Corp sur la priorisation RICE
- **Daily plus efficaces** depuis le passage à 10 min maximum
- **Onboarding rapide** du nouveau dev (productif en 4 jours)
- **Documentation API à jour** grâce à la génération automatique OpenAPI

## 😞 Sad — ce qui a déçu

- **Sprint non terminé** : 2 stories débordent sur Sprint 24
- **Temps perdu sur l'environnement de staging** (instable 2 jours)
- **Code review trop lentes** (délai moyen 18h) → bloque les merges
- **Spec floue** sur l'export CSV (3 allers-retours avec le PO)
- **Pas de temps pour la dette technique** ce sprint

## 😡 Mad — frustrations

- **Interruptions répétées** par le support client (5 incidents non critiques traités en urgence)
- **Réunion ad-hoc** convoquée 3 fois sans agenda
- **API OpenAI down 4h** mardi → impossible de tester le chat
- **Outils éparpillés** : Jira, Notion, Slack, GitHub… on perd du temps à chercher l'info

---

## ⭐ Actions décidées (SMART)

| # | Action | Responsable | Échéance | Mesure |
|---|---|---|---|---|
| A1 | Limiter les code reviews à 4h max via SLA équipe | Aïcha | Sprint 24 | Délai médian < 4h |
| A2 | Créer un "support shield" tournant (1 dev/semaine dédié) | Karim | S24 J1 | 0 interruption hors shield |
| A3 | Mettre en place un cache local pour les tests RAG (mock OpenAI) | Yacine | S24 J5 | Tests offline OK |
| A4 | Définir un template de spec PO obligatoire avant ready | Karim | S24 J3 | Toutes les stories S24 conformes |
| A5 | Réserver 4 SP/sprint pour la dette technique | Toute l'équipe | À partir S24 | 4 SP labellisés "tech debt" |

---

## Vote satisfaction équipe (1 à 5)

| Membre | Note |
|---|---|
| Karim (PO) | 4 |
| Aïcha (SM) | 3 |
| Yacine (Dev) | 3 |
| Nora (Dev) | 4 |
| Tom (Dev) | 2 |
| Léa (Dev) | 4 |
| Sami (Designer) | 5 |
| **Moyenne** | **3.6 / 5** |

---

## Note du Scrum Master

L'équipe identifie clairement les frictions (interruptions, code reviews lentes, env staging).
Les actions A1, A2 et A3 sont prioritaires pour stabiliser le prochain sprint. À surveiller en Sprint 25.
