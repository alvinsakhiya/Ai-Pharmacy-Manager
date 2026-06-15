function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-slate-100">
      <section className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-cyan-950/30 sm:p-12">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          Phase 0
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Project foundation is ready.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          The clean Django, PostgreSQL, React, TypeScript, and Tailwind
          foundation is in place. Pharmacy workflow features will be added in
          their approved phases.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-300">
          {["Django 5", "PostgreSQL", "React", "TypeScript", "Tailwind CSS"].map(
            (technology) => (
              <span
                className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2"
                key={technology}
              >
                {technology}
              </span>
            ),
          )}
        </div>
      </section>
    </main>
  );
}

export default App;
