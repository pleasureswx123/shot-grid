import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAssetCategory, parseAssetTableRows } from './assetImport';

test('asset table parser accepts Chinese and English column aliases', () => {
  const rows = parseAssetTableRows([
    {
      '资产名称': '主角驾驶服',
      '资产分类': '服装',
      '资产描述': '轻型驾驶服',
      'AI提示词': 'sci-fi pilot suit',
      '负责人': 'artist@example.com',
    },
    {
      assetName: 'Moon Rover',
      category: 'vehicle',
      description: 'Lunar exploration vehicle',
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].category, '服装');
  assert.equal(rows[0].assignee, 'artist@example.com');
  assert.equal(rows[1].category, '载具');
});

test('unknown asset categories fall back to prop with a warning', () => {
  const normalized = normalizeAssetCategory('未知类型');
  assert.equal(normalized.category, '道具');
  assert.equal(normalized.usedFallback, true);

  const rows = parseAssetTableRows([{ 名称: '神秘装置', 类型: '未知类型' }]);
  assert.equal(rows[0].category, '道具');
  assert.equal(rows[0].warnings.length, 1);
});

test('rows without an asset name are ignored', () => {
  const rows = parseAssetTableRows([
    { 资产名称: '', 资产分类: '角色' },
    { 资产名称: '舰长', 资产分类: '角色' },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, '舰长');
});
