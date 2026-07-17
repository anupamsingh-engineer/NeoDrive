import { motion } from "framer-motion";
import { Cloud } from "lucide-react";
import { fadeUp, staggerContainer, listItem } from "../../../motion";

const AuthCard = ({ title, subtitle, children }) => (
  <div className="flex flex-1 max-w-page mx-auto overflow-hidden">
    <div className="hidden w-[42%] shrink-0 flex-col justify-between bg-brand p-10 text-white lg:flex">
      <div className="flex items-center gap-2">
        <Cloud className="h-6 w-6" aria-hidden="true" />
        <span className="text-lg font-semibold">Storage App</span>
      </div>
      <div>
        <p className="text-3xl font-semibold leading-snug">
          Your files, organized and always within reach.
        </p>
        <p className="mt-4 max-w-sm text-sm text-white/70">
          Fast uploads, instant previews, and storage that scales with you.
        </p>
      </div>
      <p className="text-xs text-white/50">
        © {new Date().getFullYear()} Storage App
      </p>
    </div>

    <div className="flex flex-1 items-center justify-center bg-surface px-6 py-12">
      <motion.div
        variants={fadeUp}
        initial="initial"
        animate="animate"
        className="w-full max-w-md rounded-lg border border-border bg-canvas p-8"
      >
        <motion.div {...staggerContainer(0.05)} className="mb-7 text-center">
          <motion.h1
            variants={listItem}
            className="text-2xl font-semibold text-ink"
          >
            {title}
          </motion.h1>
          {subtitle && (
            <motion.p
              variants={listItem}
              className="mt-1.5 text-sm text-ink-soft"
            >
              {subtitle}
            </motion.p>
          )}
        </motion.div>
        {children}
      </motion.div>
    </div>
  </div>
);

export default AuthCard;
