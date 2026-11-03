import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Phone, MessageCircle } from "lucide-react";
import { telHref } from "./data";
import { formatDate, postHref, type PostDetailData } from "@/lib/posts";
import { getTaxonomy } from "@/lib/repo";
import { sectionName } from "@/lib/taxonomy";
import { NewsSidebar } from "./NewsSidebar";
import { getRelatedPosts } from "@/lib/repo";
import { getShop } from "@/lib/shop";

export async function ArticleView({ post }: { post: PostDetailData }) {
  const { brand: BRAND, hotlines: HOTLINES, facebook: FACEBOOK } = await getShop();
  const related = await getRelatedPosts(post.slug, post.section, 3);
  const taxonomy = await getTaxonomy();

  return (
    <div className="bg-neutral-100 pb-12">
      <div className="mx-auto max-w-[1250px] px-4">
        <nav aria-label="Đường dẫn" className="flex flex-wrap items-center gap-1 py-4 text-xs text-neutral-500">
          <Link href="/" className="hover:text-[#de0000]">Trang chủ</Link>
          <ChevronRight size={12} />
          <Link href="/tin-tuc" className="hover:text-[#de0000]">Tin tức</Link>
          <ChevronRight size={12} />
          <span className="line-clamp-1 font-semibold text-neutral-800">{post.title}</span>
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="min-w-0">
            <article className="bg-white p-5 md:p-10">
              <header>
                <p className="text-xs">
                  <Link href={`/tin-tuc?muc=${post.section}`} className="bg-[#e32020] px-2 py-1 font-semibold uppercase text-white">
                    {sectionName(taxonomy, post.section)}
                  </Link>
                  <span className="ml-3 text-neutral-500">
                    {formatDate(post.date)} · Đăng bởi {BRAND}
                  </span>
                </p>
                <h1 className="mt-4 text-2xl font-semibold leading-snug md:text-3xl">{post.title}</h1>
              </header>

              <div className="prose-content mt-6" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: post.html }} />

              <div className="mt-8 grid gap-3 border-t border-neutral-200 pt-6 sm:grid-cols-3">
                {HOTLINES.map((n) => (
                  <a key={n} href={telHref(n)} className="flex items-center justify-center gap-2 bg-[#de0000] px-4 py-3 text-sm font-bold text-white hover:bg-[#b80000]">
                    <Phone size={16} /> Gọi {n}
                  </a>
                ))}
                <a href={FACEBOOK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#0a7cff] px-4 py-3 text-sm font-bold text-white hover:bg-[#0866d4]">
                  <MessageCircle size={16} /> Nhắn tin Facebook
                </a>
              </div>
            </article>

            {related.length > 0 && (
              <section className="mt-6 bg-white p-5 md:p-8" aria-label="Bài viết liên quan">
                <h2 className="mb-5 text-lg font-semibold uppercase">Bài viết liên quan</h2>
                <ul className="grid gap-4 sm:grid-cols-3">
                  {related.map((a) => (
                    <li key={a.slug}>
                      <Link href={postHref(a.slug)} className="group block">
                        <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
                          <Image src={a.img!} alt="" fill sizes="(min-width: 640px) 260px, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />
                        </div>
                        <p className="mt-2 text-sm font-semibold leading-snug group-hover:text-[#de0000]">{a.title}</p>
                        <p className="text-xs text-neutral-400">{formatDate(a.date)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <NewsSidebar />
        </div>
      </div>
    </div>
  );
}
