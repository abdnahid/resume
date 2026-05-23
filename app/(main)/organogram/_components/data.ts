export type OrgPost = {
  count: number;
  nameEn: string;
  nameBn: string;
};

export type OrgEntry = {
  id: string;
  nameEn: string;
  nameBn: string;
  staffCount?: number;
  posts?: OrgPost[];
  children?: OrgEntry[];
};

export function sumStaff(entry: OrgEntry): number {
  if (entry.children?.length) {
    return entry.children.reduce((sum, child) => sum + sumStaff(child), 0);
  }
  return entry.staffCount ?? 0;
}

/* ── Wings ── */
export const WINGS: OrgEntry[] = [
  /* ─ Executive (DG) ─ */
  {
    id: "dg-exec",
    nameEn: "Executive (Department of Director General)",
    nameBn: "নির্বাহী (মহাপরিচালক এর দপ্তর)",
    staffCount: 4,
    posts: [
      { count: 1, nameEn: "Director General", nameBn: "মহাপরিচালক" },
      { count: 1, nameEn: "Coordination Officer", nameBn: "সমন্বয় কর্মকর্তা" },
      {
        count: 1,
        nameEn: "Stenographer cum Computer Operator",
        nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
      },
      { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
    ] satisfies OrgPost[],
  },

  /* ─ Admin Wing ─ */
  {
    id: "admin",
    nameEn: "Admin Wing",
    nameBn: "প্রশাসন উইং",
    children: [
      {
        id: "admin-exec",
        nameEn: "Executive (Admin Wing)",
        nameBn: "নির্বাহী (প্রশাসন উইং)",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Director (Admin)",
            nameBn: "পরিচালক (প্রশাসন)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
          },
          { count: 1, nameEn: "Driver", nameBn: "ড্রাইভার" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "admin-branch",
        nameEn: "Admin",
        nameBn: "প্রশাসন",
        children: [
          {
            id: "admin-branch-exec",
            nameEn: "Executive (Admin Branch)",
            nameBn: "নির্বাহী (প্রশাসন শাখা)",
            staffCount: 25,
            posts: [
              {
                count: 2,
                nameEn: "Deputy Director (Administration)",
                nameBn: "উপপরিচালক (প্রশাসন)",
              },
              {
                count: 1,
                nameEn: "Assistant Director (Administration)",
                nameBn: "সহকারী পরিচালক (প্রশাসন)",
              },
              {
                count: 1,
                nameEn: "Assistant Security Officer",
                nameBn: "সহকারী নিরাপত্তা কর্মকর্তা",
              },
              { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
              {
                count: 4,
                nameEn: "Stenographer cum Computer Operator",
                nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
              },
              {
                count: 2,
                nameEn: "LDA (Lower Division Clerk)",
                nameBn: "এলডিএ-নিম্নমান করনিক",
              },
              {
                count: 1,
                nameEn: "Office Assistant cum Computer Typist",
                nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
              },
              { count: 3, nameEn: "Driver", nameBn: "ড্রাইভার" },
              {
                count: 1,
                nameEn: "Gestetner Operator",
                nameBn: "গেস্টেটনার অপারেটর",
              },
              { count: 1, nameEn: "Daftary", nameBn: "দপ্তরী" },
              {
                count: 6,
                nameEn: "Security Guard",
                nameBn: "নিরাপত্তা প্রহরী",
              },
              { count: 2, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
            ],
          },
          {
            id: "admin-law",
            nameEn: "Law",
            nameBn: "আইন",
            staffCount: 2,
            posts: [
              {
                count: 1,
                nameEn: "Assistant Law Officer",
                nameBn: "সহকারী আইন কর্মকর্তা",
              },
              {
                count: 1,
                nameEn: "LDA (Lower Division Clerk)",
                nameBn: "এলডিএ-নিম্নমান করনিক",
              },
            ],
          },
          {
            id: "admin-ict",
            nameEn: "ICT",
            nameBn: "আইসিটি",
            staffCount: 7,
            posts: [
              { count: 1, nameEn: "Programmer", nameBn: "প্রোগ্রামার" },
              {
                count: 1,
                nameEn: "Senior Computer Operator",
                nameBn: "সিনিয়র কম্পিউটার অপারেটর",
              },
              {
                count: 1,
                nameEn: "Computer Operator",
                nameBn: "কম্পিউটার অপারেটর",
              },
              {
                count: 3,
                nameEn: "Data Entry Operator",
                nameBn: "ডাটা এন্ট্রি অপারেটর",
              },
              { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
            ],
          },
          {
            id: "admin-oss",
            nameEn: "One Stop Service",
            nameBn: "ওয়ান স্টপ সার্ভিস",
            staffCount: 9,
            posts: [
              {
                count: 1,
                nameEn: "Assistant Director (CM)",
                nameBn: "সহকারী পরিচালক (সিএম)",
              },
              {
                count: 1,
                nameEn: "Field Officer (CM)",
                nameBn: "ফিল্ড অফিসার (সিএম)",
              },
              {
                count: 1,
                nameEn: "Inspector (Metrology)",
                nameBn: "পরিদর্শক (মেট্রোলজি)",
              },
              {
                count: 1,
                nameEn: "Accountant cum Cashier",
                nameBn: "হিসাব রক্ষক কাম ক্যাশিয়ার",
              },
              {
                count: 1,
                nameEn: "LDA (Lower Division Clerk)",
                nameBn: "এলডিএ-নিম্নমান করনিক",
              },
              {
                count: 1,
                nameEn: "Computer Typist",
                nameBn: "কম্পিউটার মুদ্রাক্ষরিক",
              },
              {
                count: 2,
                nameEn: "Data Entry Operator",
                nameBn: "ডাটা এন্ট্রি অপারেটর",
              },
              { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
            ],
          },
          {
            id: "admin-store",
            nameEn: "Store & Purchase",
            nameBn: "ভান্ডার ও ক্রয়",
            staffCount: 6,
            posts: [
              {
                count: 1,
                nameEn: "Store Officer",
                nameBn: "ভান্ডার কর্মকর্তা",
              },
              { count: 1, nameEn: "Inspector", nameBn: "পরীক্ষক" },
              { count: 1, nameEn: "Store Keeper", nameBn: "ভান্ডার রক্ষক" },
              {
                count: 1,
                nameEn: "Stenographer cum Computer Operator",
                nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
              },
              {
                count: 1,
                nameEn: "Computer Typist",
                nameBn: "কম্পিউটার মুদ্রাক্ষরিক",
              },
              { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
            ],
          },
        ],
      },
      {
        id: "accounts",
        nameEn: "Accounts & Internal Audit",
        nameBn: "হিসাব ও অভ্যন্তরীণ নিরীক্ষা",
        staffCount: 14,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Accounts & Audit)",
            nameBn: "উপপরিচালক (হিসাব ও নিরীক্ষা)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Accounts & Internal Audit)",
            nameBn: "সহকারী পরিচালক (হিসাব ও অভ্যন্তরীণ নিরীক্ষা)",
          },
          {
            count: 1,
            nameEn: "Assistant Audit Officer",
            nameBn: "সহকারী নিরীক্ষা কর্মকর্তা",
          },
          {
            count: 1,
            nameEn: "Assistant Accounts Officer",
            nameBn: "সহকারী হিসাবরক্ষণ কর্মকর্তা",
          },
          { count: 1, nameEn: "Auditor", nameBn: "অডিটর" },
          { count: 2, nameEn: "Accountant", nameBn: "হিসাবরক্ষক" },
          { count: 1, nameEn: "Accounts Assistant", nameBn: "হিসাব সহকারী" },
          {
            count: 1,
            nameEn: "UDC cum Cashier",
            nameBn: "ইউডিসি-কাম-ক্যাশিয়ার",
          },
          { count: 1, nameEn: "Cashier", nameBn: "ক্যাশিয়ার" },
          {
            count: 2,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          {
            count: 1,
            nameEn: "Computer Typist",
            nameBn: "কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Daftary", nameBn: "দপ্তরী" },
        ],
      },
      {
        id: "planning",
        nameEn: "Planning & Development",
        nameBn: "পরিকল্পনা ও উন্নয়ন",
        staffCount: 6,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Planning & Development)",
            nameBn: "উপপরিচালক (পরিকল্পনা ও উন্নয়ন)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Planning & Development)",
            nameBn: "সহকারী পরিচালক (পরিকল্পনা ও উন্নয়ন)",
          },
          { count: 1, nameEn: "Statistician", nameBn: "পরিসংখ্যানবিদ" },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Computer Typist",
            nameBn: "কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* ─ Standards Wing ─ */
  {
    id: "standards",
    nameEn: "Standards Wing",
    nameBn: "মানদণ্ড উইং",
    children: [
      {
        id: "std-exec",
        nameEn: "Executive (Standards Wing)",
        nameBn: "নির্বাহী (মানদণ্ড উইং)",
        staffCount: 4,
        posts: [
          { count: 1, nameEn: "Director (Standards)", nameBn: "পরিচালক (মান)" },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-pub",
        nameEn: "Publication & Mass Communication",
        nameBn: "পাবলিকেশন ও গণসংযোগ বিভাগ",
        staffCount: 6,
        posts: [
          { count: 1, nameEn: "Editor", nameBn: "সম্পাদক" },
          { count: 1, nameEn: "Librarian", nameBn: "লাইব্রেরীয়ান" },
          {
            count: 1,
            nameEn: "Computer Typist",
            nameBn: "কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Cataloguer", nameBn: "ক্যাটালগার" },
          { count: 1, nameEn: "Draftsman", nameBn: "ড্রাফ্টসম্যান" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-agri",
        nameEn: "Agriculture & Food",
        nameBn: "কৃষি ও খাদ্য বিভাগ",
        staffCount: 8,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Agriculture & Food)",
            nameBn: "উপপরিচালক (কৃষি ও খাদ্য)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Agriculture & Food)",
            nameBn: "সহকারী পরিচালক (কৃষি ও খাদ্য)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Agriculture & Food)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (কৃষি ও খাদ্য)",
          },
          {
            count: 2,
            nameEn: "Inspector (Agriculture & Food)",
            nameBn: "পরীক্ষক (কৃষি ও খাদ্য)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-chem",
        nameEn: "Chemical",
        nameBn: "রসায়ন বিভাগ",
        staffCount: 8,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-jute",
        nameEn: "Jute & Textile",
        nameBn: "পাট ও বস্ত্র বিভাগ",
        staffCount: 8,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Jute & Textile)",
            nameBn: "উপপরিচালক (পাট ও বস্ত্র)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Jute & Textile)",
            nameBn: "সহকারী পরিচালক (পাট ও বস্ত্র)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Jute & Textile)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (পাট ও বস্ত্র)",
          },
          {
            count: 2,
            nameEn: "Inspector (Jute & Textile)",
            nameBn: "পরীক্ষক (পাট ও বস্ত্র)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-elec",
        nameEn: "Electrical & Electronics",
        nameBn: "ইলেকট্রিক্যাল, ইলেকট্রনিক্স ও কারিগরী বিভাগ",
        staffCount: 9,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Electrical & Electronics)",
            nameBn: "উপপরিচালক (ইলেকট্রিক্যাল ও ইলেকট্রনিক্স)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Electrical & Electronics)",
            nameBn: "সহকারী পরিচালক (ইলেকট্রিক্যাল ও ইলেকট্রনিক্স)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Electrical & Electronics)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (ইলেকট্রিক্যাল ও ইলেকট্রনিক্স)",
          },
          {
            count: 2,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকট্রিক্যাল ও ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-civil",
        nameEn: "Civil & Mechanical",
        nameBn: "পুরকৌশল ও যন্ত্রকৌশল বিভাগ",
        staffCount: 9,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Civil & Mechanical)",
            nameBn: "উপপরিচালক (পুরকৌশল ও যন্ত্রকৌশল)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Civil & Mechanical)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল ও যন্ত্রকৌশল)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Civil & Mechanical)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (পুরকৌশল ও যন্ত্রকৌশল)",
          },
          {
            count: 2,
            nameEn: "Inspector (Civil & Mechanical)",
            nameBn: "পরীক্ষক (পুরকৌশল ও যন্ত্রকৌশল)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "std-halal",
        nameEn: "Halal Food & Product",
        nameBn: "হালাল খাদ্য ও পণ্য বিভাগ",
        staffCount: 9,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Halal Food & Product)",
            nameBn: "উপপরিচালক (হালাল খাদ্য ও পণ্য)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Halal Food & Product)",
            nameBn: "সহকারী পরিচালক (হালাল খাদ্য ও পণ্য)",
          },
          {
            count: 4,
            nameEn: "Inspector (Halal Food & Product)",
            nameBn: "পরীক্ষক (হালাল খাদ্য ও পণ্য)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* ─ Certification Marks Wing ─ */
  {
    id: "cert-marks",
    nameEn: "Certification Marks Wing",
    nameBn: "সার্টিফিকেশন মার্কস উইং",
    children: [
      {
        id: "cm-exec",
        nameEn: "Executive (Certification Marks Wing)",
        nameBn: "নির্বাহী (সার্টিফিকেশন মার্কস উইং)",
        staffCount: 4,
        posts: [
          { count: 1, nameEn: "Director", nameBn: "পরিচালক" },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "cm-training",
        nameEn: "Training",
        nameBn: "প্রশিক্ষণ বিভাগ",
        staffCount: 11,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 4,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 2,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "cm-cm",
        nameEn: "CM Dhaka",
        nameBn: "সিএম ঢাকা",
        staffCount: 17,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 11,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "cm-halal",
        nameEn: "Halal Certification",
        nameBn: "হালাল সার্টিফিকেশন বিভাগ",
        staffCount: 6,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Halal Certification)",
            nameBn: "উপপরিচালক (হালাল সার্টিফিকেশন)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Halal Certification)",
            nameBn: "সহকারী পরিচালক (হালাল সার্টিফিকেশন)",
          },
          {
            count: 2,
            nameEn: "Field Officer (Halal Certification)",
            nameBn: "ফিল্ড অফিসার (হালাল সার্টিফিকেশন)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* ─ Physical Testing Wing ─ */
  {
    id: "physics",
    nameEn: "Physical Testing Wing",
    nameBn: "পদার্থ পরীক্ষণ উইং",
    children: [
      {
        id: "pt-exec",
        nameEn: "Executive (Physical Testing Wing)",
        nameBn: "নির্বাহী (পদার্থ পরীক্ষণ উইং)",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Director (Physics)",
            nameBn: "পরিচালক (পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "pt-textile",
        nameEn: "Textile",
        nameBn: "ট্রেক্সটাইল বিভাগ",
        staffCount: 15,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Textile)",
            nameBn: "উপপরিচালক (ট্রেক্সটাইল)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Textile)",
            nameBn: "সহকারী পরিচালক (ট্রেক্সটাইল)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Textile)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (ট্রেক্সটাইল)",
          },
          {
            count: 4,
            nameEn: "Inspector (Textile)",
            nameBn: "পরীক্ষক (ট্রেক্সটাইল)",
          },
          {
            count: 1,
            nameEn: "Instrument Technician",
            nameBn: "ইন্সট্রুমেন্ট টেকনিশিয়ান",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
          { count: 1, nameEn: "Khalasi", nameBn: "খালাসী" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "pt-elec",
        nameEn: "Electrical & Electronics",
        nameBn: "ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স বিভাগ",
        staffCount: 22,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Electrical & Electronics)",
            nameBn: "উপপরিচালক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 3,
            nameEn: "Assistant Director (Electrical & Electronics)",
            nameBn: "সহকারী পরিচালক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 3,
            nameEn: "Senior Inspector (Electrical & Electronics)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 6,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Senior Technical Assistant",
            nameBn: "ঊর্ধ্বতন কারিগরী সহকারী",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 3, nameEn: "Electrician", nameBn: "ইলেক্ট্রিশিয়ান" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
          { count: 1, nameEn: "Khalasi", nameBn: "খালাসী" },
        ],
      },
      {
        id: "pt-civil",
        nameEn: "Civil Physical",
        nameBn: "পুরকৌশল, পদার্থ (ধাতব, সিরামিক ও প্লাস্টিক) বিভাগ",
        staffCount: 20,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Civil, Materials)",
            nameBn: "উপপরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 4,
            nameEn: "Assistant Director (Civil, Materials)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Civil, Materials)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 4,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          { count: 1, nameEn: "Foreman", nameBn: "ফোরম্যান" },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Assistant Gazer", nameBn: "সহকারী গেজার" },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Fitter", nameBn: "ফিটার" },
          { count: 1, nameEn: "Turner", nameBn: "টার্নার" },
          { count: 1, nameEn: "Minstri", nameBn: "মিন্ত্রি" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
          { count: 1, nameEn: "Khalasi", nameBn: "খালাসী" },
        ],
      },
      {
        id: "pt-mech",
        nameEn: "Mechanical",
        nameBn: "যন্ত্রকৌশল বিভাগ",
        staffCount: 11,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Mechanical)",
            nameBn: "সহকারী পরিচালক (যন্ত্রকৌশল)",
          },
          {
            count: 4,
            nameEn: "Inspector (Mechanical)",
            nameBn: "পরীক্ষক (যন্ত্রকৌশল)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
          {
            count: 1,
            nameEn: "Instrument Technician",
            nameBn: "ইন্সট্রুমেন্ট টেকনিশিয়ান",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Assistant Gazer", nameBn: "সহকারী গেজার" },
          { count: 1, nameEn: "Khalasi", nameBn: "খালাসী" },
        ],
      },
    ],
  },

  /* ─ Chemical Testing Wing ─ */
  {
    id: "chem",
    nameEn: "Chemical Testing Wing",
    nameBn: "রাসায়নিক পরীক্ষণ উইং",
    children: [
      {
        id: "ct-exec",
        nameEn: "Executive (Chemical Testing Wing)",
        nameBn: "নির্বাহী (রাসায়নিক পরীক্ষণ উইং)",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Director (Chemistry)",
            nameBn: "পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ct-organic",
        nameEn: "Organic Chemistry",
        nameBn: "জৈব রসায়ন বিভাগ",
        staffCount: 18,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
          {
            count: 3,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 4,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 2, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Glass Blower", nameBn: "গ্লাস ব্লোয়ার" },
          { count: 3, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ct-inorganic",
        nameEn: "Inorganic Chemistry",
        nameBn: "অজৈব রসায়ন বিভাগ",
        staffCount: 16,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 4,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Senior Technical Assistant",
            nameBn: "ঊর্ধ্বতন কারিগরী সহায়ক",
          },
          {
            count: 2,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 2, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Gasman", nameBn: "গ্যাসম্যান" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ct-food",
        nameEn: "Food & Bacteriology",
        nameBn: "ফুড ও ব্যাকটেরিওলজি বিভাগ",
        staffCount: 24,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Food & Bacteriology)",
            nameBn: "উপপরিচালক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 3,
            nameEn: "Assistant Director (Food & Bacteriology)",
            nameBn: "সহকারী পরিচালক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 4,
            nameEn: "Senior Inspector (Food & Bacteriology)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 7,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 1,
            nameEn: "Senior Technical Assistant",
            nameBn: "ঊর্ধ্বতন কারিগরী সহকারী",
          },
          {
            count: 2,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 2, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Gasman", nameBn: "গ্যাসম্যান" },
          { count: 3, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
        ],
      },
      {
        id: "ct-pmo",
        nameEn: "Chemical Lab (Prime Minister Office)",
        nameBn: "রসায়ন ল্যাব, প্রধানমন্ত্রীর কার্যালয়",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Food & Bacteriology)",
            nameBn: "সহকারী পরিচালক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
    ],
  },

  /* ─ Metrology Wing ─ */
  {
    id: "metro",
    nameEn: "Metrology Wing",
    nameBn: "মেট্রোলজি উইং",
    children: [
      {
        id: "mt-exec",
        nameEn: "Executive (Metrology Wing)",
        nameBn: "নির্বাহী (মেট্রোলজি উইং)",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Director (Metrology)",
            nameBn: "পরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "mt-metro",
        nameEn: "Legal Metrology",
        nameBn: "লিগ্যাল মেট্রোলজি",
        staffCount: 13,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Metrology)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Inspector (Metrology)",
            nameBn: "পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 6,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "mt-lab",
        nameEn: "Metrology Laboratory & Training",
        nameBn: "মেট্রোলজি পরীক্ষাগার ও প্রশিক্ষণ",
        staffCount: 8,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Metrology)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Inspector (Metrology)",
            nameBn: "পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "mt-ind",
        nameEn: "Industrial & Scientific Metrology",
        nameBn: "শিল্প ও বৈজ্ঞানিক মেট্রোলজি",
        staffCount: 6,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Metrology)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Inspector (Metrology)",
            nameBn: "পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "mt-nml-chem",
        nameEn: "National Metrology Lab (Chemical)",
        nameBn: "ন্যাশনাল মেট্রোলজি ল্যাব (রসায়ন)",
        staffCount: 23,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 6,
            nameEn: "Inspector (Metrology, Chemistry)",
            nameBn: "পরীক্ষক (মেট্রোলজি, রসায়ন)",
          },
          {
            count: 6,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Computer Operator",
            nameBn: "কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রক্ষরিক",
          },
          { count: 4, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 2, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "mt-nml-civil",
        nameEn: "National Metrology Lab (Physical)",
        nameBn: "ন্যাশনাল মেট্রোলজি ল্যাব (ভৌত)",
        staffCount: 18,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 8,
            nameEn: "Inspector (Metrology, Physical)",
            nameBn: "পরীক্ষক (মেট্রোলজি, ভৌত)",
          },
          {
            count: 2,
            nameEn: "Computer Operator",
            nameBn: "কম্পিউটার অপারেটর",
          },
          { count: 3, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          {
            count: 1,
            nameEn: "Electrician (Outsourcing)",
            nameBn: "ইলেক্ট্রিশিয়ান (আউট সোসিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* ─ Management Systems & Certification ─ */
  {
    id: "mgmt-sys",
    nameEn: "Management Systems Certification Wing",
    nameBn: "ম্যানেজমেন্ট সিস্টেম সার্টিফিকেশন উইং",
    children: [
      {
        id: "ms-doc",
        nameEn: "Document Control",
        nameBn: "ডকুমেন্ট কন্ট্রোল শাখা",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Document Control)",
            nameBn: "উপপরিচালক (ডকুমেন্ট কন্ট্রোল)",
          },
          {
            count: 1,
            nameEn: "Document Control Officer",
            nameBn: "ডকুমেন্ট কন্ট্রোল অফিসার",
          },
          {
            count: 1,
            nameEn: "Computer Operator",
            nameBn: "কম্পিউটার অপারেটর",
          },
        ],
      },
      {
        id: "ms-audit",
        nameEn: "Internal Audit",
        nameBn: "ইন্টারনাল অডিট শাখা",
        staffCount: 5,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Internal Audit)",
            nameBn: "উপপরিচালক (ইন্টারনাল অডিট)",
          },
          {
            count: 2,
            nameEn: "Internal Audit Officer",
            nameBn: "ইন্টারনাল অডিট অফিসার",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
          {
            count: 1,
            nameEn: "Office Assistant (Outsourcing)",
            nameBn: "অফিস সহায়ক (আউট সোসিং)",
          },
        ],
      },
    ],
  },
];

/* ── Divisional offices ── */
export const DIVISIONAL_OFFICES: OrgEntry[] = [
  /* DMI — flat, no sub-departments */
  {
    id: "dmi",
    nameEn: "Divisional Metrology Inspectorate (DMI)",
    nameBn: "বিভাগীয় মেট্রোলজি ইন্সপেক্টরেট (ডিএমআই)",
    staffCount: 24,
    posts: [
      {
        count: 1,
        nameEn: "Deputy Director (Metrology)",
        nameBn: "উপপরিচালক (মেট্রোলজি)",
      },
      {
        count: 3,
        nameEn: "Assistant Director (Metrology)",
        nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
      },
      {
        count: 12,
        nameEn: "Field Inspector (Metrology)",
        nameBn: "পরিদর্শক (মেট্রোলজি)",
      },
      { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
      { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
      { count: 1, nameEn: "UDC cum Cashier", nameBn: "ইউডিসি-কাম-ক্যাশিয়ার" },
      {
        count: 1,
        nameEn: "Stenographer cum Computer Operator",
        nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
      },
      {
        count: 1,
        nameEn: "Office Assistant cum Computer Typist",
        nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
      },
      {
        count: 1,
        nameEn: "Instrument Assistant",
        nameBn: "যন্ত্র সাহায্যকারী",
      },
      { count: 1, nameEn: "Draftsman", nameBn: "ড্রাফ্টসম্যান" },
      { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
    ],
  },

  /* Chittagong */
  {
    id: "ctg",
    nameEn: "Chittagong",
    nameBn: "চট্টগ্রাম",
    children: [
      {
        id: "ctg-exec",
        nameEn: "Executive (Chittagong)",
        nameBn: "নির্বাহী (চট্টগ্রাম)",
        staffCount: 4,
        posts: [
          { count: 1, nameEn: "Director", nameBn: "পরিচালক" },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটলিপিকার-কাম-কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ctg-cm",
        nameEn: "CM, Chittagong",
        nameBn: "সিএম, চট্টগ্রাম",
        staffCount: 12,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 6,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ctg-metro",
        nameEn: "Metrology, Chittagong",
        nameBn: "মেট্রোলজি, চট্টগ্রাম",
        staffCount: 16,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 3,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 7,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
          {
            count: 1,
            nameEn: "Instrument Assistant",
            nameBn: "যন্ত্র সাহায্যকারী",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ctg-chem",
        nameEn: "Chemistry Lab, Chittagong",
        nameBn: "রসায়ন ল্যাব, চট্টগ্রাম",
        staffCount: 19,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
          {
            count: 4,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Food & Bacteriology)",
            nameBn: "সহকারী পরিচালক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 2,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 6,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "ctg-phys",
        nameEn: "Physical Lab, Chittagong",
        nameBn: "পদার্থ ল্যাব, চট্টগ্রাম",
        staffCount: 10,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Physical)",
            nameBn: "উপপরিচালক (পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Electrical & Electronics)",
            nameBn: "সহকারী পরিচালক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Civil, Materials)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Civil, Materials)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Electrician", nameBn: "ইলেক্ট্রিশিয়ান" },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
        ],
      },
      {
        id: "ctg-admin",
        nameEn: "Administration, Chittagong",
        nameBn: "প্রশাসন, চট্টগ্রাম",
        staffCount: 8,
        posts: [
          { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
          {
            count: 1,
            nameEn: "UDC cum Cashier",
            nameBn: "ইউডিসি-কাম-ক্যাশিয়ার",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Store Keeper", nameBn: "ভান্ডার রক্ষক" },
          { count: 4, nameEn: "Security Guard", nameBn: "নিরাপত্তা প্রহরী" },
        ],
      },
    ],
  },

  /* Rajshahi */
  {
    id: "rajshahi",
    nameEn: "Rajshahi",
    nameBn: "রাজশাহী",
    children: [
      {
        id: "raj-exec",
        nameEn: "Executive (Rajshahi)",
        nameBn: "নির্বাহী (রাজশাহী)",
        staffCount: 4,
        posts: [
          { count: 1, nameEn: "Director", nameBn: "পরিচালক" },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটমুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "raj-cm",
        nameEn: "CM, Rajshahi",
        nameBn: "সিএম, রাজশাহী",
        staffCount: 10,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 5,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "raj-metro",
        nameEn: "Metrology, Rajshahi",
        nameBn: "মেট্রোলজি, রাজশাহী",
        staffCount: 16,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 9,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
          { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          {
            count: 1,
            nameEn: "Instrument Assistant",
            nameBn: "যন্ত্র সাহায্যকারী",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "raj-chem",
        nameEn: "Chemistry Lab, Rajshahi",
        nameBn: "রসায়ন ল্যাব, রাজশাহী",
        staffCount: 7,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "উর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 3,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
        ],
      },
      {
        id: "raj-phys",
        nameEn: "Physical Lab, Rajshahi",
        nameBn: "পদার্থ ল্যাব, রাজশাহী",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Civil, Materials)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          { count: 1, nameEn: "Electrician", nameBn: "ইলেক্ট্রিশিয়ান" },
        ],
      },
      {
        id: "raj-admin",
        nameEn: "Administration, Rajshahi",
        nameBn: "প্রশাসন, রাজশাহী",
        staffCount: 4,
        posts: [
          { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
          {
            count: 1,
            nameEn: "UDC cum Cashier",
            nameBn: "ইউডিসি-কাম-ক্যাশিয়ার",
          },
          { count: 2, nameEn: "Security Guard", nameBn: "নিরাপত্তা প্রহরী" },
        ],
      },
    ],
  },

  /* Khulna */
  {
    id: "khulna",
    nameEn: "Khulna",
    nameBn: "খুলনা",
    children: [
      {
        id: "khu-exec",
        nameEn: "Executive (Khulna)",
        nameBn: "নির্বাহী (খুলনা)",
        staffCount: 4,
        posts: [
          { count: 1, nameEn: "Director", nameBn: "পরিচালক" },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁটমুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          {
            count: 1,
            nameEn: "Driver (Outsourcing)",
            nameBn: "ড্রাইভার (আউট সোর্সিং)",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "khu-cm",
        nameEn: "CM, Khulna",
        nameBn: "সিএম, খুলনা",
        staffCount: 10,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 5,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "khu-metro",
        nameEn: "Metrology, Khulna",
        nameBn: "মেট্রোলজি, খুলনা",
        staffCount: 13,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 6,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Stenographer cum Computer Operator",
            nameBn: "সাঁট-মুদ্রাক্ষরিক কাম কম্পিউটার অপারেটর",
          },
          { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
          {
            count: 1,
            nameEn: "Instrument Assistant",
            nameBn: "যন্ত্র সাহায্যকারী",
          },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "khu-chem",
        nameEn: "Chemistry Lab, Khulna",
        nameBn: "রসায়ন ল্যাব, খুলনা",
        staffCount: 11,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 3,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 1,
            nameEn: "Office Assistant cum Computer Typist",
            nameBn: "অফিস সহকারী কাম কম্পিউটার মুদ্রাক্ষরিক",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "khu-phys",
        nameEn: "Physical Lab, Khulna",
        nameBn: "পদার্থ ল্যাব, খুলনা",
        staffCount: 8,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Physical)",
            nameBn: "উপপরিচালক (পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Civil, Materials)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Electrical & Electronics)",
            nameBn: "ঊর্ধ্বতন পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
          { count: 1, nameEn: "Electrician", nameBn: "ইলেক্ট্রিশিয়ান" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
        ],
      },
      {
        id: "khu-admin",
        nameEn: "Administration, Khulna",
        nameBn: "প্রশাসন, খুলনা",
        staffCount: 7,
        posts: [
          { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
          {
            count: 1,
            nameEn: "UDC cum Cashier",
            nameBn: "ইউডিসি-কাম-ক্যাশিয়ার",
          },
          { count: 1, nameEn: "Store Keeper", nameBn: "ভান্ডার রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
          { count: 3, nameEn: "Security Guard", nameBn: "নিরাপত্তা প্রহরী" },
        ],
      },
    ],
  },

  /* Sylhet — no office-level director data provided */
  {
    id: "sylhet",
    nameEn: "Sylhet",
    nameBn: "সিলেট",
    children: [
      {
        id: "syl-cm",
        nameEn: "CM, Sylhet",
        nameBn: "সিএম, সিলেট",
        staffCount: 7,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 4,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
        ],
      },
      {
        id: "syl-metro",
        nameEn: "Metrology, Sylhet",
        nameBn: "মেট্রোলজি, সিলেট",
        staffCount: 9,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 4,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
          { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
          {
            count: 1,
            nameEn: "Office Assistant (Outsourcing)",
            nameBn: "অফিস সহায়ক (আউট সোর্সিং)",
          },
        ],
      },
      {
        id: "syl-chem",
        nameEn: "Chemistry Lab, Sylhet",
        nameBn: "রসায়ন পরীক্ষণ ল্যাব, সিলেট",
        staffCount: 5,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
        ],
      },
      {
        id: "syl-phys",
        nameEn: "Physical Lab, Sylhet",
        nameBn: "পদার্থ ল্যাব, সিলেট",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Civil, Materials)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
        ],
      },
      {
        id: "syl-admin",
        nameEn: "Administration, Sylhet",
        nameBn: "প্রশাসন, সিলেট",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
          {
            count: 1,
            nameEn: "UDC cum Cashier",
            nameBn: "ইউডিসি-কাম-ক্যাশিয়ার",
          },
        ],
      },
    ],
  },

  /* Barisal */
  {
    id: "barisal",
    nameEn: "Barisal",
    nameBn: "বরিশাল",
    children: [
      {
        id: "bar-exec",
        nameEn: "Executive (Barisal)",
        nameBn: "নির্বাহী (বরিশাল)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "bar-cm",
        nameEn: "CM, Barisal",
        nameBn: "সিএম, বরিশাল",
        staffCount: 6,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 4,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
        ],
      },
      {
        id: "bar-metro",
        nameEn: "Metrology, Barisal",
        nameBn: "মেট্রোলজি, বরিশাল",
        staffCount: 8,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 4,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
          {
            count: 1,
            nameEn: "Data Entry Operator",
            nameBn: "ডাটা এন্ট্রি অপারেটর",
          },
          { count: 1, nameEn: "Mechanical Engineer", nameBn: "যন্ত্রবিদ" },
          {
            count: 1,
            nameEn: "Office Assistant (Outsourcing)",
            nameBn: "অফিস সহায়ক (আউট সোর্সিং)",
          },
        ],
      },
      {
        id: "bar-chem",
        nameEn: "Chemistry Lab, Barisal",
        nameBn: "রসায়ন ল্যাব, বরিশাল",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
          { count: 1, nameEn: "Lab Bearer", nameBn: "ল্যাব বাহক" },
        ],
      },
      {
        id: "bar-phys",
        nameEn: "Physical Lab, Barisal",
        nameBn: "পদার্থ ল্যাব, বরিশাল",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Electrical & Electronics)",
            nameBn: "সহকারী পরিচালক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
          { count: 1, nameEn: "Lab Assistant", nameBn: "ল্যাব সহকারী" },
        ],
      },
      {
        id: "bar-admin",
        nameEn: "Administration, Barisal",
        nameBn: "প্রশাসন, বরিশাল",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Head Assistant", nameBn: "প্রধান সহকারী" },
          {
            count: 1,
            nameEn: "UDC cum Cashier",
            nameBn: "ইউডিসি-কাম-ক্যাশিয়ার",
          },
        ],
      },
    ],
  },

  /* Rangpur */
  {
    id: "rangpur",
    nameEn: "Rangpur",
    nameBn: "রংপুর",
    children: [
      {
        id: "ran-exec",
        nameEn: "Executive (Rangpur)",
        nameBn: "নির্বাহী (রংপুর)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Physical)",
            nameBn: "উপপরিচালক (পদার্থ)",
          },
        ],
      },
      {
        id: "ran-cm",
        nameEn: "CM, Rangpur",
        nameBn: "সিএম, রংপুর",
        staffCount: 8,
        posts: [
          {
            count: 2,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 6,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
        ],
      },
      {
        id: "ran-metro",
        nameEn: "Metrology, Rangpur",
        nameBn: "মেট্রোলজি, রংপুর",
        staffCount: 6,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 5,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "ran-chem",
        nameEn: "Chemistry Lab, Rangpur",
        nameBn: "রসায়ন ল্যাব, রংপুর",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "উর্ধ্বতন পরীক্ষক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "ran-phys",
        nameEn: "Physical Lab, Rangpur",
        nameBn: "পদার্থ ল্যাব, রংপুর",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
        ],
      },
      {
        id: "ran-admin",
        nameEn: "Administration, Rangpur",
        nameBn: "প্রশাসন, রংপুর",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাবরক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Mymensingh */
  {
    id: "mymensingh",
    nameEn: "Mymensingh",
    nameBn: "ময়মনসিংহ",
    children: [
      {
        id: "mym-exec",
        nameEn: "Executive (Mymensingh)",
        nameBn: "নির্বাহী (ময়মনসিংহ)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
        ],
      },
      {
        id: "mym-cm",
        nameEn: "CM, Mymensingh",
        nameBn: "সিএম, ময়মনসিংহ",
        staffCount: 5,
        posts: [
          {
            count: 2,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
        ],
      },
      {
        id: "mym-metro",
        nameEn: "Metrology, Mymensingh",
        nameBn: "মেট্রোলজি, ময়মনসিংহ",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "mym-chem",
        nameEn: "Chemistry Lab, Mymensingh",
        nameBn: "রসায়ন ল্যাব, ময়মনসিংহ",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 2,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "mym-admin",
        nameEn: "Administration, Mymensingh",
        nameBn: "প্রশাসন, ময়মনসিংহ",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাবরক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },
];

/* ── Regional offices ── */
export const REGIONAL_OFFICES: OrgEntry[] = [
  /* Bogura */
  {
    id: "bogura",
    nameEn: "Bogura",
    nameBn: "বগুড়া",
    children: [
      {
        id: "bogura-exec",
        nameEn: "Executive (Bogura)",
        nameBn: "নির্বাহী (বগুড়া)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Physical)",
            nameBn: "উপপরিচালক (পদার্থ)",
          },
        ],
      },
      {
        id: "bogura-cm",
        nameEn: "CM, Bogura",
        nameBn: "সিএম, বগুড়া",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (২)",
          },
        ],
      },
      {
        id: "bogura-metro",
        nameEn: "Metrology, Bogura",
        nameBn: "মেট্রোলজি, বগুড়া",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (২)",
          },
        ],
      },
      {
        id: "bogura-chem",
        nameEn: "Chemistry Lab, Bogura",
        nameBn: "রসায়ন ল্যাব, বগুড়া",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
      {
        id: "bogura-phys",
        nameEn: "Physical Lab, Bogura",
        nameBn: "পদার্থ ল্যাব, বগুড়া",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
        ],
      },
      {
        id: "bogura-admin",
        nameEn: "Administration, Bogura",
        nameBn: "প্রশাসন, বগুড়া",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Cumilla */
  {
    id: "cumilla",
    nameEn: "Cumilla",
    nameBn: "কুমিল্লা",
    children: [
      {
        id: "cumilla-exec",
        nameEn: "Executive (Cumilla)",
        nameBn: "নির্বাহী (কুমিল্লা)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
        ],
      },
      {
        id: "cumilla-cm",
        nameEn: "CM, Cumilla",
        nameBn: "সিএম, কুমিল্লা",
        staffCount: 5,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 4,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
        ],
      },
      {
        id: "cumilla-metro",
        nameEn: "Metrology, Cumilla",
        nameBn: "মেট্রোলজি, কুমিল্লা",
        staffCount: 7,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 6,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "cumilla-chem",
        nameEn: "Chemistry Lab, Cumilla",
        nameBn: "রসায়ন ল্যাব, কুমিল্লা",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Senior Inspector (Chemistry)",
            nameBn: "উর্ধবতন পরীক্ষক (রসাযন)",
          },
          {
            count: 2,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "cumilla-admin",
        nameEn: "Administration, Cumilla",
        nameBn: "প্রশাসন, কুমিল্লা",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Cox's Bazar */
  {
    id: "coxsbazar",
    nameEn: "Cox's Bazar",
    nameBn: "কক্সবাজার",
    children: [
      {
        id: "coxsbazar-exec",
        nameEn: "Executive (Cox's Bazar)",
        nameBn: "নির্বাহী (কক্সবাজার)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "coxsbazar-cm",
        nameEn: "CM, Cox's Bazar",
        nameBn: "সিএম, কক্সবাজার",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 1,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
        ],
      },
      {
        id: "coxsbazar-metro",
        nameEn: "Metrology, Cox's Bazar",
        nameBn: "মেট্রোলজি, কক্সবাজার",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "coxsbazar-chem",
        nameEn: "Chemistry Lab, Cox's Bazar",
        nameBn: "রসায়ন ল্যাব, কক্সবাজার",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "coxsbazar-admin",
        nameEn: "Administration, Cox's Bazar",
        nameBn: "প্রশাসন, কক্সবাজার",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Dinajpur */
  {
    id: "dinajpur",
    nameEn: "Dinajpur",
    nameBn: "দিনাজপুর",
    children: [
      {
        id: "dinajpur-exec",
        nameEn: "Executive (Dinajpur)",
        nameBn: "নির্বাহী (দিনাজপুর)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
        ],
      },
      {
        id: "dinajpur-admin",
        nameEn: "Administration, Dinajpur",
        nameBn: "প্রশাসন, দিনাজপুর",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "dinajpur-phys",
        nameEn: "Physical Lab, Dinajpur",
        nameBn: "পদার্থ ল্যাব, দিনাজপুর",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
        ],
      },
      {
        id: "dinajpur-chem",
        nameEn: "Chemistry Lab, Dinajpur",
        nameBn: "রসায়ন ল্যাব, দিনাজপুর",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Food & Bacteriology)",
            nameBn: "সহকারী পরিচালক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "dinajpur-metro",
        nameEn: "Metrology, Dinajpur",
        nameBn: "মেট্রোলজি, দিনাজপুর",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (১)",
          },
        ],
      },
      {
        id: "dinajpur-cm",
        nameEn: "CM, Dinajpur",
        nameBn: "সিএম, দিনাজপুর",
        staffCount: 3,
        posts: [
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (২)",
          },
        ],
      },
    ],
  },

  /* Faridpur */
  {
    id: "faridpur",
    nameEn: "Faridpur",
    nameBn: "ফরিদপুর",
    children: [
      {
        id: "faridpur-exec",
        nameEn: "Executive (Faridpur)",
        nameBn: "নির্বাহী (ফরিদপুর)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
        ],
      },
      {
        id: "faridpur-cm",
        nameEn: "CM, Faridpur",
        nameBn: "সিএম, ফরিদপুর",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম)",
          },
        ],
      },
      {
        id: "faridpur-metro",
        nameEn: "Metrology, Faridpur",
        nameBn: "মেট্রোলজি, ফরিদপুর",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "faridpur-chem",
        nameEn: "Chemistry Lab, Faridpur",
        nameBn: "রসায়ন ল্যাব, ফরিদপুর",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "faridpur-admin",
        nameEn: "Administration, Faridpur",
        nameBn: "প্রশাসন, ফরিদপুর",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Gazipur */
  {
    id: "gazipur",
    nameEn: "Gazipur",
    nameBn: "গাজীপুর",
    children: [
      {
        id: "gazipur-exec",
        nameEn: "Executive (Gazipur)",
        nameBn: "নির্বাহী (গাজীপুর)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
        ],
      },
      {
        id: "gazipur-cm",
        nameEn: "CM, Gazipur",
        nameBn: "সিএম, গাজীপুর",
        staffCount: 5,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 4,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (১)",
          },
        ],
      },
      {
        id: "gazipur-metro",
        nameEn: "Metrology, Gazipur",
        nameBn: "মেট্রোলজি, গাজীপুর",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (২)",
          },
        ],
      },
      {
        id: "gazipur-chem",
        nameEn: "Chemistry Lab, Gazipur",
        nameBn: "রসায়ন ল্যাব, গাজীপুর",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "gazipur-phys",
        nameEn: "Physical Lab, Gazipur",
        nameBn: "পদার্থ ল্যাব, গাজীপুর",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Textile)",
            nameBn: "সহকারী পরিচালক (টেক্সটাইল)",
          },
          {
            count: 1,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
        ],
      },
      {
        id: "gazipur-admin",
        nameEn: "Administration, Gazipur",
        nameBn: "প্রশাসন, গাজীপুর",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Gopalganj */
  {
    id: "gopalganj",
    nameEn: "Gopalganj",
    nameBn: "গোপালগঞ্জ",
    children: [
      {
        id: "gopalganj-exec",
        nameEn: "Executive (Gopalganj)",
        nameBn: "নির্বাহী (গোপালগঞ্জ)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Metrology)",
            nameBn: "উপপরিচালক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "gopalganj-cm",
        nameEn: "CM, Gopalganj",
        nameBn: "সিএম, গোপালগঞ্জ",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
      {
        id: "gopalganj-metro",
        nameEn: "Metrology, Gopalganj",
        nameBn: "মেট্রোলজি, গোপালগঞ্জ",
        staffCount: 3,
        posts: [
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (২)",
          },
        ],
      },
      {
        id: "gopalganj-chem",
        nameEn: "Chemistry Lab, Gopalganj",
        nameBn: "রসায়ন ল্যাব, গোপালগঞ্জ",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
      {
        id: "gopalganj-phys",
        nameEn: "Physical Lab, Gopalganj",
        nameBn: "পদার্থ ল্যাব, গোপালগঞ্জ",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
        ],
      },
      {
        id: "gopalganj-admin",
        nameEn: "Administration, Gopalganj",
        nameBn: "প্রশাসন, গোপালগঞ্জ",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Jessore */
  {
    id: "jessore",
    nameEn: "Jessore",
    nameBn: "যশোর",
    children: [
      {
        id: "jessore-exec",
        nameEn: "Executive (Jessore)",
        nameBn: "নির্বাহী (যশোর)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
        ],
      },
      {
        id: "jessore-admin",
        nameEn: "Administration, Jessore",
        nameBn: "প্রশাসন, যশোর",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
      {
        id: "jessore-phys",
        nameEn: "Physical Lab, Jessore",
        nameBn: "পদার্থ ল্যাব, যশোর",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Civil, Materials)",
            nameBn: "সহকারী পরিচালক (পুরকৌশল, পদার্থ)",
          },
          {
            count: 1,
            nameEn: "Inspector (Electrical & Electronics)",
            nameBn: "পরীক্ষক  (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
        ],
      },
      {
        id: "jessore-chem",
        nameEn: "Chemistry Lab, Jessore",
        nameBn: "রসায়ন ল্যাব, যশোর",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Food & Bacteriology)",
            nameBn: "সহকারী পরিচালক (ফুড ও ব্যাকটেরিওলজি)",
          },
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "jessore-metro",
        nameEn: "Metrology, Jessore",
        nameBn: "মেট্রোলজি, যশোর",
        staffCount: 3,
        posts: [
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (২)",
          },
        ],
      },
      {
        id: "jessore-cm",
        nameEn: "CM, Jessore",
        nameBn: "সিএম, যশোর",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
    ],
  },

  /* Kushtia */
  {
    id: "kushtia",
    nameEn: "Kushtia",
    nameBn: "কুষ্টিয়া",
    children: [
      {
        id: "kushtia-exec",
        nameEn: "Executive (Kushtia)",
        nameBn: "নির্বাহী (কুষ্টিয়া)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
        ],
      },
      {
        id: "kushtia-cm",
        nameEn: "CM, Kushtia",
        nameBn: "সিএম, কুষ্টিয়া",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
      {
        id: "kushtia-metro",
        nameEn: "Metrology, Kushtia",
        nameBn: "মেট্রোলজি, কুষ্টিয়া",
        staffCount: 5,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 4,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (২)",
          },
        ],
      },
      {
        id: "kushtia-chem",
        nameEn: "Chemistry Lab, Kushtia",
        nameBn: "রসায়ন ল্যাব, কুষ্টিয়া",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "kushtia-phys",
        nameEn: "Physical Lab, Kushtia",
        nameBn: "পদার্থ ল্যাব, কুষ্টিয়া",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Textile)",
            nameBn: "পরীক্ষক (টেক্সটাইল)",
          },
        ],
      },
      {
        id: "kushtia-admin",
        nameEn: "Administration, Kushtia",
        nameBn: "প্রশাসন, কুষ্টিয়া",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Narayanganj */
  {
    id: "narayanganj",
    nameEn: "Narayanganj",
    nameBn: "নারায়ণগঞ্জ",
    children: [
      {
        id: "narayanganj-exec",
        nameEn: "Executive (Narayanganj)",
        nameBn: "নির্বাহী (নারায়নগঞ্জ)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
        ],
      },
      {
        id: "narayanganj-cm",
        nameEn: "CM, Narayanganj",
        nameBn: "সিএম, নারায়নগঞ্জ",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
      {
        id: "narayanganj-metro",
        nameEn: "Metrology, Narayanganj",
        nameBn: "মেট্রোলজি, নারায়নগঞ্জ",
        staffCount: 3,
        posts: [
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (২)",
          },
        ],
      },
      {
        id: "narayanganj-chem",
        nameEn: "Chemistry Lab, Narayanganj",
        nameBn: "রসায়ন ল্যাব, নারায়নগঞ্জ",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
      {
        id: "narayanganj-phys",
        nameEn: "Physical Lab, Narayanganj",
        nameBn: "পদার্থ ল্যাব, নারায়নগঞ্জ",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
        ],
      },
      {
        id: "narayanganj-admin",
        nameEn: "Administration, Narayanganj",
        nameBn: "প্রশাসন, নারায়নগঞ্জ",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Narsingdi */
  {
    id: "narsingdi",
    nameEn: "Narsingdi",
    nameBn: "নরসিংদী",
    children: [
      {
        id: "narsingdi-exec",
        nameEn: "Executive (Narsingdi)",
        nameBn: "নির্বাহী (নরসিংদী)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
        ],
      },
      {
        id: "narsingdi-cm",
        nameEn: "CM, Narsingdi",
        nameBn: "সিএম,  নরসিংদী",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 2,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
      {
        id: "narsingdi-metro",
        nameEn: "Metrology, Narsingdi",
        nameBn: "মেট্রোলজি,  নরসিংদী",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Senior Inspector (Metrology)",
            nameBn: "উর্ধ্বতন পরীক্ষক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "narsingdi-chem",
        nameEn: "Chemistry Lab, Narsingdi",
        nameBn: "রসায়ন ল্যাব,  নরসিংদী",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
      {
        id: "narsingdi-phys",
        nameEn: "Physical Lab, Narsingdi",
        nameBn: "পদার্থ ল্যাব,  নরসিংদী",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Electrical & Electronics)",
            nameBn: "সহকারী পরিচালক (ইলেকট্রিক্যাল ও ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Inspector (Textile)",
            nameBn: "পরীক্ষক (টেক্সটাইল)",
          },
        ],
      },
      {
        id: "narsingdi-admin",
        nameEn: "Administration, Narsingdi",
        nameBn: "প্রশাসন,  নরসিংদী",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Noakhali */
  {
    id: "noakhali",
    nameEn: "Noakhali",
    nameBn: "নোয়াখালী",
    children: [
      {
        id: "noakhali-exec",
        nameEn: "Executive (Noakhali)",
        nameBn: "নির্বাহী (নোয়াখালী)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Chemistry)",
            nameBn: "উপপরিচালক (রসায়ন)",
          },
        ],
      },
      {
        id: "noakhali-cm",
        nameEn: "CM, Noakhali",
        nameBn: "সিএম, নোয়াখালী",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
      {
        id: "noakhali-metro",
        nameEn: "Metrology, Noakhali",
        nameBn: "মেট্রোলজি, নোয়াখালী",
        staffCount: 3,
        posts: [
          {
            count: 3,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি) (২) ",
          },
        ],
      },
      {
        id: "noakhali-chem",
        nameEn: "Chemistry Lab, Noakhali",
        nameBn: "রসায়ন ল্যাব, নোয়াখালী",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Chemistry)",
            nameBn: "পরীক্ষক (রসায়ন)",
          },
        ],
      },
      {
        id: "noakhali-phys",
        nameEn: "Physical Lab, Noakhali",
        nameBn: "পদার্থ ল্যাব, নোয়াখালী",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Electrical & Electronics)",
            nameBn: "সহকারী পরিচালক (ইলেকটিক্যাল এন্ড ইলেকট্রনিক্স)",
          },
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
        ],
      },
      {
        id: "noakhali-admin",
        nameEn: "Administration, Noakhali",
        nameBn: "প্রশাসন, নোয়াখালী",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Pabna */
  {
    id: "pabna",
    nameEn: "Pabna",
    nameBn: "পাবনা",
    children: [
      {
        id: "pabna-exec",
        nameEn: "Executive (Pabna)",
        nameBn: "নির্বাহী (পাবনা)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (Physical)",
            nameBn: "উপপরিচালক (পদার্থ)",
          },
        ],
      },
      {
        id: "pabna-cm",
        nameEn: "CM, Pabna",
        nameBn: "সিএম, পাবনা",
        staffCount: 5,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 4,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (৩)",
          },
        ],
      },
      {
        id: "pabna-metro",
        nameEn: "Metrology, Pabna",
        nameBn: "মেট্রোলজি, পাবনা",
        staffCount: 3,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Metrology)",
            nameBn: "সহকারী পরিচালক (মেট্রোলজি)",
          },
          {
            count: 2,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "pabna-chem",
        nameEn: "Chemistry Lab, Pabna",
        nameBn: "রসায়ন ল্যাব, পাবনা",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
      {
        id: "pabna-phys",
        nameEn: "Physical Lab, Pabna",
        nameBn: "পদার্থ ল্যাব, পাবনা",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Textile)",
            nameBn: "পরীক্ষক  (টেক্সটাইল)",
          },
        ],
      },
      {
        id: "pabna-admin",
        nameEn: "Administration, Pabna",
        nameBn: "প্রশাসন, পাবনা",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },

  /* Patuakhali */
  {
    id: "patuakhali",
    nameEn: "Patuakhali",
    nameBn: "পটুয়াখালী",
    children: [
      {
        id: "patuakhali-exec",
        nameEn: "Executive (Patuakhali)",
        nameBn: "নির্বাহী (পটুয়াখালী)",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Deputy Director (CM)",
            nameBn: "উপপরিচালক (সিএম)",
          },
        ],
      },
      {
        id: "patuakhali-cm",
        nameEn: "CM, Patuakhali",
        nameBn: "সিএম, পটুয়াখালী",
        staffCount: 4,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (CM)",
            nameBn: "সহকারী পরিচালক (সিএম)",
          },
          {
            count: 3,
            nameEn: "Field Officer (CM)",
            nameBn: "ফিল্ড অফিসার (সিএম) (১)",
          },
        ],
      },
      {
        id: "patuakhali-metro",
        nameEn: "Metrology, Patuakhali",
        nameBn: "মেট্রোলজি, পটুয়াখালী",
        staffCount: 2,
        posts: [
          {
            count: 2,
            nameEn: "Field Inspector (Metrology)",
            nameBn: "পরিদর্শক (মেট্রোলজি)",
          },
        ],
      },
      {
        id: "patuakhali-chem",
        nameEn: "Chemistry Lab, Patuakhali",
        nameBn: "রসায়ন ল্যাব, পটুয়াখালী",
        staffCount: 2,
        posts: [
          {
            count: 1,
            nameEn: "Assistant Director (Chemistry)",
            nameBn: "সহকারী পরিচালক (রসায়ন)",
          },
          {
            count: 1,
            nameEn: "Inspector (Food & Bacteriology)",
            nameBn: "পরীক্ষক (ফুড ও ব্যাকটেরিওলজি)",
          },
        ],
      },
      {
        id: "patuakhali-phys",
        nameEn: "Physical Lab, Patuakhali",
        nameBn: "পদার্থ ল্যাব, পটুয়াখালী",
        staffCount: 1,
        posts: [
          {
            count: 1,
            nameEn: "Inspector (Civil, Materials)",
            nameBn: "পরীক্ষক (পুরকৌশল, পদার্থ)",
          },
        ],
      },
      {
        id: "patuakhali-admin",
        nameEn: "Administration, Patuakhali",
        nameBn: "প্রশাসন, পটুয়াখালী",
        staffCount: 2,
        posts: [
          { count: 1, nameEn: "Accountant", nameBn: "হিসাব রক্ষক" },
          { count: 1, nameEn: "Office Assistant", nameBn: "অফিস সহায়ক" },
        ],
      },
    ],
  },
];
