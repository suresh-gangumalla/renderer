export interface CoreWebGlParameters {
  MAX_RENDERBUFFER_SIZE: number;
  MAX_TEXTURE_SIZE: number;
  MAX_VIEWPORT_DIMS: Int32Array;
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: number;
  MAX_TEXTURE_IMAGE_UNITS: number;
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: number;
  MAX_VERTEX_ATTRIBS: number;
  MAX_VARYING_VECTORS: number;
  MAX_VERTEX_UNIFORM_VECTORS: number;
  MAX_FRAGMENT_UNIFORM_VECTORS: number;
}

/**
 * Get device specific webgl parameters
 * @param gl
 */
export function getWebGlParameters(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
): CoreWebGlParameters {
  const params: CoreWebGlParameters = {
    MAX_RENDERBUFFER_SIZE: 0,
    MAX_TEXTURE_SIZE: 0,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
    MAX_VIEWPORT_DIMS: 0 as any, // Code below will replace this with an Int32Array
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0,
    MAX_TEXTURE_IMAGE_UNITS: 0,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0,
    MAX_VERTEX_ATTRIBS: 0,
    MAX_VARYING_VECTORS: 0,
    MAX_VERTEX_UNIFORM_VECTORS: 0,
    MAX_FRAGMENT_UNIFORM_VECTORS: 0,
  };

  // Map over all parameters and get them
  const keys = Object.keys(params) as Array<keyof CoreWebGlParameters>;
  keys.forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    params[key] = gl.getParameter(gl[key]);
  });

  return params;
}

export interface CoreWebGlExtensions {
  ANGLE_instanced_arrays: ANGLE_instanced_arrays | null;
  WEBGL_compressed_texture_s3tc: WEBGL_compressed_texture_s3tc | null;
  WEBGL_compressed_texture_astc: WEBGL_compressed_texture_astc | null;
  WEBGL_compressed_texture_etc: WEBGL_compressed_texture_etc | null;
  WEBGL_compressed_texture_etc1: WEBGL_compressed_texture_etc1 | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WEBGL_compressed_texture_pvrtc: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  WEBKIT_WEBGL_compressed_texture_pvrtc: any | null;
  WEBGL_compressed_texture_s3tc_srgb: WEBGL_compressed_texture_s3tc_srgb | null;
  OES_vertex_array_object: OES_vertex_array_object | null;
}

/**
 * Get device webgl extensions
 * @param gl
 */
export function getWebGlExtensions(
  gl: WebGLRenderingContext,
): CoreWebGlExtensions {
  const extensions: CoreWebGlExtensions = {
    ANGLE_instanced_arrays: null,
    WEBGL_compressed_texture_s3tc: null,
    WEBGL_compressed_texture_astc: null,
    WEBGL_compressed_texture_etc: null,
    WEBGL_compressed_texture_etc1: null,
    WEBGL_compressed_texture_pvrtc: null,
    WEBKIT_WEBGL_compressed_texture_pvrtc: null,
    WEBGL_compressed_texture_s3tc_srgb: null,
    OES_vertex_array_object: null,
  };

  // Map over all extensions and get them
  const keys = Object.keys(extensions) as Array<keyof CoreWebGlExtensions>;
  keys.forEach((key) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    extensions[key] = gl.getExtension(key);
  });

  return extensions;
}

/**
 * Allocate big memory chunk that we
 * can re-use to draw quads
 * @param size
 */
export function createIndexBuffer(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  size: number,
) {
  if (!gl) {
    throw new Error('No WebGL context');
  }
  const maxQuads = ~~(size / 80);
  const indices = new Uint16Array(maxQuads * 6);

  for (let i = 0, j = 0; i < maxQuads; i += 6, j += 4) {
    indices[i] = j;
    indices[i + 1] = j + 1;
    indices[i + 2] = j + 2;
    indices[i + 3] = j + 2;
    indices[i + 4] = j + 1;
    indices[i + 5] = j + 3;
  }

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
}