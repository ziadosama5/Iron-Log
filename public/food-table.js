// Built-in food table: data (FOODS), search, serving math, meal totals and recents. Pure: no DOM, no Firebase.
// Entry: {id, en, ar, alt:[spellings], group, kcal100, protein100, servings:[{id, en, ar, grams?, kcal?, protein?}], def}
//   A serving has grams (kcal/protein come from the per-100 g values) or fixed kcal/protein (My foods, scanned products without per-100 g data).
// Item (what a saved meal keeps): {src:"table"|"mine"|"scan", ref, name, serving, amount, grams|null, kcal, protein|null}
// All figures are estimates.

// Data. Figures are per 100 g as eaten (cooked), estimates from recipes and USDA FoodData Central (public domain).
// food(...) takes [protein, fat, carbs] and derives kcal100 = 4*carbs + 4*protein + 9*fat; every food also offers "100 g".
// varies = true marks dishes whose real-world recipe and portion differ a lot (the owner reviews these).
const sv = (id, en, ar, grams) => ({ id, en, ar, grams });
const G100 = sv("g100", "100 g", "100 جرام", 100);
const food = (id, en, ar, alt, group, [p, f, c], servings, def, varies = false) => ({
  id, en, ar, alt, group, kcal100: Math.round(4 * c + 4 * p + 9 * f), protein100: p, fat100: f, carbs100: c,
  servings: [...servings, G100], def, ...(varies ? { varies: true } : {}),
});

export const FOODS = [
  // ---- bread
  food("aish-baladi", "Baladi bread", "عيش بلدي", ["aish baladi", "eish baladi", "3eish baladi", "baladi"], "bread", [9.5, 1.5, 52],
    [sv("loaf", "1 loaf", "رغيف", 90), sv("half", "Half loaf", "نصف رغيف", 45)], "loaf"),
  food("aish-shami", "Pita bread (shami)", "عيش شامي", ["aish shami", "pita", "shami"], "bread", [9, 1.2, 55],
    [sv("piece", "1 piece", "رغيف", 60)], "piece"),
  food("aish-fino", "Fino bread roll", "عيش فينو", ["fino", "aish fino", "bread roll"], "bread", [8.5, 2.5, 55],
    [sv("roll", "1 roll", "رغيف", 70)], "roll"),
  food("toast", "White toast", "توست", ["toast bread", "sliced bread"], "bread", [8, 3.5, 49],
    [sv("slice", "1 slice", "شريحة", 28), sv("two", "2 slices", "شريحتان", 56)], "slice"),
  food("feteer-plain", "Feteer meshaltet (plain)", "فطير مشلتت", ["feteer", "fatir", "feteer meshaltet"], "bread", [8, 22, 45],
    [sv("small", "1 small feteer", "فطيرة صغيرة", 120), sv("large", "1 large feteer", "فطيرة كبيرة", 250)], "small", true),
  food("feteer-sweet", "Feteer with honey or sugar", "فطير بالعسل", ["sweet feteer", "feteer with honey"], "bread", [6, 18, 55],
    [sv("small", "1 small feteer", "فطيرة صغيرة", 120), sv("large", "1 large feteer", "فطيرة كبيرة", 250)], "small", true),

  // ---- legumes
  food("ful-medames", "Ful medames (fava beans with oil)", "فول مدمس", ["ful", "foul", "fool", "ful medames"], "legumes", [7, 4, 14],
    [sv("plate", "1 plate", "طبق", 250), sv("small", "1 small bowl", "طبق صغير", 150)], "plate"),
  food("taameya", "Taameya (falafel)", "طعمية", ["ta3meya", "tamiya", "falafel", "tameya"], "legumes", [13, 17.8, 31.8],
    [sv("piece", "1 piece", "قرص", 30), sv("five", "5 pieces", "٥ أقراص", 150)], "piece"),
  food("lentil-soup", "Lentil soup", "شوربة عدس", ["adas", "lentil soup"], "legumes", [4.5, 2, 11],
    [sv("bowl", "1 bowl", "طبق", 250)], "bowl"),
  food("hummus", "Hummus", "حمص الشام", ["hummus", "homos", "hommos", "hummus dip"], "legumes", [8, 10, 14],
    [sv("two-tbsp", "2 tablespoons", "ملعقتان كبيرتان", 30), sv("plate", "1 plate", "طبق", 100)], "two-tbsp"),
  food("chickpeas", "Chickpeas, boiled", "حمص مسلوق", ["boiled chickpeas", "hummus beans"], "legumes", [8.9, 2.6, 27],
    [sv("cup", "1 cup", "كوب", 160)], "cup"),
  food("lentils", "Lentils, cooked", "عدس مطبوخ", ["cooked lentils", "adas"], "legumes", [9, 0.4, 20],
    [sv("cup", "1 cup", "كوب", 200)], "cup"),
  food("ful-sandwich", "Ful sandwich (baladi bread)", "ساندوتش فول", ["foul sandwich", "ful sandwich"], "legumes", [7.5, 4, 30],
    [sv("sandwich", "1 sandwich", "ساندوتش", 180)], "sandwich", true),
  food("taameya-sandwich", "Taameya sandwich", "ساندوتش طعمية", ["falafel sandwich", "ta3meya sandwich"], "legumes", [10, 12, 33],
    [sv("sandwich", "1 sandwich", "ساندوتش", 200)], "sandwich", true),

  // ---- mains
  food("koshari", "Koshari", "كشري", ["koshary", "kushari", "koshari", "kosharey"], "mains", [4.5, 3.5, 27],
    [sv("plate", "1 plate", "طبق", 400), sv("box", "1 small box", "علبة صغيرة", 250)], "plate", true),
  food("mahshi", "Mahshi (stuffed vegetables with rice)", "محشي", ["mahshy", "stuffed vegetables", "mahshi"], "mains", [2.5, 4, 17],
    [sv("piece", "1 piece", "حبة", 50), sv("plate", "1 plate", "طبق", 250)], "plate", true),
  food("molokhia", "Molokhia (soup)", "ملوخية", ["mulukhiyah", "molokhiya", "mouloukhia", "jews mallow"], "mains", [3, 3, 5],
    [sv("bowl", "1 bowl", "طبق", 250)], "bowl", true),
  food("fatta", "Fatta (rice, bread and meat)", "فتة", ["fattah", "fatteh", "fata"], "mains", [10, 12, 28],
    [sv("plate", "1 plate", "طبق", 350)], "plate", true),
  food("hawawshi", "Hawawshi", "حواوشي", ["hawawshy", "hawashi", "hawawshi"], "mains", [14, 17, 25],
    [sv("piece", "1 piece", "رغيف", 200), sv("half", "Half", "نصف رغيف", 100)], "piece", true),
  food("kofta", "Kofta, grilled", "كفتة مشوية", ["kofta", "kufta", "kofta grilled"], "mains", [19, 17, 3],
    [sv("piece", "1 piece", "قطعة", 40), sv("skewer", "1 skewer", "سيخ", 100)], "skewer"),
  food("kebab", "Kebab (grilled meat cubes)", "كباب", ["kabab", "kebab", "grilled meat"], "mains", [25, 12, 0],
    [sv("skewer", "1 skewer", "سيخ", 120)], "skewer"),
  food("shawarma-sandwich", "Shawarma sandwich", "ساندوتش شاورما", ["shawerma", "shawarma", "shawrma"], "mains", [12, 12, 22],
    [sv("sandwich", "1 sandwich", "ساندوتش", 250), sv("small", "1 small sandwich", "ساندوتش صغير", 170)], "sandwich", true),
  food("chicken-breast", "Chicken breast, grilled", "صدر دجاج مشوي", ["grilled chicken", "chicken breast", "firakh"], "mains", [31, 3.6, 0],
    [sv("breast", "1 breast", "صدر", 150)], "breast"),
  food("chicken-thigh", "Chicken thigh with skin, grilled", "فخذة دجاج مشوية", ["chicken leg", "chicken thigh"], "mains", [24, 14, 0],
    [sv("piece", "1 piece", "فخذة", 120)], "piece"),
  food("chicken-fried", "Fried chicken", "دجاج مقلي", ["fried chicken", "broasted"], "mains", [24, 16, 8],
    [sv("piece", "1 piece", "قطعة", 130)], "piece"),
  food("fish-grilled", "Fish, grilled", "سمك مشوي", ["grilled fish", "tilapia", "bolti"], "mains", [26, 4, 0],
    [sv("fillet", "1 fillet", "فيليه", 150)], "fillet"),
  food("fish-fried", "Fish, fried", "سمك مقلي", ["fried fish", "samak"], "mains", [22, 11, 6],
    [sv("piece", "1 piece", "قطعة", 150)], "piece", true),
  food("liver", "Liver, fried (kebda)", "كبدة مقلية", ["kebda", "kibda", "liver"], "mains", [26, 8, 4],
    [sv("portion", "1 portion", "حصة", 120)], "portion"),
  food("sausage", "Sausage (sogo')", "سجق", ["sogo2", "sujuk", "sausage", "sosis"], "mains", [14, 25, 3],
    [sv("piece", "1 piece", "قطعة", 40)], "piece"),
  food("steak", "Beef steak, grilled", "ستيك مشوي", ["beef steak", "steak"], "mains", [27, 14, 0],
    [sv("portion", "1 portion", "حصة", 150)], "portion"),
  food("mujaddara", "Mujaddara (rice and lentils)", "مجدرة", ["mujadara", "megadra", "mudardara"], "mains", [5, 3, 27],
    [sv("plate", "1 plate", "طبق", 300)], "plate", true),
  food("kebda-sandwich", "Liver sandwich", "ساندوتش كبدة", ["kebda sandwich", "liver sandwich"], "mains", [13, 10, 25],
    [sv("sandwich", "1 sandwich", "ساندوتش", 200)], "sandwich", true),
  food("sausage-sandwich", "Sausage sandwich", "ساندوتش سجق", ["sogo2 sandwich", "sausage sandwich"], "mains", [10, 15, 28],
    [sv("sandwich", "1 sandwich", "ساندوتش", 200)], "sandwich", true),
  food("kofta-sandwich", "Kofta sandwich", "ساندوتش كفتة", ["kufta sandwich", "kofta sandwich"], "mains", [12, 11, 26],
    [sv("sandwich", "1 sandwich", "ساندوتش", 220)], "sandwich", true),
  food("chicken-pane", "Chicken pane (breaded cutlet)", "فراخ بانيه", ["pane", "chicken schnitzel", "chicken cutlet", "panee"], "mains", [20, 14, 14],
    [sv("piece", "1 piece", "قطعة", 120)], "piece"),
  food("tagen", "Meat and potato tagine", "طاجن لحمة بالبطاطس", ["tagen", "tagine", "tajine", "meat stew"], "mains", [8, 8, 8],
    [sv("tagen", "1 small tagine", "طاجن صغير", 300)], "tagen", true),
  food("bamia", "Okra stew with meat (bamia)", "بامية باللحمة", ["bamya", "okra", "bamia"], "mains", [5, 5, 7],
    [sv("plate", "1 plate", "طبق", 300)], "plate", true),
  food("besella", "Peas and carrots stew", "بسلة وجزر", ["besilla", "peas stew", "bisilla"], "mains", [4, 4, 9],
    [sv("plate", "1 plate", "طبق", 300)], "plate", true),
  food("hamam-mahshi", "Stuffed pigeon (hamam mahshi)", "حمام محشي", ["hamam", "pigeon", "stuffed pigeon"], "mains", [19, 14, 10],
    [sv("piece", "1 pigeon", "حمامة", 150)], "piece", true),
  food("tuna-can", "Tuna, canned in oil (drained)", "تونة معلبة", ["tuna", "canned tuna"], "mains", [26, 9, 0],
    [sv("can", "1 small can (drained)", "علبة صغيرة", 100)], "can"),
  food("sardines-can", "Sardines, canned", "سردين معلب", ["sardine", "sardines"], "mains", [25, 11, 0],
    [sv("can", "1 can", "علبة", 90)], "can"),

  // ---- rice and pasta
  food("rice-white", "White rice, cooked", "أرز أبيض", ["rice", "roz", "ruz", "aruz", "white rice"], "rice", [2.7, 0.3, 28],
    [sv("cup", "1 cup", "كوب", 160), sv("plate", "1 plate", "طبق", 250)], "cup"),
  food("rice-vermicelli", "Rice with vermicelli", "أرز بالشعرية", ["roz bel shaareya", "rice with noodles", "vermicelli rice"], "rice", [3, 3, 29],
    [sv("cup", "1 cup", "كوب", 160), sv("plate", "1 plate", "طبق", 250)], "cup", true),
  food("macarona-bechamel", "Macarona bechamel", "مكرونة بشاميل", ["macaroni bechamel", "makarona bechamel", "bechamel"], "rice", [7, 9, 20],
    [sv("plate", "1 plate", "طبق", 300)], "plate", true),
  food("pasta", "Pasta, boiled", "مكرونة مسلوقة", ["macarona", "makarona", "macaroni", "spaghetti", "pasta"], "rice", [5.8, 0.9, 31],
    [sv("cup", "1 cup", "كوب", 140), sv("plate", "1 plate", "طبق", 250)], "cup"),
  food("pasta-tomato", "Pasta with tomato sauce", "مكرونة بالصلصة", ["macarona bel salsa", "pasta with sauce"], "rice", [5, 3, 25],
    [sv("plate", "1 plate", "طبق", 300)], "plate", true),

  // ---- eggs and dairy
  food("egg-boiled", "Egg, boiled", "بيض مسلوق", ["boiled egg", "egg", "beid"], "eggs-dairy", [12.6, 10.6, 1.1],
    [sv("egg", "1 egg", "بيضة", 50), sv("two", "2 eggs", "بيضتان", 100)], "egg"),
  food("egg-fried", "Egg, fried", "بيض مقلي", ["fried egg", "beid maqli"], "eggs-dairy", [13.6, 15, 1],
    [sv("egg", "1 egg", "بيضة", 46), sv("two", "2 eggs", "بيضتان", 92)], "egg"),
  food("omelette", "Omelette", "أومليت", ["omelet", "omlet", "omelette"], "eggs-dairy", [11, 15, 1],
    [sv("omelette", "1 omelette (2 eggs)", "أومليت (بيضتان)", 120)], "omelette"),
  food("gebna-beida", "White cheese (gebna beida)", "جبنة بيضاء", ["gebna", "gibna", "feta", "white cheese", "gebna bayda"], "eggs-dairy", [14, 21, 2],
    [sv("slice", "1 slice", "شريحة", 30), sv("three-tbsp", "3 tablespoons", "٣ ملاعق كبيرة", 50)], "slice"),
  food("gebna-rumi", "Roumi cheese", "جبنة رومي", ["rumi", "roumi", "gebna rumi", "romy"], "eggs-dairy", [25, 32, 2],
    [sv("slice", "1 slice", "شريحة", 30)], "slice"),
  food("cheese-triangle", "Processed cheese triangle", "جبنة مثلثات", ["kiri", "cheese triangle", "triangle cheese", "gebna mothalathat"], "eggs-dairy", [9, 20, 5],
    [sv("triangle", "1 triangle", "قطعة", 17), sv("three", "3 triangles", "٣ قطع", 51)], "triangle"),
  food("milk-whole", "Whole milk", "لبن كامل الدسم", ["milk", "laban", "halib", "haleeb"], "eggs-dairy", [3.3, 3.6, 4.8],
    [sv("glass", "1 glass (250 ml)", "كوب (٢٥٠ مل)", 258)], "glass"),
  food("yoghurt", "Plain yoghurt", "زبادي", ["yogurt", "zabadi", "zabady", "yoghurt"], "eggs-dairy", [3.5, 3.3, 4.7],
    [sv("cup", "1 small cup", "علبة صغيرة", 125), sv("large", "1 large cup", "علبة كبيرة", 200)], "cup"),
  food("labneh", "Labneh", "لبنة", ["labna", "labneh", "labaneh"], "eggs-dairy", [6, 10, 4],
    [sv("two-tbsp", "2 tablespoons", "ملعقتان كبيرتان", 40)], "two-tbsp"),

  // ---- sides, soups and dips
  food("bessara", "Bessara (fava bean soup)", "بصارة", ["bissara", "bisara", "bessara"], "sides", [5, 3, 9],
    [sv("bowl", "1 bowl", "طبق", 250)], "bowl", true),
  food("sambousek", "Sambousek (cheese pastry)", "سمبوسك بالجبنة", ["sambousa", "samosa", "sambosa", "sambusak"], "sides", [8, 18, 30],
    [sv("piece", "1 piece", "قطعة", 40)], "piece"),
  food("grape-leaves", "Stuffed grape leaves (wara enab)", "ورق عنب", ["warak enab", "wara2 enab", "dolma", "grape leaves"], "sides", [2.5, 5, 18],
    [sv("piece", "1 piece", "حبة", 30), sv("five", "5 pieces", "٥ حبات", 150)], "five", true),
  food("tomato-salad", "Tomato and cucumber salad", "سلطة طماطم وخيار", ["salata", "salad", "egyptian salad", "tomato salad"], "sides", [1, 3, 5],
    [sv("bowl", "1 small bowl", "طبق صغير", 150)], "bowl"),
  food("tahini", "Tahini dip", "طحينة", ["tahina", "tehina", "tahini"], "sides", [8, 20, 10],
    [sv("two-tbsp", "2 tablespoons", "ملعقتان كبيرتان", 30)], "two-tbsp"),
  food("baba-ghanoush", "Baba ghanoush", "بابا غنوج", ["baba ghanouj", "baba ganoush", "eggplant dip"], "sides", [2, 10, 7],
    [sv("two-tbsp", "2 tablespoons", "ملعقتان كبيرتان", 40), sv("plate", "1 plate", "طبق", 100)], "two-tbsp"),
  food("chicken-soup", "Chicken soup", "شوربة فراخ", ["soup", "chicken soup", "shorbet frakh"], "sides", [3, 2, 3],
    [sv("bowl", "1 bowl", "طبق", 250)], "bowl", true),

  // ---- vegetables
  food("potato-boiled", "Potato, boiled", "بطاطس مسلوقة", ["boiled potato", "batates", "potato"], "veg", [1.9, 0.1, 20],
    [sv("medium", "1 medium potato", "حبة متوسطة", 150)], "medium"),
  food("sweet-potato", "Sweet potato, baked", "بطاطا مشوية", ["batata", "sweet potato", "batata mashwiya"], "veg", [2, 0.1, 20],
    [sv("medium", "1 medium", "حبة متوسطة", 150), sv("large", "1 large", "حبة كبيرة", 250)], "medium"),
  food("eggplant-fried", "Eggplant, fried", "باذنجان مقلي", ["fried eggplant", "betengan", "aubergine"], "veg", [1.2, 14, 9],
    [sv("portion", "1 portion", "حصة", 100)], "portion", true),
  food("cucumber", "Cucumber", "خيار", ["khiar", "kheyar", "cucumber"], "veg", [0.7, 0.1, 3.6],
    [sv("one", "1 cucumber", "خيارة", 100)], "one"),
  food("tomato", "Tomato", "طماطم", ["tomatoes", "tamatem", "tomato"], "veg", [0.9, 0.2, 3.9],
    [sv("medium", "1 medium", "حبة متوسطة", 120)], "medium"),
  food("green-leaves", "Green salad leaves", "خس وجرجير", ["lettuce", "rocket", "arugula", "khass", "gargir"], "veg", [1.4, 0.2, 2.9],
    [sv("bowl", "1 bowl", "طبق", 80)], "bowl"),
  food("carrot", "Carrot", "جزر", ["gazar", "carrots", "carrot"], "veg", [0.9, 0.2, 9.6],
    [sv("medium", "1 medium", "حبة متوسطة", 70)], "medium"),
  food("corn-cob", "Corn on the cob, grilled", "ذرة مشوية", ["dora", "dorra", "corn", "dura"], "veg", [3.3, 1.4, 25],
    [sv("cob", "1 cob", "كوز", 150)], "cob"),
  food("pickles", "Pickles (torshi)", "مخلل", ["torshi", "pickle", "makhalel", "mokhalal"], "veg", [0.5, 0.1, 3],
    [sv("small", "1 small plate", "طبق صغير", 50)], "small"),
  food("olives", "Olives", "زيتون", ["zeitoun", "zaytoun", "olive"], "veg", [1, 15, 4],
    [sv("five", "5 olives", "٥ حبات", 20), sv("small", "1 small plate", "طبق صغير", 50)], "five"),

  // ---- fruit
  food("banana", "Banana", "موز", ["mooz", "moz", "banana"], "fruit", [1.1, 0.3, 23],
    [sv("medium", "1 medium", "حبة متوسطة", 120)], "medium"),
  food("apple", "Apple", "تفاح", ["tofaha", "toffah", "apple"], "fruit", [0.3, 0.2, 14],
    [sv("medium", "1 medium", "حبة متوسطة", 180)], "medium"),
  food("orange", "Orange", "برتقال", ["bortoan", "bortogal", "orange"], "fruit", [0.9, 0.1, 12],
    [sv("medium", "1 medium", "حبة متوسطة", 150)], "medium"),
  food("mango", "Mango", "مانجو", ["manga", "mango"], "fruit", [0.8, 0.4, 15],
    [sv("cup", "1 cup", "كوب", 165), sv("fruit", "1 fruit", "حبة", 200)], "cup"),
  food("watermelon", "Watermelon", "بطيخ", ["bateekh", "batikh", "watermelon"], "fruit", [0.6, 0.2, 7.6],
    [sv("slice", "1 large slice", "شريحة كبيرة", 300), sv("cup", "1 cup", "كوب", 150)], "slice"),
  food("grapes", "Grapes", "عنب", ["enab", "3enab", "grapes"], "fruit", [0.7, 0.2, 18],
    [sv("cup", "1 cup", "كوب", 150)], "cup"),
  food("dates", "Dates", "بلح وتمر", ["balah", "tamr", "dates", "tamar"], "fruit", [2, 0.2, 75],
    [sv("date", "1 date", "تمرة", 8), sv("three", "3 dates", "٣ تمرات", 24)], "three"),
  food("guava", "Guava", "جوافة", ["guafa", "gawafa", "guava"], "fruit", [2.6, 1, 14],
    [sv("one", "1 guava", "حبة", 100)], "one"),
  food("strawberry", "Strawberries", "فراولة", ["farawla", "frawla", "strawberry"], "fruit", [0.7, 0.3, 8],
    [sv("cup", "1 cup", "كوب", 150)], "cup"),
  food("figs", "Figs, fresh", "تين", ["teen", "tin", "figs", "fig"], "fruit", [0.8, 0.3, 19],
    [sv("one", "1 fig", "حبة", 50), sv("three", "3 figs", "٣ حبات", 150)], "one"),
  food("pomegranate", "Pomegranate seeds", "رمان", ["romman", "roman", "pomegranate"], "fruit", [1.7, 1.2, 19],
    [sv("half-cup", "Half cup", "نصف كوب", 85)], "half-cup"),

  // ---- meat
  food("lamb", "Lamb, grilled", "ضأن مشوي", ["lamb", "daani", "dani", "mutton"], "meat", [25, 20, 0],
    [sv("portion", "1 portion", "حصة", 150)], "portion"),
  food("beef-mince", "Minced beef, cooked", "لحمة مفرومة", ["mince", "ground beef", "lahma mafrooma", "minced meat"], "meat", [26, 15, 0],
    [sv("portion", "1 portion", "حصة", 120)], "portion"),
  food("turkey", "Turkey breast", "صدر رومي", ["turkey", "roumi", "rumi turkey"], "meat", [29, 2, 0],
    [sv("portion", "1 portion", "حصة", 120)], "portion"),
  food("duck", "Duck, roasted", "بط مشوي", ["bat", "duck", "batt"], "meat", [19, 28, 0],
    [sv("portion", "1 portion", "حصة", 150)], "portion"),
  food("beef-patty", "Beef burger patty", "قرص برجر لحم", ["burger patty", "burger meat", "patty"], "meat", [20, 18, 0],
    [sv("patty", "1 patty", "قرص", 100)], "patty"),

  // ---- sweets
  food("basbousa", "Basbousa", "بسبوسة", ["basbosa", "basboosa", "basbousa", "namoura"], "sweets", [4, 15, 55],
    [sv("piece", "1 piece", "قطعة", 70)], "piece", true),
  food("konafa", "Konafa", "كنافة", ["kunafa", "kunafeh", "konafa", "knafeh"], "sweets", [6, 22, 45],
    [sv("portion", "1 portion", "حصة", 100)], "portion", true),
  food("baklava", "Baklava", "بقلاوة", ["baklawa", "baklava"], "sweets", [6, 28, 48],
    [sv("piece", "1 piece", "قطعة", 40)], "piece", true),
  food("om-ali", "Om Ali", "أم علي", ["umm ali", "om ali", "oum ali", "umm ali dessert"], "sweets", [6, 12, 30],
    [sv("bowl", "1 bowl", "طبق", 200)], "bowl", true),
  food("rice-pudding", "Rice pudding (roz bel laban)", "أرز بلبن", ["roz bel laban", "rice pudding", "ruz bi laban"], "sweets", [3, 4, 22],
    [sv("bowl", "1 bowl", "طبق", 200)], "bowl", true),
  food("chocolate", "Milk chocolate", "شوكولاتة بالحليب", ["chocolate", "choco", "shokolata"], "sweets", [7, 30, 57],
    [sv("square", "1 square", "مربع", 10), sv("bar", "1 small bar", "لوح صغير", 40)], "bar"),
  food("biscuits", "Plain biscuits", "بسكويت سادة", ["biscuit", "biscuits", "baskoot", "cookies"], "sweets", [7, 13, 72],
    [sv("one", "1 biscuit", "قطعة", 8), sv("four", "4 biscuits", "٤ قطع", 32)], "four"),
  food("sugar", "Sugar", "سكر", ["sokar", "sukkar", "white sugar"], "sweets", [0, 0, 100],
    [sv("tsp", "1 teaspoon", "ملعقة صغيرة", 4), sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 12)], "tsp"),
  food("honey", "Honey", "عسل", ["asal", "3asal", "honey", "asl"], "sweets", [0.3, 0, 82],
    [sv("tsp", "1 teaspoon", "ملعقة صغيرة", 7), sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 21)], "tbsp"),
  food("halawa", "Halawa tahiniya (halva)", "حلاوة طحينية", ["halawa", "halva", "halawa tahinia"], "sweets", [12, 29, 50],
    [sv("piece", "1 piece", "قطعة", 30)], "piece"),
  food("ice-cream", "Ice cream", "آيس كريم", ["icecream", "ice cream", "ays krim", "gelato"], "sweets", [3.5, 11, 24],
    [sv("scoop", "1 scoop", "كورة", 70), sv("two", "2 scoops", "كورتان", 140)], "scoop"),
  food("cake", "Sponge cake", "كيك", ["cake", "keik", "sponge cake"], "sweets", [5, 15, 55],
    [sv("slice", "1 slice", "قطعة", 60)], "slice", true),
  food("croissant", "Croissant", "كرواسون", ["croissant", "croassan", "kruasan"], "sweets", [8, 21, 46],
    [sv("one", "1 croissant", "قطعة", 60)], "one"),
  food("doughnut", "Doughnut", "دونات", ["donut", "doughnut", "donuts"], "sweets", [5, 22, 50],
    [sv("one", "1 doughnut", "قطعة", 60)], "one"),

  // ---- drinks (grams = millilitres, close enough)
  food("tea-sugar", "Tea with sugar (2 teaspoons)", "شاي بسكر", ["shai", "shay", "tea", "chai", "sweet tea"], "drinks", [0, 0, 4],
    [sv("cup", "1 cup", "كوب", 200)], "cup"),
  food("tea-plain", "Tea, no sugar", "شاي سادة", ["shai sada", "plain tea", "black tea", "tea no sugar"], "drinks", [0, 0, 0.2],
    [sv("cup", "1 cup", "كوب", 200)], "cup"),
  food("coffee-turkish", "Turkish coffee with sugar", "قهوة تركي", ["ahwa", "ahwa turki", "turkish coffee", "qahwa", "coffee"], "drinks", [0.1, 0, 6.5],
    [sv("cup", "1 cup", "فنجان", 60)], "cup"),
  food("coffee-milk", "Coffee with milk and sugar", "قهوة بالحليب", ["nescafe", "latte", "coffee with milk", "milk coffee"], "drinks", [1.5, 1.5, 6],
    [sv("cup", "1 cup", "كوب", 200)], "cup", true),
  food("orange-juice", "Orange juice", "عصير برتقال", ["orange juice", "asir bortoan", "asir", "juice"], "drinks", [0.7, 0.2, 10.4],
    [sv("glass", "1 glass", "كوب", 250)], "glass"),
  food("sugarcane-juice", "Sugarcane juice (asab)", "عصير قصب", ["asab", "3asab", "sugarcane", "sugar cane juice"], "drinks", [0.2, 0, 18],
    [sv("glass", "1 glass", "كوب", 300)], "glass"),
  food("soft-drink", "Soft drink (cola)", "مشروب غازي", ["cola", "pepsi", "coca cola", "soda", "soft drink", "gazia"], "drinks", [0, 0, 10.6],
    [sv("can", "1 can (330 ml)", "علبة (٣٣٠ مل)", 330), sv("small", "1 small bottle (250 ml)", "زجاجة صغيرة", 250)], "can"),
  food("sahlab", "Sahlab", "سحلب", ["sahlab", "sahleb", "salep"], "drinks", [3, 3, 17],
    [sv("cup", "1 cup", "كوب", 200)], "cup", true),
  food("karkade", "Karkade (hibiscus), sweetened", "كركديه", ["karkadeh", "hibiscus", "karkade", "carcade"], "drinks", [0, 0, 6],
    [sv("glass", "1 glass", "كوب", 250)], "glass"),
  food("tamarind-juice", "Tamarind juice (tamr hindi)", "تمر هندي", ["tamr hindi", "tamarind", "tamarhindi"], "drinks", [0.1, 0, 12],
    [sv("glass", "1 glass", "كوب", 250)], "glass"),

  // ---- snacks
  food("mixed-nuts", "Mixed nuts", "مكسرات", ["nuts", "mukasarat", "mixed nuts", "mekasarat"], "snacks", [20, 50, 22],
    [sv("handful", "1 handful", "حفنة", 30)], "handful"),
  food("almonds", "Almonds", "لوز", ["loz", "almond", "almonds"], "snacks", [21, 50, 22],
    [sv("handful", "1 handful", "حفنة", 28)], "handful"),
  food("peanuts", "Peanuts, roasted (foul sudani)", "فول سوداني", ["foul sudani", "ful sudani", "peanuts", "peanut"], "snacks", [26, 49, 16],
    [sv("handful", "1 handful", "حفنة", 30)], "handful"),
  food("chips", "Potato chips", "شيبسي", ["chipsy", "chips", "crisps", "potato chips"], "snacks", [6.5, 34, 50],
    [sv("small", "1 small bag", "كيس صغير", 30), sv("large", "1 large bag", "كيس كبير", 60)], "small"),
  food("seeds", "Sunflower seeds (lib)", "لب", ["lib", "leb", "sunflower seeds", "seeds"], "snacks", [21, 51, 20],
    [sv("handful", "1 handful", "حفنة", 30)], "handful"),
  food("popcorn", "Popcorn", "فشار", ["fishar", "fushar", "popcorn", "pop corn"], "snacks", [11, 4.5, 78],
    [sv("bowl", "1 bowl", "طبق", 30)], "bowl"),

  // ---- fast food
  food("burger", "Beef burger with bun", "برجر", ["hamburger", "burger", "cheeseburger"], "fastfood", [13, 12, 25],
    [sv("burger", "1 burger", "ساندوتش برجر", 200)], "burger", true),
  food("pizza", "Pizza slice", "بيتزا", ["pitza", "pizza"], "fastfood", [11, 10, 33],
    [sv("slice", "1 slice", "قطعة", 110), sv("two", "2 slices", "قطعتان", 220)], "slice", true),
  food("french-fries", "French fries", "بطاطس محمرة", ["fries", "french fries", "batates mohamara", "chips fried", "potato fries"], "fastfood", [3.4, 15, 41],
    [sv("small", "1 small portion", "حصة صغيرة", 100), sv("medium", "1 medium portion", "حصة وسط", 150), sv("large", "1 large portion", "حصة كبيرة", 200)], "medium"),
  food("chicken-sandwich", "Crispy chicken sandwich", "ساندوتش فراخ", ["zinger", "crispy chicken", "chicken burger", "chicken sandwich"], "fastfood", [13, 13, 27],
    [sv("sandwich", "1 sandwich", "ساندوتش", 220)], "sandwich", true),
  food("hot-dog", "Hot dog", "هوت دوج", ["hotdog", "hot dog"], "fastfood", [10, 15, 22],
    [sv("one", "1 hot dog", "ساندوتش", 120)], "one"),
  food("nuggets", "Chicken nuggets", "ناجتس", ["nuggets", "chicken nuggets", "nugget"], "fastfood", [15, 17, 17],
    [sv("six", "6 pieces", "٦ قطع", 100), sv("ten", "10 pieces", "١٠ قطع", 170)], "six"),

  // ---- fats and spreads
  food("olive-oil", "Olive oil", "زيت زيتون", ["zeit zaytoun", "zayt zaytoun", "olive oil", "oil"], "fats", [0, 100, 0],
    [sv("tsp", "1 teaspoon", "ملعقة صغيرة", 5), sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 14)], "tbsp"),
  food("butter", "Butter", "زبدة", ["zebda", "zibda", "butter"], "fats", [0.9, 81, 0.1],
    [sv("tsp", "1 teaspoon", "ملعقة صغيرة", 5), sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 14)], "tbsp"),
  food("ghee", "Ghee (samna)", "سمنة", ["samna", "samn", "ghee", "semna"], "fats", [0, 99.5, 0],
    [sv("tsp", "1 teaspoon", "ملعقة صغيرة", 5), sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 13)], "tbsp"),
  food("mayonnaise", "Mayonnaise", "مايونيز", ["mayo", "mayonnaise", "mayonez"], "fats", [1, 75, 3],
    [sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 14)], "tbsp"),
  food("peanut-butter", "Peanut butter", "زبدة فول سوداني", ["peanut butter", "zebdet foul sudani"], "fats", [25, 50, 20],
    [sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 16)], "tbsp"),
  food("choco-spread", "Chocolate hazelnut spread", "كريمة شوكولاتة", ["nutella", "choco spread", "chocolate spread"], "fats", [6, 31, 58],
    [sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 18)], "tbsp"),
  food("qishta", "Qishta (clotted cream)", "قشطة", ["eshta", "ashta", "qishta", "kashta", "cream"], "fats", [3, 25, 4],
    [sv("tbsp", "1 tablespoon", "ملعقة كبيرة", 20)], "tbsp"),

  // ---- grains and supplements
  food("oats", "Oats, dry", "شوفان", ["oatmeal", "oats", "shofan", "porridge"], "grains", [13, 7, 66],
    [sv("serving", "1 serving", "حصة", 40)], "serving"),
  food("corn-flakes", "Corn flakes", "كورن فليكس", ["cornflakes", "corn flakes", "cereal"], "grains", [7.5, 0.9, 84],
    [sv("bowl", "1 bowl", "طبق", 40)], "bowl"),
  food("freekeh", "Freekeh, cooked", "فريك", ["freek", "freekeh", "frikeh"], "grains", [3.5, 0.6, 20],
    [sv("cup", "1 cup", "كوب", 160), sv("plate", "1 plate", "طبق", 250)], "cup"),
  food("whey", "Whey protein powder", "بروتين مصل اللبن", ["whey", "protein powder", "protein shake", "whey protein"], "grains", [80, 5, 8],
    [sv("scoop", "1 scoop", "مغرفة", 30)], "scoop"),
];

const MAX_SERVINGS = 100, MAX_GRAMS = 5000, RECENT_DAYS = 14;

// Lower-case, no diacritics, Arabic letter variants unified, single spaces.
export function normalizeText(s) {
  return String(s ?? "").normalize("NFD").toLowerCase()
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();
}

// 0 = a name starts with the query, 1 = a word does, 2 = it appears inside; -1 = no match.
function matchRank(entry, q) {
  let best = -1;
  for (const raw of [entry.en, entry.ar, ...(entry.alt || [])]) {
    const f = normalizeText(raw); if (!f) continue;
    const r = f.startsWith(q) ? 0 : f.split(" ").some(w => w.startsWith(q)) ? 1 : f.includes(q) ? 2 : -1;
    if (r >= 0 && (best < 0 || r < best)) best = r;
  }
  return best;
}

export function searchFoods(query, { foods = FOODS, extra = [], limit = 50 } = {}) {
  const q = normalizeText(query); if (!q) return [];
  const hits = [];
  [...extra, ...foods].forEach((e, i) => { const r = matchRank(e, q); if (r >= 0) hits.push({ e, r, i }); });
  return hits.sort((a, b) => a.r - b.r || a.i - b.i).slice(0, limit).map(h => h.e);
}

const round1 = n => Math.round(n * 10) / 10;
const has = n => typeof n === "number" && Number.isFinite(n);

// sel: {serving, amount} for a serving, or {serving:"g", grams}. null when the food or numbers can't give a result.
export function portionTotals(food, sel) {
  if (!food || !sel) return null;
  let grams = null, kcal, protein;
  if (sel.serving === "g") {
    if (!has(sel.grams) || sel.grams <= 0 || sel.grams > MAX_GRAMS || !has(food.kcal100)) return null;
    grams = sel.grams; kcal = food.kcal100 * grams / 100; protein = has(food.protein100) ? food.protein100 * grams / 100 : null;
  } else {
    const s = (food.servings || []).find(x => x.id === sel.serving);
    if (!s || !has(sel.amount) || sel.amount <= 0 || sel.amount > MAX_SERVINGS) return null;
    if (has(s.grams)) {
      if (!has(food.kcal100)) return null;
      grams = s.grams * sel.amount; kcal = food.kcal100 * grams / 100; protein = has(food.protein100) ? food.protein100 * grams / 100 : null;
    } else if (has(s.kcal)) { kcal = s.kcal * sel.amount; protein = has(s.protein) ? s.protein * sel.amount : null; }
    else return null;
  }
  return { grams, kcal: Math.round(kcal), protein: protein === null ? null : round1(protein) };
}

export function mealTotals(items) {
  let kcal = 0, protein = 0, anyProtein = false;
  for (const it of items || []) { kcal += it.kcal || 0; if (has(it.protein)) { protein += it.protein; anyProtein = true; } }
  return { kcal: Math.round(kcal), protein: anyProtein ? round1(protein) : null };
}

export function defaultMealName(items) {
  return (items || []).slice(0, 3).map(i => i.name).join(" + ").slice(0, 40);
}

const dayShift = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

// Foods from meals in the last 14 days, most recently logged first, one per src+ref.
export function recentFoods(foodDocs, today, n) {
  const from = dayShift(today, -RECENT_DAYS), seen = new Set(), out = [];
  const docs = [...(foodDocs || [])].filter(d => d && d.date >= from && d.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const d of docs) {
    for (const m of [...(d.meals || [])].reverse()) {
      for (const it of [...(m.items || [])].reverse()) {
        const key = it.src + ":" + it.ref;
        if (seen.has(key)) continue;
        seen.add(key); out.push(it); if (out.length >= n) return out;
      }
    }
  }
  return out;
}

// A stored My food {id, name, per100:{kcal,protein}|null, servings, barcode?} as a table-shaped entry.
export function asEntry(mine) {
  return { id: mine.id, en: mine.name, ar: mine.name, alt: [], group: "mine", kcal100: mine.per100 ? mine.per100.kcal : null,
    protein100: mine.per100 ? mine.per100.protein : null, servings: mine.servings.map(s => ({ id: s.id, en: s.name, ar: s.name, ...(s.grams != null ? { grams: s.grams } : {}), ...(s.kcal != null ? { kcal: s.kcal } : {}), ...(s.protein != null ? { protein: s.protein } : {}) })),
    def: mine.servings[0].id, ...(mine.barcode ? { barcode: mine.barcode } : {}) };
}

// A food the person typed (or scanned): validated and shaped for storage in the `foods` document, or null.
// With grams it keeps per-100 g values (so the grams box works); without, the numbers stay fixed on the serving.
export function makeMyFood({ id, name, kcal, protein, servingName, grams, barcode }) {
  const n = String(name ?? "").trim().slice(0, 60);
  if (!n || !has(kcal) || kcal < 0 || kcal > 5000) return null;
  if (protein != null && (!has(protein) || protein < 0 || protein > 500)) return null;
  if (barcode != null && barcode !== "" && !/^\d{8,14}$/.test(barcode)) return null;
  const sName = String(servingName ?? "").trim().slice(0, 60) || "1 serving";
  const out = { id: id || "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: n, per100: null, servings: [] };
  if (grams != null) {
    if (!has(grams) || grams < 1 || grams > MAX_GRAMS) return null;
    const k = round1(kcal / grams * 100), p = protein == null ? null : round1(protein / grams * 100);
    if (k > 900 || (p !== null && p > 100)) return null;
    out.per100 = { kcal: k, protein: p };
    out.servings.push({ id: "s1", name: sName, grams });
  } else {
    out.servings.push({ id: "s1", name: sName, kcal, ...(protein != null ? { protein } : {}) });
  }
  if (barcode) out.barcode = barcode;
  return out;
}
