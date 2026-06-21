import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const loc = z.object({ en: z.string(), tr: z.string(), de: z.string() });
const locArr = z.object({
  en: z.array(z.string()),
  tr: z.array(z.string()),
  de: z.array(z.string()),
});
const faqList = z.array(z.object({ q: z.string(), a: z.string() }));
const locFaq = z.object({ en: faqList, tr: faqList, de: faqList });

const games = defineCollection({
  loader: glob({ pattern: '**/[^_]*.json', base: './src/content/games' }),
  schema: z.object({
    slug: z.string(),
    category: z.enum(['arcade', 'puzzle', 'word', 'action']),
    accent: z.string().default('#a855f7'),
    order: z.number().default(100),
    playable: z.boolean().default(true),
    title: loc,
    tagline: loc,
    description: loc,
    howToPlay: locArr,
    controls: locArr,
    tips: locArr.optional(),
    faq: locFaq,
    keywords: loc,
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { games };
