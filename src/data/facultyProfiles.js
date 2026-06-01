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
  FIM: {
    label: 'FIM - Inginerie Mecanică, Autovehicule și Robotică',
    specializationsByLevel: {
      licenta: [
        'Tehnologia construcțiilor de maşini',
        'Inginerie mecanică',
        'Mecatronică',
        'Robotică',
        'Autovehicule rutiere'
      ],
      disertatie: [
        'Ingineria şi managementul calităţii, sănătăţii şi securităţii în muncă',
        'Expertiză tehnică, evaluare economică şi management',
        'Mecatronică aplicată',
        'Inginerie mecanică asistată de calculator'
      ]
    },
    skillTags: ['CAD', 'FEM', 'MATLAB', 'SolidWorks', 'Control automat', 'Robotica', 'Senzori', 'Modelare dinamica'],
    applicationDomains: ['Automotive', 'Prototipare', 'Sisteme mecatronice', 'Analiză structurală'],
    projectTypes: [
      'Prototip hardware / dispozitiv experimental',
      'Modelare și simulare (FEM/CFD)',
      'Analiză experimentală și validare'
    ],
    skillsHint: 'Selectează competențe tehnice relevante: CAD, modelare, control, programare embedded sau instrumentație.',
    additionalSkillsPlaceholder: 'Ex: SolidWorks, ANSYS, MATLAB/Simulink, Arduino/STM32, LabVIEW...',
    interestsPlaceholder: 'Ex: Dinamica vehiculelor, materiale compozite, control motoare electrice, automatizări...'
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
