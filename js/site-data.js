// ============================================================================
//  CompNeuroSociety - SITE CONTENT (the only file you need to edit!)
// ============================================================================
//  HOW TO UPDATE:
//  • EVENTS: add new events to the TOP of the list. Date format
//    "YYYY-MM-DDTHH:MM" (24h local). The home page + events page update
//    themselves: next 2 upcoming + latest past on home, full timeline on
//    events.html, countdowns included. Put photos in images/ first.
//  • PEOPLE: edit LEADERSHIP / GRAD_COUNCIL / MENTORS / TEAM (people.html).
//  • PROJECTS: CURRENT_PROJECT (set to `null` when there's no active team,
//    the page shows a "forming soon" placeholder) + PAST_PROJECTS
//    (projects.html); APPLICATIONS.open flips the apply button on/off.
//  • LINKS: every form/social URL, used across pages.
// ============================================================================

export const LINKS = {
  joinForm: "https://forms.office.com/r/6PWtUbDKyw",
  teamForm: "https://forms.office.com/r/S9BmCN4BW4",
  projectForm: "https://forms.office.com/r/Hh5dPKHHGW",
  mentorForm: "https://forms.office.com/r/bSLpSmSnjp",
  leadEventForm: "https://forms.office.com/r/b0y9dAKg0k",
  contactForm: "https://forms.office.com/Pages/ResponsePage.aspx?id=61Bkowbbp0KNGwJnGfcB48ET8YNcvAVKnZIUvImXTKdUM0RNSEgwMzFOME04TDdXVzNUTFoyTlNWVi4u",
  instagram: "https://www.instagram.com/compneurosocietyfsu/",
  linkedin: "https://linkedin.com/company/compneurosociety-at-fsu",
  groupme: "https://groupme.com/join_group/105475595/FTxvss9F",
  noleCentral: "https://nolecentral.dsa.fsu.edu/organization/compneurosociety",
  calendar: "https://calendar.google.com/calendar/embed?src=compneurosociety%40outlook.com&ctz=America%2FNew_York",
  email: "compneurosociety@outlook.com",
  constitution: "constitution.pdf",
  fiuPage: "project_fiu.html",
};

// --- EVENTS (newest first). The two "example" entries are placeholders -
// --- replace them with real events and delete the `example: true` line.
export const EVENTS = [
  { title: "Fall Involvement Fair", date: "2026-08-27T17:00", location: "Tucker Civic Center",
    blurb: "Come meet the CompNeuroSociety team and learn about our upcoming events, projects, and how to get involved!" },
  { title: "Python Basics 4 Neuro/DataSci - Part 1", date: "2026-09-15T18:00", location: "TBA",
    blurb: "With Codeducation - data types, loops, functions and plotting, from zero.",
    image: "images/python_coded.jpg" },
  { title: "Intro to ML/AI 4 NeuroSci", date: "2025-10-20T19:00", location: "WJB 2029",
    blurb: "Machine learning basics - key concepts and real-world applications for neuroscience. Perfect for beginners.",
    image: "images/mlworkshop.jpg" },
  { title: "A Conversation with Devon White, CEO of FIELD", date: "2025-10-09T17:45", location: "Virtual",
    blurb: "How cutting-edge neurotechnology and brain-data processing are transforming human intelligence and potential.",
    image: "images/devonworkshop.jpg" },
  { title: "Python Basics 4 Neuro/DataSci - Part 2", date: "2025-09-18T18:00", location: "PDB A204",
    blurb: "With Codeducation - LFPs, spike-train plots, correlation and summary statistics on neural data.",
    image: "images/python_coded.jpg" },
  { title: "Python Basics 4 Neuro/DataSci - Part 1", date: "2025-09-16T18:00", location: "Thagard 211",
    blurb: "With Codeducation - data types, loops, functions and basic plotting for students with no Python experience.",
    image: "images/python_coded.jpg" },
  { title: "Workshop on Computational Neuroscience", date: "2025-06-27T14:00", location: "PDB A204",
    blurb: "Multi-level brain modeling and recent research, led by Dr. Rodrigo Pena from the FAU Stiles Nicholson Brain Institute.",
    image: "images/PenaWorkshopWebsiteFlyer.png" },
  { title: "Intro to Python, GitHub, VS Code Workshop", date: "2025-04-17T21:15", location: "FSU",
    blurb: "Python, GitHub and VS Code - purpose, installation, and usage for beginners starting to code.",
    image: "images/placeholder.png" },
  { title: "Inaugural GBM", date: "2025-04-04T21:15", location: "FSU",
    blurb: "Our first General Body Meeting - the mission, upcoming events, and the intersection of neuroscience and computing.",
    image: "images/gbm.png" },
];

// --- PEOPLE ---
export const LEADERSHIP = [
  { name: "Sebas Ruiz", role: "Founder + President", photo: "images/SebasRuiz.JPG",
    bio: "I work in the Sherif Lab @Brown currently working on modeling psychiatric illnesses with NeuroAI. I really enjoy underground rap and earl grey tea.",
    links: [{ label: "Website", url: "https://www.sebasruiz.site" }, { label: "LinkedIn", url: "https://www.linkedin.com/in/sebastiansebasruiz/" }] },
  { name: "Upi Shanker", role: "Vice-President + Website Coordinator", photo: "images/upi.jpg",
    bio: "I am a Freshman at FSU where I am a research assistant, data analytics intern, and front-end web developer. Outside of academics, I enjoy playing basketball and listening to music!",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/upishanker/" }] },
  { name: "Andre Quintero", role: "Project Manager", photo: "images/andre.jpg",
    bio: "I am a NeuroAI researcher involved in a few labs at FSU, focused on memory, visual and motor decoding. I intend to work with innovative teams in the MedTech industry. In my free time, I enjoy reading and I powerlift!",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/andre-quintero-312769276/" }] },
  { name: "Hafsa Baysal", role: "Treasurer", photo: "images/hafsa.png",
    bio: "I'm a second year and I never want to join the work field. I'm part of the Wilber Lab on campus and I am interested in dementia research. I enjoy quality time with friends and reading!",
    links: [] },
  { name: "Sia Kakkar", role: "Secretary", photo: "images/sia.png",
    bio: "I am a sophomore and enjoy doing neuroscience research, particularly on the cognitive effects of eating disorders. I also enjoy playing tennis and painting!",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/sia-kakkar-a4b77427b/" }] },
];

// export const GRAD_COUNCIL = [
//   { name: "Jake Tear", role: "Neuroscience PhD · Riddle Lab", photo: "images/jaketear.jpg",
//     bio: "I'm interested in improving the utility of EEG measures for precision psychiatry. Fun fact: I enjoy surfing and was on the UCSB surf team prior to joining FSU!", links: [] },
//   { name: "Yicheng Zheng", role: "Neuroscience PhD · Wilber Lab", photo: "images/yicheng.jpeg",
//     bio: "I investigate the mechanisms underlying spatial navigation using electrophysiology in rodents, and explore potential treatments for spatial awareness deficits in Alzheimer's disease. Fun fact: my dog has its own Instagram page!", links: [] },
//   { name: "Greg Owanga", role: "Biomathematics PhD · Bertram Lab", photo: "images/greg_tennessee.jpg",
//     bio: "I study how neuron populations in the gustatory cortex form and reorganize functional networks, combining network theory, signal processing and visualization. Fun fact: I'm writing a book and I'm a lifelong Lewis Hamilton fan.", links: [] },
// ];

export const MENTORS = [
  { name: "Dr. Carmen Varela", role: "Faculty Advisor", photo: "images/varela.jpg",
    bio: "Ph.D. in Computational Neuroscience @ UChicago. Assistant Professor @ FSU in Psychology and Neuroscience.",
    links: [{ label: "Lab Website", url: "https://varelalab.create.fsu.edu/" }] },
  { name: "Dr. Rodrigo Pena", role: "Pena Lab · Principal Investigator", photo: "images/rodrigo_pena.jpg",
    bio: "Ph.D. in Computational Neuroscience. Assistant Professor of Biological Sciences @ FAU (Stiles-Nicholson Brain Institute), modeling the brain across scales - ion channels, synapses, neurons, networks and systems.",
    links: [{ label: "Lab Website", url: "https://penaslab.com" }, { label: "Scholar", url: "https://scholar.google.com/citations?user=17avyRAAAAAJ" }] },
  { name: "Dr. Juan Lopez", role: "Pena Lab · Postdoctoral Researcher", photo: "images/juan_lopez.jpg",
    bio: "Ph.D. '24 and M.S. '18 @ FAU. Computational neuroscientist modeling Drosophila connectomes and neural circuits - including the Giant Fiber escape reflex - to understand how neurons communicate.",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/juanlopezphd" }] },
  { name: "Ty Roachford", role: "Pena Lab · Ph.D. Student", photo: "images/ty_roachford.jpg",
    bio: "Ph.D. student in Theoretical and Computational Neuroscience @ FAU Stiles-Nicholson Brain Institute. Interested in evolutionary, ultra-low-power intelligent networks.",
    links: [{ label: "Website", url: "https://www.tyfoodsforthought.com" }] },
];

export const TEAM = [
  { name: "Katya Sniriova", role: "Team Member", photo: "images/members/KatyaSniriova.jpeg",
    bio: "Interests: neuromorphic computing, computational biology, brain-machine interfaces. Fun fact: I've been vegetarian for 8 years!", links: [] },
  { name: "Eva Zlochower", role: "Team Member", photo: "images/members/EvaZlochower.png",
    bio: "Interests: psychopharmacology and precision treatment/diagnosis. Fun fact: I love finding new songs to learn on my guitar.", links: [] },
  { name: "Thomas Hall", role: "Team Member · Computer Science", photo: "images/members/ThomasHall.jpg",
    bio: "Interests: machine learning / NeuroAI. Fun fact: cats are my favorite animals.", links: [] },
  { name: "Victoria Montalvo", role: "Team Member · Behavioral Neuroscience & Biochemistry", photo: "images/members/VictoriaMontalvo.jpg",
    bio: "Interests: brain mapping, neuronal activity and neurodegenerative diseases. Fun fact: I love trail running and swimming!", links: [] },
];

// --- PROJECTS ---
export const APPLICATIONS = {
  open: true,
  closedNote: "Applications reopen Mid-December",
  formUrl: "https://forms.office.com/r/Hh5dPKHHGW",
};

export const CURRENT_PROJECT = null;

export const PAST_PROJECTS = [
  { name: "Pena Lab Replication → ReScience", image: "images/PenaWorkshopWebsiteFlyer.png",
    summary: "Replicated a previously published computational neuroscience paper - originally coded in NEURON - using a different tool, focused on computational modeling and reproducibility, with mentorship from the Pena Lab toward a ReScience publication." },
  { name: "Brain-to-Text Competition Team", image: "images/projects/brain-to-text-1.jpg",
    summary: "Decoding neural signals to translate brain activity into text - signal processing, machine learning and neural decoding with LLMs, with weekly team meetings and a competition showcase." },
  { name: "Computational Retina Model Team", image: "images/projects/retina-model-1.jpg",
    summary: "Replicated a published computational model of the retina in NEURON - visual processing, modeling best practices and scientific reproducibility, with weekly learning sprints." },
];
