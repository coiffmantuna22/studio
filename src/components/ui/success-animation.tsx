'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface SuccessAnimationProps {
  message?: string;
  size?: number;
}

export function SuccessAnimation({ message = 'הפעולה בוצעה בהצלחה!', size = 80 }: SuccessAnimationProps) {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <div className="relative flex items-center justify-center mb-4">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            duration: 0.5
          }}
          className="bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"
          style={{ width: size * 1.5, height: size * 1.5 }}
        >
          <motion.div
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2, ease: "easeInOut" }}
          >
             <Check className="text-green-600 dark:text-green-400" size={size} strokeWidth={3} />
          </motion.div>
        </motion.div>
        
        {/* Confetti-like particles */}
        {[...Array(6)].map((_, i) => (
            <motion.div
                key={i}
                className="absolute w-2 h-2 rounded-full bg-green-500"
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ 
                    opacity: [0, 1, 0], 
                    x: Math.cos(i * 60 * (Math.PI / 180)) * (size), 
                    y: Math.sin(i * 60 * (Math.PI / 180)) * (size) 
                }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            />
        ))}
      </div>
      
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="text-xl font-bold text-green-700 dark:text-green-400"
      >
        {message}
      </motion.h3>
    </div>
  );
}
