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
    "~{k} kcal est.": "~{k} kcal تقديري", "log weight for kcal": "سجّل وزنك لحساب السعرات",

    /* ---- Days ---- */
    "+ Add day": "+ إضافة يوم", "Back": "رجوع", "Blank": "فارغ", "Name your own days": "سمِّ أيامك بنفسك",
    "Training days": "أيام التدريب", "Change split": "تغيير التقسيم",
    "Start from a common split and edit it, or build your own from scratch.": "ابدأ من تقسيم شائع وعدّله، أو ابنِ تقسيمك من الصفر.",
    "Switch to a different split": "التبديل إلى تقسيم آخر",
    "This replaces your {n} current day. Workouts you already logged stay in History and Lifts.": "هذا يستبدل يومك الحالي ({n}). تبقى التمارين التي سجّلتها في السجل والرفعات.",
    "This replaces your {n} current days. Workouts you already logged stay in History and Lifts.": "هذا يستبدل أيامك الحالية ({n}). تبقى التمارين التي سجّلتها في السجل والرفعات.",
    "Replace your days with {name}?": "استبدال أيامك بـ {name}؟", "Replace": "استبدال",
    "Delete all days and start blank?": "حذف كل الأيام والبدء من جديد؟", "Delete all": "حذف الكل", "Or start blank": "أو ابدأ من جديد",
    "UP NEXT": "التالي", "✎ Edit day": "✎ تعديل اليوم", "✓ Done editing": "✓ تم التعديل",
    "No exercises yet. Tap Edit day to add some.": "لا توجد تمارين بعد. اضغط تعديل اليوم لإضافة تمارين.",
    "Train this day": "تدرّب على هذا اليوم", "Day name": "اسم اليوم", "Train on": "التدريب في", "Currently {name}": "حالياً: {name}",
    "Muscles trained": "العضلات المدرَّبة", "Exercises, in order": "التمارين بالترتيب",
    "Move {name} up": "نقل {name} لأعلى", "Move {name} down": "نقل {name} لأسفل", "Remove {name}": "حذف {name}",
    "Tap suggestions below or type an exercise.": "اضغط على الاقتراحات بالأسفل أو اكتب تمريناً.",
    "Suggestions": "اقتراحات", "Pick the muscles this day trains to get exercise suggestions.": "اختر العضلات التي يدربها هذا اليوم لتظهر لك اقتراحات التمارين.",
    "Type any exercise": "اكتب أي تمرين", "Move day up": "نقل اليوم لأعلى", "Move day down": "نقل اليوم لأسفل",
    "Delete {name}?": "حذف {name}؟",
    "Tip: open a day and pick the weekdays you train it. The Workout tab will then pick today's day for you.": "نصيحة: افتح يوماً واختر أيام الأسبوع التي تتدرب فيها عليه. سيختار تبويب التمرين يوم اليوم تلقائياً.", "Keep": "إبقاء", "Delete": "حذف", "Delete day": "حذف اليوم",

    /* ---- Lifts (progress) ---- */
    "Progress": "التقدم", "Nothing to chart yet": "لا يوجد ما يُعرض بعد",
    "Log a few sessions of any lift and its estimated 1-rep max and top weight will be charted here.": "سجّل بضع جلسات لأي تمرين وسيظهر هنا مخطط أقصى تكرار واحد مقدّر وأعلى وزن.",
    "Best e1RM": "أفضل e1RM", "Heaviest set": "أثقل مجموعة", "Sessions": "الجلسات", "e1RM change": "تغير e1RM",
    "Estimated 1RM": "أقصى تكرار واحد مقدّر", "Top set weight": "وزن أعلى مجموعة",
    "Estimated 1RM and top set weight over time": "أقصى تكرار واحد مقدّر ووزن أعلى مجموعة عبر الزمن",
    "One session logged. The chart appears after your second.": "تم تسجيل جلسة واحدة. يظهر المخطط بعد الجلسة الثانية.",
    "Date": "التاريخ", "Sets (kg×reps)": "المجموعات (kg×تكرارات)",
    "e1RM uses the Epley formula: weight × (1 + reps ÷ 30). It lets sets of different rep counts be compared on one line.": "يستخدم e1RM معادلة إبلي: الوزن × (1 + التكرارات ÷ 30). تتيح مقارنة مجموعات بأعداد تكرار مختلفة على خط واحد.",

    /* ---- History and backup ---- */
    "History": "السجل", "No workouts yet": "لا توجد تمارين مسجلة بعد",
    "Every day you log shows up here. Tap one to open and edit it.": "كل يوم تسجّله يظهر هنا. اضغط على أي يوم لفتحه وتعديله.",
    "{n} workout logged": "{n} تمرين مسجل", "{n} workouts logged": "{n} تمارين مسجلة", "{n} in the last 7 days": "{n} في آخر 7 أيام",
    "Delete this workout?": "حذف هذا التمرين؟",
    "Backup": "النسخ الاحتياطي",
    "Download everything (workouts, days, body data) as a file you keep, for example in Google Drive. Restore it here any time, even into a new account. Once a month is a good habit.": "نزّل كل بياناتك (التمارين والأيام وبيانات الجسم) كملف تحتفظ به، مثلاً في Google Drive. يمكنك استعادتها هنا في أي وقت، حتى في حساب جديد. مرة كل شهر عادة جيدة.",
    "Download backup": "تنزيل نسخة احتياطية", "Restore from file": "استعادة من ملف",
    "No backup downloaded on this device yet.": "لم يتم تنزيل أي نسخة احتياطية على هذا الجهاز بعد.",
    "Last backup today.": "آخر نسخة احتياطية اليوم.",
    "Last backup {n} day ago.": "آخر نسخة احتياطية قبل {n} يوم.", "Last backup {n} days ago.": "آخر نسخة احتياطية قبل {n} أيام.",
    "Last backup {n} day ago. Time for a new one.": "آخر نسخة احتياطية قبل {n} يوم. حان وقت نسخة جديدة.",
    "Last backup {n} days ago. Time for a new one.": "آخر نسخة احتياطية قبل {n} أيام. حان وقت نسخة جديدة.",
    "Restored {n} items": "تمت استعادة {n} عنصراً", ", skipped {k} that looked damaged": "، وتم تخطي {k} بدت تالفة",
    "That file isn't an Iron Log backup": "هذا الملف ليس نسخة احتياطية من Iron Log", "Couldn't restore that file": "تعذّرت استعادة هذا الملف",

    /* ---- Exercise info sheet ---- */
    "Start": "البداية", "Finish": "النهاية", "Works:": "يعمل على:",
    "Illustrations: Everkinetic, CC BY-SA 4.0": "الرسوم التوضيحية: Everkinetic، CC BY-SA 4.0",
    "Drawing not available offline yet": "الرسم غير متاح دون اتصال بعد",

    /* ---- Sign-in and setup ---- */
    "Almost there": "اقتربت من الانتهاء",
    "Paste your Firebase project's config into": "الصق إعدادات مشروع Firebase الخاص بك في",
    ", then deploy again. The README walks through it step by step.": "، ثم انشر التطبيق مرة أخرى. يشرح ملف README الخطوات خطوة بخطوة.",
    "Log your sets, plan your training days, track body weight, measurements and InBody scans, and get coaching tips from your own data.": "سجّل مجموعاتك، وخطّط لأيام تدريبك، وتابع وزن جسمك وقياساتك وفحوصات InBody، واحصل على نصائح تدريب من بياناتك أنت.",
    "Sign in with Google": "تسجيل الدخول بحساب Google",
    "Your data is private to your account and syncs across your devices.": "بياناتك خاصة بحسابك وتتزامن بين أجهزتك.",

    /* ---- Sync status ---- */
    "Loading your data…": "جارٍ تحميل بياناتك…", "Offline · will sync": "بلا اتصال · ستتم المزامنة لاحقاً",
    "Saving…": "جارٍ الحفظ…", "Offline": "بلا اتصال", "Synced": "تمت المزامنة",
    "Sync stopped. Reload to reconnect": "توقفت المزامنة. أعد تحميل الصفحة لإعادة الاتصال",
    "Offline · saving on this phone": "بلا اتصال · الحفظ على هذا الهاتف", "Back online · syncing…": "عاد الاتصال · جارٍ المزامنة…",
    "Not allowed to save. Sign out and back in.": "غير مسموح بالحفظ. سجّل الخروج ثم الدخول من جديد.",
    "Daily free limit reached. Changes will save tomorrow.": "تم الوصول إلى الحد المجاني اليومي. ستُحفظ التغييرات غداً.",
    "Couldn't save. Check your connection.": "تعذّر الحفظ. تحقق من اتصالك.",

    /* ---- Messages ---- */
    "Enter 1–5000 kcal (protein 0–500 g)": "أدخل من 1 إلى 5000 kcal (البروتين من 0 إلى 500 g)",
    "Meal added": "تمت إضافة الوجبة", "Body weight needs a number": "وزن الجسم يحتاج إلى رقم",
    "Saved for {d}": "تم الحفظ ليوم {d}", "Saved": "تم الحفظ", "Entry saved for {d}": "تم حفظ القياس ليوم {d}", "Entry deleted": "تم حذف القياس",
    "Target weight must be 30–300 kg": "يجب أن يكون الوزن المستهدف بين 30 و300 kg",
    "Fill in all four fields: height in cm (100–250) and a 4-digit birth year": "املأ الحقول الأربعة: الطول بالسنتيمتر (100–250) وسنة الميلاد من 4 أرقام",
    "{name} needs a number": "{name} يحتاج إلى رقم",
    "Enter at least one value, like your body weight": "أدخل قيمة واحدة على الأقل، مثل وزن جسمك",
    "{name} is already on this day": "{name} موجود بالفعل في هذا اليوم", "New PR on {name}!": "رقم قياسي جديد في {name}!",
    "Enter 1–600 minutes and, if you have it, 1–5000 kcal": "أدخل من 1 إلى 600 دقيقة، وإن توفرت فمن 1 إلى 5000 kcal",
    "Cardio added": "تمت إضافة الكارديو", "Next up: {name}": "التالي: {name}", "Workout complete. Nice work!": "اكتمل التمرين. أحسنت!",
    "{name} added. Tap Edit day to change anything.": "تمت إضافة {name}. اضغط تعديل اليوم لتغيير أي شيء.",
    "Switched to {name}": "تم التبديل إلى {name}", "{name} added to today's workout": "تمت إضافة {name} إلى تمرين اليوم",
    "Workout deleted": "تم حذف التمرين"
  },
  names: {}
};
