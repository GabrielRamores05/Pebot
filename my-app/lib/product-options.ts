import { prisma } from '@/lib/prisma';

// Server-side resolution of product option selections. The client only ever
// sends option IDs — names, prices and recipe multipliers are looked up here
// so nothing shown or charged can be tampered with from the browser.

export interface ResolvedSelection {
  optionId: number;
  groupId: number;
  groupName: string;
  selectionType: string;
  scalesRecipe: boolean;
  name: string;
  priceDelta: number;
  sizeMultiplier: number;
}

/**
 * Validates and resolves raw option IDs for one order line.
 * - every option must exist, be available, and belong to a group attached to
 *   the given product
 * - "single"-type groups may only appear once (one Size per drink)
 */
export async function resolveSelections(productId: number, rawOptionIds: unknown): Promise<ResolvedSelection[]> {
  if (!Array.isArray(rawOptionIds)) return [];

  const ids = [
    ...new Set(
      rawOptionIds
        .map((v) => parseInt(String(v), 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];
  if (ids.length === 0) return [];

  const options = await prisma.option.findMany({
    where: { id: { in: ids } },
    include: { group: true },
  });

  if (options.length !== ids.length) {
    throw new Error('One or more selected options do not exist');
  }

  const attachments = await prisma.productOptionGroup.findMany({
    where: { productId },
    select: { groupId: true },
  });
  const allowedGroupIds = new Set(attachments.map((a) => a.groupId));

  const seenSingleGroups = new Set<number>();
  for (const opt of options) {
    if (!opt.available) {
      throw new Error(`Option "${opt.name}" is currently unavailable`);
    }
    if (!allowedGroupIds.has(opt.groupId)) {
      throw new Error(`Option "${opt.name}" is not offered on this product`);
    }
    if (opt.group.selectionType === 'single') {
      if (seenSingleGroups.has(opt.groupId)) {
        throw new Error(`Only one "${opt.group.name}" option can be chosen`);
      }
      seenSingleGroups.add(opt.groupId);
    }
  }

  return options.map((o) => ({
    optionId: o.id,
    groupId: o.groupId,
    groupName: o.group.name,
    selectionType: o.group.selectionType,
    scalesRecipe: o.group.scalesRecipe,
    name: o.name,
    priceDelta: o.priceDelta ?? 0,
    sizeMultiplier: o.sizeMultiplier ?? 1,
  }));
}

/** Peso adders summed — added to the product's base price. */
export function selectionsPriceAdder(sel: ResolvedSelection[]): number {
  return sel.reduce((s, x) => s + (x.priceDelta || 0), 0);
}

/**
 * Recipe scaling factor for this line: the product of multipliers from every
 * selected option whose group is flagged as recipe-scaling (e.g. Size).
 */
export function selectionsRecipeMultiplier(sel: ResolvedSelection[]): number {
  return sel
    .filter((x) => x.scalesRecipe)
    .reduce((m, x) => m * (x.sizeMultiplier || 1), 1);
}

/** Human label for tickets/receipts, e.g. "(Large · Hot · +Extra Shot)". */
export function selectionsLabel(sel: ResolvedSelection[]): string {
  if (sel.length === 0) return '';
  return ` (${sel.map((x) => (x.priceDelta > 0 ? `+${x.name}` : x.name)).join(' · ')})`;
}

/** Label from an OrderItem's stored selections JSON, e.g. " (Large · Hot)". */
export function selectionsLabelFromJson(json: string | null | undefined): string {
  if (!json) return '';
  try {
    const arr = JSON.parse(json) as { name: string }[];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return ` (${arr.map((x) => x.name).join(' · ')})`;
  } catch {
    return '';
  }
}
