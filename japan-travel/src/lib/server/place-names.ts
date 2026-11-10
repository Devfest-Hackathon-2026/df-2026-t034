import OpenCC from 'opencc-js';

const compareName = OpenCC.Converter({ from: 'jp', to: 'cn' });

function removeDuplicateNameTranslations(text: string): string {
  return text.replace(
    /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー・]{1,64})[ \t]*[(（]([^()（）\n]{1,64})[)）]/gu,
    (match, original: string, translation: string) => {
      if (!/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー・ \t]+$/u.test(translation)) return match;
      const translated = compareName(translation.trim()).normalize('NFKC');
      const characters = [...original];
      // A name may follow a verb without a space: “游览大通公園(大通公园)”.
      // Compare bounded suffixes, but preserve every original character.
      for (let start = Math.max(0, characters.length - 48); start < characters.length; start++) {
        const candidate = characters.slice(start).join('');
        if (compareName(candidate).normalize('NFKC') === translated) return original;
      }
      return match;
    },
  );
}

// Verified original: https://akihabara-radiokaikan.co.jp/
// Chinese: https://www.gotokyo.org/cn/story/walks-and-tours/akihabara/index.html
// Only correct this known facility, never translate arbitrary names or URLs.
export function normalizeVerifiedPlaceNames(reply: string): string {
  return reply.split(/(https?:\/\/[^\s<>]+)/g).map((part) => {
    if (/^https?:\/\//.test(part)) return part;
    const normalized = part.replace(
      /(?:秋[葉叶]原(?:的)?[ \t]*)?(?:Radio[ \t]*会[館馆]|ラジオ[ \t]*会[館馆])(?:[ \t]*[(（][ \t]*(?:(?:秋[葉叶]原)?[ \t]*(?:无线电|無線電|广播|廣播|Radio|ラジオ)[ \t]*会[館馆])[ \t]*[)）])?(?!店)/gi,
      '秋葉原ラジオ会館(秋叶原无线电会馆)',
    )
      // These are duplicate romanizations of established Japanese city names,
      // not Chinese translations. Leave arbitrary parenthetical notes alone.
      .replace(/札幌[ \t]*[(（]Sapporo[)）]/gi, '札幌')
      .replace(/小樽[ \t]*[(（]Otaru[)）]/gi, '小樽')
      .replace(/函館[ \t]*[(（]Hakodate[)）]/gi, '函館')
      .replace(/富良野[ \t]*[(（]Furano[)）]/gi, '富良野')
      .replace(/美瑛[ \t]*[(（]Biei[)）]/gi, '美瑛')
      .replace(/アニメイト[ \t]*池袋本店[ \t]*[(（]Animate[ \t]*池袋(?:总店|總店|本店)[)）]/gi, 'アニメイト池袋本店');
    return removeDuplicateNameTranslations(normalized);
  }).join('');
}
