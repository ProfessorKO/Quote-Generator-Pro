import { motion } from 'framer-motion';

export const Scene3 = () => {
  const lineItems = [
    { desc: 'Evacuate Opera House', price: '$1,000,000', delay: 1.5 },
    { desc: 'Bring target back alive', price: '$2,000,000', delay: 3.0 },
    { desc: 'Stop the bomb', price: '$500,000', delay: 4.5 },
    { desc: 'Call-out fee', price: '$50,000', delay: 5.5 },
    { desc: 'Emergency surcharge', price: '30%', delay: 6.5 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ scale: 1.1, opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 w-full h-full bg-[var(--color-brand-navy)] overflow-hidden flex flex-col items-center justify-center"
    >
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--color-brand-orange)_0%,_transparent_70%)] blur-[100px]" />
      </div>

      {/* Grid texture for action tech feel */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--color-brand-orange) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring', damping: 20 }}
        className="relative z-10 w-[85%] bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4 overflow-hidden"
      >
        <div className="flex justify-between items-center border-b pb-4">
          <div className="font-display text-2xl text-[var(--color-brand-navy)] tracking-tight">NEW QUOTE</div>
          <div className="text-[var(--color-brand-orange)] font-bold">#QM-999</div>
        </div>

        <div className="flex flex-col gap-3 mt-2 min-h-[250px]">
          {lineItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: item.delay, type: 'spring', damping: 15 }}
              className="flex justify-between items-center text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100"
            >
              <span>{item.desc}</span>
              <span className="font-bold text-[var(--color-brand-navy)]">{item.price}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 8, duration: 0.5 }}
          className="mt-4 pt-4 border-t-2 border-dashed border-slate-200"
        >
          <div className="flex justify-between items-center text-sm text-slate-500 mb-1">
            <span>Subtotal</span>
            <span>$3,550,000</span>
          </div>
          <div className="flex justify-between items-center text-sm text-[var(--color-brand-orange)] mb-2 font-bold">
            <span>GST (10%)</span>
            <span>$461,500</span>
          </div>
          <div className="flex justify-between items-center text-xl font-bold text-[var(--color-brand-navy)]">
            <span>TOTAL</span>
            <span>$5,076,500</span>
          </div>
        </motion.div>
      </motion.div>

      <div className="absolute bottom-[8vh] left-0 w-full text-center z-20 flex flex-col gap-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="font-body font-bold text-[var(--color-brand-navy)] text-[5vw] uppercase tracking-wider bg-[var(--color-brand-orange)] mx-auto px-4 py-2 rounded-lg backdrop-blur-sm"
        >
          Line items in real-time
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 8.5, duration: 0.5 }}
          className="font-body font-bold text-white text-[4vw] uppercase tracking-wider bg-black/60 mx-auto px-4 py-2 rounded-lg"
        >
          GST automatically calculated
        </motion.div>
      </div>
    </motion.div>
  );
};
