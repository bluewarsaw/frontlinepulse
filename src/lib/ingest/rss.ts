/** Minimalny parser RSS 2.0 — bez zewnętrznych zależności. */

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
  guid: string;
  categories: string[];
}

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string): string {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : "";
}

function allTags(block: string, name: string): string[] {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out.push(decodeEntities(m[1]));
  return out;
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const block = m[1];
    const title = tag(block, "title");
    const link = tag(block, "link");
    if (!title || !link) continue;
    const guid = tag(block, "guid") || link;
    items.push({
      title,
      link,
      description: tag(block, "description"),
      pubDate: tag(block, "pubDate") || null,
      guid,
      categories: allTags(block, "category"),
    });
  }
  return items;
}

export async function fetchRss(url: string): Promise<RssItem[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "FrontlinePulse/0.1 (+https://frontlinepulse.vercel.app)",
      Accept: "application/rss+xml, application/xml, text/xml, */*",
    },
  });
  if (!res.ok) throw new Error(`RSS ${url}: HTTP ${res.status}`);
  return parseRss(await res.text());
}

/** Deterministyczny jitter, żeby punkty z tego samego centroidu się nie nakładały. */
export function jitterFromKey(key: string, scale = 0.35): [number, number] {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const dLat = ((h % 1000) / 1000 - 0.5) * scale;
  const dLng = (((h / 1000) % 1000) / 1000 - 0.5) * scale;
  return [dLat, dLng];
}

export function parsePubDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
