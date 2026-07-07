import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FieldDocs — Digital Safety & Compliance for Field Crews',
  description: 'Replace paper safety checklists with digital inspections, instant PDF reports, and compliance tracking.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
