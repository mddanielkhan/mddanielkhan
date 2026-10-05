import Link from "next/link";
import { Compass, Icon } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center sm:py-24">
      <span className="icon-tile h-14 w-14 rounded-2xl">
        <Icon icon={Compass} className="h-7 w-7" />
      </span>
      <p className="mt-6 text-sm font-bold uppercase tracking-wider text-muted">Error 404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-3 text-muted">It may have been removed, made private, or the link may be wrong.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/feed" className="btn btn-primary">
          Go to the community
        </Link>
        <Link href="/" className="btn btn-secondary">
          Home
        </Link>
      </div>
    </div>
  );
}
