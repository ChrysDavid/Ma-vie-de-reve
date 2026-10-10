/** Shared lighting mood, driven by the HUD (Pinia) and applied by Environment, Lighting and PostFX. */
export type TimeOfDay = 'day' | 'sunset' | 'night';

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  day: 'Jour',
  sunset: 'Coucher de soleil',
  night: 'Nuit',
};
