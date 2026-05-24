// src/app/interfaces/speech.interfaces.ts

export interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

export interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}

export interface ISpeechRecognitionResultList {
  length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

export interface ISpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}

export interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

// Esta es la clase principal que instanciaremos
export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onend: (event: Event) => void;
  onresult: (event: ISpeechRecognitionEvent) => void;
  onerror: (event: ISpeechRecognitionErrorEvent) => void;
}




export interface Model {
  KaldiRecognizer: new (sampleRate: number, grammar?: string) => Recognizer;
  // Add more if needed
}

export interface Recognizer {
  acceptWaveform(buffer: AudioBuffer): void;
  on(event: 'partialresult' | 'result', callback: (message: RecognizerMessage) => void): void;
  free?(): void;
  remove?(): void;
  // Add more if needed
}

export interface WordResult {
  conf: number;
  start: number;
  end: number;
  word: string;
}

export interface RecognizerResult {
  partial?: string; // For partialresult
  result?: WordResult[]; // For result event, array of words with conf
  text?: string; // For result event
}

export interface RecognizerMessage {
  result?: RecognizerResult;
}
