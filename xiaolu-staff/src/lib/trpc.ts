import { createTRPCReact } from '@trpc/react-query';

// Keep the original short identifier: the recovered pages call `qe.meta.bootstrap.useQuery(...)`.
export const qe = createTRPCReact<any>();
