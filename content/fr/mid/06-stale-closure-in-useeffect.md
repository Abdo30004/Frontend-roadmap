# Un callback dans useEffect([]) lit une valeur périmée. Pourquoi, et comment corriger ?

**Niveau :** Mid
**Merged from (original phrasings):**
- Un callback dans useEffect([]) lit une valeur périmée. Pourquoi, et comment corriger ?

## The concept (short answer)
- Chaque rendu d'un composant fonction est un **nouvel appel de fonction** avec ses propres props, son propre state et ses propres fonctions. Les closures créées pendant ce rendu **capturent les valeurs de ce rendu**.
- `useEffect(fn, [])` ne s'exécute **qu'après le premier rendu**. Tout callback qu'il enregistre (intervalle, event listener, handler WebSocket) garde pour toujours la closure du rendu n°1, et voit donc le state et les props **initiaux**. C'est une stale closure (closure périmée).
- Ce n'est pas un bug de React. C'est le fonctionnement normal des closures JavaScript, combiné à un tableau de dépendances vide qui ment sur ce que l'effect utilise.
- Solutions, de la meilleure à la plus spécifique :
  1. **Déclarer les vraies dépendances** (l'effect se réabonne quand elles changent). Faites confiance à la règle de lint `react-hooks/exhaustive-deps`.
  2. **Updater fonctionnel** `setX(prev => ...)` quand vous n'avez besoin que du state précédent pour calculer le suivant.
  3. **Ref contenant la dernière valeur** (`latestRef.current = value`) quand vous devez lire la valeur courante sans vous réabonner.
  4. `useEffectEvent` (stable depuis React 19.2) : une fonction appelée depuis l'effect qui voit toujours les dernières props et le dernier state, sans être une dépendance.

## Real-life example: the problem
Un widget de chat de support client propose une option « me notifier ». Quand un nouveau message arrive par le WebSocket, il doit jouer un son uniquement si les notifications sont activées, et afficher le nombre de messages non lus. Les utilisateurs **désactivent** les notifications, mais le son continue. Le compteur de non-lus reste aussi bloqué à 1, quel que soit le nombre de messages reçus.

```jsx
function SupportChat({ ticketId }) {
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const socket = connectToTicket(ticketId);
    socket.on('message', (msg) => {
      if (soundOn) playPing();       // toujours la valeur initiale : true
      setUnread(unread + 1);          // toujours 0 + 1 = 1
    });
    return () => socket.disconnect();
  }, []); // BUG : utilise soundOn, unread et ticketId mais n'en déclare aucun

  return (
    <>
      <label>
        <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
        Sound
      </label>
      <Badge count={unread} />
    </>
  );
}
```
Trois bugs pour un seul tableau vide : `soundOn` périmé, `unread` périmé, et le socket ne se reconnecte pas quand l'utilisateur passe à un autre ticket.

## How to fix it
```jsx
import { useEffect, useEffectEvent, useState } from 'react';

function SupportChat({ ticketId }) {
  const [soundOn, setSoundOn] = useState(true);
  const [unread, setUnread] = useState(0);

  // Lit la DERNIÈRE valeur de soundOn, sans être une dépendance de l'effect
  const onMessage = useEffectEvent(() => {
    if (soundOn) playPing();
  });

  useEffect(() => {
    const socket = connectToTicket(ticketId);
    socket.on('message', () => {
      setUnread((n) => n + 1); // updater : pas besoin de lire unread
      onMessage();
    });
    return () => socket.disconnect();
  }, [ticketId]); // la seule vraie dépendance réactive : se reconnecter quand le ticket change

  // ...même JSX
}
```
Pourquoi ça marche :
- `setUnread(n => n + 1)` demande à React la valeur courante, donc la closure n'a pas besoin de `unread`.
- `useEffectEvent` fournit une fonction qui lit toujours la dernière valeur de `soundOn`. Activer ou couper le son ne reconnecte **pas** le socket, ce qui est correct : ce n'est pas une raison de se reconnecter.
- `ticketId` est une vraie dépendance, donc changer de ticket exécute le cleanup (déconnexion) puis se connecte au nouveau ticket.

### Sans useEffectEvent (React 18 ou versions 19.x plus anciennes) : le pattern de la « latest ref »
```jsx
const soundOnRef = useRef(soundOn);
useEffect(() => {
  soundOnRef.current = soundOn; // synchroniser la ref après chaque commit
}, [soundOn]);

useEffect(() => {
  const socket = connectToTicket(ticketId);
  socket.on('message', () => {
    setUnread((n) => n + 1);
    if (soundOnRef.current) playPing(); // les refs sont mutables, donc toujours à jour
  });
  return () => socket.disconnect();
}, [ticketId]);
```
L'alternative la plus simple consiste à ajouter `soundOn` au tableau de dépendances. C'est correct, mais cela reconnecte le socket à chaque bascule, ce qui est du gaspillage ici. Pour un simple `setInterval` peu coûteux, ajouter la dépendance convient généralement.

## How to say it in the interview
- « Chaque rendu a sa propre closure. Un effect avec `[]` ne capture que les valeurs du premier rendu, donc les callbacks qu'il enregistre voient un state périmé. Le tableau vide ment sur les dépendances. »
- « Mon ordre de priorité : les bonnes dépendances, puis un updater fonctionnel, puis une ref ou `useEffectEvent` pour les valeurs que je veux lire sans y réagir. »
- Piège : désactiver la règle de lint `exhaustive-deps` pour « corriger » l'avertissement. C'est exactement comme ça que les stale closures arrivent en production.
- Compromis : davantage de dépendances, c'est correct mais cela peut provoquer des réabonnements. Les refs évitent ça mais ne sont pas réactives : modifier une ref ne déclenche jamais de rendu.
