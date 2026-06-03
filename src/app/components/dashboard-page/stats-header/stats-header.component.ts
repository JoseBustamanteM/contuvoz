import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StatCard {
  icon: string;
  label: string;
  value: string;
  sublabel: string;
  color: string;
}

@Component({
  selector: 'app-stats-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stats-header.component.html',
  styleUrls: ['./stats-header.component.scss'],
})
export class StatsHeaderComponent {
  @Input() stats: StatCard[] = [
    { icon: '🎨', label: 'Pinta Letras',    value: '87%', sublabel: 'aprobación',  color: '#4CAF50' },
    { icon: '🤟', label: 'Lengua de Señas', value: '74%', sublabel: 'aprobación',  color: '#26A69A' },
    { icon: '🎤', label: 'Vocales',         value: '91%', sublabel: 'aprobación',  color: '#66BB6A' },
    { icon: '⭐', label: 'Racha actual',    value: '5',   sublabel: 'días seguidos', color: '#FFA726' },
  ];
}
