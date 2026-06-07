import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-lg font-bold text-white shadow-sm">
        PO
      </div>
      <h1 className="mt-6 text-5xl font-black tracking-tight text-gray-900">404</h1>
      <p className="mt-3 max-w-md text-sm text-gray-500">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
      >
        <Home className="h-4 w-4" />
        Back to home
      </Link>
    </main>
  );
}
