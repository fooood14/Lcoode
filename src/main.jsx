// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'          // تأكد أن App.jsx بجانب main.jsx
import './index.css'             // إذا كان لديك ملف CSS أساسي؛ وإلا احذفه

ReactDOM
  .createRoot(document.getElementById('root'))
  .render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
