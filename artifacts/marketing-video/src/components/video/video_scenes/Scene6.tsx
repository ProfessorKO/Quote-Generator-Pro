import { motion } from 'framer-motion';

export const Scene6 = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 w-full h-full overflow-hidden flex flex-col justify-end items-center pb-[20vh]"
    >
      <motion.video
        autoPlay
        muted
        loop
        playsInline
        src={`${import.meta.env.BASE_URL}videos/scene6_v2.mp4`}
        className="absolute inset-0 w-full h-full object-cover"
        initial={{ scale: 1.1 }}
        animate={{ scale: 1.0 }}
        transition={{ duration: 5, ease: 'easeOut' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="relative z-10 w-[80%] text-center border-l-4 border-[var(--color-brand-orange)] pl-4"
      >
        <h2 className="font-body italic font-semibold text-white text-[6vw] leading-tight text-shadow-hard text-left">
          "Sometimes, you just need to get the job done."
        </h2>
      </motion.div>
    </motion.div>
  );
};
