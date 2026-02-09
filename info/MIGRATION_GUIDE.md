# State Management Migration Guide

This guide details the changes made to the application state management (Step 2) and how to adapt existing components.

## Overview

The `appStore` has been refactored to support a more robust task-based generation system using `Zustand` and `persist` middleware.

## Key Changes

### 1. Store Structure (`src/store/appStore.ts`)

- **New Properties**:
  - `tasks`: Array of `GenerationTask` objects. Tracks all generation requests.
  - `addTask(task)`: Method to add a new task.
  - `updateTaskStatus(id, status, result)`: Method to update task progress.
  - `deductCredits(amount)`: Method to handle credit deduction with global event triggering.

- **Deprecated/Removed Properties**:
  - `isGenerating`: **Removed**. Use derived state instead.
  - `setIsGenerating`: **Removed**.
  - `generatedImages`: **Removed**. Replaced by `tasks`.
  - `addGeneratedImage`: **Removed**. Use `addTask` and `updateTaskStatus`.
  - `clearGeneratedImages`: **Removed**.
  - `useCredit`: **Renamed** to `deductCredits`.

### 2. Migration Examples

#### Checking Generation Status

**Old:**
```typescript
const { isGenerating } = useAppStore();
```

**New:**
```typescript
const { tasks } = useAppStore();
const isGenerating = tasks.some(t => t.status === 'processing');
```

#### Starting a Generation

**Old:**
```typescript
setIsGenerating(true);
const response = await api.generate(...);
addGeneratedImage(response.image);
setIsGenerating(false);
```

**New:**
```typescript
const task = { id: Date.now().toString(), status: 'processing', ... };
addTask(task);

try {
  const response = await api.generate(...);
  updateTaskStatus(task.id, 'success', { images: response.images });
} catch (e) {
  updateTaskStatus(task.id, 'failed', e.message);
}
```

#### Displaying Images

**Old:**
```typescript
const { generatedImages } = useAppStore();
// generatedImages is GeneratedImage[]
```

**New:**
```typescript
const { tasks } = useAppStore();
const images = tasks
  .filter(t => t.status === 'success' && t.result)
  .flatMap(t => t.result.images);
```

#### Credit Deduction

**Old:**
```typescript
if (!useCredit(10)) return;
```

**New:**
```typescript
if (!deductCredits(10)) return;
// Note: deductCredits automatically triggers 'credit-insufficient' window event if failed.
```

### 3. Persistence

The store now persists `tasks`, `credits`, `activeTags`, and `uploadedImages` to `localStorage` under the key `app-storage`.
Tasks are automatically limited to the latest 50 entries to prevent storage overflow.
