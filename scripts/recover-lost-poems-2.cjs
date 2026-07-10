const fs = require('fs');
const crypto = require('crypto');

// Add 10 new poets
const poetsFile = 'src/data/poets.json';
const poets = JSON.parse(fs.readFileSync(poetsFile, 'utf8'));
const newPoets = [
  { name: '李清照', birthYear: 1084, deathYear: 1155, dynastyId: 'song' },
  { name: '王观', birthYear: 1035, deathYear: 1106, dynastyId: 'song' },
  { name: '范成大', birthYear: 1126, deathYear: 1193, dynastyId: 'song' },
  { name: '王冕', birthYear: 1287, deathYear: 1359, dynastyId: 'other' },
  { name: '罗隐', birthYear: 833, deathYear: 909, dynastyId: 'tang' },
  { name: '郑思肖', birthYear: 1241, deathYear: 1318, dynastyId: 'song' },
  { name: '毛泽东', birthYear: 1893, deathYear: 1976, dynastyId: 'modern' },
  { name: '于谦', birthYear: 1398, deathYear: 1457, dynastyId: 'ming' },
  { name: '郑燮', birthYear: 1693, deathYear: 1765, dynastyId: 'qing' },
  { name: '黄庭坚', birthYear: 1045, deathYear: 1105, dynastyId: 'song' }
];

const poetIdByName = Object.fromEntries(poets.map(p => [p.name, p.id]));
for (const p of newPoets) {
  if (poetIdByName[p.name]) {
    console.log('  poet exists:', p.name, '→', poetIdByName[p.name]);
    continue;
  }
  const id = crypto.randomBytes(4).toString('hex');
  poetIdByName[p.name] = id;
  poets.push({ id, ...p, familiarity: 1, corpus: 'primary' });
  console.log('  + poet:', p.name, id);
}
fs.writeFileSync(poetsFile, JSON.stringify(poets, null, 2) + '\n');

// Add poems
const poemsFile = 'src/data/poems.json';
const poems = JSON.parse(fs.readFileSync(poemsFile, 'utf8'));
const newPoems = [
  { title: '夏日绝句', poetName: '李清照', content: '生当作人杰，死亦为鬼雄。至今思项羽，不肯过江东。',
    annotations: [
      { term: '人杰', explanation: '人中的豪杰。' },
      { term: '鬼雄', explanation: '鬼中的英雄。' },
      { term: '项羽', explanation: '秦末起义军领袖，自立为西楚霸王，后被刘邦击败，自刎于乌江。' },
      { term: '江东', explanation: '长江下游今江苏南部和浙江北部一带，项羽起兵之地。' }
    ],
    background: '此诗借古讽今，通过歌颂项羽的悲壮，讽刺南宋朝廷偏安一隅、不思进取的投降政策。',
    familiarity: 2 },
  { title: '西江月·夜行黄沙道中', poetName: '辛弃疾', content: '明月别枝惊鹊，清风半夜鸣蝉。稻花香里说丰年，听取蛙声一片。七八个星天外，两三点雨山前。旧时茅店社林边，路转溪桥忽见。',
    annotations: [
      { term: '西江月', explanation: '词牌名。' },
      { term: '黄沙', explanation: '黄沙岭，在江西上饶西。' },
      { term: '别枝惊鹊', explanation: '明月的光把枝头的鹊惊动了。' },
      { term: '社林', explanation: '土地庙附近的树林。' }
    ],
    background: '此词是辛弃疾闲居江西上饶时，夜行黄沙道中所作。描绘了农村夏夜的幽美景色，表达了诗人对丰收之年的喜悦。',
    familiarity: 2 },
  { title: '卜算子·送鲍浩然之浙东', poetName: '王观', content: '水是眼波横，山是眉峰聚。欲问行人去那边？眉眼盈盈处。才始送春归，又送君归去。若到江南赶上春，千万和春住。',
    annotations: [
      { term: '卜算子', explanation: '词牌名。' },
      { term: '鲍浩然', explanation: '生平不详，词人的朋友。' },
      { term: '浙东', explanation: '今浙江东南部。' },
      { term: '眼波', explanation: '比喻流水。' },
      { term: '眉峰', explanation: '比喻山。' },
      { term: '盈盈', explanation: '美好的样子。' }
    ],
    background: '这是一首送别词，借山水比喻眉眼，抒发惜春送友之情。',
    familiarity: 1 },
  { title: '独坐敬亭山', poetName: '李白', content: '众鸟高飞尽，孤云独去闲。相看两不厌，只有敬亭山。',
    annotations: [
      { term: '敬亭山', explanation: '在今安徽宣城北。' },
      { term: '尽', explanation: '没有了。' },
      { term: '闲', explanation: '清闲悠然。' },
      { term: '厌', explanation: '满足。' }
    ],
    background: '此诗是李白长期飘泊，怀才不遇，登敬亭山有感而作。诗人通过敬亭山描写了大自然的美好，抒发了自己孤独的情感。',
    familiarity: 3 },
  { title: '四时田园杂兴', poetName: '范成大', content: '昼出耘田夜绩麻，村庄儿女各当家。童孙未解供耕织，也傍桑阴学种瓜。',
    annotations: [
      { term: '杂兴', explanation: '随兴写来，没有固定题材。' },
      { term: '耘田', explanation: '除草。' },
      { term: '绩麻', explanation: '把麻搓成线。' },
      { term: '各当家', explanation: '各人都担任一定的工作。' },
      { term: '童孙', explanation: '幼小的孙子。' },
      { term: '未解', explanation: '不懂。' },
      { term: '供', explanation: '从事。' },
      { term: '傍', explanation: '靠近。' },
      { term: '桑阴', explanation: '桑树的阴凉下。' }
    ],
    background: '《四时田园杂兴》是范成大归隐田园后所作的一组大型田园诗，共60首，分春日、晚春、夏日、秋日、冬日五组。此为其中一首，写农村生活的繁忙景象。',
    familiarity: 2 },
  { title: '墨梅', poetName: '王冕', content: '我家洗砚池头树，朵朵花开淡墨痕。不要人夸好颜色，只留清气满乾坤。',
    annotations: [
      { term: '墨梅', explanation: '水墨画的梅花。' },
      { term: '洗砚池', explanation: '写字、画画后洗笔洗砚的池子。王羲之有\"墨池\"，王冕自称洗砚池。' },
      { term: '淡墨痕', explanation: '淡黑色的痕迹，指花的颜色。' },
      { term: '清气', explanation: '清香之气。' },
      { term: '乾坤', explanation: '天地间。' }
    ],
    background: '此诗是王冕题画梅的诗。诗人借墨梅不求人夸、只愿给人间留下清香的美德，表达了不向世俗献媚的高尚情操。',
    familiarity: 2 },
  { title: '蜂', poetName: '罗隐', content: '不论平地与山尖，无限风光尽被占。采得百花成蜜后，为谁辛苦为谁甜？',
    annotations: [
      { term: '山尖', explanation: '山顶。' },
      { term: '占', explanation: '占有。' }
    ],
    background: '此诗通过对蜜蜂形象的描写，歌颂了蜜蜂辛勤劳动的精神，同时讽喻了那些不劳而获的人。',
    familiarity: 2 },
  { title: '稚子弄冰', poetName: '杨万里', content: '稚子金盆脱晓冰，彩丝穿取当银钲。敲成玉磬穿林响，忽作玻璃碎地声。',
    annotations: [
      { term: '稚子', explanation: '幼小的孩子。' },
      { term: '金盆', explanation: '金属盆。' },
      { term: '脱', explanation: '取下。' },
      { term: '晓冰', explanation: '早晨的冰块。' },
      { term: '彩丝', explanation: '彩色丝线。' },
      { term: '钲', explanation: '古代一种乐器，形状像钟，有柄。' },
      { term: '磬', explanation: '古代用玉或石制成的打击乐器。' },
      { term: '玻璃', explanation: '古代的玻璃，指天然水晶石之类。' }
    ],
    background: '此诗是杨万里晚年闲居家乡时所作，写冬天儿童取冰嬉戏的场景。',
    familiarity: 1 },
  { title: '寒菊', poetName: '郑思肖', content: '花开不并百花丛，独立疏篱趣未穷。宁可枝头抱香死，何曾吹落北风中。',
    annotations: [
      { term: '不并', explanation: '不依傍。' },
      { term: '百花丛', explanation: '百花争艳的花丛。' },
      { term: '独立', explanation: '独自开放。' },
      { term: '疏篱', explanation: '稀疏的篱笆。' },
      { term: '趣', explanation: '志趣。' },
      { term: '未穷', explanation: '未尽。' },
      { term: '抱香死', explanation: '抱着香气死去，指菊花枯萎后花瓣不落。' }
    ],
    background: '此诗是郑思肖宋亡后所作，借菊花宁死不肯落在北风中，表达了对故国的坚贞不渝之情。',
    familiarity: 1 },
  { title: '江畔独步寻花', poetName: '杜甫', content: '黄四娘家花满蹊，千朵万朵压枝低。留连戏蝶时时舞，自在娇莺恰恰啼。',
    annotations: [
      { term: '江畔', explanation: '江边。' },
      { term: '独步', explanation: '一个人散步。' },
      { term: '黄四娘', explanation: '杜甫居住的成都浣花溪边的一位妇女。' },
      { term: '蹊', explanation: '小路。' },
      { term: '留连', explanation: '留恋不愿离开。' },
      { term: '恰恰', explanation: '象声词，黄莺的啼叫声。' }
    ],
    background: '此诗是杜甫定居成都草堂后，春日漫步江边赏花时所作，共七首，此为第六首。',
    familiarity: 2 },
  { title: '七律·长征', poetName: '毛泽东', content: '红军不怕远征难，万水千山只等闲。五岭逶迤腾细浪，乌蒙磅礴走泥丸。金沙水拍云崖暖，大渡桥横铁索寒。更喜岷山千里雪，三军过后尽开颜。',
    annotations: [
      { term: '七律', explanation: '七言律诗。' },
      { term: '长征', explanation: '1934年至1936年中国工农红军主力从长江南北各苏区向陕甘苏区的战略转移。' },
      { term: '等闲', explanation: '平常，不放在眼里。' },
      { term: '五岭', explanation: '即越城岭、都庞岭、萌渚岭、骑田岭、大庾岭的总称。' },
      { term: '逶迤', explanation: '弯曲绵延的样子。' },
      { term: '乌蒙', explanation: '乌蒙山，在云南、贵州之间。' },
      { term: '磅礴', explanation: '气势雄伟的样子。' },
      { term: '走泥丸', explanation: '像滚动的小泥丸。' },
      { term: '金沙', explanation: '金沙江。' },
      { term: '云崖', explanation: '高耸入云的山崖。' },
      { term: '大渡', explanation: '大渡河。' },
      { term: '岷山', explanation: '在四川、甘肃交界的地方。' },
      { term: '三军', explanation: '指中国工农红军第一、第二、第四方面军。' }
    ],
    background: '此诗作于1935年10月，是毛泽东在长征即将胜利结束时所作。诗人以宏伟的气魄，写出了红军长征的艰辛与豪迈。',
    familiarity: 3 },
  { title: '菩萨蛮·大柏地', poetName: '毛泽东', content: '赤橙黄绿青蓝紫，谁持彩练当空舞？雨后复斜阳，关山阵阵苍。当年鏖战急，弹洞前村壁。装点此关山，今朝更好看。',
    annotations: [
      { term: '菩萨蛮', explanation: '词牌名。' },
      { term: '大柏地', explanation: '在江西瑞金以北，是1929年红军歼敌之地。' },
      { term: '彩练', explanation: '彩色的丝绸，比喻彩虹。' },
      { term: '斜阳', explanation: '傍晚的太阳。' },
      { term: '关山', explanation: '关口和山岳。' },
      { term: '鏖战', explanation: '激烈的战斗。' },
      { term: '弹洞', explanation: '枪弹打穿的洞。' },
      { term: '装点', explanation: '装饰点缀。' }
    ],
    background: '此词作于1933年夏，是毛泽东重过大柏地时所作。回忆当年红军在这里的激烈战斗，赞美革命根据地的大好风光。',
    familiarity: 2 },
  { title: '书湖阴先生壁', poetName: '王安石', content: '茅檐长扫净无苔，花木成畦手自栽。一水护田将绿绕，两山排闼送青来。',
    annotations: [
      { term: '湖阴先生', explanation: '杨德逢，王安石的邻居。' },
      { term: '茅檐', explanation: '茅屋的屋檐，这里代指庭院。' },
      { term: '无苔', explanation: '没有青苔。' },
      { term: '成畦', explanation: '成行成垄。' },
      { term: '一水', explanation: '一条小溪。' },
      { term: '护田', explanation: '护卫着田地。' },
      { term: '排闼', explanation: '推开门。' },
      { term: '送青来', explanation: '把青色送来。' }
    ],
    background: '此诗是王安石题在邻居杨德逢家墙上的诗。前两句写杨家的清静整洁，后两句用拟人手法描写山水对杨家的依恋。',
    familiarity: 2 },
  { title: '迢迢牵牛星', poetName: '佚名', content: '迢迢牵牛星，皎皎河汉女。纤纤擢素手，札札弄机杼。终日不成章，泣涕零如雨。河汉清且浅，相去复几许。盈盈一水间，脉脉不得语。',
    annotations: [
      { term: '迢迢', explanation: '遥远的样子。' },
      { term: '牵牛星', explanation: '俗称牛郎星。' },
      { term: '皎皎', explanation: '明亮的样子。' },
      { term: '河汉女', explanation: '指织女星。河汉，银河。' },
      { term: '纤纤', explanation: '细长的样子。' },
      { term: '擢', explanation: '伸出。' },
      { term: '素手', explanation: '白皙的手。' },
      { term: '札札', explanation: '拟声词，机织声。' },
      { term: '弄', explanation: '摆弄。' },
      { term: '机杼', explanation: '织机的梭子。' },
      { term: '章', explanation: '花纹。' },
      { term: '泣涕', explanation: '眼泪。' },
      { term: '零', explanation: '落下。' },
      { term: '脉脉', explanation: '相视无言的样子。' }
    ],
    background: '《迢迢牵牛星》是《古诗十九首》中的一首，是借牛郎织女的故事，写人间的离别相思之情。',
    familiarity: 2 },
  { title: '石灰吟', poetName: '于谦', content: '千锤万凿出深山，烈火焚烧若等闲。粉骨碎身浑不怕，要留清白在人间。',
    annotations: [
      { term: '吟', explanation: '古代诗歌的一种形式。' },
      { term: '千锤万凿', explanation: '无数次的捶击开凿。' },
      { term: '若等闲', explanation: '好像很平常的事。' },
      { term: '浑', explanation: '全，全然。' },
      { term: '清白', explanation: '指石灰洁白的本色，又喻高尚的节操。' }
    ],
    background: '此诗是于谦十二岁时所作，借物喻人，表达了自己不畏艰险、保持高尚情操的志向。',
    familiarity: 3 },
  { title: '竹石', poetName: '郑燮', content: '咬定青山不放松，立根原在破岩中。千磨万击还坚劲，任尔东西南北风。',
    annotations: [
      { term: '咬定', explanation: '紧紧扎根。' },
      { term: '立根', explanation: '扎根。' },
      { term: '破岩', explanation: '裂开的山岩。' },
      { term: '坚劲', explanation: '坚定强劲。' },
      { term: '任', explanation: '任凭。' },
      { term: '尔', explanation: '你。' }
    ],
    background: '此诗是郑燮题画诗，借物喻人，赞美岩竹的顽强和坚贞，表达了诗人不向任何邪恶势力低头的气节。',
    familiarity: 3 },
  { title: '采薇', poetName: '佚名', content: '昔我往矣，杨柳依依。今我来思，雨雪霏霏。行道迟迟，载渴载饥。我心伤悲，莫知我哀！',
    annotations: [
      { term: '昔', explanation: '从前。' },
      { term: '往', explanation: '指当初去从军。' },
      { term: '矣', explanation: '语气助词，相当于"了"。' },
      { term: '依依', explanation: '形容树枝柔弱，随风摇摆的样子。' },
      { term: '思', explanation: '句末语气助词。' },
      { term: '霏霏', explanation: '雪下得很大的样子。' },
      { term: '迟迟', explanation: '迟缓的样子。' },
      { term: '载', explanation: '又。' },
      { term: '莫', explanation: '没有人。' }
    ],
    background: '《采薇》是《诗经·小雅》中的一篇，写的是远征的士兵在归途中对战争的反思和对家乡的思念。课文选取了其中六句。',
    familiarity: 2 },
  { title: '早春呈水部张十八员外', poetName: '韩愈', content: '天街小雨润如酥，草色遥看近却无。最是一年春好处，绝胜烟柳满皇都。',
    annotations: [
      { term: '呈', explanation: '恭敬地送上。' },
      { term: '水部张十八员外', explanation: '指唐代诗人张籍。' },
      { term: '天街', explanation: '京城街道。' },
      { term: '酥', explanation: '酥油。' },
      { term: '最是', explanation: '正是。' },
      { term: '绝胜', explanation: '远远胜过。' },
      { term: '烟柳', explanation: '笼罩在烟气中的柳树。' },
      { term: '皇都', explanation: '指唐代都城长安。' }
    ],
    background: '此诗是韩愈赠给好友张籍的描写早春美景的七言绝句。诗人用细腻的笔触描绘了早春的独特景色。',
    familiarity: 2 },
  { title: '游园不值', poetName: '叶绍翁', content: '应怜屐齿印苍苔，小扣柴扉久不开。春色满园关不住，一枝红杏出墙来。',
    annotations: [
      { term: '游园不值', explanation: '意思是想游园没能进去。值，遇到。' },
      { term: '应', explanation: '应该，表示猜测。' },
      { term: '怜', explanation: '怜惜。' },
      { term: '屐齿', explanation: '木屐底下凸出的部分。' },
      { term: '小扣', explanation: '轻轻地敲。' },
      { term: '柴扉', explanation: '用木柴、树枝编成的门。' }
    ],
    background: '此诗是叶绍翁春游访友未遇之作。诗人以小见大，从伸出墙外的一枝红杏感受到园中盎然的春意。',
    familiarity: 3 },
  { title: '清平乐', poetName: '黄庭坚', content: '春归何处？寂寞无行路。若有人知春去处，唤取归来同住。春无踪迹谁知？除非问取黄鹂。百啭无人能解，因风飞过蔷薇。',
    annotations: [
      { term: '清平乐', explanation: '词牌名。' },
      { term: '行路', explanation: '留下的踪迹。' },
      { term: '唤取', explanation: '唤来。' },
      { term: '问取', explanation: '问。' },
      { term: '黄鹂', explanation: '黄莺。' },
      { term: '百啭', explanation: '形容黄鹂宛转的鸣声。' },
      { term: '啭', explanation: '鸟鸣。' },
      { term: '因风', explanation: '顺着风势。' },
      { term: '蔷薇', explanation: '花木名，春天开花。' }
    ],
    background: '此词是黄庭坚的惜春之作。诗人以清新活泼的语言，描写了对春天归去的惋惜和对春天消息的追寻。',
    familiarity: 1 }
];

let added = 0, skipped = 0;
for (const p of newPoems) {
  const poetId = poetIdByName[p.poetName];
  if (!poetId) { console.log('!!! no poet:', p.title, p.poetName); continue; }
  if (poems.find(x => x.title === p.title && x.poetId === poetId)) {
    console.log('  skip:', p.title); skipped++; continue;
  }
  poems.push({ id: crypto.randomBytes(4).toString('hex'), corpus: 'primary', poetId, ...p });
  added++;
  console.log('  +', p.title);
}
fs.writeFileSync(poemsFile, JSON.stringify(poems, null, 2) + '\n');
console.log(`\nAdded ${added}, skipped ${skipped}. Total poems: ${poems.length}`);