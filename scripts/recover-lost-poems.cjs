const fs = require('fs');
const crypto = require('crypto');

// 1. Add 李峤
const poetsFile = 'src/data/poets.json';
const poets = JSON.parse(fs.readFileSync(poetsFile, 'utf8'));
const liqiaoId = '2ac5a099';
if (!poets.find(p => p.id === liqiaoId)) {
  poets.push({ id: liqiaoId, name: '李峤', birthYear: 644, deathYear: 713, dynastyId: 'tang', familiarity: 1, corpus: 'primary' });
}

// 2. Add 唐寅
const tangyinId = 'cfab8a18';
if (!poets.find(p => p.id === tangyinId)) {
  poets.push({ id: tangyinId, name: '唐寅', birthYear: 1470, deathYear: 1524, dynastyId: 'ming', familiarity: 1, corpus: 'primary' });
}
fs.writeFileSync(poetsFile, JSON.stringify(poets, null, 2) + '\n');
console.log('Poets:', poets.length);

// 3. Add 13 poems
const poemsFile = 'src/data/poems.json';
const poems = JSON.parse(fs.readFileSync(poemsFile, 'utf8'));
const newPoems = [
  { title: '江南', poetId: '6c494e505e9c', content: '江南可采莲，莲叶何田田，鱼戏莲叶间。鱼戏莲叶东，鱼戏莲叶西，鱼戏莲叶南，鱼戏莲叶北。',
    annotations: [
      { term: '江南', explanation: '《相和歌辞·相和曲》之一。' },
      { term: '何', explanation: '多么。' },
      { term: '田田', explanation: '莲叶新鲜碧绿貌。' },
      { term: '鱼戏莲叶间（东、西、南、北）', explanation: '形容鱼在荷叶下面往来游动。' }
    ],
    background: '《江南》是产生于汉代的一首采莲歌。关于此诗的创作背景，学界有不同的说法。有人说是一首情歌，"鱼戏莲叶"有暗喻男女欢爱的意思；也有人说这仅仅是写劳动生活的快乐。',
    familiarity: 2 },
  { title: '风', poetId: liqiaoId, content: '解落三秋叶，能开二月花。过江千尺浪，入竹万竿斜。',
    annotations: [
      { term: '解落', explanation: '吹落，散落。' },
      { term: '三秋', explanation: '晚秋，农历九月。' },
      { term: '二月', explanation: '早春，农历二月，指春季。' },
      { term: '过', explanation: '经过。' },
      { term: '斜', explanation: '倾斜。' }
    ],
    background: '此诗作年未得确证。有人认为，李峤、苏味道、杜审言三人一起在春天游泸峰山，山上景色秀美，一片葱郁。等及峰顶之时，一阵清风吹来，李峤诗兴大发，随口吟出了这首诗。',
    familiarity: 1 },
  { title: '赠汪伦', poetId: '674e767d', content: '李白乘舟将欲行，忽闻岸上踏歌声。桃花潭水深千尺，不及汪伦送我情。',
    annotations: [
      { term: '汪伦', explanation: '李白的朋友。唐代泾州（今安徽省泾县）人。' },
      { term: '踏歌', explanation: '唐代一种流行于民间的歌唱方式，歌唱时以脚步击地打节拍，边走边唱。' },
      { term: '桃花潭', explanation: '在今安徽泾县西南。' }
    ],
    background: '李白游泾县（今安徽）时，受汪伦盛情款待。汪伦曾写信邀请李白，信中说"先生好游乎？此地有十里桃花。先生好饮乎？此地有万家酒店。"李白欣然前往。及至才发现"桃花"是潭水名，"万家"是店主人姓万，李白大笑。留数日离去时，写下这首诗赠别。',
    familiarity: 3 },
  { title: '寻隐者不遇', poetId: '8d3e5c9b', content: '松下问童子，言师采药去。只在此山中，云深不知处。',
    annotations: [
      { term: '隐者', explanation: '隐居的人。' },
      { term: '童子', explanation: '小孩，这里指隐者的弟子。' },
      { term: '言', explanation: '说，告诉。' },
      { term: '师', explanation: '指隐者。' },
      { term: '云深', explanation: '山高云深，云雾缭绕。' }
    ],
    background: '此诗是贾岛拜访隐士未能谋面之作，表达了诗人对隐逸生活的向往，以及对隐者高洁情操的仰慕。',
    familiarity: 2 },
  { title: '池上', poetId: '767d5c456613', content: '小娃撑小艇，偷采白莲回。不解藏踪迹，浮萍一道开。',
    annotations: [
      { term: '小娃', explanation: '小孩。' },
      { term: '撑', explanation: '撑船，用篙使船前进。' },
      { term: '小艇', explanation: '小船。' },
      { term: '偷采', explanation: '偷偷地采摘。' },
      { term: '白莲', explanation: '白色的莲花。' },
      { term: '不解', explanation: '不知道；不懂得。' },
      { term: '藏', explanation: '隐藏，掩盖。' },
      { term: '浮萍', explanation: '浮生在水面上的一种植物。' },
      { term: '一道', explanation: '一条。' },
      { term: '开', explanation: '分开。' }
    ],
    background: '此诗写一个小孩偷采白莲的情景，诗人用白描手法，把小娃娃的调皮、天真烂漫的形象刻画得栩栩如生。',
    familiarity: 2 },
  { title: '画鸡', poetId: tangyinId, content: '头上红冠不用裁，满身雪白走将来。平生不敢轻言语，一叫千门万户开。',
    annotations: [
      { term: '裁', explanation: '裁剪，这里指制作。' },
      { term: '走将来', explanation: '走过来。将，助词，无实义。' },
      { term: '平生', explanation: '平素，平常。' },
      { term: '轻', explanation: '随便，轻易。' },
      { term: '千门万户', explanation: '形容众多人家。' }
    ],
    background: '《画鸡》是明代画家、诗人唐寅题画之作，借画中雄鸡的形象，表达了诗人的志向和抱负。',
    familiarity: 2 },
  { title: '登鹳雀楼', poetId: '738b4e4b6da3', content: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。',
    annotations: [
      { term: '鹳雀楼', explanation: '古时建于山西永济县（蒲州古城）西南城角的楼，又名鹳鹊楼，是唐代登临胜地之一。' },
      { term: '白日', explanation: '太阳。' },
      { term: '依', explanation: '依傍，依偎。' },
      { term: '尽', explanation: '消失。' },
      { term: '入', explanation: '流入。' },
      { term: '欲', explanation: '想要。' },
      { term: '穷', explanation: '尽，使达到极点。' },
      { term: '千里目', explanation: '眼界开阔，看到极远的地方。' },
      { term: '更', explanation: '再。' }
    ],
    background: '此诗是唐代诗人王之涣登鹳雀楼眺望时所作，描绘了祖国壮丽河山，表达了诗人开阔的胸襟和积极进取的精神。',
    familiarity: 3 },
  { title: '望庐山瀑布', poetId: '674e767d', content: '日照香炉生紫烟，遥看瀑布挂前川。飞流直下三千尺，疑是银河落九天。',
    annotations: [
      { term: '香炉', explanation: '庐山香炉峰，在庐山西北部，因形似香炉且山上经常笼罩着云烟而得名。' },
      { term: '紫烟', explanation: '日光透过水汽呈现的紫色烟雾。' },
      { term: '遥看', explanation: '远远地望去。' },
      { term: '挂', explanation: '悬挂。' },
      { term: '前川', explanation: '山前面的河流。' },
      { term: '飞流', explanation: '飞泻而下的水流。' },
      { term: '直下', explanation: '垂直地落下。' },
      { term: '三千尺', explanation: '形容极高，夸张手法。' },
      { term: '疑', explanation: '怀疑，以为。' },
      { term: '银河', explanation: '晴天夜晚出现的银白色光带，状如天河。' },
      { term: '九天', explanation: '古人认为天有九重，九天是天的最高处。' }
    ],
    background: '这首诗是诗人李白五十岁左右隐居庐山时写的一首风景诗，是诗人远望庐山瀑布时抒发的感慨，描写了庐山瀑布壮丽的景色。',
    familiarity: 3 },
  { title: '夜宿山寺', poetId: '674e767d', content: '危楼高百尺，手可摘星辰。不敢高声语，恐惊天上人。',
    annotations: [
      { term: '危楼', explanation: '高楼。危，高。' },
      { term: '百尺', explanation: '极言其高，夸张手法。' },
      { term: '摘', explanation: '采摘，摘取。' },
      { term: '星辰', explanation: '星星的通称。' },
      { term: '语', explanation: '说话。' },
      { term: '恐', explanation: '担心，恐怕。' },
      { term: '天上人', explanation: '天上的人，指神话传说中的神仙。' }
    ],
    background: '此诗是李白夜宿山顶寺院时所写，诗人用夸张手法描绘了山寺的高耸，给人以丰富的想象空间。',
    familiarity: 2 },
  { title: '赋得古原草送别', poetId: '767d5c456613', content: '离离原上草，一岁一枯荣。野火烧不尽，春风吹又生。远芳侵古道，晴翠接荒城。又送王孙去，萋萋满别情。',
    annotations: [
      { term: '赋得', explanation: '凡是指定、限定的诗题，例在题目上加"赋得"二字。' },
      { term: '离离', explanation: '青草茂盛的样子。' },
      { term: '一岁', explanation: '一年。' },
      { term: '枯荣', explanation: '枯萎和繁荣，指草的衰败和生长。' },
      { term: '远芳', explanation: '远处的芳草。' },
      { term: '侵', explanation: '侵占，长满。' },
      { term: '晴翠', explanation: '阳光照耀下的绿色。' },
      { term: '荒城', explanation: '荒芜的城镇。' },
      { term: '王孙', explanation: '本指贵族后代，此指远行的友人。' },
      { term: '萋萋', explanation: '草茂盛的样子。' }
    ],
    background: '此诗是白居易十六岁时的作品，是一首送别诗，也是咏物诗。诗人通过对古原上野草的描绘，抒发送别友人时的依依惜别之情。',
    familiarity: 3 },
  { title: '晓出净慈寺送林子方', poetId: '67684e0791cc', content: '毕竟西湖六月中，风光不与四时同。接天莲叶无穷碧，映日荷花别样红。',
    annotations: [
      { term: '晓出', explanation: '早晨走出。' },
      { term: '净慈寺', explanation: '西湖边上的著名佛寺，在杭州西湖南岸。' },
      { term: '林子方', explanation: '作者的朋友，官居阁学士。' },
      { term: '毕竟', explanation: '到底。' },
      { term: '六月中', explanation: '六月的时候。' },
      { term: '风光', explanation: '风景。' },
      { term: '四时', explanation: '四季。' },
      { term: '接天', explanation: '连接着天，形容视野广阔。' },
      { term: '无穷', explanation: '无穷尽。' },
      { term: '碧', explanation: '碧绿。' },
      { term: '映日', explanation: '映照着太阳。' },
      { term: '别样红', explanation: '特别红。别样，特别。' }
    ],
    background: '此诗是杨万里在杭州西湖净慈寺送别友人林子方时所作。诗的前两句是"因"，后两句是"果"，以美景衬托离别的深情。',
    familiarity: 3 },
  { title: '绝句', poetId: '675c752b', content: '两个黄鹂鸣翠柳，一行白鹭上青天。窗含西岭千秋雪，门泊东吴万里船。',
    annotations: [
      { term: '黄鹂', explanation: '黄莺，一种羽毛黄色的鸣禽。' },
      { term: '鸣', explanation: '鸣叫。' },
      { term: '翠柳', explanation: '翠绿色的柳树。' },
      { term: '白鹭', explanation: '一种羽毛白色的水鸟。' },
      { term: '青天', explanation: '蓝色的天空。' },
      { term: '含', explanation: '包含，这里指透过窗户可以看见。' },
      { term: '西岭', explanation: '指岷山，在成都西面。' },
      { term: '千秋', explanation: '千年，形容时间久远。' },
      { term: '泊', explanation: '停船靠岸。' },
      { term: '东吴', explanation: '今江苏、浙江一带。三国时的吴国地处东部，故称东吴。' }
    ],
    background: '此诗是杜甫定居成都草堂后所作，是一首写景抒情的七言绝句。诗人以清新自然的语言描绘了草堂周围明媚秀丽的春光。',
    familiarity: 3 },
  { title: '早发白帝城', poetId: '674e767d', content: '朝辞白帝彩云间，千里江陵一日还。两岸猿声啼不住，轻舟已过万重山。',
    annotations: [
      { term: '发', explanation: '出发。' },
      { term: '白帝城', explanation: '故址在今重庆奉节县东白帝山上。' },
      { term: '朝', explanation: '早晨。' },
      { term: '辞', explanation: '辞别。' },
      { term: '彩云间', explanation: '云霞缭绕的高处。' },
      { term: '江陵', explanation: '今湖北江陵县。' },
      { term: '还', explanation: '返回。' },
      { term: '猿', explanation: '猿猴。' },
      { term: '啼', explanation: '啼叫。' },
      { term: '住', explanation: '停止。' },
      { term: '轻舟', explanation: '轻快的小船。' },
      { term: '万重山', explanation: '层层叠叠的山岭。' }
    ],
    background: '此诗是李白在流放夜郎途中遇赦，乘舟东返时所作。诗人以轻快之笔，写出了遇赦后的喜悦心情。',
    familiarity: 3 }
];

let added = 0, skipped = 0;
for (const p of newPoems) {
  if (poems.find(x => x.title === p.title && x.poetId === p.poetId)) {
    console.log('  skip (exists):', p.title);
    skipped++;
    continue;
  }
  poems.push({ id: crypto.randomBytes(4).toString('hex'), corpus: 'primary', ...p });
  added++;
  console.log('  +', p.title);
}
fs.writeFileSync(poemsFile, JSON.stringify(poems, null, 2) + '\n');
console.log(`\nAdded ${added}, skipped ${skipped}, total poems: ${poems.length}`);
