import { createSlice } from '@reduxjs/toolkit'
import {
  extractFromDocument,
  extractFromText,
  watchExtractionJob,
  sendChatMessage,
} from '../api/deviationsApi'
import { fieldsPopulatedFromAI } from './deviationFormSlice'

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    'Upload a deviation report, lab result, or paste text above. I will automatically extract the relevant details and populate the form for you.',
}

const initialState = {
  messages: [WELCOME_MESSAGE],
  isExtracting: false,
  extractionProgress: 0,
  extractionMessage: '',
  isChatting: false,
  error: null,
}

const aiAssistantSlice = createSlice({
  name: 'aiAssistant',
  initialState,
  reducers: {
    extractionStarted(state) {
      state.isExtracting = true
      state.extractionProgress = 5
      state.extractionMessage = 'Uploading...'
      state.error = null
    },
    extractionProgressed(state, action) {
      state.extractionProgress = action.payload.progress
      state.extractionMessage = action.payload.message
    },
    extractionFinished(state) {
      state.isExtracting = false
      state.extractionProgress = 100
    },
    extractionFailed(state, action) {
      state.isExtracting = false
      state.error = action.payload
      state.messages.push({ role: 'assistant', content: `I couldn't process that: ${action.payload}` })
    },
    messageAdded(state, action) {
      state.messages.push(action.payload)
    },
    chatStarted(state) {
      state.isChatting = true
    },
    chatFinished(state) {
      state.isChatting = false
    },
  },
})

export const {
  extractionStarted,
  extractionProgressed,
  extractionFinished,
  extractionFailed,
  messageAdded,
  chatStarted,
  chatFinished,
} = aiAssistantSlice.actions

export default aiAssistantSlice.reducer

// ---------- Thunks (kept here, colocated with the slice they drive) ----------

function summarizeFilledFields(aiGeneratedFields, severityReason) {
  const formFieldNames = aiGeneratedFields.filter(
    (f) => f !== 'initial_impact' && f !== 'initial_severity',
  )
  const parts = []
  if (formFieldNames.length) {
    parts.push(`filled in ${formFieldNames.map((f) => f.replace(/_/g, ' ')).join(', ')}`)
  }
  if (aiGeneratedFields.includes('initial_severity') || aiGeneratedFields.includes('initial_impact')) {
    parts.push('suggested an initial impact & severity')
  }
  let text = parts.length ? `I've ${parts.join(' and ')}.` : "I've reviewed the document."
  if (severityReason) text += ` ${severityReason}`
  text += ' Please review everything before saving.'
  return text
}

function runExtractionJob(jobId, dispatch) {
  return new Promise((resolve, reject) => {
    watchExtractionJob(jobId, {
      onProgress: (job) => {
        dispatch(extractionProgressed({ progress: job.progress, message: job.message }))
      },
      onDone: (result) => {
        dispatch(extractionFinished())
        dispatch(
          fieldsPopulatedFromAI({
            fields: result.fields,
            aiGeneratedFields: result.ai_generated_fields,
            severityReason: result.severity_reason,
          }),
        )
        dispatch(
          messageAdded({
            role: 'assistant',
            content: summarizeFilledFields(result.ai_generated_fields || [], result.severity_reason),
          }),
        )
        resolve(result)
      },
      onError: (err) => {
        dispatch(extractionFailed(err))
        reject(new Error(err))
      },
    })
  })
}

export function runDocumentExtraction(file) {
  return async (dispatch) => {
    dispatch(extractionStarted())
    dispatch(messageAdded({ role: 'user', content: `Uploaded ${file.name}` }))
    try {
      const jobId = await extractFromDocument(file)
      await runExtractionJob(jobId, dispatch)
    } catch (err) {
      dispatch(extractionFailed(err?.response?.data?.detail || err.message || 'Upload failed.'))
    }
  }
}

export function runTextExtraction(text) {
  return async (dispatch) => {
    dispatch(extractionStarted())
    dispatch(messageAdded({ role: 'user', content: text }))
    try {
      const jobId = await extractFromText(text)
      await runExtractionJob(jobId, dispatch)
    } catch (err) {
      dispatch(extractionFailed(err?.response?.data?.detail || err.message || 'Extraction failed.'))
    }
  }
}

export function sendChatTurn(message) {
  return async (dispatch, getState) => {
    dispatch(messageAdded({ role: 'user', content: message }))
    dispatch(chatStarted())
    try {
      const { fields } = getState().deviationForm
      const history = getState()
        .aiAssistant.messages.slice(-8)
        .map((m) => ({ role: m.role, content: m.content }))
      const currentFields = { ...fields, date_of_occurrence: fields.date_of_occurrence || null }
      const resp = await sendChatMessage(message, currentFields, history)

      dispatch(messageAdded({ role: 'assistant', content: resp.reply }))

      if (resp.intent !== 'chat' && resp.updated_fields) {
        dispatch(
          fieldsPopulatedFromAI({
            fields: resp.updated_fields,
            aiGeneratedFields: resp.changed_field_names,
            severityReason: null,
          }),
        )
      }
    } catch (err) {
      dispatch(
        messageAdded({
          role: 'assistant',
          content: "Sorry, I couldn't process that just now. Please try again.",
        }),
      )
    } finally {
      dispatch(chatFinished())
    }
  }
}
