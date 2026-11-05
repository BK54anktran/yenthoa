import { HomeSectionsForm } from "@/components/admin/HomeSectionsForm";
import { getAllSlides } from "@/lib/admin-repo";
import { getAllTemplates, getCollections, getHomeSections, getProducts, getTaxonomy } from "@/lib/repo";
import { activeOnly } from "@/lib/taxonomy";

export default async function HomeAdmin() {
  const [sections, products, taxonomy, slides, collections, templates] = await Promise.all([getHomeSections(), getProducts(), getTaxonomy(), getAllSlides(), getCollections(), getAllTemplates()]);
  return (
    <HomeSectionsForm
      sections={sections}
      slides={slides}
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      templates={templates.map((t) => ({ id: t.id, name: t.name, description: t.description, fields: t.fields }))}
      brands={activeOnly(taxonomy.brands)}
      products={products.map((p) => ({ slug: p.slug, name: p.name, brand: p.brand }))}
    />
  );
}
