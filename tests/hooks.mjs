const MAP = { three: '../vendor/three.module.js', 'three/addons/OrbitControls.js': '../vendor/OrbitControls.js' };
export async function resolve(spec, ctx, next) {
  if (MAP[spec]) return next(new URL(MAP[spec], import.meta.url).href, ctx);
  return next(spec, ctx);
}
