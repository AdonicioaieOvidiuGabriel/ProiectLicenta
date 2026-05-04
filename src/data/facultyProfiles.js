export const FACULTY_PROFILES = {
  FIESC: {
    label: 'FIESC - Inginerie Electrică și Știința Calculatoarelor',
    specializationsByLevel: {
      licenta: [
        'Calculatoare',
        'Automatică și Informatică Aplicată',
        'Rețele și Software de Telecomunicații',
        'Sisteme Electrice',
        'Energetică și Tehnologii Informatice',
        'Echipamente și Sisteme Medicale',
        'Echipamente și Sisteme de Comandă și Control pentru Autovehicule',
        'Managementul Energiei'
      ],
      disertatie: [
        'Știința și Ingineria Calculatoarelor',
        'Rețele de Comunicații și Calculatoare',
        'Securitate Cibernetică',
        'Sisteme Moderne pentru Conducerea Proceselor Energetice',
        'Tehnici Avansate în Mașini și Acționări Electrice'
      ]
    },
    skillTags: ['Python', 'C++', 'Java', 'React', 'Machine Learning', 'IoT', 'Embedded Systems', 'Baze de date'],
    applicationDomains: ['IT & Software', 'Automotive', 'Smart City/IoT', 'Medical', 'Divertisment/Jocuri'],
    projectTypes: [
      'Aplicație practică (Software/Web/Mobile)',
      'Prototip Hardware / Embedded',
      'Cercetare, analiză de date și studiu teoretic'
    ],
    skillsHint: 'Selectează competențe tehnice relevante: limbaje, framework-uri, platforme hardware sau metodologii de dezvoltare.',
    additionalSkillsPlaceholder: 'Ex: Docker, Linux, MATLAB, OpenCV, ROS, Arduino...',
    interestsPlaceholder: 'Ex: Sisteme inteligente, aplicații cloud, optimizare energetică, viziune artificială...'
  },
  FEAA: {
    label: 'FEAA - Economie, Administrație și Afaceri',
    specializations: ['Management', 'Contabilitate', 'Finanțe', 'Economia Comerțului și Turismului'],
    skillTags: ['Analiză financiară', 'Excel avansat', 'Contabilitate', 'Management proiecte', 'SPSS', 'Power BI', 'Statistică', 'Planificare strategică'],
    applicationDomains: ['Finanțe/Afaceri', 'Educație', 'Juridic/Administrativ', 'Medical'],
    projectTypes: [
      'Studiu de caz aplicat (firmă/instituție)',
      'Analiză de date și prognoză economică',
      'Cercetare teoretică și modelare economică'
    ],
    skillsHint: 'Selectează competențe economice, financiare și analitice relevante pentru tema lucrării.',
    additionalSkillsPlaceholder: 'Ex: Audit intern, fiscalitate, ERP, bugetare, control de gestiune...',
    interestsPlaceholder: 'Ex: Performanță financiară, antreprenoriat, politici publice, turism și comerț...'
  },
  FDSA: {
    label: 'FDSA - Drept și Științe Administrative',
    specializations: ['Drept', 'Administrație Publică', 'Poliție Locală'],
    skillTags: ['Drept civil', 'Drept penal', 'Drept administrativ', 'Legislație UE', 'Argumentare juridică', 'Analiză jurisprudență', 'Redactare acte', 'Etică profesională'],
    applicationDomains: ['Juridic/Administrativ', 'Educație', 'Finanțe/Afaceri'],
    projectTypes: [
      'Analiză legislativă aplicată',
      'Studiu de caz juridic/administrativ',
      'Cercetare doctrinară și comparativă'
    ],
    skillsHint: 'Selectează competențe juridice și administrative relevante pentru domeniul de interes.',
    additionalSkillsPlaceholder: 'Ex: Mediere, procedură contravențională, achiziții publice, contencios administrativ...',
    interestsPlaceholder: 'Ex: Drepturile omului, administrație locală, digitalizarea serviciilor publice...'
  },
  FLSC: {
    label: 'FLSC - Litere și Știinte ale Comunicării',
    specializations: ['Media Digitală', 'Comunicare și Relații Publice', 'Limba Română/Engleză'],
    specializationsByLevel: {
      licenta: ['Media Digitală', 'Comunicare și Relații Publice', 'Limba Română/Engleză'],
      disertatie: [
        'Literatura Română în Context European',
        'Limbă și Comunicare',
        'Comunicare, Media și Industriile Creative',
        'Teoria și Practica Traducerii',
        'Cultură și Civilizație Britanică'
      ]
    },
    skillTags: ['Redactare', 'Storytelling', 'Media digitală', 'PR', 'Copywriting', 'Analiză discurs', 'Traducere', 'Comunicare vizuală'],
    applicationDomains: ['Educație', 'Divertisment/Jocuri', 'IT & Software', 'Juridic/Administrativ'],
    projectTypes: [
      'Produs media / campanie de comunicare',
      'Analiză de conținut și impact',
      'Cercetare teoretică interdisciplinară'
    ],
    skillsHint: 'Selectează competențe din comunicare, media, limbaj și analiză de conținut.',
    additionalSkillsPlaceholder: 'Ex: SEO, editare video, management social media, design editorial...',
    interestsPlaceholder: 'Ex: Comunicare instituțională, jurnalism digital, cultură media, limbaj și identitate...'
  }
};

export const FACULTY_LABELS = Object.fromEntries(
  Object.entries(FACULTY_PROFILES).map(([key, profile]) => [key, profile.label])
);
