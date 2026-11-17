# Comment fonctionne la fonction de cleanup de useEffect, et pourquoi le démontage est-il important ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Comment fonctionne la fonction de cleanup dans « useEffect » ?
- À quoi sert la phase de démontage (unmounting) dans React ?

## The concept (short answer)
- La fonction que vous **retournez** depuis un effect est le cleanup. React l'appelle :
  1. **Avant de réexécuter l'effect** parce qu'une dépendance a changé (cleanup avec les *anciennes* valeurs, puis effect avec les nouvelles).
  2. **Quand le composant est démonté** (retiré de l'arbre, changement de route, rendu conditionnel qui passe à false, changement de `key`).
- Le démontage est le moment de **libérer tout ce que le composant a lancé en dehors de React** : timers, intervalles, event listeners, connexions WebSocket/SSE, abonnements, fetchs en cours (`AbortController`), widgets tiers (cartes, graphiques), observers.
- Si vous oubliez le cleanup, vous obtenez des **fuites mémoire**, des listeners en double, des timers qui continuent de se déclencher et des réponses réseau qui mettent à jour le state d'un composant disparu ou qui affiche désormais d'autres données.
- Voyez chaque effect comme une paire : **le setup et le cleanup doivent être le miroir l'un de l'autre**. Si vous faites `addEventListener`, vous faites `removeEventListener` avec la même référence de fonction.
- **StrictMode (dev uniquement)** : React 18+ monte chaque composant, puis **exécute immédiatement le cleanup et l'effect à nouveau** (montage -> démontage -> montage). C'est volontaire : cela révèle les cleanups manquants ou incorrects. Si votre app casse ou s'abonne deux fois en dev, votre cleanup est incomplet. Cela n'arrive pas en production.

## Real-life example: the problem
Dans une app de VTC, l'écran « Chauffeur en route » interroge la position du chauffeur toutes les 3 secondes et écoute `visibilitychange` pour mettre le polling en pause quand l'onglet est masqué. Après que les utilisateurs ont ouvert et fermé l'écran plusieurs fois (ou basculé entre plusieurs courses), l'onglet réseau montre 5 à 6 boucles de polling en parallèle, la batterie se vide, et parfois la carte affiche le chauffeur de la course **précédente**, parce qu'un ancien intervalle écrit encore dans le state.

```jsx
function DriverTracker({ rideId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/rides/${rideId}/driver-location`);
      setPosition(await res.json()); // peut concerner un ancien rideId
    }, 3000);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(id);
    });
    // BUG : pas de cleanup. L'intervalle et le listener vivent indéfiniment.
  }, [rideId]);

  return <DriverMap position={position} />;
}
```
En développement avec StrictMode, le bug apparaît immédiatement : deux intervalles dès le premier montage, car l'effect s'exécute deux fois et rien n'est nettoyé.

## How to fix it
```jsx
function DriverTracker({ rideId }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    let intervalId = null;
    let controller = null;

    const poll = async () => {
      controller?.abort();                 // annuler la requête précédente
      controller = new AbortController();
      try {
        const res = await fetch(`/api/rides/${rideId}/driver-location`, {
          signal: controller.signal,
        });
        setPosition(await res.json());
      } catch (err) {
        if (err.name !== 'AbortError') console.error(err);
      }
    };

    const start = () => {
      if (intervalId === null) {
        poll();
        intervalId = setInterval(poll, 3000);
      }
    };
    const stop = () => {
      clearInterval(intervalId);
      intervalId = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener('visibilitychange', onVisibility);

    // Cleanup : s'exécute avant le prochain rideId et au démontage
    return () => {
      stop();
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility); // même référence
    };
  }, [rideId]);

  return <DriverMap position={position} />;
}
```
Pourquoi ça marche : chaque ressource créée par l'effect est libérée dans le cleanup. Quand `rideId` change, l'ancien intervalle, l'ancienne requête et l'ancien listener sont supprimés **avant** que les nouveaux ne démarrent, donc les anciennes données ne peuvent pas écraser les nouvelles. Au démontage, plus rien ne tourne. Le double appel de StrictMode se contente maintenant de démarrer, arrêter et redémarrer, ce qui est sans danger.

Alternatives : pour le polling de données serveur, TanStack Query (`refetchInterval`, `refetchIntervalInBackground: false`) gère ce cycle de vie pour vous. Pour les stores externes, `useSyncExternalStore` gère l'abonnement et le désabonnement.

### Ordre d'exécution à retenir
```
mount:              render -> commit -> effect(rideId=1)
rideId changes:     render -> commit -> cleanup(rideId=1) -> effect(rideId=2)
unmount:            cleanup(rideId=2)
StrictMode (dev):   effect -> cleanup -> effect   (au premier montage uniquement)
```

## How to say it in the interview
- « Le cleanup est le miroir du setup. React l'exécute avant de relancer l'effect et au démontage, donc un composant ne laisse jamais derrière lui de timers, de listeners ou de requêtes. »
- « En développement, StrictMode monte, démonte puis remonte. Si cela casse quelque chose, c'est que le cleanup manque. La solution est d'écrire un cleanup correct, pas d'ajouter un flag `useRef` qui saute la deuxième exécution. »
- Piège : `removeEventListener` avec une nouvelle arrow function inline ne fait rien, car c'est une référence de fonction différente.
- Compromis / relance : tous les effects n'ont pas besoin de cleanup (par exemple, modifier `document.title`), mais tout ce qui s'abonne, planifie ou fetch en a besoin.
