# PI Program Board — remaining follow-ups (hand-off)

Two items from the board/Teams work were deferred because they need a **.NET SDK
environment** (for `dotnet ef`) and a **running stack** (Postgres + browser) that
the authoring session didn't have. Everything else shipped in #1–#4. This is the
precise checklist to finish them.

---

## 1. Promote board placement to a typed column — *also fixes a concurrency race* — ✅ DONE

> **Resolved** — `PiObjective.IterationId` shipped (migration `PiObjectiveIterationId`,
> which backfills from and removes the old `pi.board.%` Setting rows). `PiBoard.cs`
> now reads/writes the column (per-row, concurrency-safe). The original plan is
> kept below for history.

**Why.** Board placement currently lives as a JSON blob in the `Setting` row
`pi.board.{incrementId}`, written read-modify-write in `server/PiBoard.cs`
(`LoadAsync → mutate map → SaveAsync`). That whole-map rewrite is **not
concurrency-safe**: two people dragging cards at once clobber each other (lost
update). Moving placement onto the objective row makes each write independent and
naturally safe. This is a correctness fix for the multi-user feature, not just
cleanup.

**Steps** (needs the .NET SDK):

1. **Model** — in `server/Domain.cs`, add to `PiObjective`:
   ```csharp
   public int? IterationId { get; set; }   // board column; null ⇒ Unscheduled
   ```
   No `AtlasDbContext` change (the `DbSet<PiObjective>` already exists; a nullable
   int needs no fluent config).

2. **Migration**:
   ```bash
   cd server
   dotnet ef migrations add PiObjectiveIterationId
   dotnet build            # confirm the migration + snapshot compile
   ```
   `Program.cs` applies it on boot via `Database.Migrate()` (web/all role).

3. **Rewrite `server/PiBoard.cs`** to use the column instead of the `Setting` blob
   (keep the same routes, DTOs and `cap-schedule` gate so the frontend is
   unchanged):
   ```csharp
   // GET /increments/{id}/board
   var iterIds = (await db.PiIterations.Where(t => t.IncrementId == id)
                    .Select(t => t.Id).ToListAsync()).ToHashSet();
   var placements = (await db.PiObjectives.Where(o => o.IncrementId == id).ToListAsync())
       .Where(o => o.IterationId is int it && iterIds.Contains(it))
       .ToDictionary(o => o.Id.ToString(), o => o.IterationId!.Value);
   return Results.Ok(new { canEdit, placements });

   // PUT /increments/{id}/board/placement
   var obj = await db.PiObjectives.FirstOrDefaultAsync(o => o.Id == req.ObjectiveId && o.IncrementId == id);
   if (obj is null) return Results.BadRequest(new { error = "That objective isn't in this increment." });
   if (req.IterationId is int it && !await db.PiIterations.AnyAsync(t => t.Id == it && t.IncrementId == id))
       return Results.BadRequest(new { error = "That iteration isn't in this increment." });
   obj.IterationId = req.IterationId;                 // per-row ⇒ concurrent-safe
   db.AuditEvents.Add(Permissions.Audit(http, cfg, "PI Planning", "Moved board card",
       $"objective {req.ObjectiveId} → {(req.IterationId?.ToString() ?? "unscheduled")}"));
   await db.SaveChangesAsync();
   await BoardHub.NotifyGroupAsync(hub, id);
   return Results.NoContent();
   ```
   Delete the `LoadAsync` / `SaveAsync` / `Key(...)` JSON helpers.

4. **Backfill (optional).** The feature is new, so there is unlikely to be real
   placement data. If any `Setting` rows with `Key LIKE 'pi.board.%'` exist,
   parse each JSON map once and set `PiObjective.IterationId`, then delete those
   rows. Otherwise just delete them. (Simplest: a one-off guarded startup step or
   a SQL script — not worth a permanent code path.)

5. **Frontend** — no change. `GET` still returns `{ canEdit, placements }` and
   `PUT` still takes `{ objectiveId, iterationId }`.

6. **Tests** — `server/Atlas.Tests/PiBoardAndSettingsTests.cs` exercises these
   endpoints and stays valid (the in-memory `EnsureCreated` host picks up the new
   column). Consider adding a concurrency test: two parallel `PUT`s on *different*
   objectives in one increment both persist.

7. **Docs** — update `ADR-0061`: placement is now a typed column, the race is
   resolved, and the "migration-free `Setting` blob" note / `pi.board.` mention
   can go. (The `GET /settings` secret-redaction from #2 stays — it's unrelated.)

---

## 2. Runtime end-to-end verification

Nothing below was observable in the authoring env (no SDK/stack). Bring the whole
thing up and confirm it actually behaves.

```bash
cp .env.example .env
SEED_DEMO_DATA=true docker compose up --build     # db + api + worker + web
```
Auth is off by default, so the role switcher drives identity. Open the `web`
service (HTTPS on its mapped port).

**Board + real-time**
1. *PI Planning* → create/select an increment → **Program Board** tab.
2. Add a few objectives (link some to a project/program), 1–2 iterations, and a
   dependency between two deliverables.
3. Confirm: swimlanes per deliverable, cards in cells, dependency arrows, and the
   **Live** indicator is green.
4. Open a **second** browser/incognito window (or switch role) on the same board:
   - Both presence avatars appear; moving the mouse shows the other's cursor.
   - Drag a card **or** use the card's iteration `<select>` in window A → it moves
     in window B within ~1s.
   - Edit an objective on the *Objectives* tab in A → the board in B refreshes
     (server-driven `BoardChanged` ping).
5. Keyboard path: Tab to a card's select, change the iteration → it moves and
   persists (no mouse).

**Teams**
1. In Teams: channel → **Workflows → "Post to a channel when a webhook request is
   received"** → copy the URL.
2. *Integrations → Microsoft Teams → Configure* → paste, enable, **Save** → **Send
   test** → confirm a card lands in the channel.
3. Trigger a real notification (subscribe to a project, then change its status or
   raise a risk) → confirm a card posts.
4. As **any** role, confirm `GET /api/v1/settings` does **not** contain the
   webhook URL (only the masked host appears via `/integrations/teams/status`).

**Watch for** (only visible at runtime):
- The SignalR handshake through nginx `/hubs` — browser devtools should show a
  `wss://…/hubs/board` **101 Switching Protocols**.
- With `Auth:Enabled=true`, the `access_token` query reaches the hub and the
  connection authorizes (else presence silently stays empty — the board still
  works, just not live).
- Dependency-arrow geometry with many lanes/dependencies (potential visual
  overlap on the rail).

---

## 3. Promote key/value blobs to typed tables (whiteboard + board) — ✅ DONE

> **Resolved.** Both collaborative surfaces now persist as typed rows:
> - **PI board placement** → `PiObjective.IterationId` (item **1** above,
>   migration `PiObjectiveIterationId`).
> - **Whiteboard scenes** → `WhiteboardNode` / `WhiteboardEdge` keyed by scope
>   `{kind}:{id}` (migration `WhiteboardTables`). `server/Whiteboards.cs` reads/
>   writes rows; every granular op is a single-row upsert/delete, closing the
>   read-modify-write race. Existing `Setting["whiteboard.%"]` blobs are migrated
>   at startup by `Whiteboards.BackfillAsync` (parse + re-sanitise → rows, then
>   delete the blob; idempotent). Routes, DTOs, scope→capability gate,
>   sanitisation and the real-time op broadcast are unchanged, so the frontend is
>   untouched. ADR-0064 updated. The `whiteboard.` `GET /settings` redaction is
>   kept as defence-in-depth for any not-yet-migrated row.
>
> The original plan is kept below for history.

Both were the *migration-free interim*, blocked on a **.NET SDK environment**
(`dotnet ef`) the authoring sessions didn't have. Promoting them to first-class
tables removed the residual **blob read-modify-write race** (two writers to the
same scene/board could lose an update — the live co-editing layer narrowed the
window and reconciled, but per-row typed writes are the real fix). Whiteboard
shape that shipped:

1. Typed entities `WhiteboardNode` / `WhiteboardEdge` keyed by `Scope` (`{kind}:{id}`).
2. `dotnet ef migrations add WhiteboardTables` → `Database.Migrate()` applies on boot.
3. `server/Whiteboards.cs` reads/writes rows (same routes, DTOs, scope→capability
   gate, sanitisation and real-time op broadcast); the `Setting`-blob load/save
   helpers are gone.
4. `Whiteboards.BackfillAsync` migrates any `whiteboard.%` `Setting` rows, then
   deletes them.
5. ADR-0064 updated.
