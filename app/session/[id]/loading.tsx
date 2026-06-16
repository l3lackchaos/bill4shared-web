// Generic session-page skeleton, shown while any session sub-route loads.
export default function Loading() {
  return (
    <div className="max-w-md mx-auto px-4 pb-16">
      <div className="skeleton h-4 w-20 mt-8 mb-5 rounded" />
      <div className="skeleton h-7 w-32 mb-2 rounded" />
      <div className="skeleton h-4 w-44 mb-7 rounded" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 w-full rounded-2xl" />
        ))}
      </div>
      <div className="skeleton h-14 w-full rounded-2xl mt-7" />
    </div>
  )
}
