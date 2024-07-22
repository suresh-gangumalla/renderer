/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */

import type { ExampleSettings } from '../common/ExampleSettings.js';

export default async function ({ renderer, testRoot }: ExampleSettings) {
  const node = renderer.createNode({
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    color: 0x000000ff,
    parent: testRoot,
  });

  const itemH = 300;
  const itemW = 300;

  // Sample 1
  renderer.createTextNode({
    x: 200,
    y: 200,
    fontFamily: 'Ubuntu',
    lineHeight: 40,
    fontSize: 34,
    color: 0xffffffff,
    text: `Initial color is '{top: 0xefefefff, bottom:0xaaaaaaff}',
            press 'a' to change color to 0xff0000ff
            press 'b' to change color back to original`,

    parent: node,
  });

  const item1Y = 400;
  const item1 = renderer.createNode({
    x: 100,
    y: item1Y,
    width: itemW,
    height: itemH,
    colorTop: 0xefefefff,
    colorBottom: 0xaaaaaaff,
    color: 0,
    parent: node,
  });

  const colorInfo1 = renderer.createNode({
    x: 500,
    y: item1Y,
    parent: node,
  });

  displayColorInfo(item1, colorInfo1);

  // Displays color related props in a given node
  function displayColorInfo(renderNode: any, parentNode: any) {
    const getColorsAsText = () => {
      const colorProps = [
        'color',
        'colorBl',
        'colorBottom',
        'colorBr',
        'colorLeft',
        'colorRight',
        'colorTl',
        'colorTop',
        'colorTr',
      ];
      return colorProps.reduce((colorsAsTxt, prop): string => {
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands, @typescript-eslint/no-unsafe-member-access
        colorsAsTxt += `${prop}: ${
          renderNode && renderNode[prop].toString(16)
        }, \t`;
        return colorsAsTxt;
      }, '');
    };

    renderer.createTextNode({
      text: getColorsAsText(),
      width: 1200,
      color: 0xffffffff,
      fontFamily: 'Ubuntu',
      fontSize: 40,
      contain: 'width',
      lineHeight: 50,
      parent: parentNode,
    });
  }

  function refreshColorInfo() {
    // destroy existing children of colorInfo2
    colorInfo1.children.forEach((item) => {
      item.destroy();
    });

    // re-render color info of item2
    displayColorInfo(item1, colorInfo1);
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'a') {
      item1.color = 0xff0000ff;
    } else if (e.key === 'b') {
      item1.color = 0;
      item1.colorBottom = 0xaaaaaaff;
      item1.colorTop = 0xefefefff;
    }

    // re render color info
    refreshColorInfo();
  });
}
