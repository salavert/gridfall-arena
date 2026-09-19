// Pure combat rules shared by the player, bots and behavioural tests.
export const VOLT_CHARGE_TIME = 0.85;
export const VOLT_MIN_CHARGE = 0.18;

export function voltShot(base, heldSeconds) {
  const charge = Math.max(0, Math.min(1, (heldSeconds - VOLT_MIN_CHARGE) / (VOLT_CHARGE_TIME - VOLT_MIN_CHARGE)));
  return {
    ...base,
    charge,
    spread: 0.55 + (0.085 - 0.55) * charge,
    range: 6.5 + 2.7 * charge,
    speed: 16 + 8 * charge,
    damage: Math.round(300 + 85 * charge),
    radius: 0.13 + 0.035 * charge,
    knockback: 1.2 + 2 * charge,
  };
}

export class ChargeTrigger {
  held = 0;
  active = false;
  blocked = false;

  cancel(held = false) {
    this.held = 0;
    this.active = false;
    this.blocked = held;
  }

  // Releases fire exactly once. Blocking until release prevents a shot after
  // pause, focus loss, running out of ammo or starting Overdrive while holding.
  step({ down, pressed = false, released = false, allowed, dt }) {
    if (!allowed) { this.cancel(down); return null; }
    if (this.blocked) {
      if (!down) this.blocked = false;
      return null;
    }
    if (down || pressed) this.active = true;
    if (down && this.active) this.held = Math.min(VOLT_CHARGE_TIME, this.held + dt);
    if (released && this.active) {
      const held = this.held;
      this.cancel();
      return held;
    }
    return null;
  }
}
