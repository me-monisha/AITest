import { useRef, useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Sparkles, FileText, ClipboardPaste, Send, X } from 'lucide-react'
import ChatMessage from './ChatMessage'
import { runDocumentExtraction, runTextExtraction, sendChatTurn } from '../store/aiAssistantSlice'

export default function AIAssistantPanel() {
  const dispatch = useDispatch()
  const { messages, isExtracting, extractionProgress, extractionMessage, isChatting } = useSelector(
    (s) => s.aiAssistant,
  )

  const [isDragging, setIsDragging] = useState(false)
  const [showPasteBox, setShowPasteBox] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [chatInput, setChatInput] = useState('')
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isExtracting])

  const handleFile = (file) => {
    if (!file) return
    dispatch(runDocumentExtraction(file))
  }

  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const submitPaste = () => {
    if (!pasteText.trim()) return
    dispatch(runTextExtraction(pasteText.trim()))
    setPasteText('')
    setShowPasteBox(false)
  }

  const submitChat = (e) => {
    e.preventDefault()
    if (!chatInput.trim() || isChatting) return
    dispatch(sendChatTurn(chatInput.trim()))
    setChatInput('')
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles size={17} className="text-brand-500" />
          <h2 className="text-[15px] font-semibold text-slate-900">AI Deviation Assistant</h2>
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand-600">
          BETA
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Upload dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${
            isDragging ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <FileText size={22} className="text-slate-400" />
          <div className="text-sm text-slate-600">
            Drag & drop supporting document here
            <br />
            or <span className="font-medium text-brand-600">click to browse</span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.xls,.xlsx,.jpg,.jpeg,.png"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>

        <div className="mb-3 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-100" />
          OR
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        {/* Paste box */}
        {!showPasteBox ? (
          <button
            onClick={() => setShowPasteBox(true)}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ClipboardPaste size={16} />
            Paste deviation details / notes
          </button>
        ) : (
          <div className="mb-3 rounded-xl border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Paste deviation notes or email</span>
              <button onClick={() => setShowPasteBox(false)} className="text-slate-400 hover:text-slate-600">
                <X size={14} />
              </button>
            </div>
            <textarea
              autoFocus
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="e.g. On 20-Sep, Batch ABC-001 assay came back at 92% against the 95-105% spec during routine QC testing at the API unit..."
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <button
              onClick={submitPaste}
              disabled={!pasteText.trim()}
              className="mt-2 w-full rounded-lg bg-brand-500 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Extract details
            </button>
          </div>
        )}

        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs text-emerald-700">
          <span className="font-semibold">Supported formats:</span> PDF, DOCX, TXT, XLS, JPG, PNG
          <br />
          <span className="font-semibold">Max file size:</span> 10MB
        </div>

        {/* Progress */}
        {isExtracting && (
          <div className="mb-4 animate-fade-in">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-slate-500">
                Extraction Progress
              </span>
              <span className="font-semibold text-brand-600">{extractionProgress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300 ease-out"
                style={{ width: `${extractionProgress}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">{extractionMessage}</p>
          </div>
        )}

        {/* Chat thread */}
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          AI Assistant
        </div>
        <div ref={scrollRef} className="thin-scroll flex max-h-[340px] flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <ChatMessage key={i} role={m.role} content={m.content} />
          ))}
          {isChatting && (
            <ChatMessage role="assistant" content={<span className="italic text-slate-400">Thinking...</span>} />
          )}
        </div>
      </div>

      {/* Chat input */}
      <form onSubmit={submitChat} className="border-t border-slate-100 p-4">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 pl-3.5 pr-1.5 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
          <input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask me anything about deviations..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          AI responses may contain errors. Please verify information.
        </p>
      </form>
    </div>
  )
}
