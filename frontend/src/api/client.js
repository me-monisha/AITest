import axios from 'axios'

// Vite dev server proxies /api -> http://localhost:8000 (see vite.config.js)
const client = axios.create({
  baseURL: '/api',
})

export default client
