const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const add = (a, b, c, u, v) => a.map((n, i) => n + b[i] * u + c[i] * v);
export function directionName([x, y, z]) {
  return [
    y > 0 ? "top" : y < 0 ? "bottom" : "",
    z > 0 ? "front" : z < 0 ? "back" : "",
    x > 0 ? "right" : x < 0 ? "left" : "",
  ]
    .filter(Boolean)
    .join("-");
}
export const CUBE_DIRECTIONS = [];
for (const x of [-1, 0, 1])
  for (const y of [-1, 0, 1])
    for (const z of [-1, 0, 1]) {
      if (x || y || z)
        CUBE_DIRECTIONS.push({
          name: directionName([x, y, z]),
          vector: [x, y, z],
          kind:
            [x, y, z].filter(Boolean).length === 3
              ? "corner"
              : [x, y, z].filter(Boolean).length === 2
                ? "edge"
                : "face",
        });
    }
const faces = [
  ["front", [0, 0, 1], [1, 0, 0], [0, 1, 0]],
  ["back", [0, 0, -1], [-1, 0, 0], [0, 1, 0]],
  ["right", [1, 0, 0], [0, 0, -1], [0, 1, 0]],
  ["left", [-1, 0, 0], [0, 0, 1], [0, 1, 0]],
  ["top", [0, 1, 0], [1, 0, 0], [0, 0, -1]],
  ["bottom", [0, -1, 0], [1, 0, 0], [0, 0, 1]],
];
/** Project the cube with the same camera basis as the room; no extra WebGL renderer. */
export function projectViewCube({ normal, right, up }) {
  const project = (p) => [52 + dot(p, right) * 25, 49 - dot(p, up) * 25];
  const cuts = [-1, -0.52, 0.52, 1];
  return faces
    .filter(([, n]) => dot(n, normal) > 0.002)
    .map(([name, n, u, v]) => {
      const zones = [];
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) {
          const direction = add(n, u, v, col - 1, row - 1);
          zones.push({
            name: directionName(direction),
            points: [
              [cuts[col], cuts[row]],
              [cuts[col + 1], cuts[row]],
              [cuts[col + 1], cuts[row + 1]],
              [cuts[col], cuts[row + 1]],
            ].map(([a, b]) => project(add(n, u, v, a, b))),
          });
        }
      return {
        name,
        zones,
        shade: Math.max(0.12, dot(n, normal)),
        outline: [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([a, b]) => project(add(n, u, v, a, b))),
        center: project(n),
        textMatrix: [dot(u, right), -dot(u, up), -dot(v, right), dot(v, up)],
      };
    });
}
