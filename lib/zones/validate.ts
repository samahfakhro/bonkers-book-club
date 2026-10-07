import intersect from '@turf/intersect'
import area from '@turf/area'
import kinks from '@turf/kinks'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { featureCollection, polygon as turfPolygon } from '@turf/helpers'
import type { Feature, Polygon, MultiPolygon } from 'geojson'

// Shared by the admin zone editor (live warnings) and the save API (final check)

export type ZoneShape = { code: string; ring: [number, number][] } // [lng, lat] corners, not closed

export type ZoneProblems = {
  overlaps: { codes: [string, string]; shape: Feature<Polygon | MultiPolygon>; areaM2: number }[]
  gaps: { codes: string[]; shape: Feature<Polygon>; areaM2: number }[]
  crossed: string[]   // zones whose outline crosses itself
  tooSmall: string[]  // zones with fewer than 3 corners
}

export function toPolygon(z: ZoneShape): Feature<Polygon> | null {
  if (z.ring.length < 3) return null
  const ring = [...z.ring, z.ring[0]]
  return turfPolygon([ring], { code: z.code })
}

const MIN_OVERLAP_M2 = 25       // ignore rounding specks (a few metres square)

export function findZoneProblems(zones: ZoneShape[]): ZoneProblems {
  const problems: ZoneProblems = { overlaps: [], gaps: [], crossed: [], tooSmall: [] }
  const polys: { code: string; f: Feature<Polygon> }[] = []
  for (const z of zones) {
    if (!z.ring.length) continue
    const f = toPolygon(z)
    if (!f) { problems.tooSmall.push(z.code); continue }
    if (kinks(f).features.length) { problems.crossed.push(z.code); continue }
    polys.push({ code: z.code, f })
  }

  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
    let shape: Feature<Polygon | MultiPolygon> | null = null
    try { shape = intersect(featureCollection([polys[i].f, polys[j].f])) } catch { /* invalid geometry */ }
    if (shape && area(shape) > MIN_OVERLAP_M2) problems.overlaps.push({ codes: [polys[i].code, polys[j].code], shape, areaM2: area(shape) })
  }

  if (polys.length > 1) problems.gaps = findGaps(polys)
  return problems
}

// Gaps: sample the map on a grid and flag spots that belong to no zone but have two DIFFERENT zones
// on opposite sides within a couple of grid steps. Predictable and fast (no shape-merging maths,
// which can stall on messy outlines).
const MAX_CELLS = 140_000
function findGaps(polys: { code: string; f: Feature<Polygon> }[]): ZoneProblems['gaps'] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const boxes = polys.map(p => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
    for (const [x, y] of p.f.geometry.coordinates[0]) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y) }
    x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d)
    return [a, b, c, d]
  })
  const step = Math.max(0.0007, Math.sqrt(((x1 - x0) * (y1 - y0)) / MAX_CELLS))
  const cols = Math.ceil((x1 - x0) / step) + 1, rows = Math.ceil((y1 - y0) / step) + 1
  const owner = new Int8Array(cols * rows).fill(-1)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * step, y = y0 + r * step
    for (let k = 0; k < polys.length; k++) {
      const [a, b, cc, d] = boxes[k]
      if (x < a || x > cc || y < b || y > d) continue
      if (booleanPointInPolygon([x, y], polys[k].f)) { owner[r * cols + c] = k; break }
    }
  }
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= rows || c >= cols) ? -1 : owner[r * cols + c]
  const look = (r: number, c: number, dr: number, dc: number) => { for (let s = 1; s <= 3; s++) { const o = at(r + dr * s, c + dc * s); if (o >= 0) return o } return -1 }
  const gapCell = new Map<number, Set<number>>()
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (owner[r * cols + c] >= 0) continue
    const w = look(r, c, 0, -1), e = look(r, c, 0, 1), n = look(r, c, 1, 0), s = look(r, c, -1, 0)
    if (w >= 0 && e >= 0 && w !== e) gapCell.set(r * cols + c, new Set([w, e]))
    else if (n >= 0 && s >= 0 && n !== s) gapCell.set(r * cols + c, new Set([n, s]))
  }
  // group neighbouring gap cells into one gap each
  const out: ZoneProblems['gaps'] = []
  const seen = new Set<number>()
  const cellM2 = (step * 111_320) * (step * 111_320 * Math.cos(((y0 + y1) / 2) * Math.PI / 180))
  for (const start of gapCell.keys()) {
    if (seen.has(start)) continue
    const stack = [start], codes = new Set<number>()
    let rMin = Infinity, rMax = -Infinity, cMin = Infinity, cMax = -Infinity, count = 0
    seen.add(start)
    while (stack.length) {
      const i = stack.pop()!, r = Math.floor(i / cols), c = i % cols
      count++; gapCell.get(i)!.forEach(k => codes.add(k))
      rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); cMin = Math.min(cMin, c); cMax = Math.max(cMax, c)
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const j = (r + dr) * cols + (c + dc)
        if (!seen.has(j) && gapCell.has(j)) { seen.add(j); stack.push(j) }
      }
    }
    const ax = x0 + (cMin - 0.5) * step, bx = x0 + (cMax + 0.5) * step, ay = y0 + (rMin - 0.5) * step, by = y0 + (rMax + 0.5) * step
    out.push({ codes: [...codes].map(k => polys[k].code).sort(), shape: turfPolygon([[[ax, ay], [bx, ay], [bx, by], [ax, by], [ax, ay]]]), areaM2: count * cellM2 })
  }
  return out
}
