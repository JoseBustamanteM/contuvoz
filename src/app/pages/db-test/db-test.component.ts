import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-db-test',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="padding:2rem; font-family:sans-serif;">
      <h1>🗄️ Prueba de base de datos</h1>

      @if (cargando()) {
        <p>Cargando... ⏳</p>
      } @else if (error()) {
        <p style="color:red;">❌ {{ error() }}</p>
      } @else {
        <p>Se encontraron <b>{{ usuarios().length }}</b> usuarios:</p>
        <ul>
          @for (u of usuarios(); track u.id_usuario) {
            <li>{{ u.nom_usuario }} {{ u.a_paterno }} — {{ u.email }}</li>
          }
        </ul>
      }
    </div>
  `,
})
export class DbTestComponent implements OnInit {
  private api = inject(ApiService);

  usuarios = signal<any[]>([]);
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    this.api.getUsuarios().subscribe({
      next: (data) => {
        this.usuarios.set(data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error(err);
        this.error.set('No se pudo conectar con el servidor (¿está corriendo el mesero?)');
        this.cargando.set(false);
      },
    });
  }
}