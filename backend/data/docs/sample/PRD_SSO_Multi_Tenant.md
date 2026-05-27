# PRD — Authentification SSO Multi-Tenant

**Produit :** PO.ai
**Auteur :** Product Owner
**Date :** 2026-05-20
**Statut :** Draft v1.2
**Epic ID :** EPIC-AUTH-014

---

## 1. Contexte & Problème

Les clients entreprise (segment B2B) refusent aujourd'hui d'adopter PO.ai car la plateforme
ne propose qu'une authentification par email/mot de passe. Les DSI exigent un SSO conforme
à leur fournisseur d'identité (Azure AD, Okta, Google Workspace) avec provisioning SCIM.

**Indicateurs actuels :**
- 38% des deals B2B perdus citent l'absence de SSO comme blocage principal
- 12 tickets support / mois liés aux mots de passe oubliés
- Conformité ISO 27001 impossible sans SSO

## 2. Objectifs & KPIs

| Objectif | KPI | Cible |
|---|---|---|
| Réduire le churn B2B | Taux de churn annuel | -25% |
| Accélérer l'onboarding | Time-to-first-login | < 5 min |
| Conformité | Certifications obtenues | ISO 27001, SOC 2 |
| Sécurité | Incidents liés aux credentials | 0 par trimestre |

## 3. Personas concernés

- **Sarah, DSI** : valide l'intégration SSO, exige des logs d'audit
- **Marc, Admin tenant** : configure le SSO et gère les rôles
- **Julie, Utilisatrice** : se connecte en 1 clic via son IdP

## 4. Scope MVP (Must Have)

1. Login OIDC / SAML 2.0
2. Connecteurs : Azure AD, Okta, Google Workspace
3. Provisioning JIT (Just-In-Time) à la première connexion
4. Mapping des rôles IdP → rôles PO.ai (admin / PO / viewer)
5. Logs d'audit (qui, quand, depuis quelle IP)
6. Documentation admin + guide d'intégration IdP

## 5. Hors scope (Won't Have v1)

- SCIM 2.0 (push provisioning) — prévu v2
- MFA natif (déjà géré par l'IdP)
- Connecteurs LDAP / Active Directory on-premise
- Self-service signup pour les tenants

## 6. Critères d'acceptation globaux

- [ ] Un utilisateur peut se connecter via Azure AD en < 5 sec
- [ ] Un admin peut configurer le SSO sans intervention support
- [ ] 100% des actions sensibles sont tracées dans les logs
- [ ] Tests E2E couvrent les 3 connecteurs (couverture ≥ 80%)

## 7. Dépendances & risques

- **Dépendance** : refonte du modèle `User` pour supporter le multi-tenant
- **Risque sécurité** : mauvaise validation du token JWT → mitigation via librairie `python-jose` auditée
- **Risque délai** : certification Okta peut prendre 6 semaines

## 8. Roadmap proposée

| Sprint | Livrable |
|---|---|
| S+1 | Refonte modèle User + tenant isolation |
| S+2 | Connecteur OIDC générique |
| S+3 | Connecteur Azure AD + tests |
| S+4 | Connecteurs Okta + Google + provisioning JIT |
| S+5 | Logs d'audit + documentation |
| S+6 | Tests E2E, beta privée 3 clients |
