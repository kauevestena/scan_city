/**
 * Preview da Mesa Holográfica no escritório (holo-table §5.1, "reuso"): a mesma cena,
 * girando devagar, desenhada num retângulo do canvas do escritório.
 */
import { OrbitCamera } from '../soft3d/OrbitCamera';
import { Soft3DRenderer, type LineSet, type MeshInstance } from '../soft3d/Renderer';
import { normalize } from '../soft3d/vec3';
import type { HoloScene } from './sceneBuilder';

export class HoloPreview {
  private readonly camera: OrbitCamera;
  private readonly renderer = new Soft3DRenderer();
  private readonly meshes: MeshInstance[];
  private readonly lines: LineSet[];

  constructor(scene: HoloScene) {
    this.camera = new OrbitCamera(scene.radius);
    this.camera.pitch = (35 * Math.PI) / 180;
    this.camera.distance = 2.4 * scene.radius;
    this.meshes = [{ mesh: scene.table, background: true }, { mesh: scene.ocean.mesh }];
    this.lines = [scene.rim];
    for (const s of scene.sectors) {
      this.meshes.push({ mesh: s.mesh });
      if (s.buildings && s.buildings.quads.length > 0) this.meshes.push({ mesh: s.buildings });
      if (s.wire) this.lines.push(s.wire);
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    timeS: number,
  ): void {
    this.camera.yaw = timeS * 0.25;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.translate(x, y);
    this.renderer.render(
      ctx,
      w,
      h,
      this.camera.matrix(w / Math.max(1, h)),
      this.meshes,
      this.lines,
      [],
      {
        light: normalize([0.5, 1, 0.35]),
      },
    );
    ctx.restore();
  }
}
