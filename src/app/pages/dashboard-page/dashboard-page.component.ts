import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsHeaderComponent }     from '../../components/stats-header/stats-header.component';
import { ProgressChartComponent }   from '../../components/progress-chart/progress-chart.component';
import { StudyHoursChartComponent } from '../../components/study-hours-chart/study-hours-chart.component';
import { ActivityDonutComponent }   from '../../components/activity-donut/activity-donut.component';
import { AchievementCardComponent } from '../../components/achievement-card/achievement-card.component';
import { UnlockedPipe }             from '../../pipes/unlocked.pipe';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    StatsHeaderComponent,
    ProgressChartComponent,
    StudyHoursChartComponent,
    ActivityDonutComponent,
    AchievementCardComponent,
    UnlockedPipe,
  ],
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss'],
})
export class DashboardPageComponent {
  readonly studentName = 'Sofía';
  readonly avatarEmoji = '🦎';
  readonly level = 5;
  readonly xp    = 320;
  readonly xpNext = 500;

  get xpPct(): number {
    return Math.round((this.xp / this.xpNext) * 100);
  }
}
