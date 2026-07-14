import { Link } from 'react-router-dom';
import { MessageSquare, PenLine, Gamepad2, CreditCard, Info, Mail, FileText, Shield } from 'lucide-react';

const PRODUCT_LINKS = [
  { label: 'Chat', to: '/chat', icon: MessageSquare },
  { label: 'Co-Author', to: '/co-author', icon: PenLine },
  { label: 'Games', to: '/lobby', icon: Gamepad2 },
  { label: 'Pricing', to: '/pricing', icon: CreditCard },
];

const COMPANY_LINKS = [
  { label: 'About', to: '/about', icon: Info },
  { label: 'Contact', href: 'mailto:hello@projectvelvet.com', icon: Mail },
];

const LEGAL_LINKS = [
  { label: 'Terms of Service', to: '/terms', icon: FileText },
  { label: 'Privacy Policy', to: '/privacy', icon: Shield },
];

// TODO: replace href with real profile URL or remove
const SOCIAL_LINKS = [
  { label: 'X', href: '#' },
  { label: 'Instagram', href: '#' },
  { label: 'Discord', href: '#' },
  { label: 'TikTok', href: '#' },
];

const linkBase =
  'flex items-center gap-2 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded';

export function Footer() {
  return (
    <footer
      role="contentinfo"
      className="relative z-10 border-t mt-16"
      style={{
        background: 'rgba(6,13,31,0.92)',
        borderTopColor: 'rgba(255,255,255,0.07)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Link grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Product */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500 mb-4">
              Product
            </h3>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.label}>
                    <Link to={link.to} className={`${linkBase} text-gray-400 hover:text-white`}>
                      <Icon className="w-3.5 h-3.5 opacity-60" />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500 mb-4">
              Company
            </h3>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.label}>
                    {link.to ? (
                      <Link to={link.to} className={`${linkBase} text-gray-400 hover:text-white`}>
                        <Icon className="w-3.5 h-3.5 opacity-60" />
                        <span>{link.label}</span>
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className={`${linkBase} text-gray-400 hover:text-white`}
                      >
                        <Icon className="w-3.5 h-3.5 opacity-60" />
                        <span>{link.label}</span>
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500 mb-4">
              Legal
            </h3>
            <ul className="space-y-2.5">
              {LEGAL_LINKS.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.label}>
                    <Link to={link.to} className={`${linkBase} text-gray-400 hover:text-white`}>
                      <Icon className="w-3.5 h-3.5 opacity-60" />
                      <span>{link.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h3 className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500 mb-4">
              Connect
            </h3>
            <div className="flex flex-wrap gap-2">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 transition-all duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Brand wordmark */}
        <div className="mb-8">
          <span className="text-white text-sm font-bold tracking-[0.18em] uppercase">
            Project{' '}
            <span
              style={{
                background: 'linear-gradient(135deg,#c084fc,#f472b6,#c084fc)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Velvet
            </span>
          </span>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/[0.06]">
          <p className="text-gray-600 text-xs">
            &copy; {new Date().getFullYear()} Project Velvet. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link
              to="/terms"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 rounded"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 rounded"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
