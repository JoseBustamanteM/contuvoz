import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class WhisperService {

  public isReady = signal(true);
  public isListening = signal(false);
  public transcript = signal('');
  public error = signal<string | null>(null);

  private mediaStream?: MediaStream;
  private recorder?: MediaRecorder;
  private audioChunks: Blob[] = [];

  constructor() {}

  public async startCapture() {
    if (this.isListening()) return;

    try {
      this.isListening.set(true);
      this.transcript.set('Escuchando...');
      this.error.set(null);
      this.audioChunks = [];

      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Formato soportado por todos los navegadores
      this.recorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      this.recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.recorder.onstop = () => this.sendToWhisper();

      this.recorder.start();

      // Graba durante 3 segundos
      setTimeout(() => {
        if (this.recorder?.state === 'recording') {
          this.recorder.stop();
        }
      }, 3000);

    } catch (err: any) {
      console.error(err);
      this.error.set('No se pudo acceder al micrófono');
      this.stopCapture();
    }
  }

  private async sendToWhisper() {
    if (this.audioChunks.length === 0) {
      this.transcript.set('No se escuchó nada');
      this.stopCapture();
      return;
    }

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.webm');

    try {
      const response = await fetch('http://localhost:2700/asr', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      const text = (result.text || '').trim().toLowerCase();

      console.log('Whisper devolvió:', text);
      this.processVowel(text);

    } catch (err) {
      console.error('Error al enviar a Whisper:', err);
      this.error.set('Error al procesar el audio');
    } finally {
      this.stopCapture();
    }
  }

  private processVowel(text: string) {
    // Limpiamos todo excepto vocales
    const clean = text.replace(/[^aeiouáéíóú]/g, '');

    if (!clean) {
      this.transcript.set('No claro');
      return;
    }

    // Tomamos la primera vocal que aparezca
    const match = clean.match(/[aeiouáéíóú]/i);
    if (match) {
      this.transcript.set(match[0].toUpperCase());
    } else {
      this.transcript.set(clean[0].toUpperCase());
    }
  }

  public stopCapture() {
    this.isListening.set(false);

    if (this.recorder && this.recorder.state === 'recording') {
      this.recorder.stop();
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = undefined;
    }
  }
}
