# Notebook And Item Rename Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add double-click rename for notebooks and items, and persist the new names through the notebook API and frontend store.

**Architecture:** Extend the backend notebook domain with a notebook-title update endpoint, reuse the existing item update endpoint for item-title changes, and add explicit rename actions in the frontend store. Keep rename as direct metadata requests instead of routing it through the autosave outbox so editor sync behavior stays unchanged.

**Tech Stack:** FastAPI, SQLAlchemy, React 19, Zustand, Vitest, React Testing Library, uv, npm

---

## File Structure

- Modify: `backend/app/repositories/notebook.py`
  - Add a focused repository helper for notebook title updates.
- Modify: `backend/app/services/notebook.py`
  - Add notebook rename business logic and keep item rename behavior explicit.
- Modify: `backend/app/schemas/notebook.py`
  - Add notebook update request schema.
- Modify: `backend/app/api/routes/v1/notebooks.py`
  - Expose notebook rename route.
- Modify: `backend/tests/test_notebook_service.py`
  - Cover notebook rename service behavior.
- Modify: `backend/tests/api/test_notebooks.py`
  - Cover notebook rename route behavior.
- Modify: `frontend/src/notebooks/types.ts`
  - Extend the remote store contract with notebook rename support.
- Modify: `frontend/src/notebooks/remoteNotebookStore.ts`
  - Add notebook rename request logic.
- Modify: `frontend/src/notebooks/store.ts`
  - Add `renameNotebook` and `renameItem` actions.
- Modify: `frontend/src/notebooks/store.test.ts`
  - Cover rename state updates.
- Modify: `frontend/src/notebooks/NotebookSidebar.tsx`
  - Implement inline rename UX for notebook and item titles.
- Modify: `frontend/src/app/App.tsx`
  - Pass rename handlers from the store into the sidebar.

## Chunk 1: Backend Notebook Rename

### Task 1: Add failing service and route tests for notebook rename

**Files:**
- Modify: `backend/tests/test_notebook_service.py`
- Modify: `backend/tests/api/test_notebooks.py`

- [ ] **Step 1: Write a failing service test for notebook rename**

```python
@pytest.mark.anyio
async def test_rename_notebook_updates_title(notebook_service: NotebookService) -> None:
    notebook = make_notebook(title="Old title")
    updated = make_notebook(notebook_id=notebook.id, title="New title")

    with patch("app.services.notebook.notebook_repo") as mock_repo:
        mock_repo.get_notebook_with_items = AsyncMock(side_effect=[notebook, updated])
        mock_repo.update_notebook = AsyncMock(return_value=updated)

        result = await notebook_service.update_notebook(notebook_id=notebook.id, title="New title")

    assert result.title == "New title"
```

- [ ] **Step 2: Write a failing API test for notebook rename**

```python
@pytest.mark.anyio
async def test_update_notebook_title(client_with_mock_notebook_service: AsyncClient) -> None:
    notebook_id = uuid4()
    response = await client_with_mock_notebook_service.patch(
        f"{settings.API_V1_STR}/notebooks/{notebook_id}",
        json={"title": "Renamed notebook"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Renamed notebook"
```

- [ ] **Step 3: Run the targeted backend tests and confirm they fail**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py backend/tests/api/test_notebooks.py -k "rename or update_notebook_title" -v`
Expected: FAIL because notebook rename helpers and route schema do not exist yet.

### Task 2: Implement notebook rename in repository, service, schema, and route

**Files:**
- Modify: `backend/app/repositories/notebook.py`
- Modify: `backend/app/services/notebook.py`
- Modify: `backend/app/schemas/notebook.py`
- Modify: `backend/app/api/routes/v1/notebooks.py`

- [ ] **Step 1: Add the notebook update schema**

```python
class NotebookUpdate(BaseSchema):
    title: str = Field(min_length=1, max_length=255)
```

- [ ] **Step 2: Add the repository helper**

```python
async def update_notebook(db: AsyncSession, *, notebook: Notebook, title: str) -> Notebook:
    notebook.title = title
    db.add(notebook)
    await db.flush()
    await db.refresh(notebook)
    return notebook
```

- [ ] **Step 3: Add the service method**

```python
async def update_notebook(self, *, notebook_id: UUID, title: str) -> Notebook:
    notebook = await self._get_notebook(notebook_id)
    updated = await notebook_repo.update_notebook(self.db, notebook=notebook, title=title)
    await self.db.commit()
    return updated
```

- [ ] **Step 4: Add the route**

```python
@router.patch("/{notebook_id}", response_model=NotebookRead)
async def update_notebook(...):
    return await notebook_service.update_notebook(notebook_id=notebook_id, title=payload.title)
```

- [ ] **Step 5: Run the targeted backend tests and confirm they pass**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py backend/tests/api/test_notebooks.py -k "rename or update_notebook_title" -v`
Expected: PASS

## Chunk 2: Frontend Store Rename Actions

### Task 3: Add failing store tests for notebook and item rename

**Files:**
- Modify: `frontend/src/notebooks/store.test.ts`
- Modify: `frontend/src/notebooks/types.ts`

- [ ] **Step 1: Write a failing store test for notebook rename**

```typescript
it("renames the active notebook and updates the notebook list", async () => {
  const notebook = makeNotebook("nb-1", "item-1");
  const remoteStore: NotebookStoreApi = {
    ...baseRemoteStore,
    listNotebooks: async () => [notebook],
    updateNotebook: async () => ({ ...notebook, title: "Renamed notebook" }),
  };

  const store = createNotebookStore(remoteStore);
  await store.getState().loadNotebooks();
  await store.getState().renameNotebook("nb-1", "Renamed notebook");

  expect(store.getState().activeNotebook?.title).toBe("Renamed notebook");
});
```

- [ ] **Step 2: Write a failing store test for item rename**

```typescript
it("renames the active item and updates the active notebook", async () => {
  const notebook = makeNotebook("nb-1", "item-1");
  const renamedItem = { ...notebook.items[0], title: "Renamed draft" };
  const remoteStore: NotebookStoreApi = {
    ...baseRemoteStore,
    listNotebooks: async () => [notebook],
    updateItem: async () => renamedItem,
  };

  const store = createNotebookStore(remoteStore);
  await store.getState().loadNotebooks();
  await store.getState().renameItem("item-1", "Renamed draft");

  expect(store.getState().activeItem?.title).toBe("Renamed draft");
});
```

- [ ] **Step 3: Run the targeted frontend store tests and confirm they fail**

Run: `npm test -- --run frontend/src/notebooks/store.test.ts`
Expected: FAIL because the rename actions and remote contract do not exist yet.

### Task 4: Implement rename actions in the frontend store

**Files:**
- Modify: `frontend/src/notebooks/types.ts`
- Modify: `frontend/src/notebooks/remoteNotebookStore.ts`
- Modify: `frontend/src/notebooks/store.ts`

- [ ] **Step 1: Extend the remote store contract**

```typescript
updateNotebook(input: { notebookId: string; title: string }): Promise<NotebookRecord>;
```

- [ ] **Step 2: Implement the notebook rename request**

```typescript
async updateNotebook(input) {
  const notebook = await requestJson(...);
  return toNotebook(notebook);
}
```

- [ ] **Step 3: Add store actions for notebook and item rename**

```typescript
async renameNotebook(notebookId, title) { ... }
async renameItem(itemId, title) { ... }
```

- [ ] **Step 4: Keep rename outside the autosave queue**

```typescript
// Rename uses direct metadata updates and should not enqueue content sync work.
```

- [ ] **Step 5: Run the targeted frontend store tests and confirm they pass**

Run: `npm test -- --run frontend/src/notebooks/store.test.ts`
Expected: PASS

## Chunk 3: Sidebar Inline Rename UX

### Task 5: Add failing sidebar tests for double-click rename behavior

**Files:**
- Create or Modify: `frontend/src/notebooks/NotebookSidebar.test.tsx`

- [ ] **Step 1: Write a failing test for notebook double-click rename**

```tsx
it("enters notebook rename mode on double click and submits on Enter", async () => {
  render(<NotebookSidebar ... />);
  await user.dblClick(screen.getByText("Untitled notebook"));
  await user.keyboard("Renamed notebook{Enter}");
  expect(onRenameNotebook).toHaveBeenCalledWith("nb-1", "Renamed notebook");
});
```

- [ ] **Step 2: Write a failing test for item rename cancel**

```tsx
it("cancels item rename on Escape", async () => {
  render(<NotebookSidebar ... />);
  await user.dblClick(screen.getByText("Untitled"));
  await user.keyboard("Draft v2{Escape}");
  expect(onRenameItem).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run the targeted sidebar tests and confirm they fail**

Run: `npm test -- --run frontend/src/notebooks/NotebookSidebar.test.tsx`
Expected: FAIL because inline rename UI does not exist yet.

### Task 6: Implement inline rename in the sidebar and wire the app

**Files:**
- Modify: `frontend/src/notebooks/NotebookSidebar.tsx`
- Modify: `frontend/src/app/App.tsx`

- [ ] **Step 1: Add rename handler props to the sidebar**

```typescript
onRenameNotebook: (notebookId: string, title: string) => Promise<void>;
onRenameItem: (itemId: string, title: string) => Promise<void>;
```

- [ ] **Step 2: Add notebook inline rename state and submission logic**

```typescript
const [editingNotebookId, setEditingNotebookId] = useState<string | null>(null);
```

- [ ] **Step 3: Add item inline rename state and submission logic**

```typescript
const [editingItemId, setEditingItemId] = useState<string | null>(null);
```

- [ ] **Step 4: Implement keyboard and blur handling**

```typescript
if (event.key === "Enter") submitRename();
if (event.key === "Escape") cancelRename();
```

- [ ] **Step 5: Wire the app to call store rename actions and show alerts on failure**

```typescript
onRenameNotebook={(id, title) => renameNotebook(id, title)}
onRenameItem={(id, title) => renameItem(id, title)}
```

- [ ] **Step 6: Run the targeted sidebar tests and confirm they pass**

Run: `npm test -- --run frontend/src/notebooks/NotebookSidebar.test.tsx`
Expected: PASS

## Chunk 4: Verification And Docs

### Task 7: Run focused regression coverage

**Files:**
- Modify: `docs/design-docs/index.md`
- Modify: `docs/QUALITY_SCORE.md`

- [ ] **Step 1: Add the new rename design doc to the design index**

```markdown
- `../superpowers/specs/2026-03-16-notebook-item-rename-design.md`
  - notebook 与 item 双击重命名设计
```

- [ ] **Step 2: Update quality notes if this exposes a resolved UX gap**

```markdown
- notebook / item 元数据编辑能力从缺失提升为已覆盖
```

- [ ] **Step 3: Run backend rename tests**

Run: `uv run --project backend pytest backend/tests/test_notebook_service.py backend/tests/api/test_notebooks.py -v`
Expected: PASS

- [ ] **Step 4: Run frontend notebook tests**

Run: `npm test -- --run frontend/src/notebooks/store.test.ts frontend/src/notebooks/NotebookSidebar.test.tsx`
Expected: PASS

- [ ] **Step 5: Run one broader frontend regression file**

Run: `npm test -- --run frontend/src/notebooks/syncEngine.test.ts`
Expected: PASS, confirming rename work did not break sync behavior.
