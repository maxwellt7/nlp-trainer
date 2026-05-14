import LegalPageShell from '../components/LegalPageShell';

const sectionHeading: React.CSSProperties = {
  color: '#F1F5F9',
  fontSize: 20,
  fontWeight: 600,
  margin: '32px 0 12px',
  letterSpacing: '-0.01em',
};

const subHeading: React.CSSProperties = {
  color: '#E2E8F0',
  fontSize: 16,
  fontWeight: 600,
  margin: '20px 0 8px',
};

const listStyle: React.CSSProperties = {
  paddingLeft: 22,
  margin: '8px 0 12px',
};

export default function Privacy() {
  return (
    <LegalPageShell title="Privacy Policy" effectiveDate="May 14, 2026">
      <p>
        This Privacy Policy explains how GrowthGods, LLC (&ldquo;GrowthGods,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
        collects, uses, and shares information about you when you use the Alignment Engine product available at
        heart.sovereignty.app and any related applications, websites, or services (collectively, the &ldquo;Service&rdquo;).
      </p>
      <p>
        By using the Service, you agree to the practices described in this policy. If you do not agree, please do not
        use the Service.
      </p>

      <h2 style={sectionHeading}>1. Information We Collect</h2>

      <h3 style={subHeading}>Information you provide</h3>
      <ul style={listStyle}>
        <li><strong>Account information.</strong> Name, email address, password (managed via Clerk), and profile details.</li>
        <li><strong>Subscription and billing information.</strong> If you purchase a paid plan, our payment processor
          (e.g., Stripe) collects your payment method details. We do not store full card numbers.</li>
        <li><strong>Content you submit.</strong> Messages, journal entries, identity declarations, intentions, quiz
          responses, audio recordings or transcripts you upload, and other content you create while using the Service.</li>
        <li><strong>Communications.</strong> Information you provide when contacting support or responding to surveys.</li>
      </ul>

      <h3 style={subHeading}>Information collected automatically</h3>
      <ul style={listStyle}>
        <li><strong>Usage data.</strong> Pages viewed, features used, session activity, click events, and approximate
          time spent in the Service.</li>
        <li><strong>Device and log data.</strong> IP address, browser type, operating system, device identifiers,
          referring URLs, and timestamps.</li>
        <li><strong>Cookies and similar technologies.</strong> Used for authentication, session persistence,
          preferences, and analytics. You can control cookies through your browser settings, though some features may
          not function without them.</li>
      </ul>

      <h3 style={subHeading}>Information from third parties</h3>
      <ul style={listStyle}>
        <li>Authentication providers (e.g., Clerk, Google) when you sign in.</li>
        <li>Analytics and advertising partners (e.g., Meta Pixel) that may share campaign attribution data.</li>
      </ul>

      <h2 style={sectionHeading}>2. How We Use Information</h2>
      <ul style={listStyle}>
        <li>Provide, operate, and improve the Service, including personalized coaching, hypnosis sessions, identity
          tools, and progress tracking.</li>
        <li>Process payments and manage subscriptions.</li>
        <li>Generate AI-assisted responses using third-party large language model providers (currently Anthropic,
          OpenAI, Google Gemini, and Meta Llama via partner APIs). Your inputs are transmitted to these providers
          solely to fulfill your request.</li>
        <li>Communicate with you about your account, updates, security alerts, and (with your consent) marketing.</li>
        <li>Detect, investigate, and prevent fraud, abuse, or violations of our Terms of Service.</li>
        <li>Comply with legal obligations and enforce our agreements.</li>
        <li>Conduct analytics and research to improve the Service, in aggregated or de-identified form where possible.</li>
      </ul>

      <h2 style={sectionHeading}>3. How We Share Information</h2>
      <p>We do not sell your personal information. We share information only as described below:</p>
      <ul style={listStyle}>
        <li><strong>Service providers.</strong> Vendors that help us operate the Service, including hosting (Railway,
          Vercel), authentication (Clerk), payment processing (Stripe), email delivery, analytics, and AI model
          providers (Anthropic, OpenAI, Google, and partners offering Llama-family models). These vendors process data
          on our behalf under contractual confidentiality obligations.</li>
        <li><strong>Legal and safety.</strong> When required by law, subpoena, or to protect the rights, safety, or
          property of GrowthGods, our users, or others.</li>
        <li><strong>Business transfers.</strong> In connection with a merger, acquisition, financing, or sale of
          assets, subject to standard confidentiality protections.</li>
        <li><strong>With your consent.</strong> When you direct us to share information with a third party.</li>
      </ul>

      <h2 style={sectionHeading}>4. AI Processing and Sensitive Content</h2>
      <p>
        The Service includes AI-driven self-coaching, conversational hypnosis, and identity-alignment tools. By using
        these features, you understand that:
      </p>
      <ul style={listStyle}>
        <li>Content you submit is transmitted to third-party AI providers to generate responses.</li>
        <li>AI responses are generated by automated systems and are not a substitute for professional medical,
          psychological, legal, financial, or other expert advice.</li>
        <li>You should not submit information that you do not want processed by automated systems, and you should not
          submit information about other identifiable individuals without their consent.</li>
      </ul>

      <h2 style={sectionHeading}>5. Data Retention</h2>
      <p>
        We retain personal information for as long as your account is active and for a reasonable period after to
        comply with legal obligations, resolve disputes, and enforce our agreements. You may delete your account at any
        time, after which we will delete or de-identify your personal information, except where retention is required
        by law.
      </p>

      <h2 style={sectionHeading}>6. Security</h2>
      <p>
        We use administrative, technical, and physical safeguards designed to protect your information, including
        encrypted transport (TLS), encrypted authentication tokens, and access controls. No method of transmission or
        storage is completely secure, however, and we cannot guarantee absolute security.
      </p>

      <h2 style={sectionHeading}>7. Your Rights and Choices</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or port your personal information,
        and to object to or restrict certain processing. You can exercise these rights by emailing us at the address
        below. We will respond within the timelines required by applicable law.
      </p>
      <p>
        Residents of California, the EEA, the UK, and certain other jurisdictions may have additional rights under
        applicable privacy laws (including the CCPA/CPRA and the GDPR). We do not knowingly sell or &ldquo;share&rdquo;
        personal information for cross-context behavioral advertising as those terms are defined under California law.
      </p>

      <h2 style={sectionHeading}>8. Children</h2>
      <p>
        The Service is not directed to children under 16, and we do not knowingly collect personal information from
        children under 16. If you believe a child has provided us with personal information, please contact us so we
        can delete it.
      </p>

      <h2 style={sectionHeading}>9. International Users</h2>
      <p>
        We operate in the United States. If you access the Service from outside the U.S., you understand that your
        information will be transferred to, stored, and processed in the U.S. and other countries where our service
        providers operate. Where required, we rely on appropriate transfer mechanisms such as Standard Contractual
        Clauses.
      </p>

      <h2 style={sectionHeading}>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. The updated version will be indicated by a revised
        &ldquo;Effective&rdquo; date at the top of this page. Material changes will be communicated through the Service
        or by email.
      </p>

      <h2 style={sectionHeading}>11. Contact Us</h2>
      <p>
        Questions about this Privacy Policy or our privacy practices can be directed to:
      </p>
      <p>
        GrowthGods, LLC<br />
        95067 Rainbow Acres Rd<br />
        Fernandina Beach, FL 32034<br />
        Email: <a href="mailto:max@maxwellmayes.com" style={{ color: '#D4A853' }}>max@maxwellmayes.com</a>
      </p>
    </LegalPageShell>
  );
}
