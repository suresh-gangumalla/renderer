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

import type { IAnimationController } from '@lightningjs/renderer';

import type { ExampleSettings } from '../common/ExampleSettings.js';
interface AnimationExampleSettings {
  duration: number;
  easing: string;
  delay: number;
  loop: boolean;
  stopMethod: 'reverse' | 'reset' | false;
}

export default async function test({ renderer, testRoot }: ExampleSettings) {
  // Aim:: To check whether node properties are correctly mapped to target value
  // after completion of animation.

  // Observed that, float target values are not correctly rounded on node.
  const node = renderer.createNode({
    x: 960,
    y: 100,
    mountX: 0.5,
    width: 300,
    height: 300,
    color: 0x000000ff,
    parent: testRoot,
    alpha: 1,
  });

  const animationSettings: Partial<AnimationExampleSettings> = {
    duration: 2000,
    delay: 100,
    loop: false,
    stopMethod: false,
    easing: 'linear',
  };

  let alphaAnimation: IAnimationController;

  const doAnimationOnAlpha = () => {
    console.log(
      'Before starting the animation, alpha on the node is ',
      node['alpha'],
    );
    const targetAlpha = 0.1;

    alphaAnimation = node.animate({ alpha: targetAlpha }, animationSettings);
    console.log('Setting alpha to ', targetAlpha);

    alphaAnimation
      .start()
      .waitUntilStopped()
      .then(() => {
        console.log(
          'After completion of the animation, actual alpha on the node is ',
          node['alpha'],
        );
      })
      .catch((e) => {
        console.error(e);
      });
  };

  doAnimationOnAlpha();

  const node2 = renderer.createNode({
    x: 960,
    y: 700,
    width: 300,
    height: 300,
    color: 0xff0000ff,
    parent: testRoot,
  });

  const doAnimationOnX = () => {
    console.log('Before starting the animation, X on the node is ', node2['x']);
    const targetX = 1.3;

    animationSettings.delay = 2000;

    alphaAnimation = node2.animate({ x: targetX }, animationSettings);

    console.log('Setting x to ', targetX);

    alphaAnimation
      .start()
      .waitUntilStopped()
      .then(() => {
        console.log(
          'After completion of the animation, actual X on the node is ',
          node2['x'],
        );
      })
      .catch((e) => console.error(e));
  };

  doAnimationOnX();

  /*
   * End: Sprite Map Demo
   */
  console.log('ready!');
}
