import Image from "next/image";
import Link from "next/link";
import { collectionHref, productsOf, type Collection } from "@/lib/collections";
import type { ProductSummary } from "@/lib/products";

// The collections that are shown and have at least one product, as cards (home page block and /bo-suu-tap).
export function visibleCollections(collections: Collection[], products: ProductSummary[]) {
  return collections
    .filter((c) => c.active)
    .map((c) => {
      const items = productsOf(c, products);
      return { c, count: items.length, image: c.image || items.find((p) => p.img)?.img || "" };
    })
    .filter((x) => x.count > 0);
}

export function CollectionCards({ cards }: { cards: ReturnType<typeof visibleCollections> }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {cards.map(({ c, count, image }) => (
        <li key={c.id} className="bg-white">
          <Link href={collectionHref(c.id)} className="group block p-4">
            <div className="relative aspect-[4/3] overflow-hidden bg-white">
              {image && <Image src={image} alt="" fill sizes="(min-width: 1024px) 280px, 50vw" className="object-contain p-2 transition duration-500 group-hover:scale-105" />}
            </div>
            <p className="mt-3 text-sm font-semibold uppercase group-hover:text-[#de0000]">{c.name}</p>
            <p className="text-xs text-neutral-500">{count} xe</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
