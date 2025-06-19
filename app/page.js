"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="min-h-screen p-8 flex items-center justify-center">
        <main className="flex flex-col gap-[32px] items-center max-w-6xl mx-auto">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              DataCrumbs Sales Portal
            </h1>
            <p className="text-gray-400">
              Internal Sales Management System
            </p>
          </div>

          <div className="flex gap-6 items-center flex-col sm:flex-row mt-8">
            {/* Send Invoice Button */}
            <a
              href="https://payslipsdatacrumbs-87c5a52d19c0.herokuapp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-64 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-green-500/20 transition-all duration-300 hover:scale-105"
            >
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-green-400">Send Invoice</span>
                </div>
              </div>
            </a>

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

          <button
            onClick={() => router.push('/admin')}
            className="mt-8 px-8 py-4 bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-lg shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105 text-purple-400 font-medium flex items-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin Panel
          </button>
        </main>
      </div>
    </div>
  );
}
