import { motion } from 'framer-motion';

export const Scene1 = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 w-full h-full overflow-hidden flex flex-col justify-end items-center pb-[15vh]"
    >
      <motion.video
        autoPlay
        muted
        loop
        playsInline
        src={`${import.meta.env.BASE_URL}videos/scene1_v2.mp4`}
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.2 }}
        animate={{ scale: 1 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <motion.div
        initial={{ y: 50, opacity: 0, rotateX: 90 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ delay: 1, type: 'spring', damping: 15, stiffness: 200 }}
        className="relative z-10"
      >
        <h1 className="font-display text-white text-[12vw] leading-none uppercase text-shadow-hard tracking-tighter text-center">
          THE PRIME
          <br />
          MINISTER
        </h1>
      </motion.div>
    </motion.div>
  );
};
