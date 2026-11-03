import { notFound } from "next/navigation";
import { PostForm } from "@/components/admin/PostForm";
import { PageTitle } from "@/components/admin/ui";
import { getPostById } from "@/lib/admin-repo";

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const post = Number.isInteger(id) ? await getPostById(id) : null;
  if (!post) notFound();
  return (
    <>
      <PageTitle>Sửa bài viết</PageTitle>
      <PostForm post={post} today={post.date} />
    </>
  );
}
