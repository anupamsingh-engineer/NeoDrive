import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { fadeUp } from "../../../motion";

// Deliberately not AnimatePresence/mode="wait": that mode withholds rendering the entering
// page until the exiting page's exit animation fully signals completion, which — combined
// with React.lazy route components suspending mid-transition — can leave the entering page
// permanently unrendered until a hard refresh. A plain enter-only fade avoids that failure
// mode entirely; the old content is just removed immediately on route change.
const PageTransition = ({ children }) => {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      variants={fadeUp}
      initial="initial"
      animate="animate"
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;
