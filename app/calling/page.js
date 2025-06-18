export default function Calling() {
  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Calling Interface</h1>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-md rounded-lg p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-medium">Current Call</span>
              <span className="text-sm text-gray-500">00:00</span>
            </div>
            <div className="flex justify-center space-x-4">
              <button className="bg-green-500 text-white p-4 rounded-full hover:bg-green-600">
                Start Call
              </button>
              <button className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600">
                End Call
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 