import Link from "next/link";
import { CollectionCards, visibleCollections } from "@/components/sites/xemayhoangkim/CollectionCards";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { Hero } from "@/components/sites/xemayhoangkim/Hero";
import { CategorySection, type ShowcaseCategory } from "@/components/sites/xemayhoangkim/CategorySection";
import { PromoBanner } from "@/components/sites/xemayhoangkim/PromoBanner";
import { Facts, Services, News, Visit, Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import type { HomeSection } from "@/lib/home-sections";
import { collectionHref, productsOf } from "@/lib/collections";
import { priceLabel, productHref } from "@/lib/products";
import { getHeroSlides, getCollections, getHomeSections, getProducts, getLatestPosts } from "@/lib/repo";
import { postHref } from "@/lib/posts";
import { getShop } from "@/lib/shop";

type Block =
  | { kind: "hero" }
  | { kind: "cat"; cat: ShowcaseCategory }
  | { kind: "html"; section: HomeSection }
  | { kind: "banner"; banner: HomeSection }
  | { kind: "collections"; section: HomeSection; cards: ReturnType<typeof visibleCollections> };

export default async function Home() {
  const [slides, products, sections, collections, shop, newest] = await Promise.all([getHeroSlides(), getProducts(), getHomeSections(), getCollections(), getShop(), getLatestPosts(2, true)]);

  // the blocks the admin arranged (one per brand until the admin changes it), built from the products in the database
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const blocks: Block[] = [];
  for (const s of sections) {
    if (!s.active) continue;
    if (s.kind === "slides") {
      blocks.push({ kind: "hero" });
      continue;
    }
    if (s.kind === "collections") {
      const all = visibleCollections(collections, products);
      const cards = s.slugs.length ? s.slugs.map((id) => all.find((x) => x.c.id === id)).filter((x): x is (typeof all)[number] => !!x) : all;
      if (s.display === "cards") {
        if (cards.length) blocks.push({ kind: "collections", section: s, cards });
      } else {
        // each collection is a showcase of its own: big photo on its background, strip of its models
        for (const { c } of cards) {
          const models = productsOf(c, products).filter((p) => p.img).map((p) => ({ name: p.name, price: priceLabel(p), img: p.img!, href: productHref(p.slug) }));
          if (models.length) blocks.push({ kind: "cat", cat: { id: `${s.id}-${c.id}`, name: c.name, total: models.length, href: collectionHref(c.id), backdrop: c.backdrop ? { src: c.backdrop, dark: c.dark } : null, backdropMobile: c.backdropMobile || "", models } });
        }
      }
      continue;
    }
    if (s.kind === "html") {
      if (s.html?.trim()) blocks.push({ kind: "html", section: s });
      continue;
    }
    if (s.kind === "banner") {
      if (s.image) blocks.push({ kind: "banner", banner: s });
      continue;
    }
    const collection = s.collection ? collections.find((c) => c.id === s.collection && c.active) : undefined;
    if (s.collection && !collection) continue; // its collection was deleted or hidden
    const list = collection ? productsOf(collection, products) : s.slugs.length > 0 ? s.slugs.map((x) => bySlug.get(x)).filter((p): p is NonNullable<typeof p> => !!p) : products.filter((p) => p.brand === s.brand);
    const models = list.filter((p) => p.img).map((p) => ({ name: p.name, price: priceLabel(p), img: p.img!, href: productHref(p.slug) }));
    if (models.length === 0) continue;
    blocks.push({
      kind: "cat",
      cat: {
        id: s.id,
        name: s.name,
        total: collection || s.slugs.length > 0 ? models.length : list.length,
        href: collection ? collectionHref(collection.id) : s.brand ? `/xe-may?nhom=${s.brand}` : null,
        // a section fed by a collection looks the way that collection says; otherwise it uses its own background
        backdrop: collection ? (collection.backdrop ? { src: collection.backdrop, dark: collection.dark } : null) : s.backdrop ? { src: s.backdrop, dark: s.dark } : null,
        backdropMobile: (collection ? collection.backdropMobile : s.backdropMobile) || "",
        models,
      },
    });
  }

  // the small cards in the corner of the banner: the newest articles (default), the admin's own list, or none
  const slidesBlock = sections.find((s) => s.kind === "slides");
  const cornerCards =
    slidesBlock?.cardsMode === "off"
      ? []
      : slidesBlock?.cardsMode === "custom" && slidesBlock.cards?.length
        ? slidesBlock.cards.map((c) => ({ title: c.title, img: c.img, href: c.link }))
        : newest.map((n) => ({ title: n.title, img: n.img!, href: postHref(n.slug) }));

  return (
    <>
      <Header />
      <main>
        {blocks.map((x) => {
          switch (x.kind) {
            case "hero":
              return (
                <div key="hero">
                  <Hero slides={slides} cards={cornerCards} />
                  <Facts
                    items={[
                      { n: products.length, label: "mẫu xe đang bán" },
                      { n: new Set(products.map((p) => p.brand)).size, label: "hãng xe" },
                      { n: shop.branches.length, label: "cửa hàng" },
                    ]}
                    hotline={shop.hotlines[0]}
                  />
                </div>
              );
            case "cat":
              return <CategorySection key={x.cat.id} cat={x.cat} />;
            case "collections":
              return (
                <section key={x.section.id} id={x.section.id} className="mx-auto max-w-[1250px] scroll-mt-28 px-4 py-10">
                  <h2 className="mb-6 text-center text-3xl font-semibold uppercase md:text-4xl">{x.section.name}</h2>
                  <CollectionCards cards={x.cards} />
                  <p className="mt-6 text-center">
                    <Link href="/bo-suu-tap" className="inline-flex items-center gap-2 bg-black px-6 py-3 text-xs font-bold uppercase text-white hover:bg-[#de0000]">Xem tất cả bộ sưu tập</Link>
                  </p>
                </section>
              );
            case "html":
              // no padding of its own: the HTML sets its spacing itself (margin in its CSS); only the shared width container stays
              return (
                <section key={x.section.id} id={x.section.id} className="mx-auto max-w-[1250px] scroll-mt-28 px-4">
                  <div className="prose-content" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: x.section.html ?? "" }} />
                </section>
              );
            case "banner":
              return <PromoBanner key={x.banner.id} id={x.banner.id} name={x.banner.name} image={x.banner.image} link={x.banner.link} />;
          }
        })}
        <Services />
        <News />
        <Visit />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
