import client from './client'

export async function extractFromDocument(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post('/ai/extract/document', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.job_id
}

export async function extractFromText(text) {
  const { data } = await client.post('/ai/extract/text', { text })
  return data.job_id
}

/**
 * Opens an SSE connection to watch extraction progress, invoking callbacks
 * as events arrive. Returns a cleanup function.
 */
export function watchExtractionJob(jobId, { onProgress, onDone, onError }) {
  const source = new EventSource(`/api/ai/extract/${jobId}/stream`)

  source.onmessage = (event) => {
    const job = JSON.parse(event.data)
    if (job.status === 'error') {
      onError?.(job.error || 'Extraction failed.')
      source.close()
      return
    }
    onProgress?.(job)
    if (job.status === 'done') {
      onDone?.(job.result)
      source.close()
    }
  }

  source.onerror = () => {
    onError?.('Lost connection to the extraction service.')
    source.close()
  }

  return () => source.close()
}

export async function sendChatMessage(message, currentFields, history) {
  const { data } = await client.post('/ai/chat', {
    message,
    current_fields: currentFields,
    history,
  })
  return data
}

export async function saveDeviation(payload) {
  const { data } = await client.post('/deviations', payload)
  return data
}

export async function listDeviations() {
  const { data } = await client.get('/deviations')
  return data
}
