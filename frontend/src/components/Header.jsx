import { Bell } from 'lucide-react'

const NAV_ITEMS = ['QMS', 'Dashboard', 'Deviations', 'CAPAs', 'Change Control', 'Audits', 'Documents', 'Reports']

export default function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-2">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M13 2L24 22H2L13 2Z" fill="#2f5fee" />
              <path d="M13 9L18.5 19H7.5L13 9Z" fill="white" />
            </svg>
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-slate-900">AIVOA</div>
              <div className="-mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400">
                AI for a Safer Tomorrow
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item}
                href="#"
                className={`border-b-2 pb-[21px] pt-[21px] text-sm font-medium transition-colors ${
                  item === 'Deviations'
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {item}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 sm:flex">
            Vasudha Pharma Chem Limited
            <span className="text-slate-400">▾</span>
          </button>
          <button className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Notifications">
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
            MH
          </div>
        </div>
      </div>
    </header>
  )
}
