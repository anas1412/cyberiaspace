import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MessageSquare, ArrowLeft, Clock, Headphones } from 'lucide-react';

const Contact: React.FC = () => {
  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const channels = [
    {
      id: 1,
      title: "Support Email",
      icon: <Mail className="w-6 h-6 text-blue-400" />,
      desc: "For any technical issues, billing questions, or feedback.",
      value: "anas.bassoumi@gmail.com",
      link: "mailto:anas.bassoumi@gmail.com"
    },
    {
      id: 2,
      title: "Direct Phone",
      icon: <Phone className="w-6 h-6 text-blue-400" />,
      desc: "Available for urgent matters and business inquiries.",
      value: "+216 50 377 851",
      link: "tel:+21650377851"
    }
  ];

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
          <span className="text-xs font-black uppercase tracking-widest">Back</span>
        </button>

        <header className="mb-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
              <Headphones className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Contact</h1>
          </div>
          <p className="text-slate-500 font-mono text-sm uppercase tracking-widest">Get in touch with the team</p>
        </header>

        <section className="space-y-6 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {channels.map((channel) => (
              <div 
                key={channel.id}
                className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex flex-col items-center text-center space-y-4 hover:border-blue-500/30 transition-all duration-500 group"
              >
                <div className="w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500/20 transition-all">
                  {channel.icon}
                </div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest">{channel.title}</h2>
                <p className="text-sm text-slate-400 leading-relaxed h-12 flex items-center">
                  {channel.desc}
                </p>
                <a 
                  href={channel.link} 
                  className="text-xl font-bold text-white hover:text-blue-400 transition-colors break-all"
                >
                  {channel.value}
                </a>
              </div>
            ))}
          </div>

          <div className="bg-blue-500/5 border border-blue-500/10 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 transition-all duration-500 hover:border-blue-500/20">
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Response Time</h3>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-wide">Usually within 24-48 hours</p>
              </div>
            </div>
            <button 
              onClick={() => window.open('https://cyberia.tn/feedback', '_blank')}
              className="bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] px-8 py-4 rounded-full hover:bg-blue-400 transition-colors flex items-center gap-2 active:scale-95 shadow-lg shadow-white/5"
            >
              <MessageSquare className="w-3 h-3" />
              Give Feedback
            </button>
          </div>
        </section>
      </motion.div>
    </div>
  );
};

export default Contact;