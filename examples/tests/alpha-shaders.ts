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
   *  Observations: if we decrease the height of the child-element then alpha effect is
   *  working as expected on row element.
   */

  /**
   * Usage: Press Up/Down arrows to switch the alpha between two rows
   *        Press 'a' key to change the row1 child element height to 200
   *        Press 'b' key to change the row1 child element height back to original 400
   * */

  const colorOfRow = 0x00000000;

  const heightOfChildElement = 400;

  const row1 = renderer.createNode({
    width: 600,
    height: 500,
    x: 100,
    alpha: 0.2,
    color: colorOfRow,
    parent: testRoot,
  });

  const row1Child = renderer.createNode({
    y: 250,
    x: 100,
    mountY: 0.5,
    width: 200,
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
    parent: row1,
  });

  const row2 = renderer.createNode({
    width: 600,
    height: 500,
    x: 100,
    alpha: 0.2,
    y: 600,
    color: colorOfRow,
    parent: testRoot,
  });

  const row2Child = renderer.createNode({
    x: 100,
    y: 250,
    mountY: 0.5,
    width: 200,
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
    parent: row2,
  });

  let currentFocusIndex = 0;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (currentFocusIndex == 1) {
        row1.alpha = 1;
        row2.alpha = 0.2;
        currentFocusIndex ^= 1;
      }
    }
    if (e.key === 'ArrowDown') {
      if (currentFocusIndex == 0) {
        row2.alpha = 1;
        row1.alpha = 0.2;
        currentFocusIndex ^= 1;
      }
    } else if (e.key == 'a') {
      // To verify alpha effect is working as expected when row1 child-element height got decreased
      row1Child.height = 200;
    } else if (e.key == 'b') {
      // Setting height back to original
      row1Child.height = heightOfChildElement;
    }
  });

  // Usage information
  renderer.createTextNode({
    x: 900,
    y: 200,
    text: 'Use Up/Down arrows to switch between two rows',
    fontSize: 35,
    parent: testRoot,
  });

  renderer.createTextNode({
    x: 900,
    y: 300,
    text: "Press key 'a' to change the row1 child element height to 200",
    fontSize: 35,
    parent: testRoot,
  });

  renderer.createTextNode({
    width: 950,
    lineHeight: 50,
    contain: 'width',
    x: 900,
    y: 400,
    text: "Press key 'b' to change the row1 child element height back to original 400",
    fontSize: 35,
    parent: testRoot,
  });

  // set row1 alpha to 1
  setTimeout(() => (row1.alpha = 1), 200);
}
