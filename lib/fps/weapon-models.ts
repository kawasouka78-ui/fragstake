import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { WeaponId } from './simulation.ts';
import { createWeaponFinish } from './weapon-finish.ts';

/** Metres; the bore points down -Z. Named groups are independent animation channels. */
export type WeaponRig = {
  id: WeaponId;
  body: THREE.Group;
  muzzle: THREE.Vector3;
  sightHeight: number;
  magazine: THREE.Group;
  action: THREE.Group;
  supportHand: THREE.Group;
  pump: THREE.Group;
  arm?: THREE.Group;
};
export type WeaponModel = THREE.Group & { rig: WeaponRig };
type Profile = readonly (readonly [number, number])[];
type Point = readonly [number, number, number];
type Finish =
  | 'shell'
  | 'polymer'
  | 'steel'
  | 'edge'
  | 'blade'
  | 'honed'
  | 'recess'
  | 'accent'
  | 'glove'
  | 'fabric'
  | 'stitch'
  | 'lens'
  | 'reticle';
type Section = readonly [
  z: number,
  width: number,
  height: number,
  centerY: number,
];

const defaultFinish = '#050607';

class ModelBuilder {
  root = new THREE.Group() as WeaponModel;
  body = new THREE.Group();
  magazine = new THREE.Group();
  action = new THREE.Group();
  supportHand = new THREE.Group();
  pump = new THREE.Group();
  arm?: THREE.Group;
  finishes: Record<Finish, THREE.Material>;
  muzzle = new THREE.Vector3();
  sightHeight = 0.143;

  id: WeaponId;
  showHands: boolean;
  constructor(id: WeaponId, skin?: string, showHands = true) {
    this.id = id;
    this.showHands = showHands;
    const material = (color: string, metalness: number, roughness: number) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const finish = createWeaponFinish(skin ?? defaultFinish);
    this.root.userData.finish = finish;
    this.finishes = {
      shell: finish.material,
      polymer: material('#050608', 0.08, 0.82),
      steel: material('#090b0f', 0.78, 0.33),
      edge: material('#1a1e24', 0.7, 0.36),
      blade: material('#525d67', 0.55, 0.34),
      honed: material('#a5b0ba', 0.85, 0.26),
      recess: material('#020304', 0.24, 0.86),
      accent: material('#11151a', 0.58, 0.42),
      glove: material('#505849', 0.02, 0.95),
      fabric: material('#323d38', 0.02, 1),
      stitch: material('#737b67', 0.02, 0.96),
      lens: new THREE.MeshBasicMaterial({
        color: '#88ccd2',
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      reticle: new THREE.MeshBasicMaterial({
        color: '#ff644b',
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
      }),
    };
    this.root.name = `viewmodel-${id}`;
    for (const [name, node] of Object.entries({
      body: this.body,
      magazine: this.magazine,
      action: this.action,
      supportHand: this.supportHand,
      pump: this.pump,
    })) {
      node.name = name;
      this.root.add(node);
    }
  }

  mesh(
    parent: THREE.Group,
    geometry: THREE.BufferGeometry,
    finish: Finish,
    x = 0,
    y = 0,
    z = 0,
  ) {
    const mesh = new THREE.Mesh(geometry, this.finishes[finish]);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /** Chamfered side silhouettes, used only where the real part has flat side plates. */
  profile(
    parent: THREE.Group,
    points: Profile,
    width: number,
    finish: Finish,
    bevel = 0.002,
    x = 0,
  ) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (const [z, y] of points.slice(1)) shape.lineTo(z, y);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 4,
      steps: 1,
    });
    geometry.rotateY(-Math.PI / 2).translate(width / 2 + x, 0, 0);
    return this.mesh(parent, geometry, finish);
  }

  box(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    finish: Finish,
    bevel = 0.0015,
  ) {
    return this.profile(
      parent,
      [
        [z - d / 2, y - h / 2],
        [z + d / 2, y - h / 2],
        [z + d / 2, y + h / 2],
        [z - d / 2, y + h / 2],
      ],
      w,
      finish,
      Math.min(bevel, w * 0.19, h * 0.19, d * 0.19),
      x,
    );
  }

  /** Variable octagonal sections produce continuous tapered, machined surfaces. */
  shell(
    parent: THREE.Group,
    sections: readonly Section[],
    finish: Finish,
    chamfer = 0.21,
  ) {
    const vertices: number[] = [];
    const rings = [...sections]
      .sort((a, b) => a[0] - b[0])
      .map(([z, w, h, y]) => {
        const x = w / 2,
          v = h / 2,
          cx = w * chamfer,
          cy = h * chamfer;
        return [
          [-x + cx, y - v, z],
          [x - cx, y - v, z],
          [x, y - v + cy, z],
          [x, y + v - cy, z],
          [x - cx, y + v, z],
          [-x + cx, y + v, z],
          [-x, y + v - cy, z],
          [-x, y - v + cy, z],
        ];
      });
    const triangle = (a: number[], b: number[], c: number[]) =>
      vertices.push(...a, ...b, ...c);
    for (let n = 0; n < rings.length - 1; n++)
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        triangle(rings[n][i], rings[n][j], rings[n + 1][i]);
        triangle(rings[n][j], rings[n + 1][j], rings[n + 1][i]);
      }
    for (let i = 1; i < 7; i++) {
      triangle(rings[0][0], rings[0][i + 1], rings[0][i]);
      const last = rings[rings.length - 1];
      triangle(last[0], last[i], last[i + 1]);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.computeVertexNormals();
    return this.mesh(parent, geometry, finish);
  }

  tube(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
    finish: Finish,
    segments = 16,
  ) {
    const geometry = new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      segments,
      1,
    );
    geometry.rotateX(Math.PI / 2);
    return this.mesh(parent, geometry, finish, x, y, z);
  }

  link(
    parent: THREE.Group,
    from: Point,
    to: Point,
    radius: number,
    endRadius: number,
    finish: Finish,
    segments = 12,
  ) {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to),
      delta = b.clone().sub(a);
    const mesh = this.mesh(
      parent,
      new THREE.CylinderGeometry(
        endRadius,
        radius,
        delta.length(),
        segments,
        1,
      ),
      finish,
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    return mesh;
  }

  oval(parent: THREE.Group, center: Point, radii: Point, finish: Finish) {
    const mesh = this.mesh(
      parent,
      new THREE.SphereGeometry(1, 12, 8),
      finish,
      ...center,
    );
    mesh.scale.set(...radii);
    return mesh;
  }

  ring(
    parent: THREE.Group,
    x: number,
    y: number,
    z: number,
    outer: number,
    inner: number,
    length: number,
    finish: Finish,
    segments = 16,
  ) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: length,
      bevelEnabled: false,
      curveSegments: Math.ceil(segments / 2),
      steps: 1,
    });
    geometry.translate(0, 0, -length / 2);
    return this.mesh(parent, geometry, finish, x, y, z);
  }

  bolt(x: number, y: number, z: number, parent = this.body, radius = 0.0035) {
    const mesh = this.tube(parent, x, y, z, radius, 0.002, 'edge', 8);
    mesh.rotation.y = Math.PI / 2;
    this.box(
      parent,
      x + Math.sign(x) * 0.0012,
      y,
      z,
      0.0008,
      0.001,
      radius * 1.2,
      'recess',
      0,
    );
  }

  rail(start: number, end: number, y = 0.072, width = 0.042) {
    this.box(
      this.body,
      0,
      y,
      (start + end) / 2,
      width * 0.75,
      0.008,
      Math.abs(end - start),
      'steel',
    );
    for (
      let z = Math.min(start, end) + 0.006;
      z < Math.max(start, end);
      z += 0.019
    )
      this.box(
        this.body,
        0,
        y + 0.005,
        z,
        width,
        0.006,
        0.009,
        'polymer',
        0.0007,
      );
  }

  muzzleAt(z: number, y = 0.025, radius = 0.018, brake = true) {
    const length = brake ? 0.043 : 0.019;
    this.ring(
      this.body,
      0,
      y,
      z + length / 2,
      radius,
      radius * 0.5,
      length,
      'steel',
    );
    this.ring(
      this.body,
      0,
      y,
      z + 0.0015,
      radius * 1.025,
      radius * 0.51,
      0.003,
      'edge',
    );
    this.tube(
      this.body,
      0,
      y,
      z + length * 0.84,
      radius * 0.49,
      0.001,
      'recess',
    );
    if (brake)
      for (const s of [-1, 1])
        for (let i = 0; i < 3; i++)
          this.box(
            this.body,
            s * radius * 0.955,
            y,
            z + 0.01 + i * 0.01,
            0.0015,
            radius * 0.71,
            0.004,
            'recess',
            0.0005,
          );
    this.muzzle.set(0, y, z - 0.006);
  }

  reflex(z = -0.018, compact = false, railY = 0.072) {
    const width = compact ? 0.047 : 0.056,
      height = compact ? 0.038 : 0.046;
    const bottom = railY + 0.026,
      center = bottom + height * 0.5;
    this.sightHeight = center;
    this.box(this.body, 0, railY + 0.012, z, 0.038, 0.017, 0.046, 'steel');
    this.box(this.body, 0, bottom - 0.002, z, 0.046, 0.01, 0.038, 'polymer');
    // One curved hood with a real opening: no oversized separate pillars or floating mount.
    const rounded = (path: THREE.Path, w: number, h: number, r: number) => {
      path.moveTo(-w / 2, 0);
      path.lineTo(w / 2, 0);
      path.lineTo(w / 2, h - r);
      path.quadraticCurveTo(w / 2, h, w / 2 - r, h);
      path.lineTo(-w / 2 + r, h);
      path.quadraticCurveTo(-w / 2, h, -w / 2, h - r);
      path.lineTo(-w / 2, 0);
    };
    const frame = new THREE.Shape();
    rounded(frame, width, height, 0.01);
    // A clockwise inset gives the hood a genuinely open, curved sight window.
    const inset = new THREE.Path();
    inset.moveTo(-width / 2 + 0.004, 0.004);
    inset.lineTo(-width / 2 + 0.004, height - 0.01);
    inset.quadraticCurveTo(
      -width / 2 + 0.004,
      height - 0.004,
      -width / 2 + 0.01,
      height - 0.004,
    );
    inset.lineTo(width / 2 - 0.01, height - 0.004);
    inset.quadraticCurveTo(
      width / 2 - 0.004,
      height - 0.004,
      width / 2 - 0.004,
      height - 0.01,
    );
    inset.lineTo(width / 2 - 0.004, 0.004);
    inset.closePath();
    frame.holes.push(inset);
    const geometry = new THREE.ExtrudeGeometry(frame, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.0008,
      bevelSize: 0.0008,
      bevelSegments: 1,
      curveSegments: 6,
    });
    this.mesh(this.body, geometry, 'steel', 0, bottom, z - 0.006);
    this.mesh(
      this.body,
      new THREE.PlaneGeometry(width - 0.01, height - 0.01),
      'lens',
      0,
      center,
      z - 0.001,
    );
    this.mesh(
      this.body,
      new THREE.CircleGeometry(0.00125, 12),
      'reticle',
      0,
      center,
      z + 0.002,
    );
    this.tube(
      this.body,
      width / 2 + 0.002,
      bottom + 0.004,
      z,
      0.007,
      0.019,
      'polymer',
      12,
    ).rotation.y = Math.PI / 2;
    this.bolt(width / 2 + 0.012, bottom + 0.004, z, this.body, 0.003);
  }

  irons(frontZ: number, rearZ: number, height = 0.095, parent = this.body) {
    this.sightHeight = height;
    this.box(parent, 0, height - 0.01, frontZ, 0.016, 0.019, 0.014, 'steel');
    this.box(
      parent,
      0,
      height - 0.001,
      frontZ + 0.005,
      0.0025,
      0.003,
      0.0015,
      'accent',
      0,
    );
    for (const s of [-1, 1])
      this.box(
        parent,
        s * 0.009,
        height - 0.004,
        rearZ,
        0.008,
        0.016,
        0.014,
        'steel',
      );
    this.box(parent, 0, height - 0.013, rearZ, 0.025, 0.006, 0.015, 'polymer');
  }

  scope() {
    const y = 0.147;
    this.sightHeight = y;
    for (const z of [-0.055, -0.18]) {
      this.box(this.body, 0, 0.099, z, 0.032, 0.042, 0.026, 'steel');
      this.ring(this.body, 0, y, z, 0.025, 0.019, 0.018, 'polymer');
      for (const s of [-1, 1]) this.bolt(s * 0.027, y, z, this.body, 0.0025);
    }
    this.ring(this.body, 0, y, -0.114, 0.02, 0.016, 0.252, 'steel', 20);
    this.ring(this.body, 0, y, -0.255, 0.031, 0.025, 0.065, 'polymer', 20);
    this.ring(this.body, 0, y, 0.024, 0.026, 0.02, 0.044, 'polymer', 20);
    this.ring(this.body, 0, y, -0.289, 0.032, 0.025, 0.005, 'edge', 20);
    this.ring(this.body, 0, y, 0.048, 0.027, 0.02, 0.005, 'edge', 20);
    this.mesh(
      this.body,
      new THREE.CircleGeometry(0.019, 24),
      'lens',
      0,
      y,
      0.051,
    );
    this.mesh(
      this.body,
      new THREE.CircleGeometry(0.024, 24),
      'lens',
      0,
      y,
      -0.292,
    );
    this.box(this.body, 0, y, 0.052, 0.0007, 0.033, 0.0007, 'recess', 0);
    this.box(this.body, 0, y, 0.052, 0.033, 0.0007, 0.0007, 'recess', 0);
    this.mesh(
      this.body,
      new THREE.CircleGeometry(0.0009, 10),
      'reticle',
      0,
      y,
      0.053,
    );
    this.link(
      this.body,
      [0, y + 0.014, -0.119],
      [0, y + 0.04, -0.119],
      0.013,
      0.014,
      'polymer',
      16,
    );
    this.link(
      this.body,
      [0.013, y, -0.119],
      [0.038, y, -0.119],
      0.012,
      0.013,
      'polymer',
      16,
    );
    for (let i = 0; i < 9; i++)
      this.ring(
        this.body,
        0,
        y,
        0.006 + i * 0.004,
        0.0263,
        0.025,
        0.0015,
        'steel',
        16,
      );
  }

  grip(z = 0.075, y = -0.029, lean = 0.024, width = 0.049) {
    this.profile(
      this.body,
      [
        [z - 0.029, y],
        [z + 0.026, y],
        [z + 0.026 + lean, y - 0.139],
        [z - 0.033 + lean, y - 0.145],
        [z - 0.038, y - 0.051],
      ],
      width,
      'polymer',
      0.006,
    );
    for (const s of [-1, 1]) {
      this.profile(
        this.body,
        [
          [z - 0.025, y - 0.035],
          [z + 0.021, y - 0.035],
          [z + 0.023 + lean, y - 0.124],
          [z - 0.024 + lean, y - 0.13],
        ],
        0.002,
        'shell',
        0.002,
        s * (width / 2 + 0.005),
      );
      for (let i = 0; i < 6; i++)
        this.box(
          this.body,
          s * (width / 2 + 0.007),
          y - 0.055 - i * 0.011,
          z + 0.002 + (lean * i) / 6,
          0.0015,
          0.0035,
          0.029,
          'recess',
          0.0005,
        );
    }
    this.box(
      this.body,
      0,
      y - 0.139,
      z + lean - 0.001,
      width + 0.003,
      0.011,
      0.06,
      'polymer',
      0.004,
    );
  }

  guard(z = 0.005, y = -0.065, width = 0.049, scale = 1) {
    const points: Profile = [
      [z - 0.058 * scale, y + 0.011],
      [z - 0.063 * scale, y - 0.032 * scale],
      [z - 0.048 * scale, y - 0.043 * scale],
      [z + 0.023 * scale, y - 0.043 * scale],
    ];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i],
        c = points[i + 1];
      this.link(
        this.body,
        [0, a[1], a[0]],
        [0, c[1], c[0]],
        0.005,
        0.005,
        'polymer',
        8,
      ).scale.x = width / 0.01;
    }
    this.link(
      this.body,
      [0, y + 0.01, z - 0.024],
      [0, y - 0.022, z - 0.03],
      0.004,
      0.004,
      'steel',
      8,
    );
  }

  straightMagazine(
    z: number,
    length: number,
    width = 0.046,
    depth = 0.061,
    tilt = -0.05,
    top = -0.045,
  ) {
    this.profile(
      this.magazine,
      [
        [z - depth / 2, top],
        [z + depth / 2, top],
        [z + depth / 2 + tilt * length, top - length],
        [z - depth / 2 + tilt * length, top - length],
      ],
      width,
      'steel',
      0.003,
    );
    this.box(
      this.magazine,
      0,
      top - length,
      z + tilt * length,
      width + 0.006,
      0.012,
      depth + 0.007,
      'polymer',
    );
    for (const s of [-1, 1])
      for (let i = 0; i < 2; i++)
        this.profile(
          this.magazine,
          [
            [z - depth * 0.25 + i * depth * 0.39, top - 0.029],
            [z - depth * 0.17 + i * depth * 0.39, top - 0.029],
            [
              z - depth * 0.17 + i * depth * 0.39 + tilt * length * 0.8,
              top - length * 0.89,
            ],
            [
              z - depth * 0.25 + i * depth * 0.39 + tilt * length * 0.8,
              top - length * 0.89,
            ],
          ],
          0.0012,
          'recess',
          0.0005,
          s * (width / 2 + 0.0035),
        );
  }

  curvedMagazine(z = -0.096, small = false) {
    const scale = small ? 0.8 : 1,
      w = small ? 0.034 : 0.048;
    const shape: Profile = [
      [-0.035, -0.047],
      [0.035, -0.047],
      [0.033, -0.146],
      [0.005, -0.219],
      [-0.028, -0.25],
      [-0.087, -0.225],
      [-0.056, -0.187],
      [-0.033, -0.13],
    ];
    this.profile(
      this.magazine,
      shape.map(([zz, y]) => [z + zz * scale, y * scale]),
      w,
      'polymer',
      0.004,
    );
    this.profile(
      this.magazine,
      [
        [z - 0.087 * scale, -0.225 * scale],
        [z - 0.028 * scale, -0.25 * scale],
        [z - 0.024 * scale, -0.24 * scale],
        [z - 0.082 * scale, -0.215 * scale],
      ],
      w + 0.007,
      'steel',
      0.002,
    );
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++)
        this.profile(
          this.magazine,
          [
            [z + (-0.022 + i * 0.017) * scale, -0.071 * scale],
            [z + (-0.017 + i * 0.017) * scale, -0.071 * scale],
            [z + (-0.025 + i * 0.014) * scale, -0.146 * scale],
            [z + (-0.057 + i * 0.014) * scale, -0.209 * scale],
            [z + (-0.063 + i * 0.014) * scale, -0.208 * scale],
            [z + (-0.031 + i * 0.014) * scale, -0.145 * scale],
          ],
          0.0013,
          'recess',
          0.0004,
          s * (w / 2 + 0.0045),
        );
  }

  stock(start = 0.125, end = 0.288, light = false) {
    this.tube(
      this.body,
      0,
      0.019,
      (start + end - 0.029) / 2,
      0.017,
      end - 0.029 - start,
      'steel',
    );
    if (light) {
      for (const s of [-1, 1])
        this.link(
          this.body,
          [s * 0.021, -0.03, start],
          [s * 0.021, -0.072, end - 0.022],
          0.006,
          0.006,
          'steel',
          10,
        );
      this.shell(
        this.body,
        [
          [end - 0.073, 0.054, 0.034, 0.026],
          [end - 0.018, 0.057, 0.052, 0.015],
        ],
        'polymer',
      );
    } else {
      this.profile(
        this.body,
        [
          [start + 0.027, 0.037],
          [end - 0.025, 0.044],
          [end - 0.008, 0.018],
          [end - 0.011, -0.099],
          [end - 0.042, -0.097],
          [end - 0.065, -0.041],
          [start + 0.027, -0.037],
        ],
        0.056,
        'polymer',
        0.004,
      );
      // The tapered cheek piece follows the upper stock surface.
      this.shell(
        this.body,
        [
          [start + 0.034, 0.054, 0.032, 0.035],
          [end - 0.031, 0.062, 0.034, 0.039],
        ],
        'shell',
      );
    }
    this.shell(
      this.body,
      [
        [end - 0.01, 0.061, 0.152, -0.032],
        [end + 0.003, 0.066, 0.156, -0.032],
        [end + 0.008, 0.059, 0.147, -0.032],
      ],
      'polymer',
    );
    for (let i = 0; i < 6; i++)
      this.box(
        this.body,
        0,
        -0.087 + i * 0.022,
        end + 0.009,
        0.046,
        0.0025,
        0.001,
        'recess',
        0,
      );
  }

  hands(supportZ: number, pistol = false, gripZ = 0.075) {
    if (!this.showHands) return;
    const finger = (parent: THREE.Group, points: Point[], radius: number) => {
      for (let i = 0; i < points.length - 1; i++)
        this.link(
          parent,
          points[i],
          points[i + 1],
          radius * (1 - i * 0.07),
          radius * (0.96 - i * 0.07),
          'glove',
          10,
        );
      for (let i = 0; i < points.length; i++)
        this.oval(
          parent,
          points[i],
          [radius * 0.98, radius * 0.98, radius * 0.98],
          'glove',
        );
    };
    const sleeve = (
      parent: THREE.Group,
      wrist: Point,
      cuff: Point,
      elbow: Point,
    ) => {
      this.link(parent, wrist, cuff, 0.028, 0.034, 'glove', 14);
      this.oval(parent, cuff, [0.034, 0.036, 0.038], 'fabric');
      this.link(parent, cuff, elbow, 0.034, 0.052, 'fabric', 16);
      // A soft overlapping sleeve fold follows the arm axis instead of forming a detached box.
      const near: Point = [
        cuff[0] * 0.87 + elbow[0] * 0.13,
        cuff[1] * 0.87 + elbow[1] * 0.13,
        cuff[2] * 0.87 + elbow[2] * 0.13,
      ];
      this.link(parent, cuff, near, 0.035, 0.038, 'fabric', 16);
    };
    const right = this.body;
    this.oval(
      right,
      [0.03, -0.116, gripZ + 0.02],
      [0.027, 0.047, 0.034],
      'glove',
    ).rotation.z = -0.15;
    this.oval(
      right,
      [0.048, -0.112, gripZ + 0.022],
      [0.011, 0.035, 0.027],
      'fabric',
    );
    for (let i = 0; i < 3; i++) {
      const y = -0.105 - i * 0.018,
        z = gripZ - 0.015 + i * 0.003;
      finger(
        right,
        [
          [0.044, y, gripZ + 0.009],
          [0.039, y - 0.003, z - 0.011],
          [0.011, y - 0.005, z - 0.023],
          [-0.012, y - 0.003, z - 0.01],
        ],
        0.0085 - i * 0.0004,
      );
    }
    finger(
      right,
      [
        [0.04, -0.078, gripZ + 0.003],
        [0.04, -0.068, gripZ - 0.033],
        [0.02, -0.074, gripZ - 0.059],
        [0.004, -0.08, gripZ - 0.054],
      ],
      0.008,
    );
    finger(
      right,
      [
        [0.025, -0.084, gripZ + 0.034],
        [-0.012, -0.073, gripZ + 0.024],
        [-0.026, -0.086, gripZ - 0.004],
      ],
      0.011,
    );
    sleeve(
      right,
      [0.036, -0.151, gripZ + 0.047],
      [0.051, -0.179, gripZ + 0.082],
      [0.125, -0.335, 0.267],
    );
    if (pistol) {
      this.oval(
        this.supportHand,
        [-0.026, -0.123, gripZ - 0.006],
        [0.025, 0.038, 0.038],
        'glove',
      );
      this.oval(
        this.supportHand,
        [-0.044, -0.126, gripZ - 0.006],
        [0.01, 0.025, 0.028],
        'fabric',
      );
      for (let i = 0; i < 3; i++)
        finger(
          this.supportHand,
          [
            [-0.039, -0.106 - i * 0.018, gripZ - 0.016],
            [-0.012, -0.112 - i * 0.018, gripZ - 0.042],
            [0.025, -0.11 - i * 0.017, gripZ - 0.033],
          ],
          0.008,
        );
      finger(
        this.supportHand,
        [
          [-0.032, -0.103, gripZ + 0.009],
          [-0.035, -0.078, gripZ - 0.023],
          [-0.026, -0.074, gripZ - 0.051],
        ],
        0.01,
      );
      sleeve(
        this.supportHand,
        [-0.039, -0.151, gripZ + 0.027],
        [-0.063, -0.181, gripZ + 0.061],
        [-0.172, -0.315, 0.211],
      );
    } else {
      this.oval(
        this.supportHand,
        [-0.042, -0.047, supportZ],
        [0.024, 0.029, 0.045],
        'glove',
      ).rotation.z = -0.32;
      this.oval(
        this.supportHand,
        [-0.056, -0.046, supportZ + 0.006],
        [0.01, 0.019, 0.033],
        'fabric',
      );
      for (let i = 0; i < 4; i++) {
        const z = supportZ - 0.027 + i * 0.017;
        finger(
          this.supportHand,
          [
            [-0.045, -0.051, z],
            [-0.022, -0.067, z],
            [0.014, -0.063, z],
            [0.033, -0.041, z],
          ],
          0.0085 - i * 0.00035,
        );
      }
      finger(
        this.supportHand,
        [
          [-0.045, -0.028, supportZ + 0.028],
          [-0.043, 0.003, supportZ + 0.01],
          [-0.025, 0.014, supportZ - 0.017],
        ],
        0.011,
      );
      sleeve(
        this.supportHand,
        [-0.059, -0.073, supportZ + 0.03],
        [-0.081, -0.109, supportZ + 0.065],
        [-0.196, -0.283, supportZ + 0.248],
      );
    }
  }

  finish() {
    for (const node of [
      this.body,
      this.magazine,
      this.action,
      this.supportHand,
      this.pump,
    ]) {
      const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
      for (const child of [...node.children]) {
        if (!(child instanceof THREE.Mesh)) continue;
        child.updateMatrix();
        const original = child.geometry,
          geometry = original.index
            ? original.toNonIndexed()
            : original.clone();
        geometry.applyMatrix4(child.matrix);
        for (const key of Object.keys(geometry.attributes))
          if (key !== 'position' && key !== 'normal')
            geometry.deleteAttribute(key);
        geometry.clearGroups();
        const material = child.material as THREE.Material;
        const group = buckets.get(material) ?? [];
        group.push(geometry);
        buckets.set(material, group);
        original.dispose();
        node.remove(child);
      }
      for (const [material, parts] of buckets) {
        const merged = mergeGeometries(parts, false);
        if (!merged)
          throw new Error(`Could not build ${this.id} weapon geometry`);
        parts.forEach((part) => part.dispose());
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = `${node.name}-${Object.entries(this.finishes).find(([, value]) => value === material)?.[0]}`;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        node.add(mesh);
      }
    }
    const used = new Set<THREE.Material>();
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh)
        used.add(child.material as THREE.Material);
    });
    for (const material of Object.values(this.finishes))
      if (!used.has(material)) material.dispose();
    this.root.rig = {
      id: this.id,
      body: this.body,
      muzzle: this.muzzle.clone(),
      sightHeight: this.sightHeight,
      magazine: this.magazine,
      action: this.action,
      supportHand: this.supportHand,
      pump: this.pump,
      arm: this.arm,
    };
    return this.root;
  }
}

function assault(b: ModelBuilder) {
  if (b.id === 'carbine') {
    // Compact bullpup: rounded fore-end, high cheek rest and rear magazine well.
    b.shell(
      b.body,
      [
        [-0.325, 0.054, 0.064, 0.01],
        [-0.281, 0.08, 0.099, 0.006],
        [0.08, 0.081, 0.11, 0.008],
        [0.245, 0.078, 0.104, 0.006],
        [0.273, 0.067, 0.122, -0.003],
      ],
      'shell',
      0.23,
    );
    b.profile(
      b.body,
      [
        [0.031, -0.027],
        [0.249, -0.031],
        [0.259, -0.112],
        [0.164, -0.119],
        [0.103, -0.062],
      ],
      0.073,
      'polymer',
      0.004,
    );
    b.shell(
      b.body,
      [
        [0.259, 0.08, 0.159, -0.021],
        [0.276, 0.084, 0.159, -0.021],
        [0.282, 0.076, 0.15, -0.021],
      ],
      'polymer',
    );
    b.shell(
      b.body,
      [
        [0.08, 0.074, 0.026, 0.07],
        [0.231, 0.076, 0.032, 0.069],
      ],
      'polymer',
    );
    b.straightMagazine(0.156, 0.167, 0.047, 0.061, -0.12);
    b.grip(-0.032, -0.031, 0.008);
    b.guard(-0.083, -0.063, 0.05, 0.88);
    b.tube(b.body, 0, 0.025, -0.362, 0.014, 0.103, 'steel');
    b.muzzleAt(-0.431, 0.025, 0.019);
    b.shell(
      b.body,
      [
        [-0.321, 0.062, 0.061, -0.005],
        [-0.29, 0.085, 0.084, -0.006],
        [-0.145, 0.083, 0.083, -0.006],
      ],
      'polymer',
    );
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++)
        b.box(
          b.body,
          s * 0.043,
          0.003,
          -0.185 - i * 0.029,
          0.002,
          0.019,
          0.018,
          'recess',
          0.002,
        );
      b.box(b.body, s * 0.042, 0.026, 0.079, 0.002, 0.02, 0.066, 'recess');
      b.box(b.body, s * 0.047, 0.01, -0.072, 0.009, 0.01, 0.031, 'steel');
      b.bolt(s * 0.044, -0.002, 0.215);
      b.bolt(s * 0.044, -0.001, -0.105);
    }
    b.rail(-0.267, 0.09, 0.074);
    b.reflex(-0.108, false, 0.074);
    b.hands(-0.239, false, -0.032);
  } else {
    // Alloy carbine: continuous octagonal handguard, forged upper and compact adjustable stock.
    b.shell(
      b.body,
      [
        [-0.144, 0.06, 0.068, 0.029],
        [-0.118, 0.072, 0.082, 0.027],
        [0.083, 0.07, 0.077, 0.029],
        [0.121, 0.048, 0.061, 0.025],
      ],
      'shell',
      0.19,
    );
    b.profile(
      b.body,
      [
        [-0.123, -0.009],
        [0.096, -0.009],
        [0.098, -0.061],
        [-0.021, -0.066],
        [-0.052, -0.095],
        [-0.123, -0.091],
      ],
      0.059,
      'polymer',
      0.003,
    );
    b.shell(
      b.body,
      [
        [-0.424, 0.062, 0.076, 0.014],
        [-0.409, 0.077, 0.092, 0.014],
        [-0.159, 0.077, 0.092, 0.014],
        [-0.139, 0.065, 0.078, 0.015],
      ],
      'shell',
      0.22,
    );
    b.ring(b.body, 0, 0.025, -0.431, 0.027, 0.016, 0.011, 'steel');
    b.tube(b.body, 0, 0.025, -0.459, 0.013, 0.087, 'steel');
    b.muzzleAt(-0.532, 0.025, 0.019);
    b.grip();
    b.guard();
    b.curvedMagazine();
    b.stock(0.115, 0.289);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        b.box(
          b.body,
          s * 0.039,
          0.019,
          -0.181 - i * 0.037,
          0.0015,
          0.014,
          0.023,
          'recess',
          0.002,
        );
        b.box(
          b.body,
          s * 0.03,
          -0.025,
          -0.18 - i * 0.037,
          0.0015,
          0.012,
          0.023,
          'recess',
          0.001,
        );
      }
      b.box(b.body, s * 0.037, 0.029, -0.017, 0.0015, 0.024, 0.071, 'recess');
      b.box(b.body, s * 0.04, 0.01, -0.031, 0.006, 0.009, 0.047, 'steel');
      for (const z of [-0.101, 0.062]) b.bolt(s * 0.034, -0.025, z);
      b.bolt(s * 0.04, -0.039, 0.033, b.body, 0.004);
      b.box(
        b.body,
        s * 0.044,
        -0.036,
        0.045,
        0.0015,
        0.003,
        0.015,
        'accent',
        0,
      );
    }
    b.rail(-0.407, 0.079);
    b.reflex(-0.025);
    b.hands(-0.289);
  }
}

function submachine(b: ModelBuilder) {
  if (b.id === 'vector') {
    // Delayed-blowback SMG: short bore, deep forward recoil housing and a folding wire stock.
    b.shell(
      b.body,
      [
        [-0.24, 0.054, 0.062, 0.02],
        [-0.218, 0.073, 0.085, 0.02],
        [0.085, 0.071, 0.081, 0.022],
        [0.111, 0.052, 0.06, 0.015],
      ],
      'shell',
    );
    b.profile(
      b.body,
      [
        [-0.177, -0.01],
        [-0.048, -0.008],
        [-0.005, -0.098],
        [-0.043, -0.167],
        [-0.14, -0.167],
        [-0.175, -0.064],
      ],
      0.066,
      'shell',
      0.005,
    );
    b.profile(
      b.body,
      [
        [-0.134, -0.069],
        [-0.065, -0.069],
        [-0.054, -0.162],
        [-0.144, -0.168],
      ],
      0.059,
      'polymer',
      0.004,
    );
    b.grip(0.052, -0.028, 0.017);
    b.guard(-0.01, -0.064, 0.05, 0.86);
    b.straightMagazine(-0.108, 0.202, 0.039, 0.052, -0.07, -0.112);
    b.tube(b.body, 0, 0.025, -0.265, 0.013, 0.085, 'steel');
    b.muzzleAt(-0.318, 0.025, 0.02);
    b.shell(
      b.body,
      [
        [-0.237, 0.058, 0.057, -0.007],
        [-0.181, 0.072, 0.064, -0.008],
      ],
      'polymer',
    );
    for (const s of [-1, 1]) {
      b.box(b.body, s * 0.038, 0.028, -0.041, 0.002, 0.018, 0.073, 'recess');
      b.profile(
        b.body,
        [
          [-0.14, -0.071],
          [-0.116, -0.071],
          [-0.111, -0.142],
          [-0.131, -0.142],
        ],
        0.0015,
        'recess',
        0.001,
        s * 0.037,
      );
      b.bolt(s * 0.037, 0.003, 0.061);
      b.bolt(s * 0.036, -0.125, -0.063);
      b.box(b.body, s * 0.041, -0.003, -0.033, 0.008, 0.008, 0.028, 'steel');
    }
    b.link(b.body, [0, 0.02, 0.11], [0, 0.02, 0.135], 0.022, 0.022, 'steel');
    for (const s of [-1, 1]) {
      b.link(
        b.body,
        [s * 0.018, 0.02, 0.135],
        [s * 0.021, 0.016, 0.264],
        0.0055,
        0.0055,
        'steel',
      );
      b.link(
        b.body,
        [s * 0.018, -0.03, 0.135],
        [s * 0.021, -0.067, 0.264],
        0.0055,
        0.0055,
        'steel',
      );
    }
    b.shell(
      b.body,
      [
        [0.241, 0.045, 0.029, 0.022],
        [0.268, 0.051, 0.031, 0.019],
      ],
      'polymer',
    );
    b.shell(
      b.body,
      [
        [0.266, 0.051, 0.136, -0.03],
        [0.28, 0.055, 0.138, -0.03],
      ],
      'polymer',
    );
    b.rail(-0.214, 0.071);
    b.reflex(-0.021, true);
    b.hands(-0.207, false, 0.052);
  } else {
    // Roller-lock SMG: stamped round receiver, cocking tube, curved narrow magazine, wire stock.
    b.tube(b.body, 0, 0.024, -0.038, 0.034, 0.281, 'shell', 20);
    b.profile(
      b.body,
      [
        [-0.171, 0.009],
        [0.092, 0.009],
        [0.099, -0.055],
        [-0.141, -0.057],
      ],
      0.049,
      'polymer',
      0.003,
    );
    b.shell(
      b.body,
      [
        [-0.301, 0.045, 0.049, -0.002],
        [-0.272, 0.068, 0.078, -0.005],
        [-0.173, 0.069, 0.079, -0.004],
      ],
      'polymer',
      0.32,
    );
    b.tube(b.body, 0, 0.058, -0.162, 0.009, 0.267, 'steel');
    b.link(
      b.body,
      [-0.006, 0.058, -0.213],
      [-0.043, 0.058, -0.213],
      0.006,
      0.009,
      'steel',
    );
    b.tube(b.body, 0, 0.024, -0.312, 0.014, 0.09, 'steel');
    b.muzzleAt(-0.38, 0.024, 0.018);
    b.grip(0.055, -0.029, 0.026, 0.045);
    b.guard(-0.004, -0.064, 0.046, 0.84);
    b.curvedMagazine(-0.098, true);
    for (const s of [-1, 1]) {
      b.link(
        b.body,
        [s * 0.026, 0.012, 0.072],
        [s * 0.027, 0.007, 0.274],
        0.0045,
        0.0045,
        'steel',
      );
      b.box(b.body, s * 0.035, 0.022, -0.017, 0.0014, 0.019, 0.066, 'recess');
      b.bolt(s * 0.029, -0.026, 0.067);
      for (let i = 0; i < 3; i++)
        b.box(
          b.body,
          s * 0.034,
          -0.001,
          -0.195 - i * 0.029,
          0.0015,
          0.032,
          0.0025,
          'recess',
          0,
        );
    }
    b.shell(
      b.body,
      [
        [0.27, 0.059, 0.127, -0.031],
        [0.282, 0.064, 0.137, -0.031],
        [0.287, 0.057, 0.127, -0.031],
      ],
      'polymer',
    );
    b.rail(-0.104, 0.065, 0.073);
    b.reflex(-0.013, true, 0.073);
    b.hands(-0.232, false, 0.055);
  }
}

function marksman(b: ModelBuilder) {
  // Bolt rifle: slender floated barrel, low chassis fore-end, short magazine and adjustable cheek piece.
  b.shell(
    b.body,
    [
      [-0.363, 0.044, 0.041, -0.019],
      [-0.328, 0.067, 0.061, -0.021],
      [-0.116, 0.074, 0.072, -0.014],
      [0.098, 0.073, 0.072, -0.01],
      [0.126, 0.05, 0.057, -0.012],
    ],
    'shell',
  );
  b.tube(b.body, 0, 0.029, -0.019, 0.026, 0.256, 'steel', 20);
  b.tube(b.body, 0, 0.029, -0.43, 0.011, 0.468, 'steel', 20);
  b.ring(b.body, 0, 0.029, -0.176, 0.023, 0.012, 0.025, 'steel');
  b.muzzleAt(-0.702, 0.029, 0.02);
  b.profile(
    b.body,
    [
      [0.1, 0.023],
      [0.264, 0.02],
      [0.294, -0.009],
      [0.28, -0.125],
      [0.226, -0.121],
      [0.197, -0.053],
      [0.109, -0.047],
    ],
    0.066,
    'shell',
    0.004,
  );
  b.shell(
    b.body,
    [
      [0.162, 0.061, 0.036, 0.039],
      [0.256, 0.065, 0.042, 0.039],
    ],
    'polymer',
  );
  b.shell(
    b.body,
    [
      [0.277, 0.071, 0.16, -0.047],
      [0.294, 0.077, 0.166, -0.047],
      [0.3, 0.069, 0.157, -0.047],
    ],
    'polymer',
  );
  b.grip(0.07, -0.038, 0.021, 0.053);
  b.guard(0.006, -0.072, 0.052, 0.92);
  b.straightMagazine(-0.071, 0.103, 0.052, 0.078, 0);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++)
      b.box(
        b.body,
        s * 0.036,
        -0.016,
        -0.16 - i * 0.039,
        0.0015,
        0.012,
        0.023,
        'recess',
      );
    b.bolt(s * 0.038, -0.026, -0.116);
    b.bolt(s * 0.036, -0.035, 0.243);
    b.link(
      b.body,
      [s * 0.044, -0.043, -0.327],
      [s * 0.044, -0.045, -0.169],
      0.006,
      0.005,
      'steel',
    );
    b.oval(
      b.body,
      [s * 0.044, -0.043, -0.324],
      [0.011, 0.01, 0.014],
      'polymer',
    );
  }
  b.link(
    b.action,
    [0.02, 0.033, 0.06],
    [0.05, 0.016, 0.071],
    0.006,
    0.006,
    'steel',
  );
  b.oval(b.action, [0.055, 0.011, 0.074], [0.012, 0.012, 0.015], 'polymer');
  b.rail(-0.187, 0.077, 0.069);
  b.scope();
  b.hands(-0.26, false, 0.07);
}

function handgun(b: ModelBuilder) {
  const heavy = b.id === 'handcannon',
    front = heavy ? -0.257 : -0.192,
    w = heavy ? 0.062 : 0.05;
  b.shell(
    b.action,
    [
      [front, w * 0.8, 0.046, 0.045],
      [front + 0.013, w, 0.058, 0.045],
      [0.072, w, 0.058, 0.045],
      [0.087, w * 0.8, 0.048, 0.042],
    ],
    'shell',
    heavy ? 0.2 : 0.16,
  );
  b.profile(
    b.body,
    [
      [front + 0.026, 0.014],
      [0.071, 0.014],
      [0.081, -0.038],
      [-0.092, -0.04],
      [-0.11, -0.017],
      [front + 0.026, -0.014],
    ],
    w * 0.86,
    'polymer',
    0.003,
  );
  const gripZ = 0.034;
  b.grip(gripZ, -0.026, heavy ? 0.029 : 0.023, heavy ? 0.052 : 0.044);
  b.guard(-0.031, -0.054, w * 0.85, heavy ? 0.91 : 0.81);
  b.straightMagazine(0.057, 0.126, w * 0.67, 0.046, 0.13, -0.042);
  b.box(b.magazine, 0, -0.171, 0.074, w * 0.97, 0.012, 0.063, 'polymer', 0.003);
  b.tube(
    b.body,
    0,
    0.044,
    front + 0.074,
    heavy ? 0.013 : 0.01,
    heavy ? 0.16 : 0.13,
    'steel',
  );
  b.muzzleAt(front - 0.005, 0.044, heavy ? 0.016 : 0.014, false);
  b.box(b.body, 0, -0.013, front + 0.059, w * 0.57, 0.006, 0.054, 'steel');
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++)
      b.box(
        b.action,
        s * (w / 2 + 0.0015),
        0.042,
        0.062 - i * 0.009,
        0.0014,
        0.032,
        0.0023,
        'recess',
        0.0003,
      );
    if (heavy)
      for (let i = 0; i < 3; i++)
        b.box(
          b.action,
          s * (w / 2 + 0.0016),
          0.051,
          front + 0.035 + i * 0.017,
          0.0013,
          0.012,
          0.009,
          'recess',
          0.001,
        );
    b.box(
      b.action,
      s * (w / 2 + 0.0016),
      0.05,
      -0.054,
      0.0012,
      0.019,
      0.037,
      'recess',
    );
    b.box(b.body, s * w * 0.48, -0.014, 0.009, 0.004, 0.008, 0.03, 'steel');
    b.bolt(s * w * 0.53, -0.074, 0.05, b.body, 0.0027);
  }
  b.box(b.action, 0, 0.074, -0.049, w * 0.54, 0.0017, 0.04, 'recess', 0.001);
  b.box(b.action, 0, 0.075, -0.049, w * 0.37, 0.002, 0.027, 'steel', 0.001);
  if (heavy)
    b.profile(
      b.action,
      [
        [front + 0.006, 0.074],
        [front + 0.028, 0.084],
        [0.066, 0.084],
        [0.077, 0.074],
      ],
      w * 0.48,
      'steel',
      0.001,
    );
  b.irons(front + 0.026, 0.063, heavy ? 0.101 : 0.093, b.action);
  b.hands(-0.1, true, gripZ);
}

/** Flat blade faces meet a separately shaded, tapered cutting bevel. */
function knifeBlade(
  b: ModelBuilder,
  outline: Profile,
  inset: Profile,
  thickness = 0.0038,
  spineEdges = 0,
) {
  const contour = inset.map(([z, y]) => new THREE.Vector2(z, y));
  const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const side of [-1, 1]) {
    const faces: number[] = [],
      bevel: number[] = [],
      spine: number[] = [];
    const point = (p: readonly number[], x: number) => [x, p[1], p[0]];
    const tri = (out: number[], a: number[], c: number[], d: number[]) =>
      out.push(...a, ...(side === 1 ? d : c), ...(side === 1 ? c : d));
    for (const [a, c, d] of triangles)
      tri(
        faces,
        point(inset[a], side * thickness),
        point(inset[c], side * thickness),
        point(inset[d], side * thickness),
      );
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length,
        a = point(outline[i], 0),
        c = point(outline[j], 0),
        d = point(inset[i], side * thickness),
        e = point(inset[j], side * thickness),
        band = i < spineEdges ? spine : bevel;
      tri(band, a, c, d);
      tri(band, c, e, d);
    }
    for (const [vertices, finish] of [
      [faces, 'blade'],
      [bevel, 'honed'],
      [spine, 'steel'],
    ] as const) {
      if (!vertices.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geometry.computeVertexNormals();
      b.mesh(b.body, geometry, finish);
    }
  }
}

function knifeHand(b: ModelBuilder, curved: boolean) {
  if (!b.showHands) return;
  if (curved) {
    karambitHand(b);
    return;
  }
  const palmZ = curved ? 0.065 : 0.096;
  b.oval(b.body, [0.031, -0.008, palmZ], [0.025, 0.033, 0.048], 'glove');
  b.oval(b.body, [0.05, -0.005, palmZ], [0.008, 0.025, 0.037], 'fabric');
  for (let i = 0; i < 4; i++) {
    const z = palmZ - 0.039 + i * 0.023,
      y = curved ? -0.009 - i * 0.003 : -0.006;
    const path: Point[] = [
      [0.04, y, z],
      [0.025, y - 0.029, z],
      [-0.014, y - 0.032, z],
      [-0.03, y - 0.013, z],
      [-0.026, y + 0.01, z],
    ];
    for (let n = 0; n < path.length - 1; n++)
      b.link(b.body, path[n], path[n + 1], 0.0085, 0.008, 'glove');
    b.oval(b.body, [0.029, y - 0.025, z], [0.011, 0.009, 0.01], 'fabric');
  }
  b.link(
    b.body,
    [0.03, 0.017, palmZ + 0.026],
    [0.004, 0.032, palmZ - 0.012],
    0.012,
    0.01,
    'glove',
  );
  b.link(
    b.body,
    [0.004, 0.032, palmZ - 0.012],
    [-0.02, 0.02, palmZ - 0.034],
    0.01,
    0.008,
    'glove',
  );
  b.link(
    b.body,
    [0.039, -0.023, palmZ + 0.036],
    [0.068, -0.061, palmZ + 0.095],
    0.028,
    0.035,
    'glove',
    16,
  );
  b.link(
    b.body,
    [0.068, -0.061, palmZ + 0.095],
    [0.156, -0.188, palmZ + 0.247],
    0.037,
    0.057,
    'fabric',
    16,
  );
  b.link(
    b.body,
    [0.067, -0.06, palmZ + 0.094],
    [0.077, -0.074, palmZ + 0.112],
    0.038,
    0.04,
    'polymer',
    16,
  );
}

function karambitHand(b: ModelBuilder) {
  // The index finger passes through the pommel ring; three fingers wrap the grip.
  for (const [finish, color] of [
    ['glove', '#292e2f'],
    ['fabric', '#151b1f'],
    ['stitch', '#566269'],
  ] as const)
    (b.finishes[finish] as THREE.MeshStandardMaterial).color.set(color);
  const finger = (points: Point[], radius = 0.008) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal',
    );
    b.mesh(
      b.body,
      new THREE.TubeGeometry(curve, 28, radius, 12, false),
      'glove',
    );
    for (const point of [points[0], points[points.length - 1]])
      b.oval(b.body, point, [radius, radius, radius], 'glove');
  };
  b.oval(b.body, [0.025, 0.014, 0.022], [0.023, 0.041, 0.027], 'glove');
  b.profile(
    b.body,
    [
      [0.015, -0.016],
      [0.035, -0.019],
      [0.046, 0.005],
      [0.035, 0.038],
      [0.012, 0.035],
      [0.006, 0.01],
    ],
    0.003,
    'fabric',
    0.003,
    0.046,
  );
  for (let i = 0; i < 3; i++) {
    const y = 0.034 - i * 0.021;
    finger(
      [
        [0.035, y, 0.016],
        [0.027, y, -0.012],
        [0.005, y, -0.021],
        [-0.018, y, -0.018],
        [-0.023, y, 0.005],
      ],
      0.0085 - i * 0.0004,
    );
    b.oval(b.body, [0.023, y, -0.02], [0.01, 0.007, 0.0035], 'fabric');
  }
  finger(
    [
      [0.034, 0.043, 0.015],
      [0.025, 0.063, 0.001],
      [0.006, 0.073, -0.006],
      [-0.014, 0.071, -0.006],
      [-0.024, 0.052, 0.002],
    ],
    0.008,
  );
  finger(
    [
      [0.029, 0.021, 0.041],
      [0.011, 0.044, 0.031],
      [-0.014, 0.049, 0.01],
      [-0.019, 0.027, -0.003],
    ],
    0.01,
  );
  b.link(
    b.body,
    [0.027, -0.003, 0.03],
    [0.064, -0.008, -0.025],
    0.024,
    0.027,
    'glove',
    20,
  );
  // A fixed cuff anchors the wrist while the hand and blade turn together.
  b.link(
    b.supportHand,
    [0.064, -0.008, -0.025],
    [0.218, -0.105, -0.22],
    0.027,
    0.039,
    'fabric',
    20,
  );
  b.link(
    b.supportHand,
    [0.06, -0.007, -0.019],
    [0.077, -0.016, -0.045],
    0.029,
    0.03,
    'polymer',
    20,
  );
  b.link(
    b.supportHand,
    [0.069, 0.01, -0.032],
    [0.127, -0.023, -0.105],
    0.0007,
    0.0007,
    'stitch',
    6,
  );
  b.link(
    b.body,
    [0.048, -0.014, 0.016],
    [0.048, 0.026, 0.008],
    0.00055,
    0.00055,
    'stitch',
    6,
  );
}

function karambit(b: ModelBuilder) {
  b.arm = new THREE.Group();
  b.arm.name = 'knife-arm';
  b.root.add(b.arm);
  b.arm.add(b.body, b.supportHand);
  // Swept talon with a tapered tip and a real hollow-ground cross section.
  const bladeFinish = b.finishes.blade as THREE.MeshStandardMaterial,
    edgeFinish = b.finishes.honed as THREE.MeshStandardMaterial;
  bladeFinish.color.set('#555c68');
  bladeFinish.metalness = 0.52;
  bladeFinish.roughness = 0.31;
  edgeFinish.color.set('#b7c2cd');
  edgeFinish.metalness = 0.6;
  edgeFinish.roughness = 0.24;
  (b.finishes.polymer as THREE.MeshStandardMaterial).color.set('#14181d');
  (b.finishes.steel as THREE.MeshStandardMaterial).color.set('#313840');
  (b.finishes.edge as THREE.MeshStandardMaterial).color.set('#505b65');
  const spine = new THREE.CubicBezierCurve(
    new THREE.Vector2(-0.007, 0.019),
    new THREE.Vector2(-0.071, 0.039),
    new THREE.Vector2(-0.132, -0.034),
    new THREE.Vector2(-0.11, -0.094),
  );
  const cuttingEdge = new THREE.CubicBezierCurve(
    new THREE.Vector2(-0.009, -0.012),
    new THREE.Vector2(-0.047, 0.002),
    new THREE.Vector2(-0.079, -0.045),
    new THREE.Vector2(-0.11, -0.094),
  );
  // Matching longitudinal samples keep the bevel continuous through the curve.
  const bladePoint = (t: number, across: number, depth: number) => {
    const p = spine.getPoint(t).lerp(cuttingEdge.getPoint(t), across);
    const taper = Math.pow(Math.max(0, 1 - t * t), 0.7);
    return [depth * taper, p.y, p.x];
  };
  const strip = (
    a: number,
    ax: number,
    c: number,
    cx: number,
    finish: Finish,
    reverse: boolean,
  ) => {
    const positions: number[] = [],
      indices: number[] = [];
    for (let i = 0; i <= 56; i++)
      positions.push(
        ...bladePoint(i / 56, a, ax),
        ...bladePoint(i / 56, c, cx),
      );
    for (let i = 0; i < 56; i++) {
      const n = i * 2;
      if (reverse) indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      else indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    b.mesh(b.body, geometry, finish);
  };
  for (const side of [-1, 1]) {
    strip(0, side * 0.0013, 0.12, side * 0.0023, 'edge', side < 0);
    strip(0.12, side * 0.0023, 0.66, side * 0.002, 'blade', side < 0);
    strip(0.66, side * 0.002, 0.93, side * 0.00045, 'blade', side < 0);
    strip(0.93, side * 0.00045, 1, 0, 'honed', side < 0);
  }
  strip(0, -0.0013, 0, 0.0013, 'steel', false);

  const grip = new THREE.Shape();
  grip.moveTo(-0.008, 0.018);
  grip.bezierCurveTo(0.023, 0.025, 0.066, 0.023, 0.094, 0.011);
  grip.quadraticCurveTo(0.111, 0.004, 0.118, -0.005);
  grip.lineTo(0.108, -0.02);
  grip.quadraticCurveTo(0.098, -0.01, 0.089, -0.017);
  grip.quadraticCurveTo(0.081, -0.026, 0.072, -0.018);
  grip.quadraticCurveTo(0.06, -0.026, 0.05, -0.017);
  grip.quadraticCurveTo(0.038, -0.025, 0.026, -0.016);
  grip.quadraticCurveTo(0.009, -0.01, 0.003, -0.024);
  grip.quadraticCurveTo(-0.005, -0.026, -0.008, -0.018);
  grip.quadraticCurveTo(-0.014, -0.004, -0.008, 0.018);
  grip.closePath();
  const extrude = (
    shape: THREE.Shape,
    width: number,
    x: number,
    finish: Finish,
    bevel: number,
  ) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      steps: 1,
      bevelEnabled: true,
      bevelSize: bevel,
      bevelThickness: bevel,
      bevelSegments: 3,
      curveSegments: 32,
    });
    geometry.rotateY(-Math.PI / 2).translate(width / 2 + x, 0, 0);
    b.mesh(b.body, geometry, finish);
  };
  extrude(grip, 0.006, 0, 'steel', 0.001);
  const panel = new THREE.Shape();
  panel.moveTo(0.001, 0.013);
  panel.bezierCurveTo(0.026, 0.02, 0.065, 0.017, 0.086, 0.007);
  panel.quadraticCurveTo(0.099, 0.002, 0.1, -0.007);
  panel.quadraticCurveTo(0.092, -0.015, 0.083, -0.01);
  panel.bezierCurveTo(0.064, -0.011, 0.025, -0.009, 0.005, -0.016);
  panel.quadraticCurveTo(-0.001, -0.005, 0.001, 0.016);
  panel.closePath();
  for (const side of [-1, 1]) {
    extrude(panel, 0.007, side * 0.007, 'polymer', 0.0015);
    for (const z of [0.011, 0.085]) {
      // Recessed steel washers and small socket heads sit flush with the scales.
      b.link(
        b.body,
        [side * 0.0117, 0.001, z],
        [side * 0.0122, 0.001, z],
        0.0035,
        0.0035,
        'steel',
        24,
      );
      b.link(
        b.body,
        [side * 0.0122, 0.001, z],
        [side * 0.0125, 0.001, z],
        0.0015,
        0.0015,
        'recess',
        6,
      );
    }
    // Closely spaced diamond checkering gives the grip a tactile, machined finish.
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 14; col++) {
        const z = 0.024 + col * 0.0036 + (row % 2) * 0.0018;
        const y = -0.004 + row * 0.0036;
        b.profile(
          b.body,
          [
            [z - 0.0011, y],
            [z, y - 0.0011],
            [z + 0.0011, y],
            [z, y + 0.0011],
          ],
          0.00025,
          'recess',
          0,
          side * 0.01205,
        );
      }
  }
  // A flat, chamfered full-tang ring, with a real opening for the index finger.
  const ring = new THREE.Shape();
  ring.absarc(0.124, -0.007, 0.021, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0.124, -0.007, 0.0145, 0, Math.PI * 2, true);
  ring.holes.push(hole);
  extrude(ring, 0.006, 0, 'steel', 0.0012);
  for (const side of [-1, 1]) {
    const rim = new THREE.Shape();
    rim.absarc(0.124, -0.007, 0.0198, 0, Math.PI * 2, false);
    const rimHole = new THREE.Path();
    rimHole.absarc(0.124, -0.007, 0.0188, 0, Math.PI * 2, true);
    rim.holes.push(rimHole);
    extrude(rim, 0.0004, side * 0.0043, 'edge', 0.0002);
  }
  for (let i = 0; i < 5; i++) {
    const point = spine.getPoint(0.026 + i * 0.026);
    b.box(
      b.body,
      0,
      point.y + 0.0004,
      point.x,
      0.003,
      0.0013,
      0.001,
      'steel',
      0.0002,
    );
  }
  b.muzzle.set(0, -0.094, -0.11);
  if (b.showHands) {
    const gripPose = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    gripPose.setPosition(0, -0.053, -0.015);
    for (const part of b.body.children) part.applyMatrix4(gripPose);
    b.muzzle.applyMatrix4(gripPose);
  }
}

function knife(b: ModelBuilder, style: 'standard' | 'karambit') {
  const curved = style === 'karambit';
  b.root.userData.knifeStyle = style;
  if (curved) {
    karambit(b);
  } else {
    knifeBlade(
      b,
      [
        [-0.025, 0.034],
        [-0.23, 0.038],
        [-0.35, 0.012],
        [-0.253, -0.043],
        [-0.1, -0.045],
        [-0.046, -0.027],
        [-0.025, -0.027],
      ],
      [
        [-0.028, 0.029],
        [-0.228, 0.032],
        [-0.333, 0.012],
        [-0.249, -0.023],
        [-0.105, -0.026],
        [-0.048, -0.017],
        [-0.028, -0.019],
      ],
    );
    b.profile(
      b.body,
      [
        [-0.017, 0.028],
        [0.166, 0.023],
        [0.179, 0.006],
        [0.169, -0.03],
        [-0.017, -0.028],
      ],
      0.018,
      'steel',
      0.002,
    );
    for (const side of [-1, 1]) {
      b.profile(
        b.body,
        [
          [0.012, 0.025],
          [0.145, 0.022],
          [0.16, 0.009],
          [0.151, -0.027],
          [0.106, -0.023],
          [0.064, -0.027],
          [0.011, -0.021],
        ],
        0.012,
        'polymer',
        0.004,
        side * 0.014,
      );
      for (let i = 0; i < 9; i++)
        b.box(
          b.body,
          side * 0.022,
          -0.001,
          0.026 + i * 0.013,
          0.0018,
          0.034,
          0.0025,
          'recess',
          0.0004,
        );
      for (const z of [0.025, 0.135])
        b.bolt(side * 0.023, -0.001, z, b.body, 0.004);
      b.profile(
        b.body,
        [
          [-0.076, 0.02],
          [-0.221, 0.022],
          [-0.25, 0.013],
          [-0.081, 0.008],
        ],
        0.0006,
        'recess',
        0.0003,
        side * 0.0042,
      );
    }
    b.profile(
      b.body,
      [
        [-0.019, 0.061],
        [-0.006, 0.062],
        [0.005, 0.025],
        [0.002, -0.033],
        [-0.01, -0.059],
        [-0.023, -0.054],
      ],
      0.049,
      'edge',
      0.003,
    );
    b.box(b.body, 0, -0.002, 0.169, 0.037, 0.047, 0.014, 'steel', 0.003);
    for (let i = 0; i < 7; i++)
      b.box(
        b.body,
        0,
        0.035,
        -0.038 - i * 0.008,
        0.012,
        0.004,
        0.003,
        'edge',
        0.0005,
      );
    b.muzzle.set(0, 0.012, -0.35);
  }
  b.sightHeight = 0.07;
  knifeHand(b, curved);
}

function shotgun(b: ModelBuilder) {
  // Tactical pump: separate upper bore and lower magazine tube, ribbed oval pump, restrained shell carrier.
  b.shell(
    b.body,
    [
      [-0.132, 0.064, 0.068, 0.026],
      [-0.11, 0.077, 0.084, 0.023],
      [0.089, 0.077, 0.076, 0.022],
      [0.124, 0.053, 0.053, 0.014],
    ],
    'steel',
    0.23,
  );
  b.tube(b.body, 0, 0.03, -0.39, 0.018, 0.54, 'steel', 20);
  b.tube(b.body, 0, -0.021, -0.334, 0.015, 0.417, 'steel', 16);
  b.muzzleAt(-0.678, 0.03, 0.021, false);
  b.ring(b.body, 0, 0.03, -0.525, 0.023, 0.018, 0.016, 'polymer');
  b.tube(b.body, 0, -0.021, -0.551, 0.017, 0.024, 'steel');
  b.shell(
    b.pump,
    [
      [-0.429, 0.052, 0.055, -0.022],
      [-0.416, 0.075, 0.073, -0.019],
      [-0.265, 0.075, 0.073, -0.019],
      [-0.25, 0.052, 0.055, -0.02],
    ],
    'shell',
    0.32,
  );
  for (let i = 0; i < 8; i++)
    b.shell(
      b.pump,
      [
        [-0.274 - i * 0.018, 0.078, 0.077, -0.019],
        [-0.278 - i * 0.018, 0.078, 0.077, -0.019],
      ],
      'polymer',
      0.32,
    );
  for (const s of [-1, 1]) {
    b.box(b.body, s * 0.04, 0.019, -0.023, 0.0014, 0.028, 0.078, 'recess');
    b.box(b.body, s * 0.044, 0.009, -0.033, 0.007, 0.008, 0.026, 'edge');
    b.bolt(s * 0.039, -0.014, 0.064);
  }
  b.grip(0.061, -0.03, 0.021, 0.052);
  b.guard(-0.001, -0.068, 0.052, 0.92);
  b.profile(
    b.body,
    [
      [0.109, 0.021],
      [0.26, 0.009],
      [0.287, -0.016],
      [0.276, -0.122],
      [0.227, -0.121],
      [0.198, -0.053],
      [0.109, -0.046],
    ],
    0.069,
    'shell',
    0.004,
  );
  b.shell(
    b.body,
    [
      [0.269, 0.075, 0.161, -0.048],
      [0.286, 0.079, 0.167, -0.048],
      [0.293, 0.071, 0.157, -0.048],
    ],
    'polymer',
  );
  b.shell(
    b.body,
    [
      [0.165, 0.06, 0.024, 0.026],
      [0.253, 0.066, 0.027, 0.021],
    ],
    'polymer',
  );
  for (let i = 0; i < 4; i++) {
    const z = 0.062 - i * 0.025;
    b.link(
      b.body,
      [-0.049, -0.024, z],
      [-0.049, 0.017, z],
      0.008,
      0.008,
      'accent',
      12,
    );
    b.link(
      b.body,
      [-0.049, 0.017, z],
      [-0.049, 0.023, z],
      0.0088,
      0.0088,
      'edge',
      12,
    );
    b.box(b.body, -0.047, -0.016, z, 0.017, 0.016, 0.019, 'polymer');
  }
  // Raised bead and ghost-ring are anchored to the barrel/receiver.
  b.profile(
    b.body,
    [
      [-0.592, 0.043],
      [-0.574, 0.078],
      [-0.56, 0.078],
      [-0.55, 0.043],
    ],
    0.014,
    'steel',
    0.001,
  );
  b.ring(b.body, 0, 0.083, 0.069, 0.013, 0.008, 0.008, 'steel');
  b.box(b.body, 0, 0.061, 0.069, 0.025, 0.025, 0.017, 'polymer');
  b.box(b.body, 0, 0.083, -0.567, 0.003, 0.007, 0.004, 'accent', 0.001);
  b.sightHeight = 0.083;
  b.hands(-0.337, false, 0.061);
}

export function buildWeapon(
  id: WeaponId,
  skin?: string,
  showHands = true,
  knifeStyle: 'standard' | 'karambit' = 'standard',
): WeaponModel {
  const b = new ModelBuilder(id, id === 'knife' ? undefined : skin, showHands);
  if (id === 'rifle' || id === 'carbine') assault(b);
  else if (id === 'smg' || id === 'vector') submachine(b);
  else if (id === 'marksman') marksman(b);
  else if (id === 'pistol' || id === 'handcannon') handgun(b);
  else if (id === 'knife') knife(b, knifeStyle);
  else shotgun(b);
  return b.finish();
}

/** Root locomotion is supplied by the renderer; these channels only animate moving parts. */
export type KnifeMotion = {
  slashSide?: number;
  draw?: number;
  inspect?: number;
};
const wristPivot = new THREE.Vector3(0.064, -0.008, -0.025);
const rotatedWrist = new THREE.Vector3();
const elbowPivot = new THREE.Vector3(0.218, -0.105, -0.22);
const rotatedElbow = new THREE.Vector3();
const ease = (t: number) => {
  const p = THREE.MathUtils.clamp(t, 0, 1);
  return p * p * (3 - 2 * p);
};
export function animateWeapon(
  model: WeaponModel,
  kick: number,
  reloadFraction: number,
  knifeMotion: KnifeMotion = {},
) {
  const { id, body, action, magazine, supportHand, pump, arm } = model.rig;
  const recoil = THREE.MathUtils.clamp(Number.isFinite(kick) ? kick : 0, 0, 1);
  const progress = THREE.MathUtils.clamp(
    Number.isFinite(reloadFraction) ? reloadFraction : 0,
    0,
    1,
  );
  const reload = Math.sin(Math.PI * progress);
  if (id === 'knife') {
    if (model.userData.knifeStyle === 'karambit') {
      const t = 1 - recoil,
        side = knifeMotion.slashSide ?? 1;
      const wind = recoil > 0 && t < 0.16 ? Math.sin((t / 0.16) * Math.PI) : 0;
      const cut =
        recoil > 0
          ? t < 0.4
            ? ease((t - 0.1) / 0.3)
            : 1 - ease((t - 0.4) / 0.6)
          : 0;
      const draw = ease(knifeMotion.draw ?? 0),
        inspect = Math.sin(Math.PI * ease(knifeMotion.inspect ?? 0));
      if (arm) {
        // The elbow drives the full forearm, including the cuff and knife grip.
        arm.rotation.set(
          -cut * 0.22 + wind * 0.1 - draw * 0.18 - inspect * 0.12,
          -side * cut * 0.38 + side * wind * 0.12 + draw * 0.3 - inspect * 0.18,
          -side * cut * 0.78 +
            side * wind * 0.18 -
            draw * 0.58 +
            inspect * 0.22,
        );
        rotatedElbow.copy(elbowPivot).applyEuler(arm.rotation);
        arm.position.copy(elbowPivot).sub(rotatedElbow);
        arm.position.y += cut * 0.025 - draw * 0.06 + inspect * 0.025;
        arm.position.z -= cut * 0.045;
      }
      // A smaller wrist follow-through stays attached to the moving sleeve.
      body.rotation.set(
        -cut * 0.08 - draw * 0.06 - inspect * 0.16,
        -side * cut * 0.12 + draw * 0.25 - inspect * 0.22,
        -side * cut * 0.24 + side * wind * 0.04 - draw * 0.12 + inspect * 0.16,
      );
      rotatedWrist.copy(wristPivot).applyEuler(body.rotation);
      body.position.copy(wristPivot).sub(rotatedWrist);
      supportHand.position.set(0, 0, 0);
      supportHand.rotation.set(0, 0, 0);
      return;
    }
    // A short wind-up, decisive cut and slower return keep the wrist attached.
    const t = 1 - recoil,
      active = recoil > 0;
    const windup = active && t < 0.18 ? Math.sin((t / 0.18) * Math.PI) : 0;
    const cut =
      active && t >= 0.18
        ? Math.sin(Math.PI * Math.pow((t - 0.18) / 0.82, 0.58))
        : 0;
    const inspect = Math.sin(Math.PI * ease(knifeMotion.inspect ?? 0));
    body.rotation.set(
      windup * 0.08 - cut * 0.22 - inspect * 0.12,
      windup * 0.12 - cut * 0.4 + inspect * 0.6,
      windup * 0.12 - cut * 0.78 + inspect * 0.15,
    );
    body.position.set(windup * 0.015 - cut * 0.07, cut * 0.022, -cut * 0.055);
    return;
  }
  action.position.z =
    (id === 'pistol' || id === 'handcannon' ? 0.03 : 0.013) * recoil;
  magazine.position.y =
    -(id === 'pistol' || id === 'handcannon' ? 0.105 : 0.155) * reload;
  magazine.rotation.x = reload * 0.1;
  supportHand.position.y = -reload * 0.025;
  supportHand.position.z = 0;
  pump.position.z = 0;
  if (id === 'shotgun') {
    const travel =
      Math.sin(Math.PI * THREE.MathUtils.clamp((1 - recoil) * 1.5, 0, 1)) *
      (recoil > 0 ? 0.053 : 0);
    pump.position.z = travel;
    supportHand.position.z = travel;
    magazine.position.y = 0;
  }
}
export function updateWeaponFinish(model: WeaponModel, time: number) {
  model.userData.finish.time.value = Number.isFinite(time) ? time : 0;
}
