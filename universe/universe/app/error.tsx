'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-body-gradient flex items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold mb-4 text-gradient">Произошла ошибка</h2>
        <p className="text-[#ccc] mb-8">{error.message}</p>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 relative overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed bg-primary-gradient text-black hover:bg-primary-gradient-hover shadow-[0_4px_15px_rgba(20,184,166,0.3)] hover:shadow-[0_8px_25px_rgba(20,184,166,0.4)] hover:-translate-y-[3px] active:translate-y-[-1px] shine-effect h-12 px-8 py-3"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  )
}






