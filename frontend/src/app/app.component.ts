import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Registro, PontoService } from './ponto.service';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container py-4">

      @if (!auth.logado) {
        <!-- ========== LOGIN / CADASTRO ========== -->
        <div class="row justify-content-center">
          <div class="col-md-5">
            <h1 class="mb-4 text-center">Controle de Horário</h1>
            <div class="card">
              <div class="card-body">
                <h5 class="mb-3">{{ modo === 'login' ? 'Entrar' : 'Criar conta' }}</h5>

                @if (modo === 'registrar') {
                  <div class="mb-2">
                    <label class="form-label small">Nome</label>
                    <input class="form-control" [(ngModel)]="nome">
                  </div>
                }
                <div class="mb-2">
                  <label class="form-label small">E-mail</label>
                  <input type="email" class="form-control" [(ngModel)]="email">
                </div>
                <div class="mb-3">
                  <label class="form-label small">Senha</label>
                  <input type="password" class="form-control" [(ngModel)]="senha"
                         (keyup.enter)="enviarAuth()">
                </div>

                @if (erroAuth) {
                  <div class="alert alert-danger py-2">{{ erroAuth }}</div>
                }

                <div class="d-grid">
                  <button class="btn btn-primary" (click)="enviarAuth()">
                    {{ modo === 'login' ? 'Entrar' : 'Cadastrar' }}
                  </button>
                </div>
                <button class="btn btn-link px-0 mt-2" (click)="alternarModo()">
                  {{ modo === 'login' ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Entrar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      } @else {
        <!-- ========== CONTROLE DE PONTO ========== -->
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h1 class="mb-0">Controle de Horário de Trabalho</h1>
          <div class="text-end">
            <div class="small text-muted">Olá, {{ auth.nome }}</div>
            <button class="btn btn-sm btn-outline-secondary" (click)="sair()">Sair</button>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-body">
            <h5>{{ registro.id ? 'Editar registro' : 'Novo registro' }}</h5>
            <div class="row g-2">
              <div class="col-md-3">
                <label class="form-label small">Data</label>
                <input type="date" class="form-control" [(ngModel)]="registro.data">
              </div>
              <div class="col-md-2">
                <label class="form-label small">Entrada</label>
                <input type="time" class="form-control" [(ngModel)]="registro.entrada">
              </div>
              <div class="col-md-2">
                <label class="form-label small">Saída</label>
                <input type="time" class="form-control" [(ngModel)]="registro.saida">
              </div>
              <div class="col-md-3">
                <label class="form-label small">Intervalo (min)</label>
                <input type="number" min="0" class="form-control" [(ngModel)]="registro.intervalo">
              </div>
              <div class="col-md-2 d-grid align-items-end">
                <button class="btn btn-primary" (click)="salvar()">Salvar</button>
              </div>
            </div>
            @if (registro.id) {
              <button class="btn btn-link px-0 mt-2" (click)="limpar()">Cancelar edição</button>
            }
          </div>
        </div>

        <table class="table table-striped align-middle">
          <thead>
            <tr>
              <th>Data</th><th>Entrada</th><th>Saída</th>
              <th>Intervalo</th><th>Horas</th><th class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            @for (r of registros; track r.id) {
              <tr>
                <td>{{ formatarData(r.data) }}</td>
                <td>{{ r.entrada }}</td>
                <td>{{ r.saida }}</td>
                <td>{{ r.intervalo }} min</td>
                <td><strong>{{ formatarHoras(r.minutosTrabalhados!) }}</strong></td>
                <td class="text-end">
                  <button class="btn btn-sm btn-outline-secondary me-2" (click)="editar(r)">Editar</button>
                  <button class="btn btn-sm btn-outline-danger" (click)="excluir(r.id!)">Excluir</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="text-center text-muted">Nenhum registro cadastrado.</td></tr>
            }
          </tbody>
          @if (registros.length) {
            <tfoot>
              <tr>
                <th colspan="4" class="text-end">Total</th>
                <th colspan="2">{{ formatarHoras(totalMinutos()) }}</th>
              </tr>
            </tfoot>
          }
        </table>
      }
    </div>
  `
})
export class AppComponent implements OnInit {
  private service = inject(PontoService);
  auth = inject(AuthService);

  // login / cadastro
  modo: 'login' | 'registrar' = 'login';
  nome = '';
  email = '';
  senha = '';
  erroAuth = '';

  // ponto
  registros: Registro[] = [];
  registro: Registro = this.vazio();

  ngOnInit() {
    if (this.auth.logado) this.carregar();
  }

  // ---------- autenticação ----------

  alternarModo() {
    this.modo = this.modo === 'login' ? 'registrar' : 'login';
    this.erroAuth = '';
  }

  enviarAuth() {
    const req = this.modo === 'login'
      ? this.auth.login(this.email, this.senha)
      : this.auth.registrar(this.nome, this.email, this.senha);

    req.subscribe({
      next: () => {
        this.nome = this.email = this.senha = this.erroAuth = '';
        this.limpar();
        this.carregar();
      },
      error: e => (this.erroAuth = e.error?.erro || 'Não foi possível conectar ao servidor')
    });
  }

  sair() {
    this.auth.sair();
    this.registros = [];
    this.limpar();
  }

  // ---------- ponto ----------

  vazio(): Registro {
    return {
      data: new Date().toISOString().slice(0, 10),
      entrada: '08:00',
      saida: '17:00',
      intervalo: 60
    };
  }

  carregar() {
    this.service.listar().subscribe({
      next: d => (this.registros = d),
      error: e => { if (e.status === 401) this.sair(); }
    });
  }

  salvar() {
    const req = this.registro.id
      ? this.service.atualizar(this.registro)
      : this.service.criar(this.registro);
    req.subscribe({
      next: () => { this.limpar(); this.carregar(); },
      error: e => {
        if (e.status === 401) this.sair();
        else alert(e.error?.erro || 'Erro ao salvar');
      }
    });
  }

  editar(r: Registro) { this.registro = { ...r }; }

  excluir(id: number) {
    if (confirm('Excluir este registro?')) {
      this.service.excluir(id).subscribe(() => this.carregar());
    }
  }

  limpar() { this.registro = this.vazio(); }

  totalMinutos() {
    return this.registros.reduce((soma, r) => soma + (r.minutosTrabalhados || 0), 0);
  }

  formatarHoras(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h${String(m).padStart(2, '0')}`;
  }

  formatarData(iso: string) {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
  }
}
