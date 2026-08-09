import { motion } from 'framer-motion';
import { Hammer } from 'lucide-react';

export const Scene8 = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 w-full h-full bg-[var(--color-brand-navy)] overflow-hidden flex flex-col justify-center items-center px-6 text-center"
    >
      {/* Background Animated Gradient */}
      <motion.div
        className="absolute inset-0 opacity-30"
        animate={{
          background: [
            'radial-gradient(circle at 0% 0%, var(--color-brand-orange) 0%, transparent 50%)',
            'radial-gradient(circle at 100% 100%, var(--color-brand-orange) 0%, transparent 50%)',
            'radial-gradient(circle at 0% 100%, var(--color-brand-orange) 0%, transparent 50%)',
            'radial-gradient(circle at 100% 0%, var(--color-brand-orange) 0%, transparent 50%)',
          ],
        }}
        transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
      />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8, type: 'spring' }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="w-32 h-32 bg-[var(--color-brand-orange)] rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-orange-500/20 transform rotate-3">
          <Hammer className="w-16 h-16 text-white" />
        </div>
        <h1 className="font-display text-white text-[15vw] leading-none uppercase tracking-tighter">
          QUOTE MATE
        </h1>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
        className="relative z-10 mt-12 bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/20 w-full"
      >
        <p className="font-body font-medium text-white/80 text-[4vw] uppercase tracking-wider mb-2">
          Start quoting now
        </p>
        <p className="font-body font-bold text-[var(--color-brand-orange)] text-[4.5vw]">
          quotemate.workmatespro.com.au
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 3.5, duration: 0.8 }}
        className="relative z-10 mt-8"
      >
        <div className="bg-white text-[var(--color-brand-navy)] font-display text-[6vw] px-8 py-4 rounded-full uppercase tracking-wide">
          Try it free — No sign-up
        </div>
      </motion.div>
    </motion.div>
  );
};
