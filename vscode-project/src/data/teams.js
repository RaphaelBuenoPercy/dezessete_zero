// Static metadata for all 32 NFL teams (city, name, abbreviation, colors),
// plus the shared salary-cap constant.

const CAP = 260; // team salary cap, $M (simplified, roughly current-era scale)

const TEAM_META = [
  { abbr:"BUF", city:"Buffalo", name:"Bills", conf:"AFC", div:"East", climate:"cold", market:"small", c1:"#00338D", c2:"#C60C30", stars:{QB:"Josh Allen",RB:"James Cook",WR:"Khalil Shakir",DEF:"Matt Milano"} },
  { abbr:"MIA", city:"Miami", name:"Dolphins", conf:"AFC", div:"East", climate:"warm", market:"large", c1:"#008E97", c2:"#F58220", stars:{QB:"Tua Tagovailoa",RB:"De'Von Achane",WR:"Tyreek Hill",DEF:"Jalen Ramsey"} },
  { abbr:"NE", city:"New England", name:"Patriots", conf:"AFC", div:"East", climate:"cold", market:"large", c1:"#002244", c2:"#C60C30", stars:{QB:"Drake Maye",RB:"Rhamondre Stevenson",WR:"Stefon Diggs",DEF:"Christian Gonzalez"} },
  { abbr:"NYJ", city:"New York", name:"Jets", conf:"AFC", div:"East", climate:"cold", market:"mega", c1:"#125740", c2:"#000000", stars:{QB:"Justin Fields",RB:"Breece Hall",WR:"Garrett Wilson",DEF:"Sauce Gardner"} },
  { abbr:"BAL", city:"Baltimore", name:"Ravens", conf:"AFC", div:"North", climate:"cold", market:"mid", c1:"#241773", c2:"#9E7C0C", stars:{QB:"Lamar Jackson",RB:"Derrick Henry",WR:"Zay Flowers",DEF:"Roquan Smith"} },
  { abbr:"CIN", city:"Cincinnati", name:"Bengals", conf:"AFC", div:"North", climate:"cold", market:"mid", c1:"#FB4F14", c2:"#000000", stars:{QB:"Joe Burrow",RB:"Chase Brown",WR:"Ja'Marr Chase",DEF:"Trey Hendrickson"} },
  { abbr:"CLE", city:"Cleveland", name:"Browns", conf:"AFC", div:"North", climate:"cold", market:"mid", c1:"#311D00", c2:"#FF3C00", stars:{QB:"Dillon Gabriel",RB:"Quinshon Judkins",WR:"Jerry Jeudy",DEF:"Myles Garrett"} },
  { abbr:"PIT", city:"Pittsburgh", name:"Steelers", conf:"AFC", div:"North", climate:"cold", market:"mid", c1:"#000000", c2:"#FFB612", stars:{QB:"Aaron Rodgers",RB:"Jaylen Warren",WR:"DK Metcalf",DEF:"T.J. Watt"} },
  { abbr:"HOU", city:"Houston", name:"Texans", conf:"AFC", div:"South", climate:"dome", market:"large", c1:"#03202F", c2:"#A71930", stars:{QB:"C.J. Stroud",RB:"Joe Mixon",WR:"Nico Collins",DEF:"Will Anderson Jr."} },
  { abbr:"IND", city:"Indianapolis", name:"Colts", conf:"AFC", div:"South", climate:"dome", market:"mid", c1:"#002C5F", c2:"#A2AAAD", stars:{QB:"Daniel Jones",RB:"Jonathan Taylor",WR:"Michael Pittman Jr.",DEF:"Kwity Paye"} },
  { abbr:"JAX", city:"Jacksonville", name:"Jaguars", conf:"AFC", div:"South", climate:"warm", market:"small", c1:"#006778", c2:"#D7A22A", stars:{QB:"Trevor Lawrence",RB:"Travis Etienne",WR:"Brian Thomas Jr.",DEF:"Josh Hines-Allen"} },
  { abbr:"TEN", city:"Tennessee", name:"Titans", conf:"AFC", div:"South", climate:"mild", market:"mid", c1:"#4B92DB", c2:"#0C2340", stars:{QB:"Cam Ward",RB:"Tony Pollard",WR:"Calvin Ridley",DEF:"Jeffery Simmons"} },
  { abbr:"KC", city:"Kansas City", name:"Chiefs", conf:"AFC", div:"West", climate:"cold", market:"mid", c1:"#E31837", c2:"#FFB81C", stars:{QB:"Patrick Mahomes",RB:"Isiah Pacheco",WR:"Xavier Worthy",DEF:"Chris Jones"} },
  { abbr:"LAC", city:"Los Angeles", name:"Chargers", conf:"AFC", div:"West", climate:"warm", market:"mega", c1:"#0080C6", c2:"#FFC20E", stars:{QB:"Justin Herbert",RB:"Omarion Hampton",WR:"Ladd McConkey",DEF:"Khalil Mack"} },
  { abbr:"DEN", city:"Denver", name:"Broncos", conf:"AFC", div:"West", climate:"cold", market:"mid", c1:"#FB4F14", c2:"#002244", stars:{QB:"Bo Nix",RB:"J.K. Dobbins",WR:"Courtland Sutton",DEF:"Patrick Surtain II"} },
  { abbr:"LV", city:"Las Vegas", name:"Raiders", conf:"AFC", div:"West", climate:"dome", market:"mid", c1:"#000000", c2:"#A5ACAF", stars:{QB:"Geno Smith",RB:"Ashton Jeanty",WR:"Jakobi Meyers",DEF:"Maxx Crosby"} },
  { abbr:"DAL", city:"Dallas", name:"Cowboys", conf:"NFC", div:"East", climate:"dome", market:"mega", c1:"#041E42", c2:"#869397", stars:{QB:"Dak Prescott",RB:"Javonte Williams",WR:"CeeDee Lamb",DEF:"DaRon Bland"} },
  { abbr:"PHI", city:"Philadelphia", name:"Eagles", conf:"NFC", div:"East", climate:"cold", market:"large", c1:"#004C54", c2:"#A5ACAF", stars:{QB:"Jalen Hurts",RB:"Saquon Barkley",WR:"A.J. Brown",DEF:"Zack Baun"} },
  { abbr:"NYG", city:"New York", name:"Giants", conf:"NFC", div:"East", climate:"cold", market:"mega", c1:"#0B2265", c2:"#A71930", stars:{QB:"Jaxson Dart",RB:"Tyrone Tracy Jr.",WR:"Malik Nabers",DEF:"Brian Burns"} },
  { abbr:"WAS", city:"Washington", name:"Commanders", conf:"NFC", div:"East", climate:"cold", market:"large", c1:"#5A1414", c2:"#FFB612", stars:{QB:"Jayden Daniels",RB:"Austin Ekeler",WR:"Terry McLaurin",DEF:"Frankie Luvu"} },
  { abbr:"DET", city:"Detroit", name:"Lions", conf:"NFC", div:"North", climate:"dome", market:"large", c1:"#0076B6", c2:"#B0B7BC", stars:{QB:"Jared Goff",RB:"Jahmyr Gibbs",WR:"Amon-Ra St. Brown",DEF:"Aidan Hutchinson"} },
  { abbr:"GB", city:"Green Bay", name:"Packers", conf:"NFC", div:"North", climate:"cold", market:"small", c1:"#203731", c2:"#FFB612", stars:{QB:"Jordan Love",RB:"Josh Jacobs",WR:"Jayden Reed",DEF:"Micah Parsons"} },
  { abbr:"MIN", city:"Minnesota", name:"Vikings", conf:"NFC", div:"North", climate:"dome", market:"mid", c1:"#4F2683", c2:"#FFC62F", stars:{QB:"J.J. McCarthy",RB:"Aaron Jones",WR:"Justin Jefferson",DEF:"Andrew Van Ginkel"} },
  { abbr:"CHI", city:"Chicago", name:"Bears", conf:"NFC", div:"North", climate:"cold", market:"mega", c1:"#0B162A", c2:"#C83803", stars:{QB:"Caleb Williams",RB:"D'Andre Swift",WR:"DJ Moore",DEF:"Montez Sweat"} },
  { abbr:"TB", city:"Tampa Bay", name:"Buccaneers", conf:"NFC", div:"South", climate:"warm", market:"mid", c1:"#D50A0A", c2:"#34302B", stars:{QB:"Baker Mayfield",RB:"Bucky Irving",WR:"Mike Evans",DEF:"Vita Vea"} },
  { abbr:"ATL", city:"Atlanta", name:"Falcons", conf:"NFC", div:"South", climate:"dome", market:"large", c1:"#A71930", c2:"#000000", stars:{QB:"Michael Penix Jr.",RB:"Bijan Robinson",WR:"Drake London",DEF:"Jessie Bates III"} },
  { abbr:"CAR", city:"Carolina", name:"Panthers", conf:"NFC", div:"South", climate:"mild", market:"mid", c1:"#0085CA", c2:"#101820", stars:{QB:"Bryce Young",RB:"Chuba Hubbard",WR:"Xavier Legette",DEF:"Derrick Brown"} },
  { abbr:"NO", city:"New Orleans", name:"Saints", conf:"NFC", div:"South", climate:"dome", market:"mid", c1:"#D3BC8D", c2:"#101820", stars:{QB:"Tyler Shough",RB:"Alvin Kamara",WR:"Chris Olave",DEF:"Cameron Jordan"} },
  { abbr:"SF", city:"San Francisco", name:"49ers", conf:"NFC", div:"West", climate:"mild", market:"large", c1:"#AA0000", c2:"#B3995D", stars:{QB:"Brock Purdy",RB:"Christian McCaffrey",WR:"Ricky Pearsall",DEF:"Fred Warner"} },
  { abbr:"SEA", city:"Seattle", name:"Seahawks", conf:"NFC", div:"West", climate:"mild", market:"mid", c1:"#002244", c2:"#69BE28", stars:{QB:"Sam Darnold",RB:"Kenneth Walker III",WR:"Jaxon Smith-Njigba",DEF:"Leonard Williams"} },
  { abbr:"LAR", city:"Los Angeles", name:"Rams", conf:"NFC", div:"West", climate:"warm", market:"mega", c1:"#003594", c2:"#FFA300", stars:{QB:"Matthew Stafford",RB:"Kyren Williams",WR:"Puka Nacua",DEF:"Jared Verse"} },
  { abbr:"ARI", city:"Arizona", name:"Cardinals", conf:"NFC", div:"West", climate:"warm", market:"mid", c1:"#97233F", c2:"#000000", stars:{QB:"Kyler Murray",RB:"James Conner",WR:"Marvin Harrison Jr.",DEF:"Budda Baker"} },
];


export { CAP, TEAM_META };
