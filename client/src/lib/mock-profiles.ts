function makeSvgPlaceholder(seed: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#111827"/>
          <stop offset="1" stop-color="#6d28d9"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <circle cx="200" cy="220" r="90" fill="#0b1020" opacity="0.55"/>
      <rect x="110" y="340" width="180" height="20" rx="10" fill="#0b1020" opacity="0.55"/>
      <text x="200" y="520" fill="#e5e7eb" font-size="20" text-anchor="middle" font-family="system-ui">
        AI Portrait Loading
      </text>
      <text x="200" y="548" fill="#9ca3af" font-size="14" text-anchor="middle" font-family="system-ui">
        Seed: ${seed}
      </text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const mockProfiles = [
  {
    id: 1,
    name: "Sophie",
    age: 28,
    gender: "female",
    bio: "Adventure seeker and coffee enthusiast. I'm usually hiking or finding a new hidden cafe.",
    imageUrl: makeSvgPlaceholder("Sophie-1"),
    isAI: true
  },
  {
    id: 2,
    name: "James",
    age: 31,
    gender: "male",
    bio: "Photographer by day, chef by night. Dry humor. I will absolutely judge your cutting technique.",
    imageUrl: makeSvgPlaceholder("James-2"),
    isAI: true
  },
  {
    id: 3,
    name: "Emma",
    age: 24,
    gender: "female",
    bio: "Book lover and yoga instructor. If you have a favorite essay, I want to hear about it.",
    imageUrl: makeSvgPlaceholder("Emma-3"),
    isAI: true
  },
  {
    id: 4,
    name: "Michael",
    age: 30,
    gender: "male",
    bio: "Music producer. Outdoors when I can, obsessed with sound design when I cannot.",
    imageUrl: makeSvgPlaceholder("Michael-4"),
    isAI: true
  },
  {
    id: 5,
    name: "Olivia",
    age: 25,
    gender: "female",
    bio: "Travel blogger. Street food, local markets, and I will ask you too many questions.",
    imageUrl: makeSvgPlaceholder("Olivia-5"),
    isAI: true
  }
];
