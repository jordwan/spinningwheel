import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="w-screen min-h-[100svh] overflow-hidden relative">
      <div
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: -1, minHeight: "100vh", minWidth: "100vw" }}
      >
        <Image
          src="/bkgddT.png"
          alt=""
          fill
          priority
          className="object-cover object-center blur-[3px]"
          sizes="100vw"
          quality={85}
        />
      </div>

      <main className="relative z-10 flex items-center justify-center min-h-[100svh] p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Wheel not found</h1>
          <p className="text-sm text-gray-600">
            This link doesn&apos;t point to a wheel. It may have been mistyped, or the
            wheel was never shared.
          </p>
          <Link
            href="/"
            className="inline-block mt-6 w-full px-6 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors"
          >
            Make your own wheel
          </Link>
        </div>
      </main>
    </div>
  );
}
