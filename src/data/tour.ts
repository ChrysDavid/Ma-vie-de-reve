import { LEVELS, ROOMS } from './floorplan';

export interface TourStop { title: string; text: string; x: number; y: number; z: number; yaw: number; pitch: number }
export interface TeleportTarget { label: string; x: number; y: number; z: number; yaw: number; pitch: number }

/** Center of a room's first rect, with floor height of its level. */
export function roomCenter(id: string) {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room ${id}`);
  const r = room.rects[0];
  return { x: (r.x0 + r.x1) / 2, y: LEVELS[room.level].floor, z: (r.z0 + r.z1) / 2 };
}

const PI = Math.PI;
export const TOUR: TourStop[] = [
  { title: 'La façade', text: 'Une architecture contemporaine, lignes pures et grandes baies vitrées.', x: 1, y: 0, z: 17, yaw: 0, pitch: 0.12 },
  { title: 'Le hall', text: "Un hall d'entrée lumineux qui distribue toute la maison.", x: 1.5, y: 0.15, z: 4, yaw: 0, pitch: 0.2 },
  { title: 'Le salon', text: 'Un vaste séjour ouvert sur la piscine, pensé pour recevoir.', x: 8, y: 0.15, z: -3, yaw: PI / 2, pitch: 0.2 },
  { title: 'La cuisine', text: 'Une cuisine ouverte et équipée, au cœur de la vie familiale.', x: -2, y: 0.15, z: -4, yaw: PI / 2, pitch: 0.2 },
  { title: 'La piscine', text: 'Une piscine à débordement face au jardin, pour des étés inoubliables.', x: 0, y: 0.13, z: -9, yaw: PI, pitch: 0.35 },
  { title: 'Le jardin', text: 'Un jardin paysager et son coin feu pour les soirées d’exception.', x: -20, y: 0, z: -30, yaw: 2.6, pitch: 0.2 },
  { title: 'La suite parentale', text: 'Un havre de calme à l’étage, avec dressing et salle de bain privée.', x: -4, y: 3.45, z: -2.5, yaw: PI, pitch: 0.2 },
  { title: 'La salle de bain', text: 'Marbre et lumière douce : un spa à domicile.', x: -8, y: 3.45, z: -4, yaw: PI / 4, pitch: 0.25 },
  { title: 'La terrasse', text: 'Une grande terrasse pour profiter du soleil en toute intimité.', x: 8, y: 3.45, z: 3, yaw: 0, pitch: 0.2 },
  { title: 'Le bureau', text: 'Un bureau calme et lumineux, idéal pour télétravailler.', x: 11.3, y: 0.15, z: 6.3, yaw: PI / 4, pitch: 0.25 },
];

export function teleportTargets(): TeleportTarget[] {
  const rooms = ROOMS.map((r) => {
    const c = roomCenter(r.id);
    return { label: r.name, ...c, yaw: 0, pitch: 0.1 };
  });
  return [
    ...rooms,
    { label: 'Piscine', x: 0, y: 0.13, z: -9, yaw: PI, pitch: 0.35 },
    { label: 'Jardin', x: -20, y: 0, z: -30, yaw: 2.6, pitch: 0.2 },
  ];
}
