import { Legal } from "@/components/Legal";
export const metadata = { title: "Terms of Service — Lullawood" };
export default function Page() {
  return (
    <Legal title="Terms of Service" updated="25 June 2026">
      <p>These terms govern your use of Lullawood. By creating an account or using the service, you agree to them. Please read them alongside our <a href="/privacy">Privacy Policy</a> and <a href="/safety">Child Safety</a> page.</p>

      <h2>Who can use Lullawood</h2>
      <p>You must be at least 18 and able to enter a contract. Lullawood is operated by you on behalf of the children in your care; you are responsible for the profiles you create and for supervising your child&apos;s use.</p>

      <h2>The service</h2>
      <p>Lullawood generates personalized bedtime stories and audio based on the profile you provide, and (on some plans) mails printed keepsakes. Stories are created with AI and are intended for personal, family use.</p>

      <h2>Plans, trials, and billing</h2>
      <ul>
        <li>Paid plans are billed in advance on a recurring basis (monthly or yearly) until cancelled.</li>
        <li>Any free trial converts to a paid subscription at the end of the trial unless you cancel before it ends.</li>
        <li>You can cancel at any time from your account; cancellation stops future renewals. Except where required by law, payments already made are non-refundable.</li>
        <li>Prices may change; we will give you notice before a change affects you.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Please don&apos;t misuse the service — for example by attempting to generate inappropriate content, infringing others&apos; rights, or disrupting the platform. We may suspend accounts that do.</p>

      <h2>Content and intellectual property</h2>
      <p>Lullawood, including its characters (such as Fern, Oliver, Willow, Bramble and Nimbus), artwork, and platform, belongs to us. The personalized stories we create for your child are licensed to you for your family&apos;s personal, non-commercial use. You grant us the permission needed to generate, store, and deliver those stories to you.</p>

      <h2>AI-generated content</h2>
      <p>Stories are produced by AI and, while designed to be gentle and age-appropriate, may occasionally contain mistakes or unexpected content. Please use your judgement as a parent, and tell us if anything isn&apos;t right.</p>

      <h2>Disclaimers and liability</h2>
      <p>The service is provided &ldquo;as is&rdquo;. To the fullest extent permitted by law, we exclude implied warranties and limit our liability for the service. Nothing in these terms limits liability that cannot be limited by law.</p>

      <h2>Ending the service</h2>
      <p>You can stop using Lullawood and delete your account at any time. We may suspend or end access if these terms are breached, or if we stop offering the service.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of California, USA, unless local law requires otherwise. {/* TODO: confirm governing-law jurisdiction with counsel before launch. */}</p>

      <h2>Changes</h2>
      <p>We may update these terms; we will revise the date above and, for material changes, let you know.</p>
    </Legal>
  );
}
