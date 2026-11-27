import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import CustomerChat from './CustomerChat.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {window.location.pathname.startsWith('/chat/') ? <CustomerChat /> : <App />}
  </StrictMode>,
)
