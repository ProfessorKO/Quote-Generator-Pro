import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';

export const Scene4 = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 w-full h-full bg-[var(--color-brand-navy)] overflow-hidden flex flex-col items-center justify-center"
    >
      {/* Grid texture for action tech feel */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--color-brand-orange) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      <motion.div
        initial={{ scale: 1 }}
        animate={{ scale: 0.8 }}
        transition={{ duration: 5, ease: 'linear' }}
        className="relative z-10 w-[85%] bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4 overflow-hidden items-center text-center justify-center min-h-[400px]"
      >
        <motion.div
          initial={{ scale: 1 }}
          animate={{ scale: [1, 0.95, 1.2, 0] }}
          transition={{ duration: 1.5, times: [0, 0.2, 0.5, 1], ease: 'easeInOut' }}
          className="bg-[var(--color-brand-orange)] text-white font-bold text-2xl py-4 w-full rounded-2xl"
        >
          SEND QUOTE
        </motion.div>

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1, type: 'spring', damping: 12, stiffness: 200 }}
          className="absolute inset-0 flex flex-col items-center justify-center bg-white z-20"
        >
          <CheckCircle2 className="w-32 h-32 text-green-500 mb-4" />
          <h2 className="font-display text-4xl text-[var(--color-brand-navy)]">QUOTE SENT</h2>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.5, type: 'spring' }}
        className="absolute bottom-[15vh] w-full px-8 text-center"
      >
        <h2 className="font-display text-white text-[10vw] leading-tight text-shadow-hard tracking-tighter">
          QUOTE MATE.
        </h2>
        <p className="font-body font-bold text-[var(--color-brand-orange)] text-[5vw] uppercase mt-2 text-shadow-hard">
          Fast enough for a national crisis.
        </p>
      </motion.div>
    </motion.div>
  );
};
