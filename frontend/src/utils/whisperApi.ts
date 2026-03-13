/**
 * Whisper API utility for secure speech-to-text transcription
 * Uses server-side OpenAI API to keep API keys secure
 */

export interface TranscriptionResult {
  transcription: string;
  confidence: number;
  model: string;
  language: string;
  logprobs?: any[];
  segments?: any[];
  processing?: {
    audioSizeBytes: number;
    audioFormat: string;
    chunkingStrategy?: string;
    processingTime: string;
  };
}

export interface TranscriptionError {
  error: string;
  message?: string;
  fallback?: string;
  retryWithWhisper1?: boolean;
  type?: string;
}

/**
 * Convert audio blob to base64 for server transmission
 */
function audioToBase64(audioBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data:audio/webm;base64, prefix
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });
}

/**
 * Transcribe audio using OpenAI transcription API with GPT-4o models
 * Falls back to browser speech recognition if API unavailable
 */
export async function transcribeWithWhisper(
  audioBlob: Blob,
  options: {
    language?: string;
    model?: 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'whisper-1' | 'auto';
    includeLogProbs?: boolean;
    chunkingStrategy?: 'auto' | object;
    temperature?: number;
    responseFormat?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
    prompt?: string;
    onFallback?: () => void;
    maxRetries?: number;
  } = {}
): Promise<TranscriptionResult> {
  const maxRetries = options.maxRetries || 3;
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log('🎤 Starting transcription...', {
        attempt: `${attempt}/${maxRetries}`,
        size: audioBlob.size,
        type: audioBlob.type,
        model: options.model || 'auto',
        includeLogProbs: options.includeLogProbs
      });
      
      // Check file size on client side too
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (audioBlob.size > maxSize) {
        throw new Error('Audio file too large. Please record shorter segments.');
      }
      
      // Convert audio to base64
      const audioData = await audioToBase64(audioBlob);
      
      // Detect audio format more accurately
      let audioFormat = 'webm'; // default
      if (audioBlob.type.includes('wav')) {
        audioFormat = 'wav';
      } else if (audioBlob.type.includes('mp4') || audioBlob.type.includes('m4a')) {
        audioFormat = 'mp4';
      } else if (audioBlob.type.includes('mpeg') || audioBlob.type.includes('mp3')) {
        audioFormat = 'mp3';
      } else if (audioBlob.type.includes('webm')) {
        audioFormat = 'webm';
      }
      
      console.log('🎤 Audio format detected:', audioFormat);
      
      // Build request payload with new options
      const requestPayload: any = {
        audioData,
        audioFormat,
        language: options.language || 'auto'
      };
      
      // Add model selection
      if (options.model && options.model !== 'auto') {
        requestPayload.model = options.model;
      }
      
      // Add advanced options for GPT-4o models
      if (options.includeLogProbs) {
        requestPayload.includeLogProbs = true;
      }
      
      if (options.chunkingStrategy) {
        requestPayload.chunkingStrategy = options.chunkingStrategy;
      }
      
      if (options.temperature !== undefined) {
        requestPayload.temperature = options.temperature;
      }
      
      if (options.responseFormat) {
        requestPayload.responseFormat = options.responseFormat;
      }
      
      if (options.prompt) {
        requestPayload.prompt = options.prompt;
      }
      
      // Send to server for secure API processing
      const response = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        const error = new Error(data.error || 'Transcription failed') as any;
        error.details = data;
        error.statusCode = response.status;
        throw error;
      }
      
      console.log('✅ Transcription successful with', data.model);
      return data;
      
    } catch (error: any) {
      lastError = error;
      console.warn(`❌ Transcription attempt ${attempt} failed:`, error.message);
      
      // Check if we should retry with whisper-1 on next attempt
      if (error.details?.retryWithWhisper1 && attempt < maxRetries && options.model !== 'whisper-1') {
        console.log('🔄 Retrying with whisper-1 model...');
        options.model = 'whisper-1';
        options.includeLogProbs = false; // Not supported by whisper-1
        continue;
      }
      
      // Don't retry on client errors (400s) except rate limits
      if (error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10s delay
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed
  console.error('❌ All transcription attempts failed:', lastError);
  
  // Call fallback handler if provided
  if (options.onFallback) {
    options.onFallback();
  }
  
  throw lastError;
}

/**
 * Enhanced audio recorder with Whisper integration
 */
export class WhisperRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private isRecording = false;
  private audioFormat = 'webm';
  
  async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // Optimal for Whisper
        } 
      });
      
      this.audioChunks = [];
      
      // Try different MIME types in order of Whisper compatibility
      let mimeType = 'audio/webm;codecs=opus'; // fallback
      let format = 'webm';
      
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
        format = 'wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
        format = 'mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
        format = 'webm';
      }
      
      // Store format for later use
      this.audioFormat = format;
      
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: 128000 // Good quality for Whisper
      });
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.start(1000); // Collect data every second
      this.isRecording = true;
      
      console.log('🎤 Recording started');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      throw new Error('Microphone access denied or not available');
    }
  }
  
  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        reject(new Error('Not currently recording'));
        return;
      }
      
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanup();
        console.log('🎤 Recording stopped, blob size:', audioBlob.size);
        resolve(audioBlob);
      };
      
      this.mediaRecorder.stop();
      this.isRecording = false;
    });
  }
  
  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
  
  isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
  
  getAudioFormat(): string {
    return this.audioFormat;
  }
}