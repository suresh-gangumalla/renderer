import {
  MainRenderDriver,
  type INode,
  RendererMain,
  ThreadXRenderDriver,
} from '@lightningjs/renderer';
import RendererWorker from '@lightningjs/renderer/workers/renderer?worker';
import rocko from './rocko.png';

(async () => {
  const threadXDriver = new ThreadXRenderDriver({
    RendererWorker,
  });

  const mainDriver = new MainRenderDriver();

  const renderer = new RendererMain(
    {
      width: 1920,
      height: 1080,
    },
    'app',
    mainDriver,
    // threadXDriver
  );

  await renderer.init();

  /*
   * redRect will persist and change color every frame
   * greenRect will persist and be detached and reattached to the root every second
   * blueRect will be created and destroyed every 500 ms
   */
  const redRect = renderer.createNode({
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    color: 0x00ff0000,
    parent: renderer.root,
  });

  const greenRect = renderer.createNode({
    x: 100,
    y: 0,
    w: 100,
    h: 100,
    color: 0x0000ff00,
    parent: renderer.root,
  });

  const imageRect = renderer.createNode({
    x: 0,
    y: 100,
    w: 181,
    h: 218,
    src: rocko,
    parent: renderer.root,
  });

  let blueRect: INode | null = null;

  const interval = setInterval(() => {
    redRect.color++;
  }, 0);

  setInterval(() => {
    if (blueRect) {
      blueRect.destroy();
      blueRect = null;
    } else {
      blueRect = renderer.createNode({
        x: 200,
        y: 0,
        w: 100,
        h: 100,
        color: 0x000000ff,
        parent: renderer.root,
      });
    }
  }, 500);

  setInterval(() => {
    if (greenRect.parent) {
      greenRect.parent = null;
    } else {
      greenRect.parent = renderer.root;
    }
  }, 1000);

  console.log('ready!');
})().catch((err) => {
  console.error(err);
});
