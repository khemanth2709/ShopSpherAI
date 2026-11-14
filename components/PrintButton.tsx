'use client';

import { Printer } from 'lucide-react';
export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white"><Printer size={15}/> Print / Save PDF</button>;
}
