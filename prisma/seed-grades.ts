/**
 * Assigns Bangladesh NPS-2015 grades to all OrgPost records by matching nameEn.
 * Run with: npm run seed:grades
 */
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

// ─── Grade map keyed by exact nameEn ─────────────────────────────────────────
const GRADE: Record<string, string> = {
  // ── Grade 3 ──────────────────────────────────────────────────────────────
  "Director General":                              "3",

  // ── Grade 5 ──────────────────────────────────────────────────────────────
  "Director":                                      "5",
  "Director (Admin)":                              "5",
  "Director (Chemistry)":                          "5",
  "Director (Metrology)":                          "5",
  "Director (Physics)":                            "5",
  "Director (Standards)":                          "5",

  // ── Grade 6 ──────────────────────────────────────────────────────────────
  "Deputy Director (Accounts & Audit)":            "6",
  "Deputy Director (Administration)":              "6",
  "Deputy Director (Agriculture & Food)":          "6",
  "Deputy Director (CM)":                          "6",
  "Deputy Director (Chemistry)":                   "6",
  "Deputy Director (Civil & Mechanical)":          "6",
  "Deputy Director (Civil, Materials)":            "6",
  "Deputy Director (Document Control)":            "6",
  "Deputy Director (Electrical & Electronics)":    "6",
  "Deputy Director (Food & Bacteriology)":         "6",
  "Deputy Director (Halal Certification)":         "6",
  "Deputy Director (Halal Food & Product)":        "6",
  "Deputy Director (Internal Audit)":              "6",
  "Deputy Director (Jute & Textile)":              "6",
  "Deputy Director (Metrology)":                   "6",
  "Deputy Director (Physical)":                    "6",
  "Deputy Director (Planning & Development)":      "6",
  "Deputy Director (Textile)":                     "6",

  // ── Grade 9 ──────────────────────────────────────────────────────────────
  "Assistant Director (Accounts & Internal Audit)":"9",
  "Assistant Director (Administration)":           "9",
  "Assistant Director (Agriculture & Food)":       "9",
  "Assistant Director (CM)":                       "9",
  "Assistant Director (Chemistry)":                "9",
  "Assistant Director (Civil & Mechanical)":       "9",
  "Assistant Director (Civil, Materials)":         "9",
  "Assistant Director (Electrical & Electronics)": "9",
  "Assistant Director (Food & Bacteriology)":      "9",
  "Assistant Director (Halal Certification)":      "9",
  "Assistant Director (Halal Food & Product)":     "9",
  "Assistant Director (Jute & Textile)":           "9",
  "Assistant Director (Mechanical)":               "9",
  "Assistant Director (Metrology)":                "9",
  "Assistant Director (Planning & Development)":   "9",
  "Assistant Director (Textile)":                  "9",
  "Mechanical Engineer":                           "9",
  "Statistician":                                  "9",
  "Programmer":                                    "9",
  "Editor":                                        "9",
  "Librarian":                                     "9",
  "Store Officer":                                 "9",
  "Internal Audit Officer":                        "9",
  "Document Control Officer":                      "9",
  "Assistant Law Officer":                         "9",
  "Coordination Officer":                          "9",

  // ── Grade 9 (continued — inspection & field tier) ───────────────────────
  "Senior Inspector (Agriculture & Food)":         "9",
  "Senior Inspector (Chemistry)":                  "9",
  "Senior Inspector (Civil & Mechanical)":         "9",
  "Senior Inspector (Civil, Materials)":           "9",
  "Senior Inspector (Electrical & Electronics)":   "9",
  "Senior Inspector (Food & Bacteriology)":        "9",
  "Senior Inspector (Jute & Textile)":             "9",
  "Senior Inspector (Metrology)":                  "9",
  "Senior Inspector (Textile)":                    "9",
  "Inspector":                                     "9",
  "Inspector (Agriculture & Food)":                "9",
  "Inspector (Chemistry)":                         "9",
  "Inspector (Civil & Mechanical)":                "9",
  "Inspector (Civil, Materials)":                  "9",
  "Inspector (Electrical & Electronics)":          "9",
  "Inspector (Food & Bacteriology)":               "9",
  "Inspector (Halal Food & Product)":              "9",
  "Inspector (Jute & Textile)":                    "9",
  "Inspector (Mechanical)":                        "9",
  "Inspector (Metrology)":                         "9",
  "Inspector (Metrology, Chemistry)":              "9",
  "Inspector (Metrology, Physical)":               "9",
  "Inspector (Textile)":                           "9",
  "Field Officer (CM)":                            "9",
  "Field Officer (Halal Certification)":           "9",
  "Field Inspector (Metrology)":                   "9",

  // ── Grade 11 — senior clerical / non-technical officers ──────────────────
  "Head Assistant":                                "11",
  "Assistant Accounts Officer":                    "11",
  "Assistant Audit Officer":                       "11",
  "Auditor":                                       "11",
  "Assistant Security Officer":                    "11",
  "Senior Computer Operator":                      "11",
  "Senior Technical Assistant":                    "11",
  "Assistant Gazer":                               "11",

  // ── Grade 13 ─────────────────────────────────────────────────────────────
  "Accountant":                                    "13",
  "Accountant cum Cashier":                        "13",
  "Cashier":                                       "13",
  "Stenographer cum Computer Operator":            "13",
  "Cataloguer":                                    "13",
  "Store Keeper":                                  "13",
  "UDC cum Cashier":                               "13",

  // ── Grade 14 — technical support ─────────────────────────────────────────
  "Computer Operator":                             "14",
  "Draftsman":                                     "14",
  "Foreman":                                       "14",
  "Instrument Technician":                         "14",
  "Accounts Assistant":                            "14",

  // ── Grade 16 ─────────────────────────────────────────────────────────────
  "LDA (Lower Division Clerk)":                    "16",
  "Computer Typist":                               "16",
  "Data Entry Operator":                           "16",
  "Daftary":                                       "16",
  "Office Assistant cum Computer Typist":          "16",
  "Fitter":                                        "16",
  "Turner":                                        "16",
  "Minstri":                                       "16",

  // ── Grade 17 ─────────────────────────────────────────────────────────────
  "Electrician":                                   "17",
  "Electrician (Outsourcing)":                     "17",
  "Gasman":                                        "17",
  "Glass Blower":                                  "17",
  "Instrument Assistant":                          "17",
  "Gestetner Operator":                            "17",

  // ── Grade 18 ─────────────────────────────────────────────────────────────
  "Driver":                                        "18",
  "Driver (Outsourcing)":                          "18",
  "Security Guard":                                "18",
  "Khalasi":                                       "18",

  // ── Grade 19 ─────────────────────────────────────────────────────────────
  "Lab Assistant":                                 "19",

  // ── Grade 20 ─────────────────────────────────────────────────────────────
  "Office Assistant":                              "20",
  "Office Assistant (Outsourcing)":                "20",
  "Lab Bearer":                                    "20",
};

async function main() {
  const posts = await p.orgPost.findMany({ select: { id: true, nameEn: true } });

  let updated = 0;
  let unmatched: string[] = [];

  for (const post of posts) {
    const grade = GRADE[post.nameEn];
    if (grade) {
      await p.orgPost.update({ where: { id: post.id }, data: { grade } });
      updated++;
    } else {
      if (!unmatched.includes(post.nameEn)) unmatched.push(post.nameEn);
    }
  }

  console.log(`✓ Updated ${updated} / ${posts.length} posts`);
  if (unmatched.length) {
    console.log(`\n⚠ ${unmatched.length} unique names had no grade match:`);
    unmatched.sort().forEach((n) => console.log(`  • "${n}"`));
  }
}

main().catch(console.error).finally(() => p.$disconnect());
