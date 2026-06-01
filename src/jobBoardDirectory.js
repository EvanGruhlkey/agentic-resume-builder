export const JOB_BOARD_DIRECTORY = uniqueBoards([
  // General job boards. Indeed is intentionally omitted because it repeatedly bot-detects this app.
  board("ziprecruiter", "ZipRecruiter", "https://www.ziprecruiter.com/", "ziprecruiter.com", ["general"]),
  board("glassdoor", "Glassdoor", "https://www.glassdoor.com/Job/", "glassdoor.com", ["general"]),
  board("monster", "Monster", "https://www.monster.com/jobs/", "monster.com", ["general"]),
  board("careerbuilder", "CareerBuilder", "https://www.careerbuilder.com/", "careerbuilder.com", ["general"]),
  board("simplyhired", "SimplyHired", "https://www.simplyhired.com/", "simplyhired.com", ["general"]),
  board("getwork", "Getwork", "https://www.getwork.com/", "getwork.com", ["general"]),
  board("jobcom", "Job.com", "https://www.job.com/", "job.com", ["general"]),
  board("ladders", "Ladders", "https://www.theladders.com/", "theladders.com", ["general"]),
  board("nexxt", "Nexxt", "https://www.nexxt.com/", "nexxt.com", ["general"]),
  board("jooble", "Jooble", "https://jooble.org/", "jooble.org", ["general"]),
  board("jora", "Jora", "https://www.jora.com/", "jora.com", ["general"]),
  board("talent", "Talent.com", "https://www.talent.com/", "talent.com", ["general"]),
  board("adzuna", "Adzuna", "https://www.adzuna.com/", "adzuna.com", ["general"]),

  // Startup / tech.
  board("wellfound", "Wellfound", "https://wellfound.com/jobs", "wellfound.com", ["tech", "startup"]),
  board("yc", "Y Combinator Work at a Startup", "https://www.ycombinator.com/jobs", "ycombinator.com", ["tech", "startup"]),
  board("builtin", "Built In", "https://builtin.com/jobs", "builtin.com", ["tech"]),
  board("dice", "Dice", "https://www.dice.com/", "dice.com", ["tech"]),
  board("hn", "Hacker News Who is Hiring", "https://news.ycombinator.com/", "news.ycombinator.com", ["tech", "startup"]),
  board("wttj", "Welcome to the Jungle", "https://www.welcometothejungle.com/en/jobs", "welcometothejungle.com", ["tech", "general"]),
  board("levels", "Levels.fyi Jobs", "https://www.levels.fyi/jobs/", "levels.fyi", ["tech"]),
  board("trueup", "TrueUp", "https://www.trueup.io/jobs", "trueup.io", ["tech"]),
  board("techladies", "Tech Ladies", "https://www.hiretechladies.com/jobs", "hiretechladies.com", ["tech"]),
  board("crunchboard", "Crunchboard", "https://www.crunchboard.com/jobs", "crunchboard.com", ["tech", "startup"]),
  board("devitjobs", "DevITjobs", "https://devitjobs.com/", "devitjobs.com", ["tech"]),
  board("techfetch", "TechFetch", "https://www.techfetch.com/", "techfetch.com", ["tech"]),
  board("authenticjobs", "Authentic Jobs", "https://authenticjobs.com/", "authenticjobs.com", ["tech", "design"]),
  board("gunio", "Gun.io", "https://www.gun.io/", "gun.io", ["tech"]),
  board("arc", "Arc", "https://arc.dev/remote-jobs", "arc.dev", ["tech", "remote"]),
  board("turing", "Turing Jobs", "https://www.turing.com/jobs", "turing.com", ["tech", "remote"]),
  board("lemon", "Lemon.io", "https://lemon.io/", "lemon.io", ["tech", "remote"]),

  // Remote.
  board("weworkremotely", "We Work Remotely", "https://weworkremotely.com/", "weworkremotely.com", ["remote", "tech"]),
  board("remoteok", "Remote OK", "https://remoteok.com/", "remoteok.com", ["remote", "tech"]),
  board("remotive", "Remotive", "https://remotive.com/", "remotive.com", ["remote"]),
  board("himalayas", "Himalayas", "https://himalayas.app/jobs", "himalayas.app", ["remote", "tech"]),
  board("workingnomads", "Working Nomads", "https://www.workingnomads.com/jobs", "workingnomads.com", ["remote"]),
  board("remoteco", "Remote.co", "https://remote.co/remote-jobs/", "remote.co", ["remote"]),
  board("dynamitejobs", "Dynamite Jobs", "https://dynamitejobs.com/", "dynamitejobs.com", ["remote"]),
  board("nodesk", "NoDesk", "https://nodesk.co/remote-jobs/", "nodesk.co", ["remote"]),
  board("justremote", "JustRemote", "https://justremote.co/", "justremote.co", ["remote"]),
  board("remotehub", "RemoteHub", "https://www.remotehub.com/jobs", "remotehub.com", ["remote"]),
  board("skipthedrive", "SkipTheDrive", "https://www.skipthedrive.com/", "skipthedrive.com", ["remote"]),
  board("virtualvocations", "Virtual Vocations", "https://www.virtualvocations.com/", "virtualvocations.com", ["remote"]),
  board("pangian", "Pangian", "https://pangian.com/", "pangian.com", ["remote"]),
  board("crossover", "Crossover", "https://www.crossover.com/jobs", "crossover.com", ["remote"]),

  // Early career.
  board("handshake", "Handshake", "https://joinhandshake.com/", "joinhandshake.com", ["early-career"]),
  board("ripplematch", "RippleMatch", "https://ripplematch.com/", "ripplematch.com", ["early-career"]),
  board("wayup", "WayUp", "https://www.wayup.com/", "wayup.com", ["early-career"]),
  board("parkerdewey", "Parker Dewey", "https://www.parkerdewey.com/", "parkerdewey.com", ["early-career"]),
  board("internships", "Chegg Internships", "https://www.internships.com/", "internships.com", ["early-career"]),
  board("collegerecruiter", "College Recruiter", "https://www.collegerecruiter.com/", "collegerecruiter.com", ["early-career"]),
  board("internjobs", "InternJobs", "https://www.internjobs.com/", "internjobs.com", ["early-career"]),

  // Creative/product.
  board("dribbble", "Dribbble Jobs", "https://dribbble.com/jobs", "dribbble.com", ["design"]),
  board("behance", "Behance Jobs", "https://www.behance.net/joblist", "behance.net", ["design"]),
  board("aiga", "AIGA Design Jobs", "https://designjobs.aiga.org/", "designjobs.aiga.org", ["design"]),
  board("coroflot", "Coroflot", "https://www.coroflot.com/design-jobs", "coroflot.com", ["design"]),
  board("producthunt", "Product Hunt Jobs", "https://www.producthunt.com/jobs", "producthunt.com", ["product", "startup"]),
  board("uxjobsboard", "UX Jobs Board", "https://www.uxjobsboard.com/", "uxjobsboard.com", ["design", "product"]),

  // Business / finance / nonprofit / public sector.
  board("salesjobs", "SalesJobs", "https://www.salesjobs.com/", "salesjobs.com", ["sales"]),
  board("repvue", "RepVue Jobs", "https://www.repvue.com/jobs", "repvue.com", ["sales"]),
  board("marketinghire", "MarketingHire", "https://www.marketinghire.com/", "marketinghire.com", ["marketing"]),
  board("efinancialcareers", "eFinancialCareers", "https://www.efinancialcareers.com/", "efinancialcareers.com", ["finance"]),
  board("roberthalf", "Robert Half", "https://www.roberthalf.com/us/en/jobs", "roberthalf.com", ["finance", "business"]),
  board("usajobs", "USAJOBS", "https://www.usajobs.gov/", "usajobs.gov", ["government"]),
  board("governmentjobs", "GovernmentJobs", "https://www.governmentjobs.com/", "governmentjobs.com", ["government"]),
  board("idealist", "Idealist", "https://www.idealist.org/en/jobs", "idealist.org", ["nonprofit"]),
  board("workforgood", "Work for Good", "https://www.workforgood.org/", "workforgood.org", ["nonprofit"]),

  // Healthcare / education / legal / media.
  board("healthecareers", "Health eCareers", "https://www.healthecareers.com/", "healthecareers.com", ["healthcare"]),
  board("nurse", "Nurse.com Jobs", "https://www.nurse.com/jobs/", "nurse.com", ["healthcare"]),
  board("vivian", "Vivian Health", "https://www.vivian.com/", "vivian.com", ["healthcare"]),
  board("higheredjobs", "HigherEdJobs", "https://www.higheredjobs.com/", "higheredjobs.com", ["education", "academic"]),
  board("schoolspring", "SchoolSpring", "https://www.schoolspring.com/", "schoolspring.com", ["education"]),
  board("edjoin", "EdJoin", "https://www.edjoin.org/", "edjoin.org", ["education"]),
  board("lawjobs", "Lawjobs", "https://www.lawjobs.com/", "lawjobs.com", ["legal"]),
  board("legalio", "Legal.io", "https://www.legal.io/jobs", "legal.io", ["legal"]),
  board("mediabistro", "Mediabistro", "https://www.mediabistro.com/jobs", "mediabistro.com", ["media"]),
  board("journalismjobs", "JournalismJobs", "https://www.journalismjobs.com/", "journalismjobs.com", ["media"]),

  // Major company career pages.
  board("googlecareers", "Google Careers", "https://www.google.com/about/careers/applications/", "google.com", ["company", "tech"]),
  board("microsoft", "Microsoft Careers", "https://jobs.careers.microsoft.com/", "jobs.careers.microsoft.com", ["company", "tech"]),
  board("apple", "Apple Jobs", "https://jobs.apple.com/", "jobs.apple.com", ["company", "tech"]),
  board("meta", "Meta Careers", "https://www.metacareers.com/", "metacareers.com", ["company", "tech"]),
  board("netflix", "Netflix Jobs", "https://jobs.netflix.com/", "jobs.netflix.com", ["company", "tech"]),
  board("nvidia", "NVIDIA Careers", "https://www.nvidia.com/en-us/about-nvidia/careers/", "nvidia.com", ["company", "tech"]),
  board("tesla", "Tesla Careers", "https://www.tesla.com/careers", "tesla.com", ["company", "tech"]),
  board("spacex", "SpaceX Careers", "https://www.spacex.com/careers/", "spacex.com", ["company", "tech"]),
  board("openai", "OpenAI Careers", "https://openai.com/careers/", "openai.com", ["company", "tech"]),
  board("anthropic", "Anthropic Careers", "https://www.anthropic.com/jobs", "anthropic.com", ["company", "tech"]),
  board("stripe", "Stripe Jobs", "https://stripe.com/jobs", "stripe.com", ["company", "tech"]),
  board("databricks", "Databricks Careers", "https://www.databricks.com/company/careers", "databricks.com", ["company", "tech"]),
  board("figma", "Figma Careers", "https://www.figma.com/careers/", "figma.com", ["company", "tech", "design"]),
  board("notion", "Notion Careers", "https://www.notion.com/careers", "notion.com", ["company", "tech"]),
  board("airbnb", "Airbnb Careers", "https://careers.airbnb.com/", "careers.airbnb.com", ["company", "tech"]),
  board("uber", "Uber Careers", "https://www.uber.com/us/en/careers/", "uber.com", ["company", "tech"]),
  board("doordash", "DoorDash Careers", "https://careers.doordash.com/", "careers.doordash.com", ["company", "tech"]),
  board("roblox", "Roblox Careers", "https://careers.roblox.com/", "careers.roblox.com", ["company", "tech"]),
  board("palantir", "Palantir Careers", "https://www.palantir.com/careers/", "palantir.com", ["company", "tech"]),
  board("salesforce", "Salesforce Careers", "https://careers.salesforce.com/", "careers.salesforce.com", ["company", "tech"]),
  board("servicenow", "ServiceNow Careers", "https://careers.servicenow.com/", "careers.servicenow.com", ["company", "tech"]),
  board("mongodb", "MongoDB Careers", "https://www.mongodb.com/company/careers", "mongodb.com", ["company", "tech"]),
  board("atlassian", "Atlassian Careers", "https://www.atlassian.com/company/careers", "atlassian.com", ["company", "tech"]),
  board("canva", "Canva Jobs", "https://www.canva.com/careers/jobs/", "canva.com", ["company", "tech", "design"]),

  // Additional boards from the user's pasted directory.
  board("remote-rocketship", "Remote Rocketship", "https://www.remoterocketship.com/", "remoterocketship.com", ["remote", "tech"]),
  board("working-not-working", "Working Not Working", "https://workingnotworking.com/", "workingnotworking.com", ["design", "product"]),
  board("rainmakers", "Rainmakers", "https://www.rainmakers.co/", "rainmakers.co", ["sales"]),
  board("saas-sales-jobs", "SaaS Sales Jobs", "https://www.saas-sales-jobs.com/", "saas-sales-jobs.com", ["sales"]),
  board("marketerhire", "MarketerHire", "https://marketerhire.com/", "marketerhire.com", ["marketing"]),
  board("growthhackers", "GrowthHackers Jobs", "https://growthhackers.com/jobs", "growthhackers.com", ["marketing"]),
  board("wall-street-oasis", "Wall Street Oasis Jobs", "https://www.wallstreetoasis.com/jobs", "wallstreetoasis.com", ["finance"]),
  board("accountingfly", "Accountingfly", "https://www.accountingfly.com/", "accountingfly.com", ["finance"]),
  board("cfa-careers", "CFA Institute Career Center", "https://careers.cfainstitute.org/", "careers.cfainstitute.org", ["finance"]),
  board("onewire", "OneWire", "https://www.onewire.com/", "onewire.com", ["finance"]),
  board("practicelink", "PracticeLink", "https://www.practicelink.com/", "practicelink.com", ["healthcare"]),
  board("incredible-health", "Incredible Health", "https://www.incrediblehealth.com/", "incrediblehealth.com", ["healthcare"]),
  board("amn-healthcare", "AMN Healthcare", "https://www.amnhealthcare.com/careers/", "amnhealthcare.com", ["healthcare"]),
  board("comphealth", "CompHealth", "https://comphealth.com/", "comphealth.com", ["healthcare"]),
  board("locumtenens", "LocumTenens", "https://www.locumtenens.com/", "locumtenens.com", ["healthcare"]),
  board("hospitalcareers", "HospitalCareers", "https://www.hospitalcareers.com/", "hospitalcareers.com", ["healthcare"]),
  board("careervitals", "CareerVitals", "https://www.careervitals.com/", "careervitals.com", ["healthcare"]),
  board("k12jobspot", "K12JobSpot", "https://www.k12jobspot.com/", "k12jobspot.com", ["education"]),
  board("teach-away", "Teach Away", "https://www.teachaway.com/teaching-jobs-abroad", "teachaway.com", ["education"]),
  board("teachers-teachers", "Teachers-Teachers", "https://www.teachers-teachers.com/", "teachers-teachers.com", ["education"]),
  board("chronicle", "Chronicle Jobs", "https://jobs.chronicle.com/", "jobs.chronicle.com", ["education", "academic"]),
  board("inside-higher-ed", "Inside Higher Ed Careers", "https://careers.insidehighered.com/", "careers.insidehighered.com", ["education", "academic"]),
  board("federal-government-jobs", "Federal Government Jobs", "https://www.federalgovernmentjobs.us/", "federalgovernmentjobs.us", ["government"]),
  board("workintexas", "State of Texas Jobs", "https://www.workintexas.com/", "workintexas.com", ["government"]),
  board("publicservicecareers", "PublicServiceCareers", "https://www.publicservicecareers.org/", "publicservicecareers.org", ["government"]),
  board("nonprofit-hr", "Nonprofit HR", "https://www.nonprofithr.com/jobs/", "nonprofithr.com", ["nonprofit"]),
  board("foundation-list", "Foundation List", "https://www.foundationlist.org/", "foundationlist.org", ["nonprofit"]),
  board("council-nonprofits", "National Council of Nonprofits", "https://www.councilofnonprofits.org/jobs", "councilofnonprofits.org", ["nonprofit"]),
  board("bridgespan", "Bridgespan Job Board", "https://www.bridgespan.org/jobs", "bridgespan.org", ["nonprofit"]),
  board("philanthropy", "Chronicle of Philanthropy Jobs", "https://www.philanthropy.com/jobs", "philanthropy.com", ["nonprofit"]),
  board("above-the-law", "Above the Law Jobs", "https://abovethelaw.com/jobs/", "abovethelaw.com", ["legal"]),
  board("nalp", "NALP Job Center", "https://www.nalp.org/jobs", "nalp.org", ["legal"]),
  board("aba-career", "ABA Career Center", "https://careercenter.americanbar.org/", "careercenter.americanbar.org", ["legal"]),
  board("problogger", "ProBlogger Job Board", "https://problogger.com/jobs/", "problogger.com", ["media"]),
  board("contena", "Contena", "https://www.contena.co/", "contena.co", ["media"]),
  board("freelance-writing", "Freelance Writing Jobs", "https://www.freelancewriting.com/jobs/", "freelancewriting.com", ["media"]),
  board("poynter", "Poynter Jobs", "https://www.poynter.org/jobs/", "poynter.org", ["media"]),
  board("nature-careers", "Nature Careers", "https://www.nature.com/naturecareers", "nature.com", ["academic"]),
  board("science-careers", "Science Careers", "https://jobs.sciencecareers.org/", "jobs.sciencecareers.org", ["academic"]),
  board("academicjobsonline", "AcademicJobsOnline", "https://academicjobsonline.org/", "academicjobsonline.org", ["academic"]),
  board("times-higher-education", "Times Higher Education Jobs", "https://www.timeshighereducation.com/unijobs/", "timeshighereducation.com", ["academic", "education"]),
  board("national-labs", "National Labs Jobs", "https://www.energy.gov/jobs/jobs", "energy.gov", ["academic", "government"]),
  board("poached", "Poached Jobs", "https://poachedjobs.com/", "poachedjobs.com", ["hospitality"]),
  board("culinary-agents", "Culinary Agents", "https://culinaryagents.com/", "culinaryagents.com", ["hospitality"]),
  board("hcareers", "Hcareers", "https://www.hcareers.com/", "hcareers.com", ["hospitality"]),
  board("hospitality-online", "Hospitality Online", "https://www.hospitalityonline.com/jobs", "hospitalityonline.com", ["hospitality"]),
  board("sirvo", "Sirvo", "https://www.sirvo.com/", "sirvo.com", ["hospitality"]),
  board("snagajob", "Snagajob", "https://www.snagajob.com/", "snagajob.com", ["retail", "hospitality"]),
  board("craigslist", "Craigslist Jobs", "https://www.craigslist.org/about/sites", "craigslist.org", ["retail"]),
  board("instawork", "Instawork", "https://www.instawork.com/", "instawork.com", ["retail", "hospitality"]),
  board("wonolo", "Wonolo", "https://www.wonolo.com/", "wonolo.com", ["retail"]),
  board("shiftkey", "ShiftKey", "https://www.shiftkey.com/", "shiftkey.com", ["healthcare", "retail"]),
  board("qwick", "Qwick", "https://www.qwick.com/", "qwick.com", ["hospitality", "retail"]),
  board("bluecrew", "Bluecrew", "https://www.bluecrewjobs.com/", "bluecrewjobs.com", ["retail"]),
  board("peopleready", "PeopleReady", "https://www.peopleready.com/jobs/", "peopleready.com", ["retail"]),
  board("workwhile", "WorkWhile", "https://www.workwhilejobs.com/", "workwhilejobs.com", ["retail"]),
  board("gigsmart", "GigSmart", "https://gigsmart.com/", "gigsmart.com", ["retail"]),
  board("taskrabbit", "Taskrabbit", "https://www.taskrabbit.com/become-a-tasker", "taskrabbit.com", ["retail"]),
  board("bloomberg", "Bloomberg Careers", "https://www.bloomberg.com/company/careers/", "bloomberg.com", ["company", "finance", "tech"]),
  board("capital-one", "Capital One Careers", "https://www.capitalonecareers.com/", "capitalonecareers.com", ["company", "finance", "tech"]),
  board("jpmorgan", "JPMorgan Chase Careers", "https://careers.jpmorgan.com/", "careers.jpmorgan.com", ["company", "finance"]),
  board("goldman-sachs", "Goldman Sachs Careers", "https://www.goldmansachs.com/careers/", "goldmansachs.com", ["company", "finance"]),
  board("morgan-stanley", "Morgan Stanley Careers", "https://www.morganstanley.com/people-opportunities/careers", "morganstanley.com", ["company", "finance"]),
  board("bank-of-america", "Bank of America Careers", "https://careers.bankofamerica.com/", "careers.bankofamerica.com", ["company", "finance"]),
  board("visa", "Visa Careers", "https://usa.visa.com/careers.html", "visa.com", ["company", "finance", "tech"]),
  board("mastercard", "Mastercard Careers", "https://careers.mastercard.com/", "careers.mastercard.com", ["company", "finance", "tech"]),
  board("walmart", "Walmart Careers", "https://careers.walmart.com/", "careers.walmart.com", ["company", "retail", "tech"]),
  board("target", "Target Careers", "https://corporate.target.com/careers", "target.com", ["company", "retail"]),
  board("costco", "Costco Careers", "https://www.costco.com/jobs.html", "costco.com", ["company", "retail"]),
  board("best-buy", "Best Buy Careers", "https://jobs.bestbuy.com/", "jobs.bestbuy.com", ["company", "retail", "tech"]),
  board("home-depot", "Home Depot Careers", "https://careers.homedepot.com/", "careers.homedepot.com", ["company", "retail"]),
  board("lowes", "Lowe's Careers", "https://talent.lowes.com/", "talent.lowes.com", ["company", "retail"]),
  board("heb", "H-E-B Careers", "https://careers.heb.com/", "careers.heb.com", ["company", "retail"]),
  board("starbucks", "Starbucks Careers", "https://www.starbucks.com/careers/", "starbucks.com", ["company", "hospitality", "retail"]),
  board("chick-fil-a", "Chick-fil-A Careers", "https://www.chick-fil-a.com/careers", "chick-fil-a.com", ["company", "hospitality"]),
  board("chipotle", "Chipotle Careers", "https://jobs.chipotle.com/", "jobs.chipotle.com", ["company", "hospitality"]),
  board("mcdonalds", "McDonald's Careers", "https://careers.mcdonalds.com/", "careers.mcdonalds.com", ["company", "hospitality"]),
  board("nike", "Nike Careers", "https://jobs.nike.com/", "jobs.nike.com", ["company", "retail", "design"]),
  board("dell", "Dell Careers", "https://jobs.dell.com/", "jobs.dell.com", ["company", "tech"]),
  board("hp", "HP Careers", "https://jobs.hp.com/", "jobs.hp.com", ["company", "tech"]),
  board("ibm", "IBM Careers", "https://www.ibm.com/careers", "ibm.com", ["company", "tech"]),
  board("oracle", "Oracle Careers", "https://www.oracle.com/careers/", "oracle.com", ["company", "tech"]),
  board("cisco", "Cisco Careers", "https://www.cisco.com/c/en/us/about/careers.html", "cisco.com", ["company", "tech"]),
  board("intel", "Intel Careers", "https://jobs.intel.com/", "jobs.intel.com", ["company", "tech"]),
  board("amd", "AMD Careers", "https://careers.amd.com/", "careers.amd.com", ["company", "tech"]),
  board("qualcomm", "Qualcomm Careers", "https://www.qualcomm.com/company/careers", "qualcomm.com", ["company", "tech"]),
  board("ti", "Texas Instruments Careers", "https://careers.ti.com/", "careers.ti.com", ["company", "tech"]),
  board("qorvo", "Qorvo Careers", "https://www.qorvo.com/careers", "qorvo.com", ["company", "tech"]),
  board("crowdstrike", "CrowdStrike Careers", "https://www.crowdstrike.com/careers/", "crowdstrike.com", ["company", "tech"]),
  board("cloudflare", "Cloudflare Careers", "https://www.cloudflare.com/careers/", "cloudflare.com", ["company", "tech"]),
  board("github-careers", "GitHub Careers", "https://www.github.careers/", "github.careers", ["company", "tech"]),
  board("github", "GitHub Hiring Searches", "https://github.com/search?q=hiring&type=issues", "github.com", ["tech", "startup"]),
  board("gist", "GitHub Gist Search", "https://gist.github.com/search", "gist.github.com", ["tech"]),
  board("greenhouse-index", "Greenhouse Job Boards", "https://boards.greenhouse.io/", "boards.greenhouse.io", ["ats", "tech", "general"]),
  board("lever-index", "Lever Jobs", "https://jobs.lever.co/", "jobs.lever.co", ["ats", "tech", "general"]),
  board("ashby-index", "Ashby Jobs", "https://jobs.ashbyhq.com/", "jobs.ashbyhq.com", ["ats", "tech", "general"]),
  board("workday", "Workday Jobs", "https://www.myworkdayjobs.com/", "myworkdayjobs.com", ["ats", "company", "general"]),
  board("icims", "iCIMS Careers", "https://www.icims.com/", "icims.com", ["ats", "company", "general"]),
  board("smartrecruiters-index", "SmartRecruiters Jobs", "https://www.smartrecruiters.com/", "smartrecruiters.com", ["ats", "company", "general"]),
  board("jobvite", "Jobvite", "https://www.jobvite.com/", "jobvite.com", ["ats", "company", "general"]),
  board("bamboohr", "BambooHR Careers Pages", "https://www.bamboohr.com/", "bamboohr.com", ["ats", "company", "general"]),
  board("zoho-recruit", "Zoho Recruit", "https://www.zoho.com/recruit/", "zoho.com", ["ats", "company", "general"]),
  board("recruitee", "Recruitee", "https://recruitee.com/", "recruitee.com", ["ats", "company", "general"]),
  board("teamtailor", "Teamtailor", "https://www.teamtailor.com/", "teamtailor.com", ["ats", "company", "general"]),
  board("breezy", "Breezy HR", "https://breezy.hr/", "breezy.hr", ["ats", "company", "general"]),
  board("jazzhr", "JazzHR", "https://www.jazzhr.com/", "jazzhr.com", ["ats", "company", "general"]),
  board("paylocity", "Paylocity Careers", "https://www.paylocity.com/", "paylocity.com", ["ats", "company", "general"]),
  board("paycom", "Paycom Careers", "https://www.paycom.com/", "paycom.com", ["ats", "company", "general"]),
  board("ukg", "UKG Careers", "https://www.ukg.com/careers", "ukg.com", ["ats", "company", "general"]),
  board("adp", "ADP Careers", "https://jobs.adp.com/", "jobs.adp.com", ["ats", "company", "general"]),
  board("oracle-taleo", "Oracle Taleo", "https://www.oracle.com/human-capital-management/taleo/", "oracle.com", ["ats", "company", "general"]),
  board("successfactors", "SAP SuccessFactors", "https://www.sap.com/products/hcm.html", "sap.com", ["ats", "company", "general"]),
  board("dayforce", "Dayforce Careers", "https://www.dayforce.com/careers", "dayforce.com", ["ats", "company", "general"]),
  board("rippling", "Rippling Careers", "https://www.rippling.com/careers", "rippling.com", ["ats", "company", "tech"]),
  board("personio", "Personio Careers", "https://www.personio.com/careers/", "personio.com", ["ats", "company", "general"]),
  board("pinpoint", "Pinpoint", "https://www.pinpointhq.com/", "pinpointhq.com", ["ats", "company", "general"]),
  board("fountain", "Fountain", "https://www.fountain.com/", "fountain.com", ["ats", "company", "general"]),
  board("recruiterflow", "Recruiterflow", "https://recruiterflow.com/", "recruiterflow.com", ["ats", "company", "general"]),
  board("comeet", "Comeet", "https://www.comeet.com/", "comeet.com", ["ats", "company", "general"])
]);

export function directoryEntriesForSearch({ targetTitle, location = "", maxJobs = 25, max, searchAllSources = false }) {
  const limit = searchAllSources ? JOB_BOARD_DIRECTORY.length : max || boardLimitForResults(maxJobs);
  const categories = categoriesForSearch(targetTitle, location);
  const scored = JOB_BOARD_DIRECTORY.map((entry) => ({
    entry,
    score: entry.categories.reduce((total, category) => total + (categories.has(category) ? 3 : 0), 0) +
      (entry.categories.includes("general") ? 1 : 0)
  }));

  return scored
    .filter(({ score }) => searchAllSources || score > 0)
    .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

export function directoryQueriesForSearch(params) {
  const queryLimit = params.searchAllSources ? allSourceQueryLimit() : queryLimitForResults(params.maxJobs || 25);
  return directoryEntriesForSearch(params)
    .flatMap((entry) => [
      `"${params.targetTitle}" "${params.location || "United States"}" site:${entry.domain}`,
      `"${params.targetTitle}" "${params.location || "United States"}" "${new Date().getFullYear()}" site:${entry.domain}`,
      `"${params.targetTitle}" "${params.location || "United States"}" "posted" OR "new" site:${entry.domain}`,
      `"${params.targetTitle}" "${params.location || "United States"}" "date posted" site:${entry.domain}`
    ])
    .slice(0, queryLimit);
}

export function externalBoardForUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return JOB_BOARD_DIRECTORY.find((entry) => hostname === entry.domain || hostname.endsWith(`.${entry.domain}`));
  } catch {
    return null;
  }
}

export function externalBoardCatalogForClient() {
  return JOB_BOARD_DIRECTORY.map((entry) => ({
    id: entry.id,
    name: entry.name,
    mode: entry.mode,
    sourcePageExamples: [entry.url],
    detailUrlPatterns: [`https?://([^/]+\\.)?${escapeRegExp(entry.domain)}/.*`],
    listingUrlPatterns: [`https?://([^/]+\\.)?${escapeRegExp(entry.domain)}/.*`],
    categories: entry.categories
  }));
}

function categoriesForSearch(targetTitle, location) {
  const text = `${targetTitle} ${location}`.toLowerCase();
  const categories = new Set(["general"]);

  if (/software|engineer|developer|frontend|backend|full.?stack|data|ai|ml|devops|security|product|designer|ux|ui/i.test(text)) {
    categories.add("tech");
  }
  if (/startup|founder|early.?stage/i.test(text)) categories.add("startup");
  if (/remote|work from home|distributed/i.test(text)) categories.add("remote");
  if (/intern|internship|new grad|entry.?level|student|co-?op/i.test(text)) categories.add("early-career");
  if (/design|designer|ux|ui|creative|brand/i.test(text)) categories.add("design");
  if (/product manager|product/i.test(text)) categories.add("product");
  if (/sales|account executive|sdr|business development/i.test(text)) categories.add("sales");
  if (/marketing|growth|seo|content/i.test(text)) categories.add("marketing");
  if (/finance|accounting|consulting|analyst|banking/i.test(text)) categories.add("finance");
  if (/health|nurse|medical|doctor|clinical/i.test(text)) categories.add("healthcare");
  if (/teacher|education|academic|professor|research/i.test(text)) categories.add("education");
  if (/government|public sector|federal|city|state/i.test(text)) categories.add("government");
  if (/nonprofit|foundation|social impact/i.test(text)) categories.add("nonprofit");
  if (/legal|law|attorney|paralegal/i.test(text)) categories.add("legal");
  if (/writer|journalism|media|editor/i.test(text)) categories.add("media");
  if (/chef|restaurant|hospitality|hotel|cook|barista|server/i.test(text)) categories.add("hospitality");
  if (/retail|hourly|warehouse|store|cashier|shift|local/i.test(text)) categories.add("retail");

  categories.add("company");
  categories.add("ats");
  return categories;
}

function board(id, name, url, domain, categories) {
  return { id, name, url, domain, categories, mode: "handoff" };
}

function boardLimitForResults(maxJobs) {
  return Math.min(JOB_BOARD_DIRECTORY.length, Math.max(12, Math.ceil(Number(maxJobs || 25) * 1.5)));
}

function queryLimitForResults(maxJobs) {
  return Math.min(160, Math.max(24, Math.ceil(Number(maxJobs || 25) * 2.5)));
}

function allSourceQueryLimit() {
  return JOB_BOARD_DIRECTORY.length * 4;
}

function uniqueBoards(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = entry.domain;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
