import LegalPageShell from '../components/LegalPageShell';

const sectionHeading: React.CSSProperties = {
  color: '#F1F5F9',
  fontSize: 20,
  fontWeight: 600,
  margin: '32px 0 12px',
  letterSpacing: '-0.01em',
};

const listStyle: React.CSSProperties = {
  paddingLeft: 22,
  margin: '8px 0 12px',
};

export default function Terms() {
  return (
    <LegalPageShell title="Terms of Service" effectiveDate="May 14, 2026">
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Alignment Engine product
        available at heart.sovereignty.app and any related applications, websites, or services (collectively, the
        &ldquo;Service&rdquo;) provided by GrowthGods, LLC (&ldquo;GrowthGods,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo;
        or &ldquo;our&rdquo;).
      </p>
      <p>
        By creating an account, accessing, or using the Service, you agree to these Terms and to our Privacy Policy.
        If you do not agree, do not use the Service.
      </p>

      <h2 style={sectionHeading}>1. Eligibility</h2>
      <p>
        You must be at least 18 years old (or the age of majority in your jurisdiction) to use the Service. By using
        the Service, you represent that you meet this requirement and that you have the legal capacity to enter into
        these Terms.
      </p>

      <h2 style={sectionHeading}>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity that
        occurs under your account. You agree to provide accurate information, keep it current, and promptly notify us
        of any unauthorized access. We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2 style={sectionHeading}>3. The Service</h2>
      <p>
        The Service provides AI-assisted self-coaching tools, including conversational hypnosis sessions, identity
        alignment exercises, journaling, audio playback, training content, and progress tracking. Features may change,
        be added, or be removed at our discretion.
      </p>

      <h2 style={sectionHeading}>4. Not Medical, Psychological, or Professional Advice</h2>
      <p>
        The Service is intended for informational, educational, and personal-development purposes only. It is{' '}
        <strong>not</strong> medical, psychological, psychiatric, therapeutic, legal, financial, or other professional
        advice or treatment, and it is not a substitute for the advice of a licensed professional.
      </p>
      <p>
        Do not use the Service if you have, or believe you may have, a condition that requires professional care. If
        you are experiencing a mental-health crisis, are at risk of harming yourself or others, or need urgent care,
        contact your local emergency services or a qualified professional immediately.
      </p>
      <p>
        Hypnosis, guided audio, and similar content may not be appropriate for individuals with epilepsy, certain
        dissociative or psychotic disorders, or other conditions. Do not engage with such content while driving,
        operating machinery, or performing any activity that requires alert attention.
      </p>

      <h2 style={sectionHeading}>5. Subscriptions, Billing, and Refunds</h2>
      <ul style={listStyle}>
        <li>Paid plans are billed in advance on a recurring basis (e.g., monthly or annual) through our payment
          processor.</li>
        <li>Subscriptions automatically renew at the then-current price until canceled. You can cancel at any time
          from your account settings or by contacting support; cancellation takes effect at the end of the current
          billing period.</li>
        <li>Except where required by law, payments are non-refundable. We may offer refunds or credits at our
          discretion.</li>
        <li>We may change pricing prospectively. Material price changes will be communicated in advance.</li>
      </ul>

      <h2 style={sectionHeading}>6. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul style={listStyle}>
        <li>Use the Service for any unlawful, harmful, deceptive, or abusive purpose.</li>
        <li>Attempt to bypass authentication, rate limits, or other access controls.</li>
        <li>Reverse engineer, decompile, or attempt to extract source code, model weights, or proprietary prompts,
          except as expressly permitted by law.</li>
        <li>Scrape, crawl, or automate the Service in ways that materially burden our infrastructure.</li>
        <li>Submit content that infringes third-party rights, violates privacy, or is unlawful, defamatory,
          harassing, or otherwise objectionable.</li>
        <li>Use the Service to generate content intended to harass, defraud, or harm any person.</li>
        <li>Resell, sublicense, or commercially exploit the Service without our written consent.</li>
      </ul>

      <h2 style={sectionHeading}>7. Your Content</h2>
      <p>
        You retain ownership of content you submit to the Service (&ldquo;Your Content&rdquo;). You grant GrowthGods a
        worldwide, non-exclusive, royalty-free license to host, store, transmit, process, and display Your Content
        solely to operate and improve the Service. We do not use Your Content to train third-party foundation models
        on your behalf.
      </p>
      <p>
        You are solely responsible for Your Content and represent that you have all rights necessary to submit it and
        grant the license above.
      </p>

      <h2 style={sectionHeading}>8. AI-Generated Output</h2>
      <p>
        The Service uses third-party AI models to generate responses. Outputs may be inaccurate, incomplete, or
        unsuitable for your purposes. You are responsible for evaluating outputs before acting on them and for
        complying with applicable laws when using or sharing them.
      </p>
      <p>
        Subject to your compliance with these Terms, GrowthGods assigns to you all rights it holds in outputs
        generated specifically for your account, to the extent assignable. Outputs may be similar or identical to
        those generated for other users, and we make no representation of exclusivity.
      </p>

      <h2 style={sectionHeading}>9. Intellectual Property</h2>
      <p>
        The Service, including its software, interfaces, content (other than Your Content), trademarks, and logos, is
        owned by GrowthGods or its licensors and is protected by intellectual-property laws. Except for the limited
        rights granted in these Terms, no rights are transferred to you.
      </p>

      <h2 style={sectionHeading}>10. Third-Party Services</h2>
      <p>
        The Service integrates with third-party services (including authentication, payments, analytics, and AI model
        providers). Your use of those services is governed by their own terms and privacy policies, and we are not
        responsible for them.
      </p>

      <h2 style={sectionHeading}>11. Termination</h2>
      <p>
        You may stop using the Service and delete your account at any time. We may suspend or terminate your access at
        any time, with or without notice, for any reason, including violation of these Terms or to protect the
        Service, our users, or third parties. Sections that by their nature should survive termination will do so.
      </p>

      <h2 style={sectionHeading}>12. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE,&rdquo; WITHOUT WARRANTIES OF ANY KIND,
        WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
        PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE. WE DO NOT
        WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT AI OUTPUTS WILL BE ACCURATE OR
        RELIABLE.
      </p>

      <h2 style={sectionHeading}>13. Limitation of Liability</h2>
      <p>
        TO THE FULLEST EXTENT PERMITTED BY LAW, GROWTHGODS AND ITS AFFILIATES, OFFICERS, EMPLOYEES, AND AGENTS WILL
        NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOSS
        OF PROFITS, REVENUE, DATA, GOODWILL, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO THE SERVICE.
      </p>
      <p>
        OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF
        (A) THE AMOUNTS YOU PAID TO US FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO
        THE CLAIM AND (B) ONE HUNDRED U.S. DOLLARS ($100). SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION
        OF CERTAIN DAMAGES, SO THESE LIMITATIONS MAY NOT APPLY TO YOU.
      </p>

      <h2 style={sectionHeading}>14. Indemnification</h2>
      <p>
        You agree to defend, indemnify, and hold harmless GrowthGods and its affiliates from and against any claims,
        damages, liabilities, and expenses (including reasonable attorneys&rsquo; fees) arising out of or related to
        (a) your use of the Service, (b) Your Content, or (c) your violation of these Terms or applicable law.
      </p>

      <h2 style={sectionHeading}>15. Governing Law and Disputes</h2>
      <p>
        These Terms are governed by the laws of the State of Florida, without regard to its conflict-of-laws rules.
        The parties consent to the exclusive jurisdiction of the state and federal courts located in Nassau County,
        Florida for any dispute not subject to arbitration.
      </p>
      <p>
        Any dispute arising out of or relating to these Terms or the Service will be resolved through binding
        individual arbitration administered by the American Arbitration Association under its Consumer Arbitration
        Rules, except that either party may bring an individual claim in small-claims court. <strong>You and
        GrowthGods waive any right to a jury trial and to participate in a class action.</strong> You may opt out of
        this arbitration provision by emailing the address below within 30 days of first accepting these Terms.
      </p>

      <h2 style={sectionHeading}>16. Changes to These Terms</h2>
      <p>
        We may update these Terms from time to time. The updated version will be indicated by a revised
        &ldquo;Effective&rdquo; date at the top of this page. Material changes will be communicated through the
        Service or by email. Continued use of the Service after changes take effect constitutes acceptance.
      </p>

      <h2 style={sectionHeading}>17. Miscellaneous</h2>
      <p>
        These Terms, together with our Privacy Policy, constitute the entire agreement between you and GrowthGods
        regarding the Service. If any provision is held unenforceable, the remaining provisions will remain in full
        force and effect. Our failure to enforce a right or provision is not a waiver. You may not assign these Terms
        without our written consent; we may assign them in connection with a corporate transaction.
      </p>

      <h2 style={sectionHeading}>18. Contact Us</h2>
      <p>
        Questions about these Terms can be directed to:
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
