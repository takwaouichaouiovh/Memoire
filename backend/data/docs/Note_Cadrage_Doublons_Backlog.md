# Note de cadrage — Feature "Détection de doublons dans le backlog"

**Code feature :** F-2026-031
**Epic parent :** EPIC-AI-027
**PO :** Karim
**Tech lead :** Yacine
**Date :** 2026-05-22
**Statut :** Discovery → Ready for refinement

---

## 1. Problème utilisateur

Les Product Owners qui gèrent des backlogs de 100+ stories créent fréquemment des doublons,
parfois sous des formulations différentes. Résultat :
- Effort dispersé sur des features redondantes
- Conflits de priorité entre stories qui décrivent le même besoin
- Confusion lors du grooming

Données internes : **23% des stories créées en moyenne ont un doublon sémantique** dans le
backlog (analyse sur 12 tenants beta, mai 2026).

## 2. Hypothèse produit

> Si on prévient le PO en temps réel qu'une story similaire existe déjà, alors il
> consolidera plutôt que dupliquera, ce qui réduira de 80% les doublons en 3 mois.

## 3. Solution envisagée

À la création ou édition d'une story :
1. Calculer l'embedding du titre + description
2. Comparer à tous les embeddings du backlog (cosine similarity)
3. Si score > **0.85**, afficher un modal avec les 3 stories les plus proches
4. Le PO peut :
   - **Fusionner** avec une story existante (la nouvelle devient un AC)
   - **Différencier** (forcer la création, ajoute un tag "duplicate-check-skipped")
   - **Annuler**

## 4. User stories rattachées

- US-203 : alerte sur la création
- US-208 : alerte sur l'édition
- US-209 : rapport hebdo "doublons potentiels détectés"

## 5. Critères de succès

| Métrique | Baseline | Cible 3 mois |
|---|---|---|
| Taux de doublons détectés / créés | — | > 90% des doublons réels |
| Taux de faux positifs | — | < 15% |
| Stories fusionnées suite à l'alerte | — | > 40% |
| Satisfaction PO (NPS feature) | — | > 50 |

## 6. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Trop de faux positifs → friction PO | Moyenne | Élevé | Seuil configurable par tenant, A/B test |
| Latence embedding → UX dégradée | Faible | Moyen | Cache Redis + calcul async |
| Coût embeddings explose | Moyenne | Moyen | Batch les calculs, modèle text-embedding-3-small |

## 7. Hors scope v1

- Détection inter-projets / inter-tenants
- Suggestion automatique de fusion (uniquement détection)
- Re-clustering périodique du backlog complet

## 8. Décision

✅ **GO** pour Sprint 24, scope MVP US-203 uniquement.
US-208 et US-209 reportés à Sprint 25 selon retour beta.
