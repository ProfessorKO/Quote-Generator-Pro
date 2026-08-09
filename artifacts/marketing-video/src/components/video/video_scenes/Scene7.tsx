import { motion } from 'framer-motion';

export const Scene7 = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.2 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="absolute inset-0 w-full h-full overflow-hidden flex flex-col justify-center items-center"
    >
      <motion.video
        autoPlay
        muted
        loop
        playsInline
        src={`${import.meta.env.BASE_URL}videos/scene7.mp4`}
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ duration: 7, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-black/30" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="relative z-10 text-center w-full px-4 mb-20"
      >
        <h1 className="font-display text-white text-[12vw] leading-none uppercase text-shadow-hard tracking-tighter">
          SYDNEY OPERA HOUSE
        </h1>
        <motion.div
          initial={{ rotate: -5, scale: 0 }}
          animate={{ rotate: -5, scale: 1 }}
          transition={{ delay: 1.5, type: 'spring', damping: 12 }}
          className="inline-block bg-green-500 px-6 py-1 rounded border-2 border-white mt-4 shadow-xl"
        >
          <span className="font-display text-white text-[10vw]">SAVED</span>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 3, duration: 0.8 }}
        className="absolute bottom-[10vh] w-full text-center px-4"
      >
        <h2 className="font-display text-[var(--color-brand-orange)] text-[8vw] uppercase text-shadow-hard">
          QUOTE MATE
        </h2>
        <p className="font-body font-bold text-white text-[4vw] tracking-widest mt-2 uppercase text-shadow-hard">
          Fast. Simple. Ridiculous.
        </p>
      </motion.div>
    </motion.div>
  );
};
