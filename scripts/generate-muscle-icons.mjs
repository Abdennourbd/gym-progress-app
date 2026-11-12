import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

// The anatomy data comes from the body-highlighter package, which ships the
// muscle shapes as SVG polygons.
//   npm i -D body-highlighter
const src = readFileSync(
  path.resolve('node_modules/body-highlighter/src/assets/index.ts'),
  'utf8',
);

const viewOrder = [
  ['anterior', 'anteriorData'],
  ['posterior', 'posteriorData'],
  ['lateral', 'lateralData'],
  ['right', 'rightData'],
  ['left', 'leftData'],
];

// muscles[view][MUSCLE] = [polygon, ...]
const muscles = {};
for (const [view, key] of viewOrder) {
  const start = src.indexOf(`export const ${key}`);
  if (start === -1) continue;
  const next = src.indexOf('export const ', start + 10);
  const text = src.slice(start, next === -1 ? src.length : next);
  const re = /muscle:\s*MuscleType\.([A-Z_]+)\s*,\s*svgPoints:\s*\[([\s\S]*?)\]/g;
  let m;
  while ((m = re.exec(text))) {
    const points = [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1].trim());
    if (!points.length) continue;
    muscles[view] = muscles[view] || {};
    muscles[view][m[1]] = [...(muscles[view][m[1]] || []), ...points];
  }
}

function bbox(pointsList) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pointsList) {
    const nums = p.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
    for (let i = 0; i + 1 < nums.length; i += 2) {
      x0 = Math.min(x0, nums[i]);
      x1 = Math.max(x1, nums[i]);
      y0 = Math.min(y0, nums[i + 1]);
      y1 = Math.max(y1, nums[i + 1]);
    }
  }
  return { x0, y0, x1, y1 };
}

/** Which view and which source muscles make up each of the nine in the app. */
const SET = {
  chest: { view: 'anterior', keys: ['CHEST'] },
  back: { view: 'posterior', keys: ['UPPER_BACK'] },
  shoulders: { view: 'anterior', keys: ['FRONT_DELTOIDS'] },
  biceps: { view: 'anterior', keys: ['BICEPS'] },
  triceps: { view: 'posterior', keys: ['TRICEPS'] },
  quads: { view: 'anterior', keys: ['QUADRICEPS'] },
  hamstrings: { view: 'posterior', keys: ['HAMSTRING', 'GLUTEAL'] },
  calves: { view: 'posterior', keys: ['CALVES'] },
  forearms: { view: 'anterior', keys: ['FOREARM'] },
};

const NAMES = {
  chest: 'ChestIcon',
  back: 'BackIcon',
  shoulders: 'ShouldersIcon',
  biceps: 'BicepsIcon',
  triceps: 'TricepsIcon',
  quads: 'QuadsIcon',
  hamstrings: 'HamstringsIcon',
  calves: 'CalvesIcon',
  forearms: 'ForearmsIcon',
};

/** How much context to keep around the highlighted muscle. */
const ZOOM = { chest: 1.4, back: 1.4, shoulders: 1.3, biceps: 1.6, triceps: 1.6, quads: 1.5, hamstrings: 1.45, calves: 1.6, forearms: 1.55 };

const parts = [];
const preview = [];

for (const [label, { view, keys }] of Object.entries(SET)) {
  const data = muscles[view];
  const target = keys.flatMap((k) => data?.[k] || []);
  const b = bbox(target);

  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const w = (b.x1 - b.x0) * ZOOM[label];
  const h = (b.y1 - b.y0) * ZOOM[label];
  // Square framing so every muscle renders at the same visual scale.
  const side = Math.max(w, h);
  const viewBox = [
    (cx - side / 2).toFixed(3),
    (cy - side / 2).toFixed(3),
    side.toFixed(3),
    side.toFixed(3),
  ].join(' ');

  // Every muscle in this view, as context.
  const context = Object.values(data).flat();
  const ctxPolys = context.map((p) => `      <polygon points="${p}" />`).join('\n');
  const targetPolys = target.map((p) => `        <polygon points="${p}" />`).join('\n');

  parts.push(
    `export function ${NAMES[label]}({ className }: IconProps) {
  return (
    <svg viewBox="${viewBox}" className={className} aria-hidden="true">
      <g fill="currentColor" opacity="0.22">
${ctxPolys}
      </g>
      <g fill="currentColor">
${targetPolys}
      </g>
    </svg>
  );
}`,
  );

  preview.push(
    `<div style="border:1px solid #e5e5e5;border-radius:14px;padding:12px;text-align:center">
<div style="height:78px;display:flex;align-items:center;justify-content:center;color:#111">
<svg viewBox="${viewBox}" width="74" height="74" preserveAspectRatio="xMidYMid meet">
<g fill="currentColor" opacity="0.22">${context.map((p) => `<polygon points="${p}"/>`).join('')}</g>
<g fill="currentColor">${target.map((p) => `<polygon points="${p}"/>`).join('')}</g>
</svg></div>
<div style="font-size:12px;color:#444;margin-top:6px">${label}</div></div>`,
  );
}

const header = `/**
 * Muscle icons.
 *
 * Each one shows the surrounding body in a light tone with the muscle itself
 * picked out, so you can tell at a glance which group is which. Shapes come
 * from an anatomical body model. They fill the current colour, so they follow
 * the theme.
 */

type IconProps = { className?: string };

`;

const map = `
/** The icon for each muscle in the app, keyed by muscle id. */
export const MUSCLE_ICONS: Record<string, (props: IconProps) => React.JSX.Element> = {
${Object.entries(NAMES)
  .map(([label, name]) => `  ${label}: ${name},`)
  .join('\n')}
};
`;

writeFileSync(
  path.resolve('src/components/icons/MuscleIcons.tsx'),
  header + parts.join('\n\n') + '\n' + map,
);

writeFileSync(
  '/tmp/opencode/muscles-preview.html',
  `<!doctype html><html><body style="margin:0;padding:20px;background:#fff;font-family:system-ui">
<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:14px">${preview.join('')}</div></body></html>`,
);

console.log('generated', Object.keys(SET).length, 'icons');
