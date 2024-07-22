/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
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

import type { ITextNodeProps, RendererMain } from '@lightningjs/renderer';
import type { ExampleSettings } from '../common/ExampleSettings.js';

export async function automation(settings: ExampleSettings) {
  // Snapshot all the pages
  await (await test(settings)).snapshotPages();
}

export default async function test(settings: ExampleSettings) {
  const { renderer } = settings;

  const { testRoot } = settings;
  const mountAt = 0;
  const fontSizeToBe = 128;
  const lineHeightToBe = 180;
  const word1Text = 'Wonka';
  const word2Text = 'Migration';

  const textAttributes = {
    color: 0x000000ff,
    fontFamily: 'Ubuntu',
    fontSize: fontSizeToBe,
    // lineHeight: lineHeightToBe,
  } satisfies Partial<ITextNodeProps>;

  const word1 = renderer.createTextNode({
    x: 200,
    y: 540,
    mountY: 0.5,
    // mount: mountAt,
    text: word1Text,
    ...textAttributes,
    parent: testRoot,
  });

  const word2 = renderer.createTextNode({
    x: 800,
    y: 540,
    mountY: 0.5,
    mount: mountAt,
    text: word2Text,
    ...textAttributes,
    parent: testRoot,
  });

  // To Verify Actual text Rendered height is equal to what it returned in @loaded event
  const rectEle1 = renderer.createNode({
    x: 190,
    y: 540,
    mountY: 0.5,
    width: 10,
    color: 0xff0000ff,
    parent: testRoot,
    alpha: 1, // make this 1 to view
  });

  const rectEle2 = renderer.createNode({
    x: 780,
    y: 540,
    mountY: 0.5,
    width: 10,
    color: 0xff0000ff,
    parent: testRoot,
    alpha: 1, // make this 1 to view
  });

  word1.on('loaded', (el, { type, dimensions }) => {
    console.log(
      `${word1Text} @loaded, type-> ${type},  rendered height-> ${dimensions.height} & width-> ${dimensions.width}`,
    );
    rectEle1.height = dimensions.height;
  });

  word2.on('loaded', (el, { type, dimensions }) => {
    console.log(
      `${word2Text} Text @loaded, type-> ${type},  rendered height-> ${dimensions.height} & width-> ${dimensions.width}`,
    );
    rectEle2.height = dimensions.height;
  });
}
