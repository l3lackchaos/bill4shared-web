// Colored initial badge for a person. Color is deterministic from the name so
// the same person always gets the same color across pages. Uses a soft tinted
// fill with a dark same-hue letter (passes contrast far better than white-on-mid,
// per the impeccable contrast rule) plus a subtle ring for definition.
const HUES = [25, 60, 140, 195, 285, 330] // coral, amber, green, cyan, violet, pink

function hueFor(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return HUES[h % HUES.length]
}

function initial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  const m = t.match(/[\p{L}\p{N}]/u)
  return (m ? m[0] : t[0]).toUpperCase()
}

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = hueFor(name)
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full font-bold shrink-0"
      style={{
        width: size,
        height: size,
        // Tinted fill + dark ink of the same hue → high contrast, light & dark safe.
        background: `oklch(0.92 0.08 ${hue})`,
        color: `oklch(0.42 0.15 ${hue})`,
        boxShadow: `inset 0 0 0 1px oklch(0.6 0.14 ${hue} / 0.35)`,
        fontSize: size * 0.42,
      }}
    >
      {initial(name)}
    </span>
  )
}
