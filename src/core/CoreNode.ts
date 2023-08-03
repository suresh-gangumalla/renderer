import { assertTruthy } from '../utils.js';
import type { ShaderMap } from './CoreShaderManager.js';
import type {
  ExtractProps,
  TextureMap,
  TextureOptions,
} from './CoreTextureManager.js';
import type { CoreRenderer } from './renderers/CoreRenderer.js';
import type { CoreShader } from './renderers/CoreShader.js';
import type { Stage } from './Stage.js';
import type { Texture } from './textures/Texture.js';

export interface CoreNodeProps {
  id: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  alpha?: number;
  color?: number;
  parent?: CoreNode | null;
  zIndex?: number;
  texture?: Texture | null;
  textureOptions?: TextureOptions | null;
  shader?: CoreShader | null;
  shaderProps?: Record<string, unknown> | null;
}

export class CoreNode {
  readonly children: CoreNode[] = [];
  private props: Required<CoreNodeProps>;

  constructor(private stage: Stage, props: CoreNodeProps) {
    this.props = {
      id: props.id,
      x: props.x ?? 0,
      y: props.y ?? 0,
      w: props.w ?? 0,
      h: props.h ?? 0,
      alpha: props.alpha ?? 0,
      color: props.color ?? 0,
      zIndex: props.zIndex ?? 0,
      parent: props.parent ?? null,
      texture: props.texture ?? null,
      textureOptions: props.textureOptions ?? null,
      shader: props.shader ?? null,
      shaderProps: props.shaderProps ?? null,
    };
  }

  loadTexture<Type extends keyof TextureMap>(
    textureType: Type,
    props: ExtractProps<TextureMap[Type]>,
    options: TextureOptions | null = null,
  ): void {
    const { txManager } = this.stage;
    this.props.texture = txManager.loadTexture(textureType, props, options);
    this.props.textureOptions = options;
  }

  unloadTexture(): void {
    this.props.texture = null;
    this.props.textureOptions = null;
  }

  loadShader<Type extends keyof ShaderMap>(
    shaderType: Type,
    props?: ExtractProps<ShaderMap[Type]>,
  ): void {
    const shManager = this.stage.renderer.getShaderManager();
    assertTruthy(shManager);
    this.props.shader = shManager.loadShader(shaderType);
    this.props.shaderProps = props as any;
  }

  update(delta: number): void {
    // TODO: Implement
  }

  renderQuads(renderer: CoreRenderer): void {
    const { w, h, color, texture, textureOptions, shader, shaderProps } =
      this.props;
    const { absX, absY } = this;

    // Calculate absolute X and Y based on all ancestors
    renderer.addQuad(
      absX,
      absY,
      w,
      h,
      color,
      texture,
      textureOptions,
      shader,
      shaderProps,
    );
  }

  //#region Properties
  get id(): number {
    return this.props.id;
  }

  get x(): number {
    return this.props.x;
  }

  set x(value: number) {
    this.props.x = value;
  }

  get absX(): number {
    return this.props.x + (this.props.parent?.absX ?? 0);
  }

  get absY(): number {
    return this.props.y + (this.props.parent?.absY ?? 0);
  }

  get y(): number {
    return this.props.y;
  }

  set y(value: number) {
    this.props.y = value;
  }

  get w(): number {
    return this.props.w;
  }

  set w(value: number) {
    this.props.w = value;
  }

  get h(): number {
    return this.props.h;
  }

  set h(value: number) {
    this.props.h = value;
  }

  get alpha(): number {
    return this.props.alpha;
  }

  set alpha(value: number) {
    this.props.alpha = value;
  }

  get color(): number {
    return this.props.color;
  }

  set color(value: number) {
    this.props.color = value;
  }

  get zIndex(): number {
    return this.props.zIndex;
  }

  set zIndex(value: number) {
    this.props.zIndex = value;
  }

  get parent(): CoreNode | null {
    return this.props.parent;
  }

  set parent(newParent: CoreNode | null) {
    const oldParent = this.props.parent;
    this.props.parent = newParent;
    if (oldParent) {
      const index = oldParent.children.indexOf(this);
      assertTruthy(
        index !== -1,
        "CoreNode.parent: Node not found in old parent's children!",
      );
      oldParent.children.splice(index, 1);
    }
    if (newParent) {
      newParent.children.push(this);
    }
  }
  //#endregion Properties
}