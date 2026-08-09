import { motion } from 'framer-motion';

export const Scene2 = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: '-100%' }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 w-full h-full overflow-hidden bg-black"
    >
      {/* Top Left - Defense Minister */}
      <motion.div
        className="absolute inset-0 z-10"
        initial={{ clipPath: 'polygon(0 0, 0 0, 0 0)' }}
        animate={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          src={`${import.meta.env.BASE_URL}videos/scene2_defense_v2.mp4`}
          className="absolute inset-0 w-full h-full object-cover origin-top-left"
          style={{ transform: 'scale(1.1)' }}
        />
        <div className="absolute inset-0 bg-black/30" />
        <motion.h2
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          className="absolute top-[10vh] left-[5vw] font-display text-[8vw] text-white text-shadow-hard tracking-tighter"
        >
          DEFENSE
          <br />
          MINISTER
        </motion.h2>
      </motion.div>

      {/* Diagonal Divider Line */}
      <motion.div
        className="absolute inset-0 z-20 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <svg className="w-full h-full absolute inset-0" preserveAspectRatio="none" viewBox="0 0 100 100">
          <line x1="100" y1="0" x2="0" y2="100" stroke="#F2930D" strokeWidth="1" />
        </svg>
      </motion.div>

      {/* Bottom Right - Spider Mate */}
      <motion.div
        className="absolute inset-0 z-0"
      >
        <motion.video
          autoPlay
          muted
          loop
          playsInline
          src={`${import.meta.env.BASE_URL}videos/scene2_spidermate_v2.mp4`}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.3, x: 20 }}
          animate={{ scale: 1, x: 0 }}
          transition={{ duration: 7, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 bg-black/20" />
        <motion.h2
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-[10vh] right-[5vw] text-right font-display text-[10vw] text-[var(--color-brand-orange)] text-shadow-hard tracking-tighter"
        >
          SPIDER
          <br />
          MATE
        </motion.h2>
      </motion.div>
    </motion.div>
  );
};
