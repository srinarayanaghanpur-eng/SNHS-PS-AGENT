export interface PosterCategoryField {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'date' | 'image' | 'multi-image' | 'boolean' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
}

export interface PosterCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  fields: PosterCategoryField[];
  assetRoles: string[];
  designFamilies: string[];
  defaultWidth: number;
  defaultHeight: number;
  recommendedCanvas: string;
}

export type PosterCategoryId =
  | 'daily-prayer' | 'admissions-open' | 'school-reopening' | 'holiday-notice'
  | 'birthday-wishes' | 'student-achievement' | 'award-congratulations' | 'exam-notice'
  | 'results-announcement' | 'fee-notice' | 'transport-notice' | 'teacher-recruitment'
  | 'staff-announcement' | 'festival-greetings' | 'national-day' | 'sports-event'
  | 'cultural-event' | 'parent-meeting' | 'educational-awareness' | 'health-camp'
  | 'competition' | 'educational-quote' | 'general-announcement' | 'social-media-promo'
  | 'custom';

export const CANVAS_OPTIONS = [
  { id: 'instagram-portrait', label: 'Instagram Portrait', width: 1080, height: 1350 },
  { id: 'instagram-square', label: 'Instagram Square', width: 1080, height: 1080 },
  { id: 'story', label: 'Story / Status', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape Display', width: 1920, height: 1080 },
  { id: 'a4-portrait', label: 'A4 Portrait', width: 2480, height: 3508 },
  { id: 'a4-landscape', label: 'A4 Landscape', width: 3508, height: 2480 },
  { id: 'custom', label: 'Custom Size', width: 0, height: 0 },
] as const;

export const POSTER_CATEGORIES: Record<PosterCategoryId, PosterCategory> = {
  'daily-prayer': {
    id: 'daily-prayer', name: 'Daily Prayer / Morning Assembly',
    description: 'Create a prayer proceedings poster with programme order, thought, and assembly photos.',
    icon: '🙏',
    fields: [
      { key: 'eventDate', label: 'Event date', kind: 'date', required: true },
      { key: 'day', label: 'Day', kind: 'text', required: false, placeholder: 'Auto-filled from date' },
      { key: 'prayerName', label: 'Prayer name', kind: 'text', required: false, placeholder: 'e.g. Morning Prayer' },
      { key: 'thought', label: 'Thought of the day', kind: 'textarea', required: false, placeholder: 'Enter the thought for the day' },
      { key: 'message', label: 'Main message', kind: 'textarea', required: false, placeholder: 'A meaningful message for the assembly' },
      { key: 'programmeItems', label: 'Programme items', kind: 'textarea', required: false, placeholder: 'One item per line:\nPrayer Song\nPledge\nThought of the Day' },
      { key: 'examInfo', label: 'Exam announcements', kind: 'textarea', required: false },
      { key: 'festivalInfo', label: 'Festival / special event', kind: 'textarea', required: false },
      { key: 'quote', label: 'Quote', kind: 'textarea', required: false },
      { key: 'prayerPhotos', label: 'Prayer / assembly photos', kind: 'multi-image', required: false },
      { key: 'birthdayPhotos', label: 'Birthday student photos', kind: 'multi-image', required: false },
      { key: 'achievementPhotos', label: 'Achievement photos', kind: 'multi-image', required: false },
    ],
    assetRoles: ['mainLogo', 'leadLogo', 'chairmanPhoto', 'principalPhoto', 'studentPhoto', 'assemblyPhoto', 'campusPhoto', 'defaultBackground'],
    designFamilies: ['fullBleedAssemblyEditorial', 'asymmetricStudentHero', 'editorialPhotoSplit', 'layeredPrayerCollage', 'premiumEmblematicAssembly', 'magazineProgrammeLayout'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'admissions-open': {
    id: 'admissions-open', name: 'Admissions Open',
    description: 'Announce admissions for the upcoming academic year with school features and contact details.',
    icon: '📚',
    fields: [
      { key: 'headline', label: 'Headline', kind: 'text', required: true, placeholder: 'e.g. Admissions Open 2026–27' },
      { key: 'academicYear', label: 'Academic year', kind: 'text', required: true, placeholder: 'e.g. 2026–27' },
      { key: 'schoolName', label: 'School name', kind: 'text', required: true },
      { key: 'classes', label: 'Classes offered', kind: 'textarea', required: false, placeholder: 'e.g. LKG to Class X' },
      { key: 'admissionDate', label: 'Admission start date', kind: 'date', required: false },
      { key: 'features', label: 'School features', kind: 'textarea', required: false, placeholder: 'One feature per line:\nSmart Classrooms\nSports Facilities\nTransport Available' },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: true },
      { key: 'website', label: 'Website', kind: 'text', required: false },
      { key: 'address', label: 'School address', kind: 'textarea', required: false },
      { key: 'callToAction', label: 'Call to action', kind: 'text', required: false, placeholder: 'e.g. Enrol Now! Limited Seats Available' },
      { key: 'campusPhotos', label: 'Campus photos', kind: 'multi-image', required: false },
      { key: 'studentPhotos', label: 'Student photos', kind: 'multi-image', required: false },
    ],
    assetRoles: ['mainLogo', 'leadLogo', 'campusPhoto', 'buildingPhoto', 'defaultBackground'],
    designFamilies: ['admissionsHero', 'studentCollage', 'premiumInstitutional', 'campusEditorial'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'school-reopening': {
    id: 'school-reopening', name: 'School Reopening',
    description: 'Announce the reopening of school after holidays.',
    icon: '🏫',
    fields: [
      { key: 'headline', label: 'Headline', kind: 'text', required: true, placeholder: 'e.g. School Reopening' },
      { key: 'reopeningDate', label: 'Reopening date', kind: 'date', required: true },
      { key: 'message', label: 'Welcome message', kind: 'textarea', required: false },
      { key: 'instructions', label: 'Instructions for students', kind: 'textarea', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'leadLogo', 'campusPhoto', 'defaultBackground'],
    designFamilies: ['formalNotice', 'celebrationAnnouncement', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'holiday-notice': {
    id: 'holiday-notice', name: 'Holiday Notice',
    description: 'Inform parents and students about upcoming holidays or closures.',
    icon: '🎉',
    fields: [
      { key: 'holidayName', label: 'Holiday name', kind: 'text', required: true, placeholder: 'e.g. Dussehra, Summer Vacation' },
      { key: 'holidayDate', label: 'Holiday date(s)', kind: 'text', required: true, placeholder: 'e.g. 15 Oct 2026' },
      { key: 'reason', label: 'Reason / occasion', kind: 'textarea', required: false },
      { key: 'reopeningDate', label: 'Reopening date', kind: 'date', required: true },
      { key: 'message', label: 'Short message', kind: 'textarea', required: false },
      { key: 'festivalImage', label: 'Festival image (optional)', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'festivalHoliday', 'calendarNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'birthday-wishes': {
    id: 'birthday-wishes', name: 'Birthday Wishes',
    description: 'Wish a happy birthday to students or teachers with their photo.',
    icon: '🎂',
    fields: [
      { key: 'subjectName', label: 'Student / teacher name', kind: 'text', required: true },
      { key: 'classDesignation', label: 'Class / designation', kind: 'text', required: false, placeholder: 'e.g. Class 8A or Maths Teacher' },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'birthdayMessage', label: 'Birthday message', kind: 'textarea', required: false, placeholder: 'Wishing you a wonderful day!' },
      { key: 'birthdayPhoto', label: 'Birthday photo', kind: 'image', required: true },
      { key: 'groupPhoto', label: 'Group photo (optional)', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'leadLogo', 'defaultBackground'],
    designFamilies: ['portraitCelebration', 'elegantBirthdayFrame', 'photoCollageBirthday', 'minimalPremiumBirthday'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'student-achievement': {
    id: 'student-achievement', name: 'Student Achievement',
    description: 'Celebrate student achievements, ranks, awards and accomplishments.',
    icon: '🏆',
    fields: [
      { key: 'studentName', label: 'Student name', kind: 'text', required: true },
      { key: 'className', label: 'Class', kind: 'text', required: false, placeholder: 'e.g. Class 9A' },
      { key: 'achievementTitle', label: 'Achievement title', kind: 'text', required: true, placeholder: 'e.g. First Place in Science Fair' },
      { key: 'rankScore', label: 'Rank / score / award', kind: 'text', required: false, placeholder: 'e.g. Gold Medal, 98%' },
      { key: 'eventName', label: 'Event name', kind: 'text', required: false, placeholder: 'e.g. District Science Fair 2026' },
      { key: 'achievementPhoto', label: 'Achievement photo', kind: 'image', required: true },
      { key: 'congratulationsMessage', label: 'Congratulations message', kind: 'textarea', required: false },
    ],
    assetRoles: ['mainLogo', 'leadLogo', 'chairmanPhoto', 'principalPhoto', 'defaultBackground'],
    designFamilies: ['goldAwardEditorial', 'studentSpotlight', 'trophyCelebration', 'rankAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'award-congratulations': {
    id: 'award-congratulations', name: 'Award / Congratulations',
    description: 'General award and congratulations announcements.',
    icon: '⭐',
    fields: [
      { key: 'recipientName', label: 'Recipient name', kind: 'text', required: true },
      { key: 'awardTitle', label: 'Award title', kind: 'text', required: true },
      { key: 'reason', label: 'Reason', kind: 'textarea', required: false },
      { key: 'date', label: 'Date', kind: 'date', required: false },
      { key: 'photo', label: 'Photo', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['goldAwardEditorial', 'rankAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'exam-notice': {
    id: 'exam-notice', name: 'Exam Notice',
    description: 'Announce examination schedules, instructions, and timetables.',
    icon: '📝',
    fields: [
      { key: 'examName', label: 'Exam name', kind: 'text', required: true, placeholder: 'e.g. Mid-Term Examinations 2026' },
      { key: 'classes', label: 'Classes', kind: 'text', required: false, placeholder: 'e.g. Class X, XII' },
      { key: 'startDate', label: 'Start date', kind: 'date', required: true },
      { key: 'endDate', label: 'End date', kind: 'date', required: false },
      { key: 'timings', label: 'Timings', kind: 'text', required: false, placeholder: 'e.g. 9:30 AM to 12:30 PM' },
      { key: 'instructions', label: 'Instructions', kind: 'textarea', required: false },
      { key: 'timetable', label: 'Timetable (optional)', kind: 'textarea', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'results-announcement': {
    id: 'results-announcement', name: 'Results Announcement',
    description: 'Announce exam results and student performance.',
    icon: '📊',
    fields: [
      { key: 'examName', label: 'Exam name', kind: 'text', required: true },
      { key: 'resultDate', label: 'Result date', kind: 'date', required: true },
      { key: 'toppers', label: 'Toppers / highlights', kind: 'textarea', required: false },
      { key: 'message', label: 'Message from school', kind: 'textarea', required: false },
      { key: 'website', label: 'Website for results', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['rankAnnouncement', 'formalNotice', 'celebrationAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'fee-notice': {
    id: 'fee-notice', name: 'Fee Notice',
    description: 'Fee due date reminders and payment instructions.',
    icon: '💰',
    fields: [
      { key: 'feeTitle', label: 'Fee title', kind: 'text', required: true, placeholder: 'e.g. Tuition Fee Due' },
      { key: 'dueDate', label: 'Due date', kind: 'date', required: true },
      { key: 'amount', label: 'Amount', kind: 'text', required: false },
      { key: 'paymentMethods', label: 'Payment methods', kind: 'textarea', required: false },
      { key: 'contactNumber', label: 'Contact for queries', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'transport-notice': {
    id: 'transport-notice', name: 'Transport Notice',
    description: 'Transport route changes, bus fee updates, and schedule notices.',
    icon: '🚌',
    fields: [
      { key: 'subject', label: 'Subject', kind: 'text', required: true },
      { key: 'details', label: 'Details', kind: 'textarea', required: true },
      { key: 'effectiveDate', label: 'Effective date', kind: 'date', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'busPhoto', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'teacher-recruitment': {
    id: 'teacher-recruitment', name: 'Teacher Recruitment',
    description: 'Announce teaching vacancies and hiring information.',
    icon: '👩‍🏫',
    fields: [
      { key: 'headline', label: 'Headline', kind: 'text', required: true, placeholder: 'e.g. Teacher Recruitment 2026' },
      { key: 'requiredSubjects', label: 'Required subjects', kind: 'textarea', required: true, placeholder: 'One per line:\nMathematics\nScience\nEnglish' },
      { key: 'classes', label: 'Classes to teach', kind: 'text', required: false },
      { key: 'qualification', label: 'Required qualification', kind: 'textarea', required: true },
      { key: 'experience', label: 'Experience required', kind: 'text', required: false, placeholder: 'e.g. 2+ years' },
      { key: 'salaryInfo', label: 'Salary / compensation', kind: 'text', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: true },
      { key: 'email', label: 'Email', kind: 'text', required: false },
      { key: 'interviewDate', label: 'Interview date', kind: 'date', required: false },
      { key: 'campusPhoto', label: 'Campus photo', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'campusPhoto', 'buildingPhoto', 'defaultBackground'],
    designFamilies: ['professionalHiring', 'subjectVacancyGrid', 'campusRecruitment', 'teacherHero'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'staff-announcement': {
    id: 'staff-announcement', name: 'Staff Announcement',
    description: 'Staff promotions, new joiners, and internal announcements.',
    icon: '📢',
    fields: [
      { key: 'announcementTitle', label: 'Announcement title', kind: 'text', required: true },
      { key: 'staffName', label: 'Staff name', kind: 'text', required: false },
      { key: 'newRole', label: 'New role / designation', kind: 'text', required: false },
      { key: 'details', label: 'Details', kind: 'textarea', required: true },
      { key: 'date', label: 'Date', kind: 'date', required: false },
      { key: 'photo', label: 'Photo (optional)', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'festival-greetings': {
    id: 'festival-greetings', name: 'Festival Greetings',
    description: 'Send festive greetings to the school community.',
    icon: '🎊',
    fields: [
      { key: 'festivalName', label: 'Festival name', kind: 'text', required: true },
      { key: 'greetingMessage', label: 'Greeting message', kind: 'textarea', required: true },
      { key: 'festivalDate', label: 'Date', kind: 'date', required: false },
      { key: 'festivalImage', label: 'Festival image', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['culturalGreeting', 'traditionalDecorative', 'schoolBrandedFestival', 'photoBasedCelebration'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'national-day': {
    id: 'national-day', name: 'National Day',
    description: 'Celebrate national days like Independence Day, Republic Day.',
    icon: '🇮🇳',
    fields: [
      { key: 'dayName', label: 'Celebration name', kind: 'text', required: true, placeholder: 'e.g. Independence Day 2026' },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'message', label: 'Message', kind: 'textarea', required: true },
      { key: 'eventDetails', label: 'Event details', kind: 'textarea', required: false },
      { key: 'photo', label: 'Celebration photo', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['culturalGreeting', 'celebrationAnnouncement', 'traditionalDecorative'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'sports-event': {
    id: 'sports-event', name: 'Sports Event',
    description: 'Promote sports events, tournaments, and athletic achievements.',
    icon: '⚽',
    fields: [
      { key: 'eventName', label: 'Event name', kind: 'text', required: true, placeholder: 'e.g. Annual Sports Day 2026' },
      { key: 'date', label: 'Date(s)', kind: 'text', required: true },
      { key: 'venue', label: 'Venue', kind: 'text', required: false },
      { key: 'categories', label: 'Event categories', kind: 'textarea', required: false, placeholder: 'e.g. 100m Race\nLong Jump\nRelay' },
      { key: 'message', label: 'Message', kind: 'textarea', required: false },
      { key: 'actionPhotos', label: 'Action photos', kind: 'multi-image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['dynamicAction', 'tournamentFixture', 'winnerCelebration', 'teamCollage'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'cultural-event': {
    id: 'cultural-event', name: 'Cultural Event',
    description: 'Promote cultural events, performances, and celebrations.',
    icon: '🎭',
    fields: [
      { key: 'eventName', label: 'Event name', kind: 'text', required: true },
      { key: 'date', label: 'Date', kind: 'text', required: true },
      { key: 'venue', label: 'Venue', kind: 'text', required: false },
      { key: 'highlights', label: 'Event highlights', kind: 'textarea', required: false },
      { key: 'chiefGuest', label: 'Chief guest', kind: 'text', required: false },
      { key: 'photos', label: 'Event photos', kind: 'multi-image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['culturalGreeting', 'celebrationAnnouncement', 'photoBasedCelebration'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'parent-meeting': {
    id: 'parent-meeting', name: 'Parent Meeting',
    description: 'Announce parent-teacher meetings and school events for parents.',
    icon: '👪',
    fields: [
      { key: 'meetingTitle', label: 'Meeting title', kind: 'text', required: true, placeholder: 'e.g. Parent-Teacher Meeting' },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'time', label: 'Time', kind: 'text', required: true, placeholder: 'e.g. 10:00 AM' },
      { key: 'venue', label: 'Venue', kind: 'text', required: false },
      { key: 'agenda', label: 'Agenda', kind: 'textarea', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'educational-awareness': {
    id: 'educational-awareness', name: 'Educational Awareness Day',
    description: 'Awareness campaigns on educational topics and social issues.',
    icon: '💡',
    fields: [
      { key: 'topic', label: 'Topic', kind: 'text', required: true },
      { key: 'date', label: 'Date', kind: 'date', required: false },
      { key: 'message', label: 'Awareness message', kind: 'textarea', required: true },
      { key: 'tips', label: 'Key points / tips', kind: 'textarea', required: false },
      { key: 'photo', label: 'Photo', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'celebrationAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'health-camp': {
    id: 'health-camp', name: 'Health Camp / Medical Notice',
    description: 'Announce health checkup camps, medical events, and vaccination drives.',
    icon: '🏥',
    fields: [
      { key: 'campName', label: 'Camp name', kind: 'text', required: true, placeholder: 'e.g. Free Health Checkup Camp' },
      { key: 'date', label: 'Date', kind: 'date', required: true },
      { key: 'time', label: 'Time', kind: 'text', required: false },
      { key: 'venue', label: 'Venue', kind: 'text', required: false },
      { key: 'services', label: 'Services offered', kind: 'textarea', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'competition': {
    id: 'competition', name: 'Competition',
    description: 'Announce competitions, contests, and events for students.',
    icon: '🎯',
    fields: [
      { key: 'competitionName', label: 'Competition name', kind: 'text', required: true },
      { key: 'date', label: 'Date', kind: 'text', required: true },
      { key: 'lastDate', label: 'Last date to register', kind: 'date', required: false },
      { key: 'eligibility', label: 'Eligibility', kind: 'text', required: false },
      { key: 'prizes', label: 'Prizes', kind: 'textarea', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'celebrationAnnouncement', 'dynamicAction'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'educational-quote': {
    id: 'educational-quote', name: 'Educational Quote',
    description: 'Inspirational quotes and educational messages for students.',
    icon: '💬',
    fields: [
      { key: 'quote', label: 'Quote', kind: 'textarea', required: true },
      { key: 'author', label: 'Author', kind: 'text', required: false, placeholder: 'e.g. Dr. APJ Abdul Kalam' },
      { key: 'theme', label: 'Theme', kind: 'text', required: false, placeholder: 'e.g. Perseverance, Knowledge' },
      { key: 'backgroundPhoto', label: 'Background photo', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['minimalPremiumBirthday', 'elegantBirthdayFrame'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-square',
  },
  'general-announcement': {
    id: 'general-announcement', name: 'General School Announcement',
    description: 'General notices and announcements for the school community.',
    icon: '📋',
    fields: [
      { key: 'subject', label: 'Subject', kind: 'text', required: true },
      { key: 'body', label: 'Announcement body', kind: 'textarea', required: true },
      { key: 'date', label: 'Date', kind: 'date', required: false },
      { key: 'contactNumber', label: 'Contact number', kind: 'text', required: false },
      { key: 'attachments', label: 'Photos (optional)', kind: 'multi-image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['formalNotice', 'minimalAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
  'social-media-promo': {
    id: 'social-media-promo', name: 'Social Media Promotion',
    description: 'Create promotional content for social media platforms.',
    icon: '📱',
    fields: [
      { key: 'promoTitle', label: 'Title', kind: 'text', required: true },
      { key: 'message', label: 'Promotional message', kind: 'textarea', required: true },
      { key: 'callToAction', label: 'Call to action', kind: 'text', required: false, placeholder: 'e.g. Share & Spread the Word!' },
      { key: 'hashtags', label: 'Hashtags', kind: 'text', required: false, placeholder: 'e.g. #Education #SchoolLife' },
      { key: 'photo', label: 'Photo', kind: 'image', required: false },
    ],
    assetRoles: ['mainLogo', 'defaultBackground'],
    designFamilies: ['photoCollageBirthday', 'celebrationAnnouncement'],
    defaultWidth: 1080, defaultHeight: 1080, recommendedCanvas: 'instagram-square',
  },
  'custom': {
    id: 'custom', name: 'Custom Poster',
    description: 'Define your own poster with custom text, photos, and layout.',
    icon: '✨',
    fields: [
      { key: 'posterTitle', label: 'Poster title', kind: 'text', required: true, placeholder: 'Enter the poster title' },
      { key: 'subtitle', label: 'Subtitle', kind: 'text', required: false },
      { key: 'bodyContent', label: 'Body content', kind: 'textarea', required: false },
      { key: 'date', label: 'Date', kind: 'date', required: false },
      { key: 'contactDetails', label: 'Contact details', kind: 'text', required: false },
      { key: 'callToAction', label: 'Call to action', kind: 'text', required: false },
      { key: 'userDescription', label: 'Describe the poster you need', kind: 'textarea', required: false, placeholder: 'Describe the poster you need. The system will infer the category and design.\n\nExample: "Create a poster informing parents that the school will remain closed tomorrow due to heavy rain and will reopen on Wednesday."' },
      { key: 'photos', label: 'Photos', kind: 'multi-image', required: false },
    ],
    assetRoles: ['mainLogo', 'leadLogo', 'chairmanPhoto', 'principalPhoto', 'defaultBackground', 'campusPhoto'],
    designFamilies: ['minimalAnnouncement', 'celebrationAnnouncement', 'formalNotice'],
    defaultWidth: 1080, defaultHeight: 1350, recommendedCanvas: 'instagram-portrait',
  },
};

export const POPULAR_CATEGORIES: PosterCategoryId[] = [
  'admissions-open', 'daily-prayer', 'birthday-wishes', 'student-achievement',
  'holiday-notice', 'teacher-recruitment', 'custom',
];

export function getCategory(id: string): PosterCategory | undefined {
  return POSTER_CATEGORIES[id as PosterCategoryId];
}

export function inferCategoryFromDescription(description: string): { categoryId: PosterCategoryId; reasoning: string } {
  const lower = description.toLowerCase();
  if (/\b(admission|enrol|enroll|registration)\b/.test(lower)) return { categoryId: 'admissions-open', reasoning: 'Admissions-related content detected' };
  if (/\b(holiday|vacation|closed|remain closed|off|break|reopen)\b/.test(lower)) return { categoryId: 'holiday-notice', reasoning: 'Holiday or closure notice detected' };
  if (/\b(birthday|happy birthday|birth|wish)\b/.test(lower)) return { categoryId: 'birthday-wishes', reasoning: 'Birthday wishes detected' };
  if (/\b(achievement|award|rank|prize|won|first|gold|medal|topper)\b/.test(lower)) return { categoryId: 'student-achievement', reasoning: 'Achievement or award content detected' };
  if (/\b(exam|examination|test|assessment|final)\b/.test(lower)) return { categoryId: 'exam-notice', reasoning: 'Examination-related content detected' };
  if (/\b(result|score|percentage|passed)\b/.test(lower)) return { categoryId: 'results-announcement', reasoning: 'Results announcement detected' };
  if (/\b(fee|payment|due|pay|amount)\b/.test(lower)) return { categoryId: 'fee-notice', reasoning: 'Fee notice detected' };
  if (/\b(transport|bus|route|pickup|drop|vehicle)\b/.test(lower)) return { categoryId: 'transport-notice', reasoning: 'Transport-related notice detected' };
  if (/\b(recruit|hiring|job|vacancy|teacher|staff|position|apply)\b/.test(lower)) return { categoryId: 'teacher-recruitment', reasoning: 'Recruitment or hiring notice detected' };
  if (/\b(festival|diwali|holi|dussehra|eid|christmas|pongal|sankranti|festive)\b/.test(lower)) return { categoryId: 'festival-greetings', reasoning: 'Festival greetings detected' };
  if (/\b(independence|republic|national|patriotic|flag)\b/.test(lower)) return { categoryId: 'national-day', reasoning: 'National day celebration detected' };
  if (/\b(sports|sport|game|tournament|match|athletic|race)\b/.test(lower)) return { categoryId: 'sports-event', reasoning: 'Sports event detected' };
  if (/\b(cultural|dance|music|sing|performance|stage|drama|concert)\b/.test(lower)) return { categoryId: 'cultural-event', reasoning: 'Cultural event detected' };
  if (/\b(parent|meeting|ptm)\b/.test(lower)) return { categoryId: 'parent-meeting', reasoning: 'Parent meeting detected' };
  if (/\b(reopen|reopening|school start|back to school)\b/.test(lower)) return { categoryId: 'school-reopening', reasoning: 'School reopening detected' };
  if (/\b(health|medical|camp|checkup|vaccin|doctor)\b/.test(lower)) return { categoryId: 'health-camp', reasoning: 'Health camp detected' };
  if (/\b(competition|contest|quiz|compete)\b/.test(lower)) return { categoryId: 'competition', reasoning: 'Competition detected' };
  if (/\b(quote|inspire|motivat)\b/.test(lower)) return { categoryId: 'educational-quote', reasoning: 'Educational quote detected' };
  if (/\b(prayer|assembly|morning|programme)\b/.test(lower)) return { categoryId: 'daily-prayer', reasoning: 'Prayer assembly content detected' };
  return { categoryId: 'general-announcement', reasoning: 'General announcement content inferred' };
}
