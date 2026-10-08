import {
  Briefcase, FileText, PenLine, Mail, GraduationCap,
  Presentation, BookOpen, Newspaper, type LucideIcon,
} from 'lucide-react';

export interface CoAuthorTemplate {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  purpose: 'Writing' | 'Research';
  systemRole: string;
  guidingQuestions: string[];
  suggestedOutline: string[];
  starterPrompt: string;
}

export const CO_AUTHOR_TEMPLATES: CoAuthorTemplate[] = [
  {
    id: 'resume',
    label: 'Resume',
    description: 'Polish your resume with AI positioning feedback',
    icon: Briefcase,
    purpose: 'Writing',
    systemRole: 'You are a career coach and resume writer. Help the user craft bullet points that show impact with the XYZ formula: Accomplished [X] as measured by [Y], by doing [Z]. Push them to quantify results and use strong action verbs. Never fabricate experiences.',
    guidingQuestions: [
      'What role are you targeting?',
      'What is your most impressive quantifiable achievement?',
      'Are there bullet points you want to strengthen?',
    ],
    suggestedOutline: ['Professional Summary', 'Core Achievements', 'Skills & Tools', 'Experience Bullet Points'],
    starterPrompt: 'I need help with my resume',
  },
  {
    id: 'cover_letter',
    label: 'Cover Letter',
    description: 'Write a tailored cover letter that stands out',
    icon: Mail,
    purpose: 'Writing',
    systemRole: 'You are a career coach helping write a cover letter. Keep it to 3-4 paragraphs: a strong opening hook, a body paragraph connecting the user\'s experience to the role, a second body with specific evidence, and a confident close. Avoid clichés and generic language. Push for specificity.',
    guidingQuestions: [
      'What company and role is this for?',
      'What is one specific reason you\'re excited about this company?',
      'What experience do you have that directly maps to the job requirements?',
    ],
    suggestedOutline: ['Opening Hook', 'Why This Company', 'Your Relevant Experience', 'Confident Close'],
    starterPrompt: 'I need to write a cover letter',
  },
  {
    id: 'blog_post',
    label: 'Blog Post',
    description: 'Structure and draft an engaging blog post',
    icon: Newspaper,
    purpose: 'Writing',
    systemRole: 'You are a content editor and writing partner. Help craft a blog post with a strong hook, clear subheadings, and engaging prose. Focus on readability, SEO-friendly structure, and a compelling narrative thread. Suggest improvements to flow and clarity.',
    guidingQuestions: [
      'Who is your target audience?',
      'What is the main takeaway you want readers to leave with?',
      'What is your unique angle or perspective?',
    ],
    suggestedOutline: ['Compelling Hook', 'Introduction & Context', 'Main Points (2-3 sections)', 'Conclusion & CTA'],
    starterPrompt: 'I want to write a blog post',
  },
  {
    id: 'journal',
    label: 'Journal Entry',
    description: 'Reflect and process your thoughts with guided prompts',
    icon: BookOpen,
    purpose: 'Writing',
    systemRole: 'You are a reflective journaling companion. Ask probing questions that help the user go deeper. Don\'t write their journal for them — instead, listen, reflect back what you hear, and ask one follow-up question at a time. Help them find patterns and insights.',
    guidingQuestions: [
      'What happened today that\'s on your mind?',
      'How are you feeling about it right now?',
      'Is there something underneath the surface?',
    ],
    suggestedOutline: ['What Happened', 'How I Feel About It', 'What I\'m Learning', 'What I Want to Do Differently'],
    starterPrompt: 'I want to journal about my day',
  },
  {
    id: 'creative_writing',
    label: 'Creative Writing',
    description: 'Co-write fiction, stories, or narrative experiments',
    icon: PenLine,
    purpose: 'Writing',
    systemRole: 'You are a creative writing partner. Help develop characters, advance plot, and craft vivid prose. Offer alternatives when the user seems stuck. Stay in the story\'s world and voice. Don\'t be afraid to suggest bold narrative choices.',
    guidingQuestions: [
      'What genre and tone are you going for?',
      'Who is your main character and what do they want?',
      'Where does the story start — what\'s the inciting incident?',
    ],
    suggestedOutline: ['Opening Scene', 'Character Introduction', 'Rising Action', 'Climax & Resolution'],
    starterPrompt: 'I want to write a story',
  },
  {
    id: 'important_email',
    label: 'Important Email',
    description: 'Get the tone right for difficult or high-stakes emails',
    icon: Mail,
    purpose: 'Writing',
    systemRole: 'You are a communication coach. Help the user write an email that achieves their goal while maintaining the right tone. Whether it\'s a resignation, apology, negotiation, or difficult conversation — help them be clear, respectful, and effective. Offer alternative phrasings when tone is tricky.',
    guidingQuestions: [
      'What type of email is this? (resignation, apology, negotiation, etc.)',
      'What outcome do you want from this email?',
      'What tone do you want to strike — firm, warm, professional, conciliatory?',
    ],
    suggestedOutline: ['Subject Line Options', 'Opening', 'Core Message', 'Clear Ask / Next Steps'],
    starterPrompt: 'I need to write an important email',
  },
  {
    id: 'college_essay',
    label: 'College Essay',
    description: 'Find your angle and craft a memorable personal essay',
    icon: GraduationCap,
    purpose: 'Writing',
    systemRole: 'You are a college essay coach. Help the user find their unique angle — the specific, personal story only they can tell. Never write the essay for them. Ask questions that draw out meaningful details. Push for showing over telling, and for specificity over generality.',
    guidingQuestions: [
      'What prompt are you responding to?',
      'What is a specific moment or story that reveals something about who you are?',
      'What do you want the admissions officer to understand about you?',
    ],
    suggestedOutline: ['Finding Your Story', 'Opening Scene', 'The Turn / Insight', 'Reflection & Close'],
    starterPrompt: 'I need help with my college essay',
  },
  {
    id: 'presentation',
    label: 'Presentation',
    description: 'Outline, script, and refine a talk or presentation',
    icon: Presentation,
    purpose: 'Writing',
    systemRole: 'You are a presentation coach. Help the user structure a compelling talk with a clear arc. Focus on the opening hook, key messages, supporting evidence, and a memorable close. Keep slides concise — push for one idea per section.',
    guidingQuestions: [
      'What is the topic and how long is the talk?',
      'Who is the audience and what do you want them to do after?',
      'What is your single most important message?',
    ],
    suggestedOutline: ['Opening Hook', 'Key Message', 'Supporting Points', 'Memorable Close'],
    starterPrompt: 'I need to prepare a presentation',
  },
];

export function getTemplateById(id: string | null | undefined): CoAuthorTemplate | null {
  if (!id) return null;
  return CO_AUTHOR_TEMPLATES.find(t => t.id === id) ?? null;
}
