import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../../components/ui";
import { fadeUp } from "../../../../motion";

const CtaSection = () => {
  const navigate = useNavigate();

  return (
    <section className="bg-brand">
      <motion.div
        variants={fadeUp}
        initial="initial"
        whileInView="animate"
        viewport={{ once: true }}
        className="mx-auto flex w-full max-w-page flex-col items-center gap-5 px-6 py-20 text-center"
      >
        <h2 className="text-3xl font-semibold text-white">Ready to get started?</h2>
        <p className="max-w-md text-white/80">
          Create a free account in seconds and start uploading right away.
        </p>
        <Button
          variant="secondary"
          size="lg"
          className="border-transparent bg-white text-brand hover:bg-white/90"
          onClick={() => navigate("/auth/register")}
        >
          Create your account
        </Button>
      </motion.div>
    </section>
  );
};

export default CtaSection;
