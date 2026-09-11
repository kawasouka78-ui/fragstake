import { catalog, cosmeticSlot } from './catalog.ts';

export const previewArmoryKey = 'fragstake-preview-armory';

/** Device-local preview inventory with paid cosmetic unlocks. */
export class PreviewArmory {
  owned = new Set<string>();
  finish = '';
  knife = '';
  get spent() {
    return catalog
      .filter((item) => this.owned.has(item.sku))
      .reduce((sum, item) => sum + item.price, 0);
  }
  get inventory() {
    return catalog
      .filter(
        (item) =>
          this.owned.has(item.sku) ||
          item.sku === this.finish ||
          item.sku === this.knife,
      )
      .map((item) => ({
        sku: item.sku,
        equipped: Number(item.sku === this.finish || item.sku === this.knife),
      }));
  }
  buy(sku: string, balance: number) {
    const item = catalog.find((item) => item.sku === sku);
    if (!item) throw new Error('Unknown cosmetic.');
    if (item.price === 0 || this.owned.has(sku)) {
      this.owned.add(sku);
      return 0;
    }
    if (balance < item.price)
      throw new Error('Add enough demo credits in your wallet first.');
    this.owned.add(sku);
    return item.price;
  }
  equip(sku: string, slot?: unknown) {
    const item = catalog.find((item) => item.sku === sku);
    if (sku && !item) throw new Error('Unknown cosmetic.');
    if ((item ? cosmeticSlot(item) : slot) === 'knife') {
      if (sku && !this.owned.has(sku))
        throw new Error('Buy this knife in the shop first.');
      this.knife = sku;
    } else if (sku && item && item.price > 0 && !this.owned.has(sku)) {
      throw new Error('Buy this finish in the shop first.');
    } else this.finish = sku;
  }
  serialize() {
    return JSON.stringify({
      version: 2,
      owned: [...this.owned],
      finish: this.finish,
      knife: this.knife,
    });
  }
  restore(raw: string) {
    try {
      const saved = JSON.parse(raw);
      const rawOwnedSkus = Array.isArray(saved.owned)
        ? saved.owned
        : Array.isArray(saved.knives)
          ? saved.knives
          : [];
      const ownedSkus =
        saved.version === 2
          ? rawOwnedSkus
          : rawOwnedSkus.filter((sku: unknown) => sku !== 'inferno');
      this.owned = new Set(
        catalog
          .filter((item) => ownedSkus.includes(item.sku))
          .map((item) => item.sku),
      );
      this.finish = catalog.some(
        (item) =>
          item.sku === saved.finish &&
          cosmeticSlot(item) === 'finish' &&
          this.owned.has(item.sku),
      )
        ? saved.finish
        : '';
      this.knife = this.owned.has(saved.knife) ? saved.knife : '';
    } catch {
      /* Keep defaults if a saved preview is unreadable. */
    }
  }
}
