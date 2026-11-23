// Messages that come from the API are written in English. When the reader uses Bangla we translate the ones we know;
// anything else is shown as it came.
type Rule = [RegExp, (m: RegExpMatchArray) => string];

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnNum = (s: string) => s.replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const RULES: Rule[] = [
  [/^Invalid email or password$/, () => 'ইমেইল বা পাসওয়ার্ড ভুল।'],
  [/^(Missing token|Invalid or expired token|Invalid refresh token)$/, () => 'আপনার সেশন শেষ হয়েছে। আবার লগইন করুন।'],
  [/^Account disabled$/, () => 'এই অ্যাকাউন্টটি বন্ধ করা হয়েছে।'],
  [/^Admin only$/, () => 'শুধু অ্যাডমিন এটি করতে পারেন।'],
  [/^Current password is wrong$/, () => 'বর্তমান পাসওয়ার্ড ভুল।'],
  [/^Email already in use$/, () => 'এই ইমেইল আগেই ব্যবহৃত হয়েছে।'],
  [/^The admin account cannot give or receive tasks$/, () => 'অ্যাডমিন অ্যাকাউন্টে কাজ দেওয়া বা নেওয়া যায় না।'],
  [/^At least one assignee is required$/, () => 'কমপক্ষে একজনকে বেছে নিন।'],
  [/^You cannot assign a task to yourself$/, () => 'নিজেকে কাজ দেওয়া যায় না।'],
  [/^Invalid dueDate$/, () => 'শেষ তারিখ সঠিক নয়।'],
  [/^Title is required$/, () => 'শিরোনাম লিখুন।'],
  [/^Accept the task first/, () => 'অন্যকে দেওয়ার আগে কাজটি গ্রহণ করুন এবং চলমান রাখুন।'],
  [/^One or more assignees are invalid or inactive$/, () => 'বেছে নেওয়া কয়েকজন সঠিক নন অথবা বন্ধ।'],
  [/^Your position is not allowed to give tasks to (.+)$/, (m) => `আপনার পদ থেকে ${m[1]}-কে কাজ দেওয়ার অনুমতি নেই।`],
  [/^You do not hold that position$/, () => 'এই পদটি আপনার নেই।'],
  [/^You have no position, so you cannot give tasks$/, () => 'আপনার কোনো পদ নেই, তাই কাজ দিতে পারবেন না।'],
  [/^Assignee has no position$/, () => 'যাকে দিচ্ছেন তার কোনো পদ নেই।'],
  [/^A reason is required$/, () => 'কারণ লিখতে হবে।'],
  [/^A (assignee|giver) cannot move a task from .+ to .+$/, () => 'এই অবস্থায় কাজটির এই পরিবর্তন করা যায় না।'],
  [/^(\d+) delegated sub-task\(s\) are still open$/, (m) => `আপনার দেওয়া ${bnNum(m[1])}টি সাব-টাস্ক এখনো চলমান আছে।`],
  [/^Nothing to post$/, () => 'মন্তব্য লিখুন, অগ্রগতি বদলান বা ফাইল দিন।'],
  [/^Only the assignee can set progress$/, () => 'শুধু যাকে কাজ দেওয়া হয়েছে সে অগ্রগতি জানাতে পারে।'],
  [/^Progress can only be set on an accepted, open task$/, () => 'শুধু গ্রহণ করা চলমান কাজে অগ্রগতি দেওয়া যায়।'],
  [/^(Assignment|Task|Attachment) not found$/, () => 'এটি পাওয়া যায়নি অথবা আপনার এতে দেখার অনুমতি নেই।'],
  [/^No files received/, () => 'কোনো ফাইল পাওয়া যায়নি।'],
  [/^File type \.(\w+) is not allowed$/, (m) => `.${m[1]} ধরনের ফাইল গ্রহণযোগ্য নয়।`],
  [/^(.+) is empty$/, (m) => `${m[1]} ফাইলটি খালি।`],
  [/^This task is closed$/, () => 'এই কাজটি বন্ধ হয়ে গেছে।'],
  [/^A task can have at most (\d+) attachments$/, (m) => `একটি কাজে সর্বোচ্চ ${bnNum(m[1])}টি ফাইল রাখা যায়।`],
  [/^At most (\d+) files per update$/, (m) => `একবারে সর্বোচ্চ ${bnNum(m[1])}টি ফাইল দেওয়া যায়।`],
  [/^Only the uploader can delete a file$/, () => 'ফাইলটি শুধু যে দিয়েছে সে মুছতে পারবে।'],
  [/^File too large/, () => 'ফাইলটি অনেক বড়।'],
  [/^Secretariat still has members$/, () => 'এই সেক্রেটারিয়েটে এখনো সদস্য আছে, তাই মোছা যাবে না।'],
  [/^Department still has people$/, () => 'এই বিভাগে এখনো মানুষ আছে, তাই মোছা যাবে না। আগে তাঁদের সরান, বা বিভাগটি বন্ধ করে রাখুন।'],
  [/^Department still has secretariats$/, () => 'এই বিভাগে এখনো সেক্রেটারিয়েট আছে, তাই মোছা যাবে না। আগে সেগুলো মুছুন।'],
  [/^Department still has branches under it$/, () => 'এর অধীনে এখনো শাখা আছে, তাই মোছা যাবে না।'],
  [/^The head office cannot be deleted$/, () => 'প্রধান কার্যালয় মোছা যায় না।'],
  [/^This person has task history/, () => 'এই ব্যবহারকারীর সঙ্গে কাজের ইতিহাস জড়িত, তাই মোছা যাবে না। অ্যাকাউন্ট বন্ধ করে রাখুন।'],
  [/^You cannot delete yourself$/, () => 'নিজের অ্যাকাউন্ট মোছা যায় না।'],
  [/^Position already exists$/, () => 'এই নামের পদ আগেই আছে।'],
  [/^You cannot deactivate yourself$/, () => 'নিজের অ্যাকাউন্ট বন্ধ করা যায় না।'],
  [/^The admin account is not part of the org hierarchy$/, () => 'অ্যাডমিন অ্যাকাউন্ট সংগঠনের কাঠামোর অংশ নয়।'],
  [/^Duplicate unit\/position pair$/, () => 'একই বিভাগ ও পদ দুবার দেওয়া হয়েছে।'],
  [/^A user cannot report to themselves$/, () => 'কেউ নিজের অধীনে থাকতে পারে না।'],
  [/^Reporting line would create a loop$/, () => 'এতে রিপোর্টিংয়ে চক্র তৈরি হবে (A, B-র অধীনে আর B, A-র অধীনে)।'],
  [/^The global default cannot be removed/, () => 'সবার জন্য ডিফল্টটি মোছা যায় না, শুধু বদলানো যায়।'],
  [/^Enter the mail server/, () => 'চালু করার আগে মেইল সার্ভার (host) দিন।'],
  [/^Generate the push keys/, () => 'ব্রাউজার নোটিফিকেশন চালু করার আগে নোটিফিকেশন কী তৈরি করুন।'],
  [/^The contact must start with/, () => 'যোগাযোগের ঠিকানা mailto: বা https:// দিয়ে শুরু হতে হবে।'],
  [/^email must be an email$/, () => 'সঠিক ইমেইল দিন।'],
  [/must be longer than or equal to (\d+) characters/, (m) => `কমপক্ষে ${bnNum(m[1])}টি অক্ষর দিতে হবে।`],
  [/^Failed to fetch$|^NetworkError|^Load failed$/, () => 'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। ইন্টারনেট দেখুন।'],
];

export function translateError(message: string, lang: 'bn' | 'en'): string {
  if (lang === 'en' || !message) return message;
  for (const [re, f] of RULES) {
    const m = message.match(re);
    if (m) return f(m);
  }
  return message;
}
