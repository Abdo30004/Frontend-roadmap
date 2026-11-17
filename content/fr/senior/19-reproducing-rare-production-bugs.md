# Reproduire un bug de rendu qui ne touche que 1 % des utilisateurs

**Niveau :** Senior
**Merged from (original phrasings):**
- Un bug de rendu ne touche que 1 % des utilisateurs. Comment le reproduiriez-vous ?

## The concept (short answer)
- « 1 % des utilisateurs » signifie que **ces utilisateurs ont quelque chose de différent**. Votre travail consiste à trouver la dimension qui les distingue, pas à cliquer au hasard sur votre ordinateur.
- **Segmentez** les sessions touchées dans votre outil d'erreurs/RUM par navigateur + version, OS, appareil, locale/fuseau horaire, viewport, feature flags/variante d'expérimentation, release, type de compte, réseau, et présence d'extensions (URLs d'extensions dans les frames de la stack). Comparez avec la référence des sessions non touchées : la dimension où le ratio bondit est votre piste.
- Utilisez le **session replay** et les **breadcrumbs** (clics, changements de route, appels d'API, logs console avant l'erreur) pour voir la séquence exacte et les données qu'avait l'utilisateur.
- **Reproduisez dans l'environnement correspondant** : vrais appareils/navigateurs sur BrowserStack ou Sauce Labs, Playwright avec WebKit/Firefox, locale/fuseau horaire émulés (`--lang`, `TZ=`), même variante de flag, mêmes données utilisateur (une copie anonymisée de son enregistrement).
- Si vous n'arrivez toujours pas à reproduire, **formulez une hypothèse et ajoutez des logs ciblés** (la valeur brute en entrée, le chemin de code emprunté) dans une release, puis confirmez-la ou écartez-la avec les données. Une fois le bug reproduit, écrivez d'abord un test qui échoue, puis corrigez.

## Real-life example: the problem
Un cas typique : une application de prise de rendez-vous pour une clinique. Environ 1 % des utilisateurs signalent que « le calendrier est vide », et l'outil de suivi d'erreurs affiche `RangeError: Invalid time value` venant de la liste des créneaux. Les développeurs sur Chrome sous macOS n'arrivent pas à le reproduire. En segmentant l'erreur dans l'outil, on voit que 97 % des événements viennent de **Safari iOS 15 et 16** et de Safari 15 desktop ; les flags, la locale et la release sont répartis uniformément. Les breadcrumbs montrent que l'erreur se déclenche juste après le retour en 200 de `GET /api/slots`. Le session replay montre le skeleton du calendrier, puis un écran d'erreur de repli.

L'API renvoie des timestamps au format base de données, et le client les parse avec le constructeur `Date` :

```json
// GET /api/slots
[{ "id": 18, "start": "2026-03-29 14:00:00", "doctor": "Dr. Lee" }]
```

```tsx
// SlotList.tsx - CASSÉ
import { format } from 'date-fns';

export function SlotList({ slots }: { slots: Slot[] }) {
  return (
    <ul>
      {slots.map((s) => (
        <li key={s.id}>
          {/* "YYYY-MM-DD HH:mm:ss" (espace, pas de T) n'est PAS une chaîne ISO-8601.
              Chrome/Firefox sont permissifs et l'interprètent en heure locale ;
              les anciennes versions de Safari renvoient Invalid Date -> format() lève une exception */}
          {format(new Date(s.start), 'EEE d MMM, HH:mm')} - {s.doctor}
        </li>
      ))}
    </ul>
  );
}
```

## How to fix it
**Étape 1 : reproduire de façon déterministe.** Ouvrez la page sur un vrai iPhone/Safari 15 via BrowserStack, confirmez que le calendrier est vide et récupérez l'entrée qui pose problème. Puis verrouillez le cas dans un test multi-navigateurs :

```ts
// slots.spec.ts - Playwright, exécuté pour les projets chromium, firefox ET webkit
test('renders slots from API timestamps', async ({ page }) => {
  await page.route('**/api/slots', (r) =>
    r.fulfill({ json: [{ id: 18, start: '2026-03-29 14:00:00', doctor: 'Dr. Lee' }] }));
  await page.goto('/book');
  await expect(page.getByText('Sun 29 Mar, 14:00 - Dr. Lee')).toBeVisible();
});
```
```ts
// playwright.config.ts
projects: [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'webkit',   use: { ...devices['iPhone 13'], locale: 'en-GB', timezoneId: 'Europe/London' } },
],
```

**Étape 2 : corriger le contrat et le parsing.**
```ts
// Serveur : renvoyer de l'ISO 8601 sans ambiguïté, avec un offset : "2026-03-29T14:00:00+01:00"

// Client : ne jamais utiliser new Date(string) sur une entrée non ISO ; parser explicitement
import { parseISO, isValid, format } from 'date-fns';

export function parseSlotTime(raw: string): Date | null {
  const d = parseISO(raw);                      // le parser propre à date-fns : accepte "T" ou un espace,
                                                // même résultat dans tous les navigateurs
  if (!isValid(d)) {
    Sentry.captureMessage('Unparseable slot time', { extra: { raw } });
    return null;
  }
  return d;
}

export function SlotList({ slots }: { slots: Slot[] }) {
  return (
    <ul>
      {slots.map((s) => {
        const start = parseSlotTime(s.start);
        return (
          <li key={s.id}>
            {start ? format(start, 'EEE d MMM, HH:mm') : 'Time unavailable'} - {s.doctor}
          </li>
        );
      })}
    </ul>
  );
}
```

Pourquoi ça fonctionne : `parseISO` parse explicitement au lieu de s'appuyer sur le parsing de repli, plus ou moins permissif, que chaque moteur applique aux chaînes non standard, donc tous les navigateurs sont d'accord ; l'offset supprime l'ambiguïté de fuseau horaire ; une valeur invalide ne dégrade plus qu'une seule ligne au lieu de faire planter la liste ; le projet de test WebKit empêche les régressions.

**Si la segmentation n'avait pas désigné un navigateur**, la même méthode s'applique aux autres suspects habituels :
- **Locale/fuseau horaire** : sortie de `toLocaleString` re-parsée, trous liés au changement d'heure (un créneau à 02:30 qui n'existe pas le jour du changement), différences d'`Intl`. Testez avec `timezoneId`/`locale` dans Playwright.
- **Feature flag / variante d'expérimentation** : comparez le taux d'erreur par variante ; reproduisez en forçant le flag.
- **Extensions de navigateur** (traduction, bloqueurs de pub, gestionnaires de mots de passe) qui modifient le DOM : frames `chrome-extension://` dans les stacks, erreurs d'hydratation React, `removeChild` sur un nœud qui n'est pas un enfant. Reproduisez avec l'extension installée.
- **Forme des données** : un client avec un tableau vide, un nom très long ou un champ null. Reproduisez avec une copie anonymisée de ses données.

## How to say it in the interview
- « Je pars des données, pas de ma machine : je segmente les sessions touchées par rapport aux autres, par navigateur, OS, locale, fuseau horaire, flags, release et extensions, jusqu'à ce qu'une dimension ressorte. »
- « Ensuite, j'utilise les replays et les breadcrumbs pour obtenir l'entrée exacte, je reproduis sur un vrai appareil correspondant, et je fige le cas dans un test qui échoue avant de corriger. »
- Piège en question de relance : « Et si vous n'arrivez toujours pas à reproduire ? » Livrez des logs ciblés sur les entrées suspectes (encadrés, sans données personnelles) et traitez-les comme le test d'une hypothèse ; ajoutez aussi un repli défensif pour que les utilisateurs ne soient pas bloqués en attendant.
- Compromis : le session replay et les logs verbeux coûtent de l'argent et posent des questions de confidentialité ; échantillonnez-les, masquez les saisies, et activez-les sur erreur plutôt que pour tout le monde.
