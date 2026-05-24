import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TalkComponent } from "../../components/talkPage/talk.component";





@Component({
  selector: 'talk-page',
  imports: [TalkComponent],
  templateUrl: './talkPage.component.html',
  styleUrl: './talkPage.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TalkPageComponent { }
