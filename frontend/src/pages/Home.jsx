import { Hero } from '@/sections/Hero';
import { Features } from '@/sections/Features';
import { FeaturedProducts } from '@/sections/FeaturedProducts';
import { About } from '@/sections/About';
import { Categories } from '@/sections/Categories';
import { HomeSEO } from '@/components/SEO';
import { OrganizationStructuredData, WebsiteStructuredData } from '@/components/StructuredData';

export function Home() {
  return (
    <>
      <HomeSEO />
      <OrganizationStructuredData />
      <WebsiteStructuredData />
      <main className="overflow-x-hidden bg-gradient-light">
        <Hero />
        <Features />
        <FeaturedProducts />
        <About />
        <Categories />
      </main>
    </>
  );
}
