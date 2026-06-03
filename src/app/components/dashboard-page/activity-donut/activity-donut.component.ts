import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

declare var Chart: any;

export interface ActivityStat {
  label: string;
  icon: string;
  sessions: number;
  color: string;
}

@Component({
  selector: 'app-activity-donut',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-donut.component.html',
  styleUrls: ['./activity-donut.component.scss'],
})
export class ActivityDonutComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: any;

  readonly activities: ActivityStat[] = [
    { label: 'Pinta Letras',    icon: '🎨', sessions: 34, color: '#43A047' },
    { label: 'Comunícate',      icon: '🤟', sessions: 21, color: '#00897B' },
    { label: 'Hablemos',        icon: '🎤', sessions: 28, color: '#66BB6A' },
    { label: 'Biblioteca',      icon: '📚', sessions: 15, color: '#26C6DA' },
  ];

  get totalSessions(): number {
    return this.activities.reduce((a, b) => a + b.sessions, 0);
  }

  getPct(sessions: number): number {
    return Math.round((sessions / this.totalSessions) * 100);
  }

  get favoriteActivity(): ActivityStat {
    return this.activities.reduce((a, b) => a.sessions > b.sessions ? a : b);
  }

  ngAfterViewInit(): void {
    this.buildChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private buildChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.activities.map(a => a.label),
        datasets: [
          {
            data: this.activities.map(a => a.sessions),
            backgroundColor: this.activities.map(a => a.color),
            borderWidth: 3,
            borderColor: '#fff',
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                ` ${ctx.label}: ${ctx.raw} sesiones (${this.getPct(ctx.raw)}%)`,
            },
          },
        },
      },
    });
  }
}
