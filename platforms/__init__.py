from platforms.builtin import BuiltInPlatform
from platforms.careerbuilder import CareerBuilderPlatform
from platforms.dice import DicePlatform
from platforms.glassdoor import GlassdoorPlatform
from platforms.handshake import HandshakePlatform
from platforms.indeed import IndeedPlatform
from platforms.linkedin import LinkedInPlatform
from platforms.monster import MonsterPlatform
from platforms.usajobs import USAJobsPlatform
from platforms.wellfound import WellfoundPlatform
from platforms.ziprecruiter import ZipRecruiterPlatform


PLATFORM_REGISTRY = {
    "linkedin": LinkedInPlatform,
    "indeed": IndeedPlatform,
    "glassdoor": GlassdoorPlatform,
    "ziprecruiter": ZipRecruiterPlatform,
    "monster": MonsterPlatform,
    "dice": DicePlatform,
    "builtin": BuiltInPlatform,
    "wellfound": WellfoundPlatform,
    "handshake": HandshakePlatform,
    "careerbuilder": CareerBuilderPlatform,
    "usajobs": USAJobsPlatform,
}
