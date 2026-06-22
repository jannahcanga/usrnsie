// Subject tree the app is organized around (clinical subject, the way review
// books group content — not the NCLEX "Client Needs" categories).
// Each group renders as an <optgroup>; each item is one selectable subject.
const SUBJECT_GROUPS = [
  {
    group: "Fundamentals",
    items: [{ id: "fundamentals", label: "Fundamentals" }]
  },
  {
    group: "Pharmacology",
    items: [{ id: "pharmacology", label: "Pharmacology" }]
  },
  {
    group: "Medical-Surgical",
    items: [
      { id: "ms-cardiovascular", label: "Cardiovascular" },
      { id: "ms-respiratory", label: "Respiratory" },
      { id: "ms-neurological", label: "Neurological" },
      { id: "ms-gastrointestinal", label: "Gastrointestinal" },
      { id: "ms-renal", label: "Renal / Genitourinary" },
      { id: "ms-endocrine", label: "Endocrine" },
      { id: "ms-musculoskeletal", label: "Musculoskeletal" },
      { id: "ms-heme-immune", label: "Hematologic / Immune" },
      { id: "ms-integumentary", label: "Integumentary" },
      { id: "ms-fluids-electrolytes", label: "Fluids, Electrolytes & Acid-Base" },
      { id: "ms-oncology", label: "Oncology" },
      { id: "ms-perioperative", label: "Perioperative Care" }
    ]
  },
  {
    group: "Maternal-Newborn / OB",
    items: [{ id: "maternal-newborn", label: "Maternal-Newborn / OB" }]
  },
  {
    group: "Pediatrics",
    items: [{ id: "pediatrics", label: "Pediatrics" }]
  },
  {
    group: "Mental Health / Psychiatric",
    items: [{ id: "mental-health", label: "Mental Health / Psychiatric" }]
  },
  {
    group: "Leadership & Management",
    items: [{ id: "leadership", label: "Leadership & Management" }]
  },
  {
    group: "Cross-Cutting High-Yield",
    items: [{ id: "cross-cutting", label: "Cross-Cutting High-Yield" }]
  }
];
