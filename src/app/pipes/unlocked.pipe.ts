import { Pipe, PipeTransform } from '@angular/core';
import { Achievement } from '../components/dashboard-page/achievement-card/achievement-card.component';

@Pipe({ name: 'unlocked', standalone: true })
export class UnlockedPipe implements PipeTransform {
  transform(achievements: Achievement[]): number {
    return achievements.filter(a => a.unlocked).length;
  }
}
