import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { saveDeviation } from '../api/deviationsApi'

export const SOURCE_OPTIONS = [
  'Production / Manufacturing',
  'QC Laboratory',
  'QA Review',
  'Warehouse / Storage',
  'Packaging',
  'Audit Finding',
  'Customer Complaint',
  'Stability Study',
  'Other',
]

export const IMPACT_LEVELS = ['Low', 'Medium', 'High', 'Critical']
export const SEVERITY_LEVELS = ['Minor', 'Major', 'Critical']

const emptyFields = {
  site_plant: 'API Manufacturing Unit',
  date_of_occurrence: '',
  title: '',
  source: '',
  related_product: '',
  batch_lot_number: '',
  detailed_description: '',
  initial_impact: '',
  initial_severity: '',
}

const initialState = {
  fields: { ...emptyFields },
  aiFilledFields: [], // field names the AI most recently populated - drives the sparkle badges
  severityReason: null, // AI's short justification for the impact/severity recommendation
  status: 'draft', // 'draft' | 'saving' | 'saved'
  saveError: null,
  savedId: null,
}

export const submitDeviation = createAsyncThunk('deviationForm/submit', async (_, { getState }) => {
  const { fields, aiFilledFields } = getState().deviationForm
  const payload = {
    ...fields,
    date_of_occurrence: fields.date_of_occurrence || null,
    status: 'logged',
    ai_generated_fields: aiFilledFields,
  }
  return saveDeviation(payload)
})

const deviationFormSlice = createSlice({
  name: 'deviationForm',
  initialState,
  reducers: {
    fieldChanged(state, action) {
      const { name, value } = action.payload
      state.fields[name] = value
      // Once a human edits an AI-filled field, it's no longer purely AI-authored
      state.aiFilledFields = state.aiFilledFields.filter((f) => f !== name)
      state.status = 'draft'
      state.savedId = null
    },
    fieldsPopulatedFromAI(state, action) {
      const { fields, aiGeneratedFields, severityReason } = action.payload
      Object.entries(fields || {}).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key in state.fields) {
          state.fields[key] = value
        }
      })
      const newlyFilled = new Set([...state.aiFilledFields, ...(aiGeneratedFields || [])])
      state.aiFilledFields = Array.from(newlyFilled)
      if (severityReason) state.severityReason = severityReason
      state.status = 'draft'
    },
    formReset(state) {
      state.fields = { ...emptyFields }
      state.aiFilledFields = []
      state.severityReason = null
      state.status = 'draft'
      state.saveError = null
      state.savedId = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitDeviation.pending, (state) => {
        state.status = 'saving'
        state.saveError = null
      })
      .addCase(submitDeviation.fulfilled, (state, action) => {
        state.status = 'saved'
        state.savedId = action.payload.id
      })
      .addCase(submitDeviation.rejected, (state, action) => {
        state.status = 'draft'
        state.saveError = action.error.message || 'Could not save this deviation.'
      })
  },
})

export const { fieldChanged, fieldsPopulatedFromAI, formReset } = deviationFormSlice.actions
export default deviationFormSlice.reducer
