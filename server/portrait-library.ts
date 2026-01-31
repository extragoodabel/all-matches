// Portrait asset type supporting multiple sources
export type PortraitAsset = {
  source: "unsplash" | "burst" | "local";
  id?: string;   // for unsplash
  url?: string;  // for burst or local
};

// Import Burst library
import { BURST_MEN, BURST_WOMEN, BURST_OTHER } from "./burst-library";

// Helper to convert unsplash ID to PortraitAsset
const unsplash = (id: string): PortraitAsset => ({ source: "unsplash", id });
const burst = (url: string): PortraitAsset => ({ source: "burst", url });
const local = (url: string): PortraitAsset => ({ source: "local", url });

// Curated Unsplash portrait photo IDs - timestamp format (NNNNNNNNNNNN-suffix)
// Last cleaned: Jan 2026 - removed 70 more broken images, 168 verified working

export const MEN_PORTRAIT_ASSETS: PortraitAsset[] = [
  // Verified working male portraits from Unsplash
  unsplash("1506794778202-cad84cf45f1d"),
  unsplash("1560250097-0b93528c311a"),
  unsplash("1507003211169-0a1dd7228f2d"),
  unsplash("1500648767791-00dcc994a43e"),
  unsplash("1472099645785-5658abf4ff4e"),
  unsplash("1519345182560-3f2917c472ef"),
  unsplash("1463453091185-61582044d556"),
  unsplash("1492562080023-ab3db95bfbce"),
  unsplash("1507591064344-4c6ce005b128"),
  unsplash("1534614971-6be99a7a3ffd"),
  unsplash("1522556189639-b150ed9c4330"),
  unsplash("1539571696357-5a69c17a67c6"),
  unsplash("1540569014015-19a7be504e3a"),
  unsplash("1557862921-37829c790f19"),
  unsplash("1564564321837-a57b7070ac4f"),
  unsplash("1583864697784-a0efc8379f70"),
  unsplash("1528892952291-009c663ce843"),
  unsplash("1519085360753-af0119f7cbe7"),
  unsplash("1531384441138-2736e62e0919"),
  unsplash("1489980557514-251d61e3eeb6"),
  unsplash("1607990281513-2c110a25bd8c"),
  unsplash("1567784177951-6fa58317e16b"),
  unsplash("1573007974656-b958089e9f7b"),
  unsplash("1583195764036-6dc248ac07d9"),
  unsplash("1620000617482-821324eb9a14"),
  unsplash("1566492031773-4f4e44671857"),
  unsplash("1633332755192-727a05c4013d"),
  unsplash("1581803118522-7b72a50f7e9f"),
  unsplash("1513956589380-bad6acb9b9d4"),
  unsplash("1555952517-2e8e729e0b44"),
  unsplash("1570295999919-56ceb5ecca61"),
  unsplash("1596075780750-81249df16d19"),
  unsplash("1590086782957-93c06ef21604"),
  unsplash("1584999734482-0361aecad844"),
  unsplash("1525357816819-392d2380d821"),
  unsplash("1556474835-b0f3ac40d4d1"),
  unsplash("1561677843-39dee7a319ca"),
  unsplash("1566753323558-f4e0952af115"),
  unsplash("1545167622-3a6ac756afa4"),
  unsplash("1617137984095-74e4e5e3613f"),
  unsplash("1474176857210-7287d38d27c6"),
  unsplash("1520341280432-4749d4d7bcf9"),
  unsplash("1527980965255-d3b416303d12"),
  unsplash("1535713875002-d1d0cf377fde"),
  unsplash("1542327897-d73f4005b533"),
  unsplash("1557804506-669a67965ba0"),
  unsplash("1624561172888-ac93c696e10c"),
  unsplash("1629467057571-42d22d8f0cbd"),
  unsplash("1504257432389-52343af06ae3"),
  unsplash("1521119989659-a83eee488004"),
  unsplash("1522529599102-193c0d76b5b6"),
  unsplash("1530268729831-4b0b9e170218"),
  unsplash("1531427186611-ecfd6d936c79"),
  unsplash("1534308143481-c55f00be8bd7"),
  unsplash("1537511446984-935f663eb1f4"),
  unsplash("1541614101331-1a5a3a194e92"),
  unsplash("1543610892-0b1f7e6d8ac1"),
  unsplash("1545996124-0501ebae84d0"),
  unsplash("1548372290-8d01b6c8e78c"),
  unsplash("1556157382-97eda2d62296"),
  unsplash("1558618666-fcd25c85cd64"),
  unsplash("1570158268183-d296b2892211"),
  unsplash("1578176603894-57973e38890f"),
  unsplash("1591084728795-1149f32d9866"),
  unsplash("1531891437562-4301cf35b7e4"),
  unsplash("1503235930437-8c6293ba41f5"),
  unsplash("1533636721434-0e2d61030955"),
  unsplash("1516914943479-89db7d9ae7f2"),
  unsplash("1603415526960-f7e0328c63b1"),
  unsplash("1497551060073-4c5ab6435f12"),
  unsplash("1586297098710-0382a496c814"),
  unsplash("1444069069008-83a57aac43ac"),
  unsplash("1577880216142-8549e9488dad"),
  unsplash("1607031542107-f6f46b5d54e9"),
  unsplash("1624395213043-fa2e123b2656"),
  unsplash("1594672830234-ba4cfe1202dc"),
  unsplash("1587397845856-e6cf49176c70"),
  unsplash("1636377985931-898218afd306"),
  unsplash("1583195763986-0231686dcd43"),
  unsplash("1600486913747-55e5470d6f40"),
  local("/portraits/burger-guy.jpg"),
  local("/portraits/glasses-guy.jpg"),
  // Burst portraits
  ...BURST_MEN.map(burst),
];

// Androgynous/non-binary portrait assets - curated for "other" gender profiles
export const ANDROGYNOUS_PORTRAIT_ASSETS: PortraitAsset[] = [
  unsplash("1531123897727-8f129e1688ce"),
  unsplash("1517365830460-955ce3ccd263"),
  unsplash("1544348817-5f2cf14b88c8"),
  unsplash("1534180477871-5d6cc81f3920"),
  unsplash("1504703395950-b89145a5425b"),
  unsplash("1519699047748-de8e457a634e"),
  unsplash("1484517586036-ed3db9e3749e"),
  unsplash("1529665253569-6d01c0eaf7b6"),
  unsplash("1524250502761-1ac6f2e30d43"),
  unsplash("1542103749-8ef59b94f47e"),
  unsplash("1488426862026-3ee34a7d66df"),
  unsplash("1438761681033-6461ffad8d80"),
  unsplash("1531853121101-cb94c8ed218d"),
  unsplash("1522075469751-3a6694fb2f61"),
  unsplash("1526510747491-58f928ec870f"),
  unsplash("1502767089025-6572583495f9"),
  unsplash("1593085512500-5d55148d6f0d"),
  unsplash("1529068755536-a5ade0dcb4e8"),
  unsplash("1560807707-8cc77767d783"),
  unsplash("1582794543139-8ac9cb0f7b11"),
  unsplash("1613679074971-91fc27180061"),
  unsplash("1623582854588-d60de57fa33f"),
  unsplash("1609951651556-5334e2706168"),
  unsplash("1554151228-14d9def656e4"),
  unsplash("1607746882042-944635dfe10e"),
  unsplash("1509460913899-515f1df34fea"),
  unsplash("1519058082700-08a0b56da9b4"),
  unsplash("1512361436605-a484bdb34b5f"),
  unsplash("1582093236149-516a8be696fe"),
  unsplash("1547425260-76bcadfb4f2c"),
  unsplash("1517841905240-472988babdf9"),
  unsplash("1509967419530-da38b4704bc6"),
  unsplash("1487412720507-e7ab37603c6f"),
  unsplash("1529626455594-4ff0802cfb7e"),
  unsplash("1485893226355-9a1c32a0c81e"),
  unsplash("1574180566232-aaad1b5b8450"),
  unsplash("1562159278-1253a58da141"),
  unsplash("1554080353-a576cf803bda"),
  unsplash("1599566219227-2efe0c9b7f5f"),
  // Burst portraits
  ...BURST_OTHER.map(burst),
  // Local generated portraits (compressed JPEGs)
  local("/portraits/profile_10_isaac_21.jpg"),
  local("/portraits/profile_10_morgan_c__25.jpg"),
  local("/portraits/profile_11_evan_l__21.jpg"),
  local("/portraits/profile_13_noah_t__25.jpg"),
  local("/portraits/profile_16_theo_t__25.jpg"),
  local("/portraits/profile_6_isaac_24.jpg"),
  local("/portraits/profile_6_mina_j__21.jpg"),
  local("/portraits/profile_6_reese_t__40.jpg"),
  local("/portraits/profile_7_charlie_r__40.jpg"),
  local("/portraits/profile_7_lena_26.jpg"),
  local("/portraits/profile_7_lena_c__32.jpg"),
  local("/portraits/profile_7_logan_t__44.jpg"),
  local("/portraits/profile_7_taylor_g__43.jpg"),
  local("/portraits/profile_8_caleb_p__32.jpg"),
  local("/portraits/profile_8_logan_40.jpg"),
  local("/portraits/profile_9_leo_21.jpg"),
  local("/portraits/profile_9_reese_41.jpg"),
  // Curated Unsplash portraits (Jan 2026)
  unsplash("1768489038118-353427798951"),
  unsplash("1768470039304-25fbe6691565"),
  unsplash("1768413167547-a35de5f4bf59"),
  unsplash("1768405942784-0d48a1f44fe7"),
  unsplash("1768515048597-5dfed4cf7e74"),
  unsplash("1768149712752-bf2aa65439e8"),
  unsplash("1768127502130-bca3e208eba6"),
  unsplash("1767027151557-43af9bea44f2"),
  unsplash("1766939228669-999a8509630b"),
  unsplash("1767958465025-75c050ab10c4"),
  unsplash("1765530813405-d23f98fda0b4"),
  unsplash("1766228385031-ad983e6a360e"),
  unsplash("1767920787831-644f2b59d960"),
  unsplash("1767329300783-78ee1201a4cd"),
  unsplash("1767792116845-b33f06ef7eaf"),
  unsplash("1767732337868-335e85582d0b"),
  unsplash("1767027151398-b38c23f3cd11"),
  unsplash("1767392060677-bb61631f538d"),
  unsplash("1766678003099-9df6ac5f3749"),
  unsplash("1767398284852-84ac6051d1c4"),
  unsplash("1767328706862-caad99c45ca5"),
  unsplash("1767327926598-ae16cd6c7c8d"),
  unsplash("1767249615394-c2f36d563a2d"),
  unsplash("1766855872346-2eae21fe5425"),
  unsplash("1766939228519-5f498be33e65"),
  unsplash("1767111392691-fdbb6a000bfe"),
  unsplash("1767127045374-269e82e4e5df"),
  unsplash("1766964855974-1dfcf5107823"),
  unsplash("1766995920188-d26198a4e22e"),
  unsplash("1766543497004-2fd76e88f605"),
  unsplash("1764593008195-87ca871d72bd"),
  unsplash("1766693931661-f08765fcfc00"),
  unsplash("1766282088801-cad8cbae5ed5"),
  unsplash("1766469295724-193a0f282de4"),
  unsplash("1766353862926-aa3816960c84"),
  unsplash("1766469284258-11bf4223e2af"),
  unsplash("1766039132515-ea88dc3950bd"),
  unsplash("1766036388696-6f51dbc95635"),
  unsplash("1765870909790-f01a1bb2074d"),
  unsplash("1765568562615-4bf854edcf1a"),
  unsplash("1765804015672-c5a0b61cb389"),
  unsplash("1765506265670-9e1c53f3a0e8"),
  unsplash("1765743353154-54481abe0591"),
  unsplash("1765219272225-465c8e9f433c"),
  unsplash("1765684145185-387b6c69bef1"),
  unsplash("1765219272245-6e683e737628"),
  unsplash("1765506255227-2feaa9bd58ec"),
  unsplash("1765469504987-465faff4f2b1"),
  unsplash("1765451817030-212c79167e2f"),
  unsplash("1765394805239-aa07aeac4dcd"),
  unsplash("1765334666990-1bf2ce733864"),
  unsplash("1765296123897-1650215ad87c"),
  unsplash("1765285353856-0d00e478f2c8"),
  unsplash("1765172302295-ba8396cdab64"),
  unsplash("1765248149215-b0c913b904fd"),
  unsplash("1765084217224-b30cc385d343"),
  unsplash("1765153417760-76135ea38f88"),
  unsplash("1764662028080-227b6ccc808f"),
  unsplash("1763849048711-8fb2f633d5dc"),
  unsplash("1764805201909-e5ba59108cdd"),
  unsplash("1764889743602-21cd1d4e4745"),
  unsplash("1764789953395-59ffc3157f71"),
  unsplash("1764873810740-228202967640"),
  unsplash("1764046697690-03c6533e13d9"),
  unsplash("1764593154804-e7646a005ce0"),
  unsplash("1763757321139-e7e4de128cd9"),
  unsplash("1764674112417-4f1a2a67e197"),
  unsplash("1764592358977-a181a6e71af4"),
  unsplash("1764281518120-da4a5757f8af"),
  unsplash("1763598339417-f540c12a8fcd"),
  unsplash("1764287336801-5ba6b81dceae"),
  unsplash("1764069415137-756fbca30a17"),
  unsplash("1764018605007-1969b09f3ecc"),
  unsplash("1764078314427-41f0a05613d7"),
  unsplash("1763894128200-eccef19ae5c7"),
  unsplash("1764017884266-b53a65cf0044"),
  unsplash("1763560276646-8315f3fe55f7"),
  unsplash("1762764919450-560fd6515192"),
  unsplash("1760137658025-2d475f9ac9e4"),
  unsplash("1763598925601-dae5e1c30ce3"),
  unsplash("1763013373779-19e259f95b41"),
  unsplash("1762324858945-3fd82fe78bcd"),
  unsplash("1763368230845-150be8503232"),
  unsplash("1760137772976-1d0bd08ef888"),
  unsplash("1762954419322-f4fe43ece823"),
  unsplash("1763328728510-064ea03a1f8a"),
  unsplash("1762770647310-66f492eb832f"),
  unsplash("1742201876600-fbb37a2ff6ca"),
  unsplash("1762745188344-e453c5474d79"),
  unsplash("1763420309077-ef9b8724b291"),
  unsplash("1762793193663-cc343d78111c"),
  unsplash("1763152496539-302ef51ef66f"),
  unsplash("1762944081368-e9be10d24841"),
  unsplash("1762605135332-8a7ce1403187"),
  unsplash("1762421670361-974d54d7b5c3"),
  unsplash("1762391965624-279023a2481d"),
  unsplash("1761706745195-26e5eef2fe3c"),
  unsplash("1762936263573-af3e0d866980"),
  unsplash("1762893021980-b6accb9b94d9"),
  unsplash("1762784575331-66618cc4884a"),
  unsplash("1762452643845-1b1107f3922d"),
  unsplash("1762647912263-90f0b45f9a2d"),
  unsplash("1762757076979-cc016f6df284"),
  unsplash("1761882619891-6529ff92df0a"),
  unsplash("1761522002071-67755dc6c820"),
  unsplash("1762526227019-0a7294ba6724"),
  unsplash("1762438473679-0a6a4de908b3"),
  unsplash("1762148038110-af994aa925f7"),
  unsplash("1761979658580-5b275fc3eb95"),
  unsplash("1762307125835-fbbd0450b8a8"),
];

export const WOMEN_PORTRAIT_ASSETS: PortraitAsset[] = [
  // Verified working female portraits from Unsplash
  unsplash("1580489944761-15a19d654956"),
  unsplash("1557053910-d9eadeed1c58"),
  unsplash("1592621385612-4d7129426394"),
  unsplash("1573496359142-b8d87734a5a2"),
  unsplash("1506863530036-1efeddceb993"),
  unsplash("1614283233556-f35b0c801ef1"),
  unsplash("1524504388940-b1c1722653e1"),
  unsplash("1489424731084-a5d8b219a5bb"),
  unsplash("1508214751196-bcfd4ca60f91"),
  unsplash("1520813792240-56fc4a3765a7"),
  unsplash("1541101767792-f9b2b1c4f127"),
  unsplash("1552699611-e2c208d5d9cf"),
  unsplash("1558898479-33c0057a5d12"),
  unsplash("1601288496920-b6154fe3626a"),
  unsplash("1616766098956-c81f12114571"),
  unsplash("1545912452-8aea7e25a3d3"),
  unsplash("1498551172505-8ee7ad69f235"),
  unsplash("1488716820095-cbe80883c496"),
  unsplash("1484399172022-72a90b12e3c1"),
  unsplash("1479936343636-73cdc5aae0c3"),
  unsplash("1469334031218-e382a71b716b"),
  unsplash("1434030216411-0b793f4b4173"),
  unsplash("1542596594-649edbc13630"),
  unsplash("1610030469983-98e550d6193c"),
  unsplash("1485199692108-c3b5069de6a0"),
  unsplash("1491349174775-aaafddd81942"),
  unsplash("1504276048855-f3d60e69632f"),
  unsplash("1569124589354-615739ae007b"),
  unsplash("1581044777550-4cfa60707c03"),
  unsplash("1514315384763-ba401779410f"),
  unsplash("1516726817505-f5ed825624d8"),
  unsplash("1563132337-f159f484226c"),
  unsplash("1569913486515-b74bf7751574"),
  unsplash("1579503841516-e0bd7fca5faa"),
  unsplash("1531746020798-e6953c6e8e04"),
  unsplash("1564564295391-7f24f26f568b"),
  unsplash("1548142813-c348350df52b"),
  unsplash("1544005313-94ddf0286df2"),
  unsplash("1550525811-e5869dd03032"),
  unsplash("1627161683077-e34782c24d81"),
  unsplash("1589156280159-27698a70f29e"),
  unsplash("1574701148212-8518049c7b2c"),
  unsplash("1619946794135-5bc917a27793"),
  unsplash("1534528741775-53994a69daeb"),
  unsplash("1610655507808-a59293f4e332"),
  unsplash("1609505848912-b7c3b8b4beda"),
  unsplash("1546961329-78bef0414d7c"),
  unsplash("1581403341630-a6e0b9d2d257"),
  unsplash("1557053908-4793c484d06f"),
  // Burst portraits
  ...BURST_WOMEN.map(burst),
];

// Legacy exports for backward compatibility - just the string IDs
export const MEN_PORTRAIT_IDS: string[] = MEN_PORTRAIT_ASSETS
  .filter(a => a.source === "unsplash" || a.source === "local")
  .map(a => a.id || a.url || "");

export const WOMEN_PORTRAIT_IDS: string[] = WOMEN_PORTRAIT_ASSETS
  .filter(a => a.source === "unsplash" || a.source === "local")
  .map(a => a.id || a.url || "");

export const ANDROGYNOUS_PORTRAIT_IDS: string[] = ANDROGYNOUS_PORTRAIT_ASSETS
  .filter(a => a.source === "unsplash" || a.source === "local")
  .map(a => a.id || a.url || "");

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Get a unique key for a PortraitAsset (used for deduplication)
export function getAssetKey(asset: PortraitAsset): string {
  if (asset.source === "unsplash") {
    return `unsplash:${asset.id}`;
  } else if (asset.source === "burst") {
    return `burst:${asset.url}`;
  } else {
    return `local:${asset.url}`;
  }
}

// Build image URL from a PortraitAsset
export function buildImageUrl(asset: PortraitAsset | string, profileId: number): string {
  // Handle legacy string format
  if (typeof asset === "string") {
    if (asset.startsWith('/')) {
      return asset;
    }
    if (asset.startsWith('http')) {
      return asset;
    }
    return `https://images.unsplash.com/photo-${asset}?auto=format&fit=crop&w=600&h=900&q=80&v=${profileId}`;
  }
  
  // Handle PortraitAsset
  if (asset.source === "unsplash") {
    return `https://images.unsplash.com/photo-${asset.id}?auto=format&fit=crop&w=600&h=900&q=80&v=${profileId}`;
  } else if (asset.source === "burst") {
    return asset.url || "";
  } else {
    return asset.url || "";
  }
}

export const LOCAL_MALE_PORTRAITS: string[] = [
  '/portraits/burger-guy.jpg',
  '/portraits/glasses-guy.jpg',
];
