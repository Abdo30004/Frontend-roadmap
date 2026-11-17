# Accompagner des développeurs juniors et mener des entretiens techniques

**Niveau :** Senior
**Merged from (original phrasings):**
- Comment accompagnez-vous (mentoring) des développeurs juniors et comment menez-vous des entretiens techniques ?

## The concept (short answer)
**Mentoring**
- Partez d'un objectif et d'un état des lieux : ce que le junior sait faire seul aujourd'hui, ce dont il devrait être responsable dans 3 à 6 mois. Faites le point lors d'un 1:1 régulier.
- **Pair programming** avec le junior aux commandes ; le mentor pose des questions (« que se passe-t-il si la requête échoue ? ») au lieu de prendre le clavier.
- **Des tâches cadrées qui font progresser** : des tickets bien définis qui développent une compétence à la fois (d'abord un bug d'UI, puis une fonctionnalité avec un appel d'API, puis une fonctionnalité avec des choix de conception), avec une définition claire de « terminé » et un filet de sécurité.
- **La code review comme outil pédagogique** : expliquez le pourquoi, donnez des liens vers la documentation, distinguez les problèmes bloquants des préférences, et saluez les bonnes décisions. Passez progressivement de « dire » à « questionner ».
- Sécurité psychologique : les questions sont bienvenues, et demander de l'aide après 30 minutes de blocage est attendu, pas un signe de faiblesse.

**Entretiens**
- Définissez d'abord les **compétences** attendues pour le poste, puis concevez chaque étape pour en mesurer une ou deux.
- Utilisez une **grille d'évaluation structurée** avec des comportements observables par niveau, les mêmes questions pour chaque candidat, et des retours écrits indépendants avant le debrief, pour réduire les biais.
- Préférez des **exercices réalistes** (déboguer une petite app React, construire un composant avec une vraie API, un court exercice à la maison limité dans le temps) aux questions de culture générale et aux casse-têtes ; laissez les candidats utiliser leurs outils et leur documentation habituels.

## Real-life example: the problem
Un cas typique : une équipe recrute deux juniors. L'onboarding se résume à « lis le wiki et prends un ticket ». L'un des juniors prend un ticket vague « améliorer les performances de la recherche », passe deux semaines perdu, et reçoit une review de 60 commentaires qui dit « c'est faux, regarde comment je ferais » avec un diff réécrit. Sa confiance s'effondre ; il arrête de poser des questions. Pendant ce temps, le processus d'entretien n'est pas structuré : chaque intervieweur pose son casse-tête préféré, les retours se limitent à « bon feeling » ou « pas de fit culturel », et l'équipe rejette un excellent candidat qui a bloqué sur un arbre rouge-noir au tableau blanc, tout en recrutant quelqu'un qui s'est bien présenté en entretien mais ne sait pas déboguer un `useEffect`.

Les artefacts défaillants :

```markdown
<!-- Ticket - CASSÉ pour un junior : pas de périmètre, pas de contexte, pas de définition de « terminé » -->
Title: Improve search performance
Body: Search is slow, please fix.
```

```markdown
<!-- Retours d'entretien - CASSÉS : pas de critères, pas comparables, biaisés -->
Interviewer A: Strong hire. Great energy, reminded me of myself.
Interviewer B: No hire. Couldn't invert a binary tree.
Interviewer C: Lean hire? Seemed fine.
```

## How to fix it
**1. Un ticket cadré, orienté progression**
```markdown
Title: Debounce product search input (pairing available Tue/Thu)

Context: Each keystroke in <SearchBox> fires GET /api/search, ~12 requests per query,
and results arrive out of order (see Sentry issue #482).
Goal: one request after the user stops typing for 300 ms; ignore stale responses.
Skills to grow: custom hooks, AbortController, testing async UI.

Done when:
- [ ] useDebouncedValue hook with unit tests (fake timers)
- [ ] in-flight request aborted when the query changes
- [ ] RTL test: typing "shoes" quickly triggers exactly one request
Starting points: src/features/search/SearchBox.tsx, docs/testing.md
Mentor: Sam (30 min kickoff, review within a day)
```

**2. Des commentaires de review qui enseignent**
```text
blocking: The fetch isn't cancelled when `query` changes, so a slow response for "sh"
can arrive after "shoes" and overwrite the newer results. Could you return a cleanup
from the effect that calls controller.abort()? MDN has a short example:
https://developer.mozilla.org/en-US/docs/Web/API/AbortController

nit: I'd name this `debouncedQuery` so it's clear it lags behind `query`. Your call.

Nice: extracting the hook made the component much easier to read.
```

**3. Un processus d'entretien structuré avec une grille d'évaluation**
```markdown
## Frontend Engineer (Mid) - Practical exercise rubric (score 1-4 each, with evidence)
| Competency            | 1 - Below                     | 3 - Meets                                       | 4 - Exceeds                                  |
|-----------------------|-------------------------------|-------------------------------------------------|----------------------------------------------|
| React fundamentals    | State/effects misused         | Correct state, effects with cleanup and deps    | Explains trade-offs (derived state, memo)    |
| Debugging             | Guesses, random changes       | Forms hypothesis, uses devtools, verifies       | Narrows systematically, explains root cause  |
| Code quality          | Hard to follow                | Clear names, small functions, handles errors    | Tests edge cases unprompted                  |
| Communication         | Silent or unclear             | Explains approach, asks clarifying questions    | Discusses alternatives and trade-offs        |
| Accessibility/UX      | Ignores                       | Semantic HTML, labels, keyboard works           | Considers loading/empty/error states         |
```
- Exercice : une session de pair programming de 90 minutes sur un petit repo (corriger un bug dans une liste avec un effet, puis ajouter une fonctionnalité de filtre), ou un exercice à la maison de 3 heures maximum, rémunéré ou remplaçant un tour d'entretien sur site, suivi d'une discussion de 30 minutes autour du rendu.
- Chaque intervieweur rédige des notes étayées par des faits avant le debrief ; le debrief confronte les faits à la grille, pas les impressions. Le même exercice pour tous les candidats d'un même niveau.

Pourquoi ça fonctionne : les tickets cadrés donnent aux juniors des premières réussites et développent une compétence à la fois ; une review fondée sur les questions construit le jugement plutôt que la dépendance ; la grille rend les entretiens comparables, mesure des compétences utiles pour le poste, et rend les biais (« il me rappelait moi-même ») visibles et contestables.

## How to say it in the interview
- « J'accompagne par le pair programming avec le junior aux commandes, des tickets cadrés qui développent une compétence à la fois, et des reviews qui expliquent le pourquoi et posent des questions au lieu de réécrire son code. »
- « Pour recruter, je définis d'abord les compétences, j'utilise un exercice réaliste et une grille écrite, et je recueille des retours indépendants avant toute discussion. »
- Piège en question de relance : « Comment savez-vous que le mentoring fonctionne ? » Suivez la progression par rapport aux objectifs convenus : délai avant la première fonctionnalité réalisée en autonomie, périmètre des tickets pris en charge, évolution des commentaires de review, et ses propres retours en 1:1.
- Compromis : les exercices à la maison sont réalistes mais coûtent du temps aux candidats et peuvent désavantager ceux qui ont moins de temps libre ; gardez-les courts, rémunérez-les, ou proposez une alternative en pair programming en direct.
