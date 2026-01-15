---
description: Create a new frontend feature using components, hooks, and pages.
---

# Create Frontend Feature

Follow this workflow to add a new UI feature to the Next.js frontend.

## 1. Design & Components
Identify the UI primitives needed.
*   **Path**: `src/components/feature-name/`
*   **Action**: Create functional components.
*   **Style**: Use `shadcn/ui` primitives or Tailwind classes. **No custom CSS files**.

## 2. State & Logic (Hook/Store)
If the feature has complex state:
*   **Local**: Create a custom hook `src/hooks/useFeatureName.ts`.
*   **Global**: Create a Zustand store `src/stores/featureNameStore.ts`.
*   **Data Fetching**: Use `useQuery` or `useMutation` from `@tanstack/react-query`.

## 3. Page Implementation
Expose the feature via a route.
*   **Path**: `src/app/feature-name/page.tsx`
*   **Content**: Assemble components here. Fetch data on the server (Server Components) if possible, or dehydrate state for client.

## 4. Integration
*   **API**: Add service methods in `src/services/featureNameApi.ts`.
*   **Auth**: Ensure `credentials: 'include'` is set for all requests.

## 5. Verification
*   **Lint**: `pnpm lint` to check for unused variables or hook dependency issues.
*   **Type Check**: `pnpm type-check`.
