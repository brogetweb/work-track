import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper px-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">WorkTrack</p>
        <h1 className="mt-2 font-serif text-5xl">That page is not here.</h1>
        <Link href="/" className="mt-4 inline-block text-sm font-semibold text-accent">Back to WorkTrack</Link>
      </div>
    </div>
  );
}
