import * as THREE from 'three';
import { gsap } from 'gsap';
import {
  oceanVertexShader, oceanFragmentShader,
  skyVertexShader, skyFragmentShader,
  celVertexShader, celFragmentShader,
  rupeeVertexShader, rupeeFragmentShader,
} from './shaders';
import { GAME_CONFIG, COLORS, MODE, type GameMode } from './constants';
import type { ZeldaOceanCallbacks, BoatState, ObstacleData, RupeeData, GameStats } from './types';

interface PooledMesh extends THREE.Mesh {
  userData: {
    active: boolean;
    type?: string;
    value?: number;
    lane?: number;
    rotY?: number;
  };
}

export class OceanEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private callbacks: ZeldaOceanCallbacks;

  private oceanMesh!: THREE.Mesh;
  private oceanMaterial!: THREE.ShaderMaterial;
  private skyMesh!: THREE.Mesh;

  private boatGroup!: THREE.Group;
  private boatState: BoatState = {
    x: 0, z: 0, rotation: 0, tilt: 0,
    velocityX: 0, velocityZ: 0, speed: 0,
  };

  private obstaclePool: PooledMesh[] = [];
  private rupeePool: PooledMesh[] = [];
  private cloudMeshes: THREE.Mesh[] = [];

  private activeObstacles: ObstacleData[] = [];
  private activeRupees: RupeeData[] = [];

  private stats: GameStats = {
    score: 0, rupees: 0, lives: GAME_CONFIG.INITIAL_LIVES,
    timePlayed: 0, startTime: 0,
  };

  private mode: GameMode = MODE.DEFAULT;
  private isRunning = false;
  private animFrameId = 0;

  private keys: Record<string, boolean> = {};
  private touchInput = { x: 0, y: 0, active: false };

  private obstacleTimer = 0;
  private rupeeTimer = 0;
  private hitCooldown = 0;
  private cameraTarget = new THREE.Vector3();
  private cameraPos = new THREE.Vector3();

  private sunDirection = new THREE.Vector3(1, 2, 0.5).normalize();
  private celMaterials: THREE.ShaderMaterial[] = [];

  private lanePositions: number[] = [];
  private frameCount = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: ZeldaOceanCallbacks) {
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x9ad8f0, GAME_CONFIG.FOG_NEAR, GAME_CONFIG.FOG_FAR);

    this.camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 400);
    this.camera.position.set(0, GAME_CONFIG.CAMERA_HEIGHT, GAME_CONFIG.CAMERA_DISTANCE);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();

    for (let i = 0; i < GAME_CONFIG.LANE_COUNT; i++) {
      const offset = (i - Math.floor(GAME_CONFIG.LANE_COUNT / 2)) * GAME_CONFIG.LANE_WIDTH;
      this.lanePositions.push(offset);
    }

    this.buildScene();
    this.buildBoat();
    this.buildObstaclePool();
    this.buildRupeePool();
    this.buildClouds();
    this.buildIslands();
    this.setupLighting();
    this.setupInput();
    this.setupResize(canvas);
  }

  private buildScene() {
    const skyGeo = new THREE.SphereGeometry(300, 32, 16);
    skyGeo.scale(-1, 1, 1);
    const skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uTopColor: { value: new THREE.Color(COLORS.SKY_TOP) },
        uHorizonColor: { value: new THREE.Color(COLORS.SKY_HORIZON) },
        uHorizonBlend: { value: 0.6 },
      },
      side: THREE.BackSide,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    const oceanGeo = new THREE.PlaneGeometry(
      GAME_CONFIG.OCEAN_SIZE * 3,
      GAME_CONFIG.OCEAN_SIZE * 4,
      GAME_CONFIG.OCEAN_SEGMENTS,
      GAME_CONFIG.OCEAN_SEGMENTS,
    );
    oceanGeo.rotateX(-Math.PI / 2);

    this.oceanMaterial = new THREE.ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveSpeed: { value: GAME_CONFIG.WAVE_SPEED },
        uWaveHeight: { value: GAME_CONFIG.WAVE_HEIGHT },
        uWaveFrequency: { value: GAME_CONFIG.WAVE_FREQUENCY },
        uColorShallow: { value: new THREE.Color(COLORS.OCEAN_SHALLOW) },
        uColorDeep: { value: new THREE.Color(COLORS.OCEAN_DEEP) },
        uColorCrest: { value: new THREE.Color(COLORS.OCEAN_CREST) },
        uSunDirection: { value: this.sunDirection },
      },
      transparent: true,
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMaterial);
    this.oceanMesh.position.y = -0.5;
    this.scene.add(this.oceanMesh);

    const sandGeo = new THREE.PlaneGeometry(GAME_CONFIG.OCEAN_SIZE * 3, GAME_CONFIG.OCEAN_SIZE * 4);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshLambertMaterial({ color: 0x0a4a6e });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.y = -2;
    this.scene.add(sand);
  }

  private makeCelMaterial(color: number): THREE.ShaderMaterial {
    const mat = new THREE.ShaderMaterial({
      vertexShader: celVertexShader,
      fragmentShader: celFragmentShader,
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uSunDirection: { value: this.sunDirection },
        uOutlineWidth: { value: 0.03 },
        uOutlineColor: { value: new THREE.Color(0x1a1a2e) },
      },
    });
    this.celMaterials.push(mat);
    return mat;
  }

  private buildBoat() {
    this.boatGroup = new THREE.Group();

    const hullGeo = new THREE.BoxGeometry(3, 1.2, 5.5);
    const hullMat = this.makeCelMaterial(COLORS.BOAT_HULL);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 0.3;
    hull.castShadow = true;
    this.boatGroup.add(hull);

    const bowGeo = new THREE.ConeGeometry(1.5, 2, 4);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.set(0, 0.2, -3.5);
    bow.castShadow = true;
    this.boatGroup.add(bow);

    const deckGeo = new THREE.BoxGeometry(2.4, 0.3, 4);
    const deckMat = this.makeCelMaterial(0xb5651d);
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = 1.05;
    this.boatGroup.add(deck);

    const mastGeo = new THREE.CylinderGeometry(0.12, 0.14, 7, 8);
    const mastMat = this.makeCelMaterial(0x5c3a1e);
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.set(0, 4.5, 0.5);
    mast.castShadow = true;
    this.boatGroup.add(mast);

    const sailShape = new THREE.Shape();
    sailShape.moveTo(0, 0);
    sailShape.lineTo(2.5, 0);
    sailShape.quadraticCurveTo(3.2, 2.5, 2.2, 5);
    sailShape.lineTo(0, 5);
    sailShape.lineTo(0, 0);
    const sailGeo = new THREE.ShapeGeometry(sailShape);
    const sailMat = this.makeCelMaterial(COLORS.BOAT_SAIL);
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(-1.3, 1.5, 0.4);
    sail.rotation.y = Math.PI / 2;
    this.boatGroup.add(sail);

    const backSail = sail.clone();
    backSail.rotation.y = -Math.PI / 2;
    backSail.position.set(1.3, 1.5, 0.4);
    this.boatGroup.add(backSail);

    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5);
    const flagMat = new THREE.MeshLambertMaterial({ color: 0xe53935, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(0.4, 8.2, 0.4);
    this.boatGroup.add(flag);

    this.boatGroup.position.set(0, 0.8, 0);
    this.boatGroup.castShadow = true;
    this.scene.add(this.boatGroup);
  }

  private buildObstaclePool() {
    const count = 24;
    for (let i = 0; i < count; i++) {
      let geo: THREE.BufferGeometry;
      let color: number;
      let type: string;
      const t = i % 3;
      if (t === 0) {
        geo = new THREE.CylinderGeometry(1.0, 0.9, 2, 10);
        color = COLORS.BARREL;
        type = 'barrel';
      } else if (t === 1) {
        geo = new THREE.BoxGeometry(4, 5, 9);
        color = COLORS.ENEMY_SHIP;
        type = 'ship';
      } else {
        geo = new THREE.BoxGeometry(18, 4, 1.5);
        color = COLORS.WALL;
        type = 'wall';
      }

      const mat = this.makeCelMaterial(color);
      const mesh = new THREE.Mesh(geo, mat) as unknown as PooledMesh;
      mesh.userData = { active: false, type };
      mesh.castShadow = true;
      mesh.visible = false;
      this.scene.add(mesh as unknown as THREE.Mesh);
      this.obstaclePool.push(mesh);
    }
  }

  private buildRupeePool() {
    const count = 30;
    const rupeeValues: Array<1 | 5 | 20> = [1, 5, 20];
    const rupeeColors = [COLORS.RUPEE_GREEN, COLORS.RUPEE_BLUE, COLORS.RUPEE_RED];

    for (let i = 0; i < count; i++) {
      const vi = i % 3;
      const geo = new THREE.OctahedronGeometry(0.9, 0);
      geo.scale(0.5, 1.0, 0.3);

      const mat = new THREE.ShaderMaterial({
        vertexShader: rupeeVertexShader,
        fragmentShader: rupeeFragmentShader,
        uniforms: {
          uColor: { value: new THREE.Color(rupeeColors[vi]) },
          uTime: { value: 0 },
        },
      });

      const mesh = new THREE.Mesh(geo, mat) as unknown as PooledMesh;
      mesh.userData = { active: false, value: rupeeValues[vi], rotY: 0 };
      mesh.visible = false;
      this.scene.add(mesh as unknown as THREE.Mesh);
      this.rupeePool.push(mesh);
    }
  }

  private buildClouds() {
    const cloudPositions = [
      [-30, 40, -80], [20, 50, -60], [-15, 45, -110],
      [40, 38, -90], [-50, 52, -70], [10, 48, -130],
      [35, 42, -50], [-25, 55, -100], [0, 44, -140],
    ];

    cloudPositions.forEach(([x, y, z]) => {
      const group = new THREE.Group();
      const numPuffs = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numPuffs; i++) {
        const r = 3 + Math.random() * 4;
        const geo = new THREE.SphereGeometry(r, 8, 6);
        const mat = new THREE.MeshLambertMaterial({
          color: COLORS.CLOUD,
          transparent: true,
          opacity: 0.92,
        });
        const puff = new THREE.Mesh(geo, mat);
        puff.position.set(
          (Math.random() - 0.5) * 12,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 8,
        );
        group.add(puff);
      }
      group.position.set(x, y, z);
      this.cloudMeshes.push(group as unknown as THREE.Mesh);
      this.scene.add(group);
    });
  }

  private buildIslands() {
    const islandConfigs = [
      { x: -60, z: -50, scale: 1.0 },
      { x: 70, z: -80, scale: 0.7 },
      { x: -80, z: -130, scale: 1.2 },
      { x: 55, z: -160, scale: 0.5 },
    ];

    islandConfigs.forEach(({ x, z, scale }) => {
      const group = new THREE.Group();

      const baseGeo = new THREE.CylinderGeometry(scale * 8, scale * 10, scale * 3, 12);
      const baseMat = new THREE.MeshLambertMaterial({ color: 0xc2a868 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.castShadow = true;
      group.add(base);

      const groundGeo = new THREE.CylinderGeometry(scale * 7.5, scale * 8, scale * 1.5, 12);
      const groundMat = new THREE.MeshLambertMaterial({ color: COLORS.ISLAND });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.position.y = scale * 2;
      group.add(ground);

      const numTrees = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < numTrees; i++) {
        const treeGroup = new THREE.Group();
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, scale * 2.5, 6);
        const trunkMat = this.makeCelMaterial(0x4a2c17);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        treeGroup.add(trunk);

        const leafGeo = new THREE.ConeGeometry(scale * 1.5, scale * 3, 7);
        const leafMat = this.makeCelMaterial(0x2d7a2d);
        const leaves = new THREE.Mesh(leafGeo, leafMat);
        leaves.position.y = scale * 2.5;
        treeGroup.add(leaves);

        const angle = (i / numTrees) * Math.PI * 2;
        const r = scale * 3 + Math.random() * scale * 2;
        treeGroup.position.set(
          Math.cos(angle) * r,
          scale * 2.5,
          Math.sin(angle) * r,
        );
        group.add(treeGroup);
      }

      group.position.set(x, 0, z);
      this.scene.add(group);
    });
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfffde7, 1.2);
    sun.position.copy(this.sunDirection).multiplyScalar(100);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    this.scene.add(sun);

    const fill = new THREE.DirectionalLight(0xb8d8f0, 0.3);
    fill.position.set(-1, 0.5, -1);
    this.scene.add(fill);
  }

  private setupInput() {
    const onKeyDown = (e: KeyboardEvent) => { this.keys[e.code] = true; };
    const onKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    (this as unknown as { _removeKeydown: () => void })._removeKeydown = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }

  private setupResize(canvas: HTMLCanvasElement) {
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    (this as unknown as { _removeResize: () => void })._removeResize = () => {
      window.removeEventListener('resize', onResize);
    };
  }

  setTouchInput(x: number, y: number, active: boolean) {
    this.touchInput = { x, y, active };
  }

  startExplore() {
    this.mode = MODE.EXPLORE;
    this.callbacks.onModeChange(this.mode);
    if (!this.isRunning) this.startLoop();
  }

  startGame() {
    this.mode = MODE.GAME_STARTED;
    this.stats = {
      score: 0, rupees: 0, lives: GAME_CONFIG.INITIAL_LIVES,
      timePlayed: 0, startTime: Date.now(),
    };
    this.obstacleTimer = 0;
    this.rupeeTimer = 0;
    this.hitCooldown = 0;

    this.activeObstacles = [];
    this.activeRupees = [];
    this.obstaclePool.forEach(m => { m.visible = false; m.userData.active = false; });
    this.rupeePool.forEach(m => { m.visible = false; m.userData.active = false; });

    this.callbacks.onModeChange(this.mode);
    this.callbacks.onScoreUpdate({ score: 0, rupees: 0, lives: GAME_CONFIG.INITIAL_LIVES });
    if (!this.isRunning) this.startLoop();
  }

  private startLoop() {
    this.isRunning = true;
    this.clock.start();
    const tick = () => {
      if (!this.isRunning) return;
      this.animFrameId = requestAnimationFrame(tick);
      this.update();
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  private update() {
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.getElapsedTime();
    this.frameCount++;

    this.oceanMaterial.uniforms.uTime.value = elapsed;
    this.skyMesh.position.copy(this.camera.position);

    this.updateBoat(delta);
    this.updateCamera(delta);

    if (this.mode === MODE.GAME_STARTED) {
      this.updateGameLogic(delta, elapsed);
    }

    this.updateRupeeAnimations(elapsed);
    this.updateClouds(delta);
    this.updateOceanPosition();
  }

  private updateBoat(delta: number) {
    const left = this.keys['ArrowLeft'] || this.keys['KeyA'];
    const right = this.keys['ArrowRight'] || this.keys['KeyD'];
    const up = this.keys['ArrowUp'] || this.keys['KeyW'];
    const down = this.keys['ArrowDown'] || this.keys['KeyS'];

    let inputX = 0;
    let inputZ = 0;

    if (left) inputX -= 1;
    if (right) inputX += 1;
    if (up) inputZ -= 0.4;
    if (down) inputZ += 0.2;

    if (this.touchInput.active) {
      inputX += this.touchInput.x;
      inputZ += this.touchInput.y * -0.4;
    }

    const speed = GAME_CONFIG.BOAT_SPEED;
    const targetVX = inputX * speed;
    const lerpSpeed = 6;
    this.boatState.velocityX += (targetVX - this.boatState.velocityX) * lerpSpeed * delta;

    if (this.mode === MODE.GAME_STARTED) {
      this.boatState.velocityZ = -GAME_CONFIG.SCROLL_SPEED + inputZ * 2;
    } else {
      this.boatState.velocityZ = inputZ * speed;
    }

    this.boatState.x += this.boatState.velocityX * delta;
    this.boatState.z += this.boatState.velocityZ * delta;

    const halfWidth = (GAME_CONFIG.LANE_COUNT * GAME_CONFIG.LANE_WIDTH) / 2 + 2;
    this.boatState.x = Math.max(-halfWidth, Math.min(halfWidth, this.boatState.x));

    if (this.mode !== MODE.GAME_STARTED) {
      const zLimit = 50;
      this.boatState.z = Math.max(-zLimit, Math.min(20, this.boatState.z));
    }

    const targetTilt = -this.boatState.velocityX * 0.012;
    this.boatState.tilt += (targetTilt - this.boatState.tilt) * 5 * delta;
    this.boatState.tilt = Math.max(-GAME_CONFIG.BOAT_TILT_MAX, Math.min(GAME_CONFIG.BOAT_TILT_MAX, this.boatState.tilt));

    const targetRot = inputX * 0.15;
    this.boatState.rotation += (targetRot - this.boatState.rotation) * 4 * delta;

    this.boatGroup.position.set(this.boatState.x, 0.8, this.boatState.z);
    this.boatGroup.rotation.z = this.boatState.tilt;
    this.boatGroup.rotation.y = -this.boatState.rotation;

    const elapsed = this.clock.getElapsedTime();
    this.boatGroup.position.y = 0.8 + Math.sin(elapsed * 1.2) * 0.15;
    this.boatGroup.rotation.x = Math.sin(elapsed * 0.8) * 0.03;
  }

  private updateCamera(delta: number) {
    this.cameraTarget.set(
      this.boatState.x * 0.3,
      GAME_CONFIG.CAMERA_HEIGHT,
      this.boatState.z + GAME_CONFIG.CAMERA_DISTANCE,
    );

    this.cameraPos.lerp(this.cameraTarget, GAME_CONFIG.CAMERA_LERP + delta * 2);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.boatState.x * 0.5, 0, this.boatState.z - 10);
  }

  private updateOceanPosition() {
    this.oceanMesh.position.x = this.boatState.x;
    this.oceanMesh.position.z = this.boatState.z;
  }

  private updateGameLogic(delta: number, _elapsed: number) {
    this.stats.timePlayed = Math.floor((Date.now() - this.stats.startTime) / 1000);
    this.stats.score += GAME_CONFIG.SCORE_PER_SECOND * delta;

    this.obstacleTimer += delta;
    this.rupeeTimer += delta;

    const difficulty = Math.min(1 + this.stats.timePlayed / 60, 3);
    const obstacleInterval = GAME_CONFIG.OBSTACLE_SPAWN_INTERVAL / difficulty;
    const rupeeInterval = GAME_CONFIG.RUPEE_SPAWN_INTERVAL;

    if (this.obstacleTimer >= obstacleInterval) {
      this.obstacleTimer = 0;
      this.spawnObstacle();
    }

    if (this.rupeeTimer >= rupeeInterval) {
      this.rupeeTimer = 0;
      this.spawnRupee();
    }

    this.updateObstacles(delta);
    this.updateRupees(delta);
    this.checkCollisions();

    if (this.hitCooldown > 0) this.hitCooldown -= delta;
  }

  private spawnObstacle() {
    const mesh = this.obstaclePool.find(m => !m.userData.active);
    if (!mesh) return;

    const lane = Math.floor(Math.random() * GAME_CONFIG.LANE_COUNT);
    const isWall = Math.random() < 0.15;
    const type = isWall ? 'wall' : (Math.random() < 0.5 ? 'barrel' : 'ship');

    mesh.userData.active = true;
    mesh.userData.lane = lane;
    mesh.userData.type = type;
    mesh.visible = true;

    const x = isWall ? 0 : this.lanePositions[lane];
    mesh.position.set(x, type === 'ship' ? 1.5 : (type === 'barrel' ? 1.0 : 1.5), this.boatState.z + GAME_CONFIG.SPAWN_Z);

    const data: ObstacleData = { type: type as ObstacleData['type'], lane, z: mesh.position.z, active: true };
    this.activeObstacles.push(data);
  }

  private spawnRupee() {
    const mesh = this.rupeePool.find(m => !m.userData.active);
    if (!mesh) return;

    const lane = Math.floor(Math.random() * GAME_CONFIG.LANE_COUNT);
    const rand = Math.random();
    const value: 1 | 5 | 20 = rand < 0.6 ? 1 : rand < 0.9 ? 5 : 20;

    mesh.userData.active = true;
    mesh.userData.lane = lane;
    mesh.userData.value = value;
    mesh.userData.rotY = 0;
    mesh.visible = true;

    mesh.position.set(this.lanePositions[lane], 2.5, this.boatState.z + GAME_CONFIG.SPAWN_Z);

    const data: RupeeData = { value, lane, z: mesh.position.z, active: true, rotationY: 0 };
    this.activeRupees.push(data);
  }

  private updateObstacles(delta: number) {
    const moveZ = GAME_CONFIG.SCROLL_SPEED * delta;
    const despawnZ = this.boatState.z + GAME_CONFIG.DESPAWN_Z;

    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];
      const mesh = this.obstaclePool.find(m => m.userData.active && m.userData.lane === obs.lane && Math.abs(m.position.z - obs.z) < 1);
      if (!mesh) continue;

      mesh.position.z += moveZ;
      obs.z = mesh.position.z;

      if (mesh.position.z > despawnZ) {
        mesh.visible = false;
        mesh.userData.active = false;
        this.activeObstacles.splice(i, 1);
      }
    }
  }

  private updateRupees(delta: number) {
    const moveZ = GAME_CONFIG.SCROLL_SPEED * delta;
    const despawnZ = this.boatState.z + GAME_CONFIG.DESPAWN_Z;

    for (let i = this.activeRupees.length - 1; i >= 0; i--) {
      const rup = this.activeRupees[i];
      const mesh = this.rupeePool.find(m => m.userData.active && m.userData.lane === rup.lane && Math.abs(m.position.z - rup.z) < 1);
      if (!mesh) continue;

      mesh.position.z += moveZ;
      rup.z = mesh.position.z;

      if (mesh.position.z > despawnZ) {
        mesh.visible = false;
        mesh.userData.active = false;
        this.activeRupees.splice(i, 1);
      }
    }
  }

  private updateRupeeAnimations(elapsed: number) {
    this.rupeePool.forEach(mesh => {
      if (!mesh.userData.active) return;
      (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsed;
      mesh.rotation.y += 0.04;
    });
  }

  private checkCollisions() {
    if (this.hitCooldown > 0) return;

    const bx = this.boatState.x;
    const bz = this.boatState.z;

    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const obs = this.activeObstacles[i];
      const mesh = this.obstaclePool.find(m => m.userData.active && m.userData.lane === obs.lane && Math.abs(m.position.z - obs.z) < 1);
      if (!mesh || !mesh.visible) continue;

      const dx = bx - mesh.position.x;
      const dz = bz - mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const collisionR = obs.type === 'wall' ? GAME_CONFIG.COLLISION_RADIUS * 4 : GAME_CONFIG.COLLISION_RADIUS;
      if (dist < collisionR) {
        this.onHit(mesh);
        return;
      }
    }

    for (let i = this.activeRupees.length - 1; i >= 0; i--) {
      const rup = this.activeRupees[i];
      const mesh = this.rupeePool.find(m => m.userData.active && m.userData.lane === rup.lane && Math.abs(m.position.z - rup.z) < 1);
      if (!mesh || !mesh.visible) continue;

      const dx = bx - mesh.position.x;
      const dz = bz - mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < GAME_CONFIG.RUPEE_COLLECT_RADIUS) {
        const val = rup.value;
        mesh.visible = false;
        mesh.userData.active = false;
        this.activeRupees.splice(i, 1);

        this.stats.rupees += val;
        this.stats.score += val * GAME_CONFIG.SCORE_PER_RUPEE;
        this.callbacks.onRupeeCollect(val);
        this.callbacks.onScoreUpdate({ score: Math.floor(this.stats.score), rupees: this.stats.rupees, lives: this.stats.lives });

        gsap.to(this.boatGroup.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 0.1, yoyo: true, repeat: 1 });
      }
    }
  }

  private onHit(mesh: THREE.Mesh) {
    this.stats.lives--;
    this.hitCooldown = 1.5;
    this.callbacks.onHit();
    this.callbacks.onScoreUpdate({ score: Math.floor(this.stats.score), rupees: this.stats.rupees, lives: this.stats.lives });

    gsap.to(this.boatGroup.position, { x: this.boatState.x + (Math.random() - 0.5) * 4, duration: 0.15, yoyo: true, repeat: 3 });
    gsap.to(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.4, onComplete: () => {
      mesh.scale.set(1, 1, 1);
    }});

    if (this.stats.lives <= 0) {
      this.mode = MODE.GAME;
      setTimeout(() => {
        this.callbacks.onGameOver({
          finalScore: Math.floor(this.stats.score),
          rupeesCollected: this.stats.rupees,
          timePlayed: this.stats.timePlayed,
        });
      }, 600);
    }
  }

  private updateClouds(delta: number) {
    this.cloudMeshes.forEach((cloud, i) => {
      cloud.position.x += Math.sin(i * 1.3) * 0.5 * delta;
      cloud.position.z += 2 * delta;
      if (cloud.position.z > this.boatState.z + 50) {
        cloud.position.z = this.boatState.z - 150;
      }
    });
  }

  setMuted(muted: boolean) {
    (this as unknown as { _muted: boolean })._muted = muted;
  }

  isMuted(): boolean {
    return (this as unknown as { _muted: boolean })._muted ?? false;
  }

  destroy() {
    this.isRunning = false;
    cancelAnimationFrame(this.animFrameId);
    this.clock.stop();

    const self = this as unknown as { _removeKeydown?: () => void; _removeResize?: () => void };
    self._removeKeydown?.();
    self._removeResize?.();

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
  }
}
