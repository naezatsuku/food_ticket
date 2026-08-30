import type { Person, TimeSlot } from "./types";

/** その枠が、本人の申告した時間帯にすっぽり収まっているか(ハード制約) */
export function isPersonAvailableForSlot(person: Person, slot: TimeSlot): boolean {
  return person.available.some((r) => r.start <= slot.start && slot.end <= r.end);
}
