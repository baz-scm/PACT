export function Landing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-3">PACT</h1>
      <p className="text-gray-500 max-w-md">
        Plan As ConTract — capture, review, and approve AI coding plans before execution.
      </p>
      <p className="mt-6 text-sm text-gray-400">
        Paste a plan URL to view it, or install the hooks to start capturing plans.
      </p>
    </div>
  );
}
