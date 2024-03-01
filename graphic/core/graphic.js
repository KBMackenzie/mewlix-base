'use strict';
const ensure = Mewlix.ensure;
const clamp  = Mewlix.clamp;

/* Convert percentage value (0% - 100%) to byte (0 - 255) */
const percentToByte = p => Math.floor((255 * p) / 100);

/* -----------------------------------
 * Initializing Canvas:
 * ----------------------------------- */
/** @type {HTMLCanvasElement} */
const canvas  = document.getElementById('drawing-canvas');
/** @type {CanvasRenderingContext2D} */
const context = canvas.getContext('2d');

/** @type {Map<string, ImageBitmap>} */
const spriteMap = new Map();
/** @type {Map<string, AudioBuffer>} */
const audioMap  = new Map();

const spriteWidth  = 16;
const spriteHeight = 16;

/* -----------------------------------
 * Loading Images:
 * ----------------------------------- */
const loadImage = (key, path, width, height) => fetch(path)
  .then(response => response.blob())
  .then(blob => createImageBitmap(blob, 0, 0, width, height))
  .then(image => {
    spriteMap.set(key, image);
    return image;
  });

const loadSprite = (key, path) => loadImage(key, path, spriteWidth, spriteHeight);

/* -----------------------------------
 * Drawing:
 * ----------------------------------- */
const getSprite = key => {
  if (!spriteMap.has(key)) {
    throw new Mewlix.MewlixError(Mewlix.ErrorCode.Graphic,
      `No loaded image resource associated with key "${key}"!`);
  }
  return spriteMap.get(key);
}

const drawSprite = (key, x = 0, y = 0) => {
  const image = getSprite(key);
  context.drawImage(image, x, y);
};

/* -----------------------------------
 * Types:
 * ----------------------------------- */
/* Color container, wrapping a RGBA color value.
 *
 * It also implements .toColor(), complying with the 'ToColor' interface concept:
 * Any object that implements a .toColor() method can be considered a valid color representation. */
class Color extends Mewlix.Clowder {
  constructor(red, green, blue, opacity = 100) {
    super();
    ensure.all.number(red, green, blue, opacity);
    this.red      = clamp(red, 0, 255);
    this.green    = clamp(green, 0, 255);
    this.blue     = clamp(blue, 0, 255);
    this.opacity  = clamp(opacity, 0, 100);
  }

  alpha() { /* alpha byte value! */
    return percentToByte(this.opacity);
  }

  toColor() {
    return this;
  }

  toString() {
    return `rgb(${this.red} ${this.green} ${this.blue} / ${this.alpha()}%)`;
  }

  static fromHex(hex) {
    ensure.string(hex);
    if (hex[0] === '#') { hex = hex.slice(1); }

    if (hex.length === 3) {
      hex = hex.split('').map(x => x + x).join('');
    }
    if (hex.length < 6) return null;

    return new Color(
      parseInt(hex.slice(0, 1), 16),
      parseInt(hex.slice(2, 3), 16),
      parseInt(hex.slice(4, 5), 16),
    );
  }
}

/* A pixel canvas for efficiently creating sprites and sprites.
 *
 * The .toImage() creates a new ImageBitmap object from the pixel data.
 * The generated ImageBitmap object can be used with the HTML5 Canvas .drawImage() method! */
class PixelCanvas extends Mewlix.Clowder {
  constructor(width, height) {
    super();
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    Mewlix.opaque(this.data);
  }

  fill(color) {
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i]     = color.red;
      this.data[i + 1] = color.green;
      this.data[i + 2] = color.blue;
      this.data[i + 3] = color.alpha();
    }
  }

  setPixel(x, y, color) {
    const index = (x * this.width + y) * 4;
    this.data[index]     = color.red;
    this.data[index + 1] = color.green;
    this.data[index + 2] = color.blue;
    this.data[index + 3] = color.alpha();
  }

  setTile(x, y, { data }) {
    const index = (x * this.width + y) * 4;
    const dataSize = Math.min(this.data.length - index, data.length);

    for (let i = 0; i < dataSize; i++) {
      this.data[index + i] = data[i];
    }
  }

  async toImage(key) {
    const data  = new ImageData(this.data, this.width, this.height);
    const image = await createImageBitmap(data);
    spriteMap.set(key, image);
  }
};

class SpriteCanvas extends PixelCanvas {
  constructor() {
    super(spriteWidth, spriteHeight);
  }
}

/* -----------------------------------
 * Font Constants:
 * ----------------------------------- */
const fontData = {
  size: 12,
};

/* -----------------------------------
 * Loading Fonts:
 * ----------------------------------- */
const loadFont = (name, url) => new FontFace(name, url)
  .load()
  .then(font => {
    document.fonts.add(font);
  });

/* -----------------------------------
 * Drawing Fonts:
 * ----------------------------------- */
const drawText = (value, x = 0, y = 0, fontSize = 12, font = null, color = null) => {
  ensure.number(fontSize);
  const text = Mewlix.purrify(value);

  context.font = `${fontSize}px ${font ?? 'Courier New'}, monospace`;
  context.fillStyle = color?.toString() ?? 'black';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.fillText(text, x, y);
};

/* -----------------------------------
 * Initializing Audio:
 * ----------------------------------- */
const audioContext = new AudioContext();
const masterVolume = audioContext.createGain();
const compressor   = audioContext.createDynamicsCompressor();

masterVolume.connect(compressor).connect(audioContext.destination);

const musicVolume = audioContext.createGain();
const sfxVolume   = audioContext.createGain();

musicVolume.connect(masterVolume);
sfxVolume.connect(masterVolume);

// Mutable state my behated!
/** @type {AudioBufferSourceNode} */
let musicSource = null;
/** @type {AudioBufferSourceNode} */
let sfxSource   = null;

/* -----------------------------------
 * Loading Audio:
 * ----------------------------------- */
const loadAudio = (key, path) => fetch(path)
  .then(response => response.arrayBuffer())
  .then(buffer => audioContext.decodeAudioData(buffer))
  .then(audio => {
    audioMap.set(key, audio);
    return audio;
  });

const getBuffer = key => {
  if (!audioMap.has(key)) {
    throw new Mewlix.MewlixError(Mewlix.ErrorCode.Graphic,
      `No existing audio track is associated with the key ${key}!`);
  }
  return audioMap.get(key);
};

/* -----------------------------------
 * Playing Audio:
 * ----------------------------------- */
const playMusic = key => {
  musicSource?.stop();
  const buffer = getBuffer(key);

  musicSource = audioContext.createBufferSource();
  musicSource.buffer = buffer; 
  musicSource.loop = true;
  musicSource.connect(musicVolume);
  musicSource.start();
};

const playSfx = key => {
  sfxSource?.stop();
  const buffer = getBuffer(key);

  sfxSource = audioContext.createBufferSource();
  sfxSource.buffer = buffer; 
  sfxSource.connect(sfxVolume);
  sfxSource.start();
};

const stopMusic = () => {
  musicSource?.stop();
  musicSource = null;
};

const setVolumeOf = (node, volume) => {
  node.gain.cancelScheduledValues(audioContext.currentTime);
  node.gain.setValueAtTime(node.gain.value, audioContext.currentTime);
  node.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.5);
};

/* -----------------------------------
 * Initialization:
 * ----------------------------------- */
let initialized = false;

const init = async (callback) => {
  /* await loadFont(
    'Fira Mono',
    `url(https://fonts.googleapis.com/css2?family=Fira+Mono:wght@400;500;700&display=swap)`
  ); */
  initialized = true;

  const nextFrame = () => new Promise(resolve => {
    window.requestAnimationFrame(resolve);
  });

  const run = async () => {
    let lastFrame = null; // Last frame's timestamp, in milliseconds.
    let deltaTime = 0;    // Delta time, in seconds!

    while (true) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      await callback(deltaTime);
      const now = await nextFrame();
      lastFrame ??= now;

      deltaTime = (now - lastFrame) / 1000;
      lastFrame = now;
    }
  };

  await run();
};

let x = 0;
let elapsed = 0;
let musicTimer = 0;
let playingAura = false;
let playingFlower = false;
let loweredVolume = false;

const example = async delta => {
  drawSprite('cat', x, 20);
  drawText('hahahaha', 0, 0, 8);

  elapsed += delta;
  musicTimer += delta;

  x += 30 * delta;

  if (elapsed > 1) {
    elapsed = 0;

    if (!playingFlower) {
      playMusic('flower');
      playingFlower = true;
    }
  }

  if (musicTimer > 3 && !playingAura) {
    playingAura = true;
    playMusic('aura');
  }

  if (musicTimer > 6 && !loweredVolume) {
    loweredVolume = true;
    setVolumeOf(musicVolume, 0);
  }
};

loadSprite('cat', '/assets/cat.png')
  .then(_ => {
    setVolumeOf(masterVolume, 1);
    return loadAudio('flower', '/assets/flower.mp3');
  })
  .then(_ => loadAudio('aura', '/assets/aura.mp3'))
  .then(_ => init(example));

canvas.addEventListener('click', () => {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
});

/* -----------------------------------
 * Standard library:
 * ----------------------------------- */
