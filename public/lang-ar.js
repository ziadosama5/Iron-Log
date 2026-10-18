// Arabic (simple Modern Standard Arabic). English text is the key.
//   ui:    English UI text -> Arabic. Keep {placeholders} identical to the key.
//   names: display names of library things, looked up with nameOf(kind, name). Stored data stays English.
export const AR = {
  ui: {
    /* ---- shell: header, tab bar, More sheet, rest bar ---- */
    "Loading…": "جارٍ التحميل…",
    "Workout": "التمرين", "Coach": "المدرب", "Body": "الجسم", "Goals": "الأهداف", "More": "المزيد",
    "Sections": "الأقسام",
    "Days": "الأيام", "Lifts": "الرفعات", "History & backup": "السجل والنسخ الاحتياطي",
    "Language": "اللغة", "Theme": "المظهر", "System": "النظام", "Light": "فاتح", "Dark": "داكن",
    "Sign out": "تسجيل الخروج", "Close": "إغلاق",
    "Rest": "راحة", "Skip": "تخطي", "−15s": "−15 ث", "+15s": "+15 ث",
    "15 seconds less rest": "راحة أقل بـ 15 ثانية", "15 seconds more rest": "راحة أكثر بـ 15 ثانية",
    "Rest over · {name}": "انتهت الراحة · {name}", "Rest · {name}": "راحة · {name}", "Go": "ابدأ",

    /* ---- Workout ---- */
    "Today": "اليوم", "Day {n}": "اليوم {n}", "DAY {n}": "اليوم {n}", "ANY": "أي",
    "Workout date": "تاريخ التمرين", "Change day": "تغيير اليوم",
    "Exercises done": "التمارين المنجزة", "{n} of {m} done": "تم {n} من {m}",
    "No exercises yet": "لا توجد تمارين بعد", "Tap \"+ Exercise\" to add one.": "اضغط \"+ تمرين\" لإضافة تمرين.",
    "+ Exercise": "+ تمرين", "+ Cardio": "+ كارديو",
    "Exercise {n} of {m}": "التمرين {n} من {m}", "done": "تم",
    "Last time ({d}):": "المرة الأخيرة ({d}):", "First time logging this one.": "هذه أول مرة تسجّل فيها هذا التمرين.",
    "Weight · kg": "الوزن · kg", "Weight in kg": "الوزن بالكيلوجرام", "Reps": "التكرارات",
    "Minus 2.5 kg": "ناقص 2.5 كيلوجرام", "Plus 2.5 kg": "زائد 2.5 كيلوجرام",
    "Minus 1 rep": "ناقص تكرار واحد", "Plus 1 rep": "زائد تكرار واحد",
    "Add set {n}": "إضافة المجموعة {n}", "Save set {n}": "حفظ المجموعة {n}", "Editing set {n}": "تعديل المجموعة {n}",
    "Edit set {n}": "تعديل المجموعة {n}", "Delete set {n}": "حذف المجموعة {n}", "Cancel": "إلغاء", "Set": "المجموعة",
    "Remove exercise": "حذف التمرين", "Mark as not done": "تحديد كغير مكتمل", "✓ Done": "✓ تم",
    "Next: {name}": "التالي: {name}",
    "Workout complete": "اكتمل التمرين", "Tap any exercise above to edit it.": "اضغط على أي تمرين بالأعلى لتعديله.",
    "{n} set": "{n} مجموعة", "{n} sets": "{n} مجموعات",
    "{n} kg moved": "تم رفع {n} kg", "{n} kcal exercise": "{n} kcal من التمرين",
    "Add an exercise": "إضافة تمرين", "Add": "إضافة", "Or type any exercise": "أو اكتب أي تمرين",
    "Pick a muscle group to see suggestions.": "اختر مجموعة عضلية لعرض الاقتراحات.",
    "Set up your training days": "أعدّ أيام تدريبك",
    "Split your week into days like Push, Pull and Legs. Each day keeps its own exercise list, so starting a workout is one tap.":
      "قسّم أسبوعك إلى أيام مثل الدفع والسحب والأرجل. لكل يوم قائمة تمارينه الخاصة، فيصبح بدء التمرين بضغطة واحدة.",
    "Set up days": "إعداد الأيام", "Log a free workout": "تسجيل تمرين حر",
    "Free workout": "تمرين حر", "Pick exercises as you go": "اختر التمارين أثناء التمرين",
    "Switch to another day": "التبديل إلى يوم آخر", "Which day are you training?": "أي يوم تتدرب؟",
    "Up next": "التالي", "Keep {name}": "إبقاء {name}", "current workout": "التمرين الحالي",
    "last {d}": "آخر مرة {d}", "{n} exercise": "{n} تمرين", "{n} exercises": "{n} تمارين",
    "About {name}": "عن {name}",
    "Enter a weight (0 for bodyweight) and at least 1 rep": "أدخل وزناً (0 لوزن الجسم) وتكراراً واحداً على الأقل.",
    "{name} is already in this workout": "{name} موجود بالفعل في هذا التمرين",

    /* ---- Cardio ---- */
    "Cardio": "كارديو", "Type": "النوع", "Minutes": "الدقائق",
    "Intensity · used when kcal is blank": "الشدة · تُستخدم عند ترك السعرات فارغة",
    "Machine kcal": "سعرات الجهاز", "optional": "اختياري", "Add cardio": "إضافة كارديو",
    "Minus 5 minutes": "ناقص 5 دقائق", "Plus 5 minutes": "زائد 5 دقائق",
    "Delete {name} session": "حذف جلسة {name}",
    "~{k} kcal est.": "~{k} kcal تقديري", "log weight for kcal": "سجّل وزنك لحساب السعرات"
  },
  names: {}
};
