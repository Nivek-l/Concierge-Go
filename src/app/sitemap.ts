import { MetadataRoute } from 'next';

// Your live application domain
const BASE_URL = 'https://conciergego.vercel.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: `${BASE_URL}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];
}
