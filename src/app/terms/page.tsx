"use client";
import { Navbar } from "@/components/Navbar";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";

const SECTIONS_EN = [
  { title: "1. Definitions", content: `"GUAP" refers to the prediction market platform. "User" means any registered individual. "Market" refers to any tradeable prediction event. "Shares" are trading units representing positions. "nTZS" is the digital currency pegged to TZS. "Wallet" holds your nTZS balance.` },
  { title: "2. Eligibility", content: `You must be 18+ years old, have legal capacity to enter contracts, provide accurate information, not be prohibited by law, and reside where GUAP is permitted. We may request ID verification anytime.` },
  { title: "3. Account Rules", content: `One account per user. You're responsible for all account activity. Keep credentials secure. Report unauthorized access immediately. Multiple accounts = suspension.` },
  { title: "4. Trading Rules", content: `Buy shares on event outcomes. Winning shares pay TZS 1 each; losing shares = 0. 5% transaction fee on all trades. Markets resolved by creators/admins using reliable sources. All trades are FINAL and non-reversible.` },
  { title: "5. Deposits & Withdrawals", content: `Accepted: M-Pesa, Tigo Pesa, Airtel Money. Min deposit: TZS 1,000. Min withdrawal: TZS 5,000. Processing: 1-24 hours. We may hold suspicious transactions for review.` },
  { title: "6. Risks & Disclaimers", content: `Trading carries RISK OF LOSS. Only trade money you can afford to lose. We don't provide financial advice. Past performance ≠ future results. You make your own decisions.` },
  { title: "7. Prohibited Conduct", content: `No illegal activity. No market manipulation. No multiple accounts. No automated trading without permission. No exploiting bugs. No harassment. Violations = account termination.` },
  { title: "8. Intellectual Property", content: `GUAP owns all platform content, trademarks, and technology. You may not copy, modify, or distribute our content without permission.` },
  { title: "9. Privacy & Data", content: `We collect email, phone, transaction data. Used for service operation, security, legal compliance. We don't sell your data. See Privacy Policy for details.` },
  { title: "10. Limitation of Liability", content: `GUAP is not liable for: trading losses, service interruptions, third-party actions, force majeure events. Maximum liability = your account balance.` },
  { title: "11. Account Termination", content: `We may suspend/terminate accounts violating terms without notice. You may close your account anytime. Remaining funds returned per Tanzanian law.` },
  { title: "12. Dispute Resolution", content: `Contact support@guap.gold first. Disputes governed by Tanzanian law. Resolved in Tanzanian courts. 30-day resolution attempt before legal action.` },
  { title: "13. Changes to Terms", content: `We may modify terms anytime. Changes posted on platform, effective immediately. Continued use = acceptance of new terms.` },
  { title: "14. Contact", content: `Email: support@guap.gold | WhatsApp: Join our community | X/Instagram: @shindaguap` },
];

const SECTIONS_SW = [
  { title: "1. Ufafanuzi", content: `"GUAP" ni jukwaa la soko la utabiri. "Mtumiaji" ni mtu aliyejiandikisha. "Soko" ni tukio la utabiri. "Hisa" ni vitengo vya biashara. "nTZS" ni sarafu ya kidijitali. "Mkoba" unashikilia salio lako.` },
  { title: "2. Ustahiki", content: `Lazima uwe na miaka 18+, uwezo wa kisheria, toa taarifa sahihi, usizuiwe na sheria. Tunaweza kuomba uthibitisho wa umri wakati wowote.` },
  { title: "3. Sheria za Akaunti", content: `Akaunti moja kwa mtumiaji. Unawajibika kwa shughuli zote. Linda taarifa zako. Ripoti ufikiaji usioidhinishwa. Akaunti nyingi = kusimamishwa.` },
  { title: "4. Sheria za Biashara", content: `Nunua hisa kwenye matokeo. Hisa zinazoshinda hulipa TZS 1; zinazopoteza = 0. Ada 5% kwa biashara zote. Masoko yanatatuliwa na waundaji/wasimamizi. Biashara zote ni ZA MWISHO.` },
  { title: "5. Kuweka na Kutoa", content: `Tunakubali: M-Pesa, Tigo Pesa, Airtel Money. Chini: TZS 1,000 kuweka, TZS 5,000 kutoa. Muda: saa 1-24. Tunaweza kushikilia miamala ya shaka.` },
  { title: "6. Hatari", content: `Biashara ina HATARI YA KUPOTEZA. Biashara tu pesa unayoweza kupoteza. Hatutoi ushauri wa kifedha. Unafanya maamuzi yako mwenyewe.` },
  { title: "7. Tabia Iliyokatazwa", content: `Hakuna shughuli haramu. Hakuna kudanganya masoko. Hakuna akaunti nyingi. Hakuna kutumia makosa. Ukiukaji = kufutwa akaunti.` },
  { title: "8. Mali ya Kiakili", content: `GUAP inamiliki maudhui yote, alama za biashara, na teknolojia. Usiige bila ruhusa.` },
  { title: "9. Faragha", content: `Tunakusanya barua pepe, simu, data ya miamala. Inatumika kwa huduma, usalama, sheria. Hatuuzi data yako.` },
  { title: "10. Kikomo cha Dhima", content: `GUAP haiwajibiki kwa: hasara za biashara, usumbufu wa huduma, matukio ya nguvu kubwa. Dhima ya juu = salio lako.` },
  { title: "11. Kufuta Akaunti", content: `Tunaweza kusimamisha akaunti zinazovunja masharti. Unaweza kufunga akaunti wakati wowote. Fedha zitarudishwa kwa sheria za Tanzania.` },
  { title: "12. Utatuzi wa Migogoro", content: `Wasiliana support@guap.gold kwanza. Migogoro inadhibitiwa na sheria za Tanzania.` },
  { title: "13. Mabadiliko", content: `Tunaweza kubadilisha masharti wakati wowote. Kuendelea kutumia = kukubali masharti mapya.` },
  { title: "14. Mawasiliano", content: `Barua pepe: support@guap.gold | WhatsApp: Jiunge na jamii yetu | X/Instagram: @shindaguap` },
];

export default function TermsPage() {
  const { locale } = useLanguage();
  const isSw = locale === "sw";
  const sections = isSw ? SECTIONS_SW : SECTIONS_EN;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/auth/register" className="inline-flex items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-6 font-mono">
          <ArrowLeft size={16} />
          {isSw ? "Rudi" : "Back"}
        </Link>

        <h1 className="text-3xl font-bold font-mono mb-2">{isSw ? "Masharti na Vigezo" : "Terms and Conditions"}</h1>
        <p className="text-sm text-[var(--muted)] mb-8 font-mono">{isSw ? "Imesasishwa: Machi 20, 2026" : "Last Updated: March 20, 2026"}</p>

        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-bold font-mono mb-2 text-[var(--accent)]">{s.title}</h2>
              <p className="text-[var(--muted)] text-sm leading-relaxed">{s.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-12 p-4 border border-[var(--card-border)] bg-[var(--card)]">
          <p className="text-xs text-[var(--muted)] font-mono">
            {isSw ? "Kwa kutumia GUAP, unakubali masharti haya yote." : "By using GUAP, you agree to all these terms."}
          </p>
        </div>
      </div>
    </div>
  );
}
