import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

declare var Chart: any;

@Component({
  selector: 'app-progress-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-chart.component.html',
  styleUrls: ['./progress-chart.component.scss'],
})
export class ProgressChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: any;

  readonly activities = [
    { label: 'Pinta Letras',    completed: 22, total: 25, pct: 88, color: '#43A047' },
    { label: 'Lengua de Señas', completed: 17, total: 23, pct: 74, color: '#00897B' },
    { label: 'Vocales',         completed: 19, total: 21, pct: 90, color: '#66BB6A' },
  ];

  ngAfterViewInit(): void {
    this.buildChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private buildChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d')!;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.activities.map(a => a.label),
        datasets: [
          {
            label: 'Completadas',
            data: this.activities.map(a => a.pct),
            backgroundColor: this.activities.map(a => a.color),
            borderRadius: 12,
            borderSkipped: false,
            barThickness: 38,
          },
          {
            label: 'Restante',
            data: this.activities.map(a => 100 - a.pct),
            backgroundColor: 'rgba(0,0,0,0.06)',
            borderRadius: 12,
            borderSkipped: false,
            barThickness: 38,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) =>
                ctx.datasetIndex === 0
                  ? ` ${ctx.raw}% aprobación`
                  : '',
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            max: 100,
            grid: { display: false },
            ticks: {
              callback: (v: number) => v + '%',
              font: { size: 11, weight: '700' },
              color: '#555',
            },
            border: { display: false },
          },
          y: {
            stacked: true,
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 13, weight: '700' },
              color: '#2e7d32',
            },
          },
        },
      },
    });
  }
}
