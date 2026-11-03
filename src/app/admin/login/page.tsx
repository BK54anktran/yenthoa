import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { authConfigured, isAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Đăng nhập quản trị", robots: { index: false, follow: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm bg-white p-6 shadow">
        <h1 className="mb-5 text-xl font-semibold">Đăng nhập quản trị</h1>
        {authConfigured() ? (
          <LoginForm />
        ) : (
          <p role="alert" className="text-sm text-[#de0000]">
            Chưa cấu hình tài khoản quản trị. Chạy <code>npm run admin:hash -- &quot;mật khẩu&quot;</code> rồi đặt ADMIN_PASSWORD_HASH và SESSION_SECRET trong môi trường của máy chủ.
          </p>
        )}
      </div>
    </main>
  );
}
