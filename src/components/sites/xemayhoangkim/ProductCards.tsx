import Image from "next/image";
import Link from "next/link";
import { priceLabel, productHref, type ProductSummary } from "@/lib/products";
import { brandName, type Taxonomy } from "@/lib/taxonomy";

// A grid of product cards (a collection page, search...).
export function ProductCards({ products, taxonomy }: { products: ProductSummary[]; taxonomy: Taxonomy }) {
  return (
    <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.slug} className="bg-white">
          <Link href={productHref(p.slug)} className="group block p-4">
            <div className="relative aspect-[4/3] overflow-hidden bg-white">
              {p.img && <Image src={p.img} alt="" fill sizes="(min-width: 1024px) 280px, 50vw" className="object-contain transition duration-500 group-hover:scale-105" />}
            </div>
            <p className="mt-3 text-sm font-semibold uppercase group-hover:text-[#de0000]">{p.name}</p>
            <p className="text-xs text-neutral-500">{p.brand ? brandName(taxonomy, p.brand) : ""}</p>
            <p className="mt-1 text-sm font-semibold text-[#de0000]">{priceLabel(p)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
