import React, { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { SystemStatus, SessionMode } from "../types";

interface SceneProps {
  status: SystemStatus;
  mode: SessionMode;
  audioVolume: number;
  onTouch: () => void;
}

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uIntensity;
  uniform vec2 uMouse;
  varying vec2 vUv;

  float noise(in vec2 p) {
    return sin(p.x * 0.5) * sin(p.y * 0.5) + cos(p.x * 0.25) * cos(p.y * 0.25);
  }

  // Fractional Brownian Motion for fluid-like structural dynamics
  float fbm(in vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotating mapping space to avoid axis bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.12;
    
    // GPU fluid-mechanic flow simulation displacement layers
    vec2 q = vec2(
      fbm(uv * 3.2 + vec2(t, t * 0.6)),
      fbm(uv * 3.0 + vec2(t * 0.3, t * 0.8))
    );
    
    vec2 r = vec2(
      fbm(uv * 4.5 + 4.0 * q + vec2(t * 0.7, t * 0.4)),
      fbm(uv * 4.5 + 4.0 * q + vec2(t * 0.5, t * 1.1))
    );
    
    float f = fbm(uv * 2.5 + r + vec2(t * 0.4));
    
    // High dynamic range glow mapping
    vec3 col = mix(uColorA, uColorB, clamp(f * f * 3.5, 0.0, 1.0) * uIntensity);
    
    // Wave crest highlighting inside flow field
    col += vec3(0.06) * (q.x + r.y) * uIntensity;
    
    // Soft dynamic pointer interactions
    float mouseDistance = distance(vUv, uMouse);
    float mousePulse = exp(-mouseDistance * mouseDistance * 20.0) * 0.35;
    col += uColorB * mousePulse * uIntensity;
    
    // Vignetting of scene boundary
    float dist = distance(vUv, vec2(0.5));
    col *= 1.35 - dist * 1.25;
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Helper to generate a procedural high-quality circular radial gradient texture
const createCircleTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.75)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  return new THREE.CanvasTexture(canvas);
};

const Scene: React.FC<SceneProps> = ({
  status,
  mode,
  audioVolume,
  onTouch,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const backgroundMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const roboEchoGroupRef = useRef<THREE.Group | null>(null);
  const roboVigilGroupRef = useRef<THREE.Group | null>(null);
  const radioWavesGroupRef = useRef<THREE.Group | null>(null);
  const lasersGroupRef = useRef<THREE.Group | null>(null);
  const airParticlesRef = useRef<THREE.Points | null>(null);
  const animationFrameRef = useRef<number>(0);

  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(0, 0), []);
  const audioVolumeRef = useRef(audioVolume);
  audioVolumeRef.current = audioVolume;
  const onTouchRef = useRef(onTouch);
  onTouchRef.current = onTouch;

  const themes = useMemo(
    () => ({
      [SessionMode.PUBLIC]: {
        a: new THREE.Color("#030008"),
        b: new THREE.Color("#3923c6"),
        air: new THREE.Color("#8e73ff"),
        wave: new THREE.Color("#5a47e7"),
        laser: new THREE.Color("#2df8ff"),
      },
      [SessionMode.PRIVATE]: {
        a: new THREE.Color("#080000"),
        b: new THREE.Color("#c20606"),
        air: new THREE.Color("#ff5e5e"),
        wave: new THREE.Color("#ff1a1a"),
        laser: new THREE.Color("#ff0d5e"),
      },
    }),
    [],
  );

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      65,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    // Initializing background shader mesh with pointer capability
    const bgMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: themes[mode].a.clone() },
        uColorB: { value: themes[mode].b.clone() },
        uIntensity: { value: 0.65 },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      },
      depthWrite: false,
    });

    const bg = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), bgMat);
    bg.position.z = -25;
    scene.add(bg);
    backgroundMaterialRef.current = bgMat;

    // Laser Beams Group
    const lasers = new THREE.Group();
    const laserCount = 14;
    for (let i = 0; i < laserCount; i++) {
      const laserGeo = new THREE.CylinderGeometry(0.012, 0.012, 100, 6);
      const laserMat = new THREE.MeshBasicMaterial({
        color: themes[mode].laser,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      });
      const laser = new THREE.Mesh(laserGeo, laserMat);

      laser.rotation.x = Math.random() * Math.PI;
      laser.rotation.z = Math.random() * Math.PI;
      laser.userData = {
        speed: 0.15 + Math.random() * 0.45,
        axis: new THREE.Vector3(
          Math.random(),
          Math.random(),
          Math.random(),
        ).normalize(),
      };
      lasers.add(laser);
    }
    scene.add(lasers);
    lasersGroupRef.current = lasers;

    // Radio Waves Group
    const radioWaves = new THREE.Group();
    const waveCount = 5;
    for (let i = 0; i < waveCount; i++) {
      const ringGeo = new THREE.RingGeometry(1, 1.04, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: themes[mode].wave,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.userData = { offset: i / waveCount };
      radioWaves.add(ring);
    }
    scene.add(radioWaves);
    radioWavesGroupRef.current = radioWaves;

    // Robots Setup
    const echoGroup = new THREE.Group();
    echoGroup.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 64, 64),
        new THREE.MeshPhysicalMaterial({
          color: 0x5a47e7,
          emissive: 0x2211aa,
          roughness: 0.15,
          metalness: 0.95,
          clearcoat: 1.0,
          clearcoatRoughness: 0.1,
        }),
      ),
    );
    scene.add(echoGroup);
    roboEchoGroupRef.current = echoGroup;

    const vigilGroup = new THREE.Group();
    vigilGroup.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(3.0, 0),
        new THREE.MeshStandardMaterial({
          color: 0x110202,
          emissive: 0xff1515,
          roughness: 0.2,
          metalness: 0.85,
          flatShading: true,
        }),
      ),
    );
    vigilGroup.visible = false;
    scene.add(vigilGroup);
    roboVigilGroupRef.current = vigilGroup;

    // 4,500 High-performance particle flow points (soft neural fluid dust)
    const airParticleCount = 4500;
    const airGeo = new THREE.BufferGeometry();
    const airPos = new Float32Array(airParticleCount * 3);
    const airSpeeds = new Float32Array(airParticleCount);

    for (let i = 0; i < airParticleCount; i++) {
      // Box coordinates distribution
      airPos[i * 3] = (Math.random() - 0.5) * 45;
      airPos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      airPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
      airSpeeds[i] = 0.4 + Math.random() * 1.6;
    }

    airGeo.setAttribute("position", new THREE.BufferAttribute(airPos, 3));

    const circleTexture = createCircleTexture();
    const airPoints = new THREE.Points(
      airGeo,
      new THREE.PointsMaterial({
        size: 0.1,
        transparent: true,
        opacity: 0.48,
        map: circleTexture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    scene.add(airPoints);
    airParticlesRef.current = airPoints;

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      const time = Date.now() * 0.001;
      const vol = audioVolumeRef.current / 100;

      // Update background shader flow time & modes
      bgMat.uniforms.uTime.value += 0.006 + vol * 0.045;
      bgMat.uniforms.uColorA.value.lerp(themes[mode].a, 0.04);
      bgMat.uniforms.uColorB.value.lerp(themes[mode].b, 0.04);

      // Update Laser Rotations
      lasers.children.forEach((child, idx) => {
        const laser = child as THREE.Mesh;
        const mat = laser.material as THREE.MeshBasicMaterial;
        mat.color.lerp(themes[mode].laser, 0.08);

        const modeMultiplier = mode === SessionMode.PRIVATE ? 3.5 : 1.0;
        const jitter =
          mode === SessionMode.PRIVATE ? Math.sin(time * 24 + idx) * 0.08 : 0;

        laser.rotateOnAxis(
          laser.userData.axis,
          0.0018 * modeMultiplier + vol * 0.05 + jitter,
        );
        const flicker = Math.random() > 0.92 ? 1.0 : 0.45;
        mat.opacity = (0.32 + vol * 0.68) * flicker;
      });

      // Update Expanding Dynamic Radio Circles
      radioWaves.children.forEach((child) => {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.lerp(themes[mode].wave, 0.08);

        let progress = (time * (0.28 + vol * 0.8) + mesh.userData.offset) % 1.0;
        const scale = 1 + progress * 24;
        mesh.scale.set(scale, scale, scale);
        mat.opacity = (1.0 - progress) * (0.22 + vol * 0.78);
      });

      // Interactive Soft Flow Field Vector calculations for particle dust
      if (airParticlesRef.current) {
        const mat = airParticlesRef.current.material as THREE.PointsMaterial;
        mat.color.lerp(themes[mode].air, 0.08);

        // Dynamic pulsating sizes with sound input
        const basePointSize = mode === SessionMode.PRIVATE ? 0.12 : 0.08;
        mat.size = basePointSize + vol * 0.35;

        const positions = airParticlesRef.current.geometry.attributes.position
          .array as Float32Array;
        const flowFactor = mode === SessionMode.PRIVATE ? 1.75 : 0.8;

        // Real-time world space approximation of cursor position
        const worldCursorX = mouse.x * 22;
        const worldCursorY = mouse.y * 14;

        for (let i = 0; i < airParticleCount; i++) {
          const idx = i * 3;
          let px = positions[idx];
          let py = positions[idx + 1];
          let pz = positions[idx + 2];

          const speedScalar = airSpeeds[i] * flowFactor;

          // Double vortex turbulent fluid mapping equations
          const waveAngle1 = Math.sin(px * 0.11 + time * 0.35) * 2.6;
          const waveAngle2 = Math.cos(py * 0.14 - time * 0.28) * 2.6;
          const totalAngle = waveAngle1 + waveAngle2;

          let vx = Math.cos(totalAngle) * 0.016 * speedScalar;
          let vy = Math.sin(totalAngle) * 0.016 * speedScalar;
          let vz = Math.sin(px * 0.08 + py * 0.08) * 0.004 * speedScalar;

          // Swirling bypass wakes around the mouse pointer
          const dx = px - worldCursorX;
          const dy = py - worldCursorY;
          const distSq = dx * dx + dy * dy;
          if (distSq < 64) {
            // 8 space units interaction boundary
            const distanceValue = Math.sqrt(distSq);
            // Dynamic attraction/repulse vector forces
            const repulsionGrip = (1.0 - distanceValue / 8.0) * 0.22;
            vx +=
              (dx / distanceValue) * repulsionGrip -
              (dy / distanceValue) * repulsionGrip * 0.45;
            vy +=
              (dy / distanceValue) * repulsionGrip +
              (dx / distanceValue) * repulsionGrip * 0.45;
          }

          // Sound vibration resonance vectors
          if (vol > 0.04) {
            vx += Math.sin(pz * 0.4 + time * 8) * vol * 0.3;
            vy += Math.cos(pz * 0.4 + time * 8) * vol * 0.3;
          }

          px += vx;
          py += vy;
          pz += vz;

          // Domain containment wraps
          if (px > 24) px = -24;
          if (px < -24) px = 24;
          if (py > 16) py = -16;
          if (py < -16) py = 16;
          if (pz > 10) pz = -10;
          if (pz < -10) pz = 10;

          positions[idx] = px;
          positions[idx + 1] = py;
          positions[idx + 2] = pz;
        }
        airParticlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Animating central robot groups
      const targetEchoVisibility = mode === SessionMode.PUBLIC;
      const targetVigilVisibility = mode === SessionMode.PRIVATE;

      // Smooth fade transition for robot groups
      roboEchoGroupRef.current!.visible = targetEchoVisibility;
      roboVigilGroupRef.current!.visible = targetVigilVisibility;

      const activeBot =
        mode === SessionMode.PUBLIC
          ? roboEchoGroupRef.current
          : roboVigilGroupRef.current;
      if (activeBot) {
        activeBot.rotation.y += 0.008 + vol * 0.15;
        activeBot.position.y = Math.sin(time * 0.85) * 0.45;
        radioWaves.position.copy(activeBot.position);
        lasers.position.copy(activeBot.position);
      }

      renderer.render(scene, camera);
    };
    animate();

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

      // Update dynamic pointer position coordinate relative to background UV structure
      if (backgroundMaterialRef.current) {
        backgroundMaterialRef.current.uniforms.uMouse.value.set(
          e.clientX / window.innerWidth,
          1.0 - e.clientY / window.innerHeight,
        );
      }
    };
    window.addEventListener("mousemove", onMouseMove);

    const onDown = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(
        [roboEchoGroupRef.current!, roboVigilGroupRef.current!],
        true,
      );
      if (hits.length > 0) onTouchRef.current();
    };
    window.addEventListener("mousedown", onDown);

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onResize);
      circleTexture.dispose();
      if (
        mountRef.current &&
        renderer.domElement.parentNode === mountRef.current
      ) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [mode]);

  return <div ref={mountRef} className="fixed inset-0" />;
};

export default Scene;
