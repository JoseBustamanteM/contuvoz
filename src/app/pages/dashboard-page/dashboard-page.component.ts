import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsHeaderComponent }     from '../../components/dashboard-page/stats-header/stats-header.component';
import { ProgressChartComponent }   from '../../components/dashboard-page/progress-chart/progress-chart.component';
import { StudyHoursChartComponent } from '../../components/dashboard-page/study-hours-chart/study-hours-chart.component';
import { ActivityDonutComponent }   from '../../components/dashboard-page/activity-donut/activity-donut.component';
import { AchievementCardComponent } from '../../components/dashboard-page/achievement-card/achievement-card.component';

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
