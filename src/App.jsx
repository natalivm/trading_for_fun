import Header from './components/Header'
import CardList from './components/CardList'
import BottomNav from './components/BottomNav'

function App() {
  return (
    <div className="flex min-h-screen min-h-dvh flex-col bg-slate-950">
      <Header />
      <main className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <CardList />
      </main>
      <BottomNav />
    </div>
  )
}

export default App
