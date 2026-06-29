import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

export function MotionPage(props: HTMLMotionProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
      {...props}
    />
  );
}

export function MotionPanel(props: HTMLMotionProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
      {...props}
    />
  );
}
