/* Finds a way across the room. The room already knows where a body may stand
   (`viable`), so the map is that test sampled on a grid, and a path is an A*
   search over it, pulled straight wherever the way is clear. */

const CELL = 0.25;
const NEIGHBOURS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];

export function makeNav(viable, BOUNDS) {
  const COLS = Math.round((BOUNDS.maxX - BOUNDS.minX) / CELL) + 1;
  const ROWS = Math.round((BOUNDS.maxZ - BOUNDS.minZ) / CELL) + 1;
  const open = new Uint8Array(COLS * ROWS);
  const xOf = (col) => BOUNDS.minX + col * CELL;
  const zOf = (row) => BOUNDS.minZ + row * CELL;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) open[row * COLS + col] = viable(xOf(col), zOf(row)) ? 1 : 0;
  }
  const free = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS && open[row * COLS + col] === 1;

  function nearestCell(x, z) {
    const col0 = Math.round((x - BOUNDS.minX) / CELL);
    const row0 = Math.round((z - BOUNDS.minZ) / CELL);
    for (let ring = 0; ring < 14; ring++) {
      let best = null;
      for (let row = row0 - ring; row <= row0 + ring; row++) {
        for (let col = col0 - ring; col <= col0 + ring; col++) {
          if (Math.max(Math.abs(row - row0), Math.abs(col - col0)) !== ring || !free(col, row)) continue;
          const d = Math.hypot(xOf(col) - x, zOf(row) - z);
          if (!best || d < best.d) best = { col, row, d };
        }
      }
      if (best) return best;
    }
    return null;
  }

  function clear(ax, az, bx, bz) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (!viable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /* Points to walk through, ending exactly at `to` when a body may stand there.
     Returns null when the two are not connected. */
  function path(from, to) {
    const start = nearestCell(from[0], from[1]);
    const goal = nearestCell(to[0], to[1]);
    if (!start || !goal) return null;

    const size = COLS * ROWS;
    const cost = new Float32Array(size).fill(Infinity);
    const came = new Int32Array(size).fill(-1);
    const done = new Uint8Array(size);
    const startId = start.row * COLS + start.col;
    const goalId = goal.row * COLS + goal.col;
    const frontier = [[0, startId]];
    cost[startId] = 0;

    while (frontier.length) {
      let pick = 0;
      for (let i = 1; i < frontier.length; i++) if (frontier[i][0] < frontier[pick][0]) pick = i;
      const [, id] = frontier.splice(pick, 1)[0];
      if (id === goalId) break;
      if (done[id]) continue;
      done[id] = 1;
      const col = id % COLS;
      const row = (id - col) / COLS;
      for (const [dc, dr, step] of NEIGHBOURS) {
        const nc = col + dc;
        const nr = row + dr;
        // No squeezing diagonally between two blocked cells.
        if (!free(nc, nr) || (dc && dr && (!free(col + dc, row) || !free(col, row + dr)))) continue;
        const next = nr * COLS + nc;
        const total = cost[id] + step;
        if (total >= cost[next]) continue;
        cost[next] = total;
        came[next] = id;
        frontier.push([total + Math.hypot(nc - goal.col, nr - goal.row), next]);
      }
    }
    if (startId !== goalId && came[goalId] === -1) return null;

    const cells = [];
    for (let id = goalId; id !== -1; id = came[id]) cells.push([xOf(id % COLS), zOf(Math.floor(id / COLS))]);
    cells.reverse();
    if (viable(to[0], to[1]) && clear(cells[cells.length - 1][0], cells[cells.length - 1][1], to[0], to[1])) cells.push([to[0], to[1]]);

    const points = [[from[0], from[1]]];
    let anchor = 0;
    const all = [[from[0], from[1]], ...cells];
    while (anchor < all.length - 1) {
      let reach = anchor + 1;
      for (let i = all.length - 1; i > anchor + 1; i--) {
        if (clear(all[anchor][0], all[anchor][1], all[i][0], all[i][1])) { reach = i; break; }
      }
      points.push(all[reach]);
      anchor = reach;
    }
    return points.slice(1);
  }

  return { path, clear, cells: () => open.reduce((n, v) => n + v, 0) };
}
