import { motion } from 'framer-motion';

export const Scene5 = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: '-100%' }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 w-full h-full overflow-hidden flex flex-col justify-center items-center"
    >
      <motion.video
        autoPlay
        muted
        loop
        playsInline
        src={`${import.meta.env.BASE_URL}videos/scene5_v2.mp4`}
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1 }}
        transition={{ duration: 8, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-red-900/30 mix-blend-multiply" />
      <div className="absolute inset-0 bg-black/40" />

      {/* The Price Impact */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1, type: 'spring', damping: 10, stiffness: 100 }}
        className="relative z-10 text-center flex flex-col items-center justify-center w-full px-4"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ delay: 1.5, duration: 0.2, repeat: 3 }}
          className="bg-red-600 px-6 py-2 rounded-xl transform -rotate-2 border-4 border-white shadow-2xl"
        >
          <h1 className="font-display text-white text-[15vw] leading-none tracking-tighter text-shadow-hard">
            3.5 MILLION
          </h1>
          <h1 className="font-display text-white text-[12vw] leading-none tracking-tighter text-shadow-hard mt-[-10px]">
            DOLLARS
          </h1>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
