# Quelle est la différence entre props et state en React ?

**Niveau :** Junior
**Merged from (original phrasings):**
- Expliquez la différence entre props et state en React.

## The concept (short answer)
- Les **props** sont les entrées qu'un composant reçoit **de son parent**, comme les arguments d'une fonction. Elles sont **en lecture seule** dans l'enfant : l'enfant ne doit jamais les modifier.
- Le **state** est une donnée que le composant **possède et gère lui-même** (avec `useState` / `useReducer`). Il peut évoluer dans le temps, généralement suite à des actions de l'utilisateur ou à un chargement de données.
- Modifier le state avec le setter (`setX`) indique à React qu'il doit faire un **re-render** du composant. Quand un parent fait un re-render avec de nouvelles props, l'enfant fait aussi un re-render.
- Les données circulent dans **un seul sens** : vers le bas, via les props. Un enfant communique avec son parent en appelant une **fonction passée en prop** (par exemple `onChange`).
- Si deux composants ont besoin des mêmes données, **remontez le state** (lift state up) jusqu'à leur parent commun le plus proche et transmettez-le en props.
- Ne copiez pas des props dans le state (« derived state ») sauf si vous voulez vraiment uniquement la valeur initiale ; calculez plutôt la valeur pendant le rendu.

| | Props | State |
|---|---|---|
| Qui le possède | le parent | le composant lui-même |
| Le composant peut-il le modifier ? | non | oui, via le setter |
| Un changement déclenche un re-render | oui (le parent fait un re-render) | oui |

## Real-life example: the problem
Imaginez un site de réservation d'hôtels. La page affiche un `RoomPicker` et, dans l'en-tête, un `PriceSummary`. Quand l'utilisateur choisissait une autre chambre, le sélecteur la mettait en surbrillance mais le **prix dans l'en-tête ne changeait pas**. De plus, quand l'utilisateur ouvrait un autre hôtel, le sélecteur **affichait toujours la chambre sélectionnée de l'ancien hôtel**.

Deux bugs : l'enfant essaie de muter une prop (React l'ignore, rien ne fait de re-render), et il copie une prop dans le state une seule fois, donc les changements ultérieurs de la prop sont ignorés.

```jsx
// BUGUÉ
function BookingPage({ hotel }) {
  const booking = { roomId: hotel.rooms[0].id };

  return (
    <>
      <PriceSummary hotel={hotel} roomId={booking.roomId} />
      <RoomPicker hotel={hotel} booking={booking} />
    </>
  );
}

function RoomPicker({ hotel, booking }) {
  // copié une seule fois au montage ; ignore les changements ultérieurs de `hotel`
  const [selected, setSelected] = useState(booking.roomId);

  function choose(roomId) {
    setSelected(roomId);
    booking.roomId = roomId; // mutation d'une prop : le parent ne fait pas de re-render
  }

  return hotel.rooms.map((room) => (
    <button key={room.id} aria-pressed={room.id === selected} onClick={() => choose(room.id)}>
      {room.name}
    </button>
  ));
}

function PriceSummary({ hotel, roomId }) {
  const room = hotel.rooms.find((r) => r.id === roomId);
  return <p>Total: ${room.pricePerNight}</p>;
}
```

## How to fix it
Remontez la chambre sélectionnée dans le **state du parent**, transmettez la valeur en prop, et passez un callback pour que l'enfant puisse demander au parent de la modifier.

```jsx
// CORRIGÉ
import { useState } from 'react';

function BookingPage({ hotel }) {
  const [roomId, setRoomId] = useState(hotel.rooms[0].id); // source de vérité unique

  return (
    <>
      <PriceSummary hotel={hotel} roomId={roomId} />
      <RoomPicker rooms={hotel.rooms} selectedId={roomId} onSelect={setRoomId} />
    </>
  );
}

function RoomPicker({ rooms, selectedId, onSelect }) {
  // pas de copie locale : il affiche simplement les props et signale les clics
  return rooms.map((room) => (
    <button
      key={room.id}
      aria-pressed={room.id === selectedId}
      onClick={() => onSelect(room.id)}
    >
      {room.name}
    </button>
  ));
}

function PriceSummary({ hotel, roomId }) {
  const room = hotel.rooms.find((r) => r.id === roomId); // calculé pendant le rendu
  return <p>Total: ${room.pricePerNight}</p>;
}

// Réinitialiser tout le state de réservation quand l'hôtel change :
// <BookingPage key={hotel.id} hotel={hotel} />
```

Pourquoi ça marche : il n'y a qu'une seule source de vérité (`roomId` dans `BookingPage`). Appeler `setRoomId` provoque un re-render du parent, et les deux enfants reçoivent la nouvelle valeur en props. Donner à `BookingPage` une `key={hotel.id}` force React à créer un nouveau composant (avec un state neuf) quand l'hôtel change : plus de sélection obsolète.

Alternative : si de nombreux composants éloignés ont besoin des mêmes données, utilisez React Context ou un store (Zustand, Redux) plutôt que de faire passer des props à travers de nombreux niveaux (« prop drilling »).

## How to say it in the interview
- « Les props sont transmises par le parent et sont en lecture seule ; le state appartient au composant et se modifie avec son setter, ce qui déclenche un re-render. »
- « Les données descendent via les props, les événements remontent via des props de type callback. Si des composants frères ont besoin des mêmes données, je remonte le state jusqu'à leur parent commun. »
- Piège : copier des props dans le state (`useState(props.value)`) n'utilise que la valeur **initiale** ; les changements ultérieurs de la prop sont ignorés. Calculez les valeurs pendant le rendu ou réinitialisez avec une `key`.
- Compromis : remonter le state provoque le re-render de plus de composants ; pour des arbres profonds, utilisez la composition ou le Context, et gardez le state au plus près de l'endroit où il est utilisé.
