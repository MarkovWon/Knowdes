# Feature Design: NotebookLM Integration

## 1. Overview
The goal is to allow users to save their generated knowledge graphs, learning paths, and detailed action plans into their Google NotebookLM account. This enables users to use NotebookLM's RAG (Retrieval-Augmented Generation) capabilities to chat with their custom learning curriculum.

## 2. Constraints & Technical Strategy
**Constraint:** Currently, Google NotebookLM does not provide a public API that allows third-party applications to directly create notebooks or write notes into a specific notebook programmatically.

**Solution: "Optimized Source Export" Workflow**
Instead of a direct API write, we implement an export workflow designed to generate high-quality "Source" files that NotebookLM can ingest perfectly.

1.  **Data Aggregation**: The app aggregates the current state of the Knowledge Graph (nodes, relationships, descriptions) and any detailed Action Plans generated for specific concepts.
2.  **Structured Formatting**: This data is formatted into a clean, hierarchical Markdown text structure.
3.  **User Action**: The user downloads this text file (or copies it) and uploads it as a "Source" to their Notebook in NotebookLM.

## 3. UI/UX Specification

### 3.1 Entry Point
*   **Location**: Top navigation bar, next to the "Import/Export" buttons.
*   **Icon**: A "Notebook" or "Book" icon.
*   **State**: Disabled if no graph has been generated yet.

### 3.2 The Integration Modal (`NotebookLMModal`)
When the button is clicked, a modal overlay appears with the following elements:

*   **Header**: Title "Export to NotebookLM" with a brief explanation of the manual integration step due to API limitations.
*   **Preview Area**: A read-only text area showing the generated content. This allows the user to verify what will be saved.
*   **Actions**:
    *   **Link**: "Open NotebookLM" (opens `https://notebooklm.google.com/` in a new tab).
    *   **Primary Button 1**: "Download .txt Source". Downloads a file named `{topic}-notebook-source.txt`.
    *   **Primary Button 2**: "Copy as Source". Copies the text to the clipboard for quick pasting.

## 4. Data Structure (The "Source" File)
The generated text file follows this Markdown structure to maximize NotebookLM's understanding:

```markdown
# Knowledge Graph: {Topic Name}
**User Status/Level:** {User Status}

## Concept Overview
(List of all nodes grouped by their category)
### {Group Name}
- **{Node Name}**: {Node Description}

---

## Deep Dive: {Selected Node Name}
(If a node is selected and has a generated plan)
**Context:** Part of {Group Name}

### Learning Action Plan
{Markdown content of the action plan}

### Verified Sources
- [{Title}]({URI})
```

## 5. Technical Implementation Components

### 5.1 `NotebookLMModal.tsx`
A new React component responsible for:
*   Receiving `graphData`, `selectedNode`, and `plan` as props.
*   Formatting these props into the string described in Section 4.
*   Handling clipboard interactions and file blob generation for downloads.

### 5.2 `App.tsx` Updates
*   New state: `showNotebookModal` (boolean).
*   New header button to toggle this state.
*   Passing current application state (graph data, etc.) to the modal.

## 6. Future Roadmap
Once a write-access API for NotebookLM becomes available, this feature will be upgraded to:
1.  OAuth 2.0 flow to authorize access to the user's Drive/Notebooks.
2.  Dropdown to select a specific Notebook.
3.  "One-click Save" to push the content directly without file handling.
