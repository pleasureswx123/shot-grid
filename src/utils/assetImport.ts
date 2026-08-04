import type { AssetCategory, ImportedAssetData } from '../types';

export interface ParsedAssetRow extends ImportedAssetData {
  sourceRow: number;
  warnings: string[];
}

const categoryAliases: Record<string, AssetCategory> = {
  '角色': '角色',
  'character': '角色',
  'char': '角色',
  '场景': '场景',
  '环境': '场景',
  'scene': '场景',
  'environment': '场景',
  '道具': '道具',
  'prop': '道具',
  '服装': '服装',
  'costume': '服装',
  '载具': '载具',
  'vehicle': '载具',
  '生物': '生物',
  'creature': '生物',
  '风格参考': '风格参考',
  '风格': '风格参考',
  'style': '风格参考',
  'style reference': '风格参考',
};

const normalizeHeader = (value: string): string =>
  value.trim().toLocaleLowerCase('zh-CN').replace(/[\s_\-（）()]/g, '');

const readCell = (
  row: Record<string, unknown>,
  aliases: string[],
): string => {
  const aliasSet = new Set(aliases.map(normalizeHeader));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizeHeader(key)));
  if (!entry || entry[1] === null || entry[1] === undefined) return '';
  return String(entry[1]).trim();
};

export const normalizeAssetCategory = (
  value: string,
): { category: AssetCategory; usedFallback: boolean } => {
  const normalized = value.trim().toLocaleLowerCase('zh-CN');
  const category = categoryAliases[normalized];
  return category
    ? { category, usedFallback: false }
    : { category: '道具', usedFallback: Boolean(normalized) };
};

export const parseAssetTableRows = (
  rows: Array<Record<string, unknown>>,
): ParsedAssetRow[] => rows
  .map<ParsedAssetRow | null>((row, index) => {
    const name = readCell(row, [
      '资产名称', '资产名', '名称', 'name', 'assetName', 'asset',
    ]);
    if (!name) return null;

    const rawCategory = readCell(row, [
      '资产分类', '资产类型', '分类', '类型', 'category', 'assetCategory', 'type',
    ]);
    const { category, usedFallback } = normalizeAssetCategory(rawCategory);
    const warnings: string[] = [];
    if (usedFallback) warnings.push(`未知分类“${rawCategory}”，已按“道具”导入`);
    if (!rawCategory) warnings.push('未填写分类，已按“道具”导入');

    return {
      sourceRow: index + 2,
      name,
      category,
      description: readCell(row, [
        '资产描述', '资产设定', '设定说明', '描述', 'description', 'assetDescription',
      ]) || `${name}资产设定`,
      promptTemplate: readCell(row, [
        'AI提示词', '提示词', '提示词模板', 'prompt', 'promptTemplate',
      ]),
      thumbnailUrl: readCell(row, [
        '缩略图', '缩略图URL', '参考图', '图片', 'thumbnail', 'thumbnailUrl', 'image',
      ]),
      assignee: readCell(row, [
        '负责人', '负责人邮箱', 'assignee', 'assigneeEmail', 'owner',
      ]),
      warnings,
    };
  })
  .filter((row): row is ParsedAssetRow => row !== null);
