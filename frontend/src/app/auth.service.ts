import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';

interface RespostaAuth {
  token: string;
  nome: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private url = 'http://localhost:3000/api/auth';

  login(email: string, senha: string) {
    return this.http
      .post<RespostaAuth>(`${this.url}/login`, { email, senha })
      .pipe(tap(r => this.guardar(r)));
  }

  registrar(nome: string, email: string, senha: string) {
    return this.http
      .post<RespostaAuth>(`${this.url}/registrar`, { nome, email, senha })
      .pipe(tap(r => this.guardar(r)));
  }

  sair() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('nome');
    } catch {}
  }

  get token(): string | null {
    try { return localStorage.getItem('token'); } catch { return null; }
  }

  get nome(): string {
    try { return localStorage.getItem('nome') || ''; } catch { return ''; }
  }

  get logado(): boolean {
    return !!this.token;
  }

  private guardar(r: RespostaAuth) {
    try {
      localStorage.setItem('token', r.token);
      localStorage.setItem('nome', r.nome);
    } catch {}
  }
}
