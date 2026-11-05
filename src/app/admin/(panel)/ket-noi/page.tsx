import { headers } from "next/headers";
import { deleteKeyAction, toggleKeyAction } from "@/app/admin/key-actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { KeyForm } from "@/components/admin/KeyForm";
import { PageTitle } from "@/components/admin/ui";
import { listApiKeys } from "@/lib/api-keys";

const when = (t: string | null) => (t ? t.slice(0, 16).replace("T", " ") : "Chưa dùng");

export default async function ConnectAdmin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const keys = await listApiKeys();
  return (
    <>
      <PageTitle>Kết nối</PageTitle>
      <div className="space-y-8">
        <KeyForm mcpUrl={`${proto}://${host}/api/mcp`} />
        <div className="overflow-x-auto border border-neutral-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr><th className="p-3">Tên</th><th className="hidden p-3 sm:table-cell">Key</th><th className="hidden p-3 sm:table-cell">Ngày tạo</th><th className="hidden p-3 sm:table-cell">Dùng lần cuối</th><th className="p-3">Trạng thái</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {keys.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-neutral-500">Chưa có key nào.</td></tr>}
              {keys.map((k) => (
                <tr key={k.id} className="border-t border-neutral-100">
                  <td className="p-3"><span className="font-medium">{k.name}</span><span className="mt-1 block font-mono text-xs text-neutral-500 sm:hidden">{k.key_prefix}… · {when(k.last_used_at)}</span></td>
                  <td className="hidden p-3 font-mono text-xs text-neutral-600 sm:table-cell">{k.key_prefix}…</td>
                  <td className="hidden p-3 whitespace-nowrap sm:table-cell">{when(k.created_at)}</td>
                  <td className="hidden p-3 whitespace-nowrap sm:table-cell">{when(k.last_used_at)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <form action={toggleKeyAction}>
                      <input type="hidden" name="id" value={k.id} />
                      <button className={`cursor-pointer ${k.active ? "text-green-700 hover:underline" : "text-neutral-400 hover:underline"}`}>{k.active ? "Đang bật" : "Đang tắt"}</button>
                    </form>
                  </td>
                  <td className="p-3 text-right">
                    <form action={deleteKeyAction}>
                      <input type="hidden" name="id" value={k.id} />
                      <ConfirmButton message={`Xoá key "${k.name}"? Thiết bị đang dùng key này sẽ không kết nối được nữa.`} className="cursor-pointer text-xs text-neutral-500 hover:text-[#de0000] hover:underline">Xoá</ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
