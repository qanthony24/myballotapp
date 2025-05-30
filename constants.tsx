// Note: This file, when loaded by the browser via importmap, will be parsed as JavaScript.
// Type imports have been removed to prevent issues if './types.ts' is fetched and parsed by a JS engine.

// Moved from types.ts
export const ViewMode = {
  GRID: 'grid',
  LIST: 'list',
};

export const POLITICAL_KEY_ISSUES_LIST = [
  { id: 'economy', label: 'Economy & Jobs' },
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'education', label: 'Education' },
  { id: 'environment', label: 'Environment & Climate Change' },
  { id: 'social_justice', label: 'Social Justice & Equality' },
  { id: 'public_safety', label: 'Public Safety & Crime' },
  { id: 'infrastructure', label: 'Infrastructure' },
  { id: 'taxation', label: 'Taxation & Government Spending' },
  { id: 'foreign_policy', label: 'Foreign Policy & National Security' },
  { id: 'immigration', label: 'Immigration' },
];

export const CIVIC_INFO_SOURCES_LIST = [
    { id: 'news_websites', label: 'News Websites/Apps' },
    { id: 'social_media', label: 'Social Media' },
    { id: 'friends_family', label: 'Friends & Family' },
    { id: 'official_voter_guides', label: 'Official Voter Guides/Mailers' },
    { id: 'candidate_websites', label: 'Candidate Websites/Materials' },
    { id: 'tv_news', label: 'Television News' },
    { id: 'radio_podcasts', label: 'Radio/Podcasts' },
    { id: 'this_app', label: 'This App (MyBallot)' },
    { id: 'other', label: 'Other' },
];


// Utility to format election date string into a user-friendly name
export const formatElectionName = (electionDate, baseName) => {
  try {
    const date = new Date(electionDate + 'T00:00:00'); // Ensure local timezone interpretation
    const namePart = baseName ? baseName.split(' ')[1] : "Election"; // e.g. General from "2026 General"
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${namePart}`;
  } catch (e) {
    console.error("Error formatting election date:", electionDate, e);
    return baseName || electionDate; // Fallback
  }
};

// Pre-define parts of RAW_DATA to avoid initialization errors
const PREDEFINED_OFFICES_DATA = [
    { "id": 1, "name": "Mayor-President", "slug": "mayor-president" },
    { "id": 2, "name": "State Representative", "slug": "state-representative" }, // Districted
    { "id": 3, "name": "City Court Judge", "slug": "city-court-judge" },
    { "id": 4, "name": "Metro Council", "slug": "metro-council" }, // Districted
    { "id": 5, "name": "US President", "slug": "us-president" },
    // ID 6 (US Vice President) is removed.
    { "id": 7, "name": "US Senator", "slug": "us-senator" },
    { "id": 8, "name": "US Representative", "slug": "us-representative" }, // Districted
    { "id": 9, "name": "Governor", "slug": "governor" },
    { "id": 10, "name": "Lieutenant Governor", "slug": "lieutenant-governor" },
    { "id": 11, "name": "Attorney General", "slug": "attorney-general" },
    { "id": 12, "name": "Secretary of State", "slug": "secretary-of-state" },
    { "id": 13, "name": "State Treasurer", "slug": "state-treasurer" },
    { "id": 14, "name": "School Board Member", "slug": "school-board-member" }, // Districted
    { "id": 15, "name": "Parish Sheriff", "slug": "parish-sheriff" }
];

// Define Cycle Types for more realistic candidate assignment
const CycleType = {
  PRESIDENTIAL: "PRESIDENTIAL_CYCLE",
  MIDTERM_FEDERAL: "MIDTERM_FEDERAL_CYCLE", // For US Senator, US Rep in non-presidential federal years
  STATE_GENERAL: "STATE_GENERAL_CYCLE",   // For Governor, State Rep etc. in general election years
  MUNICIPAL_LOCAL: "MUNICIPAL_LOCAL_CYCLE", // For Mayor, Council, Sheriff etc.
  SPECIAL: "SPECIAL_CYCLE",
  PRIMARY: "PRIMARY_CYCLE"        // Can be for any, often presidential primaries are significant
};

const PREDEFINED_CYCLES_DATA_RAW = [
    { "id": 1, "name": "2026 General", "slug": "2026-general", "electionDate": "2026-11-06", "evStart": "2026-10-23", "evEnd": "2026-11-01", "type": [CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 2, "name": "2025 Municipal", "slug": "2025-municipal", "electionDate": "2025-11-05", "evStart": "2025-10-20", "evEnd": "2025-11-03", "type": [CycleType.MUNICIPAL_LOCAL] },
    { "id": 3, "name": "2024 Presidential Primary", "slug": "2024-primary", "electionDate": "2024-03-05", "evStart": "2024-02-15", "evEnd": "2024-03-01", "type": [CycleType.PRIMARY, CycleType.PRESIDENTIAL] }, // Past
    { "id": 4, "name": "2028 Presidential General", "slug": "2028-presidential-general", "electionDate": "2028-11-07", "evStart": "2028-10-24", "evEnd": "2028-11-02", "type": [CycleType.PRESIDENTIAL, CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] },
    { "id": 5, "name": "2027 Special Election", "slug": "2027-special-election", "electionDate": "2027-05-04", "evStart": "2027-04-20", "evEnd": "2027-04-29", "type": [CycleType.SPECIAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL] }, // Louisiana has odd-year state elections
    { "id": 6, "name": "2022 Midterm Election", "slug": "2022-midterm-election", "electionDate": "2022-11-08", "evStart": "2022-10-25", "evEnd": "2022-11-03", "type": [CycleType.MIDTERM_FEDERAL, CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL], "nameOverride": "2022 Midterm" }, // Past
    { "id": 7, "name": "2023 State General", "slug": "2023-state-general", "electionDate": "2023-10-14", "evStart": "2023-09-30", "evEnd": "2023-10-09", "type": [CycleType.STATE_GENERAL, CycleType.MUNICIPAL_LOCAL], "nameOverride": "2023 State" } // Past, LA specific
];


const PREDEFINED_SURVEY_QUESTIONS_DATA = [
    { "key": "why_running", "question": "Why are you running?" },
    { "key": "top_priority", "question": "What is your top priority if elected?" },
    { "key": "experience", "question": "What experience qualifies you for this office?" },
    { "key": "fiscal_approach", "question": "What is your approach to fiscal responsibility and budget management?" }
];

const RAW_DATA = {
  "offices": PREDEFINED_OFFICES_DATA,
  "cycles": PREDEFINED_CYCLES_DATA_RAW,
  "surveyQuestions": PREDEFINED_SURVEY_QUESTIONS_DATA,
  "candidates": [
    // Existing 11 candidates - review and update cycleId and add runningMateName for president
    {
      "id": 1, "firstName": "John", "lastName": "Smith", "slug": "john-smith", "photoUrl": "https://picsum.photos/seed/johnsmith/200/200", "party": "Democratic", "officeId": 1, "cycleId": 2, /* Mayor in Municipal */ "website": "https://johnsmithforbr.com", "email": "john@smithcampaign.org", "phone": "225-555-0101", "socialLinks": { "facebook": "https://facebook.com/jsmith", "twitter": "https://twitter.com/jsmith", "instagram": "" }, "bio": "John Smith has served 8 years on the City Council and is running to bring transparency to local government.", "mailingAddress": "123 Government St.\nBaton Rouge, LA 70801", "surveyResponses": { "why_running": "I want to ensure every voice is heard in City Hall.", "top_priority": "Balancing the city budget without cutting essential services.", "experience": "Two terms as Councilman, former finance committee chair.", "fiscal_approach": "A balanced budget is paramount. I advocate for regular audits and transparent spending." }, "ballotOrder": 1, "isIncumbent": true
    },
    {
      "id": 2, "firstName": "Jane", "lastName": "Doe", "slug": "jane-doe", "photoUrl": "https://picsum.photos/seed/janedoe/200/200", "party": "Republican", "officeId": 2, "district": "District 61", "cycleId": 1, /* State Rep in General */ "website": "", "email": "jane@doeforstate.com", "phone": "225-555-0202", "socialLinks": { "facebook": "https://facebook.com/janedoe", "twitter": "", "instagram": "https://instagram.com/janedoe" }, "bio": "A lifelong educator, Jane Doe has spent 15 years improving public schools in EBR Parish.", "mailingAddress": "PO Box 456\nBaton Rouge, LA 70802", "surveyResponses": { "why_running": "To put education and families first in the legislature.", "top_priority": "Increase teacher pay and reduce classroom sizes.", "experience": "School board president, curriculum developer.", "fiscal_approach": "Investments in education are investments in our future; I'll seek efficiency elsewhere." }, "ballotOrder": 1, "isIncumbent": false
    },
    { // Example Presidential Candidate
      "id": 116, "firstName": "Eleanor", "lastName": "Vance", "slug": "eleanor-vance", "photoUrl": "https://picsum.photos/seed/eleanorvance/200/200", "party": "Democratic", "officeId": 5, "runningMateName": "Marcus Cole", "cycleId": 4, /* President in Presidential General */ "website": "https://vancecole.com", "email": "info@vancecole.com", "bio": "Eleanor Vance is a former governor with a focus on national unity and economic reform.", "surveyResponses": { "why_running": "To lead the nation towards a brighter, more inclusive future.", "top_priority": "Strengthening the economy and ensuring healthcare for all.", "experience": "Two terms as Governor, former U.S. Senator.", "fiscal_approach": "Invest in growth while maintaining fiscal discipline through targeted spending and fair taxation." }, "ballotOrder": 1
    },
    { // Another Example Presidential Candidate
      "id": 117, "firstName": "Arthur", "lastName": "Pendleton", "slug": "arthur-pendleton", "photoUrl": "https://picsum.photos/seed/arthurpendleton/200/200", "party": "Republican", "officeId": 5, "runningMateName": "Sofia Reyes", "cycleId": 4, /* President in Presidential General */ "website": "https://pendletonreyes.com", "email": "contact@pendletonreyes.com", "bio": "Arthur Pendleton is a businessman and innovator aiming to bring a new perspective to Washington.", "surveyResponses": { "why_running": "To restore strong leadership and promote American enterprise.", "top_priority": "Reducing government regulation and fostering job creation.", "experience": "CEO of a major tech company, philanthropist.", "fiscal_approach": "Cut wasteful spending, lower taxes to stimulate economic activity, and balance the budget." }, "ballotOrder": 2
    },
    { // Example Presidential Candidate for Primary
      "id": 118, "firstName": "Primary", "lastName": "Prez", "slug": "primary-prez", "photoUrl": "https://picsum.photos/seed/primaryprez/200/200", "party": "Independent", "officeId": 5, "runningMateName": "Primary VP", "cycleId": 3, /* President in Presidential Primary */ "website": "https://primaryprez.com", "email": "info@primaryprez.com", "bio": "Running in the primary to challenge the status quo.", "surveyResponses": { "why_running": "To give voters a real choice.", "top_priority": "Campaign finance reform.", "experience": "Community Activist.", "fiscal_approach": "Focus on grassroots funding and fiscal transparency." }, "ballotOrder": 1
    },
    // ... other existing candidates, adjusting cycleId as needed ...
    {
      "id": 3, "firstName": "Frank", "lastName": "Lucas", "slug": "frank-lucas", "photoUrl": "https://picsum.photos/seed/franklucas/200/200", "party": "Democratic", "officeId": 1, "cycleId": 2, "website": "https://lucas4mayor.com", "email": "contact@anderson2024.org", "phone": "", "socialLinks": { "facebook": "", "twitter": "https://twitter.com/lucas4mayor", "instagram": "" }, "bio": "Frank Lucas is a small-business owner and civic volunteer with a vision for safer streets.", "mailingAddress": "", "surveyResponses": { "why_running": "To bring real economic development to neighborhoods.", "top_priority": "Strengthen public safety and neighborhood policing.", "experience": "Former Chamber of Commerce president.", "fiscal_approach": "Support small businesses to grow the tax base, then manage spending wisely." }, "ballotOrder": 1, "isIncumbent": false
    },
    {
      "id": 4, "firstName": "Frankie", "lastName": "Lucas", "slug": "frankie-lucas", "photoUrl": "https://picsum.photos/seed/frankielucas/200/200", "party": "Republican", "officeId": 3, "cycleId": 2, "website": "", "email": "quentin@qanderson.com", "phone": "225-555-0303", "socialLinks": { "facebook": "https://facebook.com/frankielucas", "twitter": "", "instagram": "" }, "bio": "Frankie Lucas has been a public defender for 12 years and seeks to reform our criminal justice system.", "mailingAddress": "789 Justice Ave.\nBaton Rouge, LA 70803", "surveyResponses": { "why_running": "To ensure equal justice for all residents.", "top_priority": "Reduce case backlogs and modernize the courts.", "experience": "Senior public defender, legal aid board member.", "fiscal_approach": "Efficient court systems save taxpayer money in the long run." }, "ballotOrder": 1, "isIncumbent": true
    },
    {
      "id": 5, "firstName": "Alice", "lastName": "Johnson", "slug": "alice-johnson", "photoUrl": "https://picsum.photos/seed/alicejohnson/200/200", "party": "Independent", "officeId": 1, "cycleId": 1, "website": "https://aliceforpeople.com", "email": "contact@aliceforpeople.com", "phone": "225-555-0404", "socialLinks": { "twitter": "https://twitter.com/aliceforpeople" }, "bio": "Alice Johnson is a community organizer focused on sustainable development and local empowerment.", "mailingAddress": "456 Community Way\nBaton Rouge, LA 70805", "surveyResponses": { "why_running": "To bring a fresh perspective and community-driven solutions to city hall.", "top_priority": "Investing in green infrastructure and supporting small businesses.", "experience": "10 years as director of a local non-profit, extensive grant writing and project management.", "fiscal_approach": "Prioritize sustainable investments that provide long-term community benefits." }, "ballotOrder": 2, "isIncumbent": false
    },
    { 
      "id": 6,
      "firstName": "David",
      "lastName": "Lee",
      "slug": "david-lee",
      "photoUrl": "https://randomuser.me/api/portraits/men/43.jpg", // Updated
      "party": "Libertarian",
      "officeId": 3, // US House of Representatives, District 1
      "cycleId": 1, // General Election
      "website": "https://davidleeforcongress.com",
      "email": "david.lee@randomuser.me",
      "phone": "225-555-1212",
      "socialLinks": { "facebook": "https://facebook.com/davidleeforcongress", "twitter": "https://twitter.com/davidlee", "instagram": "" },
      "bio": "David Lee is a business consultant and political newcomer running for office to bring fresh ideas and a strong work ethic to Washington.",
      "mailingAddress": "321 Liberty St.\nBaton Rouge, LA 70801",
      "surveyResponses": {
        "why_running": "To restore integrity and accountability in government.",
        "top_priority": "Job creation and economic growth.",
        "experience": "10 years in business consulting, specializing in government contracts.",
        "fiscal_approach": "Eliminate wasteful spending and reduce the tax burden on families and businesses."
      },
      "ballotOrder": 1,
      "isIncumbent": false
    },
    {
      "id": 7,
      "firstName": "Sarah",
      "lastName": "Chen",
      "slug": "sarah-chen",
      "photoUrl": "https://randomuser.me/api/portraits/women/33.jpg", // Updated
      "party": "Democratic",
      "officeId": 4, // State Governor
      "cycleId": 1, // General Election
      "website": "https://sarahchenforgovernor.com",
      "email": "sarah.chen@randomuser.me",
      "phone": "225-555-1313",
      "socialLinks": { "facebook": "https://facebook.com/sarahchenforgovernor", "twitter": "https://twitter.com/sarahchen", "instagram": "" },
      "bio": "Sarah Chen is a former state legislator with a proven track record of fighting for education, healthcare, and infrastructure improvements.",
      "mailingAddress": "654 Hope Ave.\nBaton Rouge, LA 70801",
      "surveyResponses": {
        "why_running": "To continue my service to the community at a higher level.",
        "top_priority": "Expanding access to quality healthcare and education.",
        "experience": "8 years in the state legislature, including 2 years as Speaker Pro Tempore.",
        "fiscal_approach": "Prudent fiscal management with a focus on long-term investments in our state's future."
      },
      "ballotOrder": 2,
      "isIncumbent": false
    },
    {
      "id": 8,
      "firstName": "Michael",
      "lastName": "Brown",
      "slug": "michael-brown",
      "photoUrl": "https://randomuser.me/api/portraits/men/22.jpg", // Updated
      "party": "Republican",
      "officeId": 4, // State Governor
      "cycleId": 1, // General Election
      "website": "https://michaelbrownforgovernor.com",
      "email": "michael.brown@randomuser.me",
      "phone": "225-555-1414",
      "socialLinks": { "facebook": "https://facebook.com/michaelbrownforgovernor", "twitter": "https://twitter.com/michaelbrown", "instagram": "" },
      "bio": "Michael Brown is a successful entrepreneur and community leader dedicated to bringing conservative values and fiscal responsibility to the governor's office.",
      "mailingAddress": "987 Victory Blvd.\nBaton Rouge, LA 70801",
      "surveyResponses": {
        "why_running": "To bring real change and restore faith in government.",
        "top_priority": "Cutting taxes and reducing government size.",
        "experience": "15 years as a business owner, 5 years on the local school board.",
        "fiscal_approach": "Implement zero-based budgeting and eliminate unnecessary programs."
      },
      "ballotOrder": 1,
      "isIncumbent": false
    },
    {
      "id": 9,
      "firstName": "Emily",
      "lastName": "Jones",
      "slug": "emily-jones",
      "photoUrl": "https://randomuser.me/api/portraits/women/11.jpg", // Updated
      "party": "Independent",
      "officeId": 5, // City Council, District A
      "cycleId": 1, // General Election
      "website": "https://emilyjonesforcitycouncil.com",
      "email": "emily.jones@randomuser.me",
      "phone": "225-555-1515",
      "socialLinks": { "facebook": "https://facebook.com/emilyjonesforcitycouncil", "twitter": "https://twitter.com/emilyjones", "instagram": "" },
      "bio": "Emily Jones is a grassroots activist and local business owner running for City Council to give a voice to the voiceless and fight for everyday people.",
      "mailingAddress": "159 Community Dr.\nBaton Rouge, LA 70801",
      "surveyResponses": {
        "why_running": "To represent the interests of working families and small businesses.",
        "top_priority": "Affordable housing and neighborhood safety.",
        "experience": "5 years as a community organizer, 3 years as a small business owner.",
        "fiscal_approach": "Ensure responsible spending and prioritize community needs in the budget."
      },
      "ballotOrder": 2,
      "isIncumbent": false
    },
    {
      "id": 10,
      "firstName": "Robert",
      "lastName": "Davis",
      "slug": "robert-davis",
      "photoUrl": "https://randomuser.me/api/portraits/men/1.jpg", // Updated
      "party": "Neighborhood First",
      "officeId": 5, // City Council, District A
      "cycleId": 1, // General Election
      "website": "https://robertdavisforcitycouncil.com",
      "email": "robert.davis@randomuser.me",
      "phone": "225-555-1616",
      "socialLinks": { "facebook": "https://facebook.com/robertdavisforcitycouncil", "twitter": "https://twitter.com/robertdavis", "instagram": "" },
      "bio": "Robert Davis is a dedicated community servant and former teacher committed to improving our neighborhoods and ensuring a high quality of life for all residents.",
      "mailingAddress": "753 Unity Ln.\nBaton Rouge, LA 70801",
      "surveyResponses": {
        "why_running": "To continue my lifelong service to the community in a new capacity.",
        "top_priority": "Enhancing public safety and community services.",
        "experience": "20 years as an educator and community volunteer, 4 years on the city planning commission.",
        "fiscal_approach": "Advocate for a fair and transparent budget that reflects the community's priorities."
      },
      "ballotOrder": 1,
      "isIncumbent": false
    },
    // Generated Candidates (now 101, to make total with above examples around 115)
    ...Array.from({ length: 101 }, (_, k) => {
        const i = k + 12; // Start ID from 12 (or higher if more hand-picked ones added)
        const officeId = (i % PREDEFINED_OFFICES_DATA.length) + 1; 
        
        let suitableCycles;
        // Assign cycle based on office type
        if (officeId === 5) { // US President
            suitableCycles = PREDEFINED_CYCLES_DATA_RAW.filter(c => c.type.includes(CycleType.PRESIDENTIAL));
        } else if (officeId === 7 || officeId === 8) { // US Senator, US Rep
            suitableCycles = PREDEFINED_CYCLES_DATA_RAW.filter(c => c.type.includes(CycleType.PRESIDENTIAL) || c.type.includes(CycleType.MIDTERM_FEDERAL) || c.type.includes(CycleType.PRIMARY));
        } else if ([2, 9, 10, 11, 12, 13].includes(officeId)) { // State offices
            suitableCycles = PREDEFINED_CYCLES_DATA_RAW.filter(c => c.type.includes(CycleType.STATE_GENERAL) || c.type.includes(CycleType.PRIMARY) || c.type.includes(CycleType.SPECIAL));
        } else { // Local offices
            suitableCycles = PREDEFINED_CYCLES_DATA_RAW.filter(c => c.type.includes(CycleType.MUNICIPAL_LOCAL) || c.type.includes(CycleType.SPECIAL) || c.type.includes(CycleType.PRIMARY));
        }
        if (suitableCycles.length === 0) { // Fallback if no specific cycle type matches (should not happen with current setup)
            suitableCycles = PREDEFINED_CYCLES_DATA_RAW;
        }
        
        const cycle = suitableCycles[i % suitableCycles.length];
        const cycleId = cycle.id;

        const isDistrictedOffice = [2, 4, 8, 14].includes(officeId);
        const parties = ["Democratic", "Republican", "Independent", "Green", "Other"];
        const runningMate = officeId === 5 ? `RunMate ${i}` : undefined;

        return {
            "id": i,
            "firstName": `CandFirst ${i}`,
            "lastName": `CandLast ${i}`,
            "slug": `candfirst${i}-candlast${i}`,
            "photoUrl": `https://randomuser.me/api/portraits/${ i % 2 === 0 ? 'men' : 'women'}/${ (i % 100) }.jpg`,
            "party": parties[i % parties.length],
            "officeId": officeId,
            "runningMateName": runningMate,
            "district": isDistrictedOffice ? `District ${(i % 5) + 1}` : undefined,
            "cycleId": cycleId,
            "website": `https://example.com/candidate${i}`,
            "email": `candidate${i}@example.com`,
            "phone": `225-555-${String(i).padStart(4, '0').slice(-4)}`,
            "socialLinks": { "twitter": `https://twitter.com/candidate${i}` },
            "bio": `This is the detailed biography for Candidate ${i}. They are committed to serving the community and bringing positive change for office ID ${officeId} in cycle ID ${cycleId}. Their platform focuses on key issues such as economic development, education, and public safety. Candidate ${i} has a background in [Generic Field] and believes in transparent governance.`,
            "mailingAddress": `${i * 10} Main St\nBaton Rouge, LA 7080${i % 10}`,
            "surveyResponses": {
                "why_running": `Candidate ${i} is running to make a difference in their community and address pressing local issues.`,
                "top_priority": `The top priority for Candidate ${i} is to improve [Generic Priority Area ${i % 3 + 1}].`,
                "experience": `Candidate ${i} brings ${i % 10 + 5} years of experience in [Generic Experience Field] to the table.`,
                "fiscal_approach": `Candidate ${i} believes in a responsible and transparent fiscal approach, ensuring taxpayer money is used wisely.`
            },
            "ballotOrder": (i % 3) + 1,
            "isIncumbent": (i % 7 === 0 && ((i % 3) + 1) === 1) 
        };
    })
  ],
  "ballotMeasures": [
    // Existing 3 measures
    {
      "id": 101, "slug": "library-funding-2026", "title": "Proposition L: Library System Millage Renewal", "electionDate": "2026-11-06",
      "ballotLanguage": "Shall the Parish of East Baton Rouge continue to levy a special tax of 2.5 mills on all property subject to taxation in the Parish for a period of ten (10) years, beginning with the year 2027 and ending with the year 2036, for the purpose of acquiring, constructing, improving, maintaining and operating public libraries in the Parish, including the purchase of books, periodicals, and equipment, and providing library services to the public?",
      "laymansExplanation": "This measure asks voters if they want to continue an existing property tax that funds the public library system. The tax rate and purpose remain the same.",
      "yesVoteMeans": "You agree to continue the existing 2.5 mills property tax for ten more years to fund public libraries.",
      "noVoteMeans": "You want to discontinue this 2.5 mills property tax, which would reduce funding for public libraries."
    },
    {
      "id": 102, "slug": "parks-bond-2025", "title": "Parks and Recreation Bond Issue", "electionDate": "2025-11-05",
      "ballotLanguage": "Shall the Parish of East Baton Rouge incur debt and issue bonds in an amount not to exceed Fifty Million Dollars ($50,000,000), to run not exceeding twenty (20) years from date thereof, with interest at a rate not exceeding the maximum allowed by law, for the purpose of acquiring, constructing, and improving public parks, recreational facilities, and green spaces, including the acquisition of land and equipment therefor?",
      "laymansExplanation": "This measure asks voters to approve the parish taking on up to $50 million in debt (by selling bonds) to pay for new and improved parks and recreation facilities. This debt would be paid back over up to 20 years, likely through property taxes.",
      "yesVoteMeans": "You authorize the parish to borrow up to $50 million for parks and recreation projects, which will be repaid with interest over time.",
      "noVoteMeans": "You do not want the parish to borrow money for these parks and recreation projects at this time."
    },
    {
      "id": 103, "slug": "school-safety-2024", "title": "School Safety Enhancement Millage", "electionDate": "2024-03-05", 
      "ballotLanguage": "Shall the School Board of East Baton Rouge Parish levy an additional tax of 1.0 mill on all property subject to taxation in the Parish for a period of five (5) years, beginning with the year 2024, for the purpose of funding school safety enhancements, including but not limited to security personnel, equipment, and mental health support services in public schools?",
      "laymansExplanation": "This measure proposed a new 1.0 mill property tax for five years specifically to improve safety and security in public schools.",
      "yesVoteMeans": "You supported a new 1.0 mill property tax for five years to fund school safety initiatives.",
      "noVoteMeans": "You opposed this new 1.0 mill property tax for school safety initiatives."
    },
    // Generated Ballot Measures (107 more, total 110)
    ...Array.from({ length: 107 }, (_, k) => {
        const i = k + 104; // Start ID from 104
        const cycleIndex = i % PREDEFINED_CYCLES_DATA_RAW.length; 
        const electionDate = PREDEFINED_CYCLES_DATA_RAW[cycleIndex].electionDate; 
        const year = new Date(electionDate + 'T00:00:00').getFullYear();
        const topicSuffix = String.fromCharCode(65 + (i % 26)); // A-Z

        return {
            "id": i,
            "slug": `measure-prop${i}-${year}`,
            "title": `Proposition ${i}: Initiative for Topic ${topicSuffix}-${year}`,
            "electionDate": electionDate,
            "ballotLanguage": `This is the official and detailed ballot language for Proposition ${i}. It outlines the specific legal changes, financial implications, and operational adjustments proposed by this measure. Voters are encouraged to read this section carefully to understand the full scope of what a 'yes' or 'no' vote entails. The language is binding and reflects the exact text that would become law or policy if the measure is approved. It may include references to existing statutes or constitutional articles that would be amended or repealed.`,
            "laymansExplanation": `In simpler terms, Proposition ${i} is about [Generic Explanation Area for Topic ${topicSuffix}]. It aims to [solve a problem / create an opportunity] by [doing X, Y, and Z]. This explanation is intended to provide a general understanding of the measure's purpose and potential impact, without the legal jargon of the official ballot language.`,
            "yesVoteMeans": `A 'YES' vote on Proposition ${i} means you support the proposed changes related to Topic ${topicSuffix}. This would generally lead to [Positive Consequence A] and [Positive Consequence B], and potentially involve [Resource Allocation or Policy Change].`,
            "noVoteMeans": `A 'NO' vote on Proposition ${i} means you oppose the proposed changes for Topic ${topicSuffix}. This would generally maintain the current status quo regarding this topic, meaning [Negative Consequence A of status quo] and [Negative Consequence B of status quo] might continue, and the proposed [Resource Allocation or Policy Change] would not occur.`
        };
    })
  ]
};

export const EARLY_VOTING_LOCATIONS_DATA = [
  { id: 'ev1', name: 'City Hall', address: '222 St. Louis St, Baton Rouge, LA 70802' },
  { id: 'ev2', name: 'Main Library at Goodwood', address: '7711 Goodwood Blvd, Baton Rouge, LA 70806' },
  { id: 'ev3', name: 'Baker Municipal Building', address: '3325 Groom Rd, Baker, LA 70714' },
  { id: 'ev4', name: 'Central Branch Library', address: '11260 Joor Rd, Central, LA 70818' },
  { id: 'ev5', name: 'Forest Community Park', address: '13900 S Harrells Ferry Rd, Baton Rouge, LA 70816' },
];

export const OFFICES_DATA = RAW_DATA.offices;
export const BALLOT_MEASURES_DATA = RAW_DATA.ballotMeasures;

const today = new Date();
today.setHours(0,0,0,0); 

export const CYCLES_DATA = PREDEFINED_CYCLES_DATA_RAW
  .map(typedCycle => {
    const { type: cycleTypeData, nameOverride, ...baseCycleData } = typedCycle; // cycleTypeData is unused after destructuring
    const cycle = { ...baseCycleData }; 
    if (nameOverride) {
      cycle.name = nameOverride; 
    }
    return cycle;
  })
  .sort((a, b) => {
    const dateA = new Date(a.electionDate + 'T00:00:00');
    const dateB = new Date(b.electionDate + 'T00:00:00');
    const aIsPast = dateA < today;
    const bIsPast = dateB < today;

    if (aIsPast && !bIsPast) return 1; 
    if (!aIsPast && bIsPast) return -1; 

    if (!aIsPast && !bIsPast) { 
      return dateA.getTime() - dateB.getTime();
    }
    return dateB.getTime() - dateA.getTime(); 
  });


export const SURVEY_QUESTIONS_DATA = RAW_DATA.surveyQuestions;
export const CANDIDATES_DATA = RAW_DATA.candidates.map(c => ({
    ...c,
    photoUrl: c.photoUrl || `https://picsum.photos/seed/${c.slug}/200/200`,
    isIncumbent: c.isIncumbent || false,
}));

export const PARTIES = ["Democratic", "Republican", "Independent", "Green", "Other"];


const RAW_ELECTION_RESULTS_DATA = {
  "2024-03-05": [ 
    {
      officeId: 2, 
      district: "District 67",
      candidateResults: [
        { candidateId: 6, votes: 4500, isWinner: false }, 
        { candidateId: 7, votes: 5500, isWinner: true }   
      ]
    },
    {
      officeId: 1, 
      candidateResults: [
        { candidateId: 8, votes: 12000, isWinner: true } 
      ]
    },
    { // Presidential Primary example
      officeId: 5, 
      candidateResults: [
        { candidateId: 118, votes: 25000, isWinner: true } 
      ]
    }
  ],
  "2022-11-08": [ 
    { 
      officeId: 7, 
      candidateResults: [
        { candidateId: 96, votes: 150000, isWinner: true }, 
        { candidateId: 89, votes: 120000, isWinner: false }  
      ]
    },
    { 
      officeId: 9,
      candidateResults: [
        { candidateId: 23, votes: 850000, isWinner: true },
        { candidateId: 53, votes: 750000, isWinner: false }
      ]
    }
  ],
  "2023-10-14": [ 
    { 
      officeId: 11,
      candidateResults: [
        { candidateId: 40, votes: 60000, isWinner: false },
        { candidateId: 70, votes: 72000, isWinner: true }
      ]
    },
    { 
      officeId: 2,
      district: "District 3", 
      candidateResults: [
        { candidateId: 17, votes: 8000, isWinner: true }, 
        { candidateId: 22, votes: 7500, isWinner: false }  
      ]
    }
  ]
};

export const ELECTION_RESULTS_DATA = [];

for (const electionDate in RAW_ELECTION_RESULTS_DATA) {
  const officeResultsForDate = RAW_ELECTION_RESULTS_DATA[electionDate];
  officeResultsForDate.forEach(rawOfficeResult => {
    const office = OFFICES_DATA.find(o => o.id === rawOfficeResult.officeId);
    if (!office) return;

    let totalVotesInOffice = 0;
    rawOfficeResult.candidateResults.forEach(cr => totalVotesInOffice += cr.votes);

    const processedCandidateResults = rawOfficeResult.candidateResults.map(cr => {
      const candidate = CANDIDATES_DATA.find(c => c.id === cr.candidateId);
      let candidateDisplayName = candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown Candidate';
      if (candidate && candidate.officeId === 5 && candidate.runningMateName) {
        candidateDisplayName = `${candidate.firstName} ${candidate.lastName} / ${candidate.runningMateName}`;
      }
      return {
        candidateId: cr.candidateId,
        candidateName: candidateDisplayName,
        party: candidate ? candidate.party : 'N/A',
        photoUrl: candidate?.photoUrl,
        votes: cr.votes,
        percentage: totalVotesInOffice > 0 ? parseFloat(((cr.votes / totalVotesInOffice) * 100).toFixed(1)) : 0,
        isWinner: cr.isWinner,
      };
    }).sort((a,b) => b.votes - a.votes); 

    ELECTION_RESULTS_DATA.push({
      electionDate: electionDate,
      office: office,
      district: rawOfficeResult.district, 
      results: processedCandidateResults,
      totalVotesInOffice: totalVotesInOffice,
    });
  });
}

const originalSortLogicLine = `return dateB.getTime() - a.getTime(); // Corrected: Should be dateB.getTime() - dateA.getTime()`;
const correctedSortLogicLine = `return dateB.getTime() - dateA.getTime();`;