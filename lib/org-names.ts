/**
 * The English name of an organogram post, derived from its Bengali one.
 *
 * **The Bengali is the record; the English was invented.** The client,
 * 2026-09-21: *"We need english desk name in organogram. We have only bengali
 * names. Improvise based on bengali name to generate english name."* The chart
 * was transcribed from the 1983 sanctioned organogram, whose posts are named in
 * Bengali, and the English column was written alongside by hand. It drifted,
 * and two of its errors were load-bearing:
 *
 * - **পরীক্ষক was rendered *Inspector*. It means *Examiner*.** That single
 *   substitution is why `.claude/rules` recorded that *"BSTI's organogram
 *   contains no post titled Examiner at all"* while 97 employees are designated
 *   Examiner: the posts were there the whole time under the wrong English word.
 *   Nothing could be seated correctly, so `import:desks` fell back to matching
 *   on grade — which is where the guessed seats came from (D149).
 * - **পরিদর্শক, which genuinely *is* Inspector, was rendered *Field
 *   Inspector*** — a rank BSTI does not have. The client's own report:
 *   *"There are no Field Inspector (Metrology) desk. It should be Inspector
 *   (Metrology)."* The Bengali carries no ফিল্ড at all.
 *
 * So the two words were swapped: the bench (পরীক্ষক, who examines a sample)
 * was labelled with the field officer's word, and the field officer
 * (পরিদর্শক, who inspects a factory) was given an invented one.
 *
 * **Derived rather than stored twice.** `seed-organogram.ts` used to copy an
 * English string out of `data.ts` and the database kept its own, so correcting
 * one left the other to overwrite it at the next seed. Both now call this, and
 * `data.ts`'s English is advisory.
 *
 * Prisma-free (D9): a pure string rule, so the seed, the importer and any
 * screen can apply it without a database.
 */

/** Bengali spelling variants that mean the same word, normalised before lookup. */
const SPELLING: [RegExp, string][] = [
  // "Senior" is written three ways across the chart.
  [/উর্ধ্বতন|উর্ধবতন|ঊর্ধতন/g, "ঊর্ধ্বতন"],
  [/রসাযন/g, "রসায়ন"],
  [/ট্রেক্সটাইল/g, "টেক্সটাইল"],
  [/আউট\s*সোসিং/g, "আউট সোর্সিং"],
  [/মুদ্রক্ষরিক/g, "মুদ্রাক্ষরিক"],
  [/ইলেকটিক্যাল\s*এন্ড\s*ইলেকট্রনিক্স/g, "ইলেকট্রিক্যাল ও ইলেকট্রনিক্স"],
  [/সাঁটমুদ্রাক্ষরিক|সাঁট-মুদ্রাক্ষরিক/g, "সাঁটলিপিকার"],
  [/সাঁটলিপিকার-কাম-/g, "সাঁটলিপিকার কাম "],
  [/হিসাবরক্ষক/g, "হিসাব রক্ষক"],
];

/**
 * The post's own title, longest key first so a compound never loses to its
 * head — *সহকারী পরিচালক* must not match *পরিচালক*.
 */
const HEAD: Record<string, string> = {
  মহাপরিচালক: "Director General",
  "সহকারী পরিচালক": "Assistant Director",
  উপপরিচালক: "Deputy Director",
  পরিচালক: "Director",

  // The two that were swapped. পরীক্ষক examines a sample at a bench;
  // পরিদর্শক inspects a factory in the field.
  "ঊর্ধ্বতন পরীক্ষক": "Senior Examiner",
  পরীক্ষক: "Examiner",
  "ঊর্ধ্বতন পরিদর্শক": "Senior Inspector",
  পরিদর্শক: "Inspector",

  "ফিল্ড অফিসার": "Field Officer",
  "সমন্বয় কর্মকর্তা": "Coordination Officer",
  "সহকারী নিরাপত্তা কর্মকর্তা": "Assistant Security Officer",
  "সহকারী আইন কর্মকর্তা": "Assistant Law Officer",
  "সহকারী নিরীক্ষা কর্মকর্তা": "Assistant Audit Officer",
  "সহকারী হিসাবরক্ষণ কর্মকর্তা": "Assistant Accounts Officer",
  "ডকুমেন্ট কন্ট্রোল অফিসার": "Document Control Officer",
  "ইন্টারনাল অডিট অফিসার": "Internal Audit Officer",
  "ভান্ডার কর্মকর্তা": "Store Officer",
  "ভান্ডার রক্ষক": "Store Keeper",
  প্রোগ্রামার: "Programmer",
  পরিসংখ্যানবিদ: "Statistician",
  সম্পাদক: "Editor",
  লাইব্রেরীয়ান: "Librarian",
  ক্যাটালগার: "Cataloguer",
  অডিটর: "Auditor",
  যন্ত্রবিদ: "Mechanical Engineer",

  "হিসাব রক্ষক কাম ক্যাশিয়ার": "Accountant cum Cashier",
  "হিসাব রক্ষক": "Accountant",
  "হিসাব সহকারী": "Accounts Assistant",
  ক্যাশিয়ার: "Cashier",
  "ইউডিসি-কাম-ক্যাশিয়ার": "UDC cum Cashier",
  "এলডিএ-নিম্নমান করনিক": "LDA (Lower Division Clerk)",
  "প্রধান সহকারী": "Head Assistant",

  "সাঁটলিপিকার কাম কম্পিউটার অপারেটর": "Stenographer cum Computer Operator",
  "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক": "Office Assistant cum Computer Typist",
  "সিনিয়র কম্পিউটার অপারেটর": "Senior Computer Operator",
  "কম্পিউটার অপারেটর": "Computer Operator",
  "কম্পিউটার মুদ্রাক্ষরিক": "Computer Typist",
  "ডাটা এন্ট্রি অপারেটর": "Data Entry Operator",
  "গেস্টেটনার অপারেটর": "Gestetner Operator",

  "অফিস সহায়ক": "Office Assistant",
  // **Attendant, not Bearer.** 14 employees are designated *Lab Attendant* and
  // none *Lab Bearer*; a literal rendering of বাহক left them unseatable for a
  // word nobody uses.
  "ল্যাব বাহক": "Lab Attendant",
  "ল্যাব সহকারী": "Lab Assistant",
  "নিরাপত্তা প্রহরী": "Security Guard",
  ড্রাইভার: "Driver",
  খালাসী: "Khalasi",
  দপ্তরী: "Daftary",

  "ঊর্ধ্বতন কারিগরী সহকারী": "Senior Technical Assistant",
  "ঊর্ধ্বতন কারিগরী সহায়ক": "Senior Technical Assistant",
  "যন্ত্র সাহায্যকারী": "Instrument Assistant",
  "ইন্সট্রুমেন্ট টেকনিশিয়ান": "Instrument Technician",
  ড্রাফ্টসম্যান: "Draftsman",
  ইলেক্ট্রিশিয়ান: "Electrician",
  // *Gauger*, one who gauges — the metrology desk. It read "Gazer".
  "সহকারী গেজার": "Assistant Gauger",
  গ্যাসম্যান: "Gasman",
  "গ্লাস ব্লোয়ার": "Glass Blower",
  ফোরম্যান: "Foreman",
  ফিটার: "Fitter",
  টার্নার: "Turner",
  // A transliteration of মিস্ত্রি, which is a trade and not a name.
  মিন্ত্রি: "Mechanic",
};

/** What goes inside the brackets — the section, wing or discipline. */
const QUALIFIER: Record<string, string> = {
  সিএম: "CM",
  মেট্রোলজি: "Metrology",
  // **Chemical, not Chemistry** — the client's term, and the one the rest of
  // the system already uses: the wing is the Chemical Testing Wing and
  // `Lab.discipline` is `chemical`.
  রসায়ন: "Chemical",
  পদার্থ: "Physical",
  "ফুড ও ব্যাকটেরিওলজি": "Food & Bacteriology",
  পুরকৌশল: "Civil",
  ভৌত: "Physical",
  "ই এন্ড ই": "E & E",
  "পুরকৌশল ও যন্ত্রকৌশল": "Civil & Mechanical",
  যন্ত্রকৌশল: "Mechanical",
  "ইলেকট্রিক্যাল ও ইলেকট্রনিক্স": "Electrical & Electronics",
  টেক্সটাইল: "Textile",
  "পাট ও বস্ত্র": "Jute & Textile",
  "কৃষি ও খাদ্য": "Agriculture & Food",
  "হালাল খাদ্য ও পণ্য": "Halal Food & Product",
  "হালাল সার্টিফিকেশন": "Halal Certification",
  প্রশাসন: "Administration",
  মান: "Standards",
  "হিসাব ও নিরীক্ষা": "Accounts & Audit",
  "হিসাব ও অভ্যন্তরীণ নিরীক্ষা": "Accounts & Internal Audit",
  "পরিকল্পনা ও উন্নয়ন": "Planning & Development",
  "ডকুমেন্ট কন্ট্রোল": "Document Control",
  "ইন্টারনাল অডিট": "Internal Audit",
  "আউট সোর্সিং": "Outsourcing",
};

/**
 * Sections the chart leaves unwritten because the unit already says them.
 *
 * **A bare পরিদর্শক is always Metrology and a bare ফিল্ড অফিসার is always CM**
 * (the client, 2026-09-21). Those posts exist only in a Metrology or a CM
 * section, so the Bengali does not repeat it — but the English name is read on
 * pickers and letters far from the chart, where "Inspector" alone does not say
 * which of two very different jobs it is.
 */
const IMPLIED_QUALIFIER: Record<string, string> = {
  Inspector: "Metrology",
  "Senior Inspector": "Metrology",
  "Field Officer": "CM",
};

/**
 * Where a qualifier reads differently because of the section it sits in.
 *
 * **A branch office has one physical bench, not a section per discipline.** Its
 * Electrical & Electronics posts hang off `Physical Lab, <city>`, and the
 * client wants them named for the bench they are actually on — *Examiner
 * (E & E, Physical)* — which is how Khulna's was already written by hand. Head
 * office keeps the full name, because there the Electrical & Electronics unit
 * is its own section under the Physical Testing Wing.
 */
function contextualQualifier(qualifierEn: string, unitNameEn: string | undefined): string {
  if (qualifierEn === "Electrical & Electronics" && /^Physical Lab,/.test(unitNameEn ?? "")) {
    return "E & E, Physical";
  }
  return qualifierEn;
}

const BENGALI_DIGITS = /^[০-৯\d]+$/;

function normalise(bn: string): string {
  let s = bn.replace(/\s+/g, " ").trim();
  for (const [from, to] of SPELLING) s = s.replace(from, to);
  return s;
}

function byLongestKey(dict: Record<string, string>) {
  return Object.keys(dict).sort((a, b) => b.length - a.length);
}
const HEAD_KEYS = byLongestKey(HEAD);
const QUALIFIER_KEYS = byLongestKey(QUALIFIER);

export type PostNameResult = {
  nameEn: string;
  /** Parts of the Bengali no dictionary covered — the review list. */
  unknown: string[];
};

/**
 * Render one Bengali post name in English.
 *
 * **A bare serial is dropped.** The chart numbers a repeated post
 * *পরিদর্শক (মেট্রোলজি) (২)* to say it is the second of its kind in that
 * section; the English name of the *title* is the same either way, and the
 * count already lives in `sanctionedCount`.
 *
 * **An untranslatable part is returned, never guessed.** The caller reports it
 * rather than writing a name nobody chose — a post title is what somebody's
 * job is called on their own screen.
 */
export function postNameEn(
  nameBn: string,
  /** The unit the post sits in — some names read differently by section. */
  ctx?: { unitNameEn?: string },
): PostNameResult {
  const s = normalise(nameBn);
  const unknown: string[] = [];

  // Pull every bracketed group out; a bare number is a serial, not a qualifier.
  const quals: string[] = [];
  const head = s
    .replace(/\(([^)]*)\)/g, (_, inner: string) => {
      const q = inner.trim();
      if (!q || BENGALI_DIGITS.test(q)) return " ";
      quals.push(q);
      return " ";
    })
    .replace(/\s+/g, " ")
    .trim();

  const headKey = HEAD_KEYS.find((k) => head === k) ?? HEAD_KEYS.find((k) => head.includes(k));
  const headEn = headKey ? HEAD[headKey] : null;
  if (!headEn) unknown.push(head);

  /**
   * **A comma-joined qualifier is translated part by part.**
   *
   * The chart writes a discipline and its section together — *(রসায়ন, মান)*,
   * *(পুরকৌশল, পদার্থ)*, *(ই এন্ড ই, পদার্থ)*. Matching the pair as one string
   * meant the longest key that happened to be a substring won and the rest was
   * dropped, so *(রসায়ন, মান)* came out as plain *Chemical* and the Standards
   * Wing vanished from four post titles. Splitting first also removes the need
   * to enumerate every pair: *পুরকৌশল* + *পদার্থ* compose to *Civil, Physical*
   * on their own.
   */
  const qualsEn = quals.map((q) => {
    const parts = q
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    const translated = parts.map((part) => {
      const key =
        QUALIFIER_KEYS.find((k) => part === k) ?? QUALIFIER_KEYS.find((k) => part.includes(k));
      if (!key) {
        unknown.push(part);
        return part;
      }
      return QUALIFIER[key];
    });
    return contextualQualifier(translated.join(", "), ctx?.unitNameEn);
  });

  // Only where the Bengali names no section at all — an explicit one always
  // wins, so *পরিদর্শক (মেট্রোলজি)* is unaffected.
  if (!qualsEn.length && headEn && IMPLIED_QUALIFIER[headEn]) {
    qualsEn.push(IMPLIED_QUALIFIER[headEn]);
  }

  const nameEn = qualsEn.length
    ? `${headEn ?? head} (${qualsEn.join(") (")})`
    : (headEn ?? head);

  return { nameEn, unknown };
}
