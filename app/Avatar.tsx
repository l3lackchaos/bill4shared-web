// Colored initial badge for a person. Color is deterministic from the name so
// the same person always gets the same vivid color across pages.
const COLORS = [
  'var(--av-1)', 'var(--av-2)', 'var(--av-3)',
  'var(--av-4)', 'var(--av-5)', 'var(--av-6)',
]

function colorFor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return COLORS[h % COLORS.length]
}

function initial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  // First alphanumeric char (handles Thai, latin, emoji-prefixed names).
  const m = t.match(/[\p{L}\p{N}]/u)
  return (m ? m[0] : t[0]).toUpperCase()
}

export default function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full font-bold text-white shrink-0 shadow-[var(--shadow-sm)]"
      style={{
        width: size,
        height: size,
        background: colorFor(name),
        fontSize: size * 0.42,
      }}
    >
      {initial(name)}
    </span>
  )
}
