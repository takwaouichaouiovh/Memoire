# POSTIE — Mémoire LaTeX

## Compilation

```bash
cd memoire
pdflatex main.tex
makeglossaries main
pdflatex main.tex
pdflatex main.tex
```

Ou via Overleaf : zippe le dossier `memoire/` et upload sur https://overleaf.com.

## Figures à ajouter dans `figures/`

| Fichier | Source | Comment l'obtenir |
|---|---|---|
| `landing-screenshot.png` | Capture du `/` de l'app | Ouvrir POSTIE → F12 → mode responsive → screenshot |
| `chat-screenshot.png` | Capture du chat avec question + réponse + sources | Faire un échange dans `/workspace` puis capture |
| `prio-screenshot.png` | Capture du panneau priorisation | `/workspace` → panneau Priorisation |
| `sprint-screenshot.png` | Capture du Sprint Planner | `/workspace` → panneau Sprint Planner |
| `burndown-sX.png` (×6) | Burndowns auto-générés | `python ../scripts/generate_burndowns.py` |

Astuce : pour des captures nettes, zoom navigateur à 150-200 % avant capture (PNG, non JPG).

## Édition

- Chapitres : `chapters/0X_*.tex`
- Annexes : `annexes/A_*.tex`, `B_*.tex`, `C_*.tex`
- Bibliographie : `biblio.bib` (BibTeX)
- Acronymes : `acronyms.tex`
- Diagramme architecture : `figures/architecture.tex` (TikZ vectoriel)

## Sections à compléter avec tes vraies données

- Chapitre 6 (Évaluation) : valeurs marquées *(à compléter)* dans `tab:results`
- Chapitre 3 (Méthodologie) : vélocités réelles par sprint
- Annexe B (Burndowns) : régénérer avec `scripts/burndown_data.csv` à jour
