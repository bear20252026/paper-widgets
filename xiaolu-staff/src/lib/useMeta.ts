// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import { qe } from '@/compat';

// gs()：拉取 meta.bootstrap（老师/教室/课程），并返回按 id 查找的辅助函数。

function gs() {
  const t = qe.meta.bootstrap.useQuery(void 0, {
    staleTime: 6e4
  });
  return b.useMemo(() => {
    const a = t.data ?? {
      teachers: [],
      rooms: [],
      courses: []
    };
    return {
      ...a,
      isLoading: t.isLoading,
      teacher: r => a.teachers.find(l => l.id === r),
      room: r => a.rooms.find(l => l.id === r),
      course: r => a.courses.find(l => l.id === r)
    };
  }, [t.data, t.isLoading]);
}
export { gs };
