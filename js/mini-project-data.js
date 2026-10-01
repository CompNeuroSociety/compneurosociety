// ============================================================================
//  MINI-PROJECT HUB - content for mini-project.html (the only file you edit)
// ============================================================================
//  The page for students in this semester's project: attend the workshop
//  series, pick a paper, replicate one figure from it.
//
//  HOW TO UPDATE:
//  • META      - term, title, the blurb at the top, and the final deadline.
//  • LINKS     - Discord / submission form / shared folder. A blank url hides
//                that button, so it is safe to leave any of them empty.
//  • WORKSHOPS - one entry per session. Paste the recording link into
//                `recording` after each one and the card flips from
//                "recording soon" to a play button. Sessions you have not
//                listed here are still picked up from the Google Calendar
//                sync (any event with "workshop" in its title since
//                META.termStart), so the next date shows up on its own.
//                An entry here on the same day as a calendar event replaces
//                it, so you only need to add one once there is something to
//                attach (a title, recording, slides, code).
//  • PAPERS    - the papers students are replicating. Add one entry per paper
//                as students pick them.
//  • NEWS      - short announcements, newest first. Deleting an old one is safe.
//
//  Every list can be empty: the page shows a "nothing yet" line instead of
//  breaking.
// ============================================================================

export const META = {
  term: "Fall 2026",
  title: "Figure Replication Mini-Project",
  blurb: "For this semester our project is a mini-project, where we run a workshop series and you replicate one figure from a paper of your choosing. This page has everything you need for it: the workshop recordings, the papers, the upcoming dates, and announcements.",
  // Calendar events with "workshop" in the title on or after this date count
  // as part of this semester's series.
  termStart: "2026-08-15",
  // Final figure due date, "YYYY-MM-DDTHH:MM". Leave "" to hide the countdown.
  due: "",
  dueLabel: "Final figures due",
};

export const LINKS = {
  discord: { label: "Project Discord", url: "https://discord.gg/sfm2RPd3gH" },
  submit:  { label: "Submit your paper choice", url: "https://docs.google.com/forms/d/e/1FAIpQLSdrBmk57OlTfGsefPoZto-AptLZZ6Uw4xdFZD74NBG-360TIQ/viewform?usp=header" },
  folder:  { label: "Shared project folder", url: "https://drive.google.com/drive/folders/1Tw-KMQGwC3nE12yrP92G3egntPKU0hLF?usp=sharing" },
  calendar:{ label: "Club calendar", url: "https://calendar.google.com/calendar/embed?src=compneurosociety%40gmail.com&ctz=America%2FNew_York" },
};

// date      - "YYYY-MM-DDTHH:MM" (local time). Leave "" if you do not know it:
//             the session is then shown as past, below the dated ones.
// title     - what the session covered
// location  - room; optional
// blurb     - one line on what it covers; optional
// recording - link to the video; empty shows "recording soon" (past) or nothing (upcoming)
// slides, code - optional extra links
// links     - any other links, as [{ label, url }]; optional
// Recordings, slides and notebooks live in the shared project folder (LINKS.folder),
// one subfolder per workshop.
export const WORKSHOPS = [
  { date: "2026-09-09T18:30", title: "Workshop 1 - How We Got Started and Research Essentials", location: "OSB 0108",
    recording: "https://drive.google.com/file/d/1heWl_mq8rAct1x7XcHM-o-vGQT0H5iKY/view",
    slides: "https://drive.google.com/file/d/1iHnb_dwTqroLYGE6fAUuFRdFZUiLussY/view" },

  { date: "2026-09-14T18:30", title: "Workshop 2 - How to Use AI Ethically in Research", location: "PDB A204",
    recording: "https://drive.google.com/file/d/1MNflvrNvXb0sbsgB1lGDYYkTJATBqUYc/view",
    slides: "https://drive.google.com/file/d/1Qe82te6plg1tIZS2J19X7ZinNir_D84q/view",
    links: [
      { label: "exercise notebook", url: "https://colab.research.google.com/drive/113EEDq_bLdauafenUQUv6rQbseERv6BA" },
      { label: "answers notebook", url: "https://colab.research.google.com/drive/1klM1Kde2lz0lq4GitlGrvm7vHaVMXf6t" },
    ] },

  { date: "2026-09-23T18:30", title: "Workshop 3 - Mathematical Foundations and Units", location: "OSB 0108",
    recording: "https://drive.google.com/file/d/1F61DxIEkzZ7b7RE6JOuLhbidcnP1-YK-/view",
    slides: "https://drive.google.com/file/d/1cGAiMhCRz7QeUckW67lgEzmuliMH8g6i/view" },
  { date: "2026-10-05T18:30", title: "Workshop 4 - Writing Functions and Plotting in Python",
    location: "PDB A204", blurb: "We will cover how to write reusable Python functions and then plot them with NumPy and Matplotlib, which are the tools you will use to rebuild your figure.",
    recording: "",
    // slides: "https://drive.google.com/file/d/1FUkphrnDCo4oQTcULJamjVDWPEZLKBdH/view",
    // links: [
    //   { label: "practice notebook", url: "https://colab.research.google.com/drive/1uIVVhZCYui8xxNhTdhdxdRd-JzgEwwlI" },
    // ] 
    },
];

// title    - paper title
// authors  - "Lastname et al."
// year, venue - optional
// url      - DOI or PDF link
// figure   - which figure is being replicated, e.g. "Fig. 2B"
// who      - student(s) working on it; optional
// status   - "picked" | "in progress" | "replicated"; optional
// label    - short tag shown on the card, e.g. "Option 1"; optional
// note     - what the paper models and how hard it is; optional
export const PAPERS = [
  { label: "Option 1",
    title: "A computational model of altered neuronal activity in altered gravity",
    authors: "Gontier et al.", year: 2024, venue: "bioRxiv",
    url: "https://www.biorxiv.org/content/10.1101/2024.07.30.605832v2.full#sec-8",
    note: "This paper focuses on the electrical activity of neurons and the time constant, not on anything chemical, and the equations they use are explicitly shown in the paper." },

  { label: "Option 2",
    title: "Computational Model for Synthesizing Auditory Brainstem Responses to Assess Neuronal Alterations in Aging and Autistic Animal Models",
    authors: "Li et al.", year: 2026, venue: "Journal of the Association for Research in Otolaryngology",
    url: "https://link.springer.com/article/10.1007/s10162-026-01060-0",
    note: "This paper adds the auditory components for mice and has sound measured in decibels, with no chemical side and just electrical signals, and it uses Brian2 (a Python simulator for spiking neural networks) along with cochlea." },

  { label: "Option 3",
    title: "Spinal circuit mechanisms constrain therapeutic windows for ALS intervention: A computational modeling study",
    authors: "Strohmer et al.", year: 2026, venue: "Neurobiology of Disease",
    url: "https://www.sciencedirect.com/science/article/pii/S096999612500470X#d1e3627",
    note: "This paper includes groups of neurons and their total activity, however it starts to introduce the chemical impacts of the degeneration of the neurons, which makes it a bit more difficult to model." },

  { label: "Option 4",
    title: "A Computational Model of Major Depression: the Role of Glutamate Dysfunction on Cingulo-Frontal Network Dynamics",
    authors: "Ramirez-Mahaluf et al.", year: 2015, venue: "Cerebral Cortex",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5939208/",
    note: "This paper uses Hodgkin-Huxley neurons (the classic equations for how a neuron fires), however the chemical aspects of modeling depression are a bit more difficult and require more differential equations to include the chemical part." },
];

// date - "YYYY-MM-DD"; link is optional ({ label, url })
export const NEWS = [
  { date: "2026-09-25", title: "Project hub is live",
    body: "We will post all of the workshop recordings, paper links, and upcoming dates for the mini-project here, so it is worth bookmarking this page." },
];
