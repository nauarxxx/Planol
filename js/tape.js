// Cinta mètrica: toca dos punts qualssevol (terra, parets o mobles) i en surt la distància.
// S'enganxa a les cantonades dels mobles i de les habitacions quan hi passes a prop, i si la línia gairebé
// segueix una paret (X o Z) s'hi alinea sola. Les mesures es queden fins que apagues la cinta.
import * as THREE from 'three';

const SNAP_PX = 16; // distància a la pantalla per enganxar-se a una cantonada
const AXIS_DEG = 4; // si la línia va gairebé recta, s'alinea

export function initTape(ctx) {
  // ctx: { group, camera(), dom, targets(), snapPoints(), fmt(cm), render(), mobile() }
  const root = new THREE.Group();
  root.renderOrder = 6;
  ctx.group.add(root);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff8f00, depthTest: false, transparent: true });
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xff8f00, depthTest: false, transparent: true });
  const dotGeo = new THREE.SphereGeometry(1, 12, 8);
  const tapes = []; // { a, b, objs: [] }
  let first = null, preview = null, cursor = null;
  const sprites = new Set();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const api = { active: false };

  function labelSprite(text, sub) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const f1 = 44, f2 = 26, pad = 22;
    g.font = `700 ${f1}px system-ui, sans-serif`; let w = g.measureText(text).width;
    if (sub) { g.font = `600 ${f2}px system-ui, sans-serif`; w = Math.max(w, g.measureText(sub).width); }
    c.width = Math.ceil(w + pad * 2); c.height = sub ? 96 : 64;
    g.fillStyle = '#ff8f00'; g.beginPath(); g.roundRect(0, 0, c.width, c.height, 18); g.fill();
    g.fillStyle = '#1b1300'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 ${f1}px system-ui, sans-serif`; g.fillText(text, c.width / 2, sub ? 34 : c.height / 2 + 2);
    if (sub) { g.font = `600 ${f2}px system-ui, sans-serif`; g.fillText(sub, c.width / 2, 74); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, sizeAttenuation: false }));
    sp.renderOrder = 7; sp.userData.aspect = c.width / c.height; sp.userData.px = sub ? 46 : 32;
    sprites.add(sp);
    return sp;
  }
  function dot(p) { const m = new THREE.Mesh(dotGeo, dotMat); m.position.copy(p); m.renderOrder = 7; m.userData.dot = true; return m; }
  function disposeObj(o) { if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); sprites.delete(o); } else if (!o.userData.dot) o.geometry.dispose(); root.remove(o); }

  // Mida constant a la pantalla (com el rètol de les parets): els rètols i els punts.
  api.fit = () => {
    if (!root.children.length) return;
    const cam = ctx.camera(), H = ctx.dom.clientHeight || 600;
    const unit = (px) => (cam.isPerspectiveCamera ? 2 * (px / H) * Math.tan(cam.fov * Math.PI / 360) : (px / H) * (cam.top - cam.bottom) / cam.zoom);
    for (const sp of sprites) { const sy = unit(sp.userData.px); sp.scale.set(sy * sp.userData.aspect, sy, 1); }
    root.traverse((o) => {
      if (!o.userData.dot) return;
      const r = cam.isPerspectiveCamera ? unit(5) * o.position.distanceTo(cam.position) : unit(5);
      o.scale.setScalar(Math.max(0.6, r));
    });
  };

  function pick(raycaster) {
    const hits = raycaster.intersectObjects(ctx.targets(), true).filter((h) => h.object.visible && !h.object.isSprite && !h.object.isLine);
    let p = hits.length ? hits[0].point.clone() : raycaster.ray.intersectPlane(floor, new THREE.Vector3());
    if (!p) return null;
    // enganxa't a una cantonada propera (a la pantalla)
    const cam = ctx.camera(), W = ctx.dom.clientWidth || 800, H = ctx.dom.clientHeight || 600;
    const sp = p.clone().project(cam);
    let best = null, bd = SNAP_PX;
    const v = new THREE.Vector3();
    for (const q of ctx.snapPoints()) {
      v.set(q[0], q[1], q[2]).project(cam);
      if (v.z > 1) continue;
      const d = Math.hypot((v.x - sp.x) * W / 2, (v.y - sp.y) * H / 2);
      if (d < bd) { bd = d; best = q; }
    }
    let snapped = false;
    if (best) { p = new THREE.Vector3(best[0], best[1], best[2]); snapped = true; }
    if (!cam.isPerspectiveCamera) p.y = 0; // a la planta (2D) es mesura sempre en planta
    // alinea amb els eixos si gairebé ho està (i no s'ha enganxat a una cantonada)
    if (first && !snapped) {
      const dx = p.x - first.x, dz = p.z - first.z, dy = p.y - first.y;
      if (Math.abs(dy) < 3) p.y = first.y;
      const ang = Math.abs(Math.atan2(dz, dx)) * 180 / Math.PI;
      if (Math.hypot(dx, dz) > 5) {
        if (ang < AXIS_DEG || ang > 180 - AXIS_DEG) p.z = first.z;
        else if (Math.abs(ang - 90) < AXIS_DEG) p.x = first.x;
      }
    }
    return { p, snapped };
  }

  function texts(a, b) {
    const d = a.distanceTo(b), dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z), dy = Math.abs(b.y - a.y);
    const parts = [];
    if (dx > 0.5 && (dz > 0.5 || dy > 0.5)) parts.push('↔ ' + ctx.fmt(dx));
    if (dz > 0.5 && (dx > 0.5 || dy > 0.5)) parts.push('↕ ' + ctx.fmt(dz));
    if (dy > 0.5 && (dx > 0.5 || dz > 0.5)) parts.push('alt ' + ctx.fmt(dy));
    return [ctx.fmt(d), parts.join(' · ')];
  }
  function segment(a, b, objs) {
    const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
    const ln = new THREE.Line(geo, lineMat); ln.renderOrder = 6; root.add(ln); objs.push(ln);
    for (const p of [a, b]) { const m = dot(p); root.add(m); objs.push(m); }
    const [t, sub] = texts(a, b);
    const sp = labelSprite(t, sub); sp.position.copy(a).add(b).multiplyScalar(0.5); sp.position.y += 4; root.add(sp); objs.push(sp);
  }
  function clearPreview() { if (preview) { preview.forEach(disposeObj); preview = null; } }
  function clearCursor() { if (cursor) { disposeObj(cursor); cursor = null; } }

  api.click = (raycaster) => {
    const r = pick(raycaster); if (!r) return;
    if (!first) {
      first = r.p; clearCursor();
      cursor = dot(first); root.add(cursor);
    } else {
      clearPreview(); clearCursor();
      if (first.distanceTo(r.p) > 0.5) { const objs = []; segment(first, r.p, objs); tapes.push({ a: first, b: r.p, objs }); }
      first = null;
      if (tapes.length > 12) tapes.shift().objs.forEach(disposeObj);
    }
    api.fit(); ctx.render();
  };
  api.hover = (raycaster) => {
    if (!first) return;
    const r = pick(raycaster); if (!r) return;
    clearPreview(); preview = []; segment(first, r.p, preview);
    api.fit(); ctx.render();
  };
  api.undo = () => { if (first) { first = null; clearCursor(); clearPreview(); } else if (tapes.length) tapes.pop().objs.forEach(disposeObj); ctx.render(); };
  api.clear = () => { first = null; clearCursor(); clearPreview(); while (tapes.length) tapes.pop().objs.forEach(disposeObj); ctx.render(); };
  api.set = (on) => { api.active = !!on; if (!on) api.clear(); };
  api.list = () => tapes.map((t) => Math.round(t.a.distanceTo(t.b) * 10) / 10);
  return api;
}
