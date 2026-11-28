import { initTRPC, TRPCError } from '@trpc/server';

/* ------------------------------------------------------------------ *
 * In-memory mock backend for the recovered 小鹿美术 staff app.
 * It reproduces the 19 tRPC procedures the UI calls, including
 * scheduling conflict detection and attendance-driven hour deduction.
 * ------------------------------------------------------------------ */

type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface Teacher { id: number; name: string; specialty: string; bio: string; avatarSeed: number }
interface Room { id: number; name: string; capacity: number; note: string }
interface Course { id: number; name: string; color: string; ageRange: string; capacity: number }
interface Slot {
  id: number; courseId: number; teacherId: number; roomId: number;
  weekday: Weekday; startMin: number; endMin: number; capacity: number; studentIds: number[];
}
interface Student {
  id: number; name: string; nickname: string | null; age: number; gender: 'girl' | 'boy';
  avatarSeed: number; slotIds: number[];
  balance: { purchased: number; used: number; remaining: number };
  enrollment: 'first' | 'renewal';
  parentName: string | null; parentPhone: string | null; note: string | null;
  joinedAt?: string;
}
interface Artwork { id: number; studentId: number; title: string; imageUrl: string; courseId: number | null; createdAt: string }
type AttendanceStatus = 'present' | 'leave' | 'absent';

const teachers: Teacher[] = [
  { id: 1, name: '林', specialty: '创意水彩 · 色彩启蒙', bio: '陪孩子把颜色玩出故事，擅长让慢热的小朋友先爱上画纸。', avatarSeed: 11 },
  { id: 2, name: '周', specialty: '素描基础 · 造型进阶', bio: '把结构讲成小游戏，重视观察力，也重视画室里的大笑。', avatarSeed: 22 },
  { id: 3, name: '鹿', specialty: '启蒙涂鸦 · 综合材料', bio: '画室创办人，相信每一笔涂鸦都值得被认真贴到墙上。', avatarSeed: 33 },
];

const rooms: Room[] = [
  { id: 1, name: '阳光教室', capacity: 8, note: '朝南大窗，适合水彩与静物写生。' },
  { id: 2, name: '彩虹教室', capacity: 10, note: '长桌与材料墙，涂鸦和综合材料都够用。' },
];

const courses: Course[] = [
  { id: 1, name: '启蒙涂鸦', color: '#FFB5C8', ageRange: '3–5 岁', capacity: 6 },
  { id: 2, name: '创意水彩', color: '#A9DAF5', ageRange: '6–9 岁', capacity: 8 },
  { id: 3, name: '素描基础', color: '#B5E8C8', ageRange: '9–13 岁', capacity: 8 },
  { id: 4, name: '综合材料', color: '#FFCF9E', ageRange: '5–8 岁', capacity: 10 },
];

const slots: Slot[] = [
  { id: 1, courseId: 2, teacherId: 1, roomId: 1, weekday: 1, startMin: 990, endMin: 1080, capacity: 8, studentIds: [1, 3, 5] },
  { id: 2, courseId: 1, teacherId: 3, roomId: 2, weekday: 2, startMin: 990, endMin: 1080, capacity: 6, studentIds: [2, 5] },
  { id: 3, courseId: 3, teacherId: 2, roomId: 1, weekday: 3, startMin: 990, endMin: 1080, capacity: 8, studentIds: [6, 8] },
  { id: 4, courseId: 2, teacherId: 1, roomId: 2, weekday: 4, startMin: 990, endMin: 1080, capacity: 8, studentIds: [1, 2, 4] },
  { id: 5, courseId: 4, teacherId: 3, roomId: 1, weekday: 5, startMin: 990, endMin: 1080, capacity: 10, studentIds: [3, 5, 7] },
  { id: 6, courseId: 1, teacherId: 3, roomId: 2, weekday: 6, startMin: 570, endMin: 660, capacity: 6, studentIds: [2, 5, 7] },
  { id: 7, courseId: 2, teacherId: 1, roomId: 1, weekday: 6, startMin: 840, endMin: 930, capacity: 8, studentIds: [1, 3, 4] },
  { id: 8, courseId: 3, teacherId: 2, roomId: 2, weekday: 6, startMin: 960, endMin: 1050, capacity: 8, studentIds: [6, 8] },
  { id: 9, courseId: 4, teacherId: 3, roomId: 1, weekday: 7, startMin: 600, endMin: 690, capacity: 10, studentIds: [2, 4, 7] },
  { id: 10, courseId: 1, teacherId: 3, roomId: 2, weekday: 3, startMin: 600, endMin: 690, capacity: 6, studentIds: [1, 5] },
  { id: 11, courseId: 3, teacherId: 2, roomId: 1, weekday: 5, startMin: 600, endMin: 690, capacity: 8, studentIds: [6] },
  { id: 12, courseId: 4, teacherId: 1, roomId: 2, weekday: 2, startMin: 1110, endMin: 1200, capacity: 10, studentIds: [4, 8] },
];

const students: Student[] = [
  { id: 1, name: '朵朵', nickname: '朵朵', age: 5, gender: 'girl', avatarSeed: 101, slotIds: [], balance: { purchased: 40, used: 12, remaining: 28 }, enrollment: 'renewal', parentName: '朵妈', parentPhone: '13800001111', note: '喜欢粉色和兔子，画画像在讲故事。' },
  { id: 2, name: '小满', nickname: '满满', age: 7, gender: 'boy', avatarSeed: 102, slotIds: [], balance: { purchased: 20, used: 18, remaining: 2 }, enrollment: 'first', parentName: '满爸', parentPhone: '13800002222', note: '快要续课啦，最近迷上画恐龙。' },
  { id: 3, name: '果果', nickname: '果果', age: 6, gender: 'girl', avatarSeed: 103, slotIds: [], balance: { purchased: 20, used: 20, remaining: 0 }, enrollment: 'renewal', parentName: '果果妈妈', parentPhone: '13800003333', note: '课时已用完，需要提醒续费。' },
  { id: 4, name: '皮皮', nickname: '皮皮', age: 8, gender: 'boy', avatarSeed: 104, slotIds: [], balance: { purchased: 40, used: 10, remaining: 30 }, enrollment: 'renewal', parentName: '皮爸', parentPhone: '13800004444', note: '坐不住但下笔很勇敢，适合大幅创作。' },
  { id: 5, name: '米娅', nickname: '米娅', age: 4, gender: 'girl', avatarSeed: 105, slotIds: [], balance: { purchased: 20, used: 8, remaining: 12 }, enrollment: 'first', parentName: '米娅妈妈', parentPhone: '13800005555', note: '第一次离开妈妈上课，需要多鼓励。' },
  { id: 6, name: '阿泽', nickname: '泽泽', age: 9, gender: 'boy', avatarSeed: 106, slotIds: [], balance: { purchased: 40, used: 22, remaining: 18 }, enrollment: 'renewal', parentName: '泽爸', parentPhone: '13800006666', note: '素描进步很快，可以尝试静物写生。' },
  { id: 7, name: '糖糖', nickname: '糖糖', age: 6, gender: 'girl', avatarSeed: 107, slotIds: [], balance: { purchased: 20, used: 5, remaining: 15 }, enrollment: 'first', parentName: '糖糖爸爸', parentPhone: '13800007777', note: '喜欢亮片和闪光笔。' },
  { id: 8, name: '乐乐', nickname: '乐乐', age: 10, gender: 'boy', avatarSeed: 108, slotIds: [], balance: { purchased: 40, used: 30, remaining: 10 }, enrollment: 'renewal', parentName: '乐乐妈妈', parentPhone: '13800008888', note: '准备作品集，适合综合材料课。' },
];

for (const student of students) {
  student.slotIds = slots.filter((slot) => slot.studentIds.includes(student.id)).map((slot) => slot.id);
}

let artworks: Artwork[] = [
  { id: 1, studentId: 1, title: '会飞的房子', imageUrl: './manus-storage/async-images/NJz9ehQ5Zw3HDb7y9LxxAJ/image-2.webp', courseId: 2, createdAt: '2026-10-18T09:20:00.000Z' },
  { id: 2, studentId: 1, title: '兔子一家', imageUrl: './manus-storage/async-images/NJz9ehQ5Zw3HDb7y9LxxAJ/image-3.webp', courseId: 1, createdAt: '2026-11-01T10:05:00.000Z' },
  { id: 3, studentId: 3, title: '彩虹雨', imageUrl: './manus-storage/async-images/NJz9ehQ5Zw3HDb7y9LxxAJ/image-4.webp', courseId: 2, createdAt: '2026-10-25T14:40:00.000Z' },
];

// Attendance: slotId|date -> studentId -> status
const attendance = new Map<string, Map<number, AttendanceStatus>>();

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

// Seed one past/current Saturday so the week view and roll-call screen already show data.
const now = new Date();
const saturday = addDays(now, (6 - (now.getDay() || 7) + 7) % 7);
attendance.set(`6|${localDate(saturday)}`, new Map([[2, 'present'], [5, 'present'], [7, 'leave']]));
attendance.set(`7|${localDate(saturday)}`, new Map([[1, 'present'], [3, 'absent'], [4, 'present']]));

const slotById = (id: number) => slots.find((slot) => slot.id === Number(id));
const studentById = (id: number) => students.find((student) => student.id === Number(id));
const courseById = (id: number) => courses.find((course) => course.id === Number(id));

const appError = (code: string, params: Record<string, any> = {}) =>
  new TRPCError({ code: 'BAD_REQUEST', message: JSON.stringify({ type: 'app-error', code, params }) });

function slotConflicts(candidate: Partial<Slot> & { id?: number }) {
  const conflicts: Array<{ aId: number; bId: number; kinds: string[]; sharedStudentIds: number[] }> = [];
  for (const other of slots) {
    if (candidate.id && other.id === candidate.id) continue;
    if (other.weekday !== candidate.weekday) continue;
    const overlap = (candidate.startMin ?? 0) < other.endMin && other.startMin < (candidate.endMin ?? 0);
    if (!overlap) continue;
    const kinds: string[] = [];
    if (other.teacherId === candidate.teacherId) kinds.push('teacher');
    if (other.roomId === candidate.roomId) kinds.push('room');
    const shared = (candidate.studentIds ?? []).filter((id) => other.studentIds.includes(id));
    if (shared.length) kinds.push('student');
    if (kinds.length) conflicts.push({ aId: other.id, bId: candidate.id ?? -1, kinds, sharedStudentIds: shared });
  }
  return conflicts;
}

function validateSlotData(data: any) {
  const course = courseById(Number(data.courseId));
  if (!course) throw appError('courseMissing');
  if (!teachers.some((teacher) => teacher.id === Number(data.teacherId))) throw appError('teacherMissing');
  const room = rooms.find((item) => item.id === Number(data.roomId));
  if (!room) throw appError('roomMissing');
  if (Number(data.endMin) <= Number(data.startMin)) throw appError('endBeforeStart');
  if (Number(data.weekday) < 1 || Number(data.weekday) > 7) throw appError('endBeforeStart');
  const capacity = Number(data.capacity ?? course.capacity);
  if (capacity > room.capacity) throw appError('roomCapacity', { room: room.name, capacity: room.capacity });
  const ids = data.studentIds ?? [];
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw appError('duplicateStudents');
  if (ids.some((id: number) => !studentById(id))) throw appError('unknownStudent');
  if (ids.length > capacity) throw appError('overCapacity', { capacity });
  return { course, room, capacity, studentIds: ids.map(Number) };
}

function syncStudentSlots() {
  for (const student of students) {
    student.slotIds = slots.filter((slot) => slot.studentIds.includes(student.id)).map((slot) => slot.id);
  }
}

function studentView(student: Student) {
  const joinedAt = student.joinedAt ?? new Date(2026, 1 + (student.id % 7), 3).toISOString();
  return {
    ...student,
    joinedAt,
    balance: { ...student.balance },
    recentWorks: artworks.filter((artwork) => artwork.studentId === student.id).slice(-3),
  };
}

/* ------------------------------- tRPC ------------------------------- */

const t = initTRPC.create({ isServer: true, allowOutsideOfServer: true });
const proc = t.procedure.input((value: unknown) => value as any);

export const appRouter = t.router({
  meta: t.router({
    bootstrap: proc.query(() => ({ teachers, rooms, courses })),
    staff: proc.query(() =>
      slots.map((slot) => ({
        teacherId: slot.teacherId,
        courseId: slot.courseId,
        roomId: slot.roomId,
        weekday: slot.weekday,
        startMin: slot.startMin,
        endMin: slot.endMin,
        count: slot.studentIds.length,
      })),
    ),
  }),
  today: t.router({
    get: proc.query(({ input }: any) => {
      const weekday = Number(input?.weekday);
      const date = String(input?.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw appError('dateInvalid');
      return slots
        .filter((slot) => slot.weekday === weekday)
        .sort((a, b) => a.startMin - b.startMin)
        .map((slot) => {
          const records = attendance.get(`${slot.id}|${date}`);
          return {
            ...slot,
            students: slot.studentIds.map((id) => studentView(studentById(id)!)).filter(Boolean),
            attendance: records
              ? [...records.entries()].filter(([, status]) => status).map(([studentId, status]) => ({ studentId, status }))
              : [],
          };
        });
    }),
  }),
  schedule: t.router({
    list: proc.query(() =>
      slots
        .slice()
        .sort((a, b) => a.weekday - b.weekday || a.startMin - b.startMin)
        .map((slot) => ({ ...slot, capacity: slot.capacity ?? courseById(slot.courseId)?.capacity ?? 8, studentIds: [...slot.studentIds] })),
    ),
    weekAttendance: proc.query(({ input }: any) => {
      const dates: string[] = input?.dates ?? [];
      const result: Array<{ slotId: number; date: string }> = [];
      for (const date of dates) {
        for (const [key, records] of attendance) {
          const [slotId, recordDate] = key.split('|');
          if (recordDate === date && records.size > 0) result.push({ slotId: Number(slotId), date });
        }
      }
      return result;
    }),
    create: proc.mutation(({ input }: any) => {
      const data = input?.data ?? {};
      const validated = validateSlotData(data);
      const candidate = { ...data, ...validated, id: -1 };
      const conflicts = slotConflicts(candidate as any);
      if (conflicts.length && !input?.force) {
        throw new TRPCError({ code: 'CONFLICT', message: JSON.stringify({ type: 'slot-conflict', conflicts }) });
      }
      const id = Math.max(0, ...slots.map((slot) => slot.id)) + 1;
      const slot: Slot = {
        id,
        courseId: validated.course.id,
        teacherId: Number(data.teacherId),
        roomId: Number(data.roomId),
        weekday: Number(data.weekday) as Weekday,
        startMin: Number(data.startMin),
        endMin: Number(data.endMin),
        capacity: validated.capacity,
        studentIds: validated.studentIds,
      };
      slots.push(slot);
      syncStudentSlots();
      return slot;
    }),
    update: proc.mutation(({ input }: any) => {
      const slot = slotById(input?.id);
      if (!slot) throw appError('slotMissing');
      const data = input?.data ?? {};
      const validated = validateSlotData(data);
      const conflicts = slotConflicts({ ...slot, ...data, ...validated, id: slot.id } as any);
      if (conflicts.length && !input?.force) {
        throw new TRPCError({ code: 'CONFLICT', message: JSON.stringify({ type: 'slot-conflict', conflicts }) });
      }
      Object.assign(slot, {
        courseId: validated.course.id,
        teacherId: Number(data.teacherId),
        roomId: Number(data.roomId),
        weekday: Number(data.weekday) as Weekday,
        startMin: Number(data.startMin),
        endMin: Number(data.endMin),
        capacity: validated.capacity,
        studentIds: validated.studentIds,
      });
      syncStudentSlots();
      return slot;
    }),
    remove: proc.mutation(({ input }: any) => {
      const slot = slotById(input?.id);
      if (!slot) throw appError('slotMissing');
      const index = slots.indexOf(slot);
      slots.splice(index, 1);
      syncStudentSlots();
      return { ok: true };
    }),
  }),
  students: t.router({
    list: proc.query(() => students.map(studentView)),
    get: proc.query(({ input }: any) => {
      const student = studentById(input?.id);
      if (!student) throw appError('studentMissing');
      const history: any[] = [];
      for (const [key, records] of attendance) {
        const status = records.get(student.id);
        if (!status) continue;
        const [slotId, date] = key.split('|');
        const slot = slotById(Number(slotId));
        history.push({
          id: `${slotId}-${date}`,
          slotId: Number(slotId),
          date,
          courseId: slot?.courseId ?? null,
          status,
          hoursDeducted: status === 'present' ? 1 : 0,
        });
      }
      history.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      return {
        ...studentView(student),
        packages: Array.from({ length: Math.round(student.balance.purchased / 20) }, (_, index) => ({
          id: student.id * 10 + index + 1,
          purchasedAt: index === 0 ? '2026-08-15T00:00:00.000Z' : '2026-10-20T00:00:00.000Z',
          hours: 20,
          priceCents: 40000,
          note: index === 0 ? 'First enrollment' : 'Renewal',
        })),
        attendance: history,
        artworks: artworks.filter((artwork) => artwork.studentId === student.id),
      };
    }),
    create: proc.mutation(({ input }: any) => {
      const data = input?.data ?? {};
      if (!data.name || !String(data.name).trim()) throw appError('nameRequired');
      const id = Math.max(0, ...students.map((student) => student.id)) + 1;
      const purchased = input?.withPackage ? 20 : 0;
      const student: Student = {
        id,
        name: String(data.name).trim(),
        nickname: data.nickname ?? null,
        age: Number(data.age ?? 6),
        gender: data.gender === 'boy' ? 'boy' : 'girl',
        avatarSeed: 100 + id * 7,
        slotIds: [],
        balance: { purchased, used: 0, remaining: purchased },
        enrollment: 'first',
        parentName: data.parentName ?? null,
        parentPhone: data.parentPhone ?? null,
        note: data.note ?? null,
      };
      students.push(student);
      return student;
    }),
    update: proc.mutation(({ input }: any) => {
      const student = studentById(input?.id);
      if (!student) throw appError('studentMissing');
      const data = input?.data ?? {};
      if (data.name !== undefined && !String(data.name).trim()) throw appError('nameRequired');
      Object.assign(student, {
        ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
        ...(data.nickname !== undefined ? { nickname: data.nickname } : {}),
        ...(data.age !== undefined ? { age: Number(data.age) } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.parentName !== undefined ? { parentName: data.parentName } : {}),
        ...(data.parentPhone !== undefined ? { parentPhone: data.parentPhone } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      });
      return student;
    }),
    renew: proc.mutation(({ input }: any) => {
      const student = studentById(input?.id);
      if (!student) throw appError('studentMissing');
      student.balance.purchased += 20;
      student.balance.remaining += 20;
      student.enrollment = 'renewal';
      return student;
    }),
    shuffleAvatar: proc.mutation(({ input }: any) => {
      const student = studentById(input?.id);
      if (!student) throw appError('studentMissing');
      student.avatarSeed = Math.floor(Math.random() * 900) + 100;
      return student;
    }),
    setSlots: proc.mutation(({ input }: any) => {
      const student = studentById(input?.id);
      if (!student) throw appError('studentMissing');
      const ids: number[] = (input?.slotIds ?? []).map(Number);
      if (new Set(ids).size !== ids.length) throw appError('duplicateSlots');
      if (ids.some((id) => !slotById(id))) throw appError('slotsMissing');
      for (const slot of slots) {
        slot.studentIds = slot.studentIds.filter((id) => id !== student.id);
      }
      for (const id of ids) {
        const slot = slotById(id)!;
        if (!slot.studentIds.includes(student.id)) slot.studentIds.push(student.id);
        if (slot.studentIds.length > (slot.capacity ?? 99)) throw appError('slotFull');
      }
      syncStudentSlots();
      return { ...student, slotIds: ids };
    }),
  }),
  attendance: t.router({
    save: proc.mutation(({ input }: any) => {
      const slot = slotById(input?.slotId);
      if (!slot) throw appError('slotMissing');
      const date = String(input?.date ?? '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw appError('dateInvalid');
      const records: Array<{ studentId: number; status: AttendanceStatus | null }> = input?.records ?? [];
      if (new Set(records.map((record) => record.studentId)).size !== records.length) throw appError('duplicateRollCall');
      if (records.some((record) => !slot.studentIds.includes(Number(record.studentId)))) throw appError('notInClass');
      const key = `${slot.id}|${date}`;
      if (!attendance.has(key)) attendance.set(key, new Map());
      const store = attendance.get(key)!;
      const result = records.map((record) => {
        const student = studentById(record.studentId);
        if (!student) throw appError('studentMissing');
        const before = student.balance.remaining;
        if (record.status == null) {
          store.delete(student.id);
          return { studentId: student.id, before, after: before };
        }
        const previous = store.get(student.id) ?? null;
        const previousValue = previous === 'present' ? 1 : 0;
        const nextValue = record.status === 'present' ? 1 : 0;
        const delta = nextValue - previousValue;
        student.balance.used = Math.max(0, student.balance.used + delta);
        student.balance.remaining = student.balance.purchased - student.balance.used;
        store.set(student.id, record.status);
        return { studentId: student.id, before, after: student.balance.remaining };
      });
      return result;
    }),
  }),
  artworks: t.router({
    upload: proc.mutation(({ input }: any) => {
      const student = studentById(input?.studentId);
      if (!student) throw appError('studentMissing');
      const dataUrl = String(input?.dataUrl ?? '');
      if (!dataUrl.startsWith('data:image/')) throw appError('imageType');
      if (dataUrl.length > 11 * 1024 * 1024) throw appError('imageTooLarge');
      const artwork: Artwork = {
        id: Math.max(0, ...artworks.map((item) => item.id)) + 1,
        studentId: student.id,
        title: String(input?.title ?? '未命名作品'),
        imageUrl: dataUrl,
        courseId: input?.courseId == null ? null : Number(input.courseId),
        createdAt: new Date().toISOString(),
      };
      artworks.push(artwork);
      return artwork;
    }),
    remove: proc.mutation(({ input }: any) => {
      const before = artworks.length;
      artworks = artworks.filter((artwork) => artwork.id !== Number(input?.id));
      if (artworks.length === before) throw appError('studentMissing');
      return { ok: true };
    }),
  }),
});

export const createCaller = t.createCallerFactory(appRouter);


