import Image from "next/image";
import Link from "next/link";

// A picture between the home page blocks, optionally a link (a path on this site, an anchor, https://, tel: or mailto:).
export function PromoBanner({ id, name, image, link }: { id: string; name: string; image: string; link: string }) {
  const pic = <Image src={image} alt={name} width={1600} height={500} sizes="100vw" className="block h-auto w-full" />;
  const external = /^(https?:|tel:|mailto:)/i.test(link);
  return (
    <section id={id} className="mx-auto max-w-[1250px] scroll-mt-28 px-4 py-6">
      {!link ? (
        pic
      ) : external ? (
        <a href={link} {...(/^https?:/i.test(link) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{pic}</a>
      ) : (
        <Link href={link}>{pic}</Link>
      )}
    </section>
  );
}
