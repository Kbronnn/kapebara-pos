import React from 'react';
import { createRoot } from 'react-dom/client';
import CustomerApp from './CustomerApp';
import '../css/customer.css';

const root = createRoot(document.getElementById('customer-root'));
root.render(<CustomerApp />);
