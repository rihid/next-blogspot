import type { MetadataRoute } from "next";

import { encodePostPath, getCms } from "@/lib/cms";
import { SITE_URL } from "@/lib/cms/config";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cms = getCms();
  const [paths, labels] = await Promise.all([cms.getAllPostPaths(), cms.listLabels()]);

  return [
    {
      url: `${SITE_URL}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/posts`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...labels.map((label) => ({
      url: `${SITE_URL}/search/label/${encodeURIComponent(label.name)}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...paths.map((path) => ({
      url: `${SITE_URL}/${encodePostPath(path)}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
