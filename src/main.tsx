import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { registerSW } from 'virtual:pwa-register';
import { QueryProvider } from '@/contexts/QueryProvider';
import App from '@/App';
import '@/index.css';

// Service Worker'ı anında kaydet (PWA & Push bildirimleri için)
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryProvider>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              fontSize: '0.9rem',
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </QueryProvider>
    </BrowserRouter>
  </React.StrictMode>
);
