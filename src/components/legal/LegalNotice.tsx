import React from 'react';
import { motion } from 'framer-motion';
import { Scale, ArrowLeft } from 'lucide-react';

const LegalNotice: React.FC = () => {
  const handleBack = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-[100dvh] bg-black text-slate-300 p-6 md:p-20 overflow-y-auto custom-scroll selection:bg-blue-500/30">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <button 
          onClick={handleBack}
          className="flex items-center gap-2 text-blue-400 hover:text-white transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-xs font-black uppercase tracking-widest">Back to Workspace</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Scale className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Legal Notice</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Last Updated: February 24, 2026</p>
        </header>

        <section className="space-y-12 pb-20">
          <div className="space-y-4">
        <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">1. Legal Information</h2>
        <p className="leading-relaxed">
          Cyberia is developed and operated by <strong className="text-white">Anas Bassoumi</strong>, registered as an auto-entrepreneur operating under the trade name <strong className="text-white">Cyberia AI Studio</strong> in Tunisia.
        </p>
        <ul className="space-y-2 mt-4">
          <li><strong className="text-white">Tax ID (Matricule Fiscal):</strong> 1970272D</li>
          <li><strong className="text-white">Registered Address:</strong> Rue Taieb El Azzabi, Hammamet, 8050, Nabeul, Tunisia</li>
          <li><strong className="text-white">Website:</strong> <a href="https://cyberia.tn" className="text-blue-400 hover:text-white">https://cyberia.tn</a></li>
          <li><strong className="text-white">Contact:</strong> <a href="mailto:anas.bassoumi@gmail.com" className="text-blue-400 hover:text-white">anas.bassoumi@gmail.com</a></li>
        </ul>

        <div className="pt-4">
          <h3 className="text-lg font-bold text-white mb-2">Website Hosting</h3>
          <p className="leading-relaxed">
            This website is hosted by <strong className="text-white">Vercel Inc.</strong><br />
            Address: 440 N Barranca Ave #4133, Covina, CA 91723, United States.<br />
            Website: <a href="https://vercel.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:text-white">https://vercel.com</a>
          </p>
        </div>
      </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">2. Intellectual Property</h2>
            <p className="leading-relaxed">
              <strong className="text-white">Copyright:</strong> All content, design, code, and materials related to Cyberia are protected by copyright laws and international treaties.
            </p>
            <p className="leading-relaxed">
              <strong className="text-white">Trademarks:</strong> The Cyberia logo, and related marks are trademarks of Cyberia AI Studio. All rights reserved. Unauthorized use is prohibited.
            </p>
            <p className="leading-relaxed">
              <strong className="text-white">User Content:</strong> Users retain ownership of all content they create within Cyberia. By using the Service, you grant us a limited license to store and display your content as necessary for providing the Service.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">3. Third-Party Services</h2>
            <p className="leading-relaxed">
              Cyberia integrates with third-party services:
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li><strong className="text-white">Groq, OpenAI, Google & Anthropic:</strong> For AI inference (Oracle features)</li>
              <li><strong className="text-white">Vercel:</strong> For hosting and deployment infrastructure</li>
              <li><strong className="text-white">Supabase:</strong> For database and cloud storage</li>
            </ul>
            <p className="leading-relaxed mt-4">
              We are not responsible for the privacy practices or content of these third-party services.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">4. Disclaimer of Warranties</h2>
            <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-slate-500">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE. THE SERVICE WILL MEET YOUR REQUIREMENTS. ANY ERRORS WILL BE CORRECTED.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">5. Limitation of Liability</h2>
            <p className="leading-relaxed font-mono text-xs uppercase tracking-wider text-slate-500">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, INCLUDING ANY LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES, OR ANY DAMAGES ARISING FROM USE OR INABILITY TO USE THE SERVICE.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">6. Indemnification</h2>
            <p className="leading-relaxed">
              You agree to indemnify and hold us harmless from any claims, damages, or expenses arising from:
            </p>
            <ul className="list-disc list-inside space-y-3 mt-4 ml-2">
              <li>Your use of the Service</li>
              <li>Your violation of these terms</li>
              <li>Your infringement of any third-party rights</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">7. Governing Law</h2>
            <p className="leading-relaxed">
              This Legal Notice shall be governed by the laws of <strong className="text-white">Tunisia</strong>. Any disputes shall be resolved in accordance with Tunisian jurisdiction.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">8. Severability</h2>
            <p className="leading-relaxed">
              If any provision of this Legal Notice is found unenforceable, the remaining provisions shall continue in full force.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-white uppercase tracking-widest border-b border-white/5 pb-2">9. Contact</h2>
            <p className="leading-relaxed">
              For legal inquiries, contact us at <a href="mailto:anas.bassoumi@gmail.com" className="text-blue-400 hover:text-white">anas.bassoumi@gmail.com</a>
            </p>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default LegalNotice;
