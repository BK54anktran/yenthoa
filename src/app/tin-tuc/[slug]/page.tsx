import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/sites/xemayhoangkim/ArticleView";
import { Header } from "@/components/sites/xemayhoangkim/Header";
import { Footer, FloatingButtons } from "@/components/sites/xemayhoangkim/Sections";
import { getPostBySlug } from "@/lib/repo";
import { getShop } from "@/lib/shop";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = await getPostBySlug((await params).slug);
  if (!post) return {};
  const shop = await getShop();
  return {
    title: `${post.title} - ${shop.brand}`,
    description: post.excerpt,
    openGraph: post.img ? { images: [post.img] } : undefined,
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPostBySlug((await params).slug);
  if (!post) notFound();
  return (
    <>
      <Header />
      <main>
        <ArticleView post={post} />
      </main>
      <Footer />
      <FloatingButtons />
    </>
  );
}
