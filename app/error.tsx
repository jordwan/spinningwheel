"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error:", error);
  }, [error]);

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
          <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 mb-3">
            <svg
              className="w-6 h-6 text-orange-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Something went wrong</h1>
          <p className="text-sm text-gray-600">
            The wheel hit an unexpected error. Trying again usually fixes it.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/"
              className="flex-1 px-4 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
            >
              Home
            </Link>
            <button
              onClick={reset}
              className="flex-1 px-4 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
