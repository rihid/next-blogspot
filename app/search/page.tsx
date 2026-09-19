import type { Metadata } from "next";

import { SearchBox } from "@/components/search";

export const metadata: Metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Search</h1>
      <SearchBox />
    </div>
  );
}
