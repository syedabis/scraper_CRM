"use client";
import { useRouter } from 'next/navigation';
import AppShell from './components/AppShell';

const tools = [
  {
    href: '/calling',
    icon: 'call',
    title: 'Calling Interface',
    description: 'Work through your lead queue and log call outcomes.',
    accent: 'primary',
  },
  {
    href: '/data-entry',
    icon: 'assignment',
    title: 'Data Entry',
    description: 'Manually add a new lead into the system.',
    accent: 'secondary',
  },
  {
    href: '/admin',
    icon: 'admin_panel_settings',
    title: 'Admin Panel',
    description: 'Review team performance and lead conversion stats.',
    accent: 'tertiary',
  },
];

const accentClasses = {
  primary: 'bg-primary-container text-on-primary-container group-hover:bg-primary group-hover:text-on-primary',
  secondary: 'bg-secondary-container text-on-secondary-container group-hover:bg-secondary group-hover:text-on-secondary',
  tertiary: 'bg-tertiary-container text-on-tertiary-container group-hover:bg-tertiary group-hover:text-on-tertiary',
};

export default function Home() {
  const router = useRouter();

  return (
    <AppShell title="Dashboard">
      <div className="flex flex-col gap-8">
        <div className="bg-surface-container rounded-xl border border-outline-variant p-8">
          <h1 className="text-headline-lg font-bold text-on-surface mb-2">DataCrumbs Sales Portal</h1>
          <p className="text-body-lg text-on-surface-variant">Internal Sales Management System</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <button
              key={tool.href}
              onClick={() => router.push(tool.href)}
              className="group text-left bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col gap-4 hover:border-primary hover:shadow-lg transition-all duration-200"
            >
              <span
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-colors duration-200 ${accentClasses[tool.accent]}`}
              >
                <span className="material-symbols-outlined text-2xl">{tool.icon}</span>
              </span>
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface mb-1">{tool.title}</h2>
                <p className="text-body-md text-on-surface-variant">{tool.description}</p>
              </div>
            </button>
          ))}

          <a
            href="https://payslips-bootcamp1-19de08d23749.herokuapp.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-surface-container rounded-xl border border-outline-variant p-6 flex flex-col gap-4 hover:border-secondary hover:shadow-lg transition-all duration-200"
          >
            <span className="w-12 h-12 rounded-lg flex items-center justify-center bg-secondary-container text-on-secondary-container group-hover:bg-secondary group-hover:text-on-secondary transition-colors duration-200">
              <span className="material-symbols-outlined text-2xl">receipt_long</span>
            </span>
            <div>
              <h2 className="text-headline-sm font-semibold text-on-surface mb-1">Send Invoice</h2>
              <p className="text-body-md text-on-surface-variant">Open the invoicing portal in a new tab.</p>
            </div>
          </a>
        </div>
      </div>
    </AppShell>
  );
}
