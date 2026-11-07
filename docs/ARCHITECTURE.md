# Architecture

Implemented in M0: PostgreSQL migrations, generated store, JSON seed, two read-only HTTP
endpoints, status page. Everything labeled planned is a design direction, not shipped code.

## System context
```mermaid
flowchart LR
  Browser[Player browser] --> Next[Next.js page]
  Next -->|internal HTTP| Go[Go API]
  Go -->|pgx / sqlc| DB[(PostgreSQL)]
  Browser -. planned WebSocket .-> Go
  Go -. planned provider interface .-> Ads[Ad provider]
```
No host screen. Each participant eventually renders shared state and personal controls.
Browser URLs use localhost; service-to-service URLs use Docker DNS. Current server-rendered
page fetches /healthz and /api/packs without a browser CORS dependency.

## Room actor flow — planned
```mermaid
flowchart LR
  Socket[Socket reader] -->|validated intent| Channel[Room event channel]
  Timer[Injected timer] --> Channel
  Channel --> Actor[One goroutine owns room]
  Actor --> Game[Pure game transition]
  Game --> Actor
  Actor --> Projection[Per-player projections]
  Projection --> Writer[Bounded socket writers]
  Registry[Shared registry] --> Actor
```
The registry is the sole shared mutable room coordination point. Never perform network I/O
inside pure rules; effects are interpreted by the room runtime. Bound queues and writes.

## Join flow including AdGate — planned
```mermaid
sequenceDiagram
  participant P as Player
  participant A as Platform API
  participant G as AdGate provider
  participant R as Room actor
  P->>A: Join code + optional reconnect token
  A->>A: Validate origin, code, limits and capacity
  A->>G: Check consent / admission policy
  G-->>P: Mock first; ad if eligible later
  P->>A: Admission completion
  A->>R: Join intent
  R-->>P: Session token + authorized projection
```
M1 joins directly; M6 inserts AdGate, never during a round. Server validates admission;
client success claims are not authority. Reconnect policy is decided before M1.

## Game module — interface stub only; lifecycle planned
```mermaid
flowchart LR
  Input[State + event + injected time/RNG] --> Transition[Module.Transition]
  Transition --> Output[New state + effects]
  State[State + player ID] --> Project[Module.Project]
  Project --> View[Authorized player view]
  Registry[Modules keyed by ID] --> Transition
```
`backend/internal/games` holds only this contract and an unimplemented registry signature.
Wit Parade is an empty placeholder. No game engine is implemented.
Protocol convention: JSON `{type, id?, payload}`, snake_case types, camelCase fields.
Go protocol package is authoritative; frontend lib/protocol.ts mirrors it. No messages yet.

## Data model
prompt_packs/prompts exist now; users, sessions, prompt_reports and ownership FKs are planned.
```mermaid
erDiagram
  users ||--o{ sessions : "planned owns"
  users ||--o{ prompt_packs : "planned authors"
  users ||--o{ prompt_reports : "planned submits"
  prompt_packs ||--o{ prompts : contains
  prompts ||--o{ prompt_reports : "planned receives"
  users { bigint id PK }
  sessions { string token_hash PK }
  prompt_packs { bigint id PK string slug UK string title boolean is_official string status timestamptz created_at timestamptz updated_at }
  prompts { bigint id PK bigint pack_id FK int position string text string status timestamptz created_at timestamptz updated_at }
  prompt_reports { bigint id PK bigint prompt_id FK string reason string status }
```
Published official packs are exposed publicly. Prompt approval and account ownership arrive
in M3–M5; current constraints allow draft/published packs and pending/approved/rejected prompts.
Room/session reconnect tokens are separate from future account sessions. Live rooms are in
memory for v1 (planned), not database records. See deployment plan for scaling implications.
