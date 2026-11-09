# Sentinela das Águas e Vicinais (Iniciativa FUIO)

> **Plataforma de Resiliência Educacional e Mitigação de Riscos Logísticos para Rondônia**
> _Projeto desenvolvido para Hackathon de Inovação em Rondônia (Porto Velho, Baixo Madeira, Guajará-Mirim, Cacoal, Candeias do Jamari e Ji-Paraná)._

---

## 1. Contexto Regional & Problema Enfrentado

No estado de Rondônia, a evasão e a perda de dias letivos não decorrem exclusivamente de fatores pedagógicos, mas sim da **severa sazonalidade climática amazônica**:

1. **Inverno Amazônico (Cheias Fluviais & Linhas Vicinais em Atoleiro):**
   - Os rios Madeira, Mamoré e Candeias ultrapassam as cotas de inundação, submergindo portos, rampas flutuantes e edificações escolares ribeirinhas (ex: São Carlos, Nazaré, Calama).
   - O volume pluviométrico acumulado (>120 mm em 72h) transforma as estradas vicinais rurais não pavimentadas (linhas) em atoleiros intransponíveis, retendo a frota de ônibus escolares por semanas e rompendo pontilhões de madeira.

2. **Verão Amazônico (Vazante Severa & Fumaça de Queimadas PM2.5):**
   - A vazante histórica expõe bancos de areia e pedrais no leito dos rios, impedindo a navegação de voadeiras e lanchas escolares por perda de calado.
   - Aglomerados de focos de calor geram plumas de material particulado fino (PM2.5 > 100 µg/m³), tornando salas de aula sem climatização insalubres para estudantes e professores.

3. **Silos Institucionais & Perda de Patrimônio:**
   - Dados de telemetria do Censipam (**SipamHidro** para bacias fluviais e **Painel do Fogo** para focos orbitais) permaneciam desconectados do planejamento da **SEDUC-RO** e das **SEMEDs** municipais.
   - Escolas sofriam perdas graves de equipamentos de informática, servidores e arquivos históricos de papel por falta de diretrizes preventivas padronizadas.

---

## 2. A Solução: Sentinela das Águas e Vicinais & Iniciativa FUIO

O sistema cruza dados telemétricos e geoespaciais com a malha escolar e rotas de transporte em três pilares:

- **Mapeamento Dinâmico de Riscos:** Visualização geoespacial com OpenStreetMap e Leaflet, categorizando o risco de cada escola em **Crítico**, **Alto**, **Moderado** e **Baixo**, correlacionando pluviometria 72h e cotas fluviométricas com a soleira de cada edificação.
- **Iniciativa FUIO (Frente Unificada de Intercooperação Escolar):** Pacto federativo entre Estado (**SEDUC-RO**) e Municípios (**SEMEDs**) para transferir temporariamente turmas de escolas interditadas para escolas anfitriãs seguras com capacidade ociosa em até 80 km, preservando os **200 dias letivos obrigatórios**. _Todas as escolas gerenciadas pelo sistema já integram formalmente o pacto, permitindo alocação e match logístico automático sem redundâncias de adesão avulsa._
- **Motor de Diretrizes Automatizadas:** Protocolo acionável com checklist interativo para mitigação patrimonial (elevação de computadores e nobreaks, lacre de arquivos em tambores herméticos, desativação de subestação térrea), modulação pedagógica híbrida e proteção à saúde contra fumaça.

---

## 3. Arquitetura Técnica & Stack

- **Monorepo:** Bun Workspaces (`package.json`, `api`, `web`)
- **Backend (`api`):** Hono v4, `@hono/zod-validator`, Zod, Drizzle ORM, driver `postgres`
- **Banco de Dados:** PostgreSQL 16 (configurável via `DATABASE_URL`)
- **Frontend (`web`):** Vite 8, React 19, TypeScript strict, TanStack Query v5, Tailwind CSS v4, Lucide React, Leaflet & React-Leaflet
- **100% Autocontido:** Nenhuma chamada externa a APIs pagas ou com autenticação (telemetria servida de seed local determinístico).

---

## 4. Como Executar

### Pré-requisitos

- [Bun](https://bun.sh/) (v1.2+)
- [Podman](https://podman.io/) ou [Docker](https://www.docker.com/) para o banco PostgreSQL

### 1. Iniciar o Banco PostgreSQL via Podman Compose

```bash
podman compose up -d
```

_(Para encerrar os serviços quando necessário: `podman compose down`)_

### 2. Configurar Variáveis de Ambiente

Configure as variáveis de ambiente no arquivo `.env` na raiz do projeto (valores padrão pré-configurados para desenvolvimento local):

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=hackathon_db
DATABASE_URL=postgres://postgres:postgres@localhost:5432/hackathon_db
PORT=3000
VITE_API_URL=http://localhost:3000
```

### 3. Aplicar Migrações e Executar o Seed Determinístico

```bash
bun run db:push
bun run db:seed
```

### 4. Iniciar a API e o Frontend

Em terminais separados (ou em segundo plano):

```bash
# Terminal 1: Backend Hono API (porta 3000)
bun run dev:api

# Terminal 2: Frontend Vite React 19 (porta 5173)
bun run dev:web
```

Acesse a interface no navegador: **`http://localhost:5173`**

---

## 5. Cenários Ambientais Disponíveis

A plataforma implementa o recurso de alternância de cenários na barra superior:

1. **Inverno Amazônico · Cheia 2026 (Data-base: 27/03/2026):**
   - Rio Madeira a 17,48 m em Porto Velho (+9 cm/dia), Baixo Madeira inundando São Carlos e Calama.
   - Linhas 10 e Travessão 07 de Cacoal com mais de 140 mm de chuva em 72h e atoleiros severos.
2. **Verão Amazônico · Vazante 2026 (Data-base: 18/09/2026):**
   - Rio Madeira em vazante extrema (1,28 m), voadeiras e barcos escolares sem calado no Baixo Madeira.
   - Plumas de queimadas com PM2.5 > 180 µg/m³ em Cacoal (Distrito de Riozinho) e Candeias do Jamari (Distrito de Triunfo).
