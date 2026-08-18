export const WEAPONS = Object.freeze({
  sword: { reach: 1.25, stamina: 12, windup: 0.28, recovery: 0.42, slash: 28, pierce: 10, armorPierce: 0.2 },
  spear: { reach: 2.15, stamina: 10, windup: 0.34, recovery: 0.5, slash: 8, pierce: 34, armorPierce: 0.38 },
  axe: { reach: 1.15, stamina: 16, windup: 0.42, recovery: 0.58, slash: 36, pierce: 6, armorPierce: 0.32 },
  bow: { reach: 30, stamina: 8, windup: 0.55, recovery: 0.35, slash: 0, pierce: 26, armorPierce: 0.28 },
});

export const ARMOR = Object.freeze({
  cloth: { slash: 0.05, pierce: 0.02, weight: 0 },
  leather: { slash: 0.18, pierce: 0.12, weight: 0.08 },
  mail: { slash: 0.42, pierce: 0.3, weight: 0.18 },
  plate: { slash: 0.62, pierce: 0.48, weight: 0.3 },
});

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function staminaCost(weaponId, armorId = "cloth", sprinting = false) {
  const weapon = WEAPONS[weaponId] || WEAPONS.sword;
  const armor = ARMOR[armorId] || ARMOR.cloth;
  return weapon.stamina * (1 + armor.weight * 0.7) + (sprinting ? 5 : 0);
}

export function canAttack({ stamina = 0, weapon = "sword", armor = "cloth", cooldown = 0 } = {}) {
  return cooldown <= 0 && stamina >= staminaCost(weapon, armor, false);
}

export function blockResult({ incoming = 0, shieldCoverage = 0, facingDot = 1, blockStamina = 0, parryWindow = false } = {}) {
  const coverage = clamp(shieldCoverage, 0, 1);
  const facing = clamp((facingDot + 1) / 2, 0, 1);
  const effective = coverage * facing;
  if (parryWindow && effective >= 0.5 && blockStamina >= incoming * 0.15) return { outcome: "parry", damageMultiplier: 0, staminaDamage: incoming * 0.12 };
  if (effective >= 0.45 && blockStamina > 0) return { outcome: "block", damageMultiplier: clamp(1 - effective * 0.85, 0.1, 0.75), staminaDamage: incoming * 0.35 };
  return { outcome: "hit", damageMultiplier: 1, staminaDamage: 0 };
}

export function meleeDamage({ weapon = "sword", armor = "cloth", attackType = "slash", speed = 1, charge = 1, formationCharge = 1, blockedMultiplier = 1 } = {}) {
  const w = WEAPONS[weapon] || WEAPONS.sword;
  const a = ARMOR[armor] || ARMOR.cloth;
  const base = attackType === "pierce" ? w.pierce : w.slash;
  const protection = attackType === "pierce" ? a.pierce : a.slash;
  const effectiveProtection = protection * (1 - w.armorPierce);
  return Math.max(1, base * clamp(speed, 0.5, 1.5) * clamp(charge, 0.7, 1.5) * clamp(formationCharge, 0.7, 1.5) * (1 - effectiveProtection) * clamp(blockedMultiplier, 0, 1));
}

export function projectileAt({ originX = 0, originY = 0, originZ = 1.6, velocityX = 0, velocityY = 0, velocityZ = 0, time = 0, gravity = 9.81 } = {}) {
  const t = Math.max(0, time);
  return { x: originX + velocityX * t, y: originY + velocityY * t, z: originZ + velocityZ * t - 0.5 * gravity * t * t };
}

export function recoverStamina(current, max, dtSeconds, { blocking = false, sprinting = false, armor = "cloth" } = {}) {
  const a = ARMOR[armor] || ARMOR.cloth;
  if (blocking || sprinting) return clamp(current, 0, max);
  const rate = 14 * (1 - a.weight * 0.65);
  return clamp(current + rate * Math.max(0, dtSeconds), 0, max);
}
