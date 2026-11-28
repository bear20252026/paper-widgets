// A tRPC link that runs the whole mock router in the browser.
// The shelf serves static files only, so there is no HTTP backend to call: each operation
// goes straight to the router's caller and comes back through the client's normal error path.
import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import { createCaller } from './mockRouter';

export const localLink = (): TRPCLink<any> => () => ({ op }) =>
  observable((observer) => {
    (async () => {
      try {
        let node: any = createCaller({});
        for (const part of op.path.split('.')) node = node?.[part];
        if (typeof node !== 'function') throw new Error(`Unknown procedure: ${op.path}`);
        const data = await node(op.input);
        observer.next({ result: { data } });
        observer.complete();
      } catch (cause) {
        observer.error(TRPCClientError.from(cause as any));
      }
    })();

    return () => {};
  });
