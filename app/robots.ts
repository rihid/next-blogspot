import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/cms/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Search result pages are noindex; label archives stay crawlable.
        disallow: ["/search?*", "/search$"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
