import * as m from 'react/jsx-runtime';
import { Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { GE, KD, Ls, UN } from '@/compat';
import { XD } from '@/contexts/ThemeContext';
import { OD } from '@/i18n';
import { VD } from '@/components/ErrorBoundary';
import { mE } from '@/components/KidAvatar';
import { Xv } from '@/pages/NotFound';
import { dM } from '@/pages/StudentDetail';
import { pM } from '@/pages/Students';
import { eM } from '@/pages/Schedule';
import { tM } from '@/pages/Staff';
import { xM } from '@/pages/Today';

function AppRoutes() {
  return m.jsx(Router, {
    hook: useHashLocation,
    children: m.jsxs(KD, {
      children: [
        m.jsx(Ls, { path: '/', component: xM }),
        m.jsx(Ls, { path: '/schedule', component: eM }),
        m.jsx(Ls, { path: '/students', component: pM }),
        m.jsx(Ls, { path: '/students/:id', component: dM }),
        m.jsx(Ls, { path: '/staff', component: tM }),
        m.jsx(Ls, { path: '/404', component: Xv }),
        m.jsx(Ls, { component: Xv }),
      ],
    }),
  });
}

export default function App() {
  return m.jsx(VD, {
    children: m.jsx(OD, {
      children: m.jsx(XD, {
        defaultTheme: 'light',
        children: m.jsxs(UN, {
          children: [
            m.jsx(mE, {}),
            m.jsx(GE, { position: 'top-center', richColors: true }),
            m.jsx(AppRoutes, {}),
          ],
        }),
      }),
    }),
  });
}
