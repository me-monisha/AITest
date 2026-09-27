import { useSelector, useDispatch } from 'react-redux'
import { Sparkles, RotateCcw, Save, Loader2, CheckCircle2 } from 'lucide-react'
import {
  fieldChanged,
  formReset,
  submitDeviation,
  SOURCE_OPTIONS,
  IMPACT_LEVELS,
  SEVERITY_LEVELS,
} from '../store/deviationFormSlice'

const MAX_DESCRIPTION_LENGTH = 2000

function FieldLabel({ children, required, aiFilled }) {
  return (
    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
      {children}
      {required && <span className="text-red-500">*</span>}
      {aiFilled && (
        <span
          title="Populated by the AI Assistant"
          className="ml-auto flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600"
        >
          <Sparkles size={11} />
          AI
        </span>
      )}
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export default function DeviationForm() {
  const dispatch = useDispatch()
  const { fields, aiFilledFields, status, savedId, saveError } = useSelector((s) => s.deviationForm)

  const isAi = (name) => aiFilledFields.includes(name)
  const onChange = (name) => (e) => dispatch(fieldChanged({ name, value: e.target.value }))

  const handleSave = (e) => {
    e.preventDefault()
    dispatch(submitDeviation())
  }

  const statusBadge =
    status === 'saved' ? (
      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={13} /> Saved
      </span>
    ) : (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Draft</span>
    )

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-1 flex items-start justify-between">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Log Deviation</h1>
        {statusBadge}
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Record any unexpected event, out-of-specification result or non-conformance.
      </p>

      {/* Section 1 */}
      <div className="mb-7">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          1. Deviation information
        </h2>
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <div>
            <FieldLabel required aiFilled={isAi('site_plant')}>
              Site / Plant
            </FieldLabel>
            <select className={inputClass} value={fields.site_plant} onChange={onChange('site_plant')}>
              <option value="">Select site / plant</option>
              <option>API Manufacturing Unit</option>
              <option>Formulation Unit 1</option>
              <option>Formulation Unit 2</option>
              <option>QC Laboratory</option>
              <option>Warehouse</option>
            </select>
          </div>

          <div>
            <FieldLabel required aiFilled={isAi('date_of_occurrence')}>
              Date of Occurrence
            </FieldLabel>
            <input
              type="date"
              className={inputClass}
              value={fields.date_of_occurrence || ''}
              onChange={onChange('date_of_occurrence')}
            />
          </div>

          <div>
            <FieldLabel required aiFilled={isAi('title')}>
              Title / Short Description
            </FieldLabel>
            <input
              type="text"
              placeholder="e.g. OOS result for Assay in Batch ABC-001"
              className={inputClass}
              value={fields.title}
              onChange={onChange('title')}
            />
          </div>

          <div>
            <FieldLabel required aiFilled={isAi('source')}>
              Source
            </FieldLabel>
            <select className={inputClass} value={fields.source} onChange={onChange('source')}>
              <option value="">Select source</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel aiFilled={isAi('related_product')}>Related Product / Material</FieldLabel>
            <input
              type="text"
              placeholder="Search product or material..."
              className={inputClass}
              value={fields.related_product}
              onChange={onChange('related_product')}
            />
          </div>

          <div>
            <FieldLabel aiFilled={isAi('batch_lot_number')}>Batch / Lot Number</FieldLabel>
            <input
              type="text"
              placeholder="Enter batch / lot no."
              className={inputClass}
              value={fields.batch_lot_number}
              onChange={onChange('batch_lot_number')}
            />
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div className="mb-7">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
          2. Deviation details
        </h2>

        <div className="mb-5">
          <FieldLabel required aiFilled={isAi('detailed_description')}>
            Detailed Description
          </FieldLabel>
          <textarea
            rows={5}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder="Describe what happened, where, when and how it was detected..."
            className={`${inputClass} resize-none`}
            value={fields.detailed_description}
            onChange={onChange('detailed_description')}
          />
          <div className="mt-1 text-right text-xs text-slate-400">
            {fields.detailed_description?.length || 0}/{MAX_DESCRIPTION_LENGTH}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <div>
            <FieldLabel required aiFilled={isAi('initial_impact')}>
              Initial Impact
            </FieldLabel>
            <select className={inputClass} value={fields.initial_impact} onChange={onChange('initial_impact')}>
              <option value="">Select impact</option>
              {IMPACT_LEVELS.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel required aiFilled={isAi('initial_severity')}>
              Initial Severity
            </FieldLabel>
            <select className={inputClass} value={fields.initial_severity} onChange={onChange('initial_severity')}>
              <option value="">Select severity</option>
              {SEVERITY_LEVELS.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</div>
      )}
      {status === 'saved' && savedId && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Deviation saved successfully (ID: {savedId.slice(0, 8)}).
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={() => dispatch(formReset())}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw size={15} />
          Reset Form
        </button>
        <button
          type="submit"
          disabled={status === 'saving'}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {status === 'saving' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Deviation
        </button>
      </div>
    </form>
  )
}
