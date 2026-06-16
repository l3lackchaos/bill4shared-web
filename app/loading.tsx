// Shown during navigation to the home page. Mirrors the list layout so the
// transition feels instant instead of a blank flash.
export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="flex items-center justify-between pt-8 pb-7">
        <div className="flex items-center gap-2.5">
          <div className="skeleton w-9 h-9 rounded-xl" />
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-28" />
            <div className="skeleton h-3 w-36" />
          </div>
        </div>
        <div className="skeleton h-9 w-24 rounded-full" />
      </div>
      <div className="skeleton h-11 w-full rounded-full mb-3" />
      <div className="flex gap-2 mb-5">
        {[56, 64, 72, 60].map((w, i) => <div key={i} className="skeleton h-7 rounded-full" style={{ width: w }} />)}
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[68px] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
