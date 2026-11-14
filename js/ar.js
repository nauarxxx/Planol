// Realitat augmentada (WebXR, Chrome d'Android): posa el moble a mida real a terra, amb la càmera del mòbil.
// Fa servir un renderitzador a part perquè l'escena del plànol no es toqui.
import * as THREE from 'three';
import { buildFurniture } from './furniture.js?v=39';

let supported = null;
export function arSupported() {
  if (!supported) supported = Promise.resolve(window.isSecureContext && navigator.xr?.isSessionSupported ? navigator.xr.isSessionSupported('immersive-ar') : false).catch(() => false);
  return supported;
}

// item: el moble (cm). opts: { photo, toast(msg) }
export async function startAR(item, opts = {}) {
  const ov = document.createElement('div');
  ov.id = 'ar-overlay';
  ov.innerHTML = `<div class="ar-top"><b>${String(item.name).replace(/[<>&]/g, '')}</b> · ${item.w}×${item.d}×${item.h} cm</div>
    <div class="ar-hint">Apunta a terra i mou el mòbil a poc a poc. Quan surti el cercle, toca la pantalla per posar-hi el moble.</div>
    <div class="ar-btns"><button type="button" data-ar="l">⟲ Gira</button><button type="button" data-ar="r">⟳ Gira</button><button type="button" data-ar="x">✕ Surt</button></div>`;
  document.body.appendChild(ov);
  // els botons no han de comptar com a «tocar per col·locar»
  ov.querySelector('.ar-btns').addEventListener('beforexrselect', (e) => e.preventDefault());

  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', { requiredFeatures: ['hit-test'], optionalFeatures: ['dom-overlay'], domOverlay: { root: ov } });
  } catch (e) {
    ov.remove();
    opts.toast?.('No s’ha pogut obrir la càmera en mode RA: ' + (e.message || e));
    return;
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  renderer.domElement.className = 'ar-canvas';
  document.body.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 40);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(1, 3, 2); scene.add(sun);

  const model = new THREE.Group();
  const f = buildFurniture(item, { photo: opts.photo });
  f.position.y = (item.elev || 0);
  model.add(f);
  // ombra suau a terra perquè sembli que hi és de debò
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(item.w * 1.1, item.d * 1.1), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.2; model.add(sh);
  model.scale.setScalar(0.01); // cm → m
  model.visible = false;
  scene.add(model);
  let extra = 0; // gir afegit amb els botons (el davant del moble mira cap a tu)

  const reticle = new THREE.Mesh(new THREE.RingGeometry(0.09, 0.12, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  reticle.matrixAutoUpdate = false; reticle.visible = false;
  scene.add(reticle);

  const viewer = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewer });
  const hint = ov.querySelector('.ar-hint');
  session.addEventListener('select', () => {
    if (!reticle.visible) return;
    const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    reticle.matrix.decompose(p, q, s);
    model.position.copy(p);
    // de cara a qui mira, amb el gir triat
    const cam = renderer.xr.getCamera();
    const cp = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    const face = Math.atan2(cp.x - p.x, cp.z - p.z);
    model.rotation.y = face + extra;
    model.visible = true;
    hint.textContent = 'Toca en un altre lloc per moure’l. Amb els botons el gires.';
  });
  ov.querySelector('[data-ar=l]').addEventListener('click', () => { extra += Math.PI / 12; model.rotation.y += Math.PI / 12; });
  ov.querySelector('[data-ar=r]').addEventListener('click', () => { extra -= Math.PI / 12; model.rotation.y -= Math.PI / 12; });
  ov.querySelector('[data-ar=x]').addEventListener('click', () => session.end());
  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    hitSource.cancel?.();
    renderer.dispose();
    renderer.domElement.remove();
    ov.remove();
  });
  await renderer.xr.setSession(session);
  renderer.setAnimationLoop((t, frame) => {
    if (frame) {
      const hits = frame.getHitTestResults(hitSource);
      const ref = renderer.xr.getReferenceSpace();
      if (hits.length && ref) {
        const pose = hits[0].getPose(ref);
        reticle.visible = !!pose;
        if (pose) reticle.matrix.fromArray(pose.transform.matrix);
      } else reticle.visible = false;
    }
    renderer.render(scene, camera);
  });
}
