import { describe, expect, it } from 'vitest';
import { buildLayerManifest, emitStudioJsx } from '../src-v2/main/design/studio/jsxEmitter.mjs';

const scene = {
  width: 1080,
  height: 1350,
  root: [
    { type: 'group', name: '00_BACKGROUND', children: [{ type: 'rect', x: 0, y: 0, w: 1080, h: 1350, fill: '#F5F0E7' }] },
    { type: 'group', name: '01_EMPTY_SEMANTIC_SLOT', children: [] },
    {
      type: 'group',
      name: '02_CONTENT',
      children: [
        { type: 'image', x: 40, y: 60, w: 500, h: 400, href: 'C:\\assets\\assembly.jpg', fit: 'cover', shape: 'rect', radius: 24, ring: '#FFFFFF', ringWidth: 7 },
        { type: 'text', x: 50, y: 500, w: 980, h: 80, text: 'Today’s Prayer', lines: ['Today’s Prayer'], family: 'Poppins', weight: 700, size: 48, color: '#1E3A5F', align: 'center' },
      ],
    },
  ],
};

describe('Studio Photoshop JSX emitter', () => {
  it('emits semantic groups, live text, smart objects, masks and frames', () => {
    const { jsx, manifest } = emitStudioJsx(scene, { outputDir: 'C:\\output' });
    expect(jsx).toContain('#target photoshop');
    expect(jsx).toContain('00_BACKGROUND');
    expect(jsx).toContain('02_CONTENT');
    expect(jsx).not.toContain('01_EMPTY_SEMANTIC_SLOT');
    expect(jsx).toContain('placeFile("C:/assets/assembly.jpg")');
    expect(jsx).toContain('maskFromSelection');
    expect(jsx).toContain('_FRAME');
    expect(jsx).toContain('addText');
    expect(jsx).toContain('documentStats');
    expect(jsx).toContain('LAYER_COUNT_MISMATCH');
    expect(jsx).toContain('pngDoc.flatten()');
    expect(jsx).toContain('Today\\u2019s Prayer');
    expect(manifest.totals).toMatchObject({ groups: 2, sourceNodes: 3, photoshopLayers: 4, smartObjects: 1, textLayers: 1 });
  });

  it('builds the same concise manifest independently', () => {
    const manifest = buildLayerManifest(scene);
    expect(manifest.groups.map((group) => group.name)).toEqual(['00_BACKGROUND', '02_CONTENT']);
    expect(manifest.groups[1].frameLayers).toBe(1);
  });
});
