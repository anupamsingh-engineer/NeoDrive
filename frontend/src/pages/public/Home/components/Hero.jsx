import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Folder, FileText, Image as ImageIcon, Video } from "lucide-react";
import { Button } from "../../../../components/ui";
import { staggerContainer, listItem } from "../../../../motion";

const PREVIEW_ROWS = [
  { name: "Design Assets", size: "—", icon: Folder },
  { name: "Q3 Report.pdf", size: "2.4 MB", icon: FileText },
  { name: "Team Photo.png", size: "5.1 MB", icon: ImageIcon },
  { name: "Product Demo.mp4", size: "48 MB", icon: Video },
];

const HeroPreviewCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 24, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
    className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-canvas shadow-float"
  >
    <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
      <span className="h-2.5 w-2.5 rounded-full bg-danger/40" />
      <span className="h-2.5 w-2.5 rounded-full bg-warning/40" />
      <span className="h-2.5 w-2.5 rounded-full bg-success/40" />
      <span className="ml-3 text-xs font-medium text-ink-faint">My Drive</span>
    </div>
    <div className="flex flex-col divide-y divide-border">
      {PREVIEW_ROWS.map((row) => (
        <div key={row.name} className="flex items-center gap-3 px-4 py-3">
          <row.icon className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <span className="flex-1 truncate text-sm text-ink">{row.name}</span>
          <span className="text-xs text-ink-faint">{row.size}</span>
        </div>
      ))}
    </div>
  </motion.div>
);

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="mx-auto flex w-full max-w-page flex-col items-center gap-12 px-6 py-20 lg:py-28">
      <motion.div {...staggerContainer(0.08)} className="flex max-w-2xl flex-col items-center gap-5 text-center">
        <motion.h1 variants={listItem} className="text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Your files, organized and always within reach.
        </motion.h1>
        <motion.p variants={listItem} className="max-w-lg text-lg text-ink-soft">
          Upload, organize, and access your files from any device — with fast uploads, instant
          previews, and storage that scales with you.
        </motion.p>
        <motion.div variants={listItem} className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate("/auth/register")}>
            Get Started
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate("/auth/login")}>
            Sign In
          </Button>
        </motion.div>
      </motion.div>

      <HeroPreviewCard />
    </section>
  );
};

export default Hero;
