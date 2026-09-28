import { pick } from "../lib/rng.js";

// Name pools used to procedurally generate every player in the league.

const FIRST_NAMES = [
  "Marcus", "Deran", "Cole", "Trent", "Jalen", "Xavier", "Bryce", "Elijah", "Dante", "Malik",
  "Tyler", "Isaiah", "Cameron", "Jordan", "Devin", "Antoine", "Reggie", "Sean", "Kaden", "Miles",
  "Andre", "Damon", "Julian", "Corey", "Nate", "Grant", "Wesley", "Omari", "Leo", "Vince",
  "Darius", "Colton", "Emmett", "Gabe", "Rashad", "Tre", "Blake", "Hunter", "Quentin", "Tanner",
  "Jaxon", "Carson", "Micah", "Amari", "Peyton", "Aidan", "Christian", "Austin", "Jared", "Chase",
  "Cooper", "Landon", "Tyree", "Terrance", "Jayden", "Drake", "Marvin", "Malachi", "Nico", "Ethan",
  "Aaron", "Adam", "Alex", "Andrew", "Anthony", "Brandon", "Caleb", "Charles", "Connor", "Daniel",
  "Dylan", "Eric", "Evan", "Gabriel", "Henry", "Ian", "Jason", "Kevin", "Logan", "Lucas",
  "Matthew", "Nathan", "Nicholas", "Noah", "Owen", "Ryan", "Samuel", "Thomas", "Zachary", "Zane"
];

const LAST_NAMES = [

  "Whitfield", "Sanders", "Brooks", "Marsh", "Coleman", "Reyes", "Osei", "Booker", "Lindqvist", "Patterson",
  "Coburn", "Vance", "Delgado", "Harmon", "Ashford", "Kowalski", "Odom", "Fuller", "Marek", "Sinclair",
  "Dunlap", "Chavez", "Prentiss", "Hoykin", "Larkin", "McAdams", "Renner", "Talbot", "Osborne", "Kellerman",
  "Hargrove", "Blevins", "Castillo", "Nix", "Winslow", "Abara", "Dietrich", "Solano", "Kirkland", "Vasquez",
  "Thorne", "O'Connor", "St. Cyr", "Fontenot", "Washington", "Nwolu", "Bautista", "Mercer", "Gallagher", "Picet",
  "Tagensssa", "Boya", "Digs", "Larsons", "Jefferson", "Kible", "Chubb", "Ramsey", "Surtain", "Hutchinson",
  "St. Brown", "Woolen", "Thimox", "Vamekun", "Ormstead", "Iqiler", "Hotson", "Udemo", "Ozudah", "Anzel",
  "Vea", "Mauigoa", "Tuipulotu", "Nacua", "Achane", "Gisbert", "Nazorta", "Herrison", "Tabers", "Onunbe",
  "Alt", "Gashene", "Jasu", "Turner", "Verse", "Gorty", "McVoey", "Yorum", "Benson", "Sinnott",
  "Beebe", "Powers-Johnson", "Kinchens", "Bullard", "Tampa", "Melton", "Quue", "Nweat", "Tiske", "Jenkins",
  "Braswell", "Wilss", "Trice", "Trotter", "Sichen", "Liufau", "Mustapha", "Watts", "Pritchett", "Wardy",
  "Ceren", "Bhipley", "Kaki", "Xowing", "Kians", "Whittington", "Franklin", "Kire", "Flott", "Strachan"
];

function makeName(rng) { return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`; }

export { FIRST_NAMES, LAST_NAMES, makeName };
