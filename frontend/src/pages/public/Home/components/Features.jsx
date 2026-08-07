import { motion } from "framer-motion";
import { UploadCloud, FolderTree, Eye, HardDrive, ShieldCheck, Globe } from "lucide-react";
import { Card } from "../../../../components/ui";
import { fadeUp } from "../../../../motion";

const FEATURES = [
  {
    icon: UploadCloud,
    title: "Fast, resumable uploads",
    description: "Drag and drop files with live progress tracking, straight to secure cloud storage.",
  },
  {
    icon: FolderTree,
    title: "Nested folder organization",
    description: "Structure your files exactly how you think — folders within folders, no limits.",
  },
  {
    icon: Eye,
    title: "Instant previews",
    description: "Open images and videos right in the browser without downloading a thing.",
  },

  {
    icon: ShieldCheck,
    title: "Secure by design",
    description: "Session-based auth, signed upload URLs, and account-level access controls.",
  },
  {
    icon: Globe,
    title: "Access from anywhere",
    description: "Your drive works the same on any modern browser, on any device.",
  },
  {
    icon: UploadCloud,
    title: "Share with anyone",
    description: "Easily share files and folders with colleagues, friends, or family.",
  },
  {
    icon: DownloadCloud,
    title: "Download anytime",
    description: "Access your files from anywhere, on any device.",
  },

    {
    icon: HardDrive,
    title: "Storage that scales",
    description: "Start free and upgrade to 2, 5, or 10 TB tiers as your library grows.",
  },
];

const Features = () => (
  <section className="mx-auto w-full max-w-page px-6 py-20">
    <div className="mx-auto mb-12 max-w-xl text-center">
      <h2 className="text-3xl font-semibold text-ink">Everything you need to manage your files</h2>
      <p className="mt-3 text-ink-soft">A drive built for speed, structure, and peace of mind.</p>
    </div>

    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((feature, index) => (
        <motion.div
          key={feature.title}
          variants={fadeUp}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: (index % 3) * 0.06 }}
        >
          <Card hoverable className="h-full">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-sm bg-brand-tint">
              <feature.icon className="h-5 w-5 text-brand" aria-hidden="true" />
            </div>
            <h3 className="mb-1.5 text-base font-semibold text-ink">{feature.title}</h3>
            <p className="text-sm text-ink-soft">{feature.description}</p>
          </Card>
        </motion.div>
      ))}
    </div>
  </section>
);

export default Features;
