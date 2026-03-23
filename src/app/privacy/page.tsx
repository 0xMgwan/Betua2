'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </Link>
          <h1 className="text-xl font-bold text-[#B8860B]">Privacy Policy</h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-invert max-w-none">
          <p className="text-gray-400 mb-8">Last updated: March 23, 2026</p>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              Welcome to GUAP (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your personal information 
              and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard 
              your information when you use our mobile application and website (collectively, the &quot;Platform&quot;).
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, 
              please do not access the Platform.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold text-white mb-3">2.1 Personal Information</h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              We collect personal information that you voluntarily provide to us when you register on the Platform, 
              express an interest in obtaining information about us or our products and services, or otherwise 
              contact us. This includes:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Name and contact information (email address, phone number)</li>
              <li>Account credentials (username, password)</li>
              <li>Payment information (mobile money details)</li>
              <li>Profile information</li>
              <li>Transaction history</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <p className="text-gray-300 leading-relaxed mb-4">
              When you access the Platform, we automatically collect certain information, including:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>Device information (device type, operating system, unique device identifiers)</li>
              <li>Log and usage data (access times, pages viewed, app features used)</li>
              <li>Location information (with your consent)</li>
              <li>IP address and browser type</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">3. How We Use Your Information</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We use the information we collect for various purposes, including:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li>To provide, operate, and maintain the Platform</li>
              <li>To process transactions and send related information</li>
              <li>To send you technical notices, updates, and support messages</li>
              <li>To respond to your comments, questions, and requests</li>
              <li>To monitor and analyze trends, usage, and activities</li>
              <li>To detect, investigate, and prevent fraudulent transactions and other illegal activities</li>
              <li>To personalize and improve your experience</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">4. Sharing Your Information</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              We may share your information in the following situations:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li><strong>Service Providers:</strong> We may share your information with third-party vendors and service providers that perform services for us</li>
              <li><strong>Business Transfers:</strong> We may share or transfer your information in connection with a merger, acquisition, or sale of assets</li>
              <li><strong>Legal Requirements:</strong> We may disclose your information where required by law or to protect our rights</li>
              <li><strong>With Your Consent:</strong> We may share your information for any other purpose with your consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">5. Data Security</h2>
            <p className="text-gray-300 leading-relaxed">
              We implement appropriate technical and organizational security measures designed to protect your 
              personal information. However, please note that no method of transmission over the Internet or 
              electronic storage is 100% secure. While we strive to use commercially acceptable means to protect 
              your personal information, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">6. Data Retention</h2>
            <p className="text-gray-300 leading-relaxed">
              We will retain your personal information only for as long as necessary to fulfill the purposes 
              outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. 
              When we no longer need your personal information, we will securely delete or anonymize it.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">7. Your Privacy Rights</h2>
            <p className="text-gray-300 leading-relaxed mb-4">
              Depending on your location, you may have certain rights regarding your personal information:
            </p>
            <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
              <li><strong>Access:</strong> You can request access to your personal information</li>
              <li><strong>Correction:</strong> You can request that we correct inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> You can request that we delete your personal information</li>
              <li><strong>Portability:</strong> You can request a copy of your data in a portable format</li>
              <li><strong>Withdrawal of Consent:</strong> You can withdraw your consent at any time</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              To exercise these rights, please contact us at privacy@guap.gold
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">8. Children&apos;s Privacy</h2>
            <p className="text-gray-300 leading-relaxed">
              The Platform is not intended for individuals under the age of 18. We do not knowingly collect 
              personal information from children under 18. If you are a parent or guardian and believe your 
              child has provided us with personal information, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">9. Third-Party Services</h2>
            <p className="text-gray-300 leading-relaxed">
              The Platform may contain links to third-party websites and services. We are not responsible for 
              the privacy practices of these third parties. We encourage you to read the privacy policies of 
              any third-party services you access.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">10. Changes to This Privacy Policy</h2>
            <p className="text-gray-300 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting 
              the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review 
              this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-bold text-[#B8860B] mb-4">11. Contact Us</h2>
            <p className="text-gray-300 leading-relaxed">
              If you have any questions about this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-white font-semibold">GUAP Technologies</p>
              <p className="text-gray-400">Email: privacy@guap.gold</p>
              <p className="text-gray-400">Website: https://guap.gold</p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} GUAP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
