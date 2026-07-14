import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Mail } from 'lucide-react';

const SECTIONS = [
  { id: 'acceptance', num: '1', title: 'Acceptance of Terms' },
  { id: 'age-requirement', num: '2', title: 'Age Requirement' },
  { id: 'nature-of-service', num: '3', title: 'Nature of the Service' },
  { id: 'mature-content', num: '4', title: 'Mature Content and Relationships' },
  { id: 'user-accounts', num: '5', title: 'User Accounts' },
  { id: 'acceptable-use', num: '6', title: 'Acceptable Use' },
  { id: 'user-content', num: '7', title: 'User Content and License' },
  { id: 'copyright-dmca', num: '8', title: 'Copyright and DMCA' },
  { id: 'subscription', num: '9', title: 'Subscription and Payments' },
  { id: 'third-party', num: '10', title: 'Third-Party Services' },
  { id: 'intellectual-property', num: '11', title: 'Intellectual Property' },
  { id: 'warranties', num: '12', title: 'Disclaimer of Warranties' },
  { id: 'liability', num: '13', title: 'Limitation of Liability' },
  { id: 'indemnification', num: '14', title: 'Indemnification' },
  { id: 'termination', num: '15', title: 'Termination' },
  { id: 'governing-law', num: '16', title: 'Governing Law and Dispute Resolution' },
  { id: 'changes', num: '17', title: 'Changes to Terms' },
  { id: 'contact', num: '18', title: 'Contact Us' },
];

export default function TermsOfServicePage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('acceptance');

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
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span className="text-blue-200/60 text-sm font-medium tracking-wide uppercase">
              Legal
            </span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-3 tracking-tight">
            Terms of Service
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
              {/* 1. Acceptance of Terms */}
              <section id="acceptance" className="scroll-mt-24">
                <SectionHeading num="1" title="Acceptance of Terms" />
                <BodyText>
                  By accessing or using Project Velvet (the "Service"), you agree to
                  be bound by these Terms of Service ("Terms") and all applicable laws
                  and regulations. If you do not agree with any of these Terms, you are
                  prohibited from using or accessing the Service. These Terms
                  incorporate our Privacy Policy by reference.
                </BodyText>
              </section>

              {/* 2. Age Requirement */}
              <section id="age-requirement" className="scroll-mt-24">
                <SectionHeading num="2" title="Age Requirement" />
                <BodyText>
                  You must be at least 18 years of age to use Project Velvet. By using
                  the Service, you represent and warrant that you are at least 18 years
                  old and that the date-of-birth information you provided at
                  registration is accurate. We may suspend or terminate any account we
                  reasonably believe belongs to a person under 18.
                </BodyText>
              </section>

              {/* 3. Nature of the Service */}
              <section id="nature-of-service" className="scroll-mt-24">
                <SectionHeading
                  num="3"
                  title="Nature of the Service — Artificial Intelligence"
                />
                <BodyText>
                  Project Velvet is an AI platform. The companions, coaches, expert
                  agents, and other characters you interact with are artificial
                  intelligence — not real people, licensed professionals, or human
                  representatives — even when they adopt a persona, name, voice, or
                  area of expertise.
                </BodyText>
                <BulletList
                  items={[
                    [
                      <strong key="a" className="text-white">Not professional advice.</strong>,
                      ' Content generated by the Service, including from agents presented as experts (e.g., technical, financial, legal, or wellness personas), is for informational and entertainment purposes only and is not a substitute for advice from a qualified professional. Do not rely on it for professional, medical, legal, or financial decisions.',
                    ],
                    [
                      <strong key="b" className="text-white">Not a mental-health or crisis service.</strong>,
                      ' The Service is not a substitute for professional mental-health care and is not designed to respond to emergencies. If you are experiencing a crisis or considering self-harm, contact your local emergency services or a crisis hotline immediately.',
                    ],
                    [
                      <strong key="c" className="text-white">AI can be inaccurate.</strong>,
                      ' AI-generated content may be inaccurate, incomplete, or inappropriate. You are responsible for evaluating it before relying on it.',
                    ],
                  ]}
                />
              </section>

              {/* 4. Mature Content and Relationships */}
              <section id="mature-content" className="scroll-mt-24">
                <SectionHeading
                  num="4"
                  title="Mature Content and Relationships"
                />
                <BodyText>
                  Project Velvet is an adults-only service and may contain mature
                  themes and content. You acknowledge that:
                </BodyText>
                <BulletList
                  items={[
                    'Any relationship, emotional connection, or intimacy expressed by an AI companion is simulated and does not constitute a real human relationship.',
                    'You will not use the Service to generate, request, or distribute content that is illegal, including any content that sexualizes minors, depicts non-consensual acts presented as real, or violates any applicable law.',
                    'We may use automated and human moderation to enforce these standards.',
                  ]}
                />
              </section>

              {/* 5. User Accounts */}
              <section id="user-accounts" className="scroll-mt-24">
                <SectionHeading num="5" title="User Accounts" />
                <BodyText>
                  You are responsible for maintaining the confidentiality of your
                  account and password and for all activities that occur under your
                  account. You agree to:
                </BodyText>
                <BulletList
                  items={[
                    'Provide accurate and complete information during registration;',
                    'Maintain the security of your password and account;',
                    'Notify us immediately of any unauthorized use of your account.',
                  ]}
                />
              </section>

              {/* 6. Acceptable Use */}
              <section id="acceptable-use" className="scroll-mt-24">
                <SectionHeading num="6" title="Acceptable Use" />
                <BodyText>You agree not to use Project Velvet to:</BodyText>
                <BulletList
                  items={[
                    'Violate any laws or regulations;',
                    'Harass, abuse, or harm another person;',
                    'Generate or solicit illegal content, including any sexual content involving minors;',
                    'Impersonate any person or entity;',
                    'Upload or transmit viruses or malicious code;',
                    'Collect or store personal data about other users;',
                    'Engage in any automated or unauthorized access to the system, including scraping;',
                    'Attempt to bypass, disable, or reverse-engineer any security feature or usage limit;',
                    'Use outputs of the Service to develop a competing AI product.',
                  ]}
                />
              </section>

              {/* 7. User Content and License */}
              <section id="user-content" className="scroll-mt-24">
                <SectionHeading num="7" title="User Content and License" />
                <BodyText>
                  You retain ownership of the content you create through the Service
                  ("User Content"). You grant us a limited, worldwide, non-exclusive
                  license to host, store, process, and display your User Content solely
                  to operate and provide the Service to you. We reserve the right to
                  review, moderate, and remove User Content that violates these Terms,
                  and to suspend or terminate accounts accordingly.
                </BodyText>
              </section>

              {/* 8. Copyright and DMCA */}
              <section id="copyright-dmca" className="scroll-mt-24">
                <SectionHeading num="8" title="Copyright and DMCA" />
                <BodyText>
                  We respect intellectual property rights. If you believe content on
                  the Service infringes your copyright, send a notice to{' '}
                  <strong className="text-white">support@projectvelvet.com</strong>{' '}
                  including: identification of the copyrighted work, the location of
                  the allegedly infringing material, your contact information, and a
                  statement of good-faith belief. We will respond to valid notices and
                  may remove infringing material and terminate repeat infringers.
                </BodyText>
              </section>

              {/* 9. Subscription and Payments */}
              <section id="subscription" className="scroll-mt-24">
                <SectionHeading num="9" title="Subscription and Payments" />
                <BodyText>
                  Some features require a paid subscription. By subscribing, you agree
                  that:
                </BodyText>
                <BulletList
                  items={[
                    'You will pay all fees associated with your subscription;',
                    'You authorize us to charge your payment method on a recurring basis;',
                    'Subscriptions automatically renew at the end of each billing period unless you cancel before the renewal date;',
                    'You may cancel at any time; cancellation stops future renewals and takes effect at the end of the current billing period, and you retain access until then;',
                    'Except where required by law, fees are non-refundable, including for partial billing periods. Any discretionary refunds are handled on a case-by-case basis.',
                  ]}
                />
                <BodyText>
                  We may change our fees with reasonable advance notice; changes apply
                  to subsequent billing periods.
                </BodyText>
              </section>

              {/* 10. Third-Party Services */}
              <section id="third-party" className="scroll-mt-24">
                <SectionHeading num="10" title="Third-Party Services" />
                <BodyText>
                  The Service relies on third-party providers (including AI model
                  providers, payment processors, and hosting infrastructure) as
                  described in our Privacy Policy. We are not responsible for the
                  availability, acts, or omissions of these third parties, and their
                  services may be governed by their own terms.
                </BodyText>
              </section>

              {/* 11. Intellectual Property */}
              <section id="intellectual-property" className="scroll-mt-24">
                <SectionHeading num="11" title="Intellectual Property" />
                <BodyText>
                  All content, features, and functionality of Project Velvet — other
                  than User Content — including software, text, design, trademarks,
                  and logos, are owned by us or our licensors and are protected by
                  international copyright, trademark, and other intellectual-property
                  laws.
                </BodyText>
              </section>

              {/* 12. Disclaimer of Warranties */}
              <section id="warranties" className="scroll-mt-24">
                <SectionHeading num="12" title="Disclaimer of Warranties" />
                <BodyText>
                  The Service is provided "as is" and "as available" without
                  warranties of any kind, either express or implied, including
                  warranties of merchantability, fitness for a particular purpose, and
                  non-infringement. We do not warrant that the Service will be
                  uninterrupted, secure, error-free, or that any AI-generated content
                  will be accurate or reliable.
                </BodyText>
              </section>

              {/* 13. Limitation of Liability */}
              <section id="liability" className="scroll-mt-24">
                <SectionHeading num="13" title="Limitation of Liability" />
                <BodyText>
                  To the maximum extent permitted by law, in no event shall Project
                  Velvet be liable for any indirect, incidental, special, consequential,
                  or punitive damages, or for any loss of data, profits, or goodwill,
                  resulting from your use of or inability to use the Service. To the
                  maximum extent permitted by law, our total aggregate liability
                  arising out of or relating to the Service shall not exceed the
                  greater of the amount you paid us in the twelve (12) months
                  preceding the claim or USD $100.
                </BodyText>
              </section>

              {/* 14. Indemnification */}
              <section id="indemnification" className="scroll-mt-24">
                <SectionHeading num="14" title="Indemnification" />
                <BodyText>
                  You agree to indemnify and hold harmless Project Velvet and its
                  affiliates from any claims, damages, losses, and expenses (including
                  reasonable legal fees) arising out of your use of the Service, your
                  User Content, or your violation of these Terms.
                </BodyText>
              </section>

              {/* 15. Termination */}
              <section id="termination" className="scroll-mt-24">
                <SectionHeading num="15" title="Termination" />
                <BodyText>
                  We may terminate or suspend your account at our discretion, with or
                  without notice, for conduct that we believe violates these Terms or
                  is harmful to other users, us, or third parties, or as otherwise
                  permitted by law. Upon termination, your right to use the Service
                  ceases immediately. Sections that by their nature should survive
                  termination (including Sections 7, 11–14, and 16) will survive. Data
                  handling following termination is described in our Privacy Policy.
                </BodyText>
              </section>

              {/* 16. Governing Law and Dispute Resolution */}
              <section id="governing-law" className="scroll-mt-24">
                <SectionHeading
                  num="16"
                  title="Governing Law and Dispute Resolution"
                />
                <BodyText>
                  These Terms are governed by the laws of the State of [STATE], without
                  regard to its conflict-of-laws rules. Except where prohibited by law,
                  any dispute arising out of or relating to these Terms or the Service
                  shall be resolved by binding individual arbitration, and you and
                  Project Velvet waive the right to a jury trial and to participate in
                  a class action. You may opt out of arbitration by notifying us in
                  writing within 30 days of first accepting these Terms. Nothing in
                  this section prevents either party from seeking injunctive relief for
                  intellectual-property or unauthorized-use claims.
                </BodyText>
              </section>

              {/* 17. Changes to Terms */}
              <section id="changes" className="scroll-mt-24">
                <SectionHeading num="17" title="Changes to Terms" />
                <BodyText>
                  We may modify these Terms at any time. We will notify users of
                  material changes by posting the updated Terms and updating the "Last
                  Updated" date. Your continued use of the Service after changes take
                  effect constitutes acceptance of the revised Terms.
                </BodyText>
              </section>

              {/* 18. Contact Us */}
              <section id="contact" className="scroll-mt-24">
                <SectionHeading num="18" title="Contact Us" />
                <BodyText>
                  If you have any questions about these Terms of Service, please
                  contact us at:
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
                      support@projectvelvet.com
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
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
