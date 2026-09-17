// ============================================================================
//  WORKSHOP HUB - content for workshop.html (the only file you edit for it)
// ============================================================================
//  This page is deliberately ISOLATED: no other page on the site links to it,
//  it is not in the nav, not in sitemap.xml, and it is marked noindex. Share
//  it by direct link or QR code during the session.
//
//  HOW TO UPDATE:
//  • META   - title/date/room + the blurb at the top of the page.
//  • ORGS   - the co-hosting orgs. `key` is what ties an opportunity to an
//             org. `accent` is one of: teal | purple | pink | gold | coral.
//             `linkLabel` renames the card's link (default "<SHORT> site").
//             An opportunity can set `cta` to rename its button ("Details").
//  • TAGS   - the filter vocabulary. Add a tag HERE first, then use its key in
//             a `tags: [...]` list below. A tag with nothing tagged is hidden
//             from the filter bar automatically, so retiring one is safe.
//  • OPPORTUNITIES - openings the orgs share with each other's members.
//  • SUMMER_PROGRAMS - the CNS comp-neuro internship list, plus any summer
//             research program off another org's list. An entry here keeps its
//             own `org` key, so it still answers to that org's filter chip -
//             which list it is printed in and which org it belongs to are two
//             separate things.
//  • MATERIALS   - optional, and currently not exported at all. See the note
//             above OPPORTUNITIES if you want a handouts section back.
//
//  The org and tag filters apply to the LISTINGS only (opportunities and
//  summer programs). Every listing takes `tags: [...]`. Visitors filter by org
//  (top row) and by tag (second row); the two combine, so "ACM + paid" shows
//  only ACM's paid listings.
//
//  Deleting a whole block below is safe: the page drops that section instead
//  of breaking.
// ============================================================================

export const META = {
  title: "Cross-Org Workshop",
  kicker: "CompNeuroSociety x ACM x CELLS x Business & STEM Association",
  date: "2026-10-01T18:30",
  location: "Psychology Dept - Room PDB A204",
  blurb: "The opportunities our four orgs are sharing with each other's members, in one place. Filter by org or by what you are eligible for.",
  footNote: "Questions during the workshop? Flag down anyone with an org shirt on.",
  // The registration form. Drop `register` entirely and both buttons disappear
  // rather than the page breaking. `note` is the line under the hero button -
  // leave it empty for no line.
  register: {
    url: "https://docs.google.com/forms/d/e/1FAIpQLSdtJo7xqrPv9jJAi4KhEWNQpSOP5gpNXGuiJRWf5Epp0z6ojw/viewform?usp=dialog",
    label: "Register for the workshop",
    note: "Sign up so we know how many to expect.",
  },
};

export const ORGS = [
  { key: "cns", name: "CompNeuroSociety", short: "CNS", accent: "teal",
    blurb: "Computational neuroscience workshops, journal clubs, and research project teams at FSU.",
    url: "https://compneurosociety.com/" },
  { key: "acm", name: "ACM at FSU", short: "ACM", accent: "purple",
    blurb: "Association for Computing Machinery student chapter - software, algorithms, and hackathons.",
    url: "https://discord.com/invite/GUTEDnXp", linkLabel: "ACM Discord" },
  { key: "cells", name: "CELLS", short: "CELLS", accent: "pink",
    blurb: "Community for undergraduate life-science students at FSU.",
    url: "" },
  { key: "bsa", name: "Business & STEM Association", short: "BSA", accent: "gold",
    blurb: "Where business and STEM students meet - industry nights, case work, and career prep.",
    url: "" },
];

// The filter vocabulary. `label` is the chip text; `group` puts it in a row:
//   "field" - what the work is about
//   "fit"   - who it is for and how it runs
// A tag nothing carries is hidden from the bar, so retiring one is safe.
export const TAGS = [
  { key: "cs",          label: "computer science",              group: "field" },
  { key: "programming", label: "programming / SWE",             group: "field" },
  { key: "python",      label: "Python",                        group: "field" },
  { key: "ml",          label: "ML / AI",                       group: "field" },
  { key: "neuroai",     label: "NeuroAI",                       group: "field" },
  { key: "compneuro",   label: "computational neuroscience",    group: "field" },
  { key: "bio",         label: "biology / life science",        group: "field" },
  { key: "data",        label: "data science",                  group: "field" },
  { key: "security",    label: "cybersecurity",                 group: "field" },
  { key: "opensource",  label: "open source",                   group: "field" },
  { key: "quant",       label: "quant / finance",               group: "field" },
  { key: "business",    label: "business / strategy",           group: "field" },
  { key: "policy",      label: "policy / ethics / society",     group: "field" },

  { key: "research",    label: "research",                      group: "fit" },
  { key: "industry",    label: "industry",                      group: "fit" },
  { key: "paid",        label: "paid",                          group: "fit" },
  { key: "beginner",    label: "no experience needed",          group: "fit" },
  { key: "firstyear",   label: "1st + 2nd years",               group: "fit" },
  { key: "remote",      label: "remote",                        group: "fit" },
  { key: "local",       label: "at FSU / in Florida",           group: "fit" },
  { key: "intl",        label: "international students OK",     group: "fit" },
  { key: "us-only",     label: "U.S. citizen or PR only",       group: "fit" },
  { key: "gov",         label: "government / service commitment", group: "fit" },
  { key: "postbac",     label: "post-bac / graduating seniors", group: "fit" },
  { key: "umbrella",    label: "one app, many sites",           group: "fit" },
];

// `deadline` is "YYYY-MM-DD"; leave it empty for rolling, or write free text
// ("not yet announced") to show that text instead. Past dates render as CLOSED
// and sort to the bottom.
//
// If the workshop ever does have handouts to share, add them back like this and
// a "Materials" section reappears above the filters - no org key, because the
// materials belong to the session rather than to one club:
//
//   export const MATERIALS = [
//     { title: "Workshop slides", type: "slides",
//       note: "The full deck, including the demo walkthrough.", url: "" },
//   ];
export const OPPORTUNITIES = [
  { title: "Spring Projects", org: "cns", kind: "Research",
    tags: ["compneuro", "python", "research", "beginner", "local"],
    deadline: "not yet announced", url: "https://discord.gg/uBdWxtcDV", cta: "Message CNS on Discord",
    blurb: "Join a semester-long computational neuroscience project team. No prior research experience required." },
  { title: "Cloud Club projects + dev events", org: "acm", kind: "Projects",
    tags: ["cs", "programming", "local", "beginner"],
    deadline: "", url: "https://discord.com/invite/GUTEDnXp", cta: "ACM Discord",
    blurb: "ACM's Discord is where Cloud Club projects get organized and their development events get posted." },
];

// --- CNS SUMMER PROGRAMS ----------------------------------------------------
// A shortened version of CNS_summerPrograms.pdf (compiled 1 Sep 2026, target
// cycle Summer 2027). Sorted by deadline on the page, soonest first.
//   deadline  - "YYYY-MM-DD". Empty means "no fixed date" - use `when` instead.
//   estimated - true when the date is last cycle's and will shift by a few
//               days; the page labels it "est." Set false only for dates the
//               program has actually posted for 2027.
//   when      - free text shown when there is no deadline (e.g. "opens Dec 2026").
//   eligibility - one short phrase; the gate that most often disqualifies people.
//   tags      - keys from TAGS above; these drive the filter bar.
export const SUMMER_PROGRAMS = [
  { name: "HHMI Cech Fellows (Janelia + HHMI labs)", org: "cells",
    host: "Janelia Research Campus, Ashburn VA + HHMI labs nationwide",
    focus: "A summer in an HHMI lab, 14 Jun - 12 Aug 2027. Janelia's own tracks include behavioral and systems neuroscience, neuronal cell biology, and theory and computational neuroscience. No prior research expected, which is rare at this level. This is the earliest deadline on the page by a month - the window is 10 Nov to 17 Dec 2026, so it shuts before most people start thinking about summer. Stipend only: you arrange your own housing and travel.",
    deadline: "2026-12-17", estimated: false,
    eligibility: "rising juniors and seniors; lawful U.S. status through Aug 2027, no visa sponsorship",
    tags: ["bio", "compneuro", "research", "paid", "beginner"],
    url: "https://www.hhmi.org/programs/cech-fellows" },

  { name: "CSHL Undergraduate Research Program", host: "Cold Spring Harbor Laboratory, NY",
    focus: "Bioinformatics & computational neuroscience track; NeuroAI group, neural-network lecture series. $7,000 + room and board.",
    deadline: "2027-01-15", estimated: false, eligibility: "sophomores/juniors; international OK if enrolled in the U.S.",
    tags: ["compneuro", "bio", "neuroai", "data", "research", "paid", "intl"],
    url: "https://www.cshl.edu/education/undergraduate-research-program/" },

  { name: "JAX Summer Student Program", org: "cells", host: "The Jackson Laboratory, Bar Harbor ME",
    focus: "Ten weeks on your own genetics and genomics project with a mentor, and the neurogenetics and neurodegeneration labs take students every year. $7,500 plus room, board, AND round-trip travel - one of the very few programs that covers all three, so it costs you nothing to attend. Opens November 2026.",
    deadline: "2027-01-25", estimated: false,
    eligibility: "undergraduates; read the eligibility FAQ before starting the application",
    tags: ["bio", "data", "research", "paid"],
    url: "https://www.jax.org/education-and-learning/high-school-students-and-undergraduates/learn-earn-and-explore" },

  { name: "MIT MSRP-Bio (Brain & Cognitive Sciences)", host: "MIT + CBMM, Cambridge MA",
    focus: "Comp neuro, AI, and cognitive science labs. Three letters, one from a research supervisor.",
    deadline: "2027-01-30", estimated: true, eligibility: "prior research required; 3.5+ science GPA",
    tags: ["compneuro", "ml", "neuroai", "python", "research", "paid", "us-only"],
    url: "https://bcs.mit.edu/msrp" },

  { name: "DAAD RISE Germany", host: "German universities and research institutes",
    focus: "Paid summer research placement in Germany, working with a doctoral-student mentor. Stipend plus housing help; working language is English.",
    deadline: "2027-01-31", estimated: true, eligibility: "enrolled at a North American, UK, or Irish institution; no German required",
    tags: ["cs", "bio", "research", "paid", "intl"],
    url: "https://www.daad.de/rise/en/rise-germany/" },

  { name: "CRA-WP DREU", org: "acm", host: "Faculty mentors at universities across the U.S.",
    focus: "Ten weeks of computing research with a faculty mentor at another university - $9,000 plus up to $1,000 for relocation and conference travel. The single best first research experience for a CS major, and no prior research is required.",
    deadline: "2027-01-31", estimated: true, eligibility: "U.S. citizen/PR/national; rising sophomores especially encouraged",
    tags: ["cs", "research", "paid", "beginner", "us-only"],
    url: "https://cra.org/cra-wp/dreu/students/" },

  { name: "Amgen Scholars (U.S. Program)", host: "14 hosts incl. Caltech, Columbia, Stanford, WashU",
    focus: "One shared deadline and shared materials across sites - apply to three or four.",
    deadline: "2027-02-01", estimated: true, eligibility: "U.S. citizen/PR; 3.2+ GPA; PhD or MD-PhD intent",
    tags: ["bio", "research", "paid", "us-only", "umbrella"],
    url: "https://amgenscholars.com/us-program/" },

  { name: "SYNAPSE Internship Program (SIP)", host: "Princeton Neuroscience Institute, NJ",
    focus: "Deep bench of theory/computational labs; R and Python courses for all summer researchers. Window opens 1 Nov 2026.",
    deadline: "2027-02-01", estimated: false, eligibility: "U.S. citizen/PR; rising 2nd-4th years; non-Princeton",
    tags: ["compneuro", "python", "research", "paid", "us-only", "beginner"],
    url: "https://pni.princeton.edu/apply/undergraduate-summer-research-programs/application-process" },

  { name: "Leadership Alliance SR-EIP", host: "20+ institutions incl. Brown, Princeton, MIT, Yale",
    focus: "One application reaches both Brown's Carney Computational Neuroscience program and Princeton SYNAPSE. Highest return on effort here. Opens 1 Nov 2026.",
    deadline: "2027-02-03", estimated: true, eligibility: "U.S. citizen/PR; 3.0+ GPA; PhD/MD-PhD intent; F-1 not eligible",
    tags: ["research", "paid", "us-only", "umbrella"],
    url: "https://theleadershipalliance.org/summer-research-early-identification-program" },

  { name: "Dana Foundation Neuroscience & Society Scholars (DNSS)", org: "cells",
    host: "Brown, Johns Hopkins, and Penn",
    focus: "Nine weeks on neuroscience set against public health, ethics, AI, economics, law, or the environment - the interdisciplinary angle rather than the bench. It runs through the Leadership Alliance portal, the same application as SR-EIP directly above, so naming DNSS as a choice costs you nothing extra. Twelve scholars a year.",
    deadline: "2027-02-03", estimated: true,
    eligibility: "aimed at students underrepresented in neuroscience; HBCU and MSI partners especially",
    tags: ["bio", "policy", "research", "paid", "umbrella"],
    url: "https://theleadershipalliance.org/dana-foundation-neuroscience-and-society-scholars-dnss" },

  { name: "Carney Summer Scholars in Computational Neuroscience", host: "Brown University, Providence RI",
    focus: "Explicitly computational brain science. Only 7 slots for non-Brown students. Apply via the Leadership Alliance portal, Brown first choice.",
    deadline: "2027-02-03", estimated: true, eligibility: "U.S. citizen/PR; 3.0+ GPA; PhD or MD-PhD intent",
    tags: ["compneuro", "research", "paid", "us-only"],
    url: "https://carney.brown.edu/education-training/undergraduate/carney-summer-scholars" },

  { name: "Mayo Clinic SURF", org: "cells", host: "Mayo Clinic - three campuses, incl. Jacksonville FL",
    focus: "Ten weeks, 25 May - 30 Jul 2027, $6,000. Neuroscience is a named discipline alongside genetics, physiology, and biomedical engineering. SURF runs across all three Mayo campuses and Mayo's Florida campus is in Jacksonville, so confirm the site options in the application if staying in state matters. The window is 1 Nov 2026 - 3 Feb 2027.",
    deadline: "2027-02-03", estimated: false,
    eligibility: "sophomore year completed before the start; enrolled at an accredited U.S. institution; 3.0+ GPA",
    tags: ["bio", "research", "paid"],
    url: "https://college.mayo.edu/academics/biomedical-research-training/summer-undergraduate-research-fellowship-surf/" },

  { name: "Summer Neuroscience Internship Program (SNIP)", host: "University of Florida, Gainesville",
    focus: "The in-state option if you want to stay in Florida. Ten weeks with the Department of Neuroscience and the McKnight Brain Institute, $5,000, and non-UF students get housing. Portal opens 1 November.",
    deadline: "2027-02-13", estimated: true,
    eligibility: "non-UF students at U.S. institutions; sophomore year completed; no prior research required",
    tags: ["bio", "research", "paid", "local"],
    url: "https://neuroscience.ufl.edu/programs/neuroscience-ufl-edu-training-summer-neuroscience-internship-program/" },

  { name: "uPNC - Undergraduate Program in Neural Computation", host: "CMU + Pitt (CNBC), Pittsburgh PA",
    focus: "The most recognizable comp-neuro REU in the country. 10 weeks, stipend + housing + travel. Ask for letters in December.",
    deadline: "2027-02-15", estimated: true, eligibility: "U.S. citizen/PR; sophomore or junior; aimed at future PhDs",
    tags: ["compneuro", "python", "research", "paid", "us-only"],
    url: "https://www.cmu.edu/ni/academics/undergrad/summer-research-program-neural-computation" },

  { name: "Caltech SURF / WAVE Fellows", host: "Caltech, Pasadena CA",
    focus: "You write the proposal with a faculty mentor, so email Computation & Neural Systems faculty in Oct/Nov. Highest-effort application, most shapeable toward theory.",
    deadline: "2027-02-15", estimated: true, eligibility: "SURF open to non-Caltech students; WAVE targets under-resourced institutions",
    tags: ["compneuro", "research", "paid"],
    url: "https://sfp.caltech.edu/undergraduate-research/programs" },

  { name: "NIH Summer Internship Program (SIP)", host: "NIH intramural - NIMH, NINDS, NEI, NIDA",
    focus: "PIs hire directly - the database entry alone does nothing. Email individual PIs in Dec/Jan with a short, specific note and your CV. Opens mid-Nov 2026.",
    deadline: "2027-02-15", estimated: false, eligibility: "U.S. citizen/PR; 18+ by 30 Sep 2027; enrolled at least half time",
    tags: ["bio", "compneuro", "research", "paid", "us-only", "gov"],
    url: "https://www.training.nih.gov/research-training/pb/sip/" },

  { name: "Neuroscience REU", host: "Georgia Tech + Georgia State, Atlanta GA",
    focus: "Human neuroscience - EEG and fMRI with real signal-processing content. $7,000 + housing.",
    deadline: "2027-02-19", estimated: true, eligibility: "U.S. citizen/PR; entering junior or senior year",
    tags: ["bio", "data", "research", "paid", "us-only"],
    url: "https://reu.neuroscience.gatech.edu/neuroscience-reu-application" },

  { name: "NASA OSTEM Internships", org: "acm", host: "NASA centers - incl. Kennedy Space Center, FL",
    focus: "Ten weeks on real NASA projects. Plenty of software, data, and modeling work, and both STEM and non-STEM majors are eligible.",
    deadline: "2027-02-26", estimated: false, eligibility: "U.S. citizen; 3.0+ GPA; 16+; full- or part-time enrollment",
    tags: ["cs", "programming", "data", "research", "paid", "us-only", "gov"],
    url: "https://www.nasa.gov/learning-resources/internship-programs/" },

  { name: "Kavli NDI Undergraduate Summer Internship", host: "Johns Hopkins University, Baltimore MD",
    focus: "Kavli NDI's remit is explicitly data science and neuroscience.",
    deadline: "2027-03-07", estimated: true, eligibility: "see program page",
    tags: ["data", "compneuro", "ml", "research", "paid"],
    url: "https://kavlijhu.org/funding/3" },

  { name: "NSF Neuro-REU (Computational Neuroscience)", host: "University of Missouri, Columbia MO",
    focus: "Opens with a one-week comp-neuro boot camp - the best first computational experience if your background is more biology than math. $6,000 + housing + meals.",
    deadline: "2027-03-15", estimated: true, eligibility: "U.S. citizen/PR; two years completed by June; not Mizzou students",
    tags: ["compneuro", "python", "research", "paid", "us-only", "beginner"],
    url: "https://nairs.mufaculty.umsystem.edu/research/nsf-neural-reu-project" },

  { name: "Neuromatch Academy - Computational Neuroscience", host: "Fully online, 3 weeks each July",
    focus: "Not an internship and not paid, but the fastest way to become a credible comp-neuro applicant. Financial aid exists; TAing later is itself a credential.",
    deadline: "2027-03-22", estimated: true, eligibility: "Python, linear algebra, probability, calculus; open to all",
    tags: ["compneuro", "python", "ml", "remote", "beginner", "intl"],
    url: "https://portal.neuromatchacademy.org/" },

  { name: "Kempner Institute Summer Internship (AI/ML)", host: "Harvard University, Cambridge MA",
    focus: "Sits exactly on the neuroscience/AI boundary. Reviewed in cohorts - first cohort closes first. No housing provided; budget for Cambridge rent.",
    deadline: "2027-03-30", estimated: true, eligibility: "recent graduates eligible; U.S. work authorization; Python + PyTorch",
    tags: ["ml", "neuroai", "python", "research", "paid", "postbac"],
    url: "https://kempnerinstitute.harvard.edu/kempner-institute-undergraduate-summer-internship-program-in-ml-research-engineering/" },

  { name: "Google Summer of Code", host: "Remote, ~12 weeks, ~175 open-source orgs",
    focus: "A paid open-source project with mentors from the org that maintains the code - INCF is the neuroscience one, and its projects are comp-neuro software. Produces a public, citable contribution, which is unusually good evidence for PhD applications. Orgs are announced in mid-February and the contributor window is about two weeks in late March, so write the proposal early.",
    deadline: "2027-03-31", estimated: true, eligibility: "18+; open internationally; students and beginners to open source",
    tags: ["opensource", "programming", "python", "compneuro", "remote", "paid", "intl"],
    url: "https://summerofcode.withgoogle.com/" },

  { name: "NSF REU sites in computing", org: "acm", host: "CS departments nationwide",
    focus: "Paid summer research at another university - AI, security, HPC, graphics, systems. Many sites now take applications only through NSF ETAP, so make an account before the winter rush.",
    deadline: "", when: "sites post Dec - Feb; most deadlines fall Jan - Mar", estimated: false,
    eligibility: "mostly U.S. citizen/PR; varies by site",
    tags: ["cs", "ml", "security", "research", "paid", "us-only", "umbrella"],
    url: "https://www.nsf.gov/funding/initiatives/reu/search" },

  { name: "Wharton Applied Neuroscience & Business Analytics Fellowship", org: "bsa",
    host: "Wharton Neuroscience Initiative + MindCORE, Penn, Philadelphia PA",
    focus: "The clearest neuroscience-meets-business program that exists: ten weeks applying neuroscience to business questions with a Wharton Neuroscience faculty member. $6,000 plus on-campus housing, and only four fellows are funded. Non-Penn students apply through the MindCORE summer application, which carries this fellowship as one of its funding tracks - so apply to MindCORE and name this.",
    deadline: "", when: "2027 details post late Oct 2026", estimated: false,
    eligibility: "1st-3rd years only, NOT graduating seniors; non-Penn applicants must be U.S. citizens or PR",
    tags: ["business", "bio", "data", "research", "paid", "us-only", "firstyear"],
    url: "https://neuro.wharton.upenn.edu/education/summer-research-fellowship/" },

  { name: "Salk SURF", host: "Salk Institute, La Jolla CA",
    focus: "Includes the Computational Neurobiology Laboratory (Sejnowski). Paid as a wage, so work authorization rather than citizenship is the gate.",
    deadline: "", when: "opens 1 Oct 2026 - offers by end of February", estimated: false,
    eligibility: "18+; rising juniors/seniors or CC transfers; 3.0+ GPA",
    tags: ["compneuro", "bio", "research", "paid"],
    url: "https://www.salk.edu/about/our-community/research-and-training-opportunities/summer-research-opportunities/" },

  { name: "Flatiron Institute CCN Summer Interns", host: "Simons Foundation, New York NY",
    focus: "Pure computational and theoretical neuroscience alongside full-time research scientists. A separate NeuroRSE track exists for research-software engineering.",
    deadline: "", when: "applications open 1 Dec 2026", estimated: false,
    eligibility: "undergrad, grad, and pre-doctoral; fewer citizenship limits",
    tags: ["compneuro", "ml", "python", "programming", "research", "paid", "intl", "postbac"],
    url: "https://www.simonsfoundation.org/summer-at-simons/" },

  { name: "Allen Institute ASPIRE", host: "Allen Institute, Seattle WA",
    focus: "Year-long, not a summer program - the natural landing spot for a graduating senior who wants a serious comp-neuro year before a PhD.",
    deadline: "", when: "reopens December 2026", estimated: false,
    eligibility: "POST-BACCALAUREATE ONLY - degree completed before start",
    tags: ["compneuro", "data", "research", "paid", "postbac"],
    url: "https://alleninstitute.org/careers/internships" },

  { name: "SPICE - Summer Program in Computational Psychiatry Education", host: "Mount Sinai, New York NY",
    focus: "Two weeks of lectures then six weeks on a mentored project, and the only computational psychiatry program of its kind. Mount Sinai describes it as built for high school students, while the course materials say high school AND undergraduate - so email the Center before you invest time in an application.",
    deadline: "", when: "watch the page from late winter", estimated: false,
    eligibility: "16+; local students preferred (in person)",
    tags: ["compneuro", "bio", "research", "beginner"],
    url: "https://www.neurocpu.org/spice" },

  { name: "DOE SULI", host: "17 national labs - Oak Ridge (neuromorphic), Sandia",
    focus: "Not computational neuroscience, but a strong quantitative credential that pays well.",
    deadline: "", when: "~early October and January, varies by term", estimated: false,
    eligibility: "U.S. citizen/PR; 17+; enrolled full time",
    tags: ["cs", "ml", "research", "paid", "us-only", "gov"],
    url: "https://science.osti.gov/wdts/suli" },
];

// Portals and listings worth an account rather than an application.
export const PROGRAM_RESOURCES = [
  { label: "NSF ETAP", url: "https://etap.nsf.gov",
    note: "A growing share of NSF REU sites accept applications ONLY here. Make an account in October and save searches for \"neuroscience,\" \"computational,\" and \"neural.\"" },
  { label: "Leadership Alliance portal", url: "https://app.theleadershipalliance.org/",
    note: "Where the SR-EIP application actually lives - and the route into Brown Carney and Princeton SYNAPSE." },
  { label: "FUN internship list", url: "https://www.funfaculty.org/undergrad_internships",
    note: "Faculty for Undergraduate Neuroscience; updated yearly and organized by deadline." },
  { label: "Pathways to Science", url: "https://www.pathwaystoscience.org/Discipline.aspx?sort=MED-NeuroSci_Neuroscience",
    note: "Neuroscience program directory." },
  { label: "NSF REU site search", url: "https://www.nsf.gov/funding/initiatives/reu/search",
    note: "Every funded REU site, filterable by field." },
  { label: "INCF at Google Summer of Code", url: "https://www.incf.org/activities/gsoc",
    note: "The neuroscience mentoring org inside GSoC - where the comp-neuro project ideas are posted, months before the contributor window opens." },
  { label: "comp-neuro mailing list", url: "https://lists.cnsorg.org/hyperkitty/list/comp-neuro@lists.cnsorg.org/",
    note: "Institutes post internships here directly, often before the web page updates." },
];

// Shown under the summer-programs list.
export const PROGRAM_NOTE = "Verify every deadline on the program's own page before applying - dates marked \"est.\" are last cycle's and will shift by a few days. Most of these require one academic year remaining after the summer; if you graduate in spring 2027, look at Kempner, Allen ASPIRE, Flatiron, and direct lab outreach.";

// --- CS INTERNSHIPS + PROGRAMS ----------------------------------------------
// For FSU CS undergrads, researched September 2026 for the Summer 2027 cycle.
// Same shape as SUMMER_PROGRAMS, plus `org` so these sit under ACM in the
// filters. The big difference from the research programs above: industry
// applications open in AUGUST-OCTOBER of the year BEFORE the internship and
// close on a rolling basis, months earlier than any REU. Applying in October
// is normal; applying in February is late.
export const CS_INTERNSHIPS = [
  { name: "Google SWE Intern, Summer 2027 (BS)", org: "acm", host: "Google - US offices",
    focus: "The standard software engineering internship. Summer 2027 postings went up on 20 July 2026 and are reviewed on a rolling basis, closing once projects fill - so the real deadline is whenever they run out, not a date.",
    deadline: "", when: "live since 20 Jul 2026 - rolling until filled", estimated: false,
    eligibility: "enrolled in a BS in CS or related; returning to school after",
    tags: ["cs", "programming", "industry", "paid"],
    url: "https://www.google.com/about/careers/applications/students" },

  { name: "Google STEP Internship", org: "acm", host: "Google - US offices",
    focus: "Built for first- and second-years with little or no industry experience. 12 weeks, real projects, paired with a Google engineer.",
    deadline: "2026-10-15", estimated: true, eligibility: "1st- or 2nd-year undergrads in CS/CE; one CS course done",
    tags: ["cs", "programming", "industry", "paid", "firstyear", "beginner"],
    url: "https://www.google.com/about/careers/applications/students" },

  { name: "DoD SMART Scholarship", org: "acm", host: "Department of Defense labs",
    focus: "Full tuition, an annual stipend, a paid summer internship, and guaranteed civilian DoD employment after graduation. Big commitment, big payoff.",
    deadline: "2026-12-04", estimated: true, eligibility: "U.S. citizen; must be able to hold a security clearance; service commitment",
    tags: ["cs", "security", "industry", "paid", "us-only", "gov"],
    url: "https://www.smartscholarship.org/smart" },

  { name: "Outreachy", org: "acm", host: "Remote, open-source communities worldwide",
    focus: "Three months of paid remote open-source work with a mentor. $7,000 stipend. Projects span programming, data science, UX, and docs. Cohorts run May-Aug and Dec-Mar, and each one depends on sponsors - Outreachy was still seeking sponsorship for its December 2026 cohort as of September 2026, so confirm the May 2027 round is funded before you build a plan around it.",
    deadline: "2027-02-12", estimated: true, eligibility: "anyone facing under-representation or systemic bias in tech where they live",
    tags: ["opensource", "programming", "python", "remote", "paid", "intl", "beginner"],
    url: "https://www.outreachy.org/" },

  { name: "FSU UROP", org: "acm", host: "Florida State University",
    focus: "FSU's own research placement program - you get matched with a faculty project and present at the spring symposium. CS faculty work on AI, security, HPC, graphics, and computational biology. The lowest-friction research on this page.",
    deadline: "2027-05-01", estimated: true, eligibility: "FSU 1st-years and rising 2nd-years; transfers by 1 July",
    tags: ["cs", "research", "local", "beginner"],
    url: "https://cre.fsu.edu/undergradresearch/urop" },

  { name: "Microsoft Explore", org: "acm", host: "Microsoft - Redmond WA and other US sites",
    focus: "12 weeks rotating through design, build, and quality in a pod with other interns - a look at both SWE and PM before you commit to either. CHECK THIS ONE FIRST: Microsoft's program page still describes Explore, but no Summer 2027 posting had appeared as of September 2026, and the other two dedicated first- and second-year tracks (Meta University, which is gone) did not survive. If there is no Explore listing, apply to the general SWE internship instead.",
    deadline: "", when: "no Summer 2027 posting confirmed as of Sep 2026", estimated: false,
    eligibility: "1st- or 2nd-year; intro CS + one semester of calculus; enrolled in US/Canada/Mexico",
    tags: ["cs", "programming", "industry", "paid", "firstyear", "beginner"],
    url: "https://careers.microsoft.com/v2/global/en/exploremicrosoft" },

  { name: "Amazon SDE Internship", org: "acm", host: "Amazon - US offices",
    focus: "Summer 2027 SDE roles are already posted and reviewed on a rolling basis. Amazon posts earlier than almost anyone and does an online assessment rather than a resume screen.",
    deadline: "", when: "live now - rolling review, apply the week you see it", estimated: false,
    eligibility: "enrolled in a BS+ in CS/CE or related; 18+",
    tags: ["cs", "programming", "industry", "paid"],
    url: "https://www.amazon.jobs/content/en/career-programs/university/internships-for-students" },

  { name: "MLH Fellowship", org: "acm", host: "Remote, 12 weeks",
    focus: "Open-source and software-engineering tracks with expert mentors, in small pods. Runs in batches year round, so there is almost always one coming.",
    deadline: "", when: "rolling batches; each closes a few weeks before it starts", estimated: false,
    eligibility: "open to students and non-students, any background",
    tags: ["opensource", "programming", "cs", "remote", "paid", "intl", "beginner"],
    url: "https://fellowship.mlh.com/" },

  { name: "CyberCorps Scholarship for Service at FSU", org: "acm", host: "FSU Department of Computer Science",
    focus: "FSU is an NSF SFS institution: $27,000 a year for undergrads plus tuition and fees, a required paid federal summer internship, and the January SFS job fair in Washington. Placement into federal jobs has run around 92%.",
    deadline: "", when: "ask the CS department - cohorts start in the fall", estimated: false,
    eligibility: "U.S. citizen; cybersecurity focus; federal service equal to the scholarship length",
    tags: ["cs", "security", "paid", "local", "us-only", "gov"],
    url: "https://www.cs.fsu.edu/financial-aid/scholarship-fellowship-opportunities/" },

  { name: "NSA student programs", org: "acm", host: "National Security Agency - Fort Meade MD",
    focus: "Paid internships and a co-op program across software, cryptography, and cybersecurity. Postings go up well before the summer and clearance processing is slow, so early is not optional here.",
    deadline: "", when: "postings appear Aug - Oct for the next summer", estimated: false,
    eligibility: "U.S. citizen; must pass a security clearance and polygraph",
    tags: ["cs", "security", "industry", "paid", "us-only", "gov"],
    url: "https://www.intelligencecareers.gov/nsa/students-and-internships" },

  { name: "MITRE internships and co-ops", org: "acm", host: "MITRE - Bedford MA, McLean VA",
    focus: "500+ interns a year on federally funded R&D across cyber, AI, and systems. Mostly rising juniors and seniors, but they take strong students at any level.",
    deadline: "", when: "apply in the fall; decisions start in early November", estimated: false,
    eligibility: "mostly U.S. citizens; clearance-eligible for some projects",
    tags: ["cs", "security", "ml", "research", "industry", "paid", "us-only", "gov"],
    url: "https://careers.mitre.org/us/en/student-programs" },

  { name: "L3Harris interns and co-ops", org: "acm", host: "L3Harris - Palm Bay and Melbourne FL",
    focus: "The largest engineering employer on Florida's Space Coast, and a realistic in-state summer without leaving the state. Software, embedded, and systems roles; clearance sponsorship opens long-term options.",
    deadline: "", when: "postings open Aug - Oct, filled on a rolling basis", estimated: false,
    eligibility: "U.S. citizenship required for most roles",
    tags: ["cs", "programming", "industry", "paid", "local", "us-only", "gov"],
    url: "https://careers.l3harris.com/en/new-grads-and-interns" },

  { name: "Quant early-insight programs", org: "acm", host: "Jane Street, Citadel, IMC and similar",
    focus: "Short, paid, all-expenses trips (Jane Street INSIGHT and FOCUS, Citadel Discover) that run over winter break and feed directly into the next summer's internships. No finance background expected - they want programmers and problem-solvers.",
    deadline: "", when: "apply in the fall for January events", estimated: false,
    eligibility: "1st- and 2nd-year students for most; strong math + coding",
    tags: ["quant", "cs", "programming", "industry", "paid", "firstyear"],
    url: "https://www.janestreet.com/join-jane-street/programs-and-events/" },

  { name: "Email FSU CS faculty directly", org: "acm", host: "James J. Love Building, FSU",
    focus: "FSU CS runs active groups in AI, security and forensics, computer vision, computational biology, HPC, and databases. Most undergrad research positions here are never advertised - they come from a short email naming a specific paper and asking to help. Costs nothing but an afternoon.",
    deadline: "", when: "rolling - send these in the first weeks of a semester", estimated: false,
    eligibility: "any FSU student; a course grade and a little Python is enough to start",
    tags: ["cs", "python", "research", "local", "beginner"],
    url: "https://www.cs.fsu.edu/researches/" },
];

// Trackers and portals for the CS list, shown under it.
export const CS_RESOURCES = [
  { label: "Summer 2027 Internships tracker", url: "https://github.com/SimplifyJobs/Summer2027-Internships",
    note: "Simplify + Pitt CSC, updated daily: SWE, data, AI, quant, PM and hardware postings with application links. The single most useful page during recruiting season." },
  { label: "swelist.com", url: "https://swelist.com",
    note: "The same listings in a browsable site rather than a GitHub table." },
  { label: "NSF ETAP", url: "https://etap.nsf.gov",
    note: "Where a growing share of NSF REU sites take applications. Make an account in October and save searches for \"computer science,\" \"machine learning,\" and \"security.\"" },
  { label: "FSU Career Center - CS blueprint", url: "https://career.fsu.edu/blueprint/computer-science",
    note: "FSU's own guide plus NoleNetwork postings, resume reviews, and the fall career fair - the part most students skip." },
  { label: "CyberCorps SFS", url: "https://sfs.opm.gov/",
    note: "The federal portal behind the scholarship: participating schools, agencies, and the January job fair." },
  { label: "SpearHacks", url: "https://spearhacks.com/",
    note: "FSU's own spring hackathon - this is HackFSU under its new name, which it has carried since spring 2025. A finished hackathon project is the easiest thing to put on a resume with no internship yet." },
];

export const CS_NOTE = "Industry deadlines run a full cycle ahead of research deadlines: Summer 2027 postings opened in August and September 2026 and close on a rolling basis, while REU and fellowship deadlines land between January and March 2027. If you only do one thing this week, apply to the roles already open. Dates marked \"est.\" are last cycle's - confirm on the program's own page.";

// --- BUSINESS & STEM --------------------------------------------------------
// For BSA, researched September 2026 for the Summer 2027 cycle. The brief was
// neuroscience-adjacent business rather than business in general, so these sit
// where neuroscience meets strategy, policy, and industry.
//
// BSA's one mentored-research fellowship (Wharton Applied Neuroscience) is up
// with the summer research programs instead of here, for the same reason ACM's
// REUs are - it is the same kind of thing as the rest of that list. The org
// chip still finds it.
//
// Two clocks to keep apart: life-science consulting and pharma recruit a YEAR
// ahead and rolling (ClearView's Summer 2027 posting went up in July 2026),
// while the policy and fellowship tracks run on the Nov - Feb academic cycle.
export const BSA_PROGRAMS = [
  { name: "ClearView Life Sciences Summer Analyst", org: "bsa",
    host: "ClearView Healthcare Partners - Boston, NYC, San Francisco",
    focus: "Nine weeks of life-science strategy consulting: market research, brand strategy, and launch questions for biopharma clients. $37.50 an hour. The Summer 2027 posting is already live - U.S. applications open in July, a full year ahead - which makes this the listing on the page you are most able to act on today.",
    deadline: "", when: "Summer 2027 posting is live now - rolling", estimated: false,
    eligibility: "majoring or minoring in life sciences; graduating by summer 2028",
    tags: ["business", "bio", "industry", "paid"],
    url: "https://clearviewhcp.com/careers/explore-opportunities/opportunities-for-undergraduate-students/" },

  { name: "Trinity Life Sciences Summer Associate", org: "bsa",
    host: "Trinity Life Sciences - Waltham MA, NYC, San Francisco",
    focus: "Nine weeks from late June to mid-August across consulting, analytics, and corporate teams. Same life-science consulting world as ClearView, so one set of materials covers both applications - do them together.",
    deadline: "", when: "due late fall - early winter, varies by business unit", estimated: false,
    eligibility: "six months to a year from graduating",
    tags: ["business", "bio", "data", "industry", "paid"],
    url: "https://trinitylifesciences.com/company/careers/early-talent/" },

  { name: "Biotech and pharma commercial internships", org: "bsa",
    host: "Biogen, Genentech, Lilly, Pfizer, Regeneron and similar",
    focus: "The business side of a drug company rather than the bench - market research, brand strategy, strategy and operations, regulatory. Biogen's portfolio is the neuroscience-heaviest of the big ones. Ten to twelve weeks, and the pay is well above a typical campus job.",
    deadline: "", when: "recruiting Aug - Nov 2026, second wave Dec - Feb", estimated: false,
    eligibility: "varies by company; most want a declared major and U.S. work authorization",
    tags: ["business", "bio", "industry", "paid"],
    url: "https://www.biogen.com/careers/students-and-graduates.html" },

  { name: "SfN Early Career Policy Ambassadors", org: "bsa",
    host: "Society for Neuroscience - Washington DC + year-round remote",
    focus: "A 10-month ambassadorship in science policy: Hill Day training, Capitol Hill Day meeting your own members of Congress, and short monthly advocacy actions. Unpaid, and the only thing on this page that puts an undergraduate in a room with a federal policymaker. The 2025 window ran 3 Oct to 6 Jan, so plan on roughly that again.",
    deadline: "", when: "expect early Oct 2026 - early Jan 2027", estimated: false,
    eligibility: "SfN member in good standing, already doing neuroscience research in a lab; PI letter required",
    tags: ["policy", "bio", "gov"],
    url: "https://www.sfn.org/advocacy/us-advocacy-programs/early-career-policy-ambassadors" },
];

// Portals for the BSA list, shown under it.
export const BSA_RESOURCES = [
  { label: "Career Network in Neuroscience & Society", url: "https://neuroxcareers.org/resources/",
    note: "The Dana Foundation's own running list of neuroscience-meets-ethics, law, policy, and business openings. More than fits on this page, and it is where the ones here came from." },
  { label: "Dana Foundation - Neuroscience & Society", url: "https://dana.org/neuroscience-and-society/",
    note: "The funder behind most of the neuroscience-and-society training money. New programs show up in its grant announcements before they have their own application pages." },
  { label: "BioSpace internships", url: "https://jobs.biospace.com/landingpage/1869493/biotech-pharmaceutical-and-clinical-research-internships/",
    note: "Biotech and pharma postings, commercial roles included - the industry equivalent of the CS trackers above." },
];

export const BSA_NOTE = "Two different clocks here. Consulting and pharma recruit a year ahead on a rolling basis, so ClearView and the biotech commercial roles are open now and close when they fill; the policy and fellowship tracks run Oct - Feb like the research programs. If you want one thing to do this week, it is the ClearView posting. Every date here was checked in September 2026 - confirm on the program's own page before you rely on it.";
