"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlitchTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
  textClassName?: string;
  containerClassName?: string;
}

const GlitchText = React.forwardRef<HTMLDivElement, GlitchTextProps>(
  ({
    text,
    as: Component = "h1",
    className,
    textClassName,
    containerClassName,
    ...props
  }, ref) => {
    return (
      <div 
        ref={ref}
        className={cn(
          "flex items-center justify-center",
          className
        )}
        {...props}
      >
        <div className={cn(
          "relative",
          containerClassName
        )}>
          <motion.div
            className={cn(
              "font-mono font-black absolute",
              "mix-blend-multiply dark:mix-blend-screen",
              textClassName
            )}
            animate={{
              x: [-2, 2, -2],
              y: [0, -1, 1],
              opacity: [1, 0.8, 0.9],
            }}
            transition={{
              duration: 0.15,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "anticipate"
            }}
          >
            {text}
          </motion.div>
          <motion.div
            className={cn(
              "font-mono font-black absolute",
              "mix-blend-multiply dark:mix-blend-screen",
              textClassName
            )}
            animate={{
              x: [2, -2, 2],
              y: [1, -1, 0],
              opacity: [0.9, 1, 0.8],
            }}
            transition={{
              duration: 0.13,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "anticipate"
            }}
          >
            {text}
          </motion.div>
          <motion.div
            className={cn(
              "font-mono font-black",
              "mix-blend-multiply dark:mix-blend-screen",
              textClassName
            )}
            animate={{
              x: [-1, 1, -1],
              y: [-1, 1, 0],
              opacity: [0.8, 0.9, 1],
            }}
            transition={{
              duration: 0.11,
              repeat: Infinity,
              repeatType: "mirror",
              ease: "anticipate"
            }}
          >
            {text}
          </motion.div>
        </div>
      </div>
    );
  }
);

GlitchText.displayName = "GlitchText";

export { GlitchText };
