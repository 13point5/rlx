# Learnings

## React Query: Load More Pagination with SSR

Use `useInfiniteQuery` for "load more" patterns instead of manual state management.

### Client Component

```tsx
import { useInfiniteQuery } from "@tanstack/react-query";

const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = useInfiniteQuery({
  queryKey: ["items", filter],
  queryFn: async ({ pageParam }) => {
    const result = await fetchItems({ page: pageParam });
    return result.data; // { items: [], totalCount: number }
  },
  initialPageParam: 1,
  getNextPageParam: (lastPage, allPages) => {
    const loadedCount = allPages.reduce((sum, p) => sum + p.items.length, 0);
    return loadedCount < lastPage.totalCount ? allPages.length + 1 : undefined;
  },
});

// Flatten pages into single array
const items = data?.pages.flatMap((page) => page.items) || [];

// Load more button
<button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
  {isFetchingNextPage ? "Loading..." : "Load more"}
</button>
```

### Server Prefetch (SSR)

Use `prefetchInfiniteQuery` with matching structure:

```tsx
const queryClient = new QueryClient();

await queryClient.prefetchInfiniteQuery({
  queryKey: ["items", filter],
  queryFn: async ({ pageParam }) => fetchItems({ page: pageParam }),
  initialPageParam: 1,
});

return (
  <HydrationBoundary state={dehydrate(queryClient)}>
    <ItemList />
  </HydrationBoundary>
);
```

### Docs

- [Infinite Queries](https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries)
- [Paginated Queries](https://tanstack.com/query/v5/docs/framework/react/guides/paginated-queries)
