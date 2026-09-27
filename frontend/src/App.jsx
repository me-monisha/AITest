import Header from './components/Header'
import DeviationForm from './components/DeviationForm'
import AIAssistantPanel from './components/AIAssistantPanel'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          <DeviationForm />
          <div className="lg:sticky lg:top-8 lg:self-start lg:h-[calc(100vh-4rem)]">
            <AIAssistantPanel />
          </div>
        </div>
      </main>
    </div>
  )
}
