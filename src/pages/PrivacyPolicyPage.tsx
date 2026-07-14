import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Mail } from 'lucide-react';
import { Footer } from '../components/Footer';

const SECTIONS = [
  { id: 'introduction', num: '1', title: 'Introduction' },
  { id: 'information-we-collect', num: '2', title: 'Information We Collect' },
  { id: 'how-we-use', num: '3', title: 'How We Use Your Information' },
  { id: 'automated-analysis', num: '4', title: 'Automated Analysis and Profiling' },
  { id: 'ai-models', num: '5', title: 'AI Models and Your Content' },
  { id: 'information-sharing', num: '6', title: 'Information Sharing and Disclosure' },
  { id: 'data-security', num: '7', title: 'Data Security' },
  { id: 'data-retention', num: '8', title: 'Data Retention and Deletion' },
  { id: 'your-rights', num: '9', title: 'Your Rights and Choices' },
  { id: 'cookies', num: '10', title: 'Cookies and Tracking' },
  { id: 'childrens-privacy', num: '11', title: "Children's Privacy" },
  { id: 'international-transfers', num: '12', title: 'International Data Transfers' },
  { id: 'changes', num: '13', title: 'Changes to This Privacy Policy' },
  { id: 'contact', num: '14', title: 'Contact Us' },
];

const SUBPROCESSORS = [
  { provider: 'Anthropic', purpose: 'AI model processing' },
  { provider: 'Stripe', purpose: 'Payment processing' },
  { provider: 'Supabase', purpose: 'Database, authentication, hosting' },
];

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('introduction');

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 100;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -70% 0px', threshold: 0 },
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)',
      }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.08) 0%, transparent 50%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-200/60 hover:text-white transition-colors duration-200 mb-8 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Hero header */}
        <div
          className="rounded-3xl p-8 md:p-12 mb-8"
          style={{
            background: 'rgba(13,15,55,0.82)',
            border: '1px solid rgba(100,120,255,0.28)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #3b5bdb 0%, #4c6ef5 100%)',
                boxShadow: '0 4px 24px rgba(66,99,235,0.40)',
              }}
            >
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-blue-200/60 text-sm font-medium tracking-wide uppercase">
              Legal
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-blue-200/60 text-sm">
            Last Updated: January 28, 2026
          </p>
        </div>

        {/* Main layout: TOC + content */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Table of contents sidebar */}
          <aside className="lg:w-64 lg:flex-shrink-0 lg:sticky lg:top-8 lg:self-start">
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              <h2 className="text-xs font-semibold text-blue-200/50 uppercase tracking-wider mb-3">
                Contents
              </h2>
              <nav className="flex flex-col gap-0.5 max-h-[60vh] lg:max-h-[calc(100vh-12rem)] overflow-y-auto">
                {SECTIONS.map(({ id, num, title }) => (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className={`text-left text-sm px-3 py-2 rounded-lg transition-all duration-200 flex items-start gap-2 ${
                      activeSection === id
                        ? 'text-white'
                        : 'text-blue-200/50 hover:text-blue-200/80'
                    }`}
                    style={
                      activeSection === id
                        ? { background: 'rgba(100,120,255,0.15)' }
                        : undefined
                    }
                  >
                    <span className="font-mono text-xs mt-0.5 opacity-50">
                      {num}
                    </span>
                    <span className="leading-snug">{title}</span>
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div
            className="flex-1 rounded-3xl p-6 md:p-10 lg:p-12"
            style={{
              background: 'rgba(13,15,55,0.82)',
              border: '1px solid rgba(100,120,255,0.28)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div className="space-y-12">
              {/* 1. Introduction */}
              <section id="introduction" className="scroll-mt-24">
                <SectionHeading num="1" title="Introduction" />
                <BodyText>
                  Project Velvet ("we," "our," or "us") is committed to protecting
                  your privacy. This Privacy Policy explains how we collect, use,
                  disclose, and safeguard your information when you use Project
                  Velvet (the "Service"). It applies to all users of the Service.
                </BodyText>
                <BodyText>
                  Project Velvet is an interactive AI platform. When you use the
                  Service, you are communicating with artificial intelligence — not
                  human beings. Your interactions generate personal information, some
                  of which may be intimate or sensitive. Please read this Policy
                  carefully so you understand how that information is handled.
                </BodyText>
                <BodyText>
                  By using the Service, you agree to the collection and use of
                  information in accordance with this Policy.
                </BodyText>
              </section>

              {/* 2. Information We Collect */}
              <section id="information-we-collect" className="scroll-mt-24">
                <SectionHeading num="2" title="Information We Collect" />

                <SubHeading num="2.1" title="Information You Provide" />
                <BulletList
                  items={[
                    [
                      <strong key="a">Account data:</strong>,
                      ' email address and authentication credentials.',
                    ],
                    [
                      <strong key="b">Age verification:</strong>,
                      ' your date of birth, used solely to confirm you are 18 or older. We store the fact of verification and the date of birth you provided.',
                    ],
                    [
                      <strong key="c">Profile and personalization data:</strong>,
                      ' name, preferences, interests, and the questionnaire responses you give during onboarding.',
                    ],
                    [
                      <strong key="d">Companion and content data:</strong>,
                      ' the companions, coaches, and agents you create; their configurations; and the messages, conversations, images, documents, and other content you exchange with them or create within the Service.',
                    ],
                    [
                      <strong key="e">Payment information:</strong>,
                      ' processed securely by our payment processor (Stripe). We do not store full card numbers on our systems.',
                    ],
                    [
                      <strong key="f">Support communications:</strong>,
                      ' information you provide when you contact us.',
                    ],
                  ]}
                />

                <SubHeading num="2.2" title="Information We Collect Automatically" />
                <BulletList
                  items={[
                    'Device and browser information (type, operating system, settings).',
                    'Usage data (features used, session duration, interaction patterns).',
                    'IP address and approximate location derived from it.',
                    'Cookies and similar technologies (see Section 10).',
                  ]}
                />

                <SubHeading num="2.3" title="Sensitive Information" />
                <BodyText>
                  Because the Service supports companion, coaching, and expert-agent
                  interactions, the content you generate may reveal sensitive
                  information — including data about your health or mental state,
                  sexual orientation or activity, religious or political views, and
                  details of your personal relationships. We treat this content as
                  sensitive / special-category personal information and apply
                  heightened protections to it. We process it only to provide the
                  Service to you and only on the basis of your explicit consent, which
                  you may withdraw at any time by deleting the relevant content or your
                  account (see Section 8).
                </BodyText>
              </section>

              {/* 3. How We Use Your Information */}
              <section id="how-we-use" className="scroll-mt-24">
                <SectionHeading num="3" title="How We Use Your Information" />
                <BodyText>We use the information we collect to:</BodyText>
                <BulletList
                  items={[
                    'Provide, operate, personalize, and maintain the Service, including your companions\' memory and continuity across features.',
                    'Verify your age and eligibility to use the Service.',
                    'Process transactions and manage your subscription.',
                    'Generate the personalized features you request, such as curated feeds and Insights (see Section 4 regarding automated analysis).',
                    'Send you technical notices, security alerts, and support messages.',
                    'Detect, prevent, and address fraud, abuse, and security issues.',
                    'Comply with legal obligations and enforce our Terms of Service.',
                  ]}
                />
              </section>

              {/* 4. Automated Analysis and Profiling */}
              <section id="automated-analysis" className="scroll-mt-24">
                <SectionHeading
                  num="4"
                  title="Automated Analysis and Profiling"
                />
                <BodyText>
                  Certain features — including Insights and the memory systems that
                  power your companions — automatically analyze your content to
                  identify patterns, recall prior context, and personalize your
                  experience. This constitutes profiling. This analysis is used only
                  to operate the features you engage with and to personalize the
                  Service. We do not use it to make legally significant automated
                  decisions about you (such as decisions affecting credit, employment,
                  or insurance). You can limit this processing by not using the
                  relevant features or by deleting your data.
                </BodyText>
              </section>

              {/* 5. AI Models and Your Content */}
              <section id="ai-models" className="scroll-mt-24">
                <SectionHeading num="5" title="AI Models and Your Content" />
                <BodyText>
                  Your companion and content interactions are processed by third-party
                  AI model providers (including Anthropic) to generate responses.
                </BodyText>
                <Callout>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    <strong className="text-white">
                      We do not sell your conversations, and we do not use the content
                      of your private companion interactions to train foundation models.
                    </strong>{' '}
                    We instruct our AI providers to process your content solely to
                    generate responses for you and not to use it to train their general
                    models, to the extent supported by our agreements with them. We may
                    use aggregated or de-identified data — which cannot reasonably be
                    used to identify you — to improve the quality, safety, and
                    performance of the Service. If we ever wish to use identifiable
                    content to train or fine-tune our own models, we will obtain your
                    separate, explicit consent first.
                  </p>
                </Callout>
              </section>

              {/* 6. Information Sharing and Disclosure */}
              <section id="information-sharing" className="scroll-mt-24">
                <SectionHeading
                  num="6"
                  title="Information Sharing and Disclosure"
                />
                <BodyText>
                  We do not sell your personal information. We share information only as
                  follows:
                </BodyText>

                <div className="space-y-4 mt-4">
                  <div>
                    <p className="text-blue-100/80 text-sm leading-relaxed mb-1">
                      <strong className="text-white">
                        Service Providers (Subprocessors).
                      </strong>{' '}
                      We share information with vendors who process it on our behalf
                      under contractual confidentiality and data-protection
                      obligations:
                    </p>

                    {/* Subprocessor table */}
                    <div
                      className="rounded-xl overflow-hidden mt-3"
                      style={{ border: '1px solid rgba(100,120,255,0.20)' }}
                    >
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'rgba(100,120,255,0.10)' }}>
                            <th className="text-left px-4 py-2.5 text-blue-200/60 font-semibold text-xs uppercase tracking-wider">
                              Provider
                            </th>
                            <th className="text-left px-4 py-2.5 text-blue-200/60 font-semibold text-xs uppercase tracking-wider">
                              Purpose
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {SUBPROCESSORS.map((s, i) => (
                            <tr
                              key={s.provider}
                              style={{
                                borderTop:
                                  i > 0
                                    ? '1px solid rgba(100,120,255,0.12)'
                                    : '1px solid rgba(100,120,255,0.20)',
                              }}
                            >
                              <td className="px-4 py-2.5 text-white font-medium">
                                {s.provider}
                              </td>
                              <td className="px-4 py-2.5 text-blue-100/70">
                                {s.purpose}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-blue-200/50 text-xs mt-2">
                      We may update this list as our infrastructure evolves; the
                      current list will be maintained on this page.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-100/80 text-sm leading-relaxed">
                      <strong className="text-white">Legal Requirements.</strong>{' '}
                      When required by law, subpoena, or governmental request, or to
                      protect the rights, safety, and property of Project Velvet, our
                      users, or others.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-100/80 text-sm leading-relaxed">
                      <strong className="text-white">Business Transfers.</strong> In
                      connection with a merger, acquisition, financing, or sale of
                      assets, subject to the protections of this Policy.
                    </p>
                  </div>

                  <div>
                    <p className="text-blue-100/80 text-sm leading-relaxed">
                      <strong className="text-white">With Your Consent.</strong> When
                      you direct us to share information.
                    </p>
                  </div>
                </div>
              </section>

              {/* 7. Data Security */}
              <section id="data-security" className="scroll-mt-24">
                <SectionHeading num="7" title="Data Security" />
                <BodyText>
                  We implement appropriate technical and organizational measures to
                  protect your information, including encryption of data in transit and
                  at rest, secure authentication, access controls, and monitoring. No
                  system is perfectly secure, and we cannot guarantee absolute security.
                  If we become aware of a data breach affecting your personal
                  information, we will notify you and the relevant authorities as
                  required by applicable law.
                </BodyText>
              </section>

              {/* 8. Data Retention and Deletion */}
              <section id="data-retention" className="scroll-mt-24">
                <SectionHeading num="8" title="Data Retention and Deletion" />
                <BodyText>
                  We retain your personal information for as long as your account is
                  active or as needed to provide the Service. When you delete specific
                  content (such as a conversation or a companion), we remove it —
                  including associated stored memories — from active systems promptly,
                  with residual copies purged from backups within 30 days.
                </BodyText>
                <BodyText>
                  When you delete your account, we delete or de-identify your personal
                  information within 30 days, except where we are required to retain
                  certain records (for example, transaction records for tax,
                  accounting, or legal-compliance purposes), which we retain only as
                  long as required and then delete.
                </BodyText>
              </section>

              {/* 9. Your Rights and Choices */}
              <section id="your-rights" className="scroll-mt-24">
                <SectionHeading num="9" title="Your Rights and Choices" />
                <BodyText>
                  Depending on where you live, you may have some or all of the following
                  rights: access, correction, deletion, portability, restriction of or
                  objection to processing, and withdrawal of consent. You may also opt
                  out of marketing communications at any time. Exercising these rights
                  will not result in discriminatory treatment.
                </BodyText>
                <BodyText>
                  To exercise any right, contact us at{' '}
                  <strong className="text-white">privacy@projectvelvet.com</strong>. We
                  will verify your request and respond within the timeframe required by
                  applicable law.
                </BodyText>

                <SubHeading num="9.1" title="European Economic Area / United Kingdom" />
                <BodyText>
                  If you are in the EEA or UK, we process your personal data on the
                  following legal bases: performance of our contract with you (to
                  provide the Service), your consent (for sensitive data and any
                  marketing), our legitimate interests (to secure and improve the
                  Service), and compliance with legal obligations. You have the right
                  to lodge a complaint with your local supervisory authority.
                </BodyText>

                <SubHeading num="9.2" title="California" />
                <BodyText>
                  If you are a California resident, you have the rights described above
                  under the CCPA/CPRA, including the right to know, delete, correct, and
                  to limit the use of sensitive personal information. We do not sell or
                  "share" (as defined under the CPRA) your personal information. We
                  honor Global Privacy Control (GPC) signals.
                </BodyText>
              </section>

              {/* 10. Cookies and Tracking */}
              <section id="cookies" className="scroll-mt-24">
                <SectionHeading num="10" title="Cookies and Tracking" />
                <BodyText>
                  We use cookies and similar technologies to operate the Service,
                  remember your preferences, and analyze usage. You can control cookies
                  through your browser settings; disabling some cookies may affect
                  functionality. Where your browser sends a Do Not Track or Global
                  Privacy Control signal, we honor it as required by applicable law.
                </BodyText>
              </section>

              {/* 11. Children's Privacy */}
              <section id="childrens-privacy" className="scroll-mt-24">
                <SectionHeading num="11" title="Children's Privacy" />
                <BodyText>
                  The Service is strictly for adults 18 and older. We require
                  date-of-birth verification at sign-up and do not knowingly collect
                  information from anyone under 18. If we learn we have collected
                  information from a person under 18, we will delete it and terminate
                  the account.
                </BodyText>
              </section>

              {/* 12. International Data Transfers */}
              <section id="international-transfers" className="scroll-mt-24">
                <SectionHeading num="12" title="International Data Transfers" />
                <BodyText>
                  We operate in the United States, and your information may be
                  transferred to and processed in the United States and other countries
                  whose data-protection laws may differ from your own. Where required,
                  we rely on appropriate safeguards (such as Standard Contractual
                  Clauses) to protect your information.
                </BodyText>
              </section>

              {/* 13. Changes to This Privacy Policy */}
              <section id="changes" className="scroll-mt-24">
                <SectionHeading
                  num="13"
                  title="Changes to This Privacy Policy"
                />
                <BodyText>
                  We may update this Privacy Policy from time to time. We will notify
                  you of material changes by posting the updated Policy on this page,
                  updating the "Last Updated" date, and, where required, providing
                  additional notice.
                </BodyText>
              </section>

              {/* 14. Contact Us */}
              <section id="contact" className="scroll-mt-24">
                <SectionHeading num="14" title="Contact Us" />
                <BodyText>
                  If you have questions about this Privacy Policy or wish to exercise
                  your rights, contact us at:
                </BodyText>
                <div
                  className="mt-4 rounded-2xl p-5 flex items-center gap-4"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #3b5bdb 0%, #4c6ef5 100%)',
                      boxShadow: '0 4px 16px rgba(66,99,235,0.30)',
                    }}
                  >
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm">
                      privacy@projectvelvet.com
                    </p>
                    <p className="text-blue-200/50 text-xs mt-0.5">
                      Subject: Privacy Inquiry
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function SectionHeading({ num, title }: { num: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      <span
        className="text-2xl md:text-3xl font-bold leading-none"
        style={{
          background: 'linear-gradient(135deg, #818cf8 0%, #c084fc 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {num}
      </span>
      <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function SubHeading({ num, title }: { num: string; title: string }) {
  return (
    <h3 className="text-base md:text-lg font-semibold text-blue-100/90 mt-6 mb-3">
      <span className="text-blue-200/50 font-mono text-sm mr-2">{num}</span>
      {title}
    </h3>
  );
}

function BodyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-blue-100/70 text-sm md:text-base leading-relaxed mb-4">
      {children}
    </p>
  );
}

function BulletList({
  items,
}: {
  items: (string | React.ReactNode[])[];
}) {
  return (
    <ul className="space-y-2.5 mb-4">
      {items.map((item, i) => (
        <li
          key={i}
          className="text-blue-100/70 text-sm md:text-base leading-relaxed flex gap-3"
        >
          <span
            className="flex-shrink-0 mt-2 w-1.5 h-1.5 rounded-full"
            style={{ background: 'rgba(129,140,248,0.60)' }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 mt-4"
      style={{
        background: 'rgba(100,120,255,0.08)',
        border: '1px solid rgba(100,120,255,0.20)',
      }}
    >
      {children}
    </div>
  );
}
