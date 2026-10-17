// the measurement templates; the same rows are inserted by supabase/migrations/0001_init.sql
export const CATEGORIES = [
  { code: 'top', label_ja: 'トップス・Tシャツ', measurements: ['着丈', '身幅', '肩幅', '袖丈'], size_line: ['着丈', '身幅'], sort: 10 },
  { code: 'jacket', label_ja: 'ジャケット', measurements: ['着丈', '身幅', '肩幅', '袖丈'], size_line: ['着丈', '身幅'], sort: 20 },
  { code: 'knit', label_ja: 'ニット', measurements: ['着丈', '身幅', '肩幅', '袖丈'], size_line: ['着丈', '身幅'], sort: 30 },
  { code: 'pants', label_ja: 'パンツ', measurements: ['ウエスト', '股下', '総丈', 'わたり', '裾幅'], size_line: ['ウエスト', '股下'], sort: 40 },
  { code: 'bag', label_ja: 'バッグ', measurements: ['幅', '高さ', 'マチ', 'ショルダー'], size_line: ['幅', '高さ'], sort: 50 },
  { code: 'hat', label_ja: '帽子', measurements: ['頭囲', 'つば'], size_line: ['頭囲', 'つば'], sort: 60 },
  { code: 'socks', label_ja: 'ソックス', measurements: ['対応サイズ'], size_line: [], sort: 70 },
  { code: 'scarf', label_ja: 'マフラー・ネックウェア', measurements: ['全長', '幅'], size_line: ['全長', '幅'], sort: 80 },
  { code: 'other', label_ja: 'その他', measurements: ['幅', '高さ'], size_line: ['幅', '高さ'], sort: 90 },
];
