/**
 * Câmera orbital (holo-table §5.1): yaw livre, pitch em [10°, 80°], distância em
 * [0,5×, 3×] do raio da mesa, inércia de 0,9 por quadro no arrasto e *fly-to* com
 * ease-in-out.
 */
import { clamp } from '@/lib/math';
import { lookAt, mat4, multiply, perspective, type Mat4 } from './mat4';
import { lerp3, type Vec3 } from './vec3';

const DEG = Math.PI / 180;
export const PITCH_MIN = 10 * DEG;
export const PITCH_MAX = 80 * DEG;
export const INERTIA = 0.9;
export const FOV_Y = 45 * DEG;

export const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export class OrbitCamera {
  yaw = 0.6;
  pitch = 40 * DEG;
  distance: number;
  target: Vec3 = [0, 0, 0];
  private velYaw = 0;
  private velPitch = 0;
  private fly: {
    from: Vec3;
    to: Vec3;
    fromD: number;
    toD: number;
    t: number;
    durationS: number;
  } | null = null;
  private readonly view = mat4();
  private readonly proj = mat4();
  readonly viewProj = mat4();

  constructor(public radius: number) {
    this.distance = 1.8 * radius;
  }

  /** Muda o raio da mesa (troca de dimensão): a distância acompanha, presa aos novos limites. */
  setRadius(radius: number): void {
    this.distance = clamp((this.distance / this.radius) * radius, 0.5 * radius, 3 * radius);
    this.radius = radius;
    this.fly = null;
  }

  get minDistance(): number {
    return 0.5 * this.radius;
  }

  get maxDistance(): number {
    return 3 * this.radius;
  }

  /** Arrasto em radianos; a velocidade fica para a inércia. */
  orbit(dYaw: number, dPitch: number): void {
    this.velYaw = dYaw;
    this.velPitch = dPitch;
    this.applyOrbit(dYaw, dPitch);
  }

  private applyOrbit(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = clamp(this.pitch + dPitch, PITCH_MIN, PITCH_MAX);
  }

  zoom(factor: number): void {
    this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance);
  }

  /** Voa até `target` (e, opcionalmente, até a distância `distance`) em `durationS`. */
  flyTo(target: Vec3, durationS: number, distance = this.distance): void {
    this.fly = {
      from: [...this.target] as Vec3,
      to: target,
      fromD: this.distance,
      toD: clamp(distance, this.minDistance, this.maxDistance),
      t: 0,
      durationS,
    };
  }

  get flying(): boolean {
    return this.fly !== null;
  }

  /** Avança a inércia (0,9 por quadro a 60 FPS) e o *fly-to*. */
  update(dtS: number, dragging = false): void {
    if (!dragging) {
      const k = INERTIA ** (dtS * 60);
      this.velYaw *= k;
      this.velPitch *= k;
      if (Math.abs(this.velYaw) + Math.abs(this.velPitch) > 1e-5)
        this.applyOrbit(this.velYaw, this.velPitch);
    }
    if (this.fly) {
      this.fly.t = Math.min(1, this.fly.t + dtS / this.fly.durationS);
      const e = easeInOut(this.fly.t);
      this.target = lerp3(this.fly.from, this.fly.to, e);
      this.distance = this.fly.fromD + (this.fly.toD - this.fly.fromD) * e;
      if (this.fly.t >= 1) this.fly = null;
    }
  }

  eye(): Vec3 {
    const cp = Math.cos(this.pitch);
    return [
      this.target[0] + this.distance * cp * Math.sin(this.yaw),
      this.target[1] + this.distance * Math.sin(this.pitch),
      this.target[2] + this.distance * cp * Math.cos(this.yaw),
    ];
  }

  /** view·projection para a proporção da tela. */
  matrix(aspect: number): Mat4 {
    lookAt(this.view, this.eye(), this.target, [0, 1, 0]);
    perspective(this.proj, FOV_Y, aspect, 0.05, 100);
    return multiply(this.viewProj, this.proj, this.view);
  }
}
