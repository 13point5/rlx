# Learnings

## Node.js Ed25519 SSH Key Generation

Generate Ed25519 SSH key pairs in Node.js and convert to OpenSSH format:

```typescript
import { generateKeyPairSync, createPublicKey } from "crypto";

// Generate key pair in PEM format
const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

// Convert PEM to OpenSSH format for public key
const keyObject = createPublicKey(publicKey);
const sshPublicKey = keyObject.export({ type: "spki", format: "der" });

// Ed25519 public key in OpenSSH format
// Skip the 12-byte SPKI header for Ed25519 keys
const keyData = sshPublicKey.subarray(12);
const opensshPublicKey = `ssh-ed25519 ${keyData.toString("base64")} comment`;
```

**Key points:**
- `generateKeyPairSync` produces PEM format by default
- OpenSSH format requires extracting the raw key data from the SPKI DER encoding
- The SPKI header for Ed25519 keys is 12 bytes
- Private key in PKCS8 PEM format is compatible with most SSH clients

## AWS Secrets Manager: Force Delete Without Recovery

When deleting secrets that don't need a recovery window:

```python
client.delete_secret(
    SecretId=secret_arn,
    ForceDeleteWithoutRecovery=True,  # Immediately delete, no 7-30 day wait
)
```

**Key points:**
- By default, deleted secrets have a 7-30 day recovery period
- Use `ForceDeleteWithoutRecovery=True` when the secret should be immediately deleted
- Useful for user-generated secrets that shouldn't be recoverable

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
