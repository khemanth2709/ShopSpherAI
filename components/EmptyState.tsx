import Link from 'next/link';
import { PackageSearch } from 'lucide-react';
export default function EmptyState({ title, message, href = '/', action = 'Browse products' }: { title: string; message: string; href?: string; action?: string }) {
 return <div className="mx-auto flex max-w-lg flex-col items-center py-16 text-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage"><PackageSearch size={24}/></span><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-ink/55">{message}</p><Link href={href} className="pill-button mt-5 bg-ink text-white hover:bg-moss">{action}</Link></div>;
}
