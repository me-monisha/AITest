import { Bot, User } from 'lucide-react'

export default function ChatMessage({ role, content }) {
  const isAssistant = role === 'assistant'
  return (
    <div className={`flex animate-fade-in gap-2.5 ${isAssistant ? '' : 'flex-row-reverse'}`}>
      <div
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
          isAssistant ? 'bg-brand-500 text-white' : 'bg-slate-200 text-slate-600'
        }`}
      >
        {isAssistant ? <Bot size={14} /> : <User size={14} />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isAssistant
            ? 'rounded-tl-sm bg-brand-50 text-slate-700'
            : 'rounded-tr-sm bg-slate-100 text-slate-700'
        }`}
      >
        {content}
      </div>
    </div>
  )
}
