import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="min-h-screen p-8 flex items-center justify-center">
        <main className="flex flex-col gap-[32px] items-center max-w-4xl mx-auto">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              DataCrumbs Sales Portal
            </h1>
            <p className="text-gray-400">
              Internal Sales Management System
            </p>
          </div>

          <div className="flex gap-6 items-center flex-col sm:flex-row mt-8">
            <Link
              href="/data-entry"
              className="w-full sm:w-64 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105"
            >
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-blue-400">Data Entry</span>
                </div>
              </div>
            </Link>

            <Link
              href="/calling"
              className="w-full sm:w-64 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105"
            >
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="font-medium text-purple-400">Calling Interface</span>
                </div>
              </div>
            </Link>
        </div>
      </main>
      </div>
    </div>
  );
}
