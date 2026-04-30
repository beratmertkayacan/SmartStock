import Navbar from "./Navbar"

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Navbar />
      <main className="max-w-screen-2xl mx-auto px-8 py-8">
        {children}
      </main>
    </div>
  )
}