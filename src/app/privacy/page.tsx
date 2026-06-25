import { Legal } from "@/components/Legal";
export const metadata = { title: "Privacy Policy — Lullawood" };
export default function Page() {
  return (
    <Legal title="Privacy Policy" updated="25 June 2026">
      <p>Lullawood creates personalized bedtime stories for children, set up and controlled by a parent or guardian. We take the privacy of families — and especially children — seriously. This policy explains what we collect, why, and the choices you have.</p>

      <h2>Who we are</h2>
      <p>Lullawood (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is the data controller for the information described here. You can reach us at <a href="mailto:hello@lullawood.com">hello@lullawood.com</a>.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Parent account details</strong> — your email address and login information.</li>
        <li><strong>Child profile</strong> — the details you choose to provide so we can write your child&apos;s stories: a first name (or nickname), an age range, and preferences such as favourite animals, colours and interests.</li>
        <li><strong>Story content</strong> — the stories we generate, and a short summary of past adventures so characters and storylines can recur.</li>
        <li><strong>Billing information</strong> — handled by our payment processor (Stripe). We do not store your full card number.</li>
        <li><strong>Technical and usage data</strong> — basic information such as device type and pages visited, used to operate and improve the service.</li>
      </ul>

      <h2>A note on children&apos;s data</h2>
      <p>Lullawood is intended to be set up and operated by an adult. We do not knowingly allow children to create their own accounts. A child&apos;s profile is provided and controlled by their parent or guardian, and is used <strong>only</strong> to generate that child&apos;s stories. We never sell children&apos;s data, never use it for advertising, and never build advertising profiles of children. We collect the minimum needed to personalize a story — you do not need to provide a surname, address, photo, or birth date.</p>

      <h2>How we use information</h2>
      <ul>
        <li>To generate and deliver your child&apos;s personalized stories and audio.</li>
        <li>To run your account, process payments, and provide support.</li>
        <li>To keep the service safe and to improve it (using aggregated, non-identifying data where possible).</li>
        <li>To meet legal obligations.</li>
      </ul>

      <h2>AI and how stories are made</h2>
      <p>Stories are generated using trusted third-party AI providers. Your child&apos;s profile is sent to those providers solely to write that story. We use providers under terms that do not permit using your content to train their public models. Stories pass through safety checks designed to keep content gentle and age-appropriate (see our <a href="/safety">Child Safety</a> page).</p>

      <h2>Who we share with</h2>
      <p>We share data only with service providers who help us run Lullawood — for example hosting, AI generation, email delivery, audio narration, payments, and (if you choose a printed plan) printing and postage. They may only use the data to provide their service to us. We do <strong>not</strong> sell your or your child&apos;s personal information. We may disclose information if required by law, or in connection with a business transfer, in which case this policy continues to apply.</p>

      <h2>Keeping and deleting data</h2>
      <p>We keep information while your account is active. You can ask us to delete a child&apos;s profile, or your whole account and everything tied to it, at any time by emailing <a href="mailto:hello@lullawood.com">hello@lullawood.com</a>. We will action deletion promptly, subject to any legal retention we are required to keep.</p>

      <h2>Your rights</h2>
      <p>Depending on where you live (including under UK/EU GDPR and California&apos;s CCPA), you may have the right to access, correct, delete, or export your information, and to object to or restrict certain processing. To exercise any right, contact us at the address above.</p>

      <h2>Security and international transfers</h2>
      <p>We use reasonable technical and organizational measures to protect your data. Our providers may process data in other countries; where they do, we rely on appropriate safeguards.</p>

      <h2>Changes</h2>
      <p>If we update this policy we will revise the date above and, for material changes, let you know.</p>
    </Legal>
  );
}
