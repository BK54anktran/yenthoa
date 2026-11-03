import { PostForm } from "@/components/admin/PostForm";
import { PageTitle } from "@/components/admin/ui";

export default function NewPost() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageTitle>Thêm bài viết</PageTitle>
      <PostForm today={today} />
    </>
  );
}
