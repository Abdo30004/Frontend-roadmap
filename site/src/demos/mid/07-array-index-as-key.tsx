import { useState } from 'react';
import { Browser, Button, Code, Input, Note, Resettable, Row, Stack } from '../../demo-kit';

export const scenario = 'A shopping list where each item has its own note field. The notes are typed by the user (uncontrolled inputs).';
export const task = 'Remove "Milk". Then look at which note sits next to "Bread" and "Eggs".';
export const solutionNote = 'Same list, keyed by item.id instead of the array index.';

interface Item {
  id: string;
  name: string;
  note: string;
}

const INITIAL: Item[] = [
  { id: 'milk', name: 'Milk', note: '2 litres, semi-skimmed' },
  { id: 'bread', name: 'Bread', note: 'whole wheat' },
  { id: 'eggs', name: 'Eggs', note: 'free range, 12' },
];

function ShoppingList({ keyByIndex, reset }: { keyByIndex: boolean; reset: () => void }) {
  const [items, setItems] = useState(INITIAL);
  return (
    <Stack gap={12}>
      <Browser url="groceries.example/list">
        <Stack gap={8}>
          {items.map((item, index) => (
            <Row key={keyByIndex ? index : item.id} gap={10} wrap={false}>
              <strong style={{ width: 56, flex: 'none' }}>{item.name}</strong>
              {/* uncontrolled input: React only sets defaultValue on mount */}
              <Input defaultValue={item.note} aria-label={`Note for ${item.name}`} style={{ flex: 1 }} />
              <Button tone="ghost" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
                Remove
              </Button>
            </Row>
          ))}
          {items.length === 0 && <Note>The list is empty.</Note>}
          <Row>
            <Button onClick={reset}>Reset list</Button>
          </Row>
        </Stack>
      </Browser>
      <Code>
        {keyByIndex
          ? `items.map((item, index) => (\n  <Row key={index}> ... <input defaultValue={item.note} /> ...`
          : `items.map((item) => (\n  <Row key={item.id}> ... <input defaultValue={item.note} /> ...`}
      </Code>
    </Stack>
  );
}

export function Problem() {
  return <Resettable>{(reset) => <ShoppingList keyByIndex reset={reset} />}</Resettable>;
}

export function Solution() {
  return <Resettable>{(reset) => <ShoppingList keyByIndex={false} reset={reset} />}</Resettable>;
}
