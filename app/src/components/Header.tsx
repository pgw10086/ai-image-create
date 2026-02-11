import { motion } from 'framer-motion';

export function Header() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
      className="h-16 flex items-center justify-end px-6 gap-3"
    />
  );
}
