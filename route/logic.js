/* Week Router logic. Runs entirely on the device; no network calls here. */
(function(root){
"use strict";

/* ---------------- dates ---------------- */
const pad = n => String(n).padStart(2,"0");
const isoDay = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromISO = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const addDays = (iso,n) => { const d = fromISO(iso); d.setDate(d.getDate()+n); return isoDay(d); };
function mondayOf(iso){ const d = fromISO(iso); const k = (d.getDay()+6)%7; d.setDate(d.getDate()-k); return isoDay(d); }
const weekDays = mon => [0,1,2,3,4].map(i => addDays(mon,i));
const dow = iso => fromISO(iso).getDay(); // 1..5 Mon..Fri

/* ---------------- geography (approximate city centers) ---------------- */
/* Northern California towns (approximate centers). Built from the open US Cities Database (MIT license, github.com/kelvins/US-Cities-Database), plus a few added by hand. */
const CITIES = {
 "acampo":[38.2,-121.219],"adin":[41.218,-120.943],"ahwahnee":[37.408,-119.723],"alameda":[37.765,-122.242],"alamo":[37.85,-122.032],"albany":[37.887,-122.298],
 "albion":[39.216,-123.721],"alderpoint":[40.176,-123.611],"alleghany":[39.513,-120.727],"alpaugh":[35.888,-119.486],"alta":[39.228,-120.773],"altaville":[38.077,-120.552],
 "alturas":[41.477,-120.546],"alviso":[37.428,-121.969],"amador city":[38.419,-120.823],"american canyon":[38.175,-122.26],"anderson":[40.457,-122.328],"angels camp":[38.064,-120.554],
 "angwin":[38.577,-122.448],"annapolis":[38.714,-123.314],"antelope":[38.708,-121.329],"antioch":[38.005,-121.806],"applegate":[38.995,-120.991],"aptos":[36.977,-121.898],
 "arbuckle":[39.014,-122.027],"arcata":[40.867,-124.082],"armona":[36.309,-119.705],"arnold":[38.242,-120.342],"aromas":[36.879,-121.64],"artois":[39.62,-122.193],
 "atherton":[37.456,-122.2],"atwater":[37.348,-120.609],"auberry":[37.073,-119.457],"auburn":[38.983,-121.094],"avenal":[35.988,-120.123],"avery":[38.204,-120.369],
 "badger":[36.631,-119.012],"ballico":[37.452,-120.7],"bangor":[39.425,-121.35],"bass lake":[37.324,-119.557],"bay point":[38.029,-121.962],"bayside":[40.822,-124.027],
 "beale afb":[39.146,-121.59],"beckwourth":[39.82,-120.378],"belden":[39.922,-121.326],"bella vista":[40.741,-122.072],"belmont":[37.517,-122.293],"belvedere":[37.873,-122.464],
 "belvedere tiburon":[37.89,-122.473],"ben lomond":[37.086,-122.084],"benicia":[38.049,-122.159],"benton":[37.798,-118.499],"berkeley":[37.872,-122.273],"berry creek":[39.638,-121.385],
 "bethel island":[38.015,-121.639],"bieber":[41.121,-121.143],"big bar":[40.748,-123.229],"big bend":[41.021,-121.91],"big creek":[37.205,-119.245],"big oak flat":[37.824,-120.257],
 "big pine":[37.168,-118.292],"big sur":[36.246,-121.701],"biggs":[39.415,-121.696],"biola":[36.802,-120.015],"birds landing":[38.15,-121.844],"bishop":[37.386,-118.442],
 "blairsden graeagle":[39.785,-120.627],"blocksburg":[40.276,-123.635],"blue lake":[40.929,-123.897],"bodega":[38.339,-122.951],"bodega bay":[38.331,-123.037],"bolinas":[37.908,-122.695],
 "boonville":[39.035,-123.402],"boulder creek":[37.15,-122.133],"boyes hot springs":[38.314,-122.481],"bradley":[35.809,-120.973],"branscomb":[39.701,-123.555],"brentwood":[37.932,-121.696],
 "bridgeport":[38.257,-119.208],"bridgeville":[40.469,-123.549],"brisbane":[37.681,-122.4],"brookdale":[37.106,-122.105],"brooks":[38.739,-122.133],"browns valley":[39.284,-121.346],
 "brownsville":[39.453,-121.261],"burlingame":[37.584,-122.366],"burney":[40.895,-121.655],"burnt ranch":[40.772,-123.461],"burrel":[36.488,-119.984],"burson":[38.184,-120.889],
 "butte city":[39.456,-121.978],"byron":[37.903,-121.602],"california hot springs":[35.892,-118.646],"calistoga":[38.582,-122.581],"callahan":[41.383,-122.764],"calpella":[39.15,-123.207],
 "calpine":[39.652,-120.444],"cameron park":[38.669,-120.987],"camino":[38.745,-120.672],"camp meeker":[38.425,-122.958],"camp nelson":[36.13,-118.817],"campbell":[37.28,-121.955],
 "campo seco":[38.227,-120.852],"camptonville":[39.451,-121.023],"canby":[41.466,-120.922],"cantua creek":[36.492,-120.335],"canyon":[37.832,-122.187],"canyon dam":[40.208,-121.156],
 "capay":[38.697,-122.101],"capitola":[36.977,-121.952],"carlotta":[40.507,-123.974],"carmel":[36.448,-121.84],"carmel by the sea":[36.555,-121.92],"carmel valley":[36.479,-121.724],
 "carmichael":[38.628,-121.329],"carnelian bay":[39.232,-120.075],"caruthers":[36.536,-119.845],"caspar":[39.365,-123.798],"cassel":[40.908,-121.524],"castella":[41.139,-122.317],
 "castro valley":[37.694,-122.086],"castroville":[36.771,-121.747],"catheys valley":[37.441,-120.069],"cazadero":[38.566,-123.183],"cedar ridge":[39.199,-121.02],"cedarville":[41.476,-120.152],
 "ceres":[37.595,-120.958],"challenge":[39.487,-121.222],"chester":[40.297,-121.227],"chicago park":[39.145,-120.966],"chico":[39.756,-121.852],"chilcoot":[39.806,-120.175],
 "chinese camp":[37.857,-120.407],"chowchilla":[37.101,-120.269],"chualar":[36.595,-121.432],"citrus heights":[38.695,-121.269],"clarksburg":[38.396,-121.557],"clayton":[37.941,-121.936],
 "clearlake":[38.957,-122.636],"clearlake oaks":[39.035,-122.669],"clearlake park":[38.968,-122.654],"clements":[38.191,-121.087],"clio":[39.743,-120.56],"clipper mills":[39.533,-121.156],
 "cloverdale":[38.799,-123.012],"clovis":[36.824,-119.682],"coalinga":[36.162,-120.349],"coarsegold":[37.221,-119.746],"cobb":[38.822,-122.722],"coleville":[38.503,-119.483],
 "colfax":[39.077,-120.96],"colma":[37.677,-122.46],"coloma":[38.8,-120.889],"columbia":[38.04,-120.406],"colusa":[39.213,-122.012],"comptche":[39.25,-123.586],
 "concord":[37.978,-122.031],"cool":[38.904,-120.973],"copperopolis":[37.937,-120.638],"corcoran":[36.086,-119.561],"corning":[39.93,-122.196],"corralitos":[36.989,-121.806],
 "corte madera":[37.922,-122.513],"cotati":[38.326,-122.705],"cottonwood":[40.369,-122.337],"coulterville":[37.739,-119.986],"courtland":[38.306,-121.554],"covelo":[39.802,-123.215],
 "coyote":[37.217,-121.746],"crescent city":[41.785,-124.178],"crescent mills":[40.082,-120.882],"cressey":[37.42,-120.666],"crockett":[38.052,-122.218],"crows landing":[37.439,-121.02],
 "cupertino":[37.317,-122.039],"cutler":[36.524,-119.287],"cutten":[40.77,-124.142],"daly city":[37.688,-122.47],"danville":[37.822,-121.999],"dardanelle":[38.341,-119.833],
 "darwin":[36.268,-117.591],"davenport":[37.063,-122.226],"davis":[38.555,-121.748],"davis creek":[41.863,-120.324],"death valley":[36.467,-116.894],"deer park":[38.576,-122.449],
 "del rey":[36.654,-119.593],"del rey oaks":[36.593,-121.835],"delhi":[37.429,-120.775],"denair":[37.538,-120.796],"diablo":[37.839,-121.961],"diamond springs":[38.663,-120.836],
 "dillon beach":[38.251,-122.964],"dinuba":[36.535,-119.391],"discovery bay":[37.909,-121.6],"dixon":[38.459,-121.816],"dobbins":[39.371,-121.234],"dorris":[41.968,-121.917],
 "dos palos":[37.003,-120.633],"dos rios":[39.709,-123.298],"douglas city":[40.634,-122.924],"douglas flat":[38.087,-120.472],"downieville":[39.57,-120.678],"doyle":[40.001,-120.108],
 "drytown":[38.393,-120.801],"dublin":[37.702,-121.936],"ducor":[35.892,-119.046],"duncans mills":[38.454,-123.054],"dunlap":[36.745,-119.09],"dunnigan":[38.894,-121.997],
 "dunsmuir":[41.212,-122.273],"durham":[39.642,-121.792],"dutch flat":[39.198,-120.826],"eagleville":[41.316,-120.115],"earlimart":[35.854,-119.253],"east palo alto":[37.469,-122.141],
 "echo lake":[38.81,-120.07],"el cerrito":[37.916,-122.311],"el dorado":[38.683,-120.847],"el dorado hills":[38.685,-121.069],"el granada":[37.503,-122.468],"el nido":[37.135,-120.483],
 "el portal":[37.675,-119.783],"el sobrante":[37.977,-122.295],"el verano":[38.298,-122.491],"eldridge":[38.349,-122.51],"elk":[39.16,-123.724],"elk creek":[39.599,-122.557],
 "elk grove":[38.409,-121.372],"elmira":[38.348,-121.909],"elverta":[38.716,-121.431],"emerald hills":[37.463,-122.264],"emeryville":[37.831,-122.285],"emigrant gap":[39.287,-120.663],
 "empire":[37.638,-120.901],"escalon":[37.797,-120.998],"esparto":[38.694,-122.021],"etna":[41.468,-122.914],"eureka":[40.776,-124.156],"exeter":[36.304,-119.129],
 "fair oaks":[38.655,-121.261],"fairfax":[37.988,-122.594],"fairfield":[38.249,-122.04],"fall river mills":[41.039,-121.461],"farmersville":[36.3,-119.205],"farmington":[37.945,-120.852],
 "feather falls":[39.593,-121.255],"felton":[37.063,-122.062],"ferndale":[40.574,-124.252],"fiddletown":[38.531,-120.716],"fields landing":[40.725,-124.214],"finley":[39.004,-122.874],
 "firebaugh":[36.865,-120.47],"fish camp":[37.517,-119.642],"five points":[36.429,-120.102],"floriston":[39.446,-120.025],"flournoy":[39.921,-122.435],"folsom":[38.688,-121.141],
 "forbestown":[39.542,-121.213],"forest knolls":[38.012,-122.691],"forest ranch":[40.13,-121.5],"foresthill":[39.002,-120.861],"forestville":[38.489,-122.897],"forks of salmon":[41.257,-123.098],
 "fort bidwell":[41.864,-120.162],"fort bragg":[39.437,-123.788],"fort dick":[41.838,-124.166],"fort jones":[41.617,-122.883],"fortuna":[40.585,-124.141],"foster city":[37.559,-122.271],
 "fowler":[36.628,-119.671],"freedom":[36.936,-121.777],"fremont":[37.548,-121.989],"french camp":[37.878,-121.283],"french gulch":[40.704,-122.623],"fresno":[36.841,-119.8],
 "friant":[37.002,-119.697],"fulton":[38.495,-122.776],"galt":[38.255,-121.3],"garberville":[40.1,-123.794],"garden valley":[38.866,-120.857],"gasquet":[41.863,-123.912],
 "gazelle":[41.51,-122.537],"georgetown":[38.92,-120.793],"gerber":[40.043,-122.165],"geyserville":[38.7,-122.889],"gilroy":[37.016,-121.578],"glen ellen":[38.363,-122.521],
 "glencoe":[38.352,-120.595],"glenhaven":[38.99,-122.522],"glenn":[39.607,-122.038],"gold run":[39.175,-120.857],"gonzales":[36.49,-121.41],"goodyears bar":[39.573,-120.821],
 "goshen":[36.351,-119.419],"granite bay":[38.744,-121.19],"grass valley":[39.208,-121.037],"graton":[38.435,-122.867],"greenbrae":[37.951,-122.536],"greenfield":[36.32,-121.245],
 "greenview":[41.551,-122.904],"greenville":[40.142,-120.927],"greenwood":[38.936,-120.917],"grenada":[41.613,-122.526],"gridley":[39.359,-121.69],"grimes":[39.074,-121.893],
 "grizzly flats":[38.629,-120.543],"groveland":[37.841,-120.192],"gualala":[38.804,-123.554],"guerneville":[38.51,-122.994],"guinda":[38.817,-122.19],"gustine":[37.242,-121.004],
 "half moon bay":[37.479,-122.446],"hamilton city":[39.743,-122.013],"hanford":[36.331,-119.649],"happy camp":[41.802,-123.388],"hat creek":[40.768,-121.464],"hathaway pines":[38.192,-120.364],
 "hayfork":[40.55,-123.163],"hayward":[37.669,-122.081],"healdsburg":[38.616,-122.857],"helm":[36.499,-120.094],"herald":[38.313,-121.159],"hercules":[38.017,-122.289],
 "herlong":[40.148,-120.171],"hickman":[37.62,-120.717],"hidden valley lake":[39.963,-123.815],"hillsborough":[37.574,-122.379],"hilmar":[37.408,-120.856],"hollister":[36.848,-121.387],
 "holt":[37.934,-121.426],"holy city":[37.157,-121.978],"homewood":[39.078,-120.179],"honeydew":[40.244,-124.122],"hood":[38.368,-121.516],"hoopa":[41.106,-123.693],
 "hopland":[38.972,-123.117],"hornbrook":[41.908,-122.527],"hornitos":[37.492,-120.226],"hughson":[37.594,-120.865],"hume":[36.785,-118.913],"huron":[36.237,-120.102],
 "hyampom":[40.617,-123.451],"hydesville":[40.55,-124.084],"igo":[40.432,-122.654],"independence":[36.84,-118.205],"inverness":[38.084,-122.857],"ione":[38.352,-120.943],
 "isleton":[38.155,-121.605],"ivanhoe":[36.386,-119.219],"jackson":[38.358,-120.755],"jamestown":[37.907,-120.495],"janesville":[40.296,-120.51],"jenner":[38.474,-123.135],
 "jolon":[35.971,-121.175],"junction city":[40.768,-123.063],"june lake":[37.777,-119.082],"kaweah":[36.47,-118.918],"keeler":[36.487,-117.873],"kelseyville":[38.946,-122.782],
 "kentfield":[37.952,-122.556],"kenwood":[38.417,-122.555],"kerman":[36.731,-120.072],"kettleman city":[36.022,-119.964],"keyes":[37.557,-120.914],"king city":[36.203,-121.127],
 "kings beach":[39.24,-120.023],"kings canyon national pk":[36.781,-119.068],"kingsburg":[36.508,-119.543],"kirkwood":[38.703,-120.072],"kit carson":[38.432,-120.571],"klamath":[41.542,-124.034],
 "klamath river":[41.864,-122.82],"kneeland":[40.713,-123.946],"knights landing":[38.822,-121.72],"knightsen":[37.982,-121.672],"korbel":[40.824,-123.859],"kyburz":[38.78,-120.255],
 "la grange":[37.679,-120.358],"la honda":[37.272,-122.294],"la selva beach":[36.937,-121.864],"ladera":[37.4,-122.199],"lafayette":[37.886,-122.118],"laguna":[38.421,-121.424],
 "lagunitas":[38.014,-122.702],"lake city":[41.668,-120.181],"lakehead":[40.959,-122.359],"lakeport":[39.055,-122.915],"lakeshore":[37.253,-119.174],"larkspur":[37.937,-122.536],
 "lathrop":[37.823,-121.276],"laton":[36.438,-119.716],"laytonville":[39.668,-123.487],"le grand":[37.234,-120.252],"lee vining":[37.989,-119.123],"leggett":[39.866,-123.713],
 "lemon cove":[36.396,-119.005],"lemoore":[36.31,-119.831],"lewiston":[40.746,-122.843],"likely":[41.231,-120.503],"lincoln":[38.904,-121.296],"linden":[38.022,-121.074],
 "lindsay":[36.21,-119.088],"litchfield":[40.363,-120.254],"little lake":[35.937,-117.906],"little river":[39.271,-123.753],"live oak":[39.267,-121.664],"livermore":[37.682,-121.768],
 "livingston":[37.387,-120.724],"lockeford":[38.162,-121.136],"lockwood":[35.989,-121.206],"lodi":[38.13,-121.272],"loleta":[40.653,-124.229],"loma mar":[37.254,-122.282],
 "lone pine":[36.58,-118.058],"long barn":[38.203,-120.001],"lookout":[41.208,-121.154],"loomis":[38.807,-121.17],"los altos":[37.381,-122.126],"los altos hills":[37.38,-122.138],
 "los banos":[37.058,-120.85],"los gatos":[37.183,-121.98],"los molinos":[40.05,-122.099],"lotus":[38.802,-120.929],"lower lake":[38.861,-122.575],"loyalton":[39.663,-120.23],
 "lucerne":[39.083,-122.785],"macdoel":[41.883,-121.944],"mad river":[40.352,-123.414],"madeline":[41.051,-120.474],"madera":[36.953,-119.881],"madison":[38.68,-121.972],
 "magalia":[39.832,-121.597],"mammoth lakes":[37.642,-118.976],"manchester":[38.992,-123.671],"manteca":[37.797,-121.216],"manton":[40.433,-121.837],"marina":[36.685,-121.793],
 "mariposa":[37.504,-119.892],"markleeville":[38.765,-119.807],"marshall":[38.176,-122.89],"martell":[38.367,-120.795],"martinez":[38.019,-122.134],"marysville":[39.142,-121.522],
 "mather":[38.549,-121.282],"maxwell":[39.292,-122.195],"mcarthur":[41.111,-121.215],"mcclellan":[38.655,-121.403],"mccloud":[41.252,-122.136],"mckinleyville":[40.876,-124.083],
 "meadow valley":[39.918,-121.056],"meadow vista":[39.003,-121.029],"mendocino":[39.323,-123.788],"mendota":[36.742,-120.409],"menlo park":[37.453,-122.179],"merced":[37.302,-120.483],
 "meridian":[39.117,-121.881],"mi wuk village":[38.106,-120.132],"middletown":[38.783,-122.644],"midpines":[37.571,-119.947],"milford":[40.183,-120.39],"mill creek":[40.326,-121.522],
 "mill valley":[37.896,-122.534],"millbrae":[37.6,-122.402],"millville":[40.565,-122.111],"milpitas":[37.428,-121.907],"mineral":[40.329,-121.525],"miramonte":[36.689,-119.048],
 "miranda":[40.235,-123.823],"moccasin":[37.811,-120.299],"modesto":[37.639,-120.997],"mokelumne hill":[38.329,-120.568],"mono hot springs":[37.168,-119.21],"montague":[41.724,-122.464],
 "montara":[37.542,-122.515],"monte rio":[38.463,-123.004],"monte sereno":[37.236,-121.992],"monterey":[36.596,-121.885],"montgomery creek":[40.912,-121.923],"moraga":[37.835,-122.13],
 "morgan hill":[37.129,-121.646],"moss beach":[37.531,-122.507],"moss landing":[36.804,-121.786],"mount aukum":[38.55,-120.73],"mount hamilton":[37.316,-121.64],"mount hermon":[37.051,-122.058],
 "mount shasta":[41.317,-122.324],"mountain house":[37.783,-121.543],"mountain ranch":[38.22,-120.548],"mountain view":[37.386,-122.084],"murphys":[38.127,-120.462],"myers flat":[40.195,-123.823],
 "napa":[38.297,-122.287],"natomas":[38.648,-121.513],"navarro":[39.066,-123.444],"nelson":[39.552,-121.764],"nevada city":[39.275,-121.02],"new almaden":[37.176,-121.82],
 "newark":[37.53,-122.04],"newcastle":[38.872,-121.143],"newman":[37.314,-121.021],"nicasio":[38.055,-122.696],"nice":[39.122,-122.842],"nicolaus":[38.883,-121.553],
 "norden":[39.32,-120.401],"north fork":[37.213,-119.514],"north highlands":[38.689,-121.375],"north san juan":[39.354,-121.135],"novato":[38.116,-122.571],"nubieber":[41.096,-121.182],
 "o neals":[37.087,-119.745],"oak run":[40.686,-122.041],"oakdale":[37.767,-120.847],"oakhurst":[37.348,-119.645],"oakland":[37.804,-122.271],"oakley":[37.997,-121.712],
 "oakville":[38.437,-122.401],"obrien":[40.812,-122.323],"occidental":[38.397,-122.988],"olancha":[36.321,-118.026],"old station":[40.626,-121.458],"olema":[38.041,-122.787],
 "olivehurst":[39.089,-121.55],"olympic valley":[39.156,-120.215],"orange cove":[36.624,-119.314],"orangevale":[38.682,-121.223],"oregon house":[39.314,-121.209],"orick":[41.307,-124.05],
 "orinda":[37.877,-122.18],"orland":[39.745,-122.158],"orleans":[41.318,-123.53],"orosi":[36.546,-119.282],"oroville":[39.533,-121.578],"pacific grove":[36.617,-121.922],
 "pacifica":[37.62,-122.482],"paicines":[36.495,-121.033],"palermo":[39.436,-121.545],"palo alto":[37.442,-122.143],"palo cedro":[40.577,-122.24],"paradise":[39.746,-121.636],
 "parlier":[36.61,-119.537],"paskenta":[39.885,-122.545],"patterson":[37.472,-121.13],"paynes creek":[40.351,-121.765],"pebble beach":[36.591,-121.942],"penn valley":[39.219,-121.194],
 "penngrove":[38.316,-122.672],"penryn":[38.857,-121.179],"pescadero":[37.207,-122.365],"petaluma":[38.24,-122.678],"petrolia":[40.301,-124.251],"phillipsville":[40.209,-123.785],
 "philo":[39.12,-123.538],"piedmont":[37.824,-122.232],"piedra":[36.81,-119.381],"piercy":[39.966,-123.794],"pilot hill":[38.826,-121.03],"pine grove":[38.397,-120.644],
 "pinecrest":[38.341,-119.865],"pinole":[38.004,-122.299],"pioneer":[38.46,-120.532],"pittsburg":[38.028,-121.885],"pixley":[35.955,-119.256],"placerville":[38.719,-120.805],
 "planada":[37.291,-120.317],"platina":[40.317,-122.918],"pleasant grove":[38.788,-121.508],"pleasant hill":[37.948,-122.061],"pleasanton":[37.662,-121.875],"plymouth":[38.488,-120.87],
 "point arena":[38.915,-123.661],"point reyes station":[38.065,-122.816],"pollock pines":[38.746,-120.585],"pope valley":[38.678,-122.472],"port costa":[38.046,-122.187],"porterville":[36.069,-119.032],
 "portola":[39.811,-120.467],"portola valley":[37.384,-122.235],"portola vally":[37.379,-122.208],"posey":[35.813,-118.664],"potter valley":[39.33,-123.104],"prather":[36.994,-119.527],
 "princeton":[39.428,-122.03],"proberta":[40.082,-122.169],"prunedale":[36.776,-121.67],"quincy":[39.941,-120.928],"rackerby":[39.406,-121.336],"rail road flat":[38.343,-120.511],
 "raisin city":[36.599,-119.903],"rancho cordova":[38.602,-121.289],"ravendale":[40.832,-120.16],"raymond":[37.279,-119.877],"red bluff":[40.18,-122.238],"redcrest":[40.406,-123.942],
 "redding":[40.56,-122.412],"redway":[40.11,-123.844],"redwood city":[37.485,-122.236],"redwood estates":[37.156,-121.986],"redwood valley":[39.269,-123.213],"reedley":[36.604,-119.438],
 "represa":[38.688,-121.448],"rescue":[38.719,-120.995],"richgrove":[35.797,-119.107],"richmond":[37.936,-122.348],"richvale":[39.494,-121.744],"rio dell":[40.495,-124.104],
 "rio linda":[38.689,-121.445],"rio nido":[38.521,-122.976],"rio oso":[38.961,-121.505],"rio vista":[38.164,-121.702],"ripon":[37.742,-121.124],"river pines":[38.546,-120.743],
 "riverbank":[37.736,-120.935],"riverdale":[36.43,-119.872],"robbins":[38.87,-121.705],"rocklin":[38.792,-121.243],"rodeo":[38.033,-122.267],"rohnert park":[38.327,-122.706],
 "roseville":[38.735,-121.234],"ross":[37.962,-122.554],"rough and ready":[39.229,-121.151],"round mountain":[40.794,-121.941],"rumsey":[38.876,-122.254],"rutherford":[38.459,-122.421],
 "ryde":[38.239,-121.559],"sacramento":[38.582,-121.494],"saint helena":[38.514,-122.462],"salida":[37.707,-121.09],"salinas":[36.668,-121.66],"salyer":[40.891,-123.548],
 "samoa":[40.804,-124.194],"san andreas":[38.187,-120.669],"san anselmo":[37.985,-122.571],"san ardo":[35.986,-120.861],"san bruno":[37.625,-122.429],"san carlos":[37.497,-122.267],
 "san francisco":[37.775,-122.419],"san geronimo":[38.017,-122.678],"san gregorio":[37.326,-122.356],"san joaquin":[36.606,-120.189],"san jose":[37.338,-121.886],"san juan bautista":[36.85,-121.533],
 "san leandro":[37.725,-122.156],"san lorenzo":[37.681,-122.124],"san lucas":[36.129,-121.019],"san martin":[37.091,-121.6],"san mateo":[37.563,-122.326],"san pablo":[37.962,-122.346],
 "san quentin":[37.943,-122.489],"san rafael":[37.969,-122.511],"san ramon":[37.78,-121.978],"sand city":[36.617,-121.848],"sanger":[36.724,-119.548],"santa clara":[37.354,-121.955],
 "santa cruz":[36.983,-122.044],"santa rita park":[37.047,-120.594],"santa rosa":[38.443,-122.752],"saratoga":[37.273,-122.018],"sausalito":[37.86,-122.495],"scotia":[40.455,-124.039],
 "scott bar":[41.774,-122.988],"scotts valley":[37.058,-122.015],"seaside":[36.609,-121.836],"sebastopol":[38.392,-122.839],"seiad valley":[41.887,-123.244],"selma":[36.57,-119.617],
 "sequoia national park":[36.574,-118.772],"shasta":[40.611,-122.497],"shasta lake":[40.68,-122.365],"shaver lake":[37.14,-119.273],"sheep ranch":[38.209,-120.463],"sheridan":[38.992,-121.362],
 "shingle springs":[38.666,-120.976],"shingletown":[40.505,-121.886],"shoshone":[35.899,-116.264],"sierra city":[39.559,-120.624],"sierraville":[39.594,-120.348],"sloughhouse":[38.507,-121.094],
 "smartville":[39.204,-121.267],"smith river":[41.936,-124.166],"snelling":[37.514,-120.482],"soda springs":[39.338,-120.465],"soledad":[36.42,-121.324],"somerset":[38.607,-120.666],
 "somes bar":[41.433,-123.476],"sonoma":[38.296,-122.473],"sonora":[37.984,-120.382],"soquel":[37.004,-121.95],"soulsbyville":[37.993,-120.26],"south dos palos":[36.964,-120.652],
 "south lake tahoe":[38.917,-119.986],"south san francisco":[37.654,-122.408],"spreckels":[36.622,-121.646],"springville":[36.136,-118.796],"squaw valley":[36.707,-119.181],"st helena":[38.514,-122.462],
 "standard":[37.984,-120.381],"standish":[40.351,-120.407],"stanford":[37.424,-122.162],"stevinson":[37.326,-120.87],"stewarts point":[38.652,-123.398],"stinson beach":[37.902,-122.639],
 "stirling city":[39.908,-121.527],"stockton":[37.958,-121.291],"stonyford":[39.334,-122.518],"storrie":[39.514,-121.555],"stratford":[36.179,-119.824],"strathmore":[36.147,-119.079],
 "strawberry":[38.202,-119.998],"strawberry valley":[39.604,-121.075],"suisun city":[38.241,-122.042],"sultana":[36.546,-119.339],"sunnyvale":[37.369,-122.036],"sunol":[37.609,-121.899],
 "susanville":[40.416,-120.652],"sutter":[39.168,-121.757],"sutter creek":[38.419,-120.785],"tahoe city":[39.181,-120.145],"tahoe vista":[39.245,-120.052],"tahoma":[39.064,-120.136],
 "talmage":[39.131,-123.165],"taylorsville":[40.065,-120.802],"tecopa":[35.898,-115.83],"tehama":[40.027,-122.122],"termo":[40.947,-120.517],"terra bella":[35.957,-119.031],
 "the sea ranch":[38.726,-123.467],"thornton":[38.226,-121.424],"three rivers":[36.438,-118.888],"tiburon":[37.873,-122.457],"tipton":[36.055,-119.308],"tollhouse":[36.994,-119.391],
 "tomales":[38.246,-122.904],"topaz":[38.642,-119.512],"tracy":[37.74,-121.425],"tranquillity":[36.658,-120.262],"traver":[36.455,-119.484],"travis afb":[38.274,-121.946],
 "tres pinos":[36.79,-121.32],"trinidad":[41.088,-124.101],"trinity center":[41.062,-122.724],"truckee":[39.328,-120.182],"tulare":[36.202,-119.338],"tulelake":[41.932,-121.435],
 "tuolumne":[37.971,-120.237],"turlock":[37.495,-120.847],"twain":[40.003,-121.151],"twain harte":[38.045,-120.216],"twin bridges":[38.809,-120.129],"ukiah":[39.152,-123.201],
 "union city":[37.596,-122.044],"upper lake":[39.161,-122.896],"vacaville":[38.357,-121.988],"vallecito":[38.101,-120.468],"vallejo":[38.104,-122.257],"valley ford":[38.316,-122.924],
 "valley springs":[38.154,-120.86],"vernalis":[37.618,-121.259],"victor":[38.138,-121.205],"villa grande":[38.473,-123.024],"vina":[39.933,-122.053],"vineburg":[38.273,-122.438],
 "vinton":[39.721,-120.205],"visalia":[36.311,-119.306],"volcano":[38.477,-120.618],"wallace":[38.194,-120.977],"walnut creek":[37.906,-122.065],"walnut grove":[38.236,-121.525],
 "washington":[39.359,-120.798],"waterford":[37.651,-120.754],"watsonville":[36.921,-121.763],"waukena":[36.098,-119.559],"weaverville":[40.732,-122.935],"weed":[41.439,-122.385],
 "weimar":[39.038,-120.971],"wendel":[40.346,-120.352],"weott":[40.322,-123.921],"west point":[38.406,-120.516],"west sacramento":[38.592,-121.526],"westley":[37.549,-121.198],
 "westport":[39.644,-123.764],"westwood":[40.27,-121.109],"wheatland":[39.019,-121.422],"whiskeytown":[40.639,-122.559],"whitethorn":[40.024,-123.942],"whitmore":[40.653,-121.877],
 "williams":[39.149,-122.162],"willits":[39.411,-123.35],"willow creek":[40.939,-123.631],"willows":[39.524,-122.199],"wilseyville":[38.385,-120.442],"wilton":[38.412,-121.226],
 "windsor":[38.543,-122.804],"winters":[38.529,-121.975],"winton":[37.392,-120.613],"wishon":[37.281,-119.557],"witter springs":[39.182,-122.971],"woodacre":[38.007,-122.638],
 "woodbridge":[38.155,-121.309],"woodlake":[36.431,-119.092],"woodland":[38.674,-121.779],"yettem":[36.486,-119.259],"yolo":[38.732,-121.807],"yorkville":[38.909,-123.234],
 "yosemite national park":[37.747,-119.584],"yountville":[38.404,-122.359],"yreka":[41.721,-122.638],"yuba city":[39.129,-121.622],"zamora":[38.8,-121.907],"zenia":[40.206,-123.491]
};
const cityKey = s => String(s||"").toLowerCase().replace(/[^a-z ]+/g," ").replace(/\s+/g," ").trim();
function cityCoords(city, address){
  const k = cityKey(city);
  if (CITIES[k]) return CITIES[k];
  const hay = " " + cityKey((address||"") + " " + (city||"")) + " ";
  let best = null;
  for (const name in CITIES) if (hay.includes(" "+name+" ") && (!best || name.length > best.length)) best = name;
  return best ? CITIES[best] : null;
}
function km(a,b){
  if (!a || !b) return 0;
  const R=6371, r=Math.PI/180, dLa=(b[0]-a[0])*r, dLo=(b[1]-a[1])*r;
  const h = Math.sin(dLa/2)**2 + Math.cos(a[0]*r)*Math.cos(b[0]*r)*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
}
const ROAD = 1.3; // straight line to road distance
const miles = k => k*ROAD/1.609;

/* ---------------- spreadsheet rows -> offices ---------------- */
const DAYS = {mon:1,tue:2,wed:3,thu:4,fri:5};
function parseAvailability(s){
  s = String(s||"").trim();
  if (!s || /^none$/i.test(s)) return null;
  const out = {days:{}, appt:/appt|appointment/i.test(s), nth:[]};
  const nth = s.match(/\b([1-5])(st|nd|rd|th)\b/gi); if (nth) out.nth = nth.map(x => parseInt(x,10));
  const re = /\b(mon|tue|wed|thu|fri)(?:day|sday|nesday|rsday|s|r|rs)?\b\.?\s*(a\.?m\b\.?|p\.?m\b\.?|\d{1,2}(?::\d\d)?\s*(?:-|–|to)\s*\d{1,2}(?::\d\d)?)?/gi;
  let m;
  while ((m = re.exec(s))){
    const d = DAYS[m[1].toLowerCase()]; let am = true, pm = true; const q = (m[2]||"").toLowerCase().replace(/\./g,"");
    if (q === "am") pm = false;
    else if (q === "pm") am = false;
    else if (q){ const [a,b] = q.split(/-|–|to/).map(x => parseInt(x,10)); const st = a < 7 ? a+12 : a; const en = b < 7 ? b+12 : b; am = st < 12; pm = en > 12 || st >= 12; }
    const cur = out.days[d];
    if (!cur) out.days[d] = {am, pm, q:!!q};
    else if (q) out.days[d] = cur.q ? {am: cur.am || am, pm: cur.pm || pm, q:true} : {am, pm, q:true};
  }
  if (!Object.keys(out.days).length) return null;
  for (const k in out.days) delete out.days[k].q;
  return out;
}
function splitSheetName(raw){
  let s = String(raw||"").replace(/\([^)]*\)?/g," ").replace(/["“”]/g," ").replace(/\b(dr|md|np|pa|do)\b\.?/gi," ").replace(/\s+/g," ").trim();
  let last, first = "";
  if (s.includes(",")){ const [a,b] = s.split(","); last = a.trim(); first = (b||"").trim(); }
  else { const t = s.split(" "); if (t.length > 1){ first = t[0]; last = t.slice(1).join(" "); } else last = s; }
  const U = x => x.toUpperCase().replace(/[^A-Z\- ]+/g,"").trim();
  return {last:U(last), first:U(first).split(" ")[0]||"", display:s};
}
function addressKey(addr, city){
  let a = String(addr||"").toLowerCase().split(",")[0];
  a = a.replace(/\b(ste|suite|unit|bldg|building|fl|floor|rm|room)\b.*$/,"").replace(/#.*$/,"").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
  const t = a.split(" "); let key = a;
  if (/^\d+$/.test(t[0]||"")){ let i = 1; while (i < t.length && /^(n|s|e|w|north|south|east|west)$/.test(t[i])) i++; key = t[0] + " " + (t[i]||""); }
  return key + "|" + cityKey(city);
}
function zipOf(cell, address){
  const c = String(cell||"").match(/\b(\d{5})(?:-\d{4})?\b/); if (c) return c[1];
  const m = String(address||"").match(/(?:,|\bCA\b|\bCalifornia\b)\s*(\d{5})(?:-\d{4})?\s*$/i); return m ? m[1] : "";
}
function officeInZone(o, zone){
  if (!zone) return true;
  if (o.zip && (zone.zips||[]).includes(o.zip)) return true;
  return (zone.cities||[]).includes(cityKey(o.city));
}
/* availability helpers: {days:{1:{am,pm}..5}, appt, nth:[]} */
const ANYTIME = () => ({days:{1:{am:true,pm:true},2:{am:true,pm:true},3:{am:true,pm:true},4:{am:true,pm:true},5:{am:true,pm:true}}, appt:false, nth:[], unknown:true});
const DAY_SHORT = ["","Mon","Tue","Wed","Thu","Fri"];
function availText(av){
  if (!av) return "";
  if (av.unknown) return "Days not set" + (av.nth && av.nth.length ? " · " + av.nth.map(n => ["","1st","2nd","3rd","4th","5th"][n]).join(" & ") + " week" : "");
  const parts = [];
  for (let d = 1; d <= 5; d++){ const x = av.days[d]; if (!x || !(x.am || x.pm)) continue; parts.push(DAY_SHORT[d] + (x.am && x.pm ? "" : x.am ? " AM" : " PM")); }
  const ord = ["","1st","2nd","3rd","4th","5th"];
  return (parts.join(", ") || "No days") + (av.alt ? " · every other week" : "") + (av.nth && av.nth.length ? " · " + av.nth.map(n => ord[n]).join(" & ") + " week" : "") + (av.appt ? " · appointment only" : "");
}

/* where the city is inside the address: "123 Main St, Ste 4, Walnut Creek, CA 94596" */
function splitCity(address){
  const s = String(address||"").replace(/\s+/g," ").trim(); if (!s) return {street:"", city:""};
  const parts = s.split(",").map(x => x.trim()).filter(Boolean);
  const stateZip = x => /^(ca|calif|california|usa|us|united states)?\.?\s*(\d{5}(-\d{4})?)?$/i.test(x) && x.length;
  while (parts.length > 1 && stateZip(parts[parts.length-1])) parts.pop();
  // "Walnut Creek CA 94596" as the last part
  if (parts.length > 1){ const last = parts[parts.length-1].replace(/\s+(ca|calif|california)\.?(\s+\d{5}(-\d{4})?)?$/i,"").replace(/\s+\d{5}(-\d{4})?$/,"").trim();
    if (last && !/\d/.test(last)) return {street: parts.slice(0,-1).join(", "), city: last}; }
  // no commas: look for a known city name near the end
  const k = " " + cityKey(s) + " "; let best = null;
  for (const name in CITIES) if (k.includes(" " + name + " ") && (!best || name.length > best.length)) best = name;
  if (best){ const i = s.toLowerCase().lastIndexOf(best); if (i > 0) return {street: s.slice(0, i).replace(/[,\s]+$/,""), city: s.slice(i, i + best.length)}; }
  return {street:s, city:""};
}

/* Which column is which. Works out the header row and columns by their names. */
const DAYCOL = /^(mon|tue|wed|thu|fri)[a-z]*\.?\s*(am|pm|a\.m\.|p\.m\.|morning|afternoon)?$/i;
const HEADER_WORDS = /name|location|note|office|doctor|provider|physician|hcp|prescriber|address|street|city|town|avail|best time|days|schedule|hours|zip|postal|specialty|practice|clinic|group|^(mon|tue|wed|thu|fri)/i;
function detectColumns(rows){
  let hi = -1, best = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++){
    const r = rows[i] || []; const n = r.filter(c => HEADER_WORDS.test(String(c||"").trim()) && String(c||"").length < 40).length;
    if (n > best){ best = n; hi = i; }
  }
  if (hi < 0 || best < 2) return {hi:-1, headers:[], map:{}, missing:["Name","Address"]};
  const H = (rows[hi] || []).map(c => String(c||"").trim());
  const col = (re, not) => H.findIndex(h => h && re.test(h) && !(not && not.test(h)));
  const map = {};
  map.first = col(/^first(\s*name)?$|^given/i);
  map.last = col(/^(last|sur)\s*name$|^last$|^surname/i);
  map.name = col(/^(name|doctor|provider|physician|hcp|prescriber|target|full\s*name|hcp\s*name|doctor\s*name|provider\s*name|physician\s*name)/i, /practice|office|org|clinic|group|first|last|account/i);
  if (map.name < 0 && !(map.first >= 0 && map.last >= 0)) map.name = col(/name/i, /practice|office|org|clinic|group|first|last|account|street/i);
  map.addr = H.map((h,i) => /address|street/i.test(h) && !/e-?mail|web/i.test(h) ? i : -1).filter(i => i >= 0);
  if (!map.addr.length){ const l = col(/location|office/i, /name|manager|phone/i); if (l >= 0) map.addr = [l]; }
  map.city = col(/city|town/i);
  map.avail = col(/avail|best time|days|schedule|hours|when/i, DAYCOL);
  map.dayCols = []; H.forEach((h,i) => { const m = h.match(DAYCOL); if (m) map.dayCols.push(i); });
  if (map.dayCols.length < 2) map.dayCols = [];
  map.notes = col(/note|contact|comment/i); map.org = col(/org|group|practice|clinic|company|account/i); map.spec = col(/special/i); map.zip = col(/zip|postal/i);
  const missing = [];
  if (map.name < 0 && !(map.first >= 0 && map.last >= 0)) missing.push("Name");
  if (!map.addr.length && map.city < 0) missing.push("Address");
  return {hi, headers:H, map, missing};
}
const FALSEY = /^(no|n|-+|—|0|none|off|out|closed|false|x?\s*no|n\/a|na)$/i;
function dayCell(v, slot){
  v = String(v ?? "").trim(); if (!v || FALSEY.test(v)) return null;
  if (slot) return {am: slot === "am", pm: slot === "pm"};
  if (/all\s*day|both|full/i.test(v)) return {am:true, pm:true};
  const a = parseAvailability("Mon " + v.replace(/morning/i,"AM").replace(/afternoon/i,"PM"));
  if (a && a.days[1] && /am|pm|\d/i.test(v)) return a.days[1];
  return {am:true, pm:true};
}
function officesFromRows(rows, given){
  const det = given || detectColumns(rows);
  if (det.hi < 0) throw Object.assign(new Error("Couldn't find the column headings in that spreadsheet."), {needsMap:true});
  if (det.missing && det.missing.length) throw Object.assign(new Error("The spreadsheet is missing a column for: " + det.missing.join(", ") + "."), {needsMap:true});
  const {hi, map} = det; const H = det.headers || (rows[hi] || []).map(c => String(c||"").trim());
  const cell = (r, i) => i != null && i >= 0 ? String(r[i] ?? "").trim() : "";
  const body = Array.from(rows.slice(hi+1), r => r || []);
  const goodAddr = v => { v = String(v||"").trim(); return v && !/^=|https?:|hyperlink/i.test(v); };
  const score = i => body.reduce((n,r) => n + (goodAddr(r[i]) && /^\d/.test(String(r[i]).trim()) ? 1 : 0), 0);
  const order = (map.addr || []).slice().sort((a,b) => score(b)-score(a));
  const hasDays = (map.dayCols || []).length >= 2, hasAvail = map.avail != null && map.avail >= 0;
  const offices = [];
  body.forEach((r, idx) => {
    if (!r) return;
    let name = cell(r, map.name);
    if (!name && map.first >= 0 && map.last >= 0){ const l = cell(r, map.last), f = cell(r, map.first); name = l ? (f ? l + ", " + f : l) : ""; }
    else if (name && map.name === map.last && map.first >= 0 && cell(r, map.first)) name = name + ", " + cell(r, map.first);
    if (!name || name.length > 80) return;
    let address = ""; for (const i of order) if (goodAddr(r[i])) { address = String(r[i]).trim(); break; }
    let city = cell(r, map.city).replace(/\s+/g," ");
    if (city) address = address.replace(new RegExp("[,\\s]+" + city.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "(,?\\s*(CA|California)\\.?)?(\\s*\\d{5}(-\\d{4})?)?\\s*$", "i"), "").trim();
    else { const sp = splitCity(address); address = sp.street; city = sp.city; }
    if (!address && !city) return;
    const notes = cell(r, map.notes);
    let avail = null, aText = "";
    if (hasDays){
      const days = {};
      map.dayCols.forEach(i => { const m = H[i].match(DAYCOL); const d = DAYS[m[1].toLowerCase()]; const slot = m[2] ? (/^a/i.test(m[2]) || /morning/i.test(m[2]) ? "am" : "pm") : null;
        const x = dayCell(r[i], slot); if (!x) return; const cur = days[d] || {am:false, pm:false}; days[d] = {am: cur.am || x.am, pm: cur.pm || x.pm}; });
      if (Object.keys(days).length) avail = {days, appt: /appt|appointment/i.test(notes + " " + cell(r, map.avail)), nth:[]};
      aText = availText(avail);
    }
    if (!avail && hasAvail){ aText = cell(r, map.avail); avail = parseAvailability(aText); }
    if (!hasDays && !hasAvail){ avail = ANYTIME(); aText = "Days not set"; }
    offices.push({
      row: hi + idx + 2, rawName: name, ...splitSheetName(name),
      specialty: cell(r, map.spec), address, city, availText: aText, avail,
      notes, org: cell(r, map.org),
      zip: zipOf(cell(r, map.zip), address),
      onLeave: /maternity leave|on leave|leave of absence|retired|no longer (here|with|at)/i.test(notes),
      coords: cityCoords(city, address), addrKey: addressKey(address || city, city)
    });
  });
  return offices;
}

/* ---------------- matching plan doctors to spreadsheet ---------------- */
const normName = s => String(s||"").toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
function osa(a,b){ // optimal string alignment distance
  const d = Array.from({length:a.length+1}, (_,i) => [i, ...Array(b.length).fill(0)]);
  for (let j=1;j<=b.length;j++) d[0][j]=j;
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++){
    d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
    if (i>1 && j>1 && a[i-1]===b[j-2] && a[i-2]===b[j-1]) d[i][j] = Math.min(d[i][j], d[i-2][j-2]+1);
  }
  return d[a.length][b.length];
}
function firstOk(sheetFirst, tokens){
  if (!sheetFirst) return true;
  return tokens.some(t => t.startsWith(sheetFirst) || (sheetFirst.length > 1 && sheetFirst.startsWith(t) && t.length > 1));
}
function matchDoctors(planDocs, offices, overrides){
  // returns {byDoc: {docId: [officeIdx...]}, unmatched:[docId], how:{docId:"auto"|"manual"|"close"}}
  overrides = overrides || {};
  const byDoc = {}, how = {}, unmatched = [];
  for (const d of planDocs){
    const id = d.id;
    if (overrides[id] !== undefined){
      const want = overrides[id]; // sheet display name or "" for none
      byDoc[id] = want ? offices.map((o,i) => o.rawName === want ? i : -1).filter(i => i >= 0) : [];
      how[id] = "manual"; if (!byDoc[id].length) unmatched.push(id); continue;
    }
    const T = normName(d.name).split(" ").filter(Boolean);
    const lastTok = T[T.length-1];
    const cand = (pred) => offices.map((o,i) => pred(o) ? i : -1).filter(i => i >= 0);
    let hits = cand(o => o.last && o.last.split(/[ -]/).every(p => T.includes(p)) && firstOk(o.first, T) && (o.first || o.last === lastTok || T.indexOf(o.last.split(" ")[0]) >= 0));
    if (hits.length){
      // several different spreadsheet people: keep the ones in the plan's city if that narrows it
      const people = [...new Set(hits.map(i => offices[i].rawName))];
      if (people.length > 1 && d.city){
        const inCity = hits.filter(i => cityKey(offices[i].city) === cityKey(d.city));
        if (inCity.length){ const keep = new Set(inCity.map(i => offices[i].rawName)); hits = hits.filter(i => keep.has(offices[i].rawName)); }
      }
      byDoc[id] = hits; how[id] = "auto"; continue;
    }
    hits = cand(o => o.last && o.last.length >= 4 && osa(o.last, lastTok) === 1 && o.first && firstOk(o.first, T));
    if (!hits.length) hits = cand(o => o.last === lastTok && o.first && o.first.length >= 4 && osa(o.first, T[0]) <= 1 && (!d.city || cityKey(o.city) === cityKey(d.city)));
    if (hits.length){ byDoc[id] = hits; how[id] = "close"; continue; }
    byDoc[id] = []; unmatched.push(id);
  }
  return {byDoc, how, unmatched};
}

/* ---------------- finding doctor names in free text (calendar, screenshots) ---------------- */
// last names that are also everyday words, street names or common first names, or very common surnames: need a first name, "Dr." or a city nearby
const NEEDS_CONTEXT = new Set(["PARK","LONG","YOUNG","HILL","KING","WOOD","BROWN","WHITE","GREEN","GRAY","BELL","HALL","LANE","HEAL","BAKER","CROSS","CHURCH","ROSE","WELLS",
  "JUAN","JOSE","JOHN","JAMES","MARK","PAUL","GEORGE","KONG","WONG","LIANG","HUANG","CHAN","CHEN","WANG","ZHANG","LIN","LIM","NGUYEN","TRAN","KIM","PATEL","SHAH","SINGH","LOWE"]);
function buildNameIndex(planDocs, offices, match){
  const idx = []; // {id, last, first, cities:[...]}
  for (const d of planDocs){
    const T = normName(d.name).split(" ");
    const lasts = new Set([T[T.length-1]]);
    const cities = new Set([cityKey(d.city)].filter(Boolean));
    (match && match.byDoc[d.id] || []).forEach(i => { const L = offices[i].last; if (L) lasts.add(L.split(" ")[0]); if (offices[i].city) cities.add(cityKey(offices[i].city)); });
    for (const L of lasts) idx.push({id:d.id, last:L, first:T[0], cities:[...cities]});
  }
  const byLast = {}; idx.forEach(e => { (byLast[e.last] = byLast[e.last] || []).push(e); });
  return {idx, byLast};
}
// common short names, so "Mike Balduzzi" means Michael and not Jeffrey
const NICK = {MIKE:["MICHAEL"],MICK:["MICHAEL"],JEFF:["JEFFREY","JEFFERY"],BOB:["ROBERT"],BOBBY:["ROBERT"],ROB:["ROBERT","ROBIN"],BILL:["WILLIAM"],WILL:["WILLIAM"],LIAM:["WILLIAM"],
  JIM:["JAMES"],JIMMY:["JAMES"],JAMIE:["JAMES"],TOM:["THOMAS"],DAVE:["DAVID"],STEVE:["STEVEN","STEPHEN"],CHRIS:["CHRISTOPHER","CHRISTINE","CHRISTINA"],JOE:["JOSEPH"],
  DAN:["DANIEL"],DANNY:["DANIEL"],MATT:["MATTHEW"],NICK:["NICHOLAS"],TONY:["ANTHONY","ANTONIO"],RICK:["RICHARD","RICARDO"],RICH:["RICHARD"],DICK:["RICHARD"],
  BEN:["BENJAMIN"],SAM:["SAMUEL","SAMANTHA"],ED:["EDWARD"],TED:["EDWARD","THEODORE"],ANDY:["ANDREW"],DREW:["ANDREW"],GREG:["GREGORY"],PAT:["PATRICK","PATRICIA"],
  KATE:["KATHERINE","KATHRYN","CATHERINE"],KATIE:["KATHERINE","KATHRYN","CATHERINE"],CATHY:["CATHERINE"],KATHY:["KATHERINE","KATHLEEN"],LIZ:["ELIZABETH"],BETH:["ELIZABETH"],
  SUE:["SUSAN","SUZANNE"],JEN:["JENNIFER"],JENNY:["JENNIFER"],JESS:["JESSICA"],BECKY:["REBECCA"],MEG:["MARGARET","MEGAN"],PEGGY:["MARGARET"],ABBY:["ABIGAIL"],
  VICKY:["VICTORIA"],TINA:["CHRISTINA","KRISTINA"],ALEX:["ALEXANDER","ALEXANDRA","ALEJANDRO"],LARRY:["LAWRENCE"],JERRY:["GERALD","JEROME"],HANK:["HENRY"],
  CHUCK:["CHARLES"],CHARLIE:["CHARLES"],FRANK:["FRANCIS","FRANKLIN"],KEN:["KENNETH"],RON:["RONALD"],DON:["DONALD"],TIM:["TIMOTHY"],ZACH:["ZACHARY"],JON:["JONATHAN"],
  NATE:["NATHAN","NATHANIEL"],PHIL:["PHILIP","PHILLIP"],RAY:["RAYMOND"],GENE:["EUGENE"],FRED:["FREDERICK"],VINCE:["VINCENT"],MANNY:["MANUEL"],PETE:["PETER"],
  SANDY:["SANDRA"],DEB:["DEBORAH","DEBRA"],DEBBIE:["DEBORAH","DEBRA"],BARB:["BARBARA"],TERRY:["TERRENCE","TERESA"]};
function findDoctorsInText(text, nameIndex){
  const W = normName(text).split(" ").filter(Boolean);
  const found = new Map(); // id -> true (sure) | false (probably)
  const put = (id, sure) => { if (sure) found.set(id, true); else if (!found.has(id)) found.set(id, false); };
  for (let i=0;i<W.length;i++){
    const group = nameIndex.byLast[W[i]]; if (!group) continue;
    const near = W.slice(Math.max(0,i-3), i+4), nearText = " " + W.slice(Math.max(0,i-3), i+8).join(" ").toLowerCase() + " ";
    const drHit = W[i-1] === "DR" || W[i-2] === "DR";
    const full = group.filter(e => near.some(w => w.length > 1 && (w === e.first || (w.length >= 3 && e.first.startsWith(w)) || (NICK[w] || []).includes(e.first))));
    const initial = group.filter(e => near.some(w => w.length === 1 && w === e.first[0]));
    const byCity = group.filter(e => e.cities.some(c => c && nearText.includes(" " + c + " ")));
    if (full.length){ full.forEach(e => put(e.id, true)); continue; }
    if (group.length === 1){
      const e = group[0];
      const risky = NEEDS_CONTEXT.has(e.last) || e.last.length <= 3;
      put(e.id, !risky || drHit || initial.length === 1 || byCity.length === 1);
      continue;
    }
    // several plan doctors share this last name
    if (initial.length === 1){ put(initial[0].id, true); continue; }
    if (byCity.length === 1){ put(byCity[0].id, true); continue; }
    (initial.length ? initial : byCity.length ? byCity : group).forEach(e => put(e.id, false));
  }
  return [...found.entries()].map(([id,sure]) => ({id, sure}));
}

/* ---------------- calendar (.ics) ---------------- */
function icsUnescape(s){ return String(s||"").replace(/\\n/gi,"\n").replace(/\\([,;\\])/g,"$1"); }
function icsDate(v, params){
  v = String(v||"").trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  if (!m[4] || /VALUE=DATE(?!-)/i.test(params||"")) return {allDay:true, date:new Date(+m[1], +m[2]-1, +m[3])};
  const dt = m[7] ? new Date(Date.UTC(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0))) : new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +(m[6]||0));
  return {allDay:false, date:dt};
}
function parseICS(text){
  const lines = String(text).replace(/\r\n?/g,"\n").replace(/\n[ \t]/g,"").split("\n");
  const evs = []; let cur = null, depth = 0;
  for (const ln of lines){
    if (/^BEGIN:VEVENT/i.test(ln)){ cur = {attendees:[], exdates:[]}; depth = 0; continue; }
    if (!cur) continue;
    if (/^BEGIN:/i.test(ln)){ depth++; continue; }
    if (/^END:VEVENT/i.test(ln)){ evs.push(cur); cur = null; continue; }
    if (/^END:/i.test(ln)){ depth--; continue; }
    if (depth > 0) continue;
    const ci = ln.indexOf(":"); if (ci < 0) continue;
    const head = ln.slice(0,ci), val = ln.slice(ci+1);
    const [name, ...ps] = head.split(";"); const params = ps.join(";"); const N = name.toUpperCase();
    if (N === "DTSTART") cur.start = icsDate(val, params);
    else if (N === "DTEND") cur.end = icsDate(val, params);
    else if (N === "DURATION") cur.duration = val;
    else if (N === "SUMMARY") cur.summary = icsUnescape(val);
    else if (N === "LOCATION") cur.location = icsUnescape(val);
    else if (N === "DESCRIPTION") cur.description = icsUnescape(val).slice(0,600);
    else if (N === "UID") cur.uid = val;
    else if (N === "RRULE") cur.rrule = val;
    else if (N === "EXDATE") val.split(",").forEach(x => { const d = icsDate(x, params); if (d) cur.exdates.push(d.date); });
    else if (N === "RECURRENCE-ID") cur.recurrenceId = icsDate(val, params);
    else if (N === "STATUS") cur.status = val.toUpperCase();
    else if (N === "TRANSP") cur.transp = val.toUpperCase();
    else if (N === "ORGANIZER" || N === "ATTENDEE"){ if (N === "ORGANIZER"){ const cn0 = params.match(/CN="?([^";:]+)"?/i); cur.organizer = (cn0 ? cn0[1] + " " : "") + val.replace(/^mailto:/i,""); } const cn = params.match(/CN="?([^";:]+)"?/i); cur.attendees.push(cn ? cn[1] : val.replace(/^mailto:/i,"")); }
  }
  return evs.filter(e => e.start && e.status !== "CANCELLED");
}
function durMs(d){ const m = String(d||"").match(/P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/); if (!m) return 0; return (((+m[1]||0)*7 + (+m[2]||0))*86400 + (+m[3]||0)*3600 + (+m[4]||0)*60 + (+m[5]||0))*1000; }
function expandEvents(evs, fromISO_, toISO_){
  // returns occurrences overlapping [from, to] (dates inclusive): {start:Date,end:Date,allDay,summary,location,description,attendees,transp,uid}
  const from = fromISO(fromISO_), to = fromISO(addDays(toISO_,1));
  const overrides = new Set(evs.filter(e => e.recurrenceId).map(e => e.uid + "|" + e.recurrenceId.date.getTime()));
  const out = [];
  const push = (e, s) => {
    const len = e.end ? e.end.date - e.start.date : (e.duration ? durMs(e.duration) : (e.start.allDay ? 864e5 : 36e5));
    const en = new Date(s.getTime() + Math.max(len, 0));
    if (en > from && s < to) out.push({start:s, end:en, allDay:e.start.allDay, summary:e.summary||"", location:e.location||"", description:e.description||"", attendees:e.attendees, organizer:e.organizer||"", transp:e.transp, uid:e.uid});
  };
  for (const e of evs){
    if (!e.rrule || e.recurrenceId){ push(e, e.start.date); continue; }
    const R = Object.fromEntries(e.rrule.split(";").map(p => p.split("=")).map(([k,v]) => [k.toUpperCase(), v]));
    const freq = R.FREQ, interval = +(R.INTERVAL||1), count = R.COUNT ? +R.COUNT : Infinity;
    const until = R.UNTIL ? icsDate(R.UNTIL).date : null;
    const byday = R.BYDAY ? R.BYDAY.split(",").map(x => ["SU","MO","TU","WE","TH","FR","SA"].indexOf(x.slice(-2))) : null;
    const s0 = e.start.date; const ex = new Set(e.exdates.map(d => d.getTime()));
    let n = 0;
    const consider = d => {
      if (until && d > until) return false;
      n++; if (n > count) return false;
      if (!ex.has(d.getTime()) && !overrides.has(e.uid + "|" + d.getTime())) push(e, d);
      return d < to;
    };
    if (freq === "DAILY"){ for (let i=0, d=new Date(s0); i<4000; i++, d=new Date(s0.getFullYear(), s0.getMonth(), s0.getDate()+i*interval, s0.getHours(), s0.getMinutes())){ if (!consider(d)) break; } }
    else if (freq === "WEEKLY"){
      const days = byday || [s0.getDay()];
      const wk0 = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate() - s0.getDay());
      let stop = false;
      for (let w=0; w<800 && !stop; w+=interval){
        for (const dd of days.slice().sort()){
          const d = new Date(wk0.getFullYear(), wk0.getMonth(), wk0.getDate() + w*7 + dd, s0.getHours(), s0.getMinutes());
          if (d < s0) continue;
          if (!consider(d)){ stop = true; break; }
        }
      }
    }
    else if (freq === "MONTHLY" || freq === "YEARLY"){
      for (let i=0;i<400;i++){
        const d = freq === "MONTHLY" ? new Date(s0.getFullYear(), s0.getMonth()+i*interval, s0.getDate(), s0.getHours(), s0.getMinutes())
                                     : new Date(s0.getFullYear()+i*interval, s0.getMonth(), s0.getDate(), s0.getHours(), s0.getMinutes());
        if (!consider(d)) break;
      }
    }
    else push(e, s0);
  }
  return out.sort((a,b) => a.start - b.start);
}
function wordIn(text, w){ return new RegExp("(^|[^A-Za-z])" + w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "([^A-Za-z]|$)", "i").test(text); }
const MEAL = /\b(lunch|lunches|breakfast|coffee|snacks?|dinner|in-?service|program|bagels?|donuts?|pizza|treats?)\b/i;
// does an organizer line ("Jordan Smith jordan.smith@...") belong to this person?
function isPerson(text, person){
  const t = String(text||"").toLowerCase(), w = String(person||"").toLowerCase().split(/[^a-z]+/).filter(x => x.length > 1);
  if (!t || !w.length) return false;
  if (w.every(x => new RegExp("(^|[^a-z])" + x + "([^a-z]|$)").test(t))) return true;
  return w.length > 1 && (t.includes(w[0] + "." + w[w.length-1]) || t.includes(w[0] + w[w.length-1]) || t.includes(w[0][0] + w[w.length-1] + "@"));
}
function classifyEvent(ev, counterparts, nameIndex, myName){
  const own = [ev.summary, ev.location, ev.description].join(" \n ");
  const text = own + " \n " + (ev.attendees||[]).join(" ");
  let who = counterparts.filter(c => c && wordIn(text, c));
  const docs = findDoctorsInText(own, nameIndex);
  // "Lunch - Lee" or "Coffee w/ Lee": a meal word next to a single name is enough to be sure
  if (docs.length === 1 && docs[0].sure === false && MEAL.test(ev.summary || "")) docs[0].sure = true;
  const mine = !!(myName && ev.organizer && isPerson(ev.organizer, myName));
  // your own event: a counterpart who is only on the invite list is a guest, not their visit
  if (mine) who = who.filter(c => wordIn(own, c));
  else if (ev.organizer){ const orgCp = counterparts.filter(c => c && wordIn(ev.organizer, c)); if (orgCp.length) who = [...new Set(orgCp.concat(who))]; }
  let kind;
  if (who.length && docs.length) kind = "counterpart";
  else if (who.length) kind = "ignore";
  else if (docs.length) kind = "mine";
  else kind = ev.transp === "TRANSPARENT" ? "ignore" : "busy";
  // your own lunch or coffee with someone who isn't on your list ("Matthys Lunch - Torre")
  const first = String(myName || "").trim().split(/\s+/)[0] || "";
  const myMeal = kind === "busy" && !ev.allDay && MEAL.test(ev.summary || "") && (mine || (first.length > 1 && wordIn(ev.summary || "", first)));
  return {kind, who, docs, mine, myMeal};
}

/* ---------------- a counterpart's "Share my week" text, pasted from a text or email ----------------
   "Sam's week, Oct 19 – Oct 23" / "Monday, Oct 19 · Springfield" / "Morning: Pat Doe (Springfield) – lunch 12:00 PM, ..." */
const WDAYS = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
function parseSharedWeek(text, weekMon, nameIndex){
  const lines = String(text||"").replace(/\r/g,"").split("\n").map(s => s.trim()).filter(Boolean);
  const head = lines[0] || ""; const hm = head.match(/^([A-Za-z][A-Za-z'\- ]{0,30}?)['’]s week\b/i);
  const who = hm ? hm[1].trim() : null;
  const byDate = {}; let cur = null; const ref = fromISO(weekMon);
  for (const ln of lines){
    const m = ln.match(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s*(?:([A-Za-z]{3,})\.?\s+(\d{1,2}))?/i);
    if (m && !/^(morning|afternoon)/i.test(ln) && (m[2] || /^(mon|tues|wednes|thurs|fri)day\b/i.test(ln))){
      if (m[2] && MONTHS.includes(m[2].slice(0,3).toLowerCase())){
        const mo = MONTHS.indexOf(m[2].slice(0,3).toLowerCase()), dd = +m[3];
        let best = null; for (const y of [ref.getFullYear()-1, ref.getFullYear(), ref.getFullYear()+1]){ const d = new Date(y, mo, dd); if (!best || Math.abs(d - ref) < Math.abs(best - ref)) best = d; }
        cur = isoDay(best);
      } else { const k = WDAYS.findIndex(w => w.startsWith(m[1].toLowerCase())); cur = addDays(weekMon, (k + 6) % 7); }
      byDate[cur] = byDate[cur] || []; continue;
    }
    if (!cur) continue;
    const body = ln.replace(/^(morning|afternoon|am|pm)\s*:\s*/i, "");
    for (const part of body.split(/,(?![^(]*\))/)){
      const nm = part.replace(/\([^)]*\)/g, " ").replace(/\s[–-]\s.*$/, "");
      for (const x of findDoctorsInText(nm, nameIndex)) if (!byDate[cur].some(y => y.id === x.id)) byDate[cur].push(x);
    }
  }
  const dates = Object.keys(byDate).filter(d => byDate[d].length).sort();
  return {who, byDate, weekOf: dates.length ? mondayOf(dates[0]) : null};
}

/* ---------------- counterpart schedule screenshots (OCR TSV) ---------------- */
const MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
function parseTSV(tsv){
  return String(tsv||"").split("\n").slice(1).map(l => l.split("\t")).filter(c => c.length >= 12 && c[0] === "5" && c[11].trim())
    .map(c => ({block:+c[2], par:+c[3], line:+c[4], left:+c[6], top:+c[7], w:+c[8], h:+c[9], conf:+c[10], text:c[11].trim()}));
}
function scheduleFromWords(words, weekMon, nameIndex){
  const week = weekDays(weekMon);
  const dayOf = (w, next) => {
    const t = w.text.toLowerCase().replace(/[^a-z0-9/]/g,"");
    const nm = t.match(/^(mon|tue|wed|thu|fri)/);
    const dm = t.match(/^(\d{1,2})\/(\d{1,2})/);
    if (dm){ const hit = week.find(d => fromISO(d).getMonth()+1 === +dm[1] && fromISO(d).getDate() === +dm[2]); if (hit) return hit; }
    const mi = MONTHS.indexOf(t.slice(0,3));
    if (mi >= 0 && next && /^\d{1,2}/.test(next.text)){ const dd = parseInt(next.text,10); const hit = week.find(d => fromISO(d).getMonth() === mi && fromISO(d).getDate() === dd); if (hit) return hit; }
    if (nm && (t.length <= 3 || /^(mon|tues?|wed|weds|wednes|thur?s?|fri)(day)?$/.test(t) || /^(monday|tuesday|wednesday|thursday|friday)/.test(t))) return week[DAYS[nm[1]]-1];
    return null;
  };
  const anchors = [];
  words.forEach((w,i) => { const d = dayOf(w, words[i+1]); if (d) anchors.push({...w, date:d, cx:w.left+w.w/2}); });
  // one anchor per date: keep the top-most occurrence
  const firstPer = {}; anchors.forEach(a => { if (!firstPer[a.date] || a.top < firstPer[a.date].top) firstPer[a.date] = a; });
  const A = Object.values(firstPer);
  const out = {}; week.forEach(d => out[d] = []);
  if (!A.length) return {byDate:out, layout:"none"};
  const medH = A.map(a => a.h).sort((x,y)=>x-y)[Math.floor(A.length/2)] || 20;
  const sameRow = A.filter(a => Math.abs(a.top - A[0].top) < medH*1.5).length;
  const layout = A.length >= 2 && sameRow >= Math.min(A.length, 2) && sameRow === A.length ? "columns" : "rows";
  const buckets = {}; A.forEach(a => buckets[a.date] = []);
  if (layout === "columns"){
    const cols = A.slice().sort((a,b) => a.cx - b.cx);
    const headerBottom = Math.max(...A.map(a => a.top + a.h));
    words.forEach(w => {
      if (w.top + w.h <= headerBottom - 2) return;
      const cx = w.left + w.w/2; let best = cols[0], bd = Infinity;
      cols.forEach(c => { const d = Math.abs(c.cx - cx); if (d < bd){ bd = d; best = c; } });
      buckets[best.date].push(w);
    });
  } else {
    const rows = A.slice().sort((a,b) => a.top - b.top);
    words.forEach(w => {
      let owner = null; for (const r of rows) if (w.top >= r.top - 2) owner = r;
      if (owner) buckets[owner.date].push(w);
    });
  }
  for (const d in buckets){
    const ws = buckets[d].sort((a,b) => (a.top - b.top) || (a.left - b.left));
    // rebuild lines so first + last names stay together
    const lines = []; ws.forEach(w => { const L = lines.find(l => Math.abs(l.top - w.top) < Math.max(8, w.h*0.6)); if (L){ L.ws.push(w); } else lines.push({top:w.top, ws:[w]}); });
    const text = lines.map(l => l.ws.sort((a,b)=>a.left-b.left).map(w => w.text).join(" ")).join("\n");
    out[d] = findDoctorsInText(text, nameIndex);
  }
  return {byDate:out, layout};
}

/* ---------------- priority ---------------- */
function scoreDoctors(docs){
  const need = d => d.callsPerWeekNeeded != null ? d.callsPerWeekNeeded : (d.assigned ? d.remaining / d.assigned : 0);
  const maxNeed = Math.max(0.0001, ...docs.map(need));
  docs.forEach(d => {
    const stale = d.daysSinceLastCall == null ? 1 : Math.min(d.daysSinceLastCall, 60) / 60;
    d.score = d.added ? 0.1 * stale : 0.8 * need(d) / maxNeed + 0.2 * stale;
  });
  return docs;
}

/* ---------------- scheduling ---------------- */
function availableOn(office, iso){
  if (!office.avail || office.onLeave || !office.coords) return null;
  const a = office.avail.days[dow(iso)]; if (!a) return null;
  if (office.avail.nth.length && !office.avail.nth.includes(Math.ceil(fromISO(iso).getDate()/7))) return null;
  // every other week: in on the weeks an even number of weeks from the week they were last known to be in
  if (office.avail.alt && Math.abs(Math.round((fromISO(mondayOf(iso)) - fromISO(office.avail.alt)) / (7*864e5))) % 2 === 1) return null;
  return a;
}
function slotCaps(perDay){ return {am: Math.ceil(perDay/2), pm: Math.floor(perDay/2)}; }
function minutesOverlap(ev, iso, h1, h2){
  const d = fromISO(iso); const s = new Date(d); s.setHours(h1,0,0,0); const e = new Date(d); e.setHours(h2,0,0,0);
  return Math.max(0, (Math.min(e, ev.end) - Math.max(s, ev.start)) / 60000);
}

function buildContext(input){
  // input: {weekMon, days:[iso], docs:[{id,name,city,remaining,assigned,...,score}], offices, match, home:[lat,lon], perDay,
  //         counterpartVisits:[{date,id,who}], calendar:[{start,end,allDay,kind,docs:[{id}],summary}], today}
  const C = {...input};
  C.docById = Object.fromEntries(input.docs.map(d => [d.id, d]));
  // doctors with no calls left are still known (for calendar visits and adding by hand) but aren't planned on their own
  C.allDocs = input.docs; C.docs = input.docs.filter(d => !d.noAuto);
  C.blocked = new Set(input.counterpartVisits.map(v => v.date + "|" + v.id));
  // doctors out of office: blocked like a counterpart day, but remembered separately for the reasons shown
  C.away = new Set();
  for (const id in (input.away || {})) for (const r of input.away[id]) for (const iso of input.days.concat(input.weekMon ? weekDays(input.weekMon) : [])) if (iso >= r.from && iso <= r.to){ C.away.add(iso + "|" + id); C.blocked.add(iso + "|" + id); }
  // never the third of you on three days in a row: a day between two counterpart visits, or right before or after two back-to-back ones, is blocked too
  C.streak = new Set(); const cpd = {};
  input.counterpartVisits.forEach(v => (cpd[v.id] = cpd[v.id] || new Set()).add(v.date));
  for (const id in cpd){ const s = cpd[id];
    for (const iso of input.days.concat(input.weekMon ? weekDays(input.weekMon) : [])){
      if (s.has(iso) || C.streak.has(iso + "|" + id)) continue;
      const p1 = s.has(addDays(iso, -1)), p2 = s.has(addDays(iso, -2)), n1 = s.has(addDays(iso, 1)), n2 = s.has(addDays(iso, 2));
      if ((p1 && p2) || (p1 && n1) || (n1 && n2)){ C.streak.add(iso + "|" + id); C.blocked.add(iso + "|" + id); }
    }
  }
  // doctors already called this week (logged in the tracker or shown in the call plan report) aren't planned again
  const wkEnd = addDays(input.weekMon, 6);
  C.seen = {}; input.docs.forEach(d => { if (d.lastCall && d.lastCall >= input.weekMon && d.lastCall <= wkEnd) C.seen[d.id] = d.lastCall; });
  C.caps = {}; C.fixed = {}; C.busyNotes = {}; C.addrRule = input.addrRule || "week";
  C.allowed = input.zone ? new Set(input.offices.map((o,i) => officeInZone(o, input.zone) ? i : -1).filter(i => i >= 0)) : null;
  for (const iso of input.days){
    let busyA = 0, busyP = 0, off = false; const notes = [];
    for (const ev of input.calendar){
      if (ev.kind !== "busy" && ev.kind !== "mine") continue;
      const covers = ev.allDay ? (ev.start <= fromISO(iso) && ev.end > fromISO(iso)) : isoDay(ev.start) === iso;
      if (!covers) continue;
      if (ev.kind === "busy"){
        if (ev.allDay){ off = true; notes.push({label:"All day", text:ev.summary}); continue; }
        const mA = minutesOverlap(ev, iso, 8, 12), mP = minutesOverlap(ev, iso, 12, 17);
        busyA += mA; busyP += mP;
        if (mA || mP) notes.push({label: ev.start.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}), text:ev.summary});
      } else {
        (ev.docs||[]).filter(x => x.sure !== false).forEach(x => {
          if (!C.docById[x.id]) return;
          const slot = ev.allDay ? "am" : (ev.start.getHours() < 12 ? "am" : "pm");
          (C.fixed[iso] = C.fixed[iso] || []).push({id:x.id, slot, from:"calendar", note:ev.summary, hour: ev.allDay ? null : ev.start.getHours() + ev.start.getMinutes()/60, time:ev.allDay ? "" : ev.start.toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})});
        });
      }
    }
    // about an hour per visit including the drive; mornings 8-12, afternoons 12-5
    const am = off ? 0 : Math.max(0, Math.min(4, Math.floor((240 - busyA) / 60)));
    const pm = off ? 0 : Math.max(0, Math.min(5, Math.floor((300 - busyP) / 60)));
    C.caps[iso] = {am, pm, total: Math.min(input.perDay, am + pm)};
    C.busyNotes[iso] = notes;
  }
  return C;
}
function optionsFor(C, id, iso){
  const res = [];
  (C.match.byDoc[id] || []).forEach(i => {
    if (C.allowed && !C.allowed.has(i)) return;
    const o = C.offices[i]; const a = availableOn(o, iso);
    if (a) res.push({id, office:i, am:a.am, pm:a.pm, coords:o.coords, addrKey:o.addrKey});
  });
  return res;
}
function feasibleDays(C, id){ return C.days.filter(d => !C.blocked.has(d + "|" + id) && optionsFor(C, id, d).length); }

function tourLength(seq, home){ let d = 0, at = home; seq.forEach(s => { d += km(at, s.coords); at = s.coords; }); return d + km(at, home); }
function bestTour(stops, home){
  // nearest neighbour from home, then 2-opt on the loop home -> stops -> home
  const left = stops.slice(), seq = []; let at = home;
  while (left.length){ let bi = 0, bd = Infinity; left.forEach((s,i) => { const d = km(at, s.coords); if (d < bd - 1e-9){ bd = d; bi = i; } }); const s = left.splice(bi,1)[0]; seq.push(s); at = s.coords; }
  let improved = true, guard = 0;
  while (improved && guard++ < 50){
    improved = false;
    for (let i=0;i<seq.length-1;i++) for (let j=i+1;j<seq.length;j++){
      const cand = seq.slice(0,i).concat(seq.slice(i,j+1).reverse(), seq.slice(j+1));
      if (tourLength(cand, home) < tourLength(seq, home) - 1e-6){ seq.splice(0, seq.length, ...cand); improved = true; }
    }
  }
  return seq;
}
function orderDay(stops, home, capAM, capPM){
  // Morning = the first part of the loop, afternoon = the rest, so each half-day stays in one area.
  const n = stops.length; if (!n) return {stops:[], miles:0};
  const curAM = stops.filter(s => s.slot === "am").length;
  capAM = capAM == null ? n : capAM; capPM = capPM == null ? n : capPM;
  const tour = bestTour(stops, home);
  // a visit at a set time around midday (a lunch): everything before it in the loop is the morning
  const noon = stops.find(s => s.fixed && s.hour != null && s.hour >= 11 && s.hour < 14);
  if (noon){
    let best = null;
    for (const seq of [tour, tour.slice().reverse()]){
      const k = seq.indexOf(noon);
      const ok = seq.every((s,i) => i < k ? s.am : (s === noon || s.pm));
      const score = (ok ? 0 : 100) + Math.abs(k - n/2) + (k > capAM ? 50 : 0) + (n - k > capPM + 1 ? 50 : 0);
      if (!best || score < best.score) best = {seq, k, score};
    }
    if (best.score < 100){
      best.seq.forEach((s,i) => s.slot = i < best.k ? "am" : "pm");
      return {stops: best.seq, miles: Math.round(miles(tourLength(best.seq, home)))};
    }
    // otherwise: the morning stops as a path from home, then the midday visit, then the afternoon from there
    const amS = bestTour(stops.filter(s => s !== noon && s.slot === "am"), home), pmS = bestTour(stops.filter(s => s !== noon && s.slot !== "am"), noon.coords);
    noon.slot = "pm"; const seq = amS.concat([noon], pmS);
    return {stops: seq, miles: Math.round(miles(tourLength(seq, home)))};
  }
  const ks = []; for (let k = Math.max(0, n - capPM); k <= Math.min(n, capAM); k++) ks.push(k);
  ks.sort((a,b) => Math.abs(a-curAM) - Math.abs(b-curAM));
  for (const k of ks) for (const seq of [tour, tour.slice().reverse()]){
    if (seq.every((s,i) => i < k ? s.am : s.pm)){
      seq.forEach((s,i) => s.slot = i < k ? "am" : "pm");
      return {stops: seq, miles: Math.round(miles(tourLength(seq, home)))};
    }
  }
  // fall back: keep slots, order each half by distance
  const am = bestTour(stops.filter(s => s.slot === "am"), home);
  const pmStart = am.length ? am[am.length-1].coords : home;
  const pm = bestTour(stops.filter(s => s.slot === "pm"), pmStart);
  const seq = am.concat(pm);
  return {stops: seq, miles: Math.round(miles(tourLength(seq, home)))};
}

function makeFixedStop(C, f, iso){
  const opts = optionsFor(C, f.id, iso); const o = opts[0] || null;
  const off = o ? C.offices[o.office] : (C.match.byDoc[f.id]||[]).map(i => C.offices[i])[0];
  return {id:f.id, office: o ? o.office : ((C.match.byDoc[f.id]||[])[0] ?? null), slot:f.slot, coords: off ? off.coords : null, addrKey: off ? off.addrKey : "cal|"+f.id, fixed:true, am:f.slot === "am", pm:f.slot === "pm", note:f.note, time:f.time, hour:f.hour, history:[]};
}
function fillDay(C, plan, iso, opts){
  // Plans the open spots of one day. opts: {variant: n (0 = best area, 1 = next best...), avoid: Set of ids to leave out if possible}
  opts = opts || {};
  const day = plan.days[iso];
  const usedDoc = new Set(), usedAddr = new Set(), cityDays = {};
  for (const k in plan.days){
    plan.days[k].stops.forEach(s => { usedDoc.add(s.id); if (!s.manual && (C.addrRule !== "day" || k === iso)) usedAddr.add(s.addrKey); });
    if (k !== iso) new Set(plan.days[k].stops.map(s => s.office != null ? C.offices[s.office].city : "")).forEach(c => { if (c) cityDays[c] = (cityDays[c]||0) + 1; });
  }
  const feas = C.feas || (C.feas = Object.fromEntries(C.docs.map(d => [d.id, feasibleDays(C, d.id).length])));
  const fixedAM = day.stops.filter(s => s.slot === "am").length, fixedPM = day.stops.filter(s => s.slot === "pm").length;
  day.capAM = C.caps[iso].am; day.capPM = C.caps[iso].pm;
  let capAM = Math.max(0, C.caps[iso].am - fixedAM), capPM = Math.max(0, C.caps[iso].pm - fixedPM);
  const total = Math.max(0, Math.min(C.caps[iso].total - day.stops.length, capAM + capPM));
  day.short = 0;
  if (!total) return;
  const avoid = opts.avoid || new Set();
  const all = [];
  for (const d of C.docs){
    if (usedDoc.has(d.id) || C.blocked.has(iso + "|" + d.id) || C.seen[d.id]) continue;
    for (const o of optionsFor(C, d.id, iso)) if (!usedAddr.has(o.addrKey)) all.push({...o, w: d.score * (1 + 0.6 / Math.max(1, feas[d.id])) - (avoid.has(d.id) ? 0.5 : 0)});
  }
  if (!all.length){ day.short = total; return; }
  // center may be one point or several (e.g. the chosen area plus a fixed lunch); distance is to the nearest one
  const dist = (p, center) => Array.isArray(center[0]) ? Math.min(...center.map(c => km(p, c))) : km(p, center);
  const adj = (o, center) => o.w - 0.02 * dist(o.coords, center) - 0.12 * (cityDays[C.offices[o.office].city] || 0);
  const fill = (center, radius, extra) => {
    const P = all.filter(o => dist(o.coords, center) <= radius || (extra && extra(o))).sort((a,b) => adj(b, center) - adj(a, center));
    const picked = [], dU = new Set(), aU = new Set(); let am = capAM, pm = capPM, n = 0, val = 0;
    for (const o of P){
      if (n >= total || am + pm === 0) break;
      if (dU.has(o.id) || aU.has(o.addrKey)) continue;
      let slot = null;
      if (o.am && o.pm) slot = am >= pm ? (am ? "am" : "pm") : "pm";
      else if (o.am && am) slot = "am"; else if (o.pm && pm) slot = "pm";
      if (!slot || (slot === "am" ? am : pm) <= 0) continue;
      if (slot === "am") am--; else pm--;
      n++; dU.add(o.id); aU.add(o.addrKey); val += adj(o, center); picked.push({...o, slot});
    }
    return {picked, val, left: total - n};
  };
  let centers;
  const fixedC = day.stops.filter(s => s.coords).map(s => s.coords);
  const fc = fixedC.length ? [fixedC.reduce((a,c)=>a+c[0],0)/fixedC.length, fixedC.reduce((a,c)=>a+c[1],0)/fixedC.length] : null;
  const seenC = new Set(); centers = fc ? [fc] : [];
  // with a visit already fixed (a calendar lunch, say), the rest of the day may lean into a neighbouring area, but stays within reach of it
  all.forEach(o => { const k = o.coords.join(","); if (!seenC.has(k) && (!fc || km(o.coords, fc) <= 40)){ seenC.add(k); centers.push(o.coords); } });
  // fixed visits far apart (e.g. a Turlock anchor and an Alameda lunch): fill around each of them, not the midpoint
  let spread = 0; fixedC.forEach(a => fixedC.forEach(b => { spread = Math.max(spread, km(a, b)); }));
  if (spread > 45){
    // with a midday visit (lunch) on one side, the other side gets one half of the day and the lunch side the other
    const fixedS = day.stops.filter(s => s.coords);
    const noon = fixedS.find(s => s.hour != null && s.hour >= 11 && s.hour < 14);
    if (noon){
      const far = fixedS.filter(s => s !== noon && km(s.coords, noon.coords) > 45);
      const nearFar = o => Math.min(...far.map(s => km(s.coords, o.coords))) < km(noon.coords, o.coords);
      let half = far.some(s => s.anchor && s.am && !s.pm) ? "am" : far.some(s => s.anchor && s.pm && !s.am) ? "pm" : null;
      if (!half){ const cnt = h => all.filter(o => nearFar(o) && o[h]).length + (far.every(s => s[h]) ? 3 : 0); half = cnt("am") >= cnt("pm") ? "am" : "pm"; }
      const other = half === "am" ? "pm" : "am";
      far.forEach(s => { s.slot = half; s.am = half === "am"; s.pm = half === "pm"; });
      for (let i = all.length - 1; i >= 0; i--){ const o = all[i], h = nearFar(o) ? half : other; if (!o[h]) all.splice(i, 1); else all[i] = {...o, am: h === "am", pm: h === "pm"}; }
      // the half-day caps now count what's already fixed on each side
      const fa = day.stops.filter(s => s.slot === "am").length, fp = day.stops.filter(s => s.slot === "pm").length;
      capAM = Math.max(0, C.caps[iso].am - fa); capPM = Math.max(0, C.caps[iso].pm - fp);
    }
    let res = fill(fixedC, 20); if (res.left > 0){ const r2 = fill(fixedC, 32); if (r2.left < res.left) res = r2; }
    if (res.left > 0){ const base = fixedC.map(c => km(c, C.home)); const r4 = fill(fixedC, 32, o => fixedC.some((c,i) => km(c, o.coords) + km(o.coords, C.home) - base[i] <= 20)); if (r4.left < res.left) res = r4; }
    res.picked.forEach(o => day.stops.push({id:o.id, office:o.office, slot:o.slot, am:o.am, pm:o.pm, coords:o.coords, addrKey:o.addrKey, history:[]}));
    day.short = res.left; day.center = fc; day.variants = 1; return;
  }
  const ranked = centers.map(c => { const r = fill(c, 20); return {c, r, v: r.val - 0.0025 * km(C.home, c) - 0.4 * r.left - (fc ? 0.012 * km(fc, c) : 0)}; }).sort((a,b) => b.v - a.v);
  // alternatives: distinct areas (skip centres within 8 km of a better one)
  const distinct = []; ranked.forEach(x => { if (!distinct.some(y => km(y.c, x.c) < 8)) distinct.push(x); });
  const pickI = (opts.variant || 0) % Math.max(1, distinct.length);
  const best = distinct[pickI] || ranked[0];
  let res = best.r;
  if (res.left > 0){ const r2 = fill(best.c, 32); if (r2.left < res.left) res = r2; }
  if (res.left > 0 && fc){ const r3 = fill([best.c, fc], 25); if (r3.left < res.left) res = r3; }
  // still short: top up with doctors on the way out or back (a small detour from the drive between home and the day's area)
  if (res.left > 0){
    const c0 = best.c, base = km(c0, C.home);
    const onTheWay = o => km(c0, o.coords) + km(o.coords, C.home) - base <= 20;
    const r4 = fill(fc ? [c0, fc] : c0, 32, onTheWay); if (r4.left < res.left) res = r4;
  }
  res.picked.forEach(o => day.stops.push({id:o.id, office:o.office, slot:o.slot, am:o.am, pm:o.pm, coords:o.coords, addrKey:o.addrKey, history:[]}));
  day.short = res.left; day.center = best.c; day.variants = distinct.length;
}
function planWeek(input){
  const C = buildContext(input);
  const plan = {days:{}};
  const used = new Set();
  for (const iso of C.days){
    plan.days[iso] = {stops:[], area:"", miles:0, short:0, notes:C.busyNotes[iso], variant:0};
    for (const k of ((input.keep || {})[iso] || [])){ if (used.has(k.id)) continue; plan.days[iso].stops.push(JSON.parse(JSON.stringify(k))); used.add(k.id); }
    // anchors: doctors the rep has pinned to this day; they count toward the day and the day is planned around them
    for (const a of (input.anchors || []).filter(a => a.iso === iso)){
      if (used.has(a.id)) continue;
      const opts = optionsFor(C, a.id, iso); let o = opts.find(x => a.addrKey && x.addrKey === a.addrKey) || opts[0];
      if (a.addrKey && (!o || o.addrKey !== a.addrKey)){ const i = (C.match.byDoc[a.id] || []).find(j => C.offices[j].addrKey === a.addrKey); if (i != null){ const of = C.offices[i]; o = {office:i, coords:of.coords, addrKey:of.addrKey, am:true, pm:true}; } }
      if (!o){ const i = (C.match.byDoc[a.id] || [])[0]; if (i == null) continue; const of = C.offices[i]; o = {office:i, coords:of.coords, addrKey:of.addrKey, am:true, pm:true}; }
      const slot = a.slot || (o.am ? "am" : "pm");
      plan.days[iso].stops.push({id:a.id, office:o.office, slot, am: a.slot ? a.slot === "am" : !!o.am, pm: a.slot ? a.slot === "pm" : !!o.pm, coords:o.coords, addrKey:o.addrKey, fixed:true, anchor:true, history:[]});
      used.add(a.id);
    }
    for (const f of (C.fixed[iso] || [])){ if (used.has(f.id)) continue; plan.days[iso].stops.push(makeFixedStop(C, f, iso)); used.add(f.id); }
  }
  // days anchored by a visit already on the calendar get first pick of the doctors around it
  const order = C.days.slice().sort((a,b) => (plan.days[b].stops.length > 0) - (plan.days[a].stops.length > 0) || a.localeCompare(b));
  for (const iso of order) fillDay(C, plan, iso);
  // a day that came up short: try re-planning it together with each other day (short day first) and keep the swap if more visits fit overall
  const auto = s => !s.fixed && !s.done && !s.manual;
  for (const iso of C.days){
    if (!(plan.days[iso].short > 0)) continue;
    for (const other of C.days){
      if (other === iso || !(plan.days[iso].short > 0)) continue;
      const A = plan.days[iso], B = plan.days[other];
      const before = A.stops.length + B.stops.length, saveA = JSON.stringify(A), saveB = JSON.stringify(B);
      A.stops = A.stops.filter(s => !auto(s)); B.stops = B.stops.filter(s => !auto(s));
      fillDay(C, plan, iso); fillDay(C, plan, other);
      if (A.stops.length + B.stops.length > before) continue;
      plan.days[iso] = JSON.parse(saveA); plan.days[other] = JSON.parse(saveB);
    }
  }
  for (const iso of C.days) finishDay(C, plan, iso);
  plan.unscheduled = explainUnscheduled(C, plan);
  return {plan, C};
}
function rebuildDay(C, plan, iso){
  // keep calendar visits and calls already marked done; try the next-best area with different doctors
  const day = plan.days[iso];
  const before = new Set(day.stops.filter(s => !s.fixed && !s.done && !s.manual).map(s => s.id));
  day.stops = day.stops.filter(s => s.fixed || s.done || s.manual);
  day.variant = (day.variant || 0) + 1;
  fillDay(C, plan, iso, {variant: day.variant, avoid: before});
  finishDay(C, plan, iso);
  plan.unscheduled = explainUnscheduled(C, plan);
  return day;
}
// a calendar visit that wasn't in the plan yet (someone just added): put it in and re-plan the rest of that day around it
function placeFixed(C, plan, iso){
  const day = plan.days[iso]; if (!day) return [];
  const added = [];
  for (const f of (C.fixed[iso] || [])){
    if (day.stops.some(s => s.id === f.id)) continue;
    for (const k in plan.days) if (k !== iso) plan.days[k].stops = plan.days[k].stops.filter(s => !(s.id === f.id && !s.fixed && !s.done && !s.manual));
    day.stops.push(makeFixedStop(C, f, iso)); added.push(f.id);
  }
  if (!added.length) return added;
  day.stops = day.stops.filter(s => s.fixed || s.done || s.manual);
  fillDay(C, plan, iso, {variant: day.variant || 0});
  finishDay(C, plan, iso);
  plan.unscheduled = explainUnscheduled(C, plan);
  return added;
}
function finishDay(C, plan, iso){
  const day = plan.days[iso];
  const extra = day.stops.filter(s => s.manual).length;
  const o = orderDay(day.stops.filter(s => s.coords), C.home, (day.capAM ?? 4) + extra, (day.capPM ?? 5) + extra);
  day.stops = o.stops.concat(day.stops.filter(s => !s.coords)); day.miles = o.miles;
  const cities = []; day.stops.forEach(s => { const of = s.office != null ? C.offices[s.office] : null; const c = of ? of.city : ""; if (c && !cities.includes(c)) cities.push(c); });
  const fx = day.stops.filter(s => s.fixed && s.coords); day.farApart = null;
  for (let i = 0; i < fx.length; i++) for (let j = i+1; j < fx.length; j++){ const m = miles(km(fx[i].coords, fx[j].coords)); if (m > 40 && (!day.farApart || m > day.farApart.mi)) day.farApart = {a:fx[i].id, b:fx[j].id, mi: Math.round(m)}; }
  day.area = cities.slice(0,3).join(" · ") + (cities.length > 3 ? " +" + (cities.length-3) : "");
}
function weekUse(plan, exceptIso, exceptIdx, addrRule){
  // doctors used anywhere this week; addresses used this week (or only that day when the rule is "day")
  const d = new Set(), a = new Set();
  for (const iso in plan.days) plan.days[iso].stops.forEach((s,i) => { if (iso === exceptIso && i === exceptIdx) return; d.add(s.id); if (!s.manual && (addrRule !== "day" || iso === exceptIso)) a.add(s.addrKey); });
  return {d, a};
}
function substitutes(C, plan, iso, idx, limit){
  const day = plan.days[iso], cur = day.stops[idx];
  const {d:usedD, a:usedA} = weekUse(plan, iso, idx, C.addrRule);
  const others = day.stops.filter((_,i) => i !== idx && day.stops[i].coords).map(s => s.coords);
  const here = cur.coords;
  const center = others.length ? [others.reduce((a,c)=>a+c[0],0)/others.length, others.reduce((a,c)=>a+c[1],0)/others.length] : (cur.coords || C.home);
  const res = [];
  for (const d of C.docs){
    if (d.id === cur.id || usedD.has(d.id) || C.blocked.has(iso + "|" + d.id) || C.seen[d.id]) continue;
    for (const o of optionsFor(C, d.id, iso)){
      if (usedA.has(o.addrKey)) continue;
      if (!(cur.slot === "am" ? o.am : o.pm)) continue;
      const near = here ? km(here, o.coords) : (others.length ? Math.min(...others.map(c => km(c, o.coords))) : km(center, o.coords));
      const sameOffice = o.addrKey === cur.addrKey;
      res.push({...o, slot:cur.slot, doc:d, near, sameOffice, rank: d.score - 0.03 * near + (sameOffice ? 2 : 0)});
    }
  }
  const best = {}; res.forEach(r => { if (!best[r.id] || r.rank > best[r.id].rank) best[r.id] = r; });
  return Object.values(best).sort((a,b) => b.rank - a.rank).slice(0, limit || 12);
}
function addCandidates(C, plan, iso){
  // every doctor with calls left, with the best office for that day; flags say which rules a manual add would bend
  const day = plan.days[iso];
  const todayIds = new Set(day.stops.map(s => s.id)), todayAddr = new Set(day.stops.map(s => s.addrKey));
  const elsewhere = {}; for (const k in plan.days) if (k !== iso) plan.days[k].stops.forEach(s => elsewhere[s.id] = k);
  const pts = day.stops.filter(s => s.coords).map(s => s.coords);
  const out = [];
  for (const d of C.allDocs || C.docs){
    if (todayIds.has(d.id)) continue;
    let best = null;
    for (const i of (C.match.byDoc[d.id] || [])){
      const o = C.offices[i]; if (!o.coords) continue;
      const a = availableOn(o, iso);
      const near = pts.length ? Math.min(...pts.map(c => km(c, o.coords))) : km(C.home, o.coords);
      const cand = {id:d.id, office:i, coords:o.coords, addrKey:o.addrKey, am: a ? a.am : true, pm: a ? a.pm : true, inToday: !!a, near, doc:d,
        sameOffice: todayAddr.has(o.addrKey), elsewhere: elsewhere[d.id] || null, counterpart: C.blocked.has(iso + "|" + d.id) && !C.away.has(iso + "|" + d.id) && !C.streak.has(iso + "|" + d.id), streak: C.streak.has(iso + "|" + d.id), away: C.away.has(iso + "|" + d.id), seen: C.seen[d.id] || null};
      const key = c => (c.inToday ? 0 : 100) + (c.sameOffice ? 0 : 1) + c.near;
      if (!best || key(cand) < key(best)) best = cand;
    }
    if (best) out.push(best);
  }
  return out.sort((a,b) => (b.sameOffice && b.inToday) - (a.sameOffice && a.inToday) || (b.inToday - a.inToday) || (a.near - b.near) || (b.doc.score - a.doc.score));
}
function addManual(C, plan, iso, cand, slot){
  const day = plan.days[iso];
  day.stops.push({id:cand.id, office:cand.office, slot, am: slot === "am", pm: slot === "pm", coords:cand.coords, addrKey:cand.addrKey, manual:true, history:[]});
  finishDay(C, plan, iso);
}
function removeStop(C, plan, iso, idx){
  const day = plan.days[iso]; const s = day.stops.splice(idx, 1)[0];
  if (!s.manual) (day.removed = day.removed || []).push(s);   // planned stops can be put back
  finishDay(C, plan, iso); return s;
}
function restoreStop(C, plan, iso, k){
  const day = plan.days[iso]; const s = (day.removed || [])[k]; if (!s) return {ok:false};
  const {d, a} = weekUse(plan, null, -1, C.addrRule);
  if (d.has(s.id)) return {ok:false, reason:"conflict-doc", id:s.id};
  if (!s.fixed && C.addrRule !== "day" && a.has(s.addrKey)) return {ok:false, reason:"conflict-addr", id:s.id};
  day.removed.splice(k, 1); day.stops.push(s); finishDay(C, plan, iso); return {ok:true, id:s.id};
}
function moveOptions(C, plan, iso, idx){
  // For every other planned day: can this doctor go there without breaking a rule?
  const s = plan.days[iso].stops[idx];
  const {d:usedD, a:usedA} = weekUse(plan, iso, idx, C.addrRule);
  const out = [];
  for (const k of Object.keys(plan.days).sort()){
    if (k === iso) continue;
    const day = plan.days[k];
    const dayAddr = new Set(day.stops.map(x => x.addrKey));
    const opts = optionsFor(C, s.id, k);
    let reason = null, pick = null;
    if (!(C.match.byDoc[s.id] || []).length) reason = "Not in your spreadsheet";
    else if (!opts.length) reason = "Not in that day, per your spreadsheet";
    else if (C.away.has(k + "|" + s.id)) reason = "Out of office that day";
    else if (C.streak.has(k + "|" + s.id)) reason = "That would make three of you on three days in a row";
    else if (C.blocked.has(k + "|" + s.id)) reason = "A counterpart is seeing them that day";
    else if (usedD.has(s.id)) reason = "Already planned another day";
    else {
      pick = opts.find(o => !(C.addrRule === "day" ? dayAddr.has(o.addrKey) : usedA.has(o.addrKey)));
      if (!pick) reason = C.addrRule === "day" ? "You're already at that office that day" : "You're visiting that office another day";
    }
    const pts = day.stops.filter(x => x.coords).map(x => x.coords);
    const near = pick && pts.length ? Math.min(...pts.map(c => km(c, pick.coords))) : null;
    out.push({iso:k, ok: !reason, reason, opt: pick, count: day.stops.length, near});
  }
  return out;
}
function moveStop(C, plan, iso, idx, toIso, opt){
  const s = plan.days[iso].stops.splice(idx, 1)[0];
  plan.days[toIso].stops.push({id:s.id, office:opt.office, slot: opt.am ? "am" : "pm", am:opt.am, pm:opt.pm, coords:opt.coords, addrKey:opt.addrKey, history:[], movedFrom: iso});
  finishDay(C, plan, iso); finishDay(C, plan, toIso);
}
function applySubstitute(C, plan, iso, idx, opt){
  const day = plan.days[iso], cur = day.stops[idx];
  const next = {id:opt.id, office:opt.office, slot:cur.slot, am:opt.am, pm:opt.pm, coords:opt.coords, addrKey:opt.addrKey, history: cur.history.concat([{id:cur.id, office:cur.office, am:cur.am, pm:cur.pm, coords:cur.coords, addrKey:cur.addrKey, fixed:cur.fixed, note:cur.note, time:cur.time}])};
  day.stops[idx] = next; finishDay(C, plan, iso);
  return next;
}
function undoSubstitute(C, plan, iso, idx){
  const day = plan.days[iso], cur = day.stops[idx];
  if (!cur.history.length) return {ok:false, reason:"Nothing to undo."};
  const prev = cur.history[cur.history.length-1];
  const {d, a} = weekUse(plan, iso, idx, C.addrRule);
  if (d.has(prev.id)) return {ok:false, reason:"conflict-doc", id:prev.id};
  if (a.has(prev.addrKey)) return {ok:false, reason:"conflict-addr", id:prev.id};
  day.stops[idx] = {...prev, slot:cur.slot, history: cur.history.slice(0,-1)};
  finishDay(C, plan, iso);
  return {ok:true, id:prev.id};
}
function explainUnscheduled(C, plan){
  const {d:used} = weekUse(plan, null, -1, C.addrRule);
  const out = C.docs.filter(d => !used.has(d.id)).sort((a,b) => b.score - a.score).map(d => {
    const offs = (C.match.byDoc[d.id]||[]).map(i => C.offices[i]);
    let why;
    if (C.seen[d.id]) why = "Already called this week (" + fromISO(C.seen[d.id]).toLocaleDateString(undefined,{weekday:"short"}) + ")";
    else if (!offs.length) why = "Not found in your spreadsheet";
    else if (offs.every(o => !o.avail)) why = "No days listed in your spreadsheet";
    else if (offs.every(o => o.onLeave)) why = "Spreadsheet notes say on leave";
    else if (offs.every(o => !o.coords)) why = "City not recognized";
    else if (C.allowed && (C.match.byDoc[d.id]||[]).every(i => !C.allowed.has(i))) why = "Outside this week's zone";
    else {
      const avDays = C.days.filter(iso => optionsFor(C, d.id, iso).length);
      if (!avDays.length) why = "Not in on the days you're working";
      else if (avDays.every(iso => C.away.has(iso + "|" + d.id))) why = "Out of office";
      else if (avDays.every(iso => C.blocked.has(iso + "|" + d.id))) why = avDays.some(iso => C.away.has(iso + "|" + d.id)) ? "Out of office or a counterpart is seeing them" : "Counterparts see them on, or right around, the only days they're in";
      else why = "Didn't fit this week's areas";
    }
    return {id:d.id, why};
  });
  return out.filter(u => u.why !== "Outside this week's zone").concat(out.filter(u => u.why === "Outside this week's zone"));
}
function checkPlan(C, plan){
  // returns list of rule problems (used by tests and shown if anything is off)
  const probs = [], seenD = new Map(), seenA = new Map();
  for (const iso in plan.days) plan.days[iso].stops.forEach(s => {
    if (s.manual) return;
    if (seenD.has(s.id)) probs.push("doctor twice: " + s.id); seenD.set(s.id, iso);
    const ak = C.addrRule === "day" ? iso + "|" + s.addrKey : s.addrKey;
    if (seenA.has(ak)) probs.push("address twice: " + s.addrKey); seenA.set(ak, iso);
    if (C.away.has(iso + "|" + s.id)) probs.push("out of office: " + s.id + " " + iso);
    else if (C.blocked.has(iso + "|" + s.id) && !(s.fixed && C.streak.has(iso + "|" + s.id))) probs.push((C.streak.has(iso + "|" + s.id) ? "three days in a row: " : "counterpart same day: ") + s.id + " " + iso);
    if (!s.fixed){ const a = s.office != null ? availableOn(C.offices[s.office], iso) : null; if (!a || !(s.slot === "am" ? a.am : a.pm)) probs.push("not available: " + s.id + " " + iso + " " + s.slot); }
  });
  return probs;
}

/* ---------------- loading the tracker's numbers ---------------- */
function docsFromTrackerFile(obj){
  // accepts the tracker's routing export, its backup file, or the tracker's saved data on this device
  const todayISO = isoDay(new Date());
  if (obj && obj.format === "calltracker-remaining-calls" && Array.isArray(obj.doctors))
    return obj.doctors.map(r => ({id:normName(r.name), name:String(r.name).toUpperCase(), city:r.city||"", remaining:+r.remaining||0, assigned:+r.assigned||0, completed:+r.completed||0, lastCall:r.lastCall||null, daysSinceLastCall:r.daysSinceLastCall ?? null, callsPerWeekNeeded:r.callsPerWeekNeeded ?? null})).filter(d => d.remaining > 0);
  if (obj && Array.isArray(obj.doctors) && obj.doctors.length && "r0" in obj.doctors[0]){
    const end = obj.planEnd && obj.planEnd >= todayISO ? obj.planEnd : null;
    const weeksLeft = end ? Math.max(1, Math.ceil((Math.round((fromISO(end)-fromISO(todayISO))/864e5)+1)/7)) : null;
    return obj.doctors.map(d => {
      const rem = Math.max(0, d.r0 - d.log.length); const lc = d.log.concat(d.hist || [], d.lastRpt ? [d.lastRpt] : []).sort().pop() || null;
      return {id:normName(d.name), name:d.name, city:d.city, remaining:rem, assigned:d.a, completed:d.c0 + d.log.length, lastCall:lc, added: !!d.added, kind: d.kind || "",
        daysSinceLastCall: lc ? Math.round((fromISO(todayISO)-fromISO(lc))/864e5) : null, callsPerWeekNeeded: d.added ? 0 : (weeksLeft ? rem/weeksLeft : null),
        noAuto: !d.added && rem <= 0};
    });
  }
  throw new Error("That file isn't a remaining-calls export from the Call Tracker.");
}
function docsFromCSV(text){
  const rows = csvRows(text); const H = rows[0].map(h => h.toLowerCase());
  const c = n => H.findIndex(h => h.includes(n));
  const iN = c("doctor"), iC = c("city"), iR = c("remaining"), iA = c("assigned"), iL = c("last call"), iD = c("days since"), iW = c("per week");
  if (iN < 0 || iR < 0) throw new Error("That CSV isn't a remaining-calls export from the Call Tracker.");
  return rows.slice(1).filter(r => r[iN]).map(r => ({id:normName(r[iN]), name:r[iN].toUpperCase(), city:r[iC]||"", remaining:+r[iR]||0, assigned:+r[iA]||0, lastCall:r[iL]||null,
    daysSinceLastCall: r[iD] === "" || r[iD] == null ? null : +r[iD], callsPerWeekNeeded: r[iW] === "" || r[iW] == null ? null : +r[iW]})).filter(d => d.remaining > 0);
}
function csvRows(text){
  const rows = []; let row = [], cell = "", q = false;
  for (let i=0;i<text.length;i++){
    const ch = text[i];
    if (q){ if (ch === '"' && text[i+1] === '"'){ cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ","){ row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r"){ if (ch === "\r" && text[i+1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += ch;
  }
  if (cell || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}

const api = {parseSharedWeek, isPerson, ANYTIME, availText, splitCity, detectColumns, isoDay, fromISO, addDays, mondayOf, weekDays, CITIES, cityCoords, km, miles, parseAvailability, splitSheetName, addressKey,
  officesFromRows, normName, matchDoctors, buildNameIndex, findDoctorsInText, parseICS, expandEvents, classifyEvent, MEAL_RE: MEAL, parseTSV,
  scheduleFromWords, scoreDoctors, availableOn, planWeek, rebuildDay, placeFixed, fillDay, addCandidates, addManual, removeStop, restoreStop, moveOptions, moveStop, officeInZone, zipOf, cityKey, buildContext, substitutes, applySubstitute, undoSubstitute, checkPlan, finishDay,
  docsFromTrackerFile, docsFromCSV, csvRows, explainUnscheduled};
if (typeof module !== "undefined") module.exports = api; else root.RouteLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
