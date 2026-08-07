# Atlas PPM — Functional Flows

Flow diagrams for each Atlas PPM functional area. Each entry shows the live
Mermaid source (renders in Confluence / GitHub) and links the static PNG in
`images/`. Sources live in `flows/`; regenerate images with the command in
`README.md`.


## Index

- [Application map & navigation](#00-app-sitemap)
- [Authentication & RBAC gate](#01-auth-rbac)
- [Dashboard — layout switching & data](#02-dashboard)
- [Demand intake → scoring → approval funnel](#03-demands)
- [Portfolio → Project drill-in](#04-portfolio-project)
- [Project stage gates (G0–G5) & reviews](#05-project-gates)
- [Task board move — realtime, cap-schedule](#06-tasks-board)
- [Timeline / Gantt & cross-entity dependencies](#07-gantt)
- [Resource utilisation & capacity](#08-resources)
- [Financials roll-up → portfolio ROI](#09-financials)
- [Program detail — stakeholder matrix](#10-programs)
- [Products → Releases → deployment](#11-products-releases)
- [OKRs — objectives, key results, linkage](#12-okrs)
- [Delivery status reporting by period](#13-delivery)
- [Weekly news wall (edit / view)](#14-news)
- [Connector sync (Jira / Azure DevOps)](#15-integrations-sync)
- [Whiteboard live co-editing](#16-whiteboard)
- [Reports & export](#17-reports)
- [Administration](#18-admin)
- [Governance & compliance](#19-governance-compliance)


<a id="00-app-sitemap"></a>

## Application map & navigation

![Application map & navigation](images/00-app-sitemap.png)

```mermaid
graph LR
  ATLAS(["Atlas PPM"]):::start
  ATLAS --> WS["Workspace"]
  ATLAS --> CFG["Configuration"]
  ATLAS --> STK["Stakeholder"]
  WS --> W1["Dashboard · Portfolio · Programs<br/>Products · OKRs · Demands · Timeline"]
  WS --> W2["Project Detail · Resources · Financials<br/>Delivery · Releases · News"]
  CFG --> C1["My Team · Methodologies · Integrations<br/>Reports · Administration · Help"]
  STK --> S1["My Projects · My Demands<br/>Delivery · Releases · News · Help"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="01-auth-rbac"></a>

## Authentication & RBAC gate

![Authentication & RBAC gate](images/01-auth-rbac.png)

```mermaid
graph TD
  U(["User opens Atlas"]):::start --> A{"VITE_AUTH_ENABLED?"}
  A -- "No (dev)" --> DEV["Anonymous mode<br/>X-Atlas-Role header"]
  A -- "Yes" --> MSAL["MSAL redirect → Entra ID"]
  MSAL --> TOK["Bearer token"]
  DEV --> API["Call /api/v1/* "]
  TOK --> API
  API --> RBAC{"Server RBAC<br/>capability check"}
  RBAC -- allow --> OK(["200 + data"]):::start
  RBAC -- deny --> F["403 Forbidden"]:::deny
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
  classDef deny fill:#f7dede,stroke:#b23a3a,color:#7a1f1f;
```


<a id="02-dashboard"></a>

## Dashboard — layout switching & data

![Dashboard — layout switching & data](images/02-dashboard.png)

```mermaid
graph LR
  N(["Open Dashboard"]):::start --> L{"Layout"}
  L --> E["Executive"]
  L --> O["Operational"]
  L --> C["Compact"]
  L --> CU["Custom builder<br/>drag/add/remove widgets"]
  E --> Q["useDashboard() query"]
  O --> Q
  C --> Q
  CU --> Q
  Q --> D{"Data?"}
  D -- yes --> R["KPIs · charts · tables · pipeline"]
  D -- empty --> Z["Zeroed KPIs · empty panels"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="03-demands"></a>

## Demand intake → scoring → approval funnel

![Demand intake → scoring → approval funnel](images/03-demands.png)

```mermaid
graph TD
  C(["Create demand"]):::start --> SC["Score: value + effort (1–5)"]
  SC --> DR["Draft"]
  DR --> BK["Backlog"]
  BK -->|"drag card (live funnel)"| AP{"Approve?<br/>governance-gated"}
  AP -- approved --> PG["In progress"]
  AP -- hold --> HD["Hold"]
  PG --> CV["Converted to project"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="04-portfolio-project"></a>

## Portfolio → Project drill-in

![Portfolio → Project drill-in](images/04-portfolio-project.png)

```mermaid
graph LR
  P(["Portfolio"]):::start --> T{"Sub-tab"}
  T --> PJ["Projects<br/>filter chips · cards/table"]
  T --> BK["Blockers<br/>list + side panel"]
  PJ -->|"click project"| PD(["Project Detail"]):::start
  PD --> TABS["Overview · Tasks · Epics · RAID<br/>Artifacts · Costs · Gates · Security"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="05-project-gates"></a>

## Project stage gates (G0–G5) & reviews

![Project stage gates (G0–G5) & reviews](images/05-project-gates.png)

```mermaid
graph LR
  G0["G0<br/>Concept"] --> G1["G1<br/>Initiate"] --> G2["G2<br/>Plan"] --> G3["G3<br/>Build"] --> G4["G4<br/>Deploy"] --> G5["G5<br/>Close"]
  R{"Gate review<br/>cap-approve"}:::gate
  G1 -.-> R
  G3 -.-> R
  R -- pass --> ADV["Advance to next gate"]
  R -- fail --> REM["Remediate / hold"]:::deny
  classDef gate fill:#fff6e6,stroke:#a9791a,color:#5a3d00;
  classDef deny fill:#f7dede,stroke:#b23a3a,color:#7a1f1f;
```


<a id="06-tasks-board"></a>

## Task board move — realtime, cap-schedule

![Task board move — realtime, cap-schedule](images/06-tasks-board.png)

```mermaid
graph TD
  U(["Planner drags task card"]):::start --> CAP{"cap-schedule?<br/>Admin · PMO · PM · PM Lead"}
  CAP -- no --> DENY["403 — status change denied"]:::deny
  CAP -- yes --> MV["PATCH task status"]
  MV --> HUB["SignalR room tasks:{projectId}"]
  HUB --> PEERS["Card moves live for every viewer"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
  classDef deny fill:#f7dede,stroke:#b23a3a,color:#7a1f1f;
```


<a id="07-gantt"></a>

## Timeline / Gantt & cross-entity dependencies

![Timeline / Gantt & cross-entity dependencies](images/07-gantt.png)

```mermaid
graph LR
  SC{"Scope"} --> PJ["Project"]
  SC --> PG["Program"]
  PJ --> T["Timeline: phases · bars · milestones"]
  PG --> T
  T --> DEP["Finish→Start dependency arrows"]
  DEP --> S{"source"}
  S --> M["manual (hand-drawn, cap-projects)"]
  S --> J["jira (issue-link ingest)"]
  S --> PL["project links (auto)"]
```


<a id="08-resources"></a>

## Resource utilisation & capacity

![Resource utilisation & capacity](images/08-resources.png)

```mermaid
graph TD
  R(["Resources roster<br/>synced from Entra ID"]):::start --> W{"Period window"}
  W --> WIN["day/week/month/quarter/half/year<br/>or custom date range"]
  WIN --> ENG["Shared time-phased engine"]
  ENG --> UT["Avg utilisation = Ops + Project + Product"]
  UT --> OV{"over 100%?"}
  OV -- yes --> FLAG["Over-allocation → resource risk"]:::deny
  OV -- no --> OK["Within capacity"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
  classDef deny fill:#f7dede,stroke:#b23a3a,color:#7a1f1f;
```


<a id="09-financials"></a>

## Financials roll-up → portfolio ROI

![Financials roll-up → portfolio ROI](images/09-financials.png)

```mermaid
graph LR
  SRC{"Source toggle"} --> BUD["Budget vs Actual"]
  BUD --> SP["CapEx / OpEx split"]
  SP --> FAC["Forecast at completion"]
  FAC --> BEN["Savings / benefit"]
  BEN --> ROI(["Portfolio ROI"]):::start
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="10-programs"></a>

## Program detail — stakeholder matrix

![Program detail — stakeholder matrix](images/10-programs.png)

```mermaid
graph TD
  PG(["Program detail"]):::start --> MTX["Stakeholder power/interest matrix"]
  PG --> LP["Linked projects — roll-up status"]
  PG --> SY["Sync from Jira (cap-projects E)"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="11-products-releases"></a>

## Products → Releases → deployment

![Products → Releases → deployment](images/11-products-releases.png)

```mermaid
graph LR
  PRD(["Product"]):::start --> MAP["Jira / ADO tasks mapped"]
  MAP --> REL["Releases"]
  REL --> CAL["Release calendar"]
  CAL --> DEP["Deployment tracking"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="12-okrs"></a>

## OKRs — objectives, key results, linkage

![OKRs — objectives, key results, linkage](images/12-okrs.png)

```mermaid
graph TD
  O(["Objective"]):::start --> KR["Key results"]
  KR --> L{"Link target"}
  L --> P["Project"]
  L --> PG["Program"]
  L --> PR["Product"]
  KR --> PROG["Progress roll-up (0–100%)"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="13-delivery"></a>

## Delivery status reporting by period

![Delivery status reporting by period](images/13-delivery.png)

```mermaid
graph LR
  PER{"Period<br/>weekly → yearly"} --> AGG["Completed · in-progress · planned"]
  AGG --> VEL["Velocity + on-time %"]
  AGG --> BLK["Blockers"]
  AGG --> BURN["Budget burn"]
  VEL --> RPT(["Stakeholder delivery report"]):::start
  BLK --> RPT
  BURN --> RPT
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="14-news"></a>

## Weekly news wall (edit / view)

![Weekly news wall (edit / view)](images/14-news.png)

```mermaid
graph TD
  ED{"Edit mode?"} -- yes --> BLK["Add blocks: headline · metric · shout-out<br/>image · milestone · doc"]
  BLK --> SAVE["Save news wall"]
  ED -- no --> VIEW(["Masonry news wall (themed)"]):::start
  SAVE --> VIEW
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="15-integrations-sync"></a>

## Connector sync (Jira / Azure DevOps)

![Connector sync (Jira / Azure DevOps)](images/15-integrations-sync.png)

```mermaid
sequenceDiagram
  autonumber
  actor U as PM · cap-projects E
  participant API as Atlas API
  participant Q as SyncQueue⟨T⟩
  participant W as SyncWorker⟨T⟩
  participant C as IWorkItemConnector
  participant EX as Jira / Azure DevOps
  U->>API: POST /projects/{id}/{conn}/sync?background=true
  API->>API: gate cap-projects E
  API->>Q: enqueue job
  API-->>U: 202 Accepted + jobId
  W->>C: SyncCoreAsync(targets, delta)
  C->>EX: pull issues (delta watermark, ISO)
  EX-->>C: work items
  C->>API: upsert projects / sprints / epics / tasks
  W->>API: write audit event
  U->>API: GET .../sync/status/{jobId}
  API-->>U: status = done (counts)
```


<a id="16-whiteboard"></a>

## Whiteboard live co-editing

![Whiteboard live co-editing](images/16-whiteboard.png)

```mermaid
graph TD
  U(["User edits node / edge"]):::start --> OP["Authorized op<br/>scope-gated by entity capability"]
  OP --> SAN["Server sanitises + persists typed row"]
  SAN --> HUB["Room hub broadcast"]
  HUB --> PEERS["Live co-edit: presence · cursors<br/>field-merge · off-screen peers"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="17-reports"></a>

## Reports & export

![Reports & export](images/17-reports.png)

```mermaid
graph LR
  SEL(["Select report<br/>portfolio · demand · blocker · audit"]):::start --> BR["Apply branding"]
  BR --> F{"Export format"}
  F --> PDF["PDF"]
  F --> XL["Excel"]
  F --> PP["PPTX"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="18-admin"></a>

## Administration

![Administration](images/18-admin.png)

```mermaid
graph TD
  A(["Administration"]):::start --> RBAC["Roles & permissions matrix"]
  A --> BK["Backups / restore (validated)"]
  A --> AUD["Audit log"]
  A --> SY["AD directory sync"]
  A --> DEL["Deletion requests (GDPR)"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```


<a id="19-governance-compliance"></a>

## Governance & compliance

![Governance & compliance](images/19-governance-compliance.png)

```mermaid
graph TD
  GOV(["Governance & compliance"]):::start --> SOA["ISO 27001 SoA — 93 Annex A controls"]
  GOV --> ADR["Decision log (ADR)"]
  GOV --> TG["TOGAF ADM phases · ARB · waivers"]
  GOV --> SEC["GDPR · PCI-DSS · EU AI Act · SOC 2 · NIS2"]
  SOA --> COV["Coverage roll-up"]
  classDef start fill:#2a4c8f,stroke:#22407a,color:#ffffff,font-weight:600;
```
