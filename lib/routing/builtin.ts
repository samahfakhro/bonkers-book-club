// Built-in route order: the backup when Google's route service isn't set up or is unavailable.
// Straight-line distances (not roads): nearest-neighbour from the warehouse, then 2-opt improvement
// (reverse any stretch of the route that makes the whole trip shorter, until nothing improves).

export type LatLng = { lat: number; lng: number }

const R_KM = 6371
export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R_KM * Math.asin(Math.sqrt(h))
}

// Returns the visiting order as indexes into `stops`. The route starts at `start`
// and is treated as open (the driver doesn't need to return to the start between stops).
export function builtInOrder(start: LatLng, stops: LatLng[]): number[] {
  const n = stops.length
  if (n <= 1) return stops.map((_, i) => i)

  // distance table: index 0 = start, 1..n = stops
  const pts = [start, ...stops]
  const d: number[][] = pts.map(a => pts.map(b => distanceKm(a, b)))

  // nearest neighbour
  const order: number[] = []
  const used = new Array(n + 1).fill(false)
  let cur = 0
  used[0] = true
  for (let k = 0; k < n; k++) {
    let best = -1, bestD = Infinity
    for (let j = 1; j <= n; j++) if (!used[j] && d[cur][j] < bestD) { bestD = d[cur][j]; best = j }
    used[best] = true
    order.push(best)
    cur = best
  }

  // 2-opt on the open path start → order[0] → … → order[n-1]
  const path = [0, ...order]
  let improved = true
  for (let pass = 0; improved && pass < 50; pass++) {
    improved = false
    for (let i = 1; i < path.length - 1; i++) {
      for (let k = i + 1; k < path.length; k++) {
        const a = path[i - 1], b = path[i], c = path[k], e = k + 1 < path.length ? path[k + 1] : -1
        const before = d[a][b] + (e >= 0 ? d[c][e] : 0)
        const after = d[a][c] + (e >= 0 ? d[b][e] : 0)
        if (after + 1e-9 < before) {
          path.splice(i, k - i + 1, ...path.slice(i, k + 1).reverse())
          improved = true
        }
      }
    }
  }
  return path.slice(1).map(j => j - 1)
}

export function routeLengthKm(start: LatLng, ordered: LatLng[]): number {
  let total = 0, prev = start
  for (const p of ordered) { total += distanceKm(prev, p); prev = p }
  return total
}
