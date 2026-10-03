/* ============================================================
   Procedural android bust.
   The skull and chest are deformed spheres cut into separate
   armour plates. Each plate sits a hair above a darker core, so
   the gaps between plates read as real panel seams.

   Model space: origin at the base of the neck, +Z faces forward.
   Skull centre ends up near y = 1.5, shoulders drop to y = -2.
   ============================================================ */
import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

const PI = Math.PI;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------- shape functions (unit-sphere direction in, surface point out) ---------- */

// Elongated android skull: long occipital, narrow jaw swept forward and down.
function skull(p) {
  const lower = smooth(0.1, -0.9, p.y);
  const front = smooth(-0.2, 0.9, p.z);
  const back = smooth(0.1, -0.9, p.z);
  let x = p.x * 0.8;
  let y = p.y;
  let z = p.z * 1.05;

  z += lower * front * 0.36;                 // muzzle reaches forward
  y -= lower * front * 0.16;                 // and down
  x *= 1 - lower * 0.4;                      // jaw narrows
  z -= back * 0.16 * (1 - lower);            // long back of the head
  if (p.y > 0) y *= 1 - 0.07 * p.y;          // slightly flattened crown
  const nape = smooth(0, -0.8, p.y) * back;  // pinch where skull meets neck
  y += nape * 0.22;
  z *= 1 - nape * 0.12;
  return new THREE.Vector3(x, y, z);
}

// Broad chest with sloping shoulders.
function chest(p) {
  return new THREE.Vector3(
    p.x * 1.72,
    p.y * 1.02 - 0.3 * p.x * p.x,
    p.z * (p.z > 0 ? 0.92 : 0.8),
  );
}

/* ---------- geometry helpers ---------- */

// A sphere patch (three.js phi/theta ranges) pushed through a shape function,
// offset outward by k, with vertices welded so normals stay smooth.
function patch(shape, k, phiStart, phiLength, thetaStart, thetaLength, segs = [96, 64]) {
  let g = new THREE.SphereGeometry(1, segs[0], segs[1], phiStart, phiLength, thetaStart, thetaLength);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    pos.setXYZ(i, ...shape(v).multiplyScalar(k).toArray());
  }
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g, 1e-4);
  g.computeVertexNormals();
  return g;
}

// point on a shaped surface, from three.js spherical angles
function onSurface(shape, k, phi, theta) {
  const d = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  return shape(d).multiplyScalar(k);
}

function cylinderBetween(a, b, r, mat, seg = 20) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function tube(points, r, mat, radial = 12) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 16, r, radial), mat);
}

/* ============================================================
   BUILD
   mats: shell (armour), core (seams/inner), trim (metal),
         rubber (hoses, cables), visor (mirror face)
   ============================================================ */
export function buildRobot(mats) {
  const { shell, core, trim, rubber, visor } = mats;
  const glow = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, toneMapped: false });
  const ds = (m) => { const c = m.clone(); c.side = THREE.DoubleSide; return c; };
  const shellDS = ds(shell), visorDS = ds(visor), trimDS = ds(trim);

  const model = new THREE.Group();
  const ledMats = [];
  const spinners = [];
  const earRings = [];

  /* ---- whole-bot soft white glow shell (always on) ---- */
  const glowShellMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, side: THREE.BackSide,
    depthWrite: false, toneMapped: false,
  });
  const glowShell = new THREE.Mesh(
    new THREE.SphereGeometry(1.7, 48, 48), glowShellMat
  );
  glowShell.position.set(0, 0.35, 0); /* roughly centred on the bot's mass */
  model.add(glowShell);

  /* ================= TORSO ================= */
  const torso = new THREE.Group();
  torso.position.y = -1.0;
  model.add(torso);
  const G = 0.035;                                         // plate gap, radians

  torso.add(new THREE.Mesh(patch(chest, 0.975, 0, PI * 2, 0, PI * 0.62), core));
  // pectoral plates either side of a sternum channel
  torso.add(new THREE.Mesh(patch(chest, 1, PI / 2 + 0.07, 1.25, PI * 0.17, PI * 0.43), shellDS));
  torso.add(new THREE.Mesh(patch(chest, 1, PI / 2 - 1.32, 1.25, PI * 0.17, PI * 0.43), shellDS));
  // side and back armour
  torso.add(new THREE.Mesh(patch(chest, 1, PI / 2 + 1.32 + G, PI * 2 - 2.64 - 2 * G, PI * 0.14, PI * 0.46), shellDS));
  // yoke around the neck
  torso.add(new THREE.Mesh(patch(chest, 1.006, 0, PI * 2, 0, PI * 0.15 - G), shellDS));
  const yokeEdge = [];
  for (let i = 0; i <= 64; i++) yokeEdge.push(onSurface(chest, 1.01, (i / 64) * PI * 2, PI * 0.15 - G * 0.5));
  torso.add(tube(yokeEdge, 0.016, trim, 6));
  // sternum spine: a raised metal strip with ribs
  const sternumPts = [];
  for (let i = 0; i <= 12; i++) sternumPts.push(onSurface(chest, 0.995, PI / 2, PI * (0.17 + (0.4 * i) / 12)));
  torso.add(tube(sternumPts, 0.035, trim, 8));
  for (let i = 0; i < 6; i++) {
    const p = onSurface(chest, 1.0, PI / 2, PI * (0.22 + i * 0.055));
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.05), trim);
    rib.position.copy(p);
    rib.lookAt(p.clone().multiplyScalar(2));
    torso.add(rib);
  }
  // chest status light, a small ring under the yoke
  const chestLightMat = glow();
  const chestLight = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 40), chestLightMat);
  const clp = onSurface(chest, 1.02, PI / 2, PI * 0.2);
  chestLight.position.copy(clp);
  chestLight.lookAt(clp.clone().multiplyScalar(2).setY(clp.y + 0.6));
  torso.add(chestLight);
  ledMats.push(chestLightMat);

  /* ---- shoulders: joint ball under two stacked pauldron plates ---- */
  // Ear part as circular disc
  for (const side of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(side * 1.52, -0.02, -0.02);
    sh.rotation.z = -side * 0.55;
    torso.add(sh);

    sh.add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 32), core));
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.62, 64, 32, 0, PI * 2, 0, PI * 0.42), shellDS);
    upper.position.y = -0.04;
    sh.add(upper);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.66, 64, 32, 0, PI * 2, PI * 0.43, PI * 0.12), shellDS);
    lower.position.y = -0.04;
    sh.add(lower);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.62 * Math.sin(PI * 0.425), 0.022, 10, 80), trim);
    band.rotation.x = PI / 2;
    band.position.y = -0.04 + 0.62 * Math.cos(PI * 0.425);
    sh.add(band);
    // rivets ringing the top plate
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * PI * 2;
      const r = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 10), trim);
      const t = PI * 0.3;
      r.position.set(Math.cos(a) * 0.63 * Math.sin(t), -0.04 + 0.63 * Math.cos(t), Math.sin(a) * 0.63 * Math.sin(t));
      sh.add(r);
    }
    // upper arm stub, cut off by the frame
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 1.2, 40), shell);
    arm.position.y = -0.85;
    sh.add(arm);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.335 - i * 0.012, 0.335 - i * 0.012, 0.05, 40), trim);
      ring.position.y = -0.42 - i * 0.12;
      sh.add(ring);
    }
  }

  /* ================= NECK ================= */
  const neck = new THREE.Group();
  model.add(neck);
  // spine: alternating metal and rubber discs
  neck.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.8, 32), core).translateY(0.35).translateZ(-0.06));
  for (let i = 0; i < 6; i++) {
    const r = 0.27 - i * 0.012;
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, i % 2 ? 0.05 : 0.035, 40), i % 2 ? rubber : trim);
    d.position.set(0, 0.04 + i * 0.1, -0.06);
    neck.add(d);
  }
  // corrugated throat hose
  for (let i = 0; i < 11; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.032, 10, 28), rubber);
    ring.rotation.x = PI / 2 - 0.25;
    ring.position.set(0, 0.06 + i * 0.058, 0.2 + i * 0.012);
    neck.add(ring);
  }
  // hydraulic pistons from collarbone to jaw
  for (const side of [-1, 1]) {
    const a = new THREE.Vector3(side * 0.36, -0.02, 0.16);
    const b = new THREE.Vector3(side * 0.2, 0.82, 0.3);
    const mid = a.clone().lerp(b, 0.55);
    neck.add(cylinderBetween(a, mid, 0.05, trim));
    neck.add(cylinderBetween(mid, b, 0.028, trim));
    neck.add(cylinderBetween(a.clone().lerp(b, 0.05), a.clone().lerp(b, 0.12), 0.062, core));
  }
  // cable bundle from the back of the skull into the upper back
  [[-0.3, 0.045], [-0.15, 0.035], [0, 0.05], [0.15, 0.035], [0.3, 0.045], [-0.22, 0.025], [0.22, 0.025]].forEach(([x, r], i) => {
    const sag = i > 4 ? 0.12 : 0;
    model.add(tube([
      new THREE.Vector3(x * 0.6, 1.08, -0.5),
      new THREE.Vector3(x * 1.0, 0.55, -0.8 - sag),
      new THREE.Vector3(x * 1.5, 0.05, -0.82 - sag * 0.5),
      new THREE.Vector3(x * 1.9, -0.42, -0.62),
    ], r, rubber));
  });

  /* ================= HEAD ================= */
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.55;
  model.add(headPivot);
  const head = new THREE.Group();
  head.position.y = 0.95;
  headPivot.add(head);

  const capEnd = PI * 0.4;                 // crown plate ends here (theta)
  const faceA = capEnd + 0.07;            // visor slit sits in this gap
  const faceW = 0.98;                     // half-width of the face mask (phi)

  head.add(new THREE.Mesh(patch(skull, 0.972, 0, PI * 2, 0, PI), core));
  // crown
  head.add(new THREE.Mesh(patch(skull, 1, 0, PI * 2, 0, capEnd), shellDS));
  // mirror face mask
  head.add(new THREE.Mesh(patch(skull, 1.012, PI / 2 - faceW, faceW * 2, faceA, PI * 0.86 - faceA), visorDS));
  // cheek and back plates
  head.add(new THREE.Mesh(patch(skull, 1, PI / 2 + faceW + G, PI * 2 - faceW * 2 - 2 * G, capEnd + G, PI * 0.8 - capEnd - G), shellDS));

  // eye: a light line glowing through the slit between crown and mask
  const eyeMat = glow();
  const eyePts = [];
  for (let i = 0; i <= 40; i++) eyePts.push(onSurface(skull, 0.995, PI / 2 - faceW * 0.92 + (faceW * 1.84 * i) / 40, capEnd + 0.035));
  head.add(tube(eyePts, 0.02, eyeMat, 8));

  // crest fin along the midline (diamond profile), flanked by rivet rows
  const crest = [];
  for (let i = 0; i <= 30; i++) crest.push(onSurface(skull, 1.03, PI / 2, 0.95 * (1 - i / 30)).setX(0));
  for (let i = 1; i <= 40; i++) crest.push(onSurface(skull, 1.03, PI * 1.5, (1.95 * i) / 40).setX(0));
  head.add(tube(crest, 0.05, shell, 4));
  const rivetGeo = new THREE.SphereGeometry(0.022, 10, 10);
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 9; i++) {
      const r = new THREE.Mesh(rivetGeo, trim);
      r.position.copy(onSurface(skull, 1.006, PI / 2 + side * 0.17, 0.25 + i * 0.085));
      head.add(r);
    }
    for (let i = 0; i <= 16; i++) {
      const r = new THREE.Mesh(rivetGeo, trim);
      r.position.copy(onSurface(skull, 1.006, PI * 1.5 - side * 0.17, 0.25 + i * 0.095));
      head.add(r);
    }
  }
  // rivet line tracing the crown seam around the back
  for (let i = 0; i <= 16; i++) {
    const r = new THREE.Mesh(rivetGeo, trim);
    r.position.copy(onSurface(skull, 1.006, PI / 2 + faceW + 0.2 + (i / 16) * (PI * 2 - faceW * 2 - 0.4), capEnd - 0.06));
    head.add(r);
  }

  // jaw hinge plates under the ears
  for (const side of [-1, 1]) {
    const p = onSurface(skull, 1.0, side > 0 ? PI + 0.25 : -0.25, PI * 0.66);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 32), trim);
    plate.position.copy(p);
    plate.rotation.z = PI / 2;
    head.add(plate);
  }

  /* ---- ear modules ---- */
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    const at = onSurface(skull, 1.0, side > 0 ? PI + 0.32 : -0.32, PI * 0.5);
    ear.position.copy(at);
    ear.rotation.y = side * 0.39;
    head.add(ear);
    const out = (m, x) => { m.position.x = side * x; return m; };
    const disc = (r1, r2, h, mat, x, seg = 64) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
      m.rotation.z = PI / 2;
      return out(m, x);
    };
    const ring = (r, t, mat, x) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 14, 80), mat);
      m.rotation.y = PI / 2;
      return out(m, x);
    };

    ear.add(disc(0.4, 0.42, 0.12, shell, 0.0));         // housing
    ear.add(ring(0.4, 0.028, trim, 0.065));             // outer bezel
    ear.add(disc(0.31, 0.31, 0.04, core, 0.07));        // recess
    ear.add(ring(0.22, 0.012, trim, 0.09));             // inner bezel
    // vent slits around the recess
    const vents = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * PI * 2;
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.016), trim);
      v.position.set(side * 0.092, Math.sin(a) * 0.265, Math.cos(a) * 0.265);
      v.rotation.x = -a;
      vents.add(v);
    }
    ear.add(vents);
    spinners.push(vents);
    // centre hub: a sharp inner ring that stays fully lit...
    ear.add(disc(0.13, 0.15, 0.08, visor, 0.11, 40));
    const hubMat = glow();
    const hubRing = ring(0.1, 0.01, hubMat, 0.152);
    ear.add(hubRing);
    earRings.push(hubRing);

    // ...plus a soft halo that lets the light bleed far past the disc
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false });
    const haloRing = ring(0.18, 0.045, haloMat, 0.152);
    ear.add(haloRing);
    const haloOuter = ring(0.23, 0.022, new THREE.MeshBasicMaterial({ color: 0x8bc3ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, toneMapped: false, depthWrite: false }), 0.152);
    ear.add(haloOuter);
    earRings.push(haloRing, haloOuter);
    // antenna stub on the upper back edge
    const ant = cylinderBetween(new THREE.Vector3(side * 0.04, 0.3, -0.18), new THREE.Vector3(side * 0.06, 0.62, -0.42), 0.022, trim, 12);
    ear.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), trim);
    tip.position.set(side * 0.06, 0.62, -0.42);
    ear.add(tip);
  }

  /* ---- status LED column in front of each ear ---- */
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const m = glow();
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 12), m);
      led.position.copy(onSurface(skull, 1.012, side > 0 ? PI - 0.38 : 0.38, PI * (0.45 + i * 0.045)));
      head.add(led);
      ledMats.push(m);
    }
  }

  return { model, headPivot, eyeMat, ledMats, spinners, earRings, glowShell };
}

/* ---------- material palettes ---------- */
export function blackPalette() {
  return {
    shell: new THREE.MeshPhysicalMaterial({ color: 0x060607, metalness: 0.35, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.04 }),
    core: new THREE.MeshStandardMaterial({ color: 0x0b0b0c, metalness: 0.6, roughness: 0.55 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xa6a6ac, metalness: 1, roughness: 0.24 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0d0d0e, metalness: 0.1, roughness: 0.6 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x020203, metalness: 0.9, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02 }),
  };
}

export function chromePalette() {
  return {
    shell: new THREE.MeshStandardMaterial({ color: 0xd6d7dc, metalness: 1, roughness: 0.15 }),
    core: new THREE.MeshStandardMaterial({ color: 0x2a2018, metalness: 0.8, roughness: 0.45 }),
    trim: new THREE.MeshStandardMaterial({ color: 0xc27a45, metalness: 1, roughness: 0.28 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.2, roughness: 0.5 }),
    visor: new THREE.MeshPhysicalMaterial({ color: 0x08080a, metalness: 0.9, roughness: 0.05, clearcoat: 1 }),
  };
}
