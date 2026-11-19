import { DesalModule } from "@/components/sections/DesalModule";
import { DisruptionStory } from "@/components/sections/DisruptionStory";
import { ExplodedView } from "@/components/sections/ExplodedView";
import { ReservoirSection } from "@/components/sections/ReservoirSection";
import { SiteFooter, SiteHeader } from "@/components/sections/SiteChrome";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <ExplodedView />
        <DisruptionStory />
        <DesalModule />
        <ReservoirSection />
      </main>
      <SiteFooter />
    </>
  );
}
