import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { isConfigured } from './lib/supabase';
import App from './App';
import ConfigMissing from './pages/auth/ConfigMissing';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{isConfigured ? <App /> : <ConfigMissing />}</React.StrictMode>
);
