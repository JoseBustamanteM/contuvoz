import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = 'http://localhost:3000/api';

  getUsuarios() {
    return this.http.get<any[]>(`${this.base}/usuarios`);
  }
}