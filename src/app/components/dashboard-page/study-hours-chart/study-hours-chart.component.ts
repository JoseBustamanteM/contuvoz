import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

declare var Chart: any;

@Component({
  selector: 'app-study-hours-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './study-hours-chart.component.html',
  styleUrls: ['./study-hours-chart.component.scss'],
})
export class StudyHoursChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: any;

  readonly days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  readonly hoursData = [0.5, 1.2, 0.8, 1.5, 1.0, 0.3, 0.7];

  get totalHours(): string {
    return this.hoursData.reduce((a, b) => a + b, 0).toFixed(1);
  }

  get bestDay(): string {
    const max = Math.max(...this.hoursData);
    return this.days[this.hoursData.indexOf(max)];
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
      type: 'line',
      data: {
        labels: this.days,
        datasets: [
          {
            label: 'Horas estudiadas',
            data: this.hoursData,
            borderColor: '#43A047',
            backgroundColor: 'rgba(67,160,71,0.12)',
            borderWidth: 3,
            pointBackgroundColor: '#fff',
            pointBorderColor: '#43A047',
            pointBorderWidth: 3,
            pointRadius: 6,
            pointHoverRadius: 9,
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => ` ${ctx.raw}h estudiadas`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 12, weight: '700' },
              color: '#555',
            },
          },
          y: {
            min: 0,
            max: 2,
            grid: { color: 'rgba(0,0,0,0.06)' },
            border: { display: false },
            ticks: {
              stepSize: 0.5,
              callback: (v: number) => v + 'h',
              font: { size: 11, weight: '700' },
              color: '#888',
            },
          },
        },
      },
    });
  }
}
