import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Achievement {
  icon: string;
  title: string;
  desc: string;
  unlocked: boolean;
}

@Component({
  selector: 'app-achievement-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achievement-card.component.html',
  styleUrls: ['./achievement-card.component.scss'],
})
export class AchievementCardComponent {
  @Input() achievements: Achievement[] = [
    { icon: '🥇', title: '¡Primera vocal!',       desc: 'Completaste tu primera sesión de Vocales',       unlocked: true  },
    { icon: '🎨', title: 'Artista de letras',      desc: 'Terminaste 10 actividades de Pinta Letras',      unlocked: true  },
    { icon: '🤟', title: 'Manos que hablan',       desc: 'Aprendiste 5 señas nuevas',                      unlocked: true  },
    { icon: '🔥', title: 'Racha de 5 días',        desc: 'Estudiaste 5 días seguidos sin parar',           unlocked: false },
    { icon: '🌟', title: 'Súper estudiante',       desc: 'Completa todas las actividades en una semana',   unlocked: false },
    { icon: '🏆', title: '¡Campeón del lenguaje!', desc: 'Alcanza 90% en las 3 actividades principales',  unlocked: false },
  ];
}
