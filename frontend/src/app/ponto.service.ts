import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface Registro {
  id?: number;
  funcionario?: string;
  data: string;        // AAAA-MM-DD
  entrada: string;     // HH:MM
  saida: string;       // HH:MM
  intervalo: number;   // minutos
  minutosTrabalhados?: number;
}

@Injectable({ providedIn: 'root' })
export class PontoService {
  private http = inject(HttpClient);
  private url = 'http://localhost:3000/api/registros';

  listar()               { return this.http.get<Registro[]>(this.url); }
  criar(r: Registro)     { return this.http.post<Registro>(this.url, r); }
  atualizar(r: Registro) { return this.http.put<Registro>(`${this.url}/${r.id}`, r); }
  excluir(id: number)    { return this.http.delete(`${this.url}/${id}`); }
}
