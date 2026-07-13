import React from 'react';
import { createRoot } from 'react-dom/client';
import { DesignAssistantWindow } from './DesignAssistantWindow';

const el = document.getElementById('assistant-root');
if (el) createRoot(el).render(<DesignAssistantWindow />);
