// Recovered from the production bundle of xiaolu-staff (data-loc stripped, imports wired).
// @ts-nocheck
import * as b from 'react';
import * as m from 'react/jsx-runtime';
import { Gc, It, Pn, Xe, et, fo, ho, lM, mo, oM, po, qe, uo } from '@/compat';
import { tn, ue } from '@/i18n';
import { ta } from '@/lib/errors';

// 新增/编辑学员弹窗。fx 为表单默认值。

const fx = {
  name: "",
  nickname: "",
  age: 6,
  gender: "girl",
  parentName: "",
  parentPhone: "",
  note: ""
};
function J1({
  open: t,
  onOpenChange: a,
  student: r
}) {
  const {
      m: l
    } = tn(),
    [i, c] = b.useState(fx),
    [d, h] = b.useState(!0),
    p = qe.useUtils(),
    [, g] = Gc();
  b.useEffect(() => {
    t && (r ? c({
      name: String(r.name ?? ""),
      nickname: String(r.nickname ?? ""),
      age: Number(r.age ?? 6),
      gender: r.gender ?? "girl",
      parentName: String(r.parentName ?? ""),
      parentPhone: String(r.parentPhone ?? ""),
      note: String(r.note ?? "")
    }) : (c(fx), h(!0)));
  }, [t, r]);
  const x = qe.students.create.useMutation({
      onSuccess: C => {
        Xe.success(ue(l.studentForm.welcome, {
          name: i.name
        })), p.students.list.invalidate(), a(!1), g(`/students/${C.id}`);
      },
      onError: C => Xe.error(ta(C, l))
    }),
    y = qe.students.update.useMutation({
      onSuccess: () => {
        Xe.success(l.studentForm.profileUpdated), p.students.list.invalidate(), p.students.get.invalidate(), p.today.get.invalidate(), a(!1);
      },
      onError: C => Xe.error(ta(C, l))
    }),
    w = () => {
      if (!i.name.trim()) {
        Xe.error(l.studentForm.nameRequired);
        return;
      }
      const C = {
        name: i.name.trim(),
        nickname: i.nickname.trim() || null,
        age: i.age,
        gender: i.gender,
        parentName: i.parentName.trim() || null,
        parentPhone: i.parentPhone.trim() || null,
        note: i.note.trim() || null
      };
      r ? y.mutate({
        id: r.id,
        data: C
      }) : x.mutate({
        data: C,
        withPackage: d
      });
    },
    E = (C, S) => c(T => ({
      ...T,
      [C]: S
    }));
  return m.jsx(uo, {
    open: t,
    onOpenChange: a,
    children: m.jsxs(fo, {
      className: "sm:max-w-lg bg-card border-2 border-cocoa/10 rounded-[28px]",
      children: [m.jsxs(mo, {
        children: [m.jsx(ho, {
          className: "font-display text-2xl font-normal text-cocoa",
          children: r ? l.studentForm.editTitle : l.studentForm.createTitle
        }), m.jsx(po, {
          className: "font-semibold text-cocoa-soft",
          children: r ? l.studentForm.editDescription : l.studentForm.createDescription
        })]
      }), m.jsxs("div", {
        className: "grid grid-cols-2 gap-3",
        children: [m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.nameLabel
          }), m.jsx(Pn, {
            className: "rounded-xl",
            value: i.name,
            onChange: C => E("name", C.target.value),
            placeholder: l.studentForm.namePlaceholder
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.nicknameLabel
          }), m.jsx(Pn, {
            className: "rounded-xl",
            value: i.nickname,
            onChange: C => E("nickname", C.target.value),
            placeholder: l.studentForm.nicknamePlaceholder
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.ageLabel
          }), m.jsx(Pn, {
            type: "number",
            min: 2,
            max: 18,
            className: "rounded-xl",
            value: i.age,
            onChange: C => E("age", Math.max(2, Math.min(18, Number(C.target.value) || 2)))
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.genderLabel
          }), m.jsx("div", {
            className: "flex gap-2",
            children: ["girl", "boy"].map(C => m.jsx("button", {
              type: "button",
              onClick: () => E("gender", C),
              className: `flex-1 rounded-xl border-2 py-2 text-sm font-extrabold ${i.gender === C ? C === "girl" ? "border-[#FF7FA3] bg-blush" : "border-[#5BB6E8] bg-sky" : "border-cocoa/10 text-cocoa-soft"}`,
              children: C === "girl" ? l.studentForm.genderGirl : l.studentForm.genderBoy
            }, C))
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.parentNameLabel
          }), m.jsx(Pn, {
            className: "rounded-xl",
            value: i.parentName,
            onChange: C => E("parentName", C.target.value),
            placeholder: l.studentForm.parentNamePlaceholder
          })]
        }), m.jsxs("div", {
          className: "space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.parentPhoneLabel
          }), m.jsx(Pn, {
            className: "rounded-xl",
            value: i.parentPhone,
            onChange: C => E("parentPhone", C.target.value),
            placeholder: l.studentForm.parentPhonePlaceholder
          })]
        }), m.jsxs("div", {
          className: "col-span-2 space-y-1.5",
          children: [m.jsx(It, {
            className: "font-extrabold",
            children: l.studentForm.teacherNoteLabel
          }), m.jsx(lM, {
            className: "rounded-xl",
            rows: 3,
            value: i.note,
            onChange: C => E("note", C.target.value),
            placeholder: l.studentForm.teacherNotePlaceholder
          })]
        }), !r && m.jsxs("label", {
          className: "col-span-2 flex items-center gap-2 rounded-xl bg-peach/40 p-3 text-sm font-bold text-cocoa",
          children: [m.jsx(oM, {
            checked: d,
            onCheckedChange: C => h(C === !0)
          }), l.studentForm.withFirstPackage]
        })]
      }), m.jsxs("div", {
        className: "flex justify-end gap-2 pt-2",
        children: [m.jsx(et, {
          variant: "ghost",
          className: "rounded-full font-bold",
          onClick: () => a(!1),
          children: l.common.cancel
        }), m.jsx(et, {
          className: "rounded-full px-6 font-extrabold",
          onClick: w,
          disabled: x.isPending || y.isPending,
          children: r ? l.common.save : l.studentForm.createSubmit
        })]
      })]
    })
  });
}
export { fx, J1 };
