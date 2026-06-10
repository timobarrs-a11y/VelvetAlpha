export interface FlightSnapshot {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface HitInput {
  power: number;
  timingErrorMs: number;
}

export interface HitResult {
  exitVelocity: number;
  launchAngle: number;
  sprayAngle: number;
  qualityLabel: 'Perfect' | 'Good' | 'Late' | 'Early' | 'Miss';
}

const GRAVITY_FTPS2 = 32;
const DRAG_FACTOR = 0.992;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function computeHitResult(input: HitInput): HitResult {
  const absTiming = Math.abs(input.timingErrorMs);
  const timingScore = clamp(1 - absTiming / 260, 0, 1);
  const power = clamp(input.power, 0, 1);

  const exitVelocity = 65 + power * 55 + timingScore * 25;
  const launchBase = 20 + power * 22;
  const timingBias = input.timingErrorMs > 0 ? -5 : 5;
  const launchAngle = clamp(launchBase + timingBias * (1 - timingScore), 8, 50);
  const sprayAngle = clamp((input.timingErrorMs / 260) * 25, -35, 35);

  let qualityLabel: HitResult['qualityLabel'] = 'Good';
  if (absTiming <= 30) {
    qualityLabel = 'Perfect';
  } else if (absTiming <= 100) {
    qualityLabel = 'Good';
  } else {
    qualityLabel = input.timingErrorMs > 0 ? 'Late' : 'Early';
  }

  return {
    exitVelocity,
    launchAngle,
    sprayAngle,
    qualityLabel,
  };
}

export function initializeBallFlight(hit: HitResult): FlightSnapshot {
  const launchRadians = (hit.launchAngle * Math.PI) / 180;
  const sprayRadians = (hit.sprayAngle * Math.PI) / 180;

  const horizontalSpeed = hit.exitVelocity * Math.cos(launchRadians);
  return {
    x: 0,
    y: 0,
    z: 2.5,
    vx: horizontalSpeed * Math.cos(sprayRadians),
    vy: horizontalSpeed * Math.sin(sprayRadians),
    vz: hit.exitVelocity * Math.sin(launchRadians),
  };
}

export function stepBallFlight(current: FlightSnapshot, deltaSeconds: number): FlightSnapshot {
  const nextVx = current.vx * DRAG_FACTOR;
  const nextVy = current.vy * DRAG_FACTOR;
  const nextVz = (current.vz - GRAVITY_FTPS2 * deltaSeconds) * DRAG_FACTOR;

  return {
    x: current.x + nextVx * deltaSeconds,
    y: current.y + nextVy * deltaSeconds,
    z: current.z + nextVz * deltaSeconds,
    vx: nextVx,
    vy: nextVy,
    vz: nextVz,
  };
}
