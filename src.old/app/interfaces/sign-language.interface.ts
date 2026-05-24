export interface Landmark {
  x: number; y: number; z: number;
}

export interface SignResult {
  letter: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface AlphabetLevel {
  letter: string;
  image: string;
  hint: string;
}

export interface VowelLevel {
  letter: string;
  image: string;
  description: string;
}
