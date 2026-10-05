import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="muted mt-2">It may have been removed, or the link may be wrong.</p>
      <p className="mt-6">
        <Link href="/feed" className="btn btn-primary">
          Go to the community
        </Link>
      </p>
    </div>
  );
}
