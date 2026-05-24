// talk.component.ts (minor corrections: added OnInit for readiness check if needed, but mostly fine)
// Changes:
// - Added lifecycle hooks if needed.
// - Ensured async handling.

import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WhisperService } from '../../services/whisper.service';

@Component({
  selector: 'talk-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './talk.component.html',
  styleUrls: ['./talk.component.scss']
})
export class TalkComponent implements OnInit {
  public voskSvc = inject(WhisperService);

  ngOnInit() {
    // Optional: trigger init if needed, but constructor handles it
  }

  public async handleMicClick() {
    if (this.voskSvc.isListening()) {
      this.voskSvc.stopCapture();
    } else {
      await this.voskSvc.startCapture();
    }
  }
}
