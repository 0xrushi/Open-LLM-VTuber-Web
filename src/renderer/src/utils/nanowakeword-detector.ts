import * as ort from 'onnxruntime-web';

const SAMPLE_RATE = 16000;
const STREAM_CHUNK_SIZE = 1280;
const MEL_WINDOW_FRAMES = 76;
const MEL_STEP_FRAMES = 8;
const MODEL_FEATURE_FRAMES = 16;
const MODEL_FEATURE_DIM = 96;
const MEL_BINS = 32;
const MEL_BUFFER_MAX_FRAMES = 10 * 97;
const FEATURE_BUFFER_MAX_FRAMES = 120;
const RAW_BUFFER_MAX_SAMPLES = SAMPLE_RATE * 10;
const INITIAL_SCORE_SUPPRESSION_FRAMES = 5;

export interface NanoWakeWordDetectorOptions {
  onDetected: (score: number) => void | Promise<void>;
  onScore?: (score: number) => void;
  threshold?: number;
  cooldownMs?: number;
}

function appendFloat32(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function appendInt16(a: Int16Array, b: Int16Array, maxLength?: number): Int16Array {
  const keepALength = maxLength === undefined
    ? a.length
    : Math.max(0, Math.min(a.length, maxLength - b.length));
  const start = a.length - keepALength;
  const out = new Int16Array(keepALength + b.length);
  out.set(a.subarray(start));
  out.set(b, keepALength);
  return maxLength !== undefined && out.length > maxLength
    ? out.subarray(out.length - maxLength)
    : out;
}

function appendFeatureRows(rows: Float32Array, newRows: Float32Array, maxRows: number): Float32Array {
  const all = new Float32Array(rows.length + newRows.length);
  all.set(rows);
  all.set(newRows, rows.length);
  const maxValues = maxRows * MODEL_FEATURE_DIM;
  return all.length > maxValues ? all.slice(all.length - maxValues) : all;
}

function appendMelRows(rows: Float32Array, newRows: Float32Array, maxRows: number): Float32Array {
  const all = new Float32Array(rows.length + newRows.length);
  all.set(rows);
  all.set(newRows, rows.length);
  const maxValues = maxRows * MEL_BINS;
  return all.length > maxValues ? all.slice(all.length - maxValues) : all;
}

function squeezeToMelRows(tensor: ort.Tensor): Float32Array {
  const data = tensor.data as Float32Array;
  const rows = Math.floor(data.length / MEL_BINS);
  const out = new Float32Array(rows * MEL_BINS);
  out.set(data.subarray(0, rows * MEL_BINS));

  // Match NanoWakeWord's Python transform: melspec / 10 + 2.
  for (let i = 0; i < out.length; i += 1) {
    out[i] = out[i] / 10 + 2;
  }

  return out;
}

function squeezeEmbedding(tensor: ort.Tensor): Float32Array {
  const data = tensor.data as Float32Array;
  if (data.length < MODEL_FEATURE_DIM) {
    throw new Error(`Embedding model returned ${data.length} values, expected ${MODEL_FEATURE_DIM}`);
  }
  return data.slice(0, MODEL_FEATURE_DIM);
}

function resampleLinear(input: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return input;

  const ratio = sourceRate / targetRate;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const nextIndex = Math.min(index + 1, input.length - 1);
    output[i] = input[index] + (input[nextIndex] - input[index]) * fraction;
  }

  return output;
}

function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, input[i]));
    out[i] = sample < 0 ? sample * 32768 : sample * 32767;
  }
  return out;
}

export class NanoWakeWordDetector {
  private readonly threshold: number;

  private readonly cooldownMs: number;

  private readonly onDetected: (score: number) => void | Promise<void>;

  private readonly onScore?: (score: number) => void;

  private melSession: ort.InferenceSession | null = null;

  private embeddingSession: ort.InferenceSession | null = null;

  private wakeSession: ort.InferenceSession | null = null;

  private audioContext: AudioContext | null = null;

  private stream: MediaStream | null = null;

  private source: MediaStreamAudioSourceNode | null = null;

  private processor: ScriptProcessorNode | null = null;

  private pendingSamples = new Float32Array(0);

  private rawBuffer = new Int16Array(0);

  private melBuffer = new Float32Array(MEL_WINDOW_FRAMES * MEL_BINS).fill(1);

  private featureBuffer = new Float32Array(0);

  private predictionWarmupFrames = 0;

  private processing = false;

  private running = false;

  private lastDetection = 0;

  constructor(options: NanoWakeWordDetectorOptions) {
    this.threshold = options.threshold ?? 0.95;
    this.cooldownMs = options.cooldownMs ?? 2500;
    this.onDetected = options.onDetected;
    this.onScore = options.onScore;
  }

  async start(): Promise<void> {
    if (this.running) return;
    await this.loadModels();

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextCtor();
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (event) => {
      const input = event.inputBuffer.getChannelData(0);
      const resampled = resampleLinear(input, this.audioContext?.sampleRate ?? SAMPLE_RATE, SAMPLE_RATE);
      this.pendingSamples = appendFloat32(this.pendingSamples, resampled);
      void this.drainPendingSamples();
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
    this.running = true;
    console.info('[WakeWord] Listening for “hey nami”');
  }

  stop(): void {
    this.running = false;
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.pendingSamples = new Float32Array(0);
  }

  reset(): void {
    this.rawBuffer = new Int16Array(0);
    this.melBuffer = new Float32Array(MEL_WINDOW_FRAMES * MEL_BINS).fill(1);
    this.featureBuffer = new Float32Array(0);
    this.predictionWarmupFrames = 0;
  }

  private async loadModels(): Promise<void> {
    if (this.melSession && this.embeddingSession && this.wakeSession) return;

    ort.env.wasm.wasmPaths = '/libs/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;

    const sessionOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: ['wasm'],
    };

    const [melSession, embeddingSession, wakeSession] = await Promise.all([
      ort.InferenceSession.create('/models/wakewords/nanowakeword/melspectrogram.onnx', sessionOptions),
      ort.InferenceSession.create('/models/wakewords/nanowakeword/embedding_model.onnx', sessionOptions),
      ort.InferenceSession.create('/models/wakewords/hey_nami/hey_nami_cnn_v1.onnx?v=ir8', sessionOptions),
    ]);

    this.melSession = melSession;
    this.embeddingSession = embeddingSession;
    this.wakeSession = wakeSession;
  }

  private async drainPendingSamples(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    try {
      while (this.running && this.pendingSamples.length >= STREAM_CHUNK_SIZE) {
        const chunk = this.pendingSamples.slice(0, STREAM_CHUNK_SIZE);
        this.pendingSamples = this.pendingSamples.slice(STREAM_CHUNK_SIZE);
        await this.processChunk(floatToInt16(chunk));
      }
    } catch (error) {
      console.error('[WakeWord] Failed while processing microphone audio:', error);
    } finally {
      this.processing = false;
    }
  }

  private async processChunk(chunk: Int16Array): Promise<void> {
    if (!this.melSession || !this.embeddingSession || !this.wakeSession) return;

    this.rawBuffer = appendInt16(this.rawBuffer, chunk, RAW_BUFFER_MAX_SAMPLES);
    const melInputSamples = this.rawBuffer.slice(Math.max(0, this.rawBuffer.length - STREAM_CHUNK_SIZE - 160 * 3));
    if (melInputSamples.length < 400) return;

    const melInput = new Float32Array(melInputSamples.length);
    for (let i = 0; i < melInputSamples.length; i += 1) melInput[i] = melInputSamples[i];

    const melOutput = await this.melSession.run({
      input: new ort.Tensor('float32', melInput, [1, melInput.length]),
    });
    const melTensor = melOutput.output ?? Object.values(melOutput)[0];
    const newMelRows = squeezeToMelRows(melTensor);
    this.melBuffer = appendMelRows(this.melBuffer, newMelRows, MEL_BUFFER_MAX_FRAMES);

    const startValue = this.melBuffer.length - MEL_WINDOW_FRAMES * MEL_BINS;
    if (startValue < 0) return;

    const embeddingInput = this.melBuffer.slice(startValue);
    const embeddingOutput = await this.embeddingSession.run({
      input_1: new ort.Tensor('float32', embeddingInput, [1, MEL_WINDOW_FRAMES, MEL_BINS, 1]),
    });
    const embeddingTensor = embeddingOutput.conv2d_19 ?? Object.values(embeddingOutput)[0];
    this.featureBuffer = appendFeatureRows(
      this.featureBuffer,
      squeezeEmbedding(embeddingTensor),
      FEATURE_BUFFER_MAX_FRAMES,
    );

    if (this.featureBuffer.length < MODEL_FEATURE_FRAMES * MODEL_FEATURE_DIM) return;

    const featureInput = this.featureBuffer.slice(this.featureBuffer.length - MODEL_FEATURE_FRAMES * MODEL_FEATURE_DIM);
    const wakeOutput = await this.wakeSession.run({
      input: new ort.Tensor('float32', featureInput, [1, MODEL_FEATURE_FRAMES, MODEL_FEATURE_DIM]),
    });
    const wakeTensor = wakeOutput.output ?? Object.values(wakeOutput)[0];
    const rawScore = (wakeTensor.data as Float32Array)[0] ?? 0;
    const score = this.predictionWarmupFrames < INITIAL_SCORE_SUPPRESSION_FRAMES ? 0 : rawScore;
    this.predictionWarmupFrames += 1;
    this.onScore?.(score);

    const now = performance.now();
    if (score >= this.threshold && now - this.lastDetection > this.cooldownMs) {
      this.lastDetection = now;
      console.info(`[WakeWord] Detected “hey nami” (${score.toFixed(4)})`);
      this.reset();
      await this.onDetected(score);
    }
  }
}
