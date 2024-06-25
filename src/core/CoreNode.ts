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

import {
  assertTruthy,
  getNewId,
  mergeColorAlphaPremultiplied,
} from '../utils.js';
import type { ShaderMap } from './CoreShaderManager.js';
import type { ExtractProps, TextureOptions } from './CoreTextureManager.js';
import type { CoreRenderer } from './renderers/CoreRenderer.js';
import type { CoreShader } from './renderers/CoreShader.js';
import type { Stage } from './Stage.js';
import type {
  Texture,
  TextureFailedEventHandler,
  TextureFreedEventHandler,
  TextureLoadedEventHandler,
} from './textures/Texture.js';
import type {
  Dimensions,
  NodeTextureFailedPayload,
  NodeTextureFreedPayload,
  NodeTextureLoadedPayload,
} from '../common/CommonTypes.js';
import { EventEmitter } from '../common/EventEmitter.js';
import {
  copyRect,
  intersectRect,
  type Bound,
  type RectWithValid,
  createBound,
  boundInsideBound,
} from './lib/utils.js';
import { Matrix3d } from './lib/Matrix3d.js';
import { RenderCoords } from './lib/RenderCoords.js';
import type { AnimationSettings } from './animations/CoreAnimation.js';
import type { IAnimationController } from '../common/IAnimationController.js';
import { CoreAnimation } from './animations/CoreAnimation.js';
import { CoreAnimationController } from './animations/CoreAnimationController.js';
import type { BaseShaderController } from '../main-api/ShaderController.js';

export enum CoreNodeRenderState {
  Init = 0,
  OutOfBounds = 2,
  InBounds = 4,
  InViewport = 8,
}

const CoreNodeRenderStateMap: Map<CoreNodeRenderState, string> = new Map();
CoreNodeRenderStateMap.set(CoreNodeRenderState.Init, 'init');
CoreNodeRenderStateMap.set(CoreNodeRenderState.OutOfBounds, 'outOfBounds');
CoreNodeRenderStateMap.set(CoreNodeRenderState.InBounds, 'inBounds');
CoreNodeRenderStateMap.set(CoreNodeRenderState.InViewport, 'inViewport');

export enum UpdateType {
  /**
   * Child updates
   */
  Children = 1,

  /**
   * Scale/Rotate transform update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `scaleRotateTransform`
   */
  ScaleRotate = 2,

  /**
   * Translate transform update (x/y/width/height/pivot/mount)
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `localTransform`
   */
  Local = 4,

  /**
   * Global Transform update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `globalTransform`
   * - `renderCoords`
   * - `renderBound`
   */
  Global = 8,

  /**
   * Clipping rect update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `clippingRect`
   */
  Clipping = 16,

  /**
   * Calculated ZIndex update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `calcZIndex`
   */
  CalculatedZIndex = 32,

  /**
   * Z-Index Sorted Children update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `children` (sorts children by their `calcZIndex`)
   */
  ZIndexSortedChildren = 64,

  /**
   * Premultiplied Colors update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `premultipliedColorTl`
   * - `premultipliedColorTr`
   * - `premultipliedColorBl`
   * - `premultipliedColorBr`
   */
  PremultipliedColors = 128,

  /**
   * World Alpha update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `worldAlpha` = `parent.worldAlpha` * `alpha`
   */
  WorldAlpha = 256,

  /**
   * Render State update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `renderState`
   */
  RenderState = 512,

  /**
   * Is Renderable update
   *
   * @remarks
   * CoreNode Properties Updated:
   * - `isRenderable`
   */
  IsRenderable = 1024,

  /**
   * Render Texture update
   */
  RenderTexture = 2048,

  /**
   * Track if parent has render texture
   */
  ParentRenderTexture = 4096,

  /**
   * None
   */
  None = 0,

  /**
   * All
   */
  All = 8191,
}

/**
 * A custom data map which can be stored on an CoreNode
 *
 * @remarks
 * This is a map of key-value pairs that can be stored on an INode. It is used
 * to store custom data that can be used by the application.
 * The data stored can only be of type string, number or boolean.
 */
export type CustomDataMap = {
  [key: string]: string | number | boolean | undefined;
};

/**
 * Writable properties of a Node.
 */
export interface CoreNodeProps {
  /**
   * The x coordinate of the Node's Mount Point.
   *
   * @remarks
   * See {@link mountX} and {@link mountY} for more information about setting
   * the Mount Point.
   *
   * @default `0`
   */
  x: number;
  /**
   * The y coordinate of the Node's Mount Point.
   *
   * @remarks
   * See {@link mountX} and {@link mountY} for more information about setting
   * the Mount Point.
   *
   * @default `0`
   */
  y: number;
  /**
   * The width of the Node.
   *
   * @default `0`
   */
  width: number;
  /**
   * The height of the Node.
   *
   * @default `0`
   */
  height: number;
  /**
   * The alpha opacity of the Node.
   *
   * @remarks
   * The alpha value is a number between 0 and 1, where 0 is fully transparent
   * and 1 is fully opaque.
   *
   * @default `1`
   */
  alpha: number;
  /**
   * Autosize mode
   *
   * @remarks
   * When enabled, when a texture is loaded into the Node, the Node will
   * automatically resize to the dimensions of the texture.
   *
   * Text Nodes are always autosized based on their text content regardless
   * of this mode setting.
   *
   * @default `false`
   */
  autosize: boolean;
  /**
   * Clipping Mode
   *
   * @remarks
   * Enable Clipping Mode when you want to prevent the drawing of a Node and
   * its descendants from overflowing outside of the Node's x/y/width/height
   * bounds.
   *
   * For WebGL, clipping is implemented using the high-performance WebGL
   * operation scissor. As a consequence, clipping does not work for
   * non-rectangular areas. So, if the element is rotated
   * (by itself or by any of its ancestors), clipping will not work as intended.
   *
   * TODO: Add support for non-rectangular clipping either automatically or
   * via Render-To-Texture.
   *
   * @default `false`
   */
  clipping: boolean;
  /**
   * The color of the Node.
   *
   * @remarks
   * The color value is a number in the format 0xRRGGBBAA, where RR is the red
   * component, GG is the green component, BB is the blue component, and AA is
   * the alpha component.
   *
   * Gradient colors may be set by setting the different color sub-properties:
   * {@link colorTop}, {@link colorBottom}, {@link colorLeft}, {@link colorRight},
   * {@link colorTl}, {@link colorTr}, {@link colorBr}, {@link colorBl} accordingly.
   *
   * @default `0xffffffff` (opaque white)
   */
  color: number;
  /**
   * The color of the top edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorTop: number;
  /**
   * The color of the bottom edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorBottom: number;
  /**
   * The color of the left edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorLeft: number;
  /**
   * The color of the right edge of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorRight: number;
  /**
   * The color of the top-left corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorTl: number;
  /**
   * The color of the top-right corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorTr: number;
  /**
   * The color of the bottom-right corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorBr: number;
  /**
   * The color of the bottom-left corner of the Node for gradient rendering.
   *
   * @remarks
   * See {@link color} for more information about color values and gradient
   * rendering.
   */
  colorBl: number;
  /**
   * The Node's parent Node.
   *
   * @remarks
   * The value `null` indicates that the Node has no parent. This may either be
   * because the Node is the root Node of the scene graph, or because the Node
   * has been removed from the scene graph.
   *
   * In order to make sure that a Node can be rendered on the screen, it must
   * be added to the scene graph by setting it's parent property to a Node that
   * is already in the scene graph such as the root Node.
   *
   * @default `null`
   */
  parent: CoreNode | null;
  /**
   * The Node's z-index.
   *
   * @remarks
   * TBD
   */
  zIndex: number;
  /**
   * The Node's Texture.
   *
   * @remarks
   * The `texture` defines a rasterized image that is contained within the
   * {@link width} and {@link height} dimensions of the Node. If null, the
   * Node will use an opaque white {@link ColorTexture} when being drawn, which
   * essentially enables colors (including gradients) to be drawn.
   *
   * If set, by default, the texture will be drawn, as is, stretched to the
   * dimensions of the Node. This behavior can be modified by setting the TBD
   * and TBD properties.
   *
   * To create a Texture in order to set it on this property, call
   * {@link RendererMain.createTexture}.
   *
   * If the {@link src} is set on a Node, the Node will use the
   * {@link ImageTexture} by default and the Node will simply load the image at
   * the specified URL.
   *
   * Note: If this is a Text Node, the Texture will be managed by the Node's
   * {@link TextRenderer} and should not be set explicitly.
   */
  texture: Texture | null;

  /**
   * Options to associate with the Node's Texture
   */
  textureOptions: TextureOptions;

  /**
   * The Node's shader
   *
   * @remarks
   * The `shader` defines a {@link Shader} used to draw the Node. By default,
   * the Default Shader is used which simply draws the defined {@link texture}
   * or {@link color}(s) within the Node without any special effects.
   *
   * To create a Shader in order to set it on this property, call
   * {@link RendererMain.createShader}.
   *
   * Note: If this is a Text Node, the Shader will be managed by the Node's
   * {@link TextRenderer} and should not be set explicitly.
   */
  shader: BaseShaderController;
  /**
   * Image URL
   *
   * @remarks
   * When set, the Node's {@link texture} is automatically set to an
   * {@link ImageTexture} using the source image URL provided (with all other
   * settings being defaults)
   */
  src: string | null;
  zIndexLocked: number;
  /**
   * Scale to render the Node at
   *
   * @remarks
   * The scale value multiplies the provided {@link width} and {@link height}
   * of the Node around the Node's Pivot Point (defined by the {@link pivot}
   * props).
   *
   * Behind the scenes, setting this property sets both the {@link scaleX} and
   * {@link scaleY} props to the same value.
   *
   * NOTE: When the scaleX and scaleY props are explicitly set to different values,
   * this property returns `null`. Setting `null` on this property will have no
   * effect.
   *
   * @default 1.0
   */
  scale: number | null;
  /**
   * Scale to render the Node at (X-Axis)
   *
   * @remarks
   * The scaleX value multiplies the provided {@link width} of the Node around
   * the Node's Pivot Point (defined by the {@link pivot} props).
   *
   * @default 1.0
   */
  scaleX: number;
  /**
   * Scale to render the Node at (Y-Axis)
   *
   * @remarks
   * The scaleY value multiplies the provided {@link height} of the Node around
   * the Node's Pivot Point (defined by the {@link pivot} props).
   *
   * @default 1.0
   */
  scaleY: number;
  /**
   * Combined position of the Node's Mount Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Mount Point at the top-left corner of the Node.
   * - `0.5` defines it at the center of the Node.
   * - `1.0` defines it at the bottom-right corner of the node.
   *
   * Use the {@link mountX} and {@link mountY} props seperately for more control
   * of the Mount Point.
   *
   * When assigned, the same value is also passed to both the {@link mountX} and
   * {@link mountY} props.
   *
   * @default 0 (top-left)
   */
  mount: number;
  /**
   * X position of the Node's Mount Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Mount Point's X position as the left-most edge of the
   *   Node
   * - `0.5` defines it as the horizontal center of the Node
   * - `1.0` defines it as the right-most edge of the Node.
   *
   * The combination of {@link mountX} and {@link mountY} define the Mount Point
   *
   * @default 0 (left-most edge)
   */
  mountX: number;
  /**
   * Y position of the Node's Mount Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Mount Point's Y position as the top-most edge of the
   *   Node
   * - `0.5` defines it as the vertical center of the Node
   * - `1.0` defines it as the bottom-most edge of the Node.
   *
   * The combination of {@link mountX} and {@link mountY} define the Mount Point
   *
   * @default 0 (top-most edge)
   */
  mountY: number;
  /**
   * Combined position of the Node's Pivot Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Pivot Point at the top-left corner of the Node.
   * - `0.5` defines it at the center of the Node.
   * - `1.0` defines it at the bottom-right corner of the node.
   *
   * Use the {@link pivotX} and {@link pivotY} props seperately for more control
   * of the Pivot Point.
   *
   * When assigned, the same value is also passed to both the {@link pivotX} and
   * {@link pivotY} props.
   *
   * @default 0.5 (center)
   */
  pivot: number;
  /**
   * X position of the Node's Pivot Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Pivot Point's X position as the left-most edge of the
   *   Node
   * - `0.5` defines it as the horizontal center of the Node
   * - `1.0` defines it as the right-most edge of the Node.
   *
   * The combination of {@link pivotX} and {@link pivotY} define the Pivot Point
   *
   * @default 0.5 (centered on x-axis)
   */
  pivotX: number;
  /**
   * Y position of the Node's Pivot Point
   *
   * @remarks
   * The value can be any number between `0.0` and `1.0`:
   * - `0.0` defines the Pivot Point's Y position as the top-most edge of the
   *   Node
   * - `0.5` defines it as the vertical center of the Node
   * - `1.0` defines it as the bottom-most edge of the Node.
   *
   * The combination of {@link pivotX} and {@link pivotY} define the Pivot Point
   *
   * @default 0.5 (centered on y-axis)
   */
  pivotY: number;
  /**
   * Rotation of the Node (in Radians)
   *
   * @remarks
   * Sets the amount to rotate the Node by around it's Pivot Point (defined by
   * the {@link pivot} props). Positive values rotate the Node clockwise, while
   * negative values rotate it counter-clockwise.
   *
   * Example values:
   * - `-Math.PI / 2`: 90 degree rotation counter-clockwise
   * - `0`: No rotation
   * - `Math.PI / 2`: 90 degree rotation clockwise
   * - `Math.PI`: 180 degree rotation clockwise
   * - `3 * Math.PI / 2`: 270 degree rotation clockwise
   * - `2 * Math.PI`: 360 rotation clockwise
   */
  rotation: number;

  /**
   * Whether the Node is rendered to a texture
   *
   * @remarks
   * TBD
   *
   * @default false
   */
  rtt: boolean;

  /**
   * Node data element for custom data storage (optional)
   *
   * @remarks
   * This property is used to store custom data on the Node as a key/value data store.
   * Data values are limited to string, numbers, booleans. Strings will be truncated
   * to a 2048 character limit for performance reasons.
   *
   * This is not a data storage mechanism for large amounts of data please use a
   * dedicated data storage mechanism for that.
   *
   * The custom data will be reflected in the inspector as part of `data-*` attributes
   *
   * @default `undefined`
   */
  data?: CustomDataMap;
}

/**
 * Grab all the number properties of type T
 */
type NumberProps<T> = {
  [Key in keyof T as NonNullable<T[Key]> extends number ? Key : never]: number;
};

/**
 * Properties of a Node used by the animate() function
 */
export interface CoreNodeAnimateProps extends NumberProps<CoreNodeProps> {
  /**
   * Shader properties to animate
   */
  shaderProps: Record<string, number>;
  // TODO: textureProps: Record<string, number>;
}

/**
 * A visual Node in the Renderer scene graph.
 *
 * @remarks
 * CoreNode is an internally used class that represents a Renderer Node in the
 * scene graph. See INode.ts for the public APIs exposed to Renderer users
 * that include generic types for Shaders.
 */
export class CoreNode extends EventEmitter {
  readonly children: CoreNode[] = [];
  protected _id: number = getNewId();
  protected props: Required<CoreNodeProps>;

  public updateType = UpdateType.All;

  public globalTransform?: Matrix3d;
  public scaleRotateTransform?: Matrix3d;
  public localTransform?: Matrix3d;
  public renderCoords?: RenderCoords;
  public renderBound?: Bound;
  public strictBound?: Bound;
  public preloadBound?: Bound;
  public clippingRect: RectWithValid = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    valid: false,
  };
  public isRenderable = false;
  public renderState: CoreNodeRenderState = CoreNodeRenderState.Init;

  public worldAlpha = 1;
  public premultipliedColorTl = 0;
  public premultipliedColorTr = 0;
  public premultipliedColorBl = 0;
  public premultipliedColorBr = 0;
  public calcZIndex = 0;
  public hasRTTupdates = false;
  public parentHasRenderTexture = false;
  private _src = '';

  constructor(protected stage: Stage, props: CoreNodeProps) {
    super();

    this.props = {
      ...props,
      parent: null,
      texture: null,
      shader: stage.defShaderCtr,
      src: '',
      rtt: false,
      data: props.data || {},
    };

    // Assign props to instance
    this.parent = props.parent;
    this.shader = props.shader;
    this.texture = props.texture;
    this.src = props.src || '';
    // FIXME
    // this.data = props.data;
    this.rtt = props.rtt;

    this.updateScaleRotateTransform();
  }

  //#region Textures
  loadTexture(): void {
    const { texture } = this.props;
    assertTruthy(texture);

    // If texture is already loaded / failed, trigger loaded event manually
    // so that users get a consistent event experience.
    // We do this in a microtask to allow listeners to be attached in the same
    // synchronous task after calling loadTexture()
    queueMicrotask(() => {
      // Preload texture if required
      if (this.textureOptions.preload) {
        texture.ctxTexture.load();
      }
      if (texture.state === 'loaded') {
        this.onTextureLoaded(texture, texture.dimensions!);
      } else if (texture.state === 'failed') {
        this.onTextureFailed(texture, texture.error!);
      } else if (texture.state === 'freed') {
        this.onTextureFreed(texture);
      }
      texture.on('loaded', this.onTextureLoaded);
      texture.on('failed', this.onTextureFailed);
      texture.on('freed', this.onTextureFreed);
    });
  }

  unloadTexture(): void {
    if (this.texture) {
      this.texture.off('loaded', this.onTextureLoaded);
      this.texture.off('failed', this.onTextureFailed);
      this.texture.off('freed', this.onTextureFreed);
      this.texture.setRenderableOwner(this, false);
    }
  }

  autosizeNode(dimensions: Dimensions) {
    if (this.autosize) {
      this.width = dimensions.width;
      this.height = dimensions.height;
    }
  }

  private onTextureLoaded: TextureLoadedEventHandler = (target, dimensions) => {
    this.autosizeNode(dimensions);

    // Texture was loaded. In case the RAF loop has already stopped, we request
    // a render to ensure the texture is rendered.
    this.stage.requestRender();

    // If parent has a render texture, flag that we need to update
    // @todo: Reserve type for RTT updates
    if (this.parentHasRenderTexture) {
      this.setRTTUpdates(1);
    }

    this.emit('loaded', {
      type: 'texture',
      dimensions,
    } satisfies NodeTextureLoadedPayload);

    // Trigger a local update if the texture is loaded and the resizeMode is 'contain'
    if (this.props.textureOptions?.resizeMode?.type === 'contain') {
      this.setUpdateType(UpdateType.Local);
    }
  };

  private onTextureFailed: TextureFailedEventHandler = (target, error) => {
    this.emit('failed', {
      type: 'texture',
      error,
    } satisfies NodeTextureFailedPayload);
  };

  private onTextureFreed: TextureFreedEventHandler = (target: Texture) => {
    this.emit('freed', {
      type: 'texture',
    } satisfies NodeTextureFreedPayload);
  };
  //#endregion Textures

  /**
   * Change types types is used to determine the scope of the changes being applied
   *
   * @remarks
   * See {@link UpdateType} for more information on each type
   *
   * @param type
   */
  setUpdateType(type: UpdateType): void {
    this.updateType |= type;

    // If we're updating this node at all, we need to inform the parent
    // (and all ancestors) that their children need updating as well
    const parent = this.props.parent;
    if (parent && !(parent.updateType & UpdateType.Children)) {
      parent.setUpdateType(UpdateType.Children);
    }
    // If node is part of RTT texture
    // Flag that we need to update
    if (this.parentHasRenderTexture) {
      this.setRTTUpdates(type);
    }
  }

  sortChildren() {
    this.children.sort((a, b) => a.calcZIndex - b.calcZIndex);
  }

  updateScaleRotateTransform() {
    this.scaleRotateTransform = Matrix3d.rotate(
      this.props.rotation,
      this.scaleRotateTransform,
    ).scale(this.props.scaleX, this.props.scaleY);
  }

  updateLocalTransform() {
    assertTruthy(this.scaleRotateTransform);
    const pivotTranslateX = this.props.pivotX * this.props.width;
    const pivotTranslateY = this.props.pivotY * this.props.height;
    const mountTranslateX = this.props.mountX * this.props.width;
    const mountTranslateY = this.props.mountY * this.props.height;

    this.localTransform = Matrix3d.translate(
      pivotTranslateX - mountTranslateX + this.props.x,
      pivotTranslateY - mountTranslateY + this.props.y,
      this.localTransform,
    )
      .multiply(this.scaleRotateTransform)
      .translate(-pivotTranslateX, -pivotTranslateY);

    // Handle 'contain' resize mode
    const { width, height } = this.props;
    const texture = this.props.texture;
    if (
      texture &&
      texture.dimensions &&
      this.props.textureOptions?.resizeMode?.type === 'contain'
    ) {
      let resizeModeScaleX = 1;
      let resizeModeScaleY = 1;
      let extraX = 0;
      let extraY = 0;
      const { width: tw, height: th } = texture.dimensions;
      const txAspectRatio = tw / th;
      const nodeAspectRatio = width / height;
      if (txAspectRatio > nodeAspectRatio) {
        // Texture is wider than node
        // Center the node vertically (shift down by extraY)
        // Scale the node vertically to maintain original aspect ratio
        const scaleX = width / tw;
        const scaledTxHeight = th * scaleX;
        extraY = (height - scaledTxHeight) / 2;
        resizeModeScaleY = scaledTxHeight / height;
      } else {
        // Texture is taller than node (or equal)
        // Center the node horizontally (shift right by extraX)
        // Scale the node horizontally to maintain original aspect ratio
        const scaleY = height / th;
        const scaledTxWidth = tw * scaleY;
        extraX = (width - scaledTxWidth) / 2;
        resizeModeScaleX = scaledTxWidth / width;
      }

      // Apply the extra translation and scale to the local transform
      this.localTransform
        .translate(extraX, extraY)
        .scale(resizeModeScaleX, resizeModeScaleY);
    }

    this.setUpdateType(UpdateType.Global);
  }

  /**
   * @todo: test for correct calculation flag
   * @param delta
   */
  update(delta: number, parentClippingRect: RectWithValid): void {
    if (this.updateType & UpdateType.ScaleRotate) {
      this.updateScaleRotateTransform();
      this.setUpdateType(UpdateType.Local);
    }

    if (this.updateType & UpdateType.Local) {
      this.updateLocalTransform();
      this.setUpdateType(UpdateType.Global);
    }

    const parent = this.props.parent;
    let childUpdateType = UpdateType.None;

    if (this.updateType & UpdateType.ParentRenderTexture) {
      let p = this.parent;
      while (p) {
        if (p.rtt) {
          this.parentHasRenderTexture = true;
        }
        p = p.parent;
      }
    }

    // If we have render texture updates and not already running a full update
    if (
      this.updateType ^ UpdateType.All &&
      this.updateType & UpdateType.RenderTexture
    ) {
      this.children.forEach((child) => {
        child.setUpdateType(UpdateType.All);
      });
    }

    if (this.updateType & UpdateType.Global) {
      assertTruthy(this.localTransform);

      this.globalTransform = Matrix3d.copy(
        parent?.globalTransform || this.localTransform,
        this.globalTransform,
      );

      if (this.parentHasRenderTexture && this.props.parent?.rtt) {
        this.globalTransform = Matrix3d.identity();
      }

      if (parent) {
        this.globalTransform.multiply(this.localTransform);
      }

      this.calculateRenderCoords();
      this.updateBoundingRect();
      this.setUpdateType(
        UpdateType.Clipping | UpdateType.RenderState | UpdateType.Children,
      );
      childUpdateType |= UpdateType.Global;
    }

    if (this.updateType & UpdateType.Clipping) {
      this.calculateClippingRect(parentClippingRect);
      this.setUpdateType(UpdateType.Children);
      childUpdateType |= UpdateType.Clipping;
    }

    if (this.updateType & UpdateType.WorldAlpha) {
      if (parent) {
        this.worldAlpha = parent.worldAlpha * this.props.alpha;
      } else {
        this.worldAlpha = this.props.alpha;
      }
      this.setUpdateType(
        UpdateType.Children |
          UpdateType.PremultipliedColors |
          UpdateType.IsRenderable,
      );
      childUpdateType |= UpdateType.WorldAlpha;
    }

    if (this.updateType & UpdateType.PremultipliedColors) {
      this.premultipliedColorTl = mergeColorAlphaPremultiplied(
        this.props.colorTl,
        this.worldAlpha,
        true,
      );

      // If all the colors are the same just sent them all to the same value
      if (
        this.props.colorTl === this.props.colorTr &&
        this.props.colorBl === this.props.colorBr &&
        this.props.colorTl === this.props.colorBl
      ) {
        this.premultipliedColorTr =
          this.premultipliedColorBl =
          this.premultipliedColorBr =
            this.premultipliedColorTl;
      } else {
        this.premultipliedColorTr = mergeColorAlphaPremultiplied(
          this.props.colorTr,
          this.worldAlpha,
          true,
        );
        this.premultipliedColorBl = mergeColorAlphaPremultiplied(
          this.props.colorBl,
          this.worldAlpha,
          true,
        );
        this.premultipliedColorBr = mergeColorAlphaPremultiplied(
          this.props.colorBr,
          this.worldAlpha,
          true,
        );
      }
    }

    if (this.updateType & UpdateType.RenderState) {
      this.updateRenderState(parentClippingRect);
      this.setUpdateType(UpdateType.IsRenderable);
    }

    if (this.updateType & UpdateType.IsRenderable) {
      this.updateIsRenderable();
    }

    // No need to update zIndex if there is no parent
    if (parent && this.updateType & UpdateType.CalculatedZIndex) {
      this.calculateZIndex();
      // Tell parent to re-sort children
      parent.setUpdateType(UpdateType.ZIndexSortedChildren);
    }

    if (
      this.updateType & UpdateType.Children &&
      this.children.length &&
      !this.rtt
    ) {
      this.children.forEach((child) => {
        // Trigger the depenedent update types on the child
        child.setUpdateType(childUpdateType);
        // If child has no updates, skip
        if (child.updateType === 0) {
          return;
        }
        child.update(delta, this.clippingRect);
      });
    }

    // Sorting children MUST happen after children have been updated so
    // that they have the oppotunity to update their calculated zIndex.
    if (this.updateType & UpdateType.ZIndexSortedChildren) {
      // reorder z-index
      this.sortChildren();
    }

    // reset update type
    this.updateType = 0;
  }

  //check if CoreNode is renderable based on props
  checkRenderProps(): boolean {
    if (this.props.texture) {
      return true;
    }

    if (!this.props.width || !this.props.height) {
      return false;
    }

    if (this.props.shader === this.stage.defShaderCtr) {
      return true;
    }

    if (this.props.clipping) {
      return true;
    }

    if (this.props.color !== 0) {
      return true;
    }

    // Consider removing these checks and just using the color property check above.
    // Maybe add a forceRender prop for nodes that should always render.
    if (this.props.colorTop !== 0) {
      return true;
    }

    if (this.props.colorBottom !== 0) {
      return true;
    }

    if (this.props.colorLeft !== 0) {
      return true;
    }

    if (this.props.colorRight !== 0) {
      return true;
    }

    if (this.props.colorTl !== 0) {
      return true;
    }

    if (this.props.colorTr !== 0) {
      return true;
    }

    if (this.props.colorBl !== 0) {
      return true;
    }

    if (this.props.colorBr !== 0) {
      return true;
    }
    return false;
  }

  checkRenderBounds(parentClippingRect: RectWithValid): CoreNodeRenderState {
    assertTruthy(this.renderBound);
    const rectW = parentClippingRect.width || this.stage.root.width;
    const rectH = parentClippingRect.height || this.stage.root.height;
    this.strictBound = createBound(
      parentClippingRect.x,
      parentClippingRect.y,
      parentClippingRect.x + rectW,
      parentClippingRect.y + rectH,
      this.strictBound,
    );

    if (boundInsideBound(this.renderBound, this.strictBound)) {
      return CoreNodeRenderState.InViewport;
    }

    const renderM = this.stage.boundsMargin;
    this.preloadBound = createBound(
      this.strictBound.x1 - renderM[3],
      this.strictBound.y1 - renderM[0],
      this.strictBound.x2 + renderM[1],
      this.strictBound.y2 + renderM[2],
      this.preloadBound,
    );

    if (boundInsideBound(this.renderBound, this.preloadBound)) {
      return CoreNodeRenderState.InBounds;
    }
    return CoreNodeRenderState.OutOfBounds;
  }

  updateRenderState(parentClippingRect: RectWithValid) {
    const renderState = this.checkRenderBounds(parentClippingRect);

    if (renderState === this.renderState) {
      return;
    }

    const previous = this.renderState;
    this.renderState = renderState;
    const event = CoreNodeRenderStateMap.get(renderState);
    assertTruthy(event);
    this.emit(event, {
      previous,
      current: renderState,
    });
  }

  /**
   * This function updates the `isRenderable` property based on certain conditions.
   *
   * @returns
   */
  updateIsRenderable() {
    let newIsRenderable;
    if (this.worldAlpha === 0 || !this.checkRenderProps()) {
      newIsRenderable = false;
    } else {
      newIsRenderable = this.renderState > CoreNodeRenderState.OutOfBounds;
    }
    if (this.isRenderable !== newIsRenderable) {
      this.isRenderable = newIsRenderable;
      this.onChangeIsRenderable(newIsRenderable);
    }
  }

  onChangeIsRenderable(isRenderable: boolean) {
    this.texture?.setRenderableOwner(this, isRenderable);
  }

  calculateRenderCoords() {
    const { width, height, globalTransform: transform } = this;
    assertTruthy(transform);
    const { tx, ty, ta, tb, tc, td } = transform;
    if (tb === 0 && tc === 0) {
      const minX = tx;
      const maxX = tx + width * ta;

      const minY = ty;
      const maxY = ty + height * td;
      this.renderCoords = RenderCoords.translate(
        //top-left
        minX,
        minY,
        //top-right
        maxX,
        minY,
        //bottom-right
        maxX,
        maxY,
        //bottom-left
        minX,
        maxY,
        this.renderCoords,
      );
    } else {
      this.renderCoords = RenderCoords.translate(
        //top-left
        tx,
        ty,
        //top-right
        tx + width * ta,
        ty + width * tc,
        //bottom-right
        tx + width * ta + height * tb,
        ty + width * tc + height * td,
        //bottom-left
        tx + height * tb,
        ty + height * td,
        this.renderCoords,
      );
    }
  }

  updateBoundingRect() {
    const { renderCoords, globalTransform: transform } = this;
    assertTruthy(transform);
    assertTruthy(renderCoords);

    const { tb, tc } = transform;
    const { x1, y1, x3, y3 } = renderCoords;
    if (tb === 0 || tc === 0) {
      this.renderBound = createBound(x1, y1, x3, y3, this.renderBound);
    } else {
      const { x2, x4, y2, y4 } = renderCoords;
      this.renderBound = createBound(
        Math.min(x1, x2, x3, x4),
        Math.min(y1, y2, y3, y4),
        Math.max(x1, x2, x3, x4),
        Math.max(y1, y2, y3, y4),
        this.renderBound,
      );
    }
  }
  /**
   * This function calculates the clipping rectangle for a node.
   *
   * The function then checks if the node is rotated. If the node requires clipping and is not rotated, a new clipping rectangle is created based on the node's global transform and dimensions.
   * If a parent clipping rectangle exists, it is intersected with the node's clipping rectangle (if it exists), or replaces the node's clipping rectangle.
   *
   * Finally, the node's parentClippingRect and clippingRect properties are updated.
   */
  calculateClippingRect(parentClippingRect: RectWithValid) {
    assertTruthy(this.globalTransform);
    const { clippingRect, props, globalTransform: gt } = this;
    const { clipping } = props;

    const isRotated = gt.tb !== 0 || gt.tc !== 0;

    if (clipping && !isRotated) {
      clippingRect.x = gt.tx;
      clippingRect.y = gt.ty;
      clippingRect.width = this.width * gt.ta;
      clippingRect.height = this.height * gt.td;
      clippingRect.valid = true;
    } else {
      clippingRect.valid = false;
    }

    if (parentClippingRect.valid && clippingRect.valid) {
      // Intersect parent clipping rect with node clipping rect
      intersectRect(parentClippingRect, clippingRect, clippingRect);
    } else if (parentClippingRect.valid) {
      // Copy parent clipping rect
      copyRect(parentClippingRect, clippingRect);
      clippingRect.valid = true;
    }
  }

  calculateZIndex(): void {
    const props = this.props;
    const z = props.zIndex || 0;
    const p = props.parent?.zIndex || 0;

    let zIndex = z;
    if (props.parent?.zIndexLocked) {
      zIndex = z < p ? z : p;
    }
    this.calcZIndex = zIndex;
  }

  /**
   * Destroy the node and cleanup all resources
   */
  destroy(): void {
    this.unloadTexture();

    this.clippingRect.valid = false;

    this.isRenderable = false;

    delete this.renderCoords;
    delete this.renderBound;
    delete this.strictBound;
    delete this.preloadBound;
    delete this.globalTransform;
    delete this.scaleRotateTransform;
    delete this.localTransform;

    this.props.texture = null;
    this.props.shader = this.stage.defShaderCtr;

    if (this.rtt) {
      this.stage.renderer.removeRTTNode(this);
    }

    this.removeAllListeners();
    this.parent = null;
  }

  renderQuads(renderer: CoreRenderer): void {
    const { texture, width, height, textureOptions, rtt, shader } = this.props;

    // Prevent quad rendering if parent has a render texture
    // and renderer is not currently rendering to a texture
    if (this.parentHasRenderTexture) {
      if (!renderer.renderToTextureActive) {
        return;
      }
      // Prevent quad rendering if parent render texture is not the active render texture
      if (this.parentRenderTexture !== renderer.activeRttNode) {
        return;
      }
    }

    const {
      premultipliedColorTl,
      premultipliedColorTr,
      premultipliedColorBl,
      premultipliedColorBr,
    } = this;

    const {
      zIndex,
      worldAlpha,
      globalTransform: gt,
      clippingRect,
      renderCoords,
    } = this;

    assertTruthy(gt);
    assertTruthy(renderCoords);

    // add to list of renderables to be sorted before rendering
    renderer.addQuad({
      width,
      height,
      colorTl: premultipliedColorTl,
      colorTr: premultipliedColorTr,
      colorBl: premultipliedColorBl,
      colorBr: premultipliedColorBr,
      texture,
      textureOptions,
      zIndex,
      shader: shader.shader,
      shaderProps: shader.props,
      alpha: worldAlpha,
      clippingRect,
      tx: gt.tx,
      ty: gt.ty,
      ta: gt.ta,
      tb: gt.tb,
      tc: gt.tc,
      td: gt.td,
      renderCoords,
      rtt,
      parentHasRenderTexture: this.parentHasRenderTexture,
      framebufferDimensions: this.framebufferDimensions,
    });
  }

  //#region Properties
  get id(): number {
    return this._id;
  }

  get x(): number {
    return this.props.x;
  }

  set x(value: number) {
    if (this.props.x !== value) {
      this.props.x = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get absX(): number {
    return (
      this.props.x +
      (this.props.parent?.absX || this.props.parent?.globalTransform?.tx || 0)
    );
  }

  get absY(): number {
    return this.props.y + (this.props.parent?.absY ?? 0);
  }

  get y(): number {
    return this.props.y;
  }

  set y(value: number) {
    if (this.props.y !== value) {
      this.props.y = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get width(): number {
    return this.props.width;
  }

  set width(value: number) {
    if (this.props.width !== value) {
      this.props.width = value;
      this.setUpdateType(UpdateType.Local);

      if (this.props.rtt) {
        this.texture = this.stage.txManager.loadTexture('RenderTexture', {
          width: this.width,
          height: this.height,
        });
        this.textureOptions.preload = true;
        this.setUpdateType(UpdateType.RenderTexture);
      }
    }
  }

  get height(): number {
    return this.props.height;
  }

  set height(value: number) {
    if (this.props.height !== value) {
      this.props.height = value;
      this.setUpdateType(UpdateType.Local);

      if (this.props.rtt) {
        this.texture = this.stage.txManager.loadTexture('RenderTexture', {
          width: this.width,
          height: this.height,
        });
        this.textureOptions.preload = true;
        this.setUpdateType(UpdateType.RenderTexture);
      }
    }
  }

  get scale(): number {
    // The CoreNode `scale` property is only used by Animations.
    // Unlike INode, `null` should never be possibility for Animations.
    return this.scaleX;
  }

  set scale(value: number) {
    // The CoreNode `scale` property is only used by Animations.
    // Unlike INode, `null` should never be possibility for Animations.
    this.scaleX = value;
    this.scaleY = value;
  }

  get scaleX(): number {
    return this.props.scaleX;
  }

  set scaleX(value: number) {
    if (this.props.scaleX !== value) {
      this.props.scaleX = value;
      this.setUpdateType(UpdateType.ScaleRotate);
    }
  }

  get scaleY(): number {
    return this.props.scaleY;
  }

  set scaleY(value: number) {
    if (this.props.scaleY !== value) {
      this.props.scaleY = value;
      this.setUpdateType(UpdateType.ScaleRotate);
    }
  }

  get mount(): number {
    return this.props.mount;
  }

  set mount(value: number) {
    if (this.props.mountX !== value || this.props.mountY !== value) {
      this.props.mountX = value;
      this.props.mountY = value;
      this.props.mount = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get mountX(): number {
    return this.props.mountX;
  }

  set mountX(value: number) {
    if (this.props.mountX !== value) {
      this.props.mountX = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get mountY(): number {
    return this.props.mountY;
  }

  set mountY(value: number) {
    if (this.props.mountY !== value) {
      this.props.mountY = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get pivot(): number {
    return this.props.pivot;
  }

  set pivot(value: number) {
    if (this.props.pivotX !== value || this.props.pivotY !== value) {
      this.props.pivotX = value;
      this.props.pivotY = value;
      this.props.pivot = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get pivotX(): number {
    return this.props.pivotX;
  }

  set pivotX(value: number) {
    if (this.props.pivotX !== value) {
      this.props.pivotX = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get pivotY(): number {
    return this.props.pivotY;
  }

  set pivotY(value: number) {
    if (this.props.pivotY !== value) {
      this.props.pivotY = value;
      this.setUpdateType(UpdateType.Local);
    }
  }

  get rotation(): number {
    return this.props.rotation;
  }

  set rotation(value: number) {
    if (this.props.rotation !== value) {
      this.props.rotation = value;
      this.setUpdateType(UpdateType.ScaleRotate);
    }
  }

  get alpha(): number {
    return this.props.alpha;
  }

  set alpha(value: number) {
    this.props.alpha = value;
    this.setUpdateType(UpdateType.PremultipliedColors | UpdateType.WorldAlpha);
  }

  get autosize(): boolean {
    return this.props.autosize;
  }

  set autosize(value: boolean) {
    this.props.autosize = value;
  }

  get clipping(): boolean {
    return this.props.clipping;
  }

  set clipping(value: boolean) {
    this.props.clipping = value;
    this.setUpdateType(UpdateType.Clipping);
  }

  get color(): number {
    return this.props.color;
  }

  set color(value: number) {
    this.colorTop = value;
    this.colorBottom = value;
    this.colorLeft = value;
    this.colorRight = value;
    this.props.color = value;

    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorTop(): number {
    return this.props.colorTop;
  }

  set colorTop(value: number) {
    if (this.props.colorTl !== value || this.props.colorTr !== value) {
      this.colorTl = value;
      this.colorTr = value;
    }
    this.props.colorTop = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorBottom(): number {
    return this.props.colorBottom;
  }

  set colorBottom(value: number) {
    if (this.props.colorBl !== value || this.props.colorBr !== value) {
      this.colorBl = value;
      this.colorBr = value;
    }
    this.props.colorBottom = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorLeft(): number {
    return this.props.colorLeft;
  }

  set colorLeft(value: number) {
    if (this.props.colorTl !== value || this.props.colorBl !== value) {
      this.colorTl = value;
      this.colorBl = value;
    }
    this.props.colorLeft = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorRight(): number {
    return this.props.colorRight;
  }

  set colorRight(value: number) {
    if (this.props.colorTr !== value || this.props.colorBr !== value) {
      this.colorTr = value;
      this.colorBr = value;
    }
    this.props.colorRight = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorTl(): number {
    return this.props.colorTl;
  }

  set colorTl(value: number) {
    this.props.colorTl = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorTr(): number {
    return this.props.colorTr;
  }

  set colorTr(value: number) {
    this.props.colorTr = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorBl(): number {
    return this.props.colorBl;
  }

  set colorBl(value: number) {
    this.props.colorBl = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  get colorBr(): number {
    return this.props.colorBr;
  }

  set colorBr(value: number) {
    this.props.colorBr = value;
    this.setUpdateType(UpdateType.PremultipliedColors);
  }

  // we're only interested in parent zIndex to test
  // if we should use node zIndex is higher then parent zIndex
  get zIndexLocked(): number {
    return this.props.zIndexLocked || 0;
  }

  set zIndexLocked(value: number) {
    this.props.zIndexLocked = value;
    this.setUpdateType(UpdateType.CalculatedZIndex | UpdateType.Children);
    this.children.forEach((child) => {
      child.setUpdateType(UpdateType.CalculatedZIndex);
    });
  }

  get zIndex(): number {
    return this.props.zIndex;
  }

  set zIndex(value: number) {
    this.props.zIndex = value;
    this.setUpdateType(UpdateType.CalculatedZIndex | UpdateType.Children);
    this.children.forEach((child) => {
      child.setUpdateType(UpdateType.CalculatedZIndex);
    });
  }

  get parent(): CoreNode | null {
    return this.props.parent;
  }

  set parent(newParent: CoreNode | null) {
    const oldParent = this.props.parent;
    if (oldParent === newParent) {
      return;
    }
    this.props.parent = newParent;
    if (oldParent) {
      const index = oldParent.children.indexOf(this);
      assertTruthy(
        index !== -1,
        "CoreNode.parent: Node not found in old parent's children!",
      );
      oldParent.children.splice(index, 1);
      oldParent.setUpdateType(
        UpdateType.Children | UpdateType.ZIndexSortedChildren,
      );
    }
    if (newParent) {
      newParent.children.push(this);
      // Since this node has a new parent, to be safe, have it do a full update.
      this.setUpdateType(UpdateType.All);
      // Tell parent that it's children need to be updated and sorted.
      newParent.setUpdateType(
        UpdateType.Children | UpdateType.ZIndexSortedChildren,
      );

      if (newParent.rtt || newParent.parentHasRenderTexture) {
        this.setRTTUpdates(UpdateType.All);
      }
    }
    this.updateScaleRotateTransform();
  }

  get rtt(): boolean {
    return this.props.rtt;
  }

  set rtt(value: boolean) {
    if (this.props.rtt === true) {
      this.props.rtt = value;

      // unload texture if we used to have a render texture
      if (value === false && this.texture !== null) {
        this.unloadTexture();
        this.setUpdateType(UpdateType.All);

        this.children.forEach((child) => {
          child.parentHasRenderTexture = false;
        });

        this.stage.renderer?.removeRTTNode(this);
        return;
      }
    }

    // if the new value is false and we didnt have rtt previously, we don't need to do anything
    if (value === false) {
      return;
    }

    // load texture
    this.texture = this.stage.txManager.loadTexture('RenderTexture', {
      width: this.width,
      height: this.height,
    });
    this.textureOptions.preload = true;

    this.props.rtt = true;
    this.hasRTTupdates = true;
    this.setUpdateType(UpdateType.All);

    this.children.forEach((child) => {
      child.setUpdateType(UpdateType.All);
    });

    // Store RTT nodes in a separate list
    this.stage.renderer?.renderToTexture(this);
  }

  get shader(): BaseShaderController {
    return this.props.shader;
  }

  set shader(value: BaseShaderController) {
    if (this.props.shader === value) {
      return;
    }

    this.props.shader = value;

    if (value === this.stage.defShaderCtr) {
      this.setUpdateType(UpdateType.IsRenderable);
    }
  }

  get src(): string {
    return this._src;
  }

  set src(imageUrl: string) {
    if (this._src === imageUrl) {
      return;
    }

    this._src = imageUrl;

    if (!imageUrl) {
      this.texture = null;
      return;
    }

    this.texture = this.stage.txManager.loadTexture('ImageTexture', {
      src: imageUrl,
    });
  }

  /**
   * Returns the framebuffer dimensions of the node.
   * If the node has a render texture, the dimensions are the same as the node's dimensions.
   * If the node does not have a render texture, the dimensions are inherited from the parent.
   * If the node parent has a render texture and the node is a render texture, the nodes dimensions are used.
   */
  get framebufferDimensions(): Dimensions {
    if (this.parentHasRenderTexture && !this.rtt && this.parent) {
      return this.parent.framebufferDimensions;
    }
    return { width: this.width, height: this.height };
  }

  /**
   * Returns the parent render texture node if it exists.
   */
  get parentRenderTexture(): CoreNode | null {
    let parent = this.parent;
    while (parent) {
      if (parent.rtt) {
        return parent;
      }
      parent = parent.parent;
    }
    return null;
  }

  get texture(): Texture | null {
    return this.props.texture;
  }

  set texture(value: Texture | null) {
    if (this.props.texture === value) {
      return;
    }
    const oldTexture = this.props.texture;
    if (oldTexture) {
      oldTexture.setRenderableOwner(this, false);
      this.unloadTexture();
    }
    this.props.texture = value;
    if (value) {
      value.setRenderableOwner(this, this.isRenderable);
      this.loadTexture();
    }
    this.setUpdateType(UpdateType.IsRenderable);
  }

  set textureOptions(value: TextureOptions) {
    this.props.textureOptions = value;
  }

  get textureOptions(): TextureOptions {
    return this.props.textureOptions;
  }

  setRTTUpdates(type: number) {
    this.hasRTTupdates = true;
    this.parent?.setRTTUpdates(type);
  }

  animate(
    props: Partial<CoreNodeAnimateProps>,
    settings: Partial<AnimationSettings>,
  ): IAnimationController {
    const animation = new CoreAnimation(this, props, settings);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const controller = new CoreAnimationController(
      this.stage.animationManager,
      animation,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return controller;
  }

  flush() {
    // no-op
  }

  //#endregion Properties
}
