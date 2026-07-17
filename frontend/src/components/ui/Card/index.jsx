import { motion } from "framer-motion";

const Card = ({ children, hoverable = false, className = "", as = "div", ...rest }) => {
  const Comp = motion[as] ?? motion.div;
  return (
    <Comp
      className={`rounded-md border border-border bg-canvas p-5 ${
        hoverable ? "transition-colors duration-150 hover:border-border-strong" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  );
};

export default Card;
