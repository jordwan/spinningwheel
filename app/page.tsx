import SpinningWheel from "./components/SpinningWheel";

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50">
      <main className="h-full w-full flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-800 mb-6 text-center">
          Wheel of Greatness
        </h1>
        <div className="flex-1 w-full max-w-4xl">
          <SpinningWheel />
        </div>
      </main>
    </div>
  );
}
