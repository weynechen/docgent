# Notebook New And Save Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the temporary workspace-centric editing flow with notebook/item creation plus automatic save, offline-safe local buffering, and conflict-safe sync while preserving AI editing on the active item.

**Architecture:** Add a persisted `notebook`/`notebook_item` backend domain and migrate the frontend from `activeDoc` to `activeNotebook` + `activeItem`. Keep the backend database as the source of truth, add an IndexedDB-backed outbox for low-latency/offline editing, and bridge AI reads/writes onto notebook items so the existing assistant remains usable.

**Tech Stack:** FastAPI, SQLAlchemy, Alembic, React 19, Zustand, Tiptap, IndexedDB, Vitest, HTTPX, uv, npm

## 状态更新（2026-03-15）

- 已完成 notebook 与 notebook item 的后端模型、服务、REST API 和迁移
- 已完成前端 notebook-first 编辑壳、自动保存、IndexedDB 本地缓冲与同步状态栏
- 已完成 notebook-aware AI Chat：
  - websocket 支持 `notebook_id` / `item_id`
  - agent tools 支持 `ListItems`、`Read`、`Write`
  - 前端右栏已恢复真实聊天输入、流式消息与 notebook item 写回
- 当前未完成项主要是浏览器手工回归、冲突处理 UX 打磨，以及外链/导入扩展实现

---

## File Structure

### Backend domain and API

- Create: `backend/app/db/models/notebook.py`
  Defines the `Notebook` SQLAlchemy model and owns notebook metadata.
- Create: `backend/app/db/models/notebook_item.py`
  Defines `NotebookItem` with type, markdown content, ordering, and revision fields.
- Create: `backend/app/repositories/notebook.py`
  Encapsulates notebook and notebook item database access.
- Create: `backend/app/schemas/notebook.py`
  Holds notebook/item request and response schemas.
- Create: `backend/app/services/notebook.py`
  Implements notebook creation, listing, item creation, item update, and revision conflict checks.
- Create: `backend/app/api/routes/v1/notebooks.py`
  Exposes REST endpoints for notebook and item workflows.
- Create: `backend/alembic/versions/20260314_01_create_notebooks_and_notebook_items.py`
  Adds notebook tables and revision constraints.
- Create: `backend/tests/api/test_notebooks.py`
  Route-level tests for notebook CRUD and revision conflict behavior.
- Create: `backend/tests/test_notebook_service.py`
  Service-layer tests for notebook defaults and conflict handling.
- Modify: `backend/app/db/models/__init__.py`
  Export new models for metadata discovery.
- Modify: `backend/app/repositories/__init__.py`
  Export the notebook repository.
- Modify: `backend/app/services/__init__.py`
  Export the notebook service.
- Modify: `backend/app/api/deps.py`
  Add dependency injection for `NotebookService`.
- Modify: `backend/app/api/routes/v1/__init__.py`
  Register notebook routes.

### Frontend notebook shell

- Create: `frontend/src/notebooks/types.ts`
  Frontend notebook/item types and sync status enums.
- Create: `frontend/src/notebooks/types.test.ts`
  Frontend notebook/item types and sync status enums.
- Create: `frontend/src/notebooks/remoteNotebookStore.ts`
  REST client for notebook and item endpoints.
- Create: `frontend/src/notebooks/NotebookSidebar.tsx`
  Left-column notebook and item navigation UI.
- Create: `frontend/src/notebooks/NotebookStatusBar.tsx`
  Footer status component for save/offline/conflict state.
- Create: `frontend/src/notebooks/store.ts`
  Zustand store for notebook loading, active item editing, and sync orchestration.
- Create: `frontend/src/notebooks/store.test.ts`
  Store tests for notebook creation, item switching, and dirty-state transitions.
- Create: `frontend/src/test/setup.ts`
  Shared frontend test setup, including IndexedDB polyfill hooks.
- Create: `frontend/vitest.config.ts`
  Vitest/jsdom config for frontend unit tests.
- Modify: `frontend/src/app/store.ts`
  Turn the old workspace store file into a thin compatibility re-export or migration wrapper.
- Modify: `frontend/src/app/App.tsx`
  Replace document-centric UI with notebook/item UI while preserving editor and chat layout.
- Modify: `frontend/src/shared/types.ts`
  Remove or narrow old `DocFile` usage where the app still relies on shared typing.
- Modify: `package.json`
  Add frontend test scripts and dependencies.

### Sync and AI integration

- Create: `frontend/src/notebooks/indexedDb.ts`
  IndexedDB helpers for notebook cache, pending edits, and recovery metadata.
- Create: `frontend/src/notebooks/syncEngine.ts`
  Debounced flush, offline queue replay, and conflict state machine.
- Create: `frontend/src/notebooks/syncEngine.test.ts`
  Tests for debounce, offline replay, and conflict transitions.
- Create: `backend/app/agents/tools/notebook_tools.py`
  Notebook-scoped `Read`, `Write`, `ListItems`, and search helpers for the agent.
- Create: `backend/tests/test_notebook_tools.py`
  Tests for notebook tool behavior and item-scoped writes.
- Modify: `backend/app/agents/tools/__init__.py`
  Export notebook tools.
- Modify: `backend/app/api/routes/v1/agent.py`
  Accept notebook/item context and emit notebook item update events.
- Modify: `frontend/src/ai/provider.ts`
  Send notebook/item IDs, flush pending edits before AI requests, and consume notebook item update events.
- Modify: `frontend/src/shared/types.ts`
  Replace `workspace_file_updated` event typing with notebook item update typing.
- Modify: `docs/PLANS.md`
  Register this plan in the active plan list.
- Modify: `docs/product-specs/index.md`
  Link the new notebook plan from the current product priorities list.

## Chunk 1: Backend Notebook Domain

### Task 1: Add notebook database models and migration

**Files:**
- Create: `backend/app/db/models/notebook.py`
- Create: `backend/app/db/models/notebook_item.py`
- Create: `backend/alembic/versions/20260314_01_create_notebooks_and_notebook_items.py`
- Modify: `backend/app/db/models/__init__.py`
- Test: `backend/tests/test_notebook_service.py`

- [ ] **Step 1: Write the failing model/service tests**

```python
async def test_create_notebook_seeds_initial_draft() -> None:
    service = NotebookService(db=mock_db)
    notebook = await service.create_notebook()
    assert notebook.title == "Untitled notebook"
    assert len(notebook.items) == 1
    assert notebook.items[0].type == "draft"
    assert notebook.items[0].title == "Untitled"
    assert notebook.items[0].server_revision == 1
```

- [ ] **Step 2: Run the backend notebook tests to verify they fail**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py -v`
Expected: FAIL with import or attribute errors for missing notebook models/service.

- [ ] **Step 3: Implement `Notebook` and `NotebookItem` models plus Alembic migration**

```python
class Notebook(Base, TimestampMixin):
    __tablename__ = "notebooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled notebook")


class NotebookItem(Base, TimestampMixin):
    __tablename__ = "notebook_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    notebook_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("notebooks.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_format: Mapped[str] = mapped_column(String(32), nullable=False, default="markdown")
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    server_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
```

- [ ] **Step 4: Run the model/service test again**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py -v`
Expected: still FAIL, now due to missing repository/service implementation rather than missing models.

- [ ] **Step 5: Commit the model skeleton**

```bash
git add backend/app/db/models/notebook.py backend/app/db/models/notebook_item.py backend/app/db/models/__init__.py backend/alembic/versions/20260314_01_create_notebooks_and_notebook_items.py backend/tests/test_notebook_service.py
git commit -m "feat: add notebook persistence models"
```

### Task 2: Add notebook repository and service logic

**Files:**
- Create: `backend/app/repositories/notebook.py`
- Create: `backend/app/services/notebook.py`
- Modify: `backend/app/repositories/__init__.py`
- Modify: `backend/app/services/__init__.py`
- Test: `backend/tests/test_notebook_service.py`

- [ ] **Step 1: Extend the failing service tests for conflicts and item creation**

```python
async def test_update_item_rejects_stale_revision() -> None:
    with pytest.raises(BadRequestError) as exc:
        await service.update_item(item_id=item_id, content="new", base_revision=0)
    assert exc.value.code == "REVISION_CONFLICT"
```

- [ ] **Step 2: Run the targeted service tests**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py -v`
Expected: FAIL because repository/service methods do not exist yet.

- [ ] **Step 3: Implement notebook repository and service behavior**

```python
class NotebookService:
    async def create_notebook(self, title: str = "Untitled notebook") -> Notebook:
        notebook = await notebook_repo.create_notebook(self.db, title=title)
        await notebook_repo.create_item(
            self.db,
            notebook_id=notebook.id,
            type="draft",
            title="Untitled",
            content="",
            order_index=0,
        )
        await self.db.commit()
        return await notebook_repo.get_notebook_with_items(self.db, notebook.id)
```

- [ ] **Step 4: Run the service tests until they pass**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py -v`
Expected: PASS for notebook creation, item creation, and revision conflict coverage.

- [ ] **Step 5: Commit the repository/service layer**

```bash
git add backend/app/repositories/notebook.py backend/app/repositories/__init__.py backend/app/services/notebook.py backend/app/services/__init__.py backend/tests/test_notebook_service.py
git commit -m "feat: add notebook service layer"
```

### Task 3: Expose notebook APIs through FastAPI

**Files:**
- Create: `backend/app/schemas/notebook.py`
- Create: `backend/app/api/routes/v1/notebooks.py`
- Modify: `backend/app/api/deps.py`
- Modify: `backend/app/api/routes/v1/__init__.py`
- Test: `backend/tests/api/test_notebooks.py`

- [ ] **Step 1: Write the failing route tests**

```python
@pytest.mark.anyio
async def test_create_notebook_returns_seeded_draft(client_with_mock_service: AsyncClient) -> None:
    response = await client_with_mock_service.post("/api/v1/notebooks", json={})
    assert response.status_code == 201
    data = response.json()
    assert data["items"][0]["type"] == "draft"
```

- [ ] **Step 2: Run the route test file to confirm failure**

Run: `uv run --project backend pytest backend/tests/api/test_notebooks.py -v`
Expected: FAIL because the notebook router and schemas are not registered.

- [ ] **Step 3: Implement notebook schemas, dependency injection, and routes**

```python
@router.post("", response_model=NotebookRead, status_code=status.HTTP_201_CREATED)
async def create_notebook(
    payload: NotebookCreate,
    notebook_service: NotebookSvc,
) -> NotebookRead:
    return await notebook_service.create_notebook(title=payload.title or "Untitled notebook")


@router.patch("/items/{item_id}", response_model=NotebookItemRead)
async def update_notebook_item(
    item_id: UUID,
    payload: NotebookItemUpdate,
    notebook_service: NotebookSvc,
) -> NotebookItemRead:
    return await notebook_service.update_item(
        item_id=item_id,
        title=payload.title,
        content=payload.content,
        base_revision=payload.base_revision,
    )
```

- [ ] **Step 4: Run notebook API tests**

Run: `uv run --project backend pytest backend/tests/api/test_notebooks.py -v`
Expected: PASS for create/list/get/update/conflict behavior.

- [ ] **Step 5: Run the backend regression slice**

Run: `uv run --project backend pytest backend/tests/api/test_notebooks.py backend/tests/test_notebook_service.py backend/tests/api/test_workspaces.py -v`
Expected: PASS, confirming notebook work does not break existing workspace endpoints during migration.

- [ ] **Step 6: Commit the backend API**

```bash
git add backend/app/schemas/notebook.py backend/app/api/routes/v1/notebooks.py backend/app/api/deps.py backend/app/api/routes/v1/__init__.py backend/tests/api/test_notebooks.py
git commit -m "feat: add notebook api routes"
```

## Chunk 2: Frontend Notebook Shell

### Task 4: Add frontend notebook test harness and domain types

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/notebooks/types.ts`
- Create: `frontend/src/notebooks/types.test.ts`
- Modify: `package.json`
- Test: `frontend/src/notebooks/types.test.ts`

- [ ] **Step 1: Write a failing frontend smoke test**

```ts
import { describe, expect, it } from "vitest";
import { emptyNotebookState } from "./types";

describe("notebook types", () => {
  it("starts with an idle sync state", () => {
    expect(emptyNotebookState.syncState).toBe("saved");
  });
});
```

- [ ] **Step 2: Run the frontend test command and verify failure**

Run: `npm run test:frontend`
Expected: FAIL because Vitest/config/scripts are not wired yet.

- [ ] **Step 3: Add Vitest/jsdom setup and notebook type definitions**

```ts
export type NotebookSyncState = "saving" | "saved" | "offline" | "sync_failed" | "conflict";

export interface NotebookItemRecord {
  id: string;
  notebookId: string;
  type: "draft" | "note";
  title: string;
  content: string;
  serverRevision: number;
}
```

- [ ] **Step 4: Run the frontend tests again**

Run: `npm run test:frontend`
Expected: PASS for the new smoke test.

- [ ] **Step 5: Commit the frontend test harness**

```bash
git add package.json package-lock.json frontend/vitest.config.ts frontend/src/test/setup.ts frontend/src/notebooks/types.ts frontend/src/notebooks/types.test.ts
git commit -m "test: add frontend notebook test harness"
```

### Task 5: Implement remote notebook store and Zustand notebook store

**Files:**
- Create: `frontend/src/notebooks/remoteNotebookStore.ts`
- Create: `frontend/src/notebooks/store.ts`
- Create: `frontend/src/notebooks/store.test.ts`
- Modify: `frontend/src/app/store.ts`
- Test: `frontend/src/notebooks/store.test.ts`

- [ ] **Step 1: Write failing store tests for notebook creation and item switching**

```ts
it("creates a notebook and opens the seeded draft", async () => {
  const store = createNotebookStore(mockRemoteStore);
  await store.getState().createNotebook();
  expect(store.getState().activeNotebook?.title).toBe("Untitled notebook");
  expect(store.getState().activeItem?.type).toBe("draft");
});
```

- [ ] **Step 2: Run the store tests to verify failure**

Run: `npm run test:frontend -- frontend/src/notebooks/store.test.ts`
Expected: FAIL because the notebook store and remote client are missing.

- [ ] **Step 3: Implement the remote store and notebook Zustand state**

```ts
export const useNotebookStore = create<NotebookState>((set, get) => ({
  notebooks: [],
  syncState: "saved",
  async loadNotebooks() {
    const notebooks = await remoteNotebookStore.listNotebooks();
    set({
      notebooks,
      activeNotebook: notebooks[0],
      activeItem: notebooks[0]?.items[0],
    });
  },
  async createNotebook() {
    const notebook = await remoteNotebookStore.createNotebook();
    set({
      notebooks: [notebook, ...get().notebooks],
      activeNotebook: notebook,
      activeItem: notebook.items[0],
    });
  },
}))
```

- [ ] **Step 4: Run the notebook store tests**

Run: `npm run test:frontend -- frontend/src/notebooks/store.test.ts`
Expected: PASS for create/load/set-active behavior.

- [ ] **Step 5: Commit the notebook store layer**

```bash
git add frontend/src/notebooks/remoteNotebookStore.ts frontend/src/notebooks/store.ts frontend/src/notebooks/store.test.ts frontend/src/app/store.ts
git commit -m "feat: add frontend notebook store"
```

### Task 6: Replace document-centric UI with notebook/item UI

**Files:**
- Create: `frontend/src/notebooks/NotebookSidebar.tsx`
- Create: `frontend/src/notebooks/NotebookStatusBar.tsx`
- Modify: `frontend/src/app/App.tsx`
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/notebooks/store.test.ts`

- [ ] **Step 1: Add a failing component/store regression test**

```ts
it("marks the active item dirty when editor content changes", async () => {
  const store = createNotebookStore(mockRemoteStore);
  store.getState().updateActiveItemContent("# Draft");
  expect(store.getState().activeItem?.isDirty).toBe(true);
});
```

- [ ] **Step 2: Run the related frontend tests**

Run: `npm run test:frontend -- frontend/src/notebooks/store.test.ts`
Expected: FAIL because item-level editing state is not yet represented.

- [ ] **Step 3: Split sidebar/status UI and wire `App.tsx` to notebook state**

```tsx
<NotebookSidebar
  notebooks={notebooks}
  activeNotebookId={activeNotebook?.id}
  activeItemId={activeItem?.id}
  onCreateNotebook={() => void createNotebook()}
  onSelectNotebook={(id) => void setActiveNotebook(id)}
  onSelectItem={(id) => void setActiveItem(id)}
/>
<NotebookStatusBar
  syncState={syncState}
  notice={notice}
  lastAiWriteAt={lastAppliedChange?.appliedAt}
/>
```

- [ ] **Step 4: Run frontend tests and a production build**

Run: `npm run test:frontend`
Expected: PASS.

Run: `npm run build`
Expected: PASS with the notebook UI compiling cleanly.

- [ ] **Step 5: Commit the notebook shell UI**

```bash
git add frontend/src/notebooks/NotebookSidebar.tsx frontend/src/notebooks/NotebookStatusBar.tsx frontend/src/app/App.tsx frontend/src/shared/types.ts frontend/src/notebooks/store.test.ts
git commit -m "feat: switch app shell to notebooks"
```

## Chunk 3: Autosave, Offline Buffer, And Conflict Recovery

### Task 7: Add IndexedDB persistence for notebook cache and pending edits

**Files:**
- Create: `frontend/src/notebooks/indexedDb.ts`
- Create: `frontend/src/notebooks/syncEngine.test.ts`
- Modify: `frontend/src/test/setup.ts`
- Test: `frontend/src/notebooks/syncEngine.test.ts`

- [ ] **Step 1: Write failing persistence tests**

```ts
it("restores pending notebook edits after reload", async () => {
  await writePendingEdit({ itemId: "item-1", content: "offline draft" });
  const pending = await readPendingEdits("notebook-1");
  expect(pending).toHaveLength(1);
});
```

- [ ] **Step 2: Run the sync test file**

Run: `npm run test:frontend -- frontend/src/notebooks/syncEngine.test.ts`
Expected: FAIL because IndexedDB helpers do not exist.

- [ ] **Step 3: Implement IndexedDB helpers and setup polyfills**

```ts
export async function writePendingEdit(edit: PendingEditRecord): Promise<void> {
  const db = await openNotebookDb();
  await db.put("pending_edits", edit);
}
```

- [ ] **Step 4: Run the persistence tests**

Run: `npm run test:frontend -- frontend/src/notebooks/syncEngine.test.ts`
Expected: PASS for storing and restoring pending edits.

- [ ] **Step 5: Commit the IndexedDB layer**

```bash
git add frontend/src/notebooks/indexedDb.ts frontend/src/notebooks/syncEngine.test.ts frontend/src/test/setup.ts
git commit -m "feat: add notebook indexeddb persistence"
```

### Task 8: Implement autosave debounce, offline replay, and conflict UI state

**Files:**
- Create: `frontend/src/notebooks/syncEngine.ts`
- Modify: `frontend/src/notebooks/store.ts`
- Modify: `frontend/src/notebooks/NotebookStatusBar.tsx`
- Test: `frontend/src/notebooks/syncEngine.test.ts`
- Test: `frontend/src/notebooks/store.test.ts`

- [ ] **Step 1: Add failing tests for debounce and conflict transitions**

```ts
it("transitions to conflict when the server rejects a stale revision", async () => {
  remote.updateItem.mockRejectedValue(new Error("REVISION_CONFLICT"));
  await syncEngine.flushPendingEdits();
  expect(store.getState().syncState).toBe("conflict");
});
```

- [ ] **Step 2: Run the notebook sync test suite**

Run: `npm run test:frontend -- frontend/src/notebooks/syncEngine.test.ts frontend/src/notebooks/store.test.ts`
Expected: FAIL because the sync engine and conflict state machine are not implemented.

- [ ] **Step 3: Implement sync engine and wire it into the store**

```ts
if (!navigator.onLine) {
  setSyncState("offline");
  return;
}

try {
  const saved = await remoteNotebookStore.updateItem(payload);
  markPendingEditSynced(saved.id, saved.serverRevision);
  setSyncState("saved");
} catch (error) {
  if (isRevisionConflict(error)) {
    setSyncState("conflict");
    preserveConflictCopy(payload);
    return;
  }
  setSyncState("sync_failed");
}
```

- [ ] **Step 4: Run frontend tests and verify they pass**

Run: `npm run test:frontend`
Expected: PASS for notebook store and sync engine tests.

- [ ] **Step 5: Commit autosave and conflict handling**

```bash
git add frontend/src/notebooks/syncEngine.ts frontend/src/notebooks/store.ts frontend/src/notebooks/NotebookStatusBar.tsx frontend/src/notebooks/syncEngine.test.ts frontend/src/notebooks/store.test.ts
git commit -m "feat: add notebook autosave and conflict handling"
```

## Chunk 4: AI Integration, Docs, And End-To-End Verification

### Task 9: Add notebook-aware agent tools and API event shapes

**Files:**
- Create: `backend/app/agents/tools/notebook_tools.py`
- Create: `backend/tests/test_notebook_tools.py`
- Modify: `backend/app/agents/tools/__init__.py`
- Modify: `backend/app/api/routes/v1/agent.py`
- Test: `backend/tests/test_notebook_tools.py`

- [ ] **Step 1: Write failing backend tests for notebook item reads and writes**

```python
async def test_write_notebook_item_returns_updated_revision() -> None:
    result = await write_notebook_item(
        notebook_service=service,
        notebook_id=notebook.id,
        item_id=item.id,
        content="# updated",
        base_revision=1,
    )
    assert result["serverRevision"] == 2
```

- [ ] **Step 2: Run the agent tool tests**

Run: `uv run --project backend pytest backend/tests/test_notebook_tools.py -v`
Expected: FAIL because notebook-scoped tools are not available.

- [ ] **Step 3: Implement notebook tools and emit notebook item update events**

```python
yield sse_event(
    "notebook_item_updated",
    {
        "notebook_id": str(notebook_id),
        "item_id": str(item.id),
        "content": item.content,
        "server_revision": item.server_revision,
        "updated_at": item.updated_at.isoformat(),
    },
)
```

- [ ] **Step 4: Run notebook tool tests**

Run: `uv run --project backend pytest backend/tests/test_notebook_tools.py -v`
Expected: PASS.

- [ ] **Step 5: Commit backend AI integration**

```bash
git add backend/app/agents/tools/notebook_tools.py backend/app/agents/tools/__init__.py backend/app/api/routes/v1/agent.py backend/tests/test_notebook_tools.py
git commit -m "feat: add notebook agent tools"
```

### Task 10: Update the frontend AI provider to target the active notebook item

**Files:**
- Modify: `frontend/src/ai/provider.ts`
- Modify: `frontend/src/notebooks/store.ts`
- Modify: `frontend/src/shared/types.ts`
- Test: `frontend/src/notebooks/store.test.ts`

- [ ] **Step 1: Add a failing frontend test for AI-triggered item updates**

```ts
it("applies notebook item updates streamed by the agent", async () => {
  applyAgentEvent({
    type: "notebook_item_updated",
    data: { item_id: "item-1", content: "AI rewrite", server_revision: 3 },
  });
  expect(store.getState().activeItem?.content).toBe("AI rewrite");
});
```

- [ ] **Step 2: Run the targeted frontend tests**

Run: `npm run test:frontend -- frontend/src/notebooks/store.test.ts`
Expected: FAIL because the provider still speaks in workspace/doc-path terms.

- [ ] **Step 3: Update AI request payloads and streamed event handling**

```ts
const response = await fetch(`/api/v1/notebooks/${input.notebookId}/agent/runs`, {
  method: "POST",
  body: JSON.stringify({
    itemId: input.itemId,
    message: input.message,
    history: input.history,
  }),
});
```

- [ ] **Step 4: Run frontend tests and backend notebook slices**

Run: `npm run test:frontend`
Expected: PASS.

Run: `uv run --project backend pytest backend/tests/test_notebook_tools.py backend/tests/api/test_notebooks.py -v`
Expected: PASS.

- [ ] **Step 5: Commit notebook-aware AI wiring**

```bash
git add frontend/src/ai/provider.ts frontend/src/notebooks/store.ts frontend/src/shared/types.ts
git commit -m "feat: connect ai flows to notebook items"
```

### Task 11: Update planning docs and run end-to-end verification

**Files:**
- Modify: `docs/PLANS.md`
- Modify: `docs/product-specs/index.md`
- Modify: `docs/design-docs/validation-status.md`

- [ ] **Step 1: Document the active execution plan and validation status changes**

```md
- `exec-plans/active/notebook-new-save-and-sync.md`
  - Notebook creation, autosave, offline buffering, and conflict-safe sync
```

- [ ] **Step 2: Run static and automated verification**

Run: `npm run build`
Expected: PASS.

Run: `npm run test:frontend`
Expected: PASS.

Run: `uv run --project backend pytest backend/tests/api/test_notebooks.py backend/tests/test_notebook_service.py backend/tests/test_notebook_tools.py -v`
Expected: PASS.

- [ ] **Step 3: Run browser verification against the local app**

Run: `npm run dev`
Expected: Vite serves `http://localhost:5173`.

Run: `npm run dev:backend`
Expected: FastAPI serves `http://127.0.0.1:8000`.

Manual checks in Chrome MCP at `http://localhost:5173`:
- Create a notebook and confirm the seeded draft opens immediately.
- Edit the active item and confirm the footer cycles through `Saving...` to `Saved`.
- Simulate offline mode, continue editing, reload, and confirm the content restores from IndexedDB.
- Re-enable network and confirm sync returns to `Saved`.
- Trigger an AI rewrite and confirm the active notebook item updates without losing sync status.

- [ ] **Step 4: Commit docs and verification notes**

```bash
git add docs/PLANS.md docs/product-specs/index.md docs/design-docs/validation-status.md
git commit -m "docs: track notebook implementation plan"
```
