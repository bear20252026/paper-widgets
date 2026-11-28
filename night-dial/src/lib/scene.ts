import { FS, VS } from "./shaders";

/** The canvas's backing size: the 1080 stage at 2 px per stage px (the shader assumes it). */
export const CANVAS_PX = 2160;

export type Uniforms = { uB: number; uW: number; uT: number; uP: number };

export type Scene = {
  draw: (u: Uniforms) => void;
  dispose: () => void;
};

/** WebGL2 on the stage's canvas: one program, one full-screen triangle. Throws if WebGL2 isn't there. */
export function createScene(cv: HTMLCanvasElement): Scene {
  cv.width = CANVAS_PX;
  cv.height = CANVAS_PX;
  const gl = cv.getContext("webgl2", { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
  if (!gl) throw new Error("WebGL2 is not available");
  const sh = (type: number, src: string) => {
    const x = gl.createShader(type)!;
    gl.shaderSource(x, src);
    gl.compileShader(x);
    if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(x));
    return x;
  };
  const vs = sh(gl.VERTEX_SHADER, VS),
    fs = sh(gl.FRAGMENT_SHADER, FS);
  const pr = gl.createProgram();
  gl.attachShader(pr, vs);
  gl.attachShader(pr, fs);
  gl.linkProgram(pr);
  gl.useProgram(pr);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const al = gl.getAttribLocation(pr, "p");
  gl.enableVertexAttribArray(al);
  gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
  const U = {
    uB: gl.getUniformLocation(pr, "uB"),
    uW: gl.getUniformLocation(pr, "uW"),
    uT: gl.getUniformLocation(pr, "uT"),
    uP: gl.getUniformLocation(pr, "uP"),
  };
  gl.viewport(0, 0, CANVAS_PX, CANVAS_PX);

  return {
    draw({ uB, uW, uT, uP }) {
      gl.uniform1f(U.uB, uB);
      gl.uniform1f(U.uW, uW);
      gl.uniform1f(U.uT, uT);
      gl.uniform1f(U.uP, uP);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteBuffer(vb);
      gl.deleteProgram(pr);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}
