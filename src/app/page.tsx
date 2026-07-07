import Link from 'next/link';
import { HardHat, CheckCircle2, FileText, Users, CalendarClock } from 'lucide-react';

const FEATURES = [
  {
    icon: CheckCircle2,
    title: 'Digital Safety Checklists',
    description: 'OSHA-aligned checklists your crew fills out on their phone — photos, GPS, and signatures included.',
  },
  {
    icon: FileText,
    title: 'Instant PDF Reports',
    description: 'One tap generates a branded, professional report ready to send to a GC or insurer.',
  },
  {
    icon: CalendarClock,
    title: 'Compliance Tracking',
    description: 'Never miss a license, training, or insurance renewal — automated email reminders before they lapse.',
  },
  {
    icon: Users,
    title: 'Team & Site Management',
    description: 'Role-based access for admins, supervisors, and crew — assign sites and control who sees what.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <HardHat className="h-6 w-6 text-brand-600" />
            <span className="text-lg font-bold">FieldDocs</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary">
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Replace Paper Safety Checklists <br className="hidden sm:block" /> with Digital Efficiency
        </h1>
        <p className="mt-6 text-lg text-gray-600">
          Built for roofing, electrical, and HVAC crews. Digital inspections, instant PDF reports, and compliance
          alerts — no more clipboards, no more missing paperwork.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Start Free Trial
          </Link>
          <span className="text-sm text-gray-500">14 days free · no card required</span>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="card">
              <Icon className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="card">
          <h2 className="text-2xl font-bold">$100<span className="text-base font-normal text-gray-500">/month</span></h2>
          <p className="mt-1 text-sm text-gray-500">Flat rate. Unlimited sites, inspections, and team members.</p>
          <ul className="mt-6 space-y-2 text-left text-sm text-gray-700">
            {['Unlimited digital inspections', 'Unlimited PDF reports', 'Compliance reminders', 'Unlimited team members', '14-day free trial'].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-status-green" />
                  {item}
                </li>
              )
            )}
          </ul>
          <Link href="/signup" className="btn-primary mt-6 w-full">
            Start Free Trial
          </Link>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} FieldDocs. All rights reserved.
      </footer>
    </div>
  );
}
