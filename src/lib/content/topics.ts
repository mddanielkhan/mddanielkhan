import { asc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { topics } from "@/lib/db/schema";

/**
 * Controlled topic vocabulary (the "wedge first" strategy: higher study abroad,
 * admissions and scholarships lead; careers and study help follow). Political
 * and religious topics are deliberately excluded at launch (highest legal risk
 * under the Cyber Security Act 2026 regime, lowest mission relevance).
 */
export const TOPIC_SEED = [
  { slug: "higher-study-abroad", nameEn: "Higher study abroad", nameBn: "বিদেশে উচ্চশিক্ষা", highRisk: true, description: "Applications, universities, SOPs, visas and life abroad." },
  { slug: "scholarships", nameEn: "Scholarships & funding", nameBn: "স্কলারশিপ ও ফান্ডিং", highRisk: true, description: "DAAD, Chevening, MEXT, Erasmus, Fulbright, Commonwealth and more." },
  { slug: "student-visa", nameEn: "Student visas", nameBn: "স্টুডেন্ট ভিসা", highRisk: true, description: "Documents, interviews, blocked accounts and timelines. Peer experience, not legal advice." },
  { slug: "university-admission-bd", nameEn: "University admission (Bangladesh)", nameBn: "বিশ্ববিদ্যালয় ভর্তি (বাংলাদেশ)", highRisk: false, description: "Public & private university admission tests, units and preparation." },
  { slug: "english-tests", nameEn: "IELTS, TOEFL, PTE & Duolingo", nameBn: "আইইএলটিএস, টোফেল, পিটিই", highRisk: false, description: "Strategy, resources and score requirements." },
  { slug: "gre-gmat-sat", nameEn: "GRE, GMAT & SAT", nameBn: "জিআরই, জিম্যাট, স্যাট", highRisk: false, description: "Preparation and score strategy." },
  { slug: "careers", nameEn: "Careers & jobs", nameBn: "ক্যারিয়ার ও চাকরি", highRisk: true, description: "CVs, interviews, internships, BCS and the Bangladesh job market." },
  { slug: "research", nameEn: "Research & academia", nameBn: "গবেষণা", highRisk: false, description: "Finding supervisors, publishing, PhD applications." },
  { slug: "study-help", nameEn: "Study help", nameBn: "পড়াশোনায় সাহায্য", highRisk: false, description: "Subjects, courses and study techniques." },
  { slug: "student-life", nameEn: "Student life & wellbeing", nameBn: "শিক্ষার্থী জীবন ও সুস্থতা", highRisk: false, description: "Balance, stress, finances and support. If you are in crisis, see the Safety page." },
] as const;

export async function listTopics() {
  return db().select().from(topics).orderBy(asc(topics.sortOrder), asc(topics.id));
}

export async function seedTopics() {
  for (const [i, t] of TOPIC_SEED.entries()) {
    await db()
      .insert(topics)
      .values({ ...t, sortOrder: i })
      .onConflictDoUpdate({ target: topics.slug, set: { nameEn: t.nameEn, nameBn: t.nameBn, description: t.description, highRisk: t.highRisk, sortOrder: i } });
  }
}
