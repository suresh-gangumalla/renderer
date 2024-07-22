/*
 * If not stated otherwise in this file or this component's LICENSE file the
 * following copyright and licenses apply:
 *
 * Copyright 2023 Comcast Cable Communications Management, LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the License);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot single page
  await test(settings);
  await settings.snapshot();
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  /**
   * For row elements, provided explicit color as 0x00000000, transparent color,
   * if not provided observed node rendered with default white (0xffffffff)
   */

  /**
   *  Observations:
   *    1) if we change  the height/width of any child-element then alpha effect is
   *        working as expected on row element.
   */

  /**
   * Usage: Press Up/Down arrows to switch the alpha between two rows
   *        Press 'a' key to change the row1 child element height to 200
   *        Press 'b' key to change the row1 child element height back to original 400
   * */

  const colorOfRow = 0x00000000;

  const heightOfChildElement = 200;
  const widthOfChildElement = 200;

  const container1 = renderer.createNode({
    width: 800,
    x: 100,
    y: 20,
    height: 600,
    color: 0xa9a9a9ff,
    parent: testRoot,
    scale: 1.05,
  });

  const c1Row1 = renderer.createNode({
    width: 960,
    height: 300,
    alpha: 1,
    color: colorOfRow,
    parent: container1,
  });

  const c1Row1Child = renderer.createNode({
    x: 400,
    y: 20,
    mountX: 0.5,
    width: widthOfChildElement,
    height: heightOfChildElement,
    color: 0xff0000ff,
    parent: c1Row1,
  });

  const c1Row2 = renderer.createNode({
    width: 960,
    height: 300,
    y: 300,
    alpha: 0.2,
    color: colorOfRow,
    parent: container1,
  });

  const c1Row2Child = renderer.createNode({
    x: 400,
    y: 20,
    mountX: 0.5,
    width: widthOfChildElement,
    height: heightOfChildElement,
    color: 0x00ff00ff,
    parent: c1Row2,
  });

  const container2 = renderer.createNode({
    width: 800,
    height: 600,
    y: 20,
    x: 1050,
    color: 0x696969ff,
    parent: testRoot,
  });

  const c2Row1 = renderer.createNode({
    width: 960,
    height: 300,
    color: colorOfRow,
    parent: container2,
  });

  const c2Row1Child = renderer.createNode({
    x: 400,
    y: 20,
    mountX: 0.5,
    width: widthOfChildElement,
    height: heightOfChildElement,
    color: 0xff0000ff,
    shader: renderer.createShader('DynamicShader', {
      effects: [
        {
          type: 'radius',
          props: {
            radius: 20,
          },
        },
      ],
    }),
    parent: c2Row1,
  });

  const c2Row2 = renderer.createNode({
    width: 960,
    height: 300,
    y: 300,
    alpha: 0.2,
    color: colorOfRow,
    parent: container2,
  });

  const c2Row2Child = renderer.createNode({
    x: 400,
    y: 20,
    mountX: 0.5,
    width: widthOfChildElement,
    height: heightOfChildElement,
    color: 0x00ff00ff,
    shader: renderer.createShader('DynamicShader', {
      effects: [
        {
          type: 'radius',
          props: {
            radius: 20,
          },
        },
      ],
    }),
    parent: c2Row2,
  });

  let c1CurrentFocusIndex = 0;
  let c2CurrentFocusIndex = 0;
  let activeContainer = 0;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      if (activeContainer == 1) {
        activeContainer = 0;
        container1.scale = 1.05;
        container2.scale = 0.9;
      }
    } else if (e.key === 'ArrowRight') {
      if (activeContainer == 0) {
        activeContainer = 1;
        container1.scale = 0.9;
        container2.scale = 1.05;
      }
    } else if (e.key === 'ArrowUp') {
      if (activeContainer == 0 && c1CurrentFocusIndex == 1) {
        c1Row1.alpha = 1;
        c1Row2.alpha = 0.2;
        c1CurrentFocusIndex ^= 1;
      } else if (activeContainer == 1 && c2CurrentFocusIndex == 1) {
        c2Row1.alpha = 1;
        c2Row2.alpha = 0.2;
        c2CurrentFocusIndex ^= 1;
      }
    } else if (e.key === 'ArrowDown') {
      if (activeContainer == 0 && c1CurrentFocusIndex == 0) {
        c1Row2.alpha = 1;
        c1Row1.alpha = 0.2;
        c1CurrentFocusIndex ^= 1;
      } else if (activeContainer == 1 && c2CurrentFocusIndex == 0) {
        c2Row2.alpha = 1;
        c2Row1.alpha = 0.2;
        c2CurrentFocusIndex ^= 1;
      }
    } else if (e.key == 'a') {
      // To verify alpha effect is working as expected when row1 child-element height gets decreased
      c2Row1Child.height = 150;
    } else if (e.key == 'b') {
      // Setting height back to original
      c2Row1Child.height = heightOfChildElement;
    }
  });

  const noteX = 300;
  // Usage information
  renderer.createTextNode({
    x: noteX,
    y: 700,
    text: 'Use Left/Right arrows to switch between container',
    fontSize: 35,
    parent: testRoot,
  });
  renderer.createTextNode({
    x: noteX,
    y: 750,
    text: 'Use Up/Down arrows to switch between rows within selected container',
    fontSize: 35,
    parent: testRoot,
  });

  renderer.createTextNode({
    x: noteX,
    y: 800,
    text: "Press key 'a' to change the container 2 row1 child element height to 150 & press Up/Down",
    fontSize: 35,
    parent: testRoot,
  });

  renderer.createTextNode({
    x: noteX,
    y: 850,
    text: "Press key 'b' to change the container 2 row1 child element height back to original 200 & press Up/Down",
    fontSize: 35,
    parent: testRoot,
  });

  // set row1 alpha to 1
  setTimeout(() => (row1.alpha = 1), 200);
}
