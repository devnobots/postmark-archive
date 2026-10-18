// Postmark Archive back office: one place to open the title meter and remember results by text.
import { TitleMeter } from './lib/measure.mjs';
import { toSiteItem, siteDropDate } from './lib/site-data.mjs';

const cache = new Map();

export function siteDrop(drop) { return { no: drop ? drop.no : 1, date: drop ? siteDropDate(drop.release_date) : '' }; }

// sample: a database piece with an English title (its #address must open the piece page in the meter's frames)
export async function openMeter(sample, drop) {
  const m = new TitleMeter('/');
  await m.open(toSiteItem(sample, drop || { status: 'live' }), siteDrop(drop));
  return m;
}

// the same texts always measure the same, so the list can reuse earlier results
export function checkCached(meter, t) {
  const k = JSON.stringify([t.nameJa || '', t.nameEn || '', t.capJa || '']);
  if (!cache.has(k)) cache.set(k, meter.check({ nameJa: t.nameJa || '', nameEn: t.nameEn || '', capJa: t.capJa || '' }));
  return cache.get(k);
}

export function titlesOf(p) { return { nameJa: p.name_ja, nameEn: p.name_en, capJa: p.cap_ja }; }
