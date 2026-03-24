import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// epub.js creates internal rendering state that is not stable under
// development-time double mounting, so keep the root render single-pass.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
