import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface ProfileScrollDepthCardProps {
  children: ReactNode;
  className?: string;
}

/** A restrained perspective shift tied to scroll position, with motion-safe fallback. */
export default function ProfileScrollDepthCard({ children, className }: ProfileScrollDepthCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ position: "relative", transformPerspective: 1000, transformStyle: "preserve-3d" }}
      initial={reduceMotion ? false : { y: 18, rotateX: 7, scale: 0.97, opacity: 0.88 }}
      whileInView={reduceMotion ? undefined : { y: 0, rotateX: 0, scale: 1, opacity: 1 }}
      viewport={{ once: false, amount: 0.2 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
