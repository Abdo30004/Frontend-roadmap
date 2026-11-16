import { useState } from 'react';
import { Badge, Browser, Button, Code, Panel, Row, Stack } from '../../demo-kit';

export const scenario = 'A hotel-booking page: pick a room below, and the header shows the price for your 2-night stay. You can also switch hotels.';
export const task = 'Pick "Suite" and check the header total. Then switch to the other hotel and compare the highlighted room with the header.';
export const solutionNote = 'Same page, but the selected room is state in the parent, passed down as a prop with an onSelect callback.';

interface Room { id: string; name: string; pricePerNight: number }
interface Hotel { id: string; name: string; rooms: Room[] }

const HOTELS: Hotel[] = [
  { id: 'lisbon', name: 'Casa Alfama, Lisbon', rooms: [
    { id: 'std', name: 'Standard', pricePerNight: 90 },
    { id: 'dlx', name: 'Deluxe', pricePerNight: 140 },
    { id: 'ste', name: 'Suite', pricePerNight: 260 },
  ] },
  { id: 'rome', name: 'Hotel Trastevere, Rome', rooms: [
    { id: 'std', name: 'Standard', pricePerNight: 110 },
    { id: 'dlx', name: 'Deluxe', pricePerNight: 175 },
    { id: 'ste', name: 'Suite', pricePerNight: 320 },
  ] },
];

function PriceSummary({ hotel, roomId }: { hotel: Hotel; roomId: string }) {
  const room = hotel.rooms.find((r) => r.id === roomId) ?? hotel.rooms[0];
  return (
    <Row gap={8}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{hotel.name}</span>
      <Badge tone="info">{room.name}</Badge>
      <strong>Total: ${room.pricePerNight * 2}</strong>
    </Row>
  );
}

function RoomButton({ room, pressed, onClick }: { room: Room; pressed: boolean; onClick: () => void }) {
  return (
    <Button tone={pressed ? 'primary' : 'default'} aria-pressed={pressed} onClick={onClick}>
      {room.name} · ${room.pricePerNight}
    </Button>
  );
}

/* ---------- BROKEN ---------- */
function BrokenRoomPicker({ hotel, booking }: { hotel: Hotel; booking: { roomId: string } }) {
  const [selected, setSelected] = useState(booking.roomId); // copied once on mount
  function choose(roomId: string) {
    setSelected(roomId);
    booking.roomId = roomId; // mutating a prop: the parent does not re-render
  }
  return <Row>{hotel.rooms.map((room) => <RoomButton key={room.id} room={room} pressed={room.id === selected} onClick={() => choose(room.id)} />)}</Row>;
}

function BrokenBookingPage({ hotel }: { hotel: Hotel }) {
  const booking = { roomId: hotel.rooms[0].id };
  return (
    <Stack gap={12}>
      <Panel title="Your stay"><PriceSummary hotel={hotel} roomId={booking.roomId} /></Panel>
      <BrokenRoomPicker hotel={hotel} booking={booking} />
    </Stack>
  );
}

/* ---------- FIXED ---------- */
function RoomPicker({ rooms, selectedId, onSelect }: { rooms: Room[]; selectedId: string; onSelect: (id: string) => void }) {
  return <Row>{rooms.map((room) => <RoomButton key={room.id} room={room} pressed={room.id === selectedId} onClick={() => onSelect(room.id)} />)}</Row>;
}

function BookingPage({ hotel }: { hotel: Hotel }) {
  const [roomId, setRoomId] = useState(hotel.rooms[0].id); // single source of truth
  return (
    <Stack gap={12}>
      <Panel title="Your stay"><PriceSummary hotel={hotel} roomId={roomId} /></Panel>
      <RoomPicker rooms={hotel.rooms} selectedId={roomId} onSelect={setRoomId} />
    </Stack>
  );
}

function BookingSite({ fixed }: { fixed: boolean }) {
  const [hotelId, setHotelId] = useState(HOTELS[0].id);
  const hotel = HOTELS.find((h) => h.id === hotelId) ?? HOTELS[0];

  return (
    <Stack gap={14}>
      <Browser url={`stays.example/hotels/${hotel.id}`}>
        <Stack gap={12}>
          <Row>
            {HOTELS.map((h) => (
              <Button key={h.id} tone={h.id === hotelId ? 'primary' : 'ghost'} onClick={() => setHotelId(h.id)}>
                {h.name.split(',')[1]?.trim() ?? h.name}
              </Button>
            ))}
          </Row>
          {fixed
            ? <BookingPage key={hotel.id} hotel={hotel} />
            : <BrokenBookingPage hotel={hotel} />}
        </Stack>
      </Browser>
      <Code>{fixed
        ? `const [roomId, setRoomId] = useState(hotel.rooms[0].id);\n<PriceSummary hotel={hotel} roomId={roomId} />\n<RoomPicker rooms={hotel.rooms} selectedId={roomId} onSelect={setRoomId} />\n// <BookingPage key={hotel.id} hotel={hotel} />`
        : `const booking = { roomId: hotel.rooms[0].id };\n// RoomPicker:\nconst [selected, setSelected] = useState(booking.roomId);\nfunction choose(id) { setSelected(id); booking.roomId = id; }`}</Code>
    </Stack>
  );
}

export function Problem() {
  return <BookingSite fixed={false} />;
}

export function Solution() {
  return <BookingSite fixed />;
}
