import type { Metadata } from "next";
import { CadaLogo } from "@/components/cada-logo";

export const metadata: Metadata = {
  title: "Privacy Policy | CADA Partners",
};

export default function PrivacyPage() {
  return (
    <div className="page-shell">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 pt-10">
        <CadaLogo href="/login" subtitle="Partners" size="md" />
      </div>

      <main className="px-5 pb-16 pt-10">
        <article className="legal-content mx-auto max-w-3xl">
          <header className="mb-8 border-b-2 border-border pb-8">
            <h1 className="mb-3 font-display text-3xl font-extrabold text-ink md:text-4xl">
              CADA Group LLC — Privacy Policy
            </h1>
            <p className="mb-4 text-sm text-ink-light">Last Updated: January 2026</p>
            <p>
              This Privacy Policy describes how CADA Group LLC (&quot;CADA,&quot; &quot;we,&quot;
              &quot;us,&quot; or &quot;our&quot;) collects, uses, stores, and shares personal
              information when you access or use our Services, including:
            </p>
            <ul>
              <li>The CADA mobile application</li>
              <li>Any website, app, or tool that links to this Privacy Policy</li>
              <li>Our marketing, sales, events, and communication channels</li>
            </ul>
            <p>If you do not agree with any part of this Privacy Policy, please do not use the Services.</p>
            <p>
              <strong>Contact:</strong> <a href="mailto:james@cadaapp.com">james@cadaapp.com</a>
            </p>
          </header>

          <section>
            <h2>1. INFORMATION WE COLLECT</h2>

            <h3>Information You Provide</h3>
            <p>
              We collect personal information you voluntarily provide when creating an account,
              using the Services, or communicating with us, including:
            </p>
            <ul>
              <li>Name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Username and password</li>
              <li>Location (city/state or general location)</li>
              <li>Habit-related information</li>
              <li>Profile picture</li>
            </ul>

            <h3>Sensitive Information</h3>
            <p>
              With your consent and where permitted by law, we may collect and process sensitive
              personal information, including:
            </p>
            <ul>
              <li>Health-related data (optional)</li>
              <li>Habit data that may be categorized as sensitive under applicable law</li>
              <li>Sexual orientation or sex-life data (optional)</li>
            </ul>
            <p>
              <strong>Important:</strong> Sensitive information is optional. Minors are not
              prompted to provide sexual orientation or sex-life data.
            </p>
            <p>
              Sensitive data is used only to provide and improve core app functionality,
              analytics, and communications, and is not used to identify users to other
              individuals.
            </p>

            <h3>Social Login Information</h3>
            <p>
              If you choose to register or log in using a third-party social platform (such as
              Facebook or Google), we receive certain profile information from that provider,
              such as your name, email address, and profile photo, depending on your settings
              with that service.
            </p>

            <h3>Application &amp; Device Permissions</h3>
            <p>With your permission, the app may access:</p>
            <ul>
              <li>Contacts</li>
              <li>Reminders</li>
              <li>Camera</li>
              <li>Camera Roll</li>
            </ul>
            <p>You may change or revoke permissions at any time through your device settings.</p>

            <h3>Information Automatically Collected</h3>
            <p>When you use the Services, we automatically collect:</p>
            <ul>
              <li>IP address</li>
              <li>Device and browser characteristics</li>
              <li>Operating system</li>
              <li>Language preferences</li>
              <li>Device identifiers</li>
              <li>Usage data (pages viewed, actions taken, timestamps)</li>
              <li>Crash logs and diagnostics</li>
            </ul>

            <h3>Device Data</h3>
            <p>
              Including hardware model, mobile carrier, system configuration, and general
              (non-precise) location data.
            </p>
          </section>

          <section>
            <h2>2. HOW WE USE YOUR INFORMATION</h2>
            <p>We use personal information to:</p>
            <ul>
              <li>Create and manage user accounts</li>
              <li>Provide social accountability and habit-tracking features</li>
              <li>Enable communication and accountability between users</li>
              <li>Deliver AI-powered features when explicitly used</li>
              <li>Send transactional messages, marketing communications, and push notifications</li>
              <li>Perform analytics, research, and internal reporting</li>
              <li>Support advertising and promotional activities (first-party and, where applicable, third-party)</li>
              <li>Ensure security, prevent fraud, and maintain platform safety</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>3. LEGAL BASES FOR PROCESSING (EEA / UK / CANADA)</h2>
            <p>Where required by law, we process personal information based on:</p>
            <ul>
              <li>User consent</li>
              <li>Performance of a contract</li>
              <li>Legitimate business interests</li>
              <li>Legal obligations</li>
              <li>Protection of vital interests</li>
            </ul>
          </section>

          <section>
            <h2>4. DATA SHARING &amp; DISCLOSURE</h2>
            <p>We may share personal information with:</p>
            <ul>
              <li>Cloud hosting and infrastructure providers</li>
              <li>Analytics providers (including Google Analytics and Firebase)</li>
              <li>Customer support and communications tools</li>
              <li>Marketing and advertising partners</li>
              <li>AI service providers</li>
            </ul>

            <h3>Advertising</h3>
            <p>
              Habit and usage data may be used for first-party marketing and advertising. In the
              future, we may engage third-party advertising partners. We do not disclose users&apos;
              real names to random individuals or advertisers.
            </p>
            <p>
              Some state privacy laws classify targeted advertising and analytics as
              &quot;selling&quot; or &quot;sharing.&quot; Where applicable, users may opt out.
            </p>

            <h3>Business Transfers</h3>
            <p>Information may be disclosed in connection with a merger, acquisition, financing, or sale of assets.</p>
          </section>

          <section>
            <h2>4A. AGGREGATED &amp; ANONYMIZED DATA</h2>
            <p>We may sell, license, or share aggregated and anonymized data derived from user activity.</p>
            <p>This data:</p>
            <ul>
              <li>Has personal identifiers removed</li>
              <li>Cannot reasonably be linked to an individual</li>
              <li>Includes safeguards against re-identification</li>
            </ul>
            <p>Examples include:</p>
            <ul>
              <li>Location-based usage trends</li>
              <li>Habit completion patterns</li>
              <li>Engagement metrics</li>
              <li>Demographic group insights (non-identifiable)</li>
            </ul>
            <p>This processing is mandatory but anonymized.</p>
          </section>

          <section>
            <h2>5. THIRD-PARTY SERVICES</h2>
            <p>
              We are not responsible for the privacy practices of third-party websites, services,
              or applications linked to or integrated with our Services.
            </p>
          </section>

          <section>
            <h2>6. COOKIES, SDKs &amp; TRACKING TECHNOLOGIES</h2>
            <p>We use cookies, mobile SDKs, and similar technologies to:</p>
            <ul>
              <li>Maintain app functionality</li>
              <li>Save user preferences</li>
              <li>Analyze usage and performance</li>
              <li>Support advertising and marketing</li>
            </ul>

            <h3>Analytics &amp; Tracking</h3>
            <p>
              We use Google Analytics and Firebase for first-party analytics. On iOS devices, we
              display an App Tracking Transparency (ATT) prompt. If users decline tracking, the
              app will continue to function normally, and only first-party analytics will be
              collected.
            </p>
          </section>

          <section>
            <h2>7. AI-POWERED FEATURES</h2>
            <p>CADA offers optional AI-powered features that are activated only when users explicitly prompt them.</p>
            <p>When used:</p>
            <ul>
              <li>User inputs are summarized and converted into derived insights</li>
              <li>Summaries may be stored to support feature functionality</li>
              <li>Raw prompts are not retained beyond processing</li>
            </ul>
            <p>
              Third-party AI providers may process this data and may use it for training purposes
              in accordance with their terms. Users can avoid AI processing by not using
              AI-enabled features.
            </p>
          </section>

          <section>
            <h2>8. SOCIAL ACCOUNTABILITY FEATURES</h2>
            <p>
              The app enables social accountability features. Users control what information is
              shared with other users and are never required to disclose real names or sensitive
              personal information to other individuals.
            </p>
          </section>

          <section>
            <h2>9. DATA RETENTION</h2>
            <p>We retain personal information only as long as necessary for the purposes described in this Policy.</p>
            <ul>
              <li>Account data is deleted upon user-initiated account deletion</li>
              <li>Backup copies are securely stored and purged within a short period for disaster recovery and security</li>
            </ul>
          </section>

          <section>
            <h2>10. DATA SECURITY</h2>
            <p>
              We implement technical and organizational safeguards designed to protect personal
              information. However, no system can be completely secure, and use of the Services
              is at your own risk.
            </p>
          </section>

          <section>
            <h2>11. CHILDREN &amp; AGE CONFIRMATION</h2>
            <p>The Services are available to users of all ages. We confirm age at signup.</p>
            <p>
              If we learn that we have collected personal information from a child in violation
              of applicable law, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2>12. YOUR PRIVACY RIGHTS</h2>
            <p>Depending on your location, you may have rights to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccuracies</li>
              <li>Request deletion of your data</li>
              <li>Restrict or object to processing</li>
              <li>Withdraw consent</li>
              <li>Request a copy of your data (where required by law)</li>
            </ul>
            <p>Users can delete their account directly within the app without contacting support.</p>
          </section>

          <section>
            <h2>13. DO-NOT-TRACK SIGNALS</h2>
            <p>We do not currently respond to Do Not Track (DNT) signals due to the lack of an industry standard.</p>
          </section>

          <section>
            <h2>14. U.S. STATE PRIVACY RIGHTS</h2>
            <p>
              Residents of certain U.S. states may have additional rights, including the right to
              opt out of targeted advertising or the sale/sharing of personal information.
            </p>
            <p>Requests may be submitted via:</p>
            <ul>
              <li>
                Email: <a href="mailto:james@cadaapp.com">james@cadaapp.com</a>
              </li>
              <li>
                Phone: <a href="tel:+19258188474">925-818-8474</a>
              </li>
            </ul>
            <p>Authorized agents may submit requests on behalf of users, subject to verification.</p>
          </section>

          <section>
            <h2>15. INTERNATIONAL DATA TRANSFERS</h2>
            <p>
              Personal information may be processed or stored outside the user&apos;s country of
              residence. Where required, we implement appropriate safeguards for cross-border
              transfers.
            </p>
          </section>

          <section>
            <h2>16. POLICY UPDATES</h2>
            <p>We may update this Privacy Policy periodically. The &quot;Last Updated&quot; date reflects the most recent changes.</p>
          </section>

          <section>
            <h2>17. CONTACT US</h2>
            <p>
              CADA Group LLC
              <br />
              611 South Dupont Highway, Suite 102
              <br />
              Dover, DE 19901
              <br />
              United States
            </p>
            <p>
              Email: <a href="mailto:james@cadaapp.com">james@cadaapp.com</a>
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
