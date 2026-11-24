import * as THREE from 'three';

const SMOKE_COUNT = 220;
const SPARK_COUNT = 180;
const STREAK_COUNT = 130;
const AMBIENT_COUNT = 240;

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface SmokeSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  sizeStart: number;
  sizeEnd: number;
  r: number;
  g: number;
  b: number;
  maxAlpha: number;
}

interface SparkSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  scale: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Zero-GC pooled particle engine combining:
 * 1) Custom GLSL soft volumetric smoke & steam plumes (track vents, jetpack, slides)
 * 2) Instanced high-speed slipstream wind streaks scaling with speed
 * 3) Gravity-driven metallic sparks, coin bursts & shield shockwaves
 * 4) Atmospheric dust motes / reflective rain streaks
 */
export class ParticleSystem {
  public readonly group = new THREE.Group();
  public enabled = true;

  // 1. Smoke & Steam Points
  private smokeSlots: SmokeSlot[] = [];
  private smokeCursor = 0;
  private smokeGeo: THREE.BufferGeometry;
  private smokeMat: THREE.ShaderMaterial;
  private smokePoints: THREE.Points;
  private smokePosArr: Float32Array;
  private smokeSizeArr: Float32Array;
  private smokeAlphaArr: Float32Array;
  private smokeColorArr: Float32Array;

  // 2. Sparks InstancedMesh
  private sparkSlots: SparkSlot[] = [];
  private sparkCursor = 0;
  private sparkMesh: THREE.InstancedMesh;

  // 3. High-Speed Slipstream Streaks InstancedMesh
  private streakMesh: THREE.InstancedMesh;
  private streakData: { x: number; y: number; zOffset: number; len: number; speedMul: number }[] = [];

  // 4. Atmospheric Dust / Rain InstancedMesh
  private ambientMesh: THREE.InstancedMesh;
  private ambientData: { x: number; y: number; zOffset: number; fallSpeed: number }[] = [];
  private isRainMode = false;

  private ventTimer = 0;

  constructor(smokeTexture: THREE.Texture) {
    // --- Smoke System ---
    this.smokePosArr = new Float32Array(SMOKE_COUNT * 3);
    this.smokeSizeArr = new Float32Array(SMOKE_COUNT);
    this.smokeAlphaArr = new Float32Array(SMOKE_COUNT);
    this.smokeColorArr = new Float32Array(SMOKE_COUNT * 3);

    for (let i = 0; i < SMOKE_COUNT; i++) {
      this.smokeSlots.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 1,
        sizeStart: 1,
        sizeEnd: 3,
        r: 0.85,
        g: 0.88,
        b: 0.94,
        maxAlpha: 0.35,
      });
      this.smokePosArr[i * 3 + 1] = -100;
    }

    this.smokeGeo = new THREE.BufferGeometry();
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePosArr, 3));
    this.smokeGeo.setAttribute('aSize', new THREE.BufferAttribute(this.smokeSizeArr, 1));
    this.smokeGeo.setAttribute('aAlpha', new THREE.BufferAttribute(this.smokeAlphaArr, 1));
    this.smokeGeo.setAttribute('aColor', new THREE.BufferAttribute(this.smokeColorArr, 3));

    this.smokeMat = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: smokeTexture },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uPixelRatio;

        void main() {
          vAlpha = aAlpha;
          vColor = aColor;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio * (260.0 / max(-mvPosition.z, 1.0));
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying float vAlpha;
        varying vec3 vColor;

        void main() {
          if (vAlpha <= 0.005) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor, tex.a * vAlpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.smokePoints = new THREE.Points(this.smokeGeo, this.smokeMat);
    this.smokePoints.frustumCulled = false;
    this.group.add(this.smokePoints);

    // --- Sparks InstancedMesh ---
    const sparkGeo = new THREE.BoxGeometry(0.055, 0.055, 0.42);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_COUNT);
    this.sparkMesh.frustumCulled = false;
    for (let i = 0; i < SPARK_COUNT; i++) {
      this.sparkSlots.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        age: 0,
        life: 0.5,
        scale: 1,
        r: 1,
        g: 0.78,
        b: 0.3,
      });
      _dummy.position.set(0, -100, 0);
      _dummy.scale.set(0, 0, 0);
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
      this.sparkMesh.setColorAt(i, _color.setRGB(1, 0.8, 0.3));
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    this.group.add(this.sparkMesh);

    // --- High-Speed Slipstream Streaks ---
    const streakGeo = new THREE.BoxGeometry(0.025, 0.025, 3.2);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xd8f0ff,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.streakMesh = new THREE.InstancedMesh(streakGeo, streakMat, STREAK_COUNT);
    this.streakMesh.frustumCulled = false;
    for (let i = 0; i < STREAK_COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const spreadX = side * (2.6 + Math.random() * 6.5);
      this.streakData.push({
        x: spreadX,
        y: 0.6 + Math.random() * 7.8,
        zOffset: -Math.random() * 85,
        len: 0.7 + Math.random() * 1.4,
        speedMul: 1.15 + Math.random() * 0.7,
      });
    }
    this.group.add(this.streakMesh);

    // --- Atmospheric Dust Motes / Rain Streaks ---
    const ambientGeo = new THREE.BoxGeometry(0.032, 0.42, 0.032);
    const ambientMat = new THREE.MeshBasicMaterial({
      color: 0xffe4b8,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.ambientMesh = new THREE.InstancedMesh(ambientGeo, ambientMat, AMBIENT_COUNT);
    this.ambientMesh.frustumCulled = false;
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      this.ambientData.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 11,
        zOffset: -Math.random() * 72 + 8,
        fallSpeed: 12 + Math.random() * 10,
      });
    }
    this.group.add(this.ambientMesh);
  }

  public setAtmosphereMode(rain: boolean, tintHex: number): void {
    this.isRainMode = rain;
    const mat = this.ambientMesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(rain ? 0xa5d8ff : tintHex);
    mat.opacity = rain ? 0.48 : 0.32;
  }

  public emitSmoke(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    sizeStart: number,
    sizeEnd: number,
    colorHex = 0xcbd5e1,
    maxAlpha = 0.36,
  ): void {
    if (!this.enabled) return;
    const slot = this.smokeSlots[this.smokeCursor];
    this.smokeCursor = (this.smokeCursor + 1) % SMOKE_COUNT;
    _color.setHex(colorHex);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.z = z;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.age = 0;
    slot.life = life;
    slot.sizeStart = sizeStart;
    slot.sizeEnd = sizeEnd;
    slot.r = _color.r;
    slot.g = _color.g;
    slot.b = _color.b;
    slot.maxAlpha = maxAlpha;
  }

  public emitSparkBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 9,
  ): void {
    if (!this.enabled) return;
    _color.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const slot = this.sparkSlots[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_COUNT;
      const theta = Math.random() * Math.PI * 2;
      const up = 0.25 + Math.random() * 0.85;
      const spd = speed * (0.45 + Math.random() * 0.85);
      slot.active = true;
      slot.x = x + (Math.random() - 0.5) * 0.35;
      slot.y = y + (Math.random() - 0.5) * 0.35;
      slot.z = z + (Math.random() - 0.5) * 0.35;
      slot.vx = Math.cos(theta) * spd;
      slot.vy = up * spd;
      slot.vz = Math.sin(theta) * spd;
      slot.age = 0;
      slot.life = 0.28 + Math.random() * 0.32;
      slot.scale = 0.7 + Math.random() * 0.8;
      slot.r = _color.r;
      slot.g = _color.g;
      slot.b = _color.b;
    }
  }

  public update(
    dt: number,
    playerX: number,
    playerY: number,
    playerZ: number,
    speed: number,
    jetpackActive: boolean,
    hoverboardActive: boolean,
    rolling: boolean,
  ): void {
    this.group.visible = this.enabled;
    if (!this.enabled) return;

    // Periodic ambient subway steam vents along platforms + trail smoke
    this.ventTimer += dt;
    if (this.ventTimer > 0.09) {
      this.ventTimer = 0;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.emitSmoke(
        side * 5.8 + (Math.random() - 0.5) * 0.6,
        1.15,
        playerZ - 16 - Math.random() * 44,
        -side * (0.4 + Math.random() * 0.7),
        1.4 + Math.random() * 1.1,
        (Math.random() - 0.5) * 0.8,
        1.8 + Math.random() * 0.9,
        0.9,
        3.6,
        0xdbe6f4,
        0.24,
      );
    }

    // Jetpack fiery smoke & sparks plume
    if (jetpackActive) {
      for (const sx of [-0.14, 0.14]) {
        this.emitSmoke(
          playerX + sx,
          playerY + 0.95,
          playerZ + 0.48,
          (Math.random() - 0.5) * 1.2,
          -3.4,
          4.5,
          0.52,
          0.42,
          2.1,
          Math.random() < 0.45 ? 0xff922b : 0x94a3b8,
          0.55,
        );
      }
      this.emitSparkBurst(playerX, playerY + 0.85, playerZ + 0.5, 2, 0xffae34, 6);
    } else if (hoverboardActive) {
      // Hoverboard plasma exhaust
      this.emitSmoke(
        playerX + (Math.random() - 0.5) * 0.35,
        playerY + 0.18,
        playerZ + 0.82,
        (Math.random() - 0.5) * 0.8,
        0.35,
        3.0,
        0.34,
        0.28,
        1.15,
        0x38bdf8,
        0.38,
      );
    } else if (rolling) {
      // Parkour slide dust plume
      this.emitSmoke(
        playerX + (Math.random() - 0.5) * 0.5,
        playerY + 0.16,
        playerZ + 0.35,
        (Math.random() - 0.5) * 1.6,
        0.9,
        2.5,
        0.48,
        0.35,
        1.45,
        0xb8b2a6,
        0.34,
      );
    }

    // Update Smoke Pool
    for (let i = 0; i < SMOKE_COUNT; i++) {
      const s = this.smokeSlots[i];
      if (!s.active) {
        this.smokeAlphaArr[i] = 0;
        continue;
      }
      s.age += dt;
      if (s.age >= s.life) {
        s.active = false;
        this.smokeAlphaArr[i] = 0;
        continue;
      }
      const t = s.age / s.life;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.vy += 0.4 * dt;

      this.smokePosArr[i * 3] = s.x;
      this.smokePosArr[i * 3 + 1] = s.y;
      this.smokePosArr[i * 3 + 2] = s.z;
      this.smokeSizeArr[i] = s.sizeStart + (s.sizeEnd - s.sizeStart) * t;
      // Smooth fade-in then soft fade-out
      const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      this.smokeAlphaArr[i] = fade * s.maxAlpha;
      this.smokeColorArr[i * 3] = s.r;
      this.smokeColorArr[i * 3 + 1] = s.g;
      this.smokeColorArr[i * 3 + 2] = s.b;
    }
    this.smokeGeo.attributes.position.needsUpdate = true;
    this.smokeGeo.attributes.aSize.needsUpdate = true;
    this.smokeGeo.attributes.aAlpha.needsUpdate = true;
    this.smokeGeo.attributes.aColor.needsUpdate = true;

    // Update Sparks Pool
    let sparksDirty = false;
    for (let i = 0; i < SPARK_COUNT; i++) {
      const sp = this.sparkSlots[i];
      if (!sp.active) continue;
      sparksDirty = true;
      sp.age += dt;
      if (sp.age >= sp.life) {
        sp.active = false;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        this.sparkMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }
      sp.vy -= 26 * dt;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.z += sp.vz * dt;
      const lifeLeft = 1 - sp.age / sp.life;
      _dummy.position.set(sp.x, sp.y, sp.z);
      _dummy.rotation.set(sp.vy * 0.08, sp.vx * 0.08, 0);
      _dummy.scale.set(sp.scale * lifeLeft, sp.scale * lifeLeft, sp.scale * (0.6 + lifeLeft));
      _dummy.updateMatrix();
      this.sparkMesh.setMatrixAt(i, _dummy.matrix);
      this.sparkMesh.setColorAt(i, _color.setRGB(sp.r, sp.g, sp.b));
    }
    if (sparksDirty) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }

    // Update High-Speed Slipstream Wind Streaks
    const speedFactor = Math.max(0, Math.min(1, (speed - 20) / 30));
    const streakMat = this.streakMesh.material as THREE.MeshBasicMaterial;
    streakMat.opacity = (jetpackActive ? 0.56 : 0.14 + speedFactor * 0.38);

    for (let i = 0; i < STREAK_COUNT; i++) {
      const st = this.streakData[i];
      st.zOffset += speed * st.speedMul * dt;
      if (st.zOffset > 10) {
        st.zOffset = -75 - Math.random() * 25;
        st.y = Math.max(0.5, playerY - 0.5 + Math.random() * 7.5);
      }
      _dummy.position.set(st.x, st.y, playerZ + st.zOffset);
      _dummy.rotation.set(0, 0, 0);
      const lengthScale = st.len * (0.6 + speedFactor * 1.6 + (jetpackActive ? 0.9 : 0));
      _dummy.scale.set(1, 1, lengthScale);
      _dummy.updateMatrix();
      this.streakMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.streakMesh.instanceMatrix.needsUpdate = true;

    // Update Atmospheric Rain / Golden Dust Motes
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      const amb = this.ambientData[i];
      if (this.isRainMode) {
        amb.y -= amb.fallSpeed * dt;
        amb.zOffset += speed * 0.65 * dt;
        if (amb.y < 0.1) {
          amb.y = 11 + Math.random() * 3;
          amb.x = (Math.random() - 0.5) * 20;
        }
        if (amb.zOffset > 12) amb.zOffset = -68;
        _dummy.position.set(amb.x, amb.y, playerZ + amb.zOffset);
        _dummy.rotation.set(0.18, 0, 0.08);
        _dummy.scale.set(0.75, 2.2, 0.75);
      } else {
        // Floating illuminated dust motes drifting lazily in volumetric light shafts
        amb.y -= 0.4 * dt;
        amb.zOffset += speed * 0.18 * dt;
        if (amb.y < 0.2) amb.y = 10.5;
        if (amb.zOffset > 12) amb.zOffset = -68;
        _dummy.position.set(amb.x, amb.y, playerZ + amb.zOffset);
        _dummy.rotation.set(0, 0, 0);
        _dummy.scale.set(1.6, 0.15, 1.6);
      }
      _dummy.updateMatrix();
      this.ambientMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.ambientMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.smokeGeo.dispose();
    this.smokeMat.dispose();
    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.streakMesh.geometry.dispose();
    (this.streakMesh.material as THREE.Material).dispose();
    this.ambientMesh.geometry.dispose();
    (this.ambientMesh.material as THREE.Material).dispose();
  }
}
