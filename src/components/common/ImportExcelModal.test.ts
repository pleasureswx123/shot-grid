import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseShotImportRow } from './ImportExcelModal';

describe('ImportExcelModal Excel column parsing', () => {
  test('maps dialogue and every asset column in Chinese and English', () => {
    assert.deepEqual(parseShotImportRow({
      场次: 'sc02', 镜头编号: 'sh010', 镜头描述: '交谈', 台词: '你好',
      角色资产: '甲，乙', 场景资产: '舰桥', 道具: '杯子;书', 其他资产: '风格参考:水彩',
    }), {
      sceneCode: 'sc02', shotCode: 'sh010', description: '交谈', durationSec: 5,
      shotType: '中景', cameraMovement: '固定镜头', dialogue: '你好', characterAssets: '甲，乙',
      sceneAssets: '舰桥', propAssets: '杯子;书', otherAssets: '风格参考:水彩',
    });
  });

  test('keeps optional empty dialogue and asset columns empty', () => {
    const row = parseShotImportRow({ sceneCode: 'SC01', shotCode: 'SH001', dialogue: ' ', 角色: '' });
    assert.equal(row.dialogue, '');
    assert.equal(row.characterAssets, '');
    assert.equal(row.sceneAssets, '');
    assert.equal(row.propAssets, '');
    assert.equal(row.otherAssets, '');
  });
});
