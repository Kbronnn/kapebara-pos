import React from 'react';
import { createRoot } from 'react-dom/client';
import StaffApp from './StaffApp';
import '../css/styles.css';

const root = createRoot(document.getElementById('root'));
root.render(<StaffApp />);
