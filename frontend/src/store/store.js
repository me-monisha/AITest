import { configureStore } from '@reduxjs/toolkit'
import deviationFormReducer from './deviationFormSlice'
import aiAssistantReducer from './aiAssistantSlice'

export const store = configureStore({
  reducer: {
    deviationForm: deviationFormReducer,
    aiAssistant: aiAssistantReducer,
  },
})
