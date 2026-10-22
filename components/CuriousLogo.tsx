// The Curious Library wordmark. Navy by default; `light` gives the cream version for navy backgrounds.
export default function CuriousLogo({ height = 52, light = false }: { height?: number; light?: boolean }) {
  return (
    <img
      src={light ? '/Curious_logo_cream.png' : '/Curious_logo.png'}
      alt="The Curious Library"
      style={{ height: `${height}px`, width: 'auto', display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}
