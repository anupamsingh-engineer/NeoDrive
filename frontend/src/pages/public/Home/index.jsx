import Hero from "./components/Hero";
import Features from "./components/Features";
import PricingTeaser from "./components/PricingTeaser";
import CtaSection from "./components/CtaSection";

const HomePage = () => (
  <div className="flex flex-1 flex-col">
    <Hero />
    <div className="border-t border-border">
      <Features />
    </div>
    <div className="border-t border-border">
      <PricingTeaser />
    </div>
    <CtaSection />
  </div>
);

export default HomePage;
